import SwiftUI

/// Detail for a single record. Pushed inside the tab's existing
/// `NavigationStack`, so it deliberately does not use `PrismScreenScaffold`
/// (which would nest a second stack).
struct RecordDetailScreen: View {
    let recordID: UUID

    @Environment(PrismStore.self) private var store
    @State private var loggingProgress = false
    @Environment(AppNavigationModel.self) private var navigation: AppNavigationModel?
    @State private var addingNote = false
    @State private var editing = false
    /// Captured on first appearance. A study detail anchors on one activity
    /// log; deleting that activity from the timeline below would otherwise
    /// kill the whole screen even though the subject still exists.
    @State private var fallbackEntityID: UUID?
    @State private var seriesToast: SeriesProgressChange?
    @State private var toastDismissTask: Task<Void, Never>?

    private var readingSessionPresented: Binding<Bool> {
        Binding(
            get: { navigation?.readingSession?.recordID == (record?.id ?? recordID) },
            set: { presented in
                if !presented { navigation?.readingSession = nil }
            }
        )
    }

    private var record: RecordItem? {
        if let direct = store.record(id: recordID) { return direct }
        guard let entityID = fallbackEntityID else { return nil }
        return store.records.first { $0.entityID == entityID }
    }

    var body: some View {
        ZStack {
            if let record {
                ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let seriesProgress = record.seriesProgress {
                            // A series is laid out as the web lays it out
                            // (`SeriesDetailPage`), with its own hero.
                            PrismGlassSection {
                                SeriesDetailContent(
                                    record: record,
                                    progress: seriesProgress,
                                    onEdit: { editing = true },
                                    onRevealSeason: { season in
                                        withAnimation(PrismMotion.screen) {
                                            proxy.scrollTo("series.season.\(season)", anchor: UnitPoint(x: 0.5, y: 0.2))
                                        }
                                    },
                                    onProgressSaved: showSeriesToast
                                )
                            }
                            .task(id: record.id) { await store.fillSeriesEpisodeDetails(id: record.id) }
                        } else if record.category == .reading {
                            // Book, film and game details follow the web's
                            // pages too (`ReadingDetailPage`, `MediaDetailPage`,
                            // `GameDetailPage`).
                            PrismGlassSection {
                                ReadingDetailContent(
                                    record: record,
                                    onAddProgress: { loggingProgress = true },
                                    onAddNote: { addingNote = true }
                                )
                            }
                        } else if record.cultureType == .movie {
                            PrismGlassSection { MediaDetailContent(record: record) }
                        } else if record.cultureType == .game {
                            PrismGlassSection { GameDetailHero(record: record) }
                        } else {
                            hero(record)
                        }

                        PrismGlassSection {
                            VStack(spacing: 14) {
                                if record.category == .study {
                                    let activities = StudyGrouping.activities(for: record, in: store.records)
                                    StudyStatusCard(record: record, activities: activities)
                                    StudyTrendCard(record: record, activities: activities)
                                    StudyActivityTimeline(record: record, activities: activities)
                                    StudyTableOfContents(record: record)
                                    studyReflection(record)
                                }

                                if record.cultureType == .game {
                                    GameSessionsSection(record: record)
                                }

                                // Books, films, games and series show their
                                // synopsis in their hero; a book its review too.
                                if record.cultureType == nil, record.category != .reading,
                                   let overview = record.overview, !overview.isEmpty {
                                    overviewCard(overview)
                                }

                                if record.category != .reading, !record.review.isEmpty {
                                    reviewCard(record)
                                }

                                metaCard(record)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
                .navigationTitle(record.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            if record.category == .reading {
                                Button("읽기 시작", systemImage: "book") {
                                    navigation?.readingSession = ReadingSessionState(
                                        recordID: record.id,
                                        startedAt: .now,
                                        currentPage: record.pagesRead > 0 ? String(record.pagesRead) : "",
                                        note: ""
                                    )
                                }
                                .accessibilityIdentifier("detail.readingSession")
                                Button("진도 기록", systemImage: "chart.line.uptrend.xyaxis") {
                                    loggingProgress = true
                                }
                                Button("메모 추가", systemImage: "text.quote") {
                                    addingNote = true
                                }
                                Divider()
                            } else if record.category == .study {
                                Button("공부 기록 추가", systemImage: "plus.circle") {
                                    loggingProgress = true
                                }
                                Divider()
                            }
                            Button("편집", systemImage: "pencil") { editing = true }
                        } label: {
                            Label("작업", systemImage: "ellipsis")
                        }
                        .accessibilityIdentifier("detail.actions")
                    }
                }
                .sheet(isPresented: $loggingProgress) {
                    if record.category == .study {
                        StudyProgressSheet(record: record)
                    } else {
                        ReadingProgressSheet(record: record)
                    }
                }
                // Presented from the model's session, so rebuilding this
                // screen on a fold or rotation keeps the session open.
                .fullScreenCover(isPresented: readingSessionPresented) {
                    ReadingSessionScreen(record: record)
                }
                .sheet(isPresented: $addingNote) {
                    ReadingNoteSheet(record: record)
                }
                .sheet(isPresented: $editing) {
                    switch record.category {
                    case .reading: ReadingEditSheet(record: record)
                    case .study: StudyEditSheet(record: record)
                    default: CultureEditSheet(record: record)
                    }
                }
                }
            } else {
                ContentUnavailableView("기록을 찾을 수 없습니다", systemImage: "questionmark.folder")
            }
        }
        // The shared library wall switches to this record's cover, blurred,
        // as its hero (spec §4.5).
        .prismWallBackground()
        .overlay(alignment: .top) {
            if let seriesToast {
                SeriesProgressToastView(change: seriesToast)
                    .padding(.horizontal, 18)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onAppear {
            if fallbackEntityID == nil {
                fallbackEntityID = store.record(id: recordID)?.entityID
            }
        }
    }

    /// Floats the update toast for a beat, replacing any one still showing —
    /// binge-tapping episodes shouldn't queue a parade of toasts.
    private func showSeriesToast(_ change: SeriesProgressChange) {
        toastDismissTask?.cancel()
        withAnimation(PrismMotion.morph) { seriesToast = change }

        toastDismissTask = Task {
            try? await Task.sleep(for: .milliseconds(2400))
            guard !Task.isCancelled else { return }
            withAnimation(PrismMotion.screen) { seriesToast = nil }
        }
    }

    // MARK: - Hero

    private func hero(_ record: RecordItem) -> some View {
        HStack(alignment: .top, spacing: 16) {
            // The web's detail hero shows the artwork untouched at 2:3 and
            // leaves progress to the meter below
            // (`src/features/prismlog/pages/recordsPage.jsx:700`).
            CoverImage(url: record.coverURL, accent: record.accent, title: record.title, cornerRadius: 18)
                .frame(width: 118, height: 177)
                .shadow(color: .black.opacity(0.24), radius: 16, y: 10)

            VStack(alignment: .leading, spacing: 8) {
                Text(record.categoryLabel)
                    .font(.prismMicro)
                    .foregroundStyle(record.accent.color)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background { Capsule().fill(record.accent.color.opacity(0.16)) }

                Text(record.title)
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
                    .fixedSize(horizontal: false, vertical: true)

                if let author = record.author, !author.isEmpty {
                    Text(author)
                        .font(.prismCaption)
                        .prismMuted()
                        .fixedSize(horizontal: false, vertical: true)
                }

                if record.rating > 0 {
                    RatingStars(rating: record.rating, accent: record.accent)
                }

                if let status = record.status, !status.isEmpty {
                    Text(status)
                        .font(.prismCaption)
                        .prismMuted()
                }

                badges(record)
            }

            Spacer(minLength: 0)
        }
        .padding(.top, 4)
    }

    /// Publisher, publication date, medium and tags — the same chips the web
    /// shows under a book's title.
    @ViewBuilder
    private func badges(_ record: RecordItem) -> some View {
        let labels: [String] = [
            record.publisher,
            record.publishedDate,
            record.medium?.label,
            record.readingStatus?.label,
        ].compactMap { $0 }.filter { !$0.isEmpty } + record.tags.map { "#\($0)" }

        if !labels.isEmpty {
            FlowLayout(spacing: 6) {
                ForEach(labels, id: \.self) { label in
                    Text(label)
                        .font(.prismMicro)
                        .foregroundStyle(record.accent.color)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background { Capsule().fill(record.accent.color.opacity(0.14)) }
                }
            }
            .padding(.top, 2)
        }
    }


    // MARK: - Cards


    @ViewBuilder
    private func studyReflection(_ record: RecordItem) -> some View {
        let goal = record.payload.string("goal") ?? ""
        let retrospect = record.payload.string("retrospect") ?? ""

        if !goal.isEmpty || !retrospect.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                if !goal.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        cardTitle("학습 목표")
                        Text(goal)
                            .font(.prismBody)
                            .foregroundStyle(PrismColor.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                if !goal.isEmpty, !retrospect.isEmpty {
                    Divider().overlay(PrismColor.hairline)
                }

                if !retrospect.isEmpty {
                    VStack(alignment: .leading, spacing: 5) {
                        cardTitle("회고")
                        Text(retrospect)
                            .font(.prismBody)
                            .foregroundStyle(PrismColor.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .prismGlassCard()
        }
    }

    private func overviewCard(_ overview: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            cardTitle("줄거리")
            Text(overview)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func reviewCard(_ record: RecordItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            cardTitle("한 줄 평")
            Text(record.review)
                .font(.prismBody)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }



    private func metaCard(_ record: RecordItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            cardTitle("정보")

            metaRow("기록 시각", value: record.occurredAt.formatted(.dateTime.year().month().day().hour().minute()))
            metaRow("마지막 수정", value: record.updatedAt.formatted(.dateTime.year().month().day()))

            if !record.tags.isEmpty {
                metaRow("태그", value: record.tags.map { "#\($0)" }.joined(separator: " "))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    // MARK: - Bits

    private func cardTitle(_ text: String) -> some View {
        Text(text)
            .font(.prismHeadline)
            .foregroundStyle(PrismColor.text)
    }

    private func metaRow(_ label: String, value: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(label)
                .font(.prismCaption)
                .prismMuted()
                .frame(width: 76, alignment: .leading)

            Text(value)
                .font(.prismCaption)
                .foregroundStyle(PrismColor.text)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
    }

}

// MARK: - Shared bits

struct RatingStars: View {
    let rating: Int
    var accent: PrismAccent = .study
    var size: CGFloat = 13

    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { index in
                Image(systemName: index <= rating ? "star.fill" : "star")
                    .font(.system(size: size))
                    .foregroundStyle(index <= rating ? accent.color : PrismColor.textMuted.opacity(0.5))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("별점 \(rating)점")
    }
}

/// Tappable star rating.
struct StarRatingPicker: View {
    @Binding var rating: Int
    var accent: PrismAccent = .study
    var size: CGFloat = 22

    var body: some View {
        HStack(spacing: 6) {
            ForEach(1...5, id: \.self) { index in
                Button {
                    // Tapping the current rating clears it, so a mis-tap is
                    // recoverable without a separate "지우기" control.
                    rating = rating == index ? 0 : index
                    PrismHaptics.selection()
                } label: {
                    Image(systemName: index <= rating ? "star.fill" : "star")
                        .font(.system(size: size))
                        .foregroundStyle(index <= rating ? accent.color : PrismColor.textMuted.opacity(0.5))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(index)점")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityValue("\(rating)점")
    }
}

/// Progress bar that fills with category light.
struct ProgressMeter: View {
    let value: Double
    let accent: PrismAccent
    var height: CGFloat = 8

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.07))

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [accent.tone.main, accent.tone.light],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: proxy.size.width * (shown ? min(max(value, 0), 1) : 0))
                    .shadow(color: accent.color.opacity(0.5), radius: 4)
            }
        }
        .frame(height: height)
        .onAppear {
            if reduceMotion {
                shown = true
            } else {
                withAnimation(PrismMotion.meter) { shown = true }
            }
        }
        .accessibilityHidden(true)
    }
}

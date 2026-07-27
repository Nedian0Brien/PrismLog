import SwiftUI

/// Detail for a single record. Pushed inside the tab's existing
/// `NavigationStack`, so it deliberately does not use `PrismScreenScaffold`
/// (which would nest a second stack).
struct RecordDetailScreen: View {
    let recordID: UUID

    @Environment(PrismStore.self) private var store
    @State private var loggingProgress = false

    private var record: RecordItem? { store.record(id: recordID) }

    var body: some View {
        ZStack {
            if let record {
                SpectrumBloomBackground(focus: record.accent)

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        hero(record)

                        PrismGlassSection {
                            VStack(spacing: 14) {
                                if record.category == .reading {
                                    progressCard(record)
                                }

                                if !record.review.isEmpty {
                                    reviewCard(record)
                                }

                                if !record.readingNotes.isEmpty {
                                    notesCard(record)
                                }

                                if !record.readingSessions.isEmpty {
                                    sessionsCard(record)
                                }

                                metaCard(record)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.bottom, 130)
                }
                .scrollIndicators(.hidden)
                .navigationTitle(record.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if record.category == .reading {
                        ToolbarItem(placement: .primaryAction) {
                            Button {
                                loggingProgress = true
                            } label: {
                                Label("진도 기록", systemImage: "plus")
                            }
                            .accessibilityIdentifier("detail.addProgress")
                        }
                    }
                }
                .sheet(isPresented: $loggingProgress) {
                    ReadingProgressSheet(record: record)
                }
            } else {
                PrismColor.background.ignoresSafeArea()
                ContentUnavailableView("기록을 찾을 수 없습니다", systemImage: "questionmark.folder")
            }
        }
    }

    // MARK: - Hero

    private func hero(_ record: RecordItem) -> some View {
        HStack(alignment: .top, spacing: 16) {
            ProgressWaterCover(
                url: record.coverURL,
                progress: record.progress,
                accent: record.accent,
                width: 118
            )

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
            }

            Spacer(minLength: 0)
        }
        .padding(.top, 4)
    }

    // MARK: - Cards

    private func progressCard(_ record: RecordItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(record.progress)")
                    .font(PrismFont.numeral(38, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(record.accent.color)
                Text("%")
                    .font(PrismFont.numeral(20, weight: .bold))
                    .foregroundStyle(record.accent.color.opacity(0.7))

                Spacer(minLength: 0)

                if record.pagesTotal > 0 {
                    Text("\(record.pagesRead) / \(record.pagesTotal)p")
                        .font(.prismCallout)
                        .monospacedDigit()
                        .prismMuted()
                }
            }

            ProgressMeter(value: Double(record.progress) / 100, accent: record.accent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: record.accent.color)
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

    private func notesCard(_ record: RecordItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            cardTitle("메모 · 필사 \(record.readingNotes.count)개")

            ForEach(record.readingNotes) { note in
                VStack(alignment: .leading, spacing: 5) {
                    Text(note.text)
                        .font(.prismBody)
                        .foregroundStyle(PrismColor.text)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 6) {
                        if note.page > 0 {
                            Text("\(note.page)p")
                                .font(.prismMicro)
                                .monospacedDigit()
                                .foregroundStyle(record.accent.color)
                        }
                        if let date = note.date {
                            Text(date, format: .dateTime.year().month().day())
                                .font(.prismMicro)
                                .prismMuted()
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(record.accent.color.opacity(0.5))
                        .frame(width: 3)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private func sessionsCard(_ record: RecordItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            cardTitle("독서 세션 \(record.readingSessions.count)회")

            ForEach(record.readingSessions) { session in
                HStack(spacing: 12) {
                    Circle()
                        .fill(record.accent.color)
                        .frame(width: 7, height: 7)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(sessionHeadline(session))
                            .font(.prismCallout)
                            .foregroundStyle(PrismColor.text)

                        if let date = session.date {
                            Text(date, format: .dateTime.year().month().day())
                                .font(.prismMicro)
                                .prismMuted()
                        }
                    }

                    Spacer(minLength: 0)

                    if session.durationMinutes > 0 {
                        Text("\(session.durationMinutes)분")
                            .font(.prismMicro)
                            .monospacedDigit()
                            .prismMuted()
                    }
                }
            }
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

    private func sessionHeadline(_ session: ReadingSession) -> String {
        if session.pagesRead > 0 {
            "\(session.fromPages)p → \(session.toPages)p · \(session.pagesRead)쪽"
        } else {
            "\(session.fromProgress)% → \(session.toProgress)%"
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

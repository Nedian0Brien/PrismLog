import Charts
import PhotosUI
import SwiftUI
import UIKit

// MARK: - Status

/// The subject's standing right now: the bar, the raw scale under it, and the
/// two numbers the web pairs with them — what's left, and when you last showed
/// up. Ported from StudyDetailPage's CURRENT STATUS card
/// (`recordsPage.jsx:4056`).
struct StudyStatusCard: View {
    let record: RecordItem
    let activities: [StudyActivity]

    private var isPageMode: Bool {
        record.payload.string("progress_mode") ?? "page" == "page" && record.pagesTotal > 0
    }

    private var completed: Int { StudyGrouping.completedCount(record.payload) }
    private var total: Int { StudyGrouping.totalCount(record.payload) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .lastTextBaseline) {
                Text("CURRENT STATUS")
                    .font(.prismMicro)
                    .tracking(0.8)
                    .prismMuted()

                Spacer(minLength: 0)

                Text("\(record.progress)%")
                    .font(PrismFont.numeral(24, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(PrismAccent.study.color)
            }

            ProgressMeter(value: Double(record.progress) / 100, accent: .study, height: 12)

            HStack {
                Text(isPageMode ? "페이지 기준 진행" : "목차 기준 진행")
                    .font(.prismCaption)
                    .prismMuted()

                Spacer(minLength: 0)

                Text(isPageMode
                     ? "\(record.pagesRead) / \(record.pagesTotal)p"
                     : "\(completed) / \(total) 챕터")
                    .font(.prismCaption)
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)
            }

            Divider().overlay(PrismColor.hairline)

            HStack(spacing: 14) {
                stat(
                    symbol: "list.bullet",
                    label: "남은 과제",
                    value: isPageMode
                        ? "\(max(0, record.pagesTotal - record.pagesRead))p"
                        : "\(max(0, total - completed))개"
                )
                stat(
                    symbol: "calendar",
                    label: "마지막 기록",
                    value: (activities.first?.occurredAt ?? record.occurredAt)
                        .formatted(.relative(presentation: .named))
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private func stat(symbol: String, label: String, value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(PrismAccent.study.color)
                .frame(width: 34, height: 34)
                .background {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(PrismAccent.study.color.opacity(0.09))
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.prismMicro)
                    .prismMuted()
                Text(value)
                    .font(.prismCallout)
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Trend

/// Progress over the subject's activities: a step-aware line plus the TOTAL
/// donut. Each activity contributes its start point too when it jumped, so a
/// week off shows as a plateau rather than vanishing
/// (`buildStudyTrendPoints`, `recordsPage.jsx:2330`).
struct StudyTrendCard: View {
    let record: RecordItem
    let activities: [StudyActivity]

    private struct Point: Identifiable {
        let id = UUID()
        let order: Int
        let date: Date
        let progress: Int
    }

    private var points: [Point] {
        let chronological = activities.reversed()
        guard !chronological.isEmpty else {
            return [Point(order: 0, date: record.occurredAt, progress: record.progress)]
        }

        var built: [Point] = []
        for activity in chronological {
            // Web rule: emit the start point only when this activity actually
            // moved and the line isn't already there.
            if activity.progressDelta > 0, built.last?.progress != activity.progressStart {
                built.append(Point(order: built.count, date: activity.occurredAt, progress: activity.progressStart))
            }
            built.append(Point(order: built.count, date: activity.occurredAt, progress: activity.progress))
        }
        return built
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Progress Trend")
                .font(.prismMicro)
                .tracking(1.0)
                .textCase(.uppercase)
                .foregroundStyle(PrismAccent.study.color)

            HStack(alignment: .center, spacing: 18) {
                chart

                VStack(spacing: 4) {
                    ProgressDonut(value: Double(record.progress) / 100, accent: .study)

                    Text("TOTAL \(record.progress)%")
                        .font(PrismFont.numeral(13, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.study.color)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var chart: some View {
        Chart {
            ForEach(points) { point in
                AreaMark(
                    x: .value("순서", point.order),
                    y: .value("진행률", point.progress),
                    series: .value("진행", "study")
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            PrismAccent.study.color.opacity(0.28),
                            PrismAccent.study.color.opacity(0.02),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.linear)

                LineMark(
                    x: .value("순서", point.order),
                    y: .value("진행률", point.progress),
                    series: .value("진행", "study")
                )
                .foregroundStyle(PrismAccent.study.color)
                .interpolationMethod(.linear)
                .lineStyle(StrokeStyle(lineWidth: 2.4, lineCap: .round))

                PointMark(
                    x: .value("순서", point.order),
                    y: .value("진행률", point.progress)
                )
                .foregroundStyle(PrismColor.background)
                .symbolSize(46)

                PointMark(
                    x: .value("순서", point.order),
                    y: .value("진행률", point.progress)
                )
                .foregroundStyle(PrismAccent.study.color)
                .symbolSize(18)
            }
        }
        .chartYScale(domain: 0...100)
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, 50, 100]) {
                AxisValueLabel().font(.prismMicro).foregroundStyle(PrismColor.textMuted)
                AxisGridLine().foregroundStyle(PrismColor.hairline)
            }
        }
        .frame(height: 118)
        .accessibilityLabel("진행률 추세, 현재 \(record.progress)퍼센트")
    }
}

// MARK: - Activity timeline

/// The subject's session history, one block per day, newest first. Every card
/// opens the edit sheet — the web makes the whole activity a button, and this
/// is the only place a mistyped session can be fixed.
struct StudyActivityTimeline: View {
    let record: RecordItem
    let activities: [StudyActivity]

    @State private var editing: StudyActivity?

    private var days: [(date: Date, items: [StudyActivity])] {
        let calendar = Calendar.current
        return Dictionary(grouping: activities) { calendar.startOfDay(for: $0.occurredAt) }
            .map { (date: $0.key, items: $0.value.sorted { $0.occurredAt > $1.occurredAt }) }
            .sorted { $0.date > $1.date }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Study Timeline")
                    .font(.prismMicro)
                    .tracking(1.0)
                    .textCase(.uppercase)
                    .foregroundStyle(PrismAccent.study.color)

                Text("공부 타임라인")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
            }

            if activities.isEmpty {
                Text("아직 쌓인 공부 액티비티가 없습니다.")
                    .font(.prismCaption)
                    .prismMuted()
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(days, id: \.date) { day in
                        dayBlock(day)
                    }
                }
                .padding(.leading, 30)
                .background(alignment: .topLeading) {
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    PrismAccent.study.color.opacity(0.8),
                                    PrismAccent.study.color.opacity(0.27),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .frame(width: 2)
                        .offset(x: 10)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.study.color)
        .sheet(item: $editing) { activity in
            StudyActivityEditSheet(activity: activity)
        }
    }

    private func dayBlock(_ day: (date: Date, items: [StudyActivity])) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(day.date, format: .dateTime.day(.twoDigits))
                    .font(PrismFont.numeral(26, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(PrismColor.text)

                Text(sideLabel(day.date))
                    .font(.prismMicro)
                    .prismMuted()
            }

            ForEach(day.items) { activity in
                activityCard(activity)
            }
        }
        .overlay(alignment: .topLeading) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [PrismAccent.study.tone.light, PrismAccent.study.color],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 12, height: 12)
                .overlay { Circle().stroke(PrismColor.background, lineWidth: 2) }
                .shadow(color: PrismAccent.study.color.opacity(0.3), radius: 8)
                .offset(x: -25, y: 9)
        }
    }

    private func activityCard(_ activity: StudyActivity) -> some View {
        Button {
            editing = activity
        } label: {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Study Activity")
                            .font(.prismMicro)
                            .tracking(0.5)
                            .textCase(.uppercase)
                            .prismMuted()

                        Text(activity.label)
                            .font(.prismHeadline)
                            .foregroundStyle(PrismColor.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    Spacer(minLength: 0)

                    Text(activity.occurredAt, format: .dateTime.hour().minute())
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()

                    if activity.progressDelta > 0 {
                        Text("+\(activity.progressDelta)%")
                            .font(PrismFont.numeral(13, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(PrismColor.text.opacity(0.9))
                    }

                    Text("\(activity.progress)%")
                        .font(PrismFont.numeral(26, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.study.color)
                }

                TimelineProgressBar(
                    value: activity.progress,
                    start: activity.progressStart,
                    accent: .study,
                    shown: true,
                    height: 14
                )

                HStack {
                    Text(activity.scaleLabel)
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()

                    Spacer(minLength: 0)

                    Text("\(activity.progressStart)% → \(activity.progress)%")
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()
                }

                if !activity.record.summary.isEmpty {
                    Text(activity.record.summary)
                        .font(.prismCaption)
                        .foregroundStyle(PrismColor.text)
                        .lineLimit(4)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.white.opacity(0.03))
                        }
                }

                if !activity.photos.isEmpty {
                    PhotoStrip(photos: activity.photos, accent: .study, height: 66)
                }
            }
            .padding(13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.white.opacity(0.03), PrismAccent.study.color.opacity(0.07)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(PrismAccent.study.color.opacity(0.17), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint("탭하면 이 활동을 수정합니다")
        .accessibilityIdentifier("study.activity")
    }

    private func sideLabel(_ date: Date) -> String {
        let month = Calendar.current.component(.month, from: date)
        return "\(month)월 · \(date.formatted(.dateTime.weekday(.wide)))"
    }
}

// MARK: - Activity edit

/// Fix one session after the fact: what it was called, what you wrote, when it
/// happened, its photos — or remove it entirely. Progress stays read-only, as
/// on the web; rewriting history would corrupt every later delta.
struct StudyActivityEditSheet: View {
    let activity: StudyActivity

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var summary: String
    @State private var occurredAt: Date
    @State private var existingPhotos: [String]
    @State private var picked: [PhotosPickerItem] = []
    @State private var pendingPhotos: [Data] = []
    @State private var loadingPhotos = false
    @State private var saving = false
    @State private var confirmingDelete = false

    init(activity: StudyActivity) {
        self.activity = activity
        _title = State(initialValue: activity.record.title)
        _summary = State(initialValue: activity.record.summary)
        _occurredAt = State(initialValue: activity.occurredAt)
        _existingPhotos = State(initialValue:
            (activity.record.payload.array("photos") ?? []).compactMap(\.stringValue)
        )
    }

    private var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !saving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .study)

                ScrollView {
                    VStack(spacing: 16) {
                        fields
                        progressNote
                        photoField
                        deleteButton
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("공부 활동 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(!isValid)
                }
            }
            .confirmationDialog(
                "이 기록을 삭제할까요?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("활동 삭제", role: .destructive) { Task { await deleteActivity() } }
                Button("취소", role: .cancel) {}
            } message: {
                Text("이 활동 하나만 삭제됩니다. 과목의 다른 기록은 남습니다.")
            }
        }
    }

    private var fields: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("활동 제목").font(.prismCaption).prismMuted()
                TextField("예: 공부 시작, 120p까지 공부", text: $title)
                    .font(.prismBody)
                    .foregroundStyle(PrismColor.text)
            }

            Divider().overlay(PrismColor.hairline)

            VStack(alignment: .leading, spacing: 6) {
                Text("메모").font(.prismCaption).prismMuted()
                TextField("이 활동에 대한 메모를 남겨보세요.", text: $summary, axis: .vertical)
                    .lineLimit(3...6)
                    .font(.prismBody)
                    .foregroundStyle(PrismColor.text)
            }

            Divider().overlay(PrismColor.hairline)

            DatePicker("기록 시각", selection: $occurredAt, displayedComponents: [.date, .hourAndMinute])
                .font(.prismCallout)
                .tint(PrismAccent.study.color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
    }

    private var progressNote: some View {
        HStack {
            Text("현재 진행률")
                .font(.prismCaption)
                .prismMuted()

            Spacer(minLength: 0)

            Text("\(activity.progress)%")
                .font(PrismFont.numeral(22, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismAccent.study.color)
        }
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private var photoField: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("사진")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                PhotosPicker(selection: $picked, maxSelectionCount: 6, matching: .images) {
                    Label("추가", systemImage: "photo.badge.plus")
                        .font(.prismCaption)
                }
                .tint(PrismAccent.study.color)
            }

            if loadingPhotos {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("사진 준비 중…").font(.prismCaption).prismMuted()
                }
            } else if existingPhotos.isEmpty && pendingPhotos.isEmpty {
                Text("이 활동에 붙은 사진이 없습니다.")
                    .font(.prismCaption)
                    .prismMuted()
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(existingPhotos, id: \.self) { path in
                            existingThumb(path)
                        }
                        ForEach(Array(pendingPhotos.enumerated()), id: \.offset) { index, data in
                            pendingThumb(data, index: index)
                        }
                    }
                    .padding(.horizontal, 1)
                }
                .scrollIndicators(.hidden)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard()
        .onChange(of: picked) { _, items in
            Task { await load(items) }
        }
    }

    @ViewBuilder
    private func existingThumb(_ path: String) -> some View {
        if let url = PrismMedia.url(for: path) {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Color.white.opacity(0.05)
                }
            }
            .frame(width: 68, height: 84)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(alignment: .topTrailing) {
                Button {
                    existingPhotos.removeAll { $0 == path }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(.white, .black.opacity(0.5))
                }
                .buttonStyle(.plain)
                .padding(3)
            }
        }
    }

    private func pendingThumb(_ data: Data, index: Int) -> some View {
        Group {
            if let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 68, height: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        Button {
                            pendingPhotos.remove(at: index)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white, .black.opacity(0.5))
                        }
                        .buttonStyle(.plain)
                        .padding(3)
                    }
            }
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            confirmingDelete = true
        } label: {
            Text("이 활동 삭제")
                .font(.prismCallout)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 5)
        }
        .buttonStyle(.glass)
        .tint(PrismAccent.movie.color)
        .disabled(saving)
    }

    private func load(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        loadingPhotos = true
        defer { loadingPhotos = false; picked = [] }

        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let compressed = ImageCompressor.jpeg(from: data) else { continue }
            pendingPhotos.append(compressed)
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }

        let uploaded = pendingPhotos.isEmpty
            ? []
            : await store.uploadPhotos(pendingPhotos, category: "study-sessions")

        await store.updateStudyActivity(
            id: activity.record.id,
            title: title,
            summary: summary,
            occurredAt: occurredAt,
            photoPaths: existingPhotos + uploaded
        )

        PrismHaptics.saved()
        dismiss()
    }

    private func deleteActivity() async {
        saving = true
        defer { saving = false }

        await store.deleteRecord(id: activity.record.id)
        PrismHaptics.saved()
        dismiss()
    }
}

import Charts
import PhotosUI
import SwiftUI
import UIKit

// MARK: - Series

/// Season-by-season episode list. Tapping an episode moves the watched pointer
/// to it — which also marks everything before it — because that is how the web
/// stores progress (`watched_episode_count`, a count rather than a set).
/// What one progress save changed — everything the floating toast shows.
struct SeriesProgressChange: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let posterURL: URL?
    let previousProgress: Int
    let nextProgress: Int
    let seasons: [(name: String, progress: Int)]

    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
}

struct SeriesProgressSection: View {
    let record: RecordItem
    let progress: SeriesProgress
    /// Fired after a save so the screen can float the update toast — the toast
    /// pins to the viewport, which a section buried in a scroll view can't do.
    var onProgressSaved: ((SeriesProgressChange) -> Void)?

    @Environment(PrismStore.self) private var store
    @State private var expandedSeasons: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header

            SeriesTrendCard(progress: progress)

            ForEach(progress.seasons) { season in
                seasonBlock(season)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.series.color)
        .onAppear {
            // Open the season the user is currently in.
            if let next = progress.nextEpisode {
                expandedSeasons.insert(next.seasonNumber)
            } else if let first = progress.seasons.first {
                expandedSeasons.insert(first.seasonNumber)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 16) {
            ProgressDonut(value: Double(progress.progress) / 100, accent: .series)

            VStack(alignment: .leading, spacing: 4) {
                Text(progress.playtimeLabel)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                if let next = progress.nextEpisode {
                    Text("다음 S\(next.seasonNumber)E\(next.episodeNumber)")
                        .font(.prismCaption)
                        .foregroundStyle(PrismAccent.series.color)
                } else if progress.totalEpisodes > 0 {
                    Text("시청 완료")
                        .font(.prismCaption)
                        .foregroundStyle(PrismAccent.series.color)
                }
            }

            Spacer(minLength: 0)
        }
    }

    private func seasonBlock(_ season: SeriesSeason) -> some View {
        let isOpen = expandedSeasons.contains(season.seasonNumber)

        return VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(PrismMotion.snappy) {
                    if isOpen {
                        expandedSeasons.remove(season.seasonNumber)
                    } else {
                        expandedSeasons.insert(season.seasonNumber)
                    }
                }
            } label: {
                HStack {
                    Text(season.name ?? "시즌 \(season.seasonNumber)")
                        .font(.prismCallout)
                        .foregroundStyle(PrismColor.text)

                    Spacer(minLength: 0)

                    Text("\(season.watchedCount)/\(season.episodes.count)")
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()

                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .bold))
                        .prismMuted()
                        .rotationEffect(.degrees(isOpen ? 0 : -90))
                }
            }
            .buttonStyle(.plain)

            // The season's own bar, as on the web's season rows — the total
            // percent hides which season you're actually stuck in.
            if !season.episodes.isEmpty {
                let seasonProgress = season.watchedCount * 100 / season.episodes.count

                HStack(spacing: 8) {
                    ProgressMeter(
                        value: Double(season.watchedCount) / Double(season.episodes.count),
                        accent: .series,
                        height: 6
                    )

                    Text("\(seasonProgress)%")
                        .font(PrismFont.numeral(11, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.series.color)
                }
            }

            if isOpen {
                ForEach(season.episodes) { episode in
                    episodeRow(episode)
                        .id(progress.nextEpisode?.key == episode.key ? "series.currentEpisode" : episode.key)
                }
            }
        }
    }

    private func episodeRow(_ episode: SeriesEpisode) -> some View {
        let isCurrent = progress.nextEpisode?.key == episode.key

        return Button {
            Task {
                PrismHaptics.impact(episode.watched ? .light : .medium)

                let before = progress.progress
                await store.setSeriesProgress(id: record.id, upTo: episode)

                // Re-read: the store's record now carries the moved pointer.
                if let updated = store.record(id: record.id),
                   let after = updated.seriesProgress {
                    onProgressSaved?(SeriesProgressChange(
                        title: updated.title,
                        posterURL: updated.coverURL,
                        previousProgress: before,
                        nextProgress: after.progress,
                        seasons: after.seasons.map { season in
                            (
                                name: season.name ?? "시즌 \(season.seasonNumber)",
                                progress: season.episodes.isEmpty
                                    ? 0
                                    : season.watchedCount * 100 / season.episodes.count
                            )
                        }
                    ))
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: episode.watched ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 17))
                    .foregroundStyle(episode.watched
                                     ? PrismAccent.series.color
                                     : PrismColor.textMuted.opacity(0.5))

                // The still puts a face on the row; the code slab stands in
                // when TMDB has none, so rows stay the same shape either way.
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    PrismAccent.series.color.opacity(0.16),
                                    Color.white.opacity(0.04),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    if let still = episode.stillURL {
                        AsyncImage(url: still) { phase in
                            if case .success(let image) = phase {
                                image.resizable().scaledToFill()
                            } else {
                                Color.clear
                            }
                        }
                    } else {
                        Text("E\(episode.episodeNumber)")
                            .font(PrismFont.numeral(11, weight: .bold))
                            .monospacedDigit()
                            .prismMuted()
                    }
                }
                .frame(width: 54, height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

                VStack(alignment: .leading, spacing: 1) {
                    Text(episode.displayName)
                        .font(.prismCaption)
                        .foregroundStyle(episode.watched || isCurrent ? PrismColor.text : PrismColor.textMuted)
                        .lineLimit(1)

                    if isCurrent {
                        Text("다음 에피소드")
                            .font(.prismMicro)
                            .foregroundStyle(PrismAccent.series.color)
                    }
                }

                Spacer(minLength: 0)

                if let watchedAt = episode.watchedAt {
                    Text(watchedAt, format: .dateTime.month().day())
                        .font(.prismMicro)
                        .monospacedDigit()
                        .prismMuted()
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, isCurrent ? 8 : 0)
            .background {
                if isCurrent {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(PrismAccent.series.color.opacity(0.09))
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("시즌 \(episode.seasonNumber) \(episode.episodeNumber)화")
        .accessibilityValue(episode.watched ? "시청함" : "미시청")
    }
}

/// Cumulative progress over the days episodes were watched. Ported from
/// `buildSeriesProgressTrend` (`recordsPage.jsx:502`).
struct SeriesTrendCard: View {
    let progress: SeriesProgress

    private struct Point: Identifiable {
        let date: Date
        let progress: Int

        var id: Date { date }
    }

    private var points: [Point] {
        guard progress.totalEpisodes > 0 else { return [] }

        let calendar = Calendar.current
        let countsByDay = Dictionary(
            grouping: progress.seasons.flatMap(\.episodes).compactMap(\.watchedAt)
        ) { calendar.startOfDay(for: $0) }

        var cumulative = 0
        return countsByDay
            .sorted { $0.key < $1.key }
            .map { day, watched in
                cumulative += watched.count
                return Point(
                    date: day,
                    progress: min(100, Int((Double(cumulative) / Double(progress.totalEpisodes) * 100).rounded()))
                )
            }
    }

    var body: some View {
        // One data point draws as a dot floating in an empty chart; the season
        // list below carries the same information better until there are two.
        if points.count >= 2 {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Progress Trend")
                        .font(.prismMicro)
                        .tracking(1.0)
                        .textCase(.uppercase)
                        .foregroundStyle(PrismAccent.series.color)

                    Spacer(minLength: 0)

                    Text("\(points.last?.progress ?? 0)%")
                        .font(PrismFont.numeral(13, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.series.color)
                }

                Chart {
                    ForEach(points) { point in
                        AreaMark(
                            x: .value("날짜", point.date, unit: .day),
                            y: .value("진행률", point.progress)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    PrismAccent.series.color.opacity(0.3),
                                    PrismAccent.series.color.opacity(0.02),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.linear)

                        LineMark(
                            x: .value("날짜", point.date, unit: .day),
                            y: .value("진행률", point.progress)
                        )
                        .foregroundStyle(PrismAccent.series.color)
                        .interpolationMethod(.linear)
                        .lineStyle(StrokeStyle(lineWidth: 2.4, lineCap: .round))

                        PointMark(
                            x: .value("날짜", point.date, unit: .day),
                            y: .value("진행률", point.progress)
                        )
                        .foregroundStyle(PrismAccent.series.color)
                        .symbolSize(24)
                    }
                }
                .chartYScale(domain: 0...100)
                .chartYAxis {
                    AxisMarks(position: .leading, values: [0, 50, 100]) {
                        AxisValueLabel().font(.prismMicro).foregroundStyle(PrismColor.textMuted)
                        AxisGridLine().foregroundStyle(PrismColor.hairline)
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel(format: .dateTime.month(.defaultDigits).day())
                            .font(.prismMicro)
                            .foregroundStyle(PrismColor.textMuted)
                        AxisGridLine().foregroundStyle(PrismColor.hairline)
                    }
                }
                .frame(height: 96)
                .accessibilityLabel("시청 진행률 추세")
            }
        }
    }
}

/// The web's `FloatingSeriesProgressToast`: confirmation that the save landed,
/// with the donut sweeping from the old percent to the new one.
struct SeriesProgressToastView: View {
    let change: SeriesProgressChange

    @State private var displayedProgress: Int

    init(change: SeriesProgressChange) {
        self.change = change
        _displayedProgress = State(initialValue: change.previousProgress)
    }

    var body: some View {
        HStack(spacing: 12) {
            CoverImage(url: change.posterURL, accent: .series, cornerRadius: 10)
                .frame(width: 46, height: 64)

            VStack(alignment: .leading, spacing: 5) {
                Text("Watching Updated")
                    .font(.prismMicro)
                    .tracking(0.8)
                    .textCase(.uppercase)
                    .foregroundStyle(PrismAccent.series.color)

                Text(change.title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                    .lineLimit(1)

                ForEach(Array(change.seasons.enumerated()), id: \.offset) { _, season in
                    HStack(spacing: 6) {
                        Text(season.name)
                            .font(.prismMicro)
                            .prismMuted()
                            .lineLimit(1)
                            .frame(width: 52, alignment: .leading)

                        ProgressMeter(value: Double(season.progress) / 100, accent: .series, height: 4)

                        Text("\(season.progress)%")
                            .font(PrismFont.numeral(10, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(PrismAccent.series.color)
                    }
                }
            }

            Spacer(minLength: 0)

            VStack(spacing: 2) {
                ProgressDonut(value: Double(displayedProgress) / 100, diameter: 56)
                Text("TOTAL")
                    .font(.system(size: 9, weight: .semibold))
                    .prismMuted()
            }
        }
        .padding(14)
        .glassEffect(
            .regular.tint(PrismAccent.series.color.opacity(0.1)),
            in: .rect(cornerRadius: 20)
        )
        .shadow(color: .black.opacity(0.28), radius: 22, y: 12)
        .onAppear {
            withAnimation(PrismMotion.meter.delay(0.2)) {
                displayedProgress = change.nextProgress
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(change.title) 진행률 \(change.nextProgress)퍼센트로 갱신됨")
    }
}

struct ProgressDonut: View {
    let value: Double
    var accent: PrismAccent = .series
    var diameter: CGFloat = 74

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.08), lineWidth: 8)

            Circle()
                .trim(from: 0, to: max(0, min(value, 1)))
                .stroke(accent.color, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: accent.color.opacity(0.5), radius: 5)

            Text("\(Int((value * 100).rounded()))%")
                .font(PrismFont.numeral(16, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
        }
        .frame(width: diameter, height: diameter)
        .animation(PrismMotion.meter, value: value)
        .accessibilityHidden(true)
    }
}

// MARK: - Game

struct GameSessionsSection: View {
    let record: RecordItem

    @State private var addingSession = false
    @State private var editingSession: GameSession?

    private var sessions: [GameSession] { record.gameSessions }

    private var lastPlayedAt: Date? {
        sessions.compactMap(\.playedAt).max()
    }

    var body: some View {
        VStack(spacing: 14) {
            metricsCard
            GamePlayCalendar(sessions: sessions)
            feedCard
        }
        .sheet(isPresented: $addingSession) {
            GameSessionSheet(record: record)
        }
        .sheet(item: $editingSession) { session in
            GameSessionSheet(record: record, session: session)
        }
    }

    /// The three numbers the web's hero shows: total time, session count,
    /// last played (`GameDetailPage`, `recordsPage.jsx:4785`).
    private var metricsCard: some View {
        HStack(spacing: 10) {
            metric("누적 플레이", value: durationLabel(record.totalGameMinutes))
            metric("플레이 횟수", value: "\(sessions.count)회")
            metric(
                "최근 플레이",
                value: lastPlayedAt?.formatted(.dateTime.month().day()) ?? "기록 대기"
            )
        }
        .prismGlassCard(tint: PrismAccent.game.color, padding: 14)
    }

    private func metric(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.prismMicro)
                .prismMuted()
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(value)
                .font(PrismFont.numeral(16, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var feedCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Play Feed")
                        .font(.prismMicro)
                        .tracking(1.0)
                        .textCase(.uppercase)
                        .foregroundStyle(PrismAccent.game.color)

                    Text("플레이 로그")
                        .font(.prismTitle)
                        .foregroundStyle(PrismColor.text)
                }

                Spacer(minLength: 0)

                Button {
                    addingSession = true
                } label: {
                    Label("추가", systemImage: "plus")
                        .font(.prismCaption)
                }
                .tint(PrismAccent.game.color)
                .accessibilityIdentifier("game.addSession")
            }

            if sessions.isEmpty {
                Text("아직 플레이 로그가 없습니다.")
                    .font(.prismCaption)
                    .prismMuted()
            } else {
                ForEach(sessions) { session in
                    sessionRow(session)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.game.color)
    }

    private func sessionRow(_ session: GameSession) -> some View {
        Button {
            editingSession = session
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(session.durationLabel)
                        .font(PrismFont.numeral(15, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(PrismColor.text)

                    Spacer(minLength: 0)

                    if let playedAt = session.playedAt {
                        Text(playedAt, format: .dateTime.month().day().hour().minute())
                            .font(.prismMicro)
                            .monospacedDigit()
                            .prismMuted()
                    }
                }

                if !session.note.isEmpty {
                    Text(session.note)
                        .font(.prismCaption)
                        .foregroundStyle(PrismColor.text)
                        .lineLimit(4)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if !session.photos.isEmpty {
                    PhotoStrip(photos: session.photos, accent: .game, height: 66)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.03))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(PrismAccent.game.color.opacity(0.14), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint("탭하면 이 플레이 로그를 수정합니다")
        .accessibilityIdentifier("game.session")
    }

    private func durationLabel(_ minutes: Int) -> String {
        guard minutes > 0 else { return "0분" }
        return minutes >= 60
            ? "\(minutes / 60)시간 \(String(format: "%02d", minutes % 60))분"
            : "\(minutes)분"
    }
}

/// Months of play, one lit cell per day at the controller. Ported from
/// `buildGameCalendarMonths` (`recordsPage.jsx:807`) — the three most recent
/// months that saw a session, newest first.
struct GamePlayCalendar: View {
    let sessions: [GameSession]

    private struct Month: Identifiable {
        let id: String
        let label: String
        let cells: [Cell?]
    }

    private struct Cell {
        let day: Int
        let count: Int
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Play Calendar")
                    .font(.prismMicro)
                    .tracking(1.0)
                    .textCase(.uppercase)
                    .foregroundStyle(PrismAccent.game.color)

                Text("플레이 캘린더")
                    .font(.prismTitle)
                    .foregroundStyle(PrismColor.text)
            }

            ForEach(months) { month in
                VStack(alignment: .leading, spacing: 8) {
                    Text(month.label)
                        .font(.prismCallout)
                        .foregroundStyle(PrismColor.text)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 7), spacing: 5) {
                        ForEach(["월", "화", "수", "목", "금", "토", "일"], id: \.self) { label in
                            Text(label)
                                .font(.prismMicro)
                                .prismMuted()
                        }

                        ForEach(Array(month.cells.enumerated()), id: \.offset) { _, cell in
                            cellView(cell)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.game.color)
    }

    @ViewBuilder
    private func cellView(_ cell: Cell?) -> some View {
        if let cell {
            let played = cell.count > 0

            VStack(spacing: 1) {
                Text("\(cell.day)")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .foregroundStyle(played ? PrismColor.text : PrismColor.textMuted)

                if played {
                    Text("\(cell.count)회")
                        .font(.system(size: 9, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(PrismAccent.game.color)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 36)
            .background {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(PrismAccent.game.color.opacity(played ? (cell.count > 1 ? 0.24 : 0.12) : 0.02))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(
                        PrismAccent.game.color.opacity(played ? 0.27 : 0.08),
                        lineWidth: 1
                    )
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(played ? "\(cell.day)일, \(cell.count)회 플레이" : "\(cell.day)일")
        } else {
            Color.clear.frame(minHeight: 36)
        }
    }

    private var months: [Month] {
        let calendar = Calendar.current

        var counts: [String: Int] = [:]
        var monthKeys: Set<String> = []
        for session in sessions {
            guard let playedAt = session.playedAt else { continue }
            counts[dayKey(playedAt, calendar), default: 0] += 1
            monthKeys.insert(monthKey(playedAt, calendar))
        }

        // No sessions yet: show the current, empty month rather than nothing,
        // as the web does.
        if monthKeys.isEmpty { monthKeys.insert(monthKey(.now, calendar)) }

        return monthKeys.sorted(by: >).prefix(3).compactMap { key -> Month? in
            let parts = key.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2,
                  let first = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)),
                  let range = calendar.range(of: .day, in: .month, for: first)
            else { return nil }

            let leading = (calendar.component(.weekday, from: first) + 5) % 7
            var cells: [Cell?] = Array(repeating: nil, count: leading)
            for day in range {
                let dayKey = String(format: "%04d-%02d-%02d", parts[0], parts[1], day)
                cells.append(Cell(day: day, count: counts[dayKey] ?? 0))
            }
            while cells.count % 7 != 0 { cells.append(nil) }

            return Month(id: key, label: "\(parts[0])년 \(parts[1])월", cells: cells)
        }
    }

    private func dayKey(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    private func monthKey(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month], from: date)
        return String(format: "%04d-%02d", parts.year ?? 0, parts.month ?? 0)
    }
}

struct GameSessionSheet: View {
    let record: RecordItem
    /// Editing an existing session when set; logging a new one when nil.
    var session: GameSession?

    @Environment(PrismStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var playedAt: Date
    @State private var hours: String
    @State private var minutes: String
    @State private var note: String
    @State private var existingPhotos: [String]
    @State private var picked: [PhotosPickerItem] = []
    @State private var pendingPhotos: [Data] = []
    @State private var loadingPhotos = false
    @State private var saving = false

    init(record: RecordItem, session: GameSession? = nil) {
        self.record = record
        self.session = session
        _playedAt = State(initialValue: session?.playedAt ?? .now)
        _hours = State(initialValue: String((session?.durationMinutes ?? 60) / 60))
        _minutes = State(initialValue: String((session?.durationMinutes ?? 60) % 60))
        _note = State(initialValue: session?.note ?? "")
        // Kept as stored paths, not resolved URLs, so removal round-trips.
        _existingPhotos = State(initialValue: session.map { existing in
            (record.payload.array("game_sessions") ?? [])
                .first { $0.objectValue?.string("id") == existing.id }?
                .objectValue?.array("photos")?
                .compactMap(\.stringValue) ?? []
        } ?? [])
    }

    private var totalMinutes: Int {
        (Int(hours) ?? 0) * 60 + (Int(minutes) ?? 0)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: .game)

                ScrollView {
                    VStack(spacing: 16) {
                        VStack(spacing: 10) {
                            DatePicker("플레이 날짜", selection: $playedAt, displayedComponents: [.date, .hourAndMinute])
                                .font(.prismCallout)

                            Divider().overlay(PrismColor.hairline)

                            HStack {
                                Text("플레이 시간").font(.prismCallout).prismMuted()
                                Spacer(minLength: 0)
                                TextField("0", text: $hours)
                                    .keyboardType(.numberPad)
                                    .frame(width: 44)
                                    .multilineTextAlignment(.trailing)
                                Text("시간").font(.prismCaption).prismMuted()
                                TextField("0", text: $minutes)
                                    .keyboardType(.numberPad)
                                    .frame(width: 44)
                                    .multilineTextAlignment(.trailing)
                                Text("분").font(.prismCaption).prismMuted()
                            }
                            .font(PrismFont.numeral(17, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(PrismColor.text)
                        }
                        .tint(PrismAccent.game.color)
                        .prismGlassCard()

                        VStack(alignment: .leading, spacing: 8) {
                            Text("메모").font(.prismHeadline).foregroundStyle(PrismColor.text)
                            TextField("무엇을 했나요?", text: $note, axis: .vertical)
                                .lineLimit(3...6)
                                .font(.prismBody)
                                .foregroundStyle(PrismColor.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .prismGlassCard()

                        photoField
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle(session == nil ? "플레이 기록" : "플레이 기록 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(totalMinutes <= 0 || saving)
                }
            }
        }
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
                .tint(PrismAccent.game.color)
            }

            if loadingPhotos {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("사진 준비 중…").font(.prismCaption).prismMuted()
                }
            } else if existingPhotos.isEmpty && pendingPhotos.isEmpty {
                Text("스크린샷이나 플레이 순간을 남겨 보세요.")
                    .font(.prismCaption)
                    .prismMuted()
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(existingPhotos, id: \.self) { path in
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

                        ForEach(Array(pendingPhotos.enumerated()), id: \.offset) { index, data in
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
            : await store.uploadPhotos(pendingPhotos, category: "game-sessions")
        let photos = existingPhotos + uploaded

        if let session {
            await store.updateGameSession(
                id: record.id,
                sessionID: session.id,
                playedAt: playedAt,
                durationMinutes: totalMinutes,
                note: note,
                photoPaths: photos
            )
        } else {
            await store.addGameSession(
                id: record.id,
                playedAt: playedAt,
                durationMinutes: totalMinutes,
                note: note,
                photoPaths: photos
            )
        }

        PrismHaptics.saved()
        dismiss()
    }
}

// MARK: - Study

/// Table of contents as a checklist. The web supports arbitrary nesting and
/// drag reordering; this renders the tree and toggles nodes, which is what
/// progress is actually computed from.
struct StudyTableOfContents: View {
    let record: RecordItem

    @Environment(PrismStore.self) private var store

    private struct Node: Identifiable {
        let id: String
        let title: String
        let completed: Bool
        let depth: Int
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("목차")
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)

                Spacer(minLength: 0)

                let done = nodes.filter(\.completed).count
                Text("\(done)/\(nodes.count)")
                    .font(.prismMicro)
                    .monospacedDigit()
                    .prismMuted()
            }

            if nodes.isEmpty {
                Text("목차가 없습니다. 웹에서 추가하거나 새 기록을 만들 때 입력할 수 있습니다.")
                    .font(.prismCaption)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(nodes) { node in
                    Button {
                        Task {
                            PrismHaptics.impact(node.completed ? .light : .medium)
                            await store.setStudyNodeCompleted(
                                id: record.id,
                                nodeID: node.id,
                                completed: !node.completed
                            )
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: node.completed ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 17))
                                .foregroundStyle(node.completed
                                                 ? PrismAccent.study.color
                                                 : PrismColor.textMuted.opacity(0.5))

                            Text(node.title)
                                .font(.prismCallout)
                                .foregroundStyle(node.completed ? PrismColor.textMuted : PrismColor.text)
                                .strikethrough(node.completed, color: PrismColor.textMuted)
                                .multilineTextAlignment(.leading)

                            Spacer(minLength: 0)
                        }
                        .padding(.leading, CGFloat(node.depth) * 16)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .prismGlassCard(tint: PrismAccent.study.color)
    }

    private var nodes: [Node] {
        flatten(record.payload.array("toc") ?? [], depth: 0)
    }

    private func flatten(_ raw: [JSONValue], depth: Int) -> [Node] {
        raw.enumerated().flatMap { index, entry -> [Node] in
            guard let fields = entry.objectValue else { return [] }
            let node = Node(
                id: fields.string("id") ?? "node-\(depth)-\(index)",
                title: fields.string("title") ?? "제목 없음",
                completed: fields.bool("completed") ?? false,
                depth: depth
            )
            return [node] + flatten(fields["children"]?.arrayValue ?? [], depth: depth + 1)
        }
    }
}

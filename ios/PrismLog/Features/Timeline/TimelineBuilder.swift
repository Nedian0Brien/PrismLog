import Foundation

// MARK: - Output

/// One entry in the timeline.
///
/// Not the same thing as a log. A book read three times on Tuesday is one
/// entry that says "+42p", not three logs and not one row for the whole book.
struct TimelineItem: Identifiable, Hashable, Sendable {
    let id: String
    /// The record to open when tapped. Several entries can share one.
    let recordID: UUID
    let date: Date
    let accent: PrismAccent
    let categoryLabel: String
    let title: String
    let status: String
    let posterURL: URL?
    /// The scale line — "150 / 500p", "12개 챕터", a playtime.
    let summary: String
    /// Whatever was written: a reading note, an episode synopsis, a summary.
    let snippet: String
    /// `nil` where progress is meaningless (a film, a game).
    let progress: Int?
    /// Where the bar starts, so the day's gain reads as a filled band rather
    /// than a number you have to compare against memory.
    let progressStart: Int
    /// "+42p", "+2챕터", "+3화" — the day's gain in the record's own unit.
    let deltaLabel: String
    /// One entry per play session that day; the feed draws them as donuts.
    let gameSessionMinutes: [Int]
    let photos: [URL]
    let episodesToday: [SeriesEpisode]

    var progressDelta: Int {
        guard let progress else { return 0 }
        return max(0, progress - progressStart)
    }
}

struct TimelineDay: Identifiable, Hashable, Sendable {
    let date: Date
    let items: [TimelineItem]

    var id: Date { date }
}

// MARK: - Builder

/// Turns logs into a timeline, the way the web does
/// (`src/features/prismlog/pages/timelinePage.jsx:25`).
///
/// Three passes, and the order matters:
///
/// 1. **Expand.** Reading and game sessions live inside one log's payload, so a
///    log becomes as many entries as it has sessions, each at its own time.
///    Series do the same with `episode_watch_dates`.
/// 2. **Collapse.** Entries are then re-grouped per day per subject, summing
///    pages and minutes. Without this, an evening of five short sessions
///    floods the day with near-identical rows.
/// 3. **Map.** Each aggregate becomes an item carrying the day's delta.
///
/// Pass 2 runs chronologically because study progress is measured against the
/// *previous* activity on that subject, which may be weeks earlier.
enum TimelineBuilder {
    static func days(from records: [RecordItem], calendar: Calendar = .current) -> [TimelineDay] {
        let expanded = expand(records, calendar: calendar)
        let collapsed = collapse(expanded.sorted { $0.date < $1.date }, calendar: calendar)

        let items = collapsed
            .sorted { $0.date > $1.date }
            .map(item(from:))

        return Dictionary(grouping: items) { calendar.startOfDay(for: $0.date) }
            .map { TimelineDay(date: $0.key, items: $0.value.sorted { $0.date > $1.date }) }
            .sorted { $0.date > $1.date }
    }

    // MARK: Pass 1 — expand

    private struct Entry {
        var record: RecordItem
        var date: Date
        var readingSession: ReadingSession?
        var gameSession: GameSession?

        var isSession: Bool { readingSession != nil || gameSession != nil }
    }

    private static func expand(_ records: [RecordItem], calendar: Calendar) -> [Entry] {
        var entries: [Entry] = []
        // The web guards against one session showing up twice because payloads
        // get copied forward between logs of the same subject. Scoped to the
        // subject, not global: session ids fall back to an index, and two
        // different books both have a "session-0".
        var seen: Set<String> = []

        for record in records {
            var producedSessions = false

            if record.category == .reading {
                for session in record.readingSessions {
                    let key = "\(subjectKey(record))|r|\(session.id)"
                    guard !seen.contains(key) else { continue }
                    seen.insert(key)
                    producedSessions = true
                    entries.append(Entry(
                        record: record,
                        date: session.date ?? record.occurredAt,
                        readingSession: session
                    ))
                }
            }

            if record.cultureType == .game {
                for session in record.gameSessions {
                    let key = "\(subjectKey(record))|g|\(session.id)"
                    guard !seen.contains(key) else { continue }
                    seen.insert(key)
                    producedSessions = true
                    entries.append(Entry(
                        record: record,
                        date: session.playedAt ?? record.occurredAt,
                        gameSession: session
                    ))
                }
            }

            guard !producedSessions else { continue }

            // A reading or game record whose sessions have all been expanded
            // elsewhere — or that has nothing recorded yet — would otherwise
            // appear as an empty duplicate row.
            let isSessionKind = record.category == .reading || record.cultureType == .game
            if isSessionKind {
                let hasSomething = record.progress > 0
                    || record.pagesRead > 0
                    || (record.payload.string("playtime")?.isEmpty == false)
                guard hasSomething else { continue }
            }

            entries.append(Entry(record: record, date: record.occurredAt))
        }

        return entries
    }

    // MARK: Pass 2 — collapse

    private struct Aggregate {
        var entry: Entry
        var date: Date

        // Reading, summed across the day.
        var fromPages = 0
        var toPages = 0
        var pagesRead = 0
        var fromProgress = 0
        var toProgress = 0
        var durationMinutes = 0
        var note = ""
        var photos: [URL] = []

        // Study, measured against the previous activity on the subject.
        var studyProgressStart = 0
        var studyProgressEnd = 0
        var studyAmountStart = 0
        var studyAmountEnd = 0
        var studyAmountMode: StudyAmountMode = .percent

        // Game, one element per session that day.
        var gameSessionMinutes: [Int] = []

        // Series.
        var episodesToday: [SeriesEpisode] = []
    }

    private enum StudyAmountMode { case page, chapter, percent }

    private static func collapse(_ entries: [Entry], calendar: Calendar) -> [Aggregate] {
        var readingDays: [String: Aggregate] = [:]
        var studyDays: [String: Aggregate] = [:]
        var gameDays: [String: Aggregate] = [:]
        var seriesDays: [String: Aggregate] = [:]
        var order: [String] = []
        var passthrough: [Aggregate] = []

        // Carried across days: the last state seen for a subject is where the
        // next day's bar starts.
        var lastStudyProgress: [String: Int] = [:]
        var lastStudyAmount: [String: Int] = [:]

        func key(_ entry: Entry, _ date: Date, _ kind: String) -> String {
            "\(kind)|\(dayKey(date, calendar))|\(subjectKey(entry.record))"
        }

        for entry in entries {
            let record = entry.record

            switch record.category {
            case .reading:
                let session = entry.readingSession
                let mapKey = key(entry, entry.date, "reading")
                let toPages = session?.toPages ?? record.pagesRead
                let toProgress = session?.toProgress ?? record.progress
                let fromPages = session?.fromPages ?? 0
                let fromProgress = session?.fromProgress ?? 0
                let read = session?.pagesRead ?? (entry.isSession ? 0 : record.pagesRead)

                if var existing = readingDays[mapKey] {
                    // Keep the day's opening position, take the latest closing
                    // one, and add up everything in between.
                    existing.entry = entry
                    existing.date = entry.date
                    existing.toPages = toPages
                    existing.toProgress = toProgress
                    existing.pagesRead += read
                    existing.durationMinutes += session?.durationMinutes ?? 0
                    if let note = session?.note, !note.isEmpty { existing.note = note }
                    // The web keeps only the first session's photos here. Every
                    // photo taken that day belongs to the day, so they are
                    // concatenated instead — strictly more, never less.
                    existing.photos += session?.photos ?? []
                    readingDays[mapKey] = existing
                } else {
                    var aggregate = Aggregate(entry: entry, date: entry.date)
                    aggregate.fromPages = fromPages
                    aggregate.toPages = toPages
                    aggregate.fromProgress = fromProgress
                    aggregate.toProgress = toProgress
                    aggregate.pagesRead = read
                    aggregate.durationMinutes = session?.durationMinutes ?? 0
                    aggregate.note = session?.note ?? ""
                    aggregate.photos = session?.photos ?? []
                    readingDays[mapKey] = aggregate
                    order.append(mapKey)
                }

            case .study:
                let mapKey = key(entry, entry.date, "study")
                let subject = subjectKey(record)
                let mode = studyAmountMode(record)
                let amount = studyAmount(record, mode: mode)
                let progress = studyProgress(record, mode: mode)

                if var existing = studyDays[mapKey] {
                    existing.entry = entry
                    existing.date = entry.date
                    existing.studyProgressEnd = progress
                    existing.studyAmountEnd = amount
                    studyDays[mapKey] = existing
                } else {
                    var aggregate = Aggregate(entry: entry, date: entry.date)
                    aggregate.studyProgressStart = lastStudyProgress[subject] ?? 0
                    aggregate.studyProgressEnd = progress
                    aggregate.studyAmountStart = lastStudyAmount[subject] ?? 0
                    aggregate.studyAmountEnd = amount
                    aggregate.studyAmountMode = mode
                    studyDays[mapKey] = aggregate
                    order.append(mapKey)
                }

                lastStudyProgress[subject] = progress
                lastStudyAmount[subject] = amount

            case .culture, .movie, .series, .game:
                switch record.cultureType {
                case .game:
                    let mapKey = key(entry, entry.date, "game")
                    if var existing = gameDays[mapKey] {
                        existing.entry = entry
                        existing.date = entry.date
                        existing.gameSessionMinutes.append(entry.gameSession?.durationMinutes ?? 0)
                        if let note = entry.gameSession?.note, !note.isEmpty { existing.note = note }
                        existing.photos += entry.gameSession?.photos ?? []
                        gameDays[mapKey] = existing
                    } else {
                        var aggregate = Aggregate(entry: entry, date: entry.date)
                        if let session = entry.gameSession {
                            aggregate.gameSessionMinutes = [session.durationMinutes]
                            aggregate.note = session.note
                            aggregate.photos = session.photos
                        }
                        gameDays[mapKey] = aggregate
                        order.append(mapKey)
                    }

                case .series:
                    let watched = record.seriesProgress?.seasons
                        .flatMap(\.episodes)
                        .filter { $0.watchedAt != nil } ?? []

                    guard !watched.isEmpty else {
                        passthrough.append(Aggregate(entry: entry, date: entry.date))
                        continue
                    }

                    // Each day an episode was watched is its own entry, dated
                    // by the last episode of that day.
                    for episode in watched {
                        guard let watchedAt = episode.watchedAt else { continue }
                        let mapKey = "series|\(dayKey(watchedAt, calendar))|\(subjectKey(record))"

                        if var existing = seriesDays[mapKey] {
                            existing.episodesToday.append(episode)
                            if watchedAt > existing.date { existing.date = watchedAt }
                            seriesDays[mapKey] = existing
                        } else {
                            var aggregate = Aggregate(entry: entry, date: watchedAt)
                            aggregate.episodesToday = [episode]
                            seriesDays[mapKey] = aggregate
                            order.append(mapKey)
                        }
                    }

                default:
                    passthrough.append(Aggregate(entry: entry, date: entry.date))
                }
            }
        }

        let byKey = readingDays.merging(studyDays) { a, _ in a }
            .merging(gameDays) { a, _ in a }
            .merging(seriesDays) { a, _ in a }

        return order.compactMap { byKey[$0] } + passthrough
    }

    // MARK: Pass 3 — map

    private static func item(from aggregate: Aggregate) -> TimelineItem {
        let record = aggregate.entry.record
        let accent = record.accent

        return TimelineItem(
            id: identity(aggregate),
            recordID: record.id,
            date: aggregate.date,
            accent: accent,
            categoryLabel: record.categoryLabel,
            title: record.entityTitle ?? record.title,
            status: status(record),
            posterURL: record.coverURL,
            summary: summary(aggregate),
            snippet: snippet(aggregate),
            progress: progress(aggregate),
            progressStart: progressStart(aggregate),
            deltaLabel: deltaLabel(aggregate),
            gameSessionMinutes: aggregate.gameSessionMinutes.filter { $0 > 0 },
            photos: aggregate.photos,
            episodesToday: aggregate.episodesToday.sorted { $0.absoluteNumber < $1.absoluteNumber }
        )
    }

    private static func identity(_ aggregate: Aggregate) -> String {
        let record = aggregate.entry.record
        let stamp = Int(aggregate.date.timeIntervalSince1970)
        return "\(record.id.uuidString)-\(stamp)"
    }

    private static func status(_ record: RecordItem) -> String {
        if let status = record.status, !status.isEmpty { return status }
        switch record.cultureType {
        case .game: return "플레이 중"
        case .movie, .series: return "시청 중"
        case nil: return ""
        }
    }

    private static func summary(_ aggregate: Aggregate) -> String {
        let record = aggregate.entry.record

        switch record.category {
        case .reading:
            let total = record.pagesTotal
            return "\(aggregate.toPages) / \(total > 0 ? "\(total)p" : "?")"
        case .study:
            let mode = aggregate.studyAmountMode
            if mode == .page, record.pagesTotal > 0 {
                return "\(record.pagesRead) / \(record.pagesTotal)p"
            }
            return "\(StudyGrouping.chapterCount(record.payload))개 챕터"
        default:
            if let playtime = record.payload.string("playtime"), !playtime.isEmpty { return playtime }
            return status(record)
        }
    }

    private static func snippet(_ aggregate: Aggregate) -> String {
        if !aggregate.note.isEmpty { return aggregate.note }

        if !aggregate.episodesToday.isEmpty {
            let names = aggregate.episodesToday
                .compactMap { $0.name?.isEmpty == false ? $0.name : nil }
            if !names.isEmpty { return names.joined(separator: " · ") }
        }

        return aggregate.entry.record.summary
    }

    private static func progress(_ aggregate: Aggregate) -> Int? {
        let record = aggregate.entry.record

        switch record.category {
        case .reading: return clamp(aggregate.toProgress)
        case .study: return clamp(aggregate.studyProgressEnd)
        default:
            guard record.cultureType == .series, let series = record.seriesProgress else { return nil }
            return clamp(series.progress)
        }
    }

    private static func progressStart(_ aggregate: Aggregate) -> Int {
        let record = aggregate.entry.record

        switch record.category {
        case .reading: return clamp(aggregate.fromProgress)
        case .study: return clamp(aggregate.studyProgressStart)
        default:
            guard record.cultureType == .series,
                  let series = record.seriesProgress,
                  series.totalEpisodes > 0
            else { return 0 }

            let gained = Double(aggregate.episodesToday.count) / Double(series.totalEpisodes) * 100
            return clamp(series.progress - Int(gained.rounded()))
        }
    }

    private static func deltaLabel(_ aggregate: Aggregate) -> String {
        let record = aggregate.entry.record

        switch record.category {
        case .reading:
            return aggregate.pagesRead > 0 ? "+\(aggregate.pagesRead)p" : ""
        case .study:
            let gained = max(0, aggregate.studyAmountEnd - aggregate.studyAmountStart)
            guard gained > 0 else { return "" }
            switch aggregate.studyAmountMode {
            case .page: return "+\(gained)p"
            case .chapter: return "+\(gained)챕터"
            case .percent: return "+\(gained)%"
            }
        default:
            let episodes = aggregate.episodesToday.count
            return episodes > 0 ? "+\(episodes)화" : ""
        }
    }

    // MARK: Study helpers

    private static func studyAmountMode(_ record: RecordItem) -> StudyAmountMode {
        let mode = record.payload.string("progress_mode") ?? "page"
        if mode == "page", record.pagesTotal > 0 { return .page }
        if StudyGrouping.chapterCount(record.payload) > 0 { return .chapter }
        return .percent
    }

    private static func studyAmount(_ record: RecordItem, mode: StudyAmountMode) -> Int {
        switch mode {
        case .page: record.pagesRead
        case .chapter: (record.payload.array("completed") ?? []).filter { $0.boolValue == true }.count
        case .percent: record.progress
        }
    }

    private static func studyProgress(_ record: RecordItem, mode: StudyAmountMode) -> Int {
        switch mode {
        case .page:
            guard record.pagesTotal > 0 else { return 0 }
            return clamp(Int((Double(record.pagesRead) / Double(record.pagesTotal) * 100).rounded()))
        case .chapter:
            let total = StudyGrouping.chapterCount(record.payload)
            guard total > 0 else { return 0 }
            let done = studyAmount(record, mode: .chapter)
            return clamp(Int((Double(done) / Double(total) * 100).rounded()))
        case .percent:
            return clamp(record.progress)
        }
    }

    // MARK: Small helpers

    /// Entries roll up per subject, not per log — the whole point of the
    /// collapse pass is that many logs about one book become one row.
    private static func subjectKey(_ record: RecordItem) -> String {
        (record.entityID ?? record.id).uuidString
    }

    private static func dayKey(_ date: Date, _ calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year ?? 0)-\(parts.month ?? 0)-\(parts.day ?? 0)"
    }

    private static func clamp(_ value: Int) -> Int { min(max(value, 0), 100) }
}

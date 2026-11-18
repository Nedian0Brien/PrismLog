import Foundation

/// What the library screen summarises (spec §6.1), kept free of SwiftUI so
/// the rules can be tested.
enum LibraryMetrics {
    /// One "now in progress" lens card.
    struct InProgress: Identifiable, Hashable {
        /// The record a tap opens — for study, the subject's latest session.
        let record: RecordItem
        let title: String
        /// 0–100, or `nil` where the category has no meaningful percentage.
        let progress: Int?
        /// "312 / 480쪽", "S2 · E5", "플레이 중" — the one line under the title.
        let detail: String

        var id: UUID { record.id }
        var accent: PrismAccent { record.accent }
    }

    /// How many lens cards the carousel holds at most.
    static let inProgressLimit = 10

    /// Books being read, series being watched, games being played, and
    /// subjects being studied, most recently active first.
    ///
    /// - Reading: started (some progress, or a logged session) and unfinished.
    /// - Series and games: the status the user set — "시청 중" / "플레이 중".
    /// - Study: one card per subject whose progress is past 0 and short of 100.
    /// - Films are watched in one sitting, so they never appear.
    static func inProgress(from records: [RecordItem]) -> [InProgress] {
        var cards: [(Date, InProgress)] = []

        for record in records where record.category == .reading {
            let started = record.progress > 0 || !record.readingSessions.isEmpty
            guard started, record.progress < 100 else { continue }
            let detail = record.pagesTotal > 0
                ? "\(record.pagesRead) / \(record.pagesTotal)쪽"
                : "\(record.progress)%"
            cards.append((record.occurredAt, InProgress(
                record: record, title: record.title, progress: record.progress, detail: detail
            )))
        }

        for record in records where record.category == .culture {
            switch record.accent {
            case .series where record.status == "시청 중":
                cards.append((record.occurredAt, InProgress(
                    record: record,
                    title: record.title,
                    progress: record.progress > 0 ? record.progress : nil,
                    detail: record.status ?? ""
                )))
            case .game where record.status == "플레이 중":
                let hours = record.hours > 0 ? " · \(Int(record.hours.rounded()))시간" : ""
                cards.append((record.occurredAt, InProgress(
                    record: record, title: record.title, progress: nil, detail: "플레이 중\(hours)"
                )))
            default:
                continue
            }
        }

        let studyRecords = records.filter { $0.category == .study }
        for group in StudyGrouping.groups(from: studyRecords) {
            let progress = group.progress
            guard progress > 0, progress < 100 else { continue }
            cards.append((group.occurredAt, InProgress(
                record: group.latest, title: group.title, progress: progress, detail: "\(progress)% 진행"
            )))
        }

        return cards
            .sorted { lhs, rhs in
                lhs.0 != rhs.0 ? lhs.0 > rhs.0 : lhs.1.id.uuidString < rhs.1.id.uuidString
            }
            .prefix(inProgressLimit)
            .map(\.1)
    }

    /// Consecutive days with at least one record, ending today — or ending
    /// yesterday, so a streak isn't shown as broken before today's record
    /// has been written.
    static func streakDays(from records: [RecordItem], today: Date = .now, calendar: Calendar = .current) -> Int {
        let days = Set(records.map { calendar.startOfDay(for: $0.occurredAt) })
        let start = calendar.startOfDay(for: today)
        guard let yesterday = calendar.date(byAdding: .day, value: -1, to: start) else { return 0 }

        var cursor: Date
        if days.contains(start) {
            cursor = start
        } else if days.contains(yesterday) {
            cursor = yesterday
        } else {
            return 0
        }

        var count = 0
        while days.contains(cursor) {
            count += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return count
    }
}

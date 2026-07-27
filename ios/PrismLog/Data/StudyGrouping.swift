import Foundation

/// One study subject, with every activity logged against it folded in.
///
/// The web counts and lists study by *entity*, not by log — nine sessions
/// against one textbook are one card that says "9회", not nine cards. Ported
/// from `groupStudiesByEntity` (`src/features/prismlog/pages/recordsPage.jsx:2387`).
struct StudyGroup: Identifiable, Hashable, Sendable {
    /// The newest activity's log id. Opening a group opens that log, matching
    /// the web's `setDetailId(s.id)`.
    let id: UUID
    let title: String
    let latest: RecordItem
    let activityCount: Int

    var occurredAt: Date { latest.occurredAt }
    var coverURL: URL? { latest.coverURL }
    var progress: Int { latest.progress }
    var tags: [String] { latest.tags }
}

enum StudyGrouping {
    /// Expects `records` already sorted newest-first; the first log seen for an
    /// entity becomes the group's representative, so group order is
    /// newest-activity-first without a second sort.
    static func groups(from records: [RecordItem]) -> [StudyGroup] {
        var order: [UUID] = []
        var representatives: [UUID: RecordItem] = [:]
        var counts: [UUID: Int] = [:]

        for record in records {
            // A study log with no entity is its own group — the same fallback
            // the web uses (`study.entityId || study.id`).
            let key = record.entityID ?? record.id
            if representatives[key] == nil {
                representatives[key] = record
                order.append(key)
            }
            counts[key, default: 0] += 1
        }

        return order.compactMap { key in
            guard let latest = representatives[key] else { return nil }
            return StudyGroup(
                id: latest.id,
                // Entity title wins: the group is the subject, not the session.
                title: latest.entityTitle ?? latest.title,
                latest: latest,
                activityCount: counts[key] ?? 1
            )
        }
    }
}

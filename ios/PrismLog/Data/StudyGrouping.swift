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

/// One session in a subject's history, with its progress measured against the
/// session before it. Ported from the activity objects `groupStudiesByEntity`
/// builds (`recordsPage.jsx:2411`).
struct StudyActivity: Identifiable, Hashable, Sendable {
    let record: RecordItem
    /// Display label: the log's own title, except the very first log — titled
    /// after the subject itself — which reads "공부 시작".
    let label: String
    let progress: Int
    /// The previous activity's progress; the first activity starts at its own.
    let progressStart: Int

    var id: UUID { record.id }
    var progressDelta: Int { max(0, progress - progressStart) }
    var occurredAt: Date { record.occurredAt }

    var photos: [URL] {
        (record.payload.array("photos") ?? [])
            .compactMap(\.stringValue)
            .compactMap(PrismMedia.url(for:))
    }

    /// "84p / 555p" or "13 / 67 챕터 완료" — the raw scale behind the percent.
    var scaleLabel: String {
        if record.payload.string("progress_mode") ?? "page" == "page", record.pagesTotal > 0 {
            return "\(record.pagesRead)p / \(record.pagesTotal)p"
        }
        let done = StudyGrouping.completedCount(record.payload)
        return "\(done) / \(StudyGrouping.totalCount(record.payload)) 챕터 완료"
    }
}

enum StudyGrouping {
    /// How many chapters a subject has. `chapters` is the web's list and `toc`
    /// is this app's tree; a subject created on either client has one of them,
    /// and long-lived subjects have both.
    static func chapterCount(_ payload: [String: JSONValue]) -> Int {
        payload.array("chapters")?.count ?? payload.array("toc")?.count ?? 0
    }

    /// Completed chapters. The `toc` tree wins when present — it counts nested
    /// nodes the flat `completed` array knows nothing about
    /// (`countStudyCompletedItems`, `recordsPage.jsx:2359`).
    static func completedCount(_ payload: [String: JSONValue]) -> Int {
        if let toc = payload.array("toc"), !toc.isEmpty {
            return tally(toc).done
        }
        return (payload.array("completed") ?? []).filter { $0.boolValue == true }.count
    }

    static func totalCount(_ payload: [String: JSONValue]) -> Int {
        if let toc = payload.array("toc"), !toc.isEmpty {
            return tally(toc).total
        }
        return payload.array("chapters")?.count ?? 0
    }

    private static func tally(_ nodes: [JSONValue]) -> (done: Int, total: Int) {
        nodes.reduce((0, 0)) { sum, node in
            guard let fields = node.objectValue else { return sum }
            let child = tally(fields["children"]?.arrayValue ?? [])
            let done = (fields["completed"]?.boolValue == true ? 1 : 0) + child.done
            return (sum.0 + done, sum.1 + 1 + child.total)
        }
    }

    /// Every activity logged against `record`'s subject, newest first.
    ///
    /// Walks chronologically because each activity's bar starts where the
    /// previous one ended — the same running comparison the timeline does.
    static func activities(for record: RecordItem, in records: [RecordItem]) -> [StudyActivity] {
        let subjectKey = record.entityID
        let siblings = records
            .filter { $0.category == .study && ($0.entityID ?? $0.id) == (subjectKey ?? record.id) }
            .sorted { $0.occurredAt < $1.occurredAt }

        var previous: Int?
        var built: [StudyActivity] = []

        for sibling in siblings {
            let progress = min(max(sibling.progress, 0), 100)
            let title = sibling.title.trimmingCharacters(in: .whitespaces)
            built.append(StudyActivity(
                record: sibling,
                label: title.isEmpty
                    ? "학습 기록"
                    : (title == sibling.entityTitle ? "공부 시작" : title),
                progress: progress,
                progressStart: previous ?? progress
            ))
            previous = progress
        }

        return built.reversed()
    }

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

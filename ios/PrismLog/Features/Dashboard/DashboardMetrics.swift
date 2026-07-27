import Foundation

/// Aggregations behind the dashboard, ported from `buildTrendSeries` and
/// `buildHeatmapMatrix` in `src/features/prismlog/core.jsx`.
enum DashboardMetrics {
    struct DayPoint: Identifiable, Hashable, Sendable {
        let date: Date
        var reading: Int
        var study: Int
        var culture: Int

        var id: Date { date }

        func count(for accent: PrismAccent) -> Int {
            switch accent {
            case .reading: reading
            case .study: study
            default: culture
            }
        }

        var total: Int { reading + study + culture }
    }

    struct HeatmapCell: Identifiable, Hashable, Sendable {
        let date: Date
        let count: Int
        /// `true` for days after today, drawn as empty space.
        let isFuture: Bool

        var id: Date { date }
    }

    // MARK: - Trend

    static func trend(
        from records: [RecordItem],
        days: Int = 14,
        cumulative: Bool,
        calendar: Calendar = .current,
        now: Date = .now
    ) -> [DayPoint] {
        let today = calendar.startOfDay(for: now)
        var buckets: [Date: DayPoint] = [:]

        for offset in stride(from: days - 1, through: 0, by: -1) {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: today) else { continue }
            buckets[day] = DayPoint(date: day, reading: 0, study: 0, culture: 0)
        }

        for record in records {
            let day = calendar.startOfDay(for: record.occurredAt)
            guard var bucket = buckets[day] else { continue }

            switch record.category {
            case .reading: bucket.reading += 1
            case .study: bucket.study += 1
            default: bucket.culture += 1
            }

            buckets[day] = bucket
        }

        let ordered = buckets.values.sorted { $0.date < $1.date }
        guard cumulative else { return ordered }

        var running = DayPoint(date: today, reading: 0, study: 0, culture: 0)
        return ordered.map { point in
            running.reading += point.reading
            running.study += point.study
            running.culture += point.culture
            return DayPoint(
                date: point.date,
                reading: running.reading,
                study: running.study,
                culture: running.culture
            )
        }
    }

    // MARK: - Heatmap

    /// Weeks of activity, oldest first, each row running Monday → Sunday.
    static func heatmap(
        from records: [RecordItem],
        weeks: Int = 5,
        accent: PrismAccent? = nil,
        calendar: Calendar = .current,
        now: Date = .now
    ) -> [[HeatmapCell]] {
        let today = calendar.startOfDay(for: now)

        // Monday of the current week. `weekday` is 1=Sunday in the Gregorian
        // calendar, so Sunday has to wrap back six days rather than forward one.
        let weekday = calendar.component(.weekday, from: today)
        let daysSinceMonday = (weekday + 5) % 7
        guard let thisMonday = calendar.date(byAdding: .day, value: -daysSinceMonday, to: today) else {
            return []
        }

        var counts: [Date: Int] = [:]
        for record in records where accent == nil || record.accent == accent {
            let day = calendar.startOfDay(for: record.occurredAt)
            counts[day, default: 0] += 1
        }

        return (0..<weeks).reversed().compactMap { weeksBack in
            guard let monday = calendar.date(byAdding: .day, value: -7 * weeksBack, to: thisMonday) else {
                return nil
            }

            return (0..<7).compactMap { dayOffset in
                guard let day = calendar.date(byAdding: .day, value: dayOffset, to: monday) else {
                    return nil
                }
                return HeatmapCell(date: day, count: counts[day] ?? 0, isFuture: day > today)
            }
        }
    }

    /// 0…3, matching the four steps the web heatmap draws — the web caps its
    /// per-day increment at 3 (`buildHeatmapMatrix`, `core.jsx:889`), so three
    /// records already reach full brightness.
    static func intensity(for count: Int) -> Int {
        min(max(count, 0), 3)
    }
}

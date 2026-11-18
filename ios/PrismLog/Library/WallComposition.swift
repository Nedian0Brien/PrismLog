import Foundation

/// One cover on the library wall — an entity, not a record. Nine sessions on
/// one textbook put one cover on the wall (spec §4.1).
struct WallCover: Identifiable, Hashable, Sendable {
    let id: String
    let accent: PrismAccent
    let title: String
    let coverURL: URL?
    /// The entity's most recent record, for "recent first" ordering.
    let lastActivity: Date
    /// Every day the entity was logged, for the timeline's period context:
    /// a book read last month belongs on the wall while last month is on
    /// screen, even if it was read again since.
    var activities: [Date] = []
    /// The entity's newest record — what tapping its cover opens.
    var recordID: UUID?

    var source: CoverKey.Source {
        if let coverURL { return .remote(coverURL) }
        return .generated(accent, title: title)
    }
}

/// What the wall is showing, set by the screen in front of it (spec §4.5).
enum WallContext: Hashable, Sendable {
    /// Every cover, most recently active first.
    case all
    case category(PrismAccent)
    /// Covers active in the timeline's visible range.
    case period(DateInterval)
    /// One record's cover, large and blurred, behind its detail screen.
    case hero(WallCover.ID)
    /// Settings: the full wall, not moving.
    case still
}

enum WallLayout: String, CaseIterable, Identifiable, Sendable {
    /// Category rows drifting in alternate directions (D2 option A).
    case rows
    /// A dense mosaic tilted −12°, drifting diagonally (D2 option B).
    case mosaic

    var id: String { rawValue }
}

/// Pure wall composition — which covers, in which order, on which row.
/// Kept free of SwiftUI so the rules in spec §4.1 and §4.3 can be tested.
enum WallComposition {
    /// Spec §4.3: rows cycle through the categories in this order.
    static let rowOrder: [PrismAccent] = [.reading, .movie, .game, .series, .study]

    /// One cover per entity, most recently active first. A record without an
    /// entity stands for itself.
    static func covers(from records: [RecordItem]) -> [WallCover] {
        var newest: [String: RecordItem] = [:]
        var latest: [String: Date] = [:]
        var activities: [String: [Date]] = [:]
        for record in records {
            let key = record.entityID?.uuidString ?? record.id.uuidString
            // The same clock the records hub orders shelves by.
            let activity = record.occurredAt
            activities[key, default: []].append(activity)
            if let current = latest[key], current >= activity { continue }
            latest[key] = activity
            newest[key] = record
        }
        return newest.map { key, record in
            WallCover(
                id: key,
                accent: record.accent,
                title: record.entityTitle ?? record.title,
                coverURL: record.coverURL,
                lastActivity: latest[key] ?? record.occurredAt,
                activities: (activities[key] ?? []).sorted(),
                recordID: record.id
            )
        }
        .sorted { lhs, rhs in
            lhs.lastActivity != rhs.lastActivity ? lhs.lastActivity > rhs.lastActivity : lhs.id < rhs.id
        }
    }

    /// The covers a context draws from. `.hero` keeps only its record; a hero
    /// whose cover isn't on the wall falls back to everything rather than an
    /// empty wall.
    static func covers(_ covers: [WallCover], in context: WallContext) -> [WallCover] {
        switch context {
        case .all, .still:
            return covers
        case .category(let accent):
            return covers.filter { $0.accent == accent }
        case .period(let interval):
            return covers.filter { cover in
                let days = cover.activities.isEmpty ? [cover.lastActivity] : cover.activities
                return days.contains { interval.contains($0) }
            }
        case .hero(let id):
            let match = covers.filter { $0.id == id }
            return match.isEmpty ? covers : match
        }
    }

    /// Covers for each row of layout A, `rowCount` rows long.
    ///
    /// With several categories present, row `i` takes the `i`-th category in
    /// `rowOrder` that has covers, wrapping around. With one category — a
    /// category context, or a library of only books — every row draws from
    /// it, each starting at a different point so stacked rows don't line up.
    static func rows(from covers: [WallCover], count rowCount: Int) -> [[WallCover]] {
        guard !covers.isEmpty, rowCount > 0 else { return [] }

        let groups = rowOrder
            .map { accent in covers.filter { $0.accent == accent } }
            .filter { !$0.isEmpty }

        return (0..<rowCount).map { row in
            let group = groups[row % groups.count]
            // How many times this group has already been used above this row.
            let lap = row / groups.count
            return arranged(group, seed: UInt64(row), rotation: lap * max(1, group.count / 2 + 1))
        }
    }

    /// The cover sequence for layout B, read off column by column.
    static func mosaic(from covers: [WallCover]) -> [WallCover] {
        arranged(covers, seed: 0xB0, rotation: 0)
    }

    /// A seeded shuffle, then a rotation. Covers are distinct entities, so a
    /// looping row of two or more never puts a cover beside itself — the
    /// wrap from last back to first included. Only a one-cover row repeats
    /// against itself, and there is nothing else to show.
    static func arranged(_ covers: [WallCover], seed: UInt64, rotation: Int) -> [WallCover] {
        guard covers.count > 1 else { return covers }
        var generator = SeededGenerator(seed: seed &+ 0x9E37_79B9_7F4A_7C15)
        var shuffled = covers.shuffled(using: &generator)
        let shift = ((rotation % shuffled.count) + shuffled.count) % shuffled.count
        shuffled = Array(shuffled[shift...] + shuffled[..<shift])
        return shuffled
    }
}

/// SplitMix64. Deterministic, so the wall looks the same on every launch
/// instead of reshuffling under the user's eye.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// The wall's single flow clock (spec §4.5). Elapsed time only advances
/// while running, so pausing and resuming picks up where the wall stopped
/// instead of jumping ahead by the time it spent paused.
struct WallClock: Equatable, Sendable {
    private var accumulated: TimeInterval = 0
    private var runningSince: Date?

    var isRunning: Bool { runningSince != nil }

    func elapsed(at date: Date) -> TimeInterval {
        guard let runningSince else { return accumulated }
        return accumulated + max(0, date.timeIntervalSince(runningSince))
    }

    mutating func start(at date: Date) {
        guard runningSince == nil else { return }
        runningSince = date
    }

    mutating func pause(at date: Date) {
        guard runningSince != nil else { return }
        accumulated = elapsed(at: date)
        runningSince = nil
    }
}

/// Why the wall is standing still. Any one is enough (spec §4.6, §8).
enum WallPauseReason: Hashable, Sendable, CaseIterable {
    case sceneInactive
    case lowPowerMode
    case reduceMotion
    case reduceTransparency
    case disabledInSettings
    case stillContext
    /// The library's content is pulled down and the covers can be tapped.
    case revealed
}

/// The wall handing over to the library's big cover and back: 0 is the
/// flowing wall, 1 the cover. A clock rather than an animation, because the
/// wall draws from a `TimelineView` that already redraws every frame.
struct WallStage: Equatable, Sendable {
    static let duration: TimeInterval = 0.9

    private(set) var from = 0.0
    private(set) var to = 0.0
    private(set) var start = Date.distantPast
    private(set) var duration: TimeInterval = 0

    func progress(at date: Date) -> Double {
        guard duration > 0 else { return to }
        let t = min(max(date.timeIntervalSince(start) / duration, 0), 1)
        let eased = t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
        return from + (to - from) * eased
    }

    func isMoving(at date: Date) -> Bool {
        duration > 0 && date.timeIntervalSince(start) < duration
    }

    /// Heads for `target` from wherever the stage is now, so turning back
    /// mid-way never jumps.
    mutating func move(to target: Double, at date: Date, duration: TimeInterval = WallStage.duration) {
        from = progress(at: date)
        to = target
        start = date
        self.duration = duration
    }
}

/// A virtualized strip position: which item fills `slot` once the strip has
/// moved `distance` points, and how far that slot sits from its rest place.
/// Lets a row of any length loop seamlessly without drawing it twice.
struct WallStrip: Equatable, Sendable {
    /// Whole pitches the strip has moved.
    let shift: Int
    /// The remaining fraction of a pitch, in points, in `0..<pitch`.
    let remainder: Double

    init(distance: Double, pitch: Double) {
        let steps = (distance / pitch).rounded(.down)
        shift = Int(steps)
        remainder = distance - steps * pitch
    }

    /// The index into an `itemCount`-long sequence shown at `slot`.
    func index(forSlot slot: Int, itemCount: Int) -> Int {
        guard itemCount > 0 else { return 0 }
        let raw = (slot + shift) % itemCount
        return raw < 0 ? raw + itemCount : raw
    }
}

/// Which cover fills a mosaic cell.
enum WallMosaicIndex {
    /// Steps vertically by one and horizontally by about half the sequence,
    /// so neither a cover's vertical nor horizontal neighbour is itself
    /// whenever there are two or more covers.
    static func index(column: Int, row: Int, count: Int) -> Int {
        guard count > 1 else { return 0 }
        var columnStep = (count / 2) | 1
        if columnStep % count == 0 { columnStep = 1 }
        let raw = (column * columnStep + row) % count
        return raw < 0 ? raw + count : raw
    }
}

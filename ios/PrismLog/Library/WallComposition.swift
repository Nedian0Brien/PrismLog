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
    /// Wall seconds per real second.
    private(set) var rate: Double = 1

    var isRunning: Bool { runningSince != nil }

    func elapsed(at date: Date) -> TimeInterval {
        guard let runningSince else { return accumulated }
        return accumulated + max(0, date.timeIntervalSince(runningSince)) * rate
    }

    /// Changes the pace from `date` on, without moving what's already run:
    /// the wall slows down where it is instead of jumping.
    mutating func setRate(_ newRate: Double, at date: Date) {
        guard newRate != rate else { return }
        if runningSince != nil {
            accumulated = elapsed(at: date)
            runningSince = date
        }
        rate = newRate
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
    /// A cover is on the library's stage: the rows hold still around it.
    case focused
}

/// How far the person has pushed one wall row by hand, on top of its flow.
/// A released row coasts and slows to a stop on its own.
struct RowNudge: Equatable, Sendable {
    /// Points along the row's flow; positive moves the covers left.
    private(set) var settled: Double = 0
    private(set) var velocity: Double = 0
    private(set) var released = Date.distantPast
    /// The coast's time constant: a flick dies away within about a second.
    static let decay: TimeInterval = 0.32
    static let maximumSpeed: Double = 5_000

    /// A row racing a cover to the middle: from here to `settled`.
    private(set) var glideFrom: Double?
    private(set) var glideStart = Date.distantPast
    private(set) var glideTime: TimeInterval = 0

    func offset(at date: Date) -> Double {
        if let glideFrom, date < glideStart.addingTimeInterval(glideTime) {
            guard date > glideStart, glideTime > 0 else { return glideFrom }
            let t = date.timeIntervalSince(glideStart) / glideTime
            return glideFrom + (settled - glideFrom) * WallFocus.easeInOut(t)
        }
        let t = max(0, date.timeIntervalSince(released))
        return settled + velocity * Self.decay * (1 - exp(-t / Self.decay))
    }

    /// Holds the row where it is now, for a new drag.
    mutating func grab(at date: Date) {
        settled = offset(at: date)
        velocity = 0
        glideFrom = nil
    }

    /// Races the row from where it is at `start` to `target`.
    mutating func glide(to target: Double, start: Date, duration: TimeInterval) {
        glideFrom = offset(at: start)
        settled = target
        velocity = 0
        glideStart = start
        glideTime = duration
    }

    mutating func move(to offset: Double) {
        settled = offset
        velocity = 0
        glideFrom = nil
    }

    /// Lets go with the finger's speed, in points per second along the flow.
    mutating func release(velocity: Double, at date: Date) {
        self.velocity = min(max(velocity, -Self.maximumSpeed), Self.maximumSpeed)
        released = date
    }
}

/// The library's big cover taking the stage and leaving it: the cover on
/// stage shrinks back into its row, the next one's row scrolls until that
/// cover reaches the middle, and it rises out of the row to full size
/// (2026-11-19, user design). A clock rather than animations, because the
/// wall draws from a `TimelineView` that already redraws every frame.
struct WallFocus: Equatable, Sendable {
    /// A cover on stage, the pattern row it rises from, and where along
    /// that row (an absolute strip position) it was set.
    struct Hero: Equatable, Sendable {
        let id: String
        let row: Int?
        var position: Int? = nil
    }

    static let shrink: TimeInterval = 0.35
    static let glide: TimeInterval = 0.6
    static let grow: TimeInterval = 0.5
    static let dimming: TimeInterval = 0.3

    private(set) var outgoing: Hero?
    /// How big the outgoing cover was when it started back.
    private(set) var outgoingFrom = 0.0
    private(set) var incoming: Hero?
    private(set) var start = Date.distantPast
    private(set) var dimFrom = 0.0
    /// 1 normally, 0 to jump straight to the end (Reduce Motion).
    private(set) var pace = 1.0

    var target: String? { incoming?.id }

    var shrinkTime: TimeInterval { outgoing == nil ? 0 : Self.shrink * outgoingFrom * pace }
    var glideStart: Date { start.addingTimeInterval(shrinkTime) }
    var glideTime: TimeInterval { incoming?.row == nil ? 0 : Self.glide * pace }
    var growStart: Date { glideStart.addingTimeInterval(glideTime) }
    var end: Date {
        let dimEnd = start.addingTimeInterval(Self.dimming * pace)
        guard incoming != nil else { return max(glideStart, dimEnd) }
        return max(growStart.addingTimeInterval(Self.grow * pace), dimEnd)
    }

    func isMoving(at date: Date) -> Bool { date < end }

    /// The outgoing cover's size, 1 on stage to 0 back in its row.
    func outgoingGrowth(at date: Date) -> Double {
        guard outgoing != nil, outgoingFrom > 0 else { return 0 }
        guard shrinkTime > 0 else { return 0 }
        let t = Self.unit(date.timeIntervalSince(start) / shrinkTime)
        return outgoingFrom * (1 - Self.easeInOut(t))
    }

    /// The incoming cover's size, 0 in its row to 1 on stage.
    func incomingGrowth(at date: Date) -> Double {
        guard incoming != nil else { return 0 }
        let time = Self.grow * pace
        guard time > 0 else { return date >= growStart ? 1 : 0 }
        return Self.easeOut(Self.unit(date.timeIntervalSince(growStart) / time))
    }

    /// How far the covers around the stage have stepped back, 0–1. They
    /// stay put while the row races, so the race shows, and step back as
    /// the cover rises; on the way out they come forward as it sinks.
    func dim(at date: Date) -> Double {
        let goal = incoming == nil ? 0.0 : 1.0
        let begin = incoming == nil ? start : growStart
        let time = (incoming == nil ? max(shrinkTime, Self.dimming * pace) : Self.grow * pace)
        guard time > 0 else { return date >= begin ? goal : dimFrom }
        let t = Self.unit(date.timeIntervalSince(begin) / time)
        return dimFrom + (goal - dimFrom) * Self.easeInOut(t)
    }

    /// When a row would start racing if the stage were retargeted at `date`:
    /// after whatever cover is showing has sunk back.
    func glideStart(retargetingAt date: Date) -> Date {
        var copy = self
        copy.retarget(to: Hero(id: "", row: nil), at: date, instant: pace == 0)
        return copy.glideStart
    }

    /// Sends `hero` on stage (or clears it) from wherever things stand now:
    /// whichever cover is showing goes back first, from the size it has.
    mutating func retarget(to hero: Hero?, at date: Date, instant: Bool = false) {
        let incomingNow = incomingGrowth(at: date)
        let outgoingNow = outgoingGrowth(at: date)
        dimFrom = dim(at: date)
        if let incoming, incomingNow > 0 {
            outgoing = incoming
            outgoingFrom = incomingNow
        } else if outgoingNow > 0 {
            outgoingFrom = outgoingNow
        } else {
            outgoing = nil
            outgoingFrom = 0
        }
        incoming = hero
        start = date
        pace = instant ? 0 : 1
    }

    static func unit(_ value: Double) -> Double { min(max(value, 0), 1) }
    static func easeInOut(_ t: Double) -> Double { t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2 }
    static func easeOut(_ t: Double) -> Double { 1 - pow(1 - t, 3) }
}

/// Where layout A puts rows and covers on screen — shared by the wall that
/// draws them and the model that picks which row brings a cover on stage.
struct WallRowGeometry {
    let rows: [[WallCover]]
    let metrics: WallMetrics
    let size: CGSize
    let parallax: Double

    var vertical: WallStrip { WallStrip(distance: parallax, pitch: Double(metrics.pitchY)) }
    var visibleRows: Int { Int((size.height / metrics.pitchY).rounded(.up)) + 2 }

    func rowIndex(forSlot slot: Int) -> Int {
        vertical.index(forSlot: slot, itemCount: rows.count)
    }

    /// A row slot's vertical centre on screen.
    func centreY(ofSlot slot: Int) -> CGFloat {
        CGFloat(slot) * metrics.pitchY - CGFloat(vertical.remainder) - metrics.pitchY / 2 + metrics.coverHeight / 2
    }

    /// The pattern row holding `id` whose on-screen slot is nearest `y`.
    /// The pattern row whose on-screen slot is nearest `y`.
    func row(near y: CGFloat) -> Int? {
        guard !rows.isEmpty else { return nil }
        return (0..<visibleRows)
            .min { abs(centreY(ofSlot: $0) - y) < abs(centreY(ofSlot: $1) - y) }
            .map(rowIndex(forSlot:))
    }

    /// The slot showing pattern row `row` nearest `y`.
    func slot(showing row: Int, near y: CGFloat) -> Int? {
        (0..<visibleRows)
            .filter { rowIndex(forSlot: $0) == row }
            .min { abs(centreY(ofSlot: $0) - y) < abs(centreY(ofSlot: $1) - y) }
    }

    /// Where on a row's strip (`a·pitch − distance`) a cover sits dead
    /// centre.
    private var centring: Double {
        Double(metrics.pitchX) / 2 - Double(metrics.coverWidth) / 2 + Double(size.width) / 2
    }

    /// The horizontal centre of strip position `position`, with the row
    /// moved `distance` along its flow.
    func centreX(ofPosition position: Int, distance: Double) -> CGFloat {
        CGFloat(Double(position) * Double(metrics.pitchX) - distance) - metrics.pitchX / 2 + metrics.coverWidth / 2
    }

    /// The first strip position at least `minimum` points along the row's
    /// flow from `distance` that can be brought dead centre — so the row
    /// visibly races there — and the distance that centres it.
    func positionToCentre(from distance: Double, direction: Double, minimum: Double) -> (position: Int, distance: Double) {
        let p = Double(metrics.pitchX)
        let forward = direction >= 0
        let goal = (distance + (forward ? minimum : -minimum) + centring) / p
        let position = Int(forward ? goal.rounded(.up) : goal.rounded(.down))
        return (position, Double(position) * p - centring)
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

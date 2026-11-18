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
    /// From outside the wall's context, there only to fill a sparse wall:
    /// drawn dark, behind the covers that belong.
    var isFiller = false

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

    /// How many cover slots a row needs before it reads as a row of
    /// posters rather than one poster repeated: a little more than the
    /// widest screen shows.
    static let fullRowLength = 8

    /// Covers for each row of layout A, `rowCount` rows long.
    ///
    /// A category with enough covers to fill a row gets rows of its own, in
    /// `rowOrder`. Categories too small for that share one mixed row, so a
    /// lone film doesn't fill its row with itself (2026-11-19).
    static func rows(from covers: [WallCover], count rowCount: Int, minimumLength: Int = fullRowLength) -> [[WallCover]] {
        guard !covers.isEmpty, rowCount > 0 else { return [] }

        let byCategory = rowOrder.map { accent in covers.filter { $0.accent == accent } }
        var groups = byCategory.filter { $0.count >= minimumLength }
        let small = byCategory.filter { !$0.isEmpty && $0.count < minimumLength }.flatMap { $0 }
        if !small.isEmpty { groups.append(small) }

        return (0..<rowCount).map { row in
            let group = groups[row % groups.count]
            // How many times this group has already been used above this row.
            let lap = row / groups.count
            return arranged(group, seed: UInt64(row), rotation: lap * max(1, group.count / 2 + 1))
        }
    }

    /// Covers from outside the person's records — this week's films, series
    /// and games — mixed into the wall (user decision, 2026-11-19):
    ///
    /// - With no records at all, they are the wall, at full brightness.
    /// - With few, they fill it to two screens' worth, dark.
    /// - With plenty, about one cover in seven is one of them, dark.
    ///
    /// A shelf takes only its own category's; a record's hero takes none.
    static func mixingIn(_ discovery: [WallCover], with wall: [WallCover], ownedCount: Int, context: WallContext) -> [WallCover] {
        let pool: [WallCover]
        switch context {
        case .hero:
            return wall
        case .category(let accent):
            pool = discovery.filter { $0.accent == accent }
        case .all, .still, .period:
            pool = discovery
        }
        guard !pool.isEmpty else { return wall }

        if ownedCount == 0 {
            return pool
        }
        let wanted = max(fullRowLength * 2 - wall.count, Int((Double(wall.count) * discoveryShare).rounded(.up)))
        let mixed = pool.prefix(max(wanted, 0)).map { cover -> WallCover in
            var dark = cover
            dark.isFiller = true
            return dark
        }
        return wall + mixed
    }

    /// The share of a full wall given to covers outside the person's records.
    static let discoveryShare = 0.15

    /// The covers a context draws, topped up when there are too few to
    /// fill the screen: a timeline week with three records would otherwise
    /// repeat those three across every row. The rest come from outside the
    /// context, most recent first, marked as filler so the wall draws them
    /// dark (user decision, 2026-11-19).
    static func filled(_ inContext: [WallCover], from all: [WallCover], context: WallContext, target: Int = fullRowLength) -> [WallCover] {
        switch context {
        case .period, .category: break
        default: return inContext
        }
        guard !inContext.isEmpty, inContext.count < target else { return inContext }
        let present = Set(inContext.map(\.id))
        let fillers = all
            .filter { !present.contains($0.id) }
            .prefix(target - inContext.count)
            .map { cover -> WallCover in
                var filler = cover
                filler.isFiller = true
                return filler
            }
        return inContext + fillers
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
    /// One cover on stage handing over to the next (user decision,
    /// 2026-11-19): the first slides away the way the pager moved while the
    /// row races at once, and the next rises a little sooner.
    static let exit: TimeInterval = 0.5
    static let swapGlide: TimeInterval = 0.45
    static let swapGrow: TimeInterval = 0.4

    private(set) var outgoing: Hero?
    /// How big the outgoing cover was when it started to leave.
    private(set) var outgoingFrom = 0.0
    /// The outgoing cover slides off at full size instead of sinking back.
    private(set) var exiting = false
    private(set) var exitStart = Date.distantPast
    /// −1 off to the left (the pager moved forward), +1 off to the right.
    private(set) var exitDirection = -1.0
    private(set) var incoming: Hero?
    private(set) var start = Date.distantPast
    private(set) var dimFrom = 0.0
    /// 1 normally, 0 to jump straight to the end (Reduce Motion).
    private(set) var pace = 1.0

    var target: String? { incoming?.id }

    var shrinkTime: TimeInterval { outgoing == nil || exiting ? 0 : Self.shrink * outgoingFrom * pace }
    var exitTime: TimeInterval { Self.exit * pace }
    var glideStart: Date { start.addingTimeInterval(shrinkTime) }
    var glideTime: TimeInterval { incoming?.row == nil ? 0 : (exiting ? Self.swapGlide : Self.glide) * pace }
    var growStart: Date { glideStart.addingTimeInterval(glideTime) }
    var growTime: TimeInterval { (exiting ? Self.swapGrow : Self.grow) * pace }
    var end: Date {
        let dimEnd = start.addingTimeInterval(Self.dimming * pace)
        let exitEnd = exiting ? exitStart.addingTimeInterval(exitTime) : start
        guard incoming != nil else { return max(glideStart, dimEnd, exitEnd) }
        return max(growStart.addingTimeInterval(growTime), dimEnd, exitEnd)
    }

    func isMoving(at date: Date) -> Bool { date < end }

    /// The outgoing cover's size, 1 on stage to 0 back in its row. A cover
    /// sliding away keeps its size until it's off screen.
    func outgoingGrowth(at date: Date) -> Double {
        guard outgoing != nil, outgoingFrom > 0 else { return 0 }
        if exiting {
            return date < exitStart.addingTimeInterval(exitTime) ? outgoingFrom : 0
        }
        guard shrinkTime > 0 else { return 0 }
        let t = Self.unit(date.timeIntervalSince(start) / shrinkTime)
        return outgoingFrom * (1 - Self.easeInOut(t))
    }

    /// How far a sliding cover has gone, 0 in place to 1 off screen —
    /// gathering speed as it goes.
    func outgoingExit(at date: Date) -> Double {
        guard exiting else { return 0 }
        guard exitTime > 0 else { return 1 }
        let t = Self.unit(date.timeIntervalSince(exitStart) / exitTime)
        return t * t
    }

    /// The incoming cover's size, 0 in its row to 1 on stage.
    func incomingGrowth(at date: Date) -> Double {
        guard incoming != nil else { return 0 }
        guard growTime > 0 else { return date >= growStart ? 1 : 0 }
        return Self.easeOut(Self.unit(date.timeIntervalSince(growStart) / growTime))
    }

    /// How far the covers around the stage have stepped back, 0–1. They
    /// stay put while the row races, so the race shows, and step back as
    /// the cover rises; on the way out they come forward as it sinks.
    func dim(at date: Date) -> Double {
        let goal = incoming == nil ? 0.0 : 1.0
        let begin = incoming == nil ? start : growStart
        let time = (incoming == nil ? max(shrinkTime, Self.dimming * pace) : growTime)
        guard time > 0 else { return date >= begin ? goal : dimFrom }
        let t = Self.unit(date.timeIntervalSince(begin) / time)
        return dimFrom + (goal - dimFrom) * Self.easeInOut(t)
    }

    /// When a row would start racing if the stage were handed to another
    /// cover at `date`.
    func glideStart(retargetingAt date: Date) -> Date {
        var copy = self
        copy.retarget(to: Hero(id: "", row: nil), at: date, instant: pace == 0)
        return copy.glideStart
    }

    /// Sends `hero` on stage (or clears it) from wherever things stand now.
    /// Handing over to another cover, the one showing slides away in
    /// `direction`; clearing the stage, it sinks back into its row.
    mutating func retarget(to hero: Hero?, at date: Date, instant: Bool = false, direction: Double = -1) {
        let incomingNow = incomingGrowth(at: date)
        let outgoingNow = outgoingGrowth(at: date)
        let alreadyLeaving = exiting && outgoingNow > 0
        dimFrom = dim(at: date)
        if let incoming, incomingNow > 0 {
            outgoing = incoming
            outgoingFrom = incomingNow
            exiting = hero != nil
            exitStart = date
            exitDirection = direction
        } else if outgoingNow > 0 {
            // Still on its way out: it carries on as it was.
            outgoingFrom = outgoingNow
            if !alreadyLeaving {
                exiting = false
            }
        } else {
            outgoing = nil
            outgoingFrom = 0
            exiting = false
        }
        incoming = hero
        start = date
        pace = instant ? 0 : 1
    }

    static func unit(_ value: Double) -> Double { min(max(value, 0), 1) }
    static func easeInOut(_ t: Double) -> Double { t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2 }
    static func easeOut(_ t: Double) -> Double { 1 - pow(1 - t, 3) }
}

/// The wall changing context like trains at a platform (user design,
/// 2026-11-19): each row of the old wall pulls away in its direction of
/// flow, gathering speed, a beat after the row above; the new wall's rows
/// pull in from the other side and brake to their usual drift.
struct WallShift: Equatable, Sendable {
    /// What the wall showed before, for the rows that leave.
    let departing: [WallCover]
    let departingContext: WallContext
    let start: Date

    static let leave: TimeInterval = 0.45
    static let arriveDelay: TimeInterval = 0.3
    static let arrive: TimeInterval = 0.55
    /// Each row starts this much after the row above.
    static let stagger: TimeInterval = 0.04
    /// Enough rows for the tallest screen, for the end time.
    static let maximumRows = 10

    var end: Date {
        start.addingTimeInterval(Self.arriveDelay + Self.arrive + Self.stagger * Double(Self.maximumRows))
    }

    func isMoving(at date: Date) -> Bool { date < end }

    /// How far a leaving row has gone along its way out, 0 at rest to 1
    /// fully off screen — slow to start, quick to go.
    func leaving(slot: Int, at date: Date) -> Double {
        let t = WallFocus.unit((date.timeIntervalSince(start) - Self.stagger * Double(max(slot, 0))) / Self.leave)
        return t * t
    }

    /// How far an arriving row still has to come, 1 off screen to 0 in
    /// place — quick to come in, braking at the end.
    func arriving(slot: Int, at date: Date) -> Double {
        let t = WallFocus.unit((date.timeIntervalSince(start) - Self.arriveDelay - Self.stagger * Double(max(slot, 0))) / Self.arrive)
        return 1 - WallFocus.easeOut(t)
    }
}

/// Which way a row is moving through a context change.
enum WallTrain: Equatable, Sendable {
    case leaving(WallShift, Date)
    case arriving(WallShift, Date)

    /// The row's sideways offset, in screen widths, along its flow.
    func travel(slot: Int) -> Double {
        switch self {
        case .leaving(let shift, let date): shift.leaving(slot: slot, at: date)
        case .arriving(let shift, let date): -shift.arriving(slot: slot, at: date)
        }
    }
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

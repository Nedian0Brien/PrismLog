import Observation
import SwiftUI
import UIKit

/// The library wall's state: which covers, in which layout and context, how
/// far the flow has run, and the decoded images to draw (spec §4.1, §4.5).
///
/// One instance serves the whole app, so switching tabs never resets the flow.
@Observable
@MainActor
final class LibraryWallModel {
    var layout: WallLayout = .rows

    /// The library's "now in progress" covers, in pager order, while the
    /// library is on screen.
    var feature: [WallCover.ID]? {
        didSet { if feature != oldValue { refocus() } }
    }
    /// The pager has moved onto the "now in progress" cards.
    var featureActive = false {
        didSet { if featureActive != oldValue { refocus() } }
    }
    /// Which "now in progress" card the pager is on.
    var featureIndex = 0 {
        didSet {
            guard featureIndex != oldValue else { return }
            // Forward through the cards sends the cover on stage off left.
            handOverDirection = featureIndex > oldValue ? -1 : 1
            refocus()
        }
    }
    @ObservationIgnored private var handOverDirection = -1.0
    /// Where on screen, top to bottom, the big cover may hang: below the
    /// top bar, above where the lowered pager rests.
    var posterArea: ClosedRange<CGFloat>?

    /// The cover on the library's stage, coming or going.
    private(set) var focus = WallFocus()
    /// Covers set into rows for the stage, by pattern row and strip
    /// position. They stay where they were set, so a cover sinking back
    /// finds its place and the row doesn't change under the eye.
    private(set) var placements: [Int: [Int: WallCover.ID]] = [:]
    /// Changes when a focus move has finished, so a paused wall's timeline
    /// can stop again.
    private(set) var focusSettles = 0

    // Where the wall last laid its rows out, for picking the row a cover
    // rises from. Read only when the stage changes, so not observed.
    @ObservationIgnored var wallSize: CGSize = .zero
    @ObservationIgnored var wallMetrics: WallMetrics = .compact
    @ObservationIgnored var parallax: Double = 0

    /// The cover the pager asks for: the card it's on, while it's on one.
    var requestedHero: WallCover.ID? {
        guard featureActive, let feature, !feature.isEmpty else { return nil }
        return feature[min(max(featureIndex, 0), feature.count - 1)]
    }

    /// The rows the wall draws, in its layout.
    var rowGeometry: WallRowGeometry {
        WallRowGeometry(
            rows: WallComposition.rows(from: visibleCovers, count: WallRowsPattern.rowCount),
            metrics: wallMetrics,
            size: wallSize,
            parallax: parallax
        )
    }

    /// Where the big cover's middle sits on screen.
    var stageCentreY: CGFloat {
        if let posterArea { return (posterArea.lowerBound + posterArea.upperBound) / 2 }
        return wallSize.height * 0.35
    }

    private func refocus(at date: Date = .now) {
        let target = requestedHero
        guard target != focus.target else { return }
        let instant = pauseReasons.contains(.reduceMotion)

        guard let target else {
            focus.retarget(to: nil, at: date, instant: instant)
            // The rows start again once the cover is back in its place.
            let back = focus.glideStart
            scheduleSettle(at: focus.end) { [weak self] in
                guard let self, self.focus.target == nil else { return }
                self.setPaused(false, for: .focused, at: back)
            }
            return
        }

        // The rows hold still around the stage; the one carrying the cover
        // races it to the middle.
        setPaused(true, for: .focused, at: date)
        let geometry = rowGeometry
        // The row through the middle of the stage races, and the cover
        // arrives in it — whatever the row's category (user design).
        let row = layout == .rows && geometry.size.width > 0 ? geometry.row(near: stageCentreY) : nil
        var hero = WallFocus.Hero(id: target, row: row)
        let glideStart = focus.glideStart(retargetingAt: date)

        if let row {
            let speed = WallSpeed.row(row)
            let flow = elapsed(at: date) * speedScale * speed
            let current = flow + nudge(row: row, at: glideStart)
            let landing = geometry.positionToCentre(
                from: current,
                direction: speed,
                minimum: Double(max(geometry.size.width, 320)) * 1.2
            )
            hero.position = landing.position
            placements[row, default: [:]][landing.position] = target
            focus.retarget(to: hero, at: date, instant: instant, direction: handOverDirection)
            var nudge = nudges[row] ?? RowNudge()
            nudge.glide(to: landing.distance - flow, start: focus.glideStart, duration: focus.glideTime)
            nudges[row] = nudge
        } else {
            focus.retarget(to: hero, at: date, instant: instant, direction: handOverDirection)
        }
        scheduleSettle(at: focus.end) {}
    }

    private func scheduleSettle(at end: Date, then action: @escaping @MainActor () -> Void) {
        let wait = max(end.timeIntervalSinceNow, 0) + 0.05
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(wait))
            action()
            self?.focusSettles &+= 1
        }
    }

    /// The library's content is pulled down: the wall slows, brightens,
    /// opens a record when its cover is tapped, and its rows can be pushed
    /// along by hand.
    var revealed = false {
        didSet {
            guard revealed != oldValue else { return }
            clock.setRate(revealed ? Self.revealedFlowRate : 1, at: .now)
        }
    }
    /// A slower flow while the covers are within reach of a finger.
    static let revealedFlowRate = 1.0 / 3

    /// Rows pushed by hand, by pattern row.
    private(set) var nudges: [Int: RowNudge] = [:]
    /// Where each row was when its drag began.
    private var grabbed: [Int: Double] = [:]

    func nudge(row: Int, at date: Date) -> Double {
        nudges[row]?.offset(at: date) ?? 0
    }

    func dragRow(_ row: Int, by translation: Double, at date: Date = .now) {
        if grabbed[row] == nil {
            var nudge = nudges[row] ?? RowNudge()
            nudge.grab(at: date)
            grabbed[row] = nudge.offset(at: date)
            nudges[row] = nudge
        }
        // A finger moving right pulls the covers right: back along the flow.
        nudges[row]?.move(to: (grabbed[row] ?? 0) - translation)
    }

    func releaseRow(_ row: Int, velocity: Double, at date: Date = .now) {
        // A drag that never went sideways never grabbed the row.
        guard grabbed.removeValue(forKey: row) != nil else { return }
        nudges[row]?.release(velocity: -velocity, at: date)
    }

    var context: WallContext = .all {
        didSet {
            setPaused(context == .still, for: .stillContext)
            guard context != oldValue, Self.drawsRows(oldValue), Self.drawsRows(context),
                  !pauseReasons.contains(.reduceMotion) else { return }
            let departing = covers(for: oldValue)
            guard !departing.isEmpty else { return }
            let shift = WallShift(departing: departing, departingContext: oldValue, start: .now)
            self.shift = shift
            scheduleSettle(at: shift.end) { [weak self] in
                if self?.shift == shift { self?.shift = nil }
            }
        }
    }

    /// The wall changing context: the old rows pulling out, the new pulling in.
    private(set) var shift: WallShift?

    /// Contexts drawn as flowing rows, rather than one record's cover.
    static func drawsRows(_ context: WallContext) -> Bool {
        if case .hero = context { return false }
        return true
    }

    /// Multiplies the spec's flow speeds. The debug lab tunes it; the app
    /// leaves it at 1.
    var speedScale: Double = 1

    /// Long edge, in pixels, the wall decodes covers at. Covers on the wall
    /// sit under a dimming layer, so they need less resolution than the
    /// cover in a list card — and 200 covers at 512px would cost 140MB
    /// against the 80MB budget in spec §9.
    var imagePixelBucket: Int = 256 {
        didSet {
            guard imagePixelBucket != oldValue else { return }
            images = [:]
            loadImages()
        }
    }

    private(set) var covers: [WallCover] = []
    private(set) var images: [WallCover.ID: UIImage] = [:]
    private(set) var pauseReasons: Set<WallPauseReason> = []

    private var clock = WallClock()
    private var loadTask: Task<Void, Never>?
    /// Fixture covers come with their own images and must not be fetched.
    private var isFixture = false
    private let cache: CoverThumbnailCache

    init(cache: CoverThumbnailCache = .shared) {
        self.cache = cache
        clock.start(at: .now)
    }

    var visibleCovers: [WallCover] { covers(for: context) }

    /// The covers a context puts on the wall: its own, topped up from the
    /// person's other records, with outside covers mixed in.
    func covers(for context: WallContext) -> [WallCover] {
        let own = WallComposition.filled(WallComposition.covers(covers, in: context), from: covers, context: context)
        return WallComposition.mixingIn(discovery, with: own, ownedCount: covers.count, context: context)
    }

    // MARK: Discovery

    /// This week's films and series and recent games, from the backend:
    /// the wall for someone with no records yet, and a dark scattering among
    /// everyone else's.
    private(set) var discovery: [WallCover] = [] {
        didSet { if discovery != oldValue { loadImages() } }
    }
    /// The same list as search items, for the add sheets' "this week" grid.
    private(set) var discoveryItems: [MediaSearchItem] = []

    private static var discoveryFile: URL {
        URL.cachesDirectory.appending(path: "featured-media.json")
    }
    private static let discoveryLifetime: TimeInterval = 12 * 60 * 60

    /// Shows the last list straight away, then fetches a fresh one when it
    /// is more than half a day old. A failed fetch keeps what's there.
    func loadDiscovery(api: PrismAPIClient = .shared) async {
        let file = Self.discoveryFile
        let saved = try? Data(contentsOf: file)
        if let saved, let items = try? JSONDecoder().decode([MediaSearchItem].self, from: saved) {
            discoveryItems = items
            discovery = items.compactMap(Self.wallCover(from:))
        }
        let age = (try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate)
            .map { Date.now.timeIntervalSince($0) } ?? .infinity
        guard saved == nil || age > Self.discoveryLifetime else { return }

        guard let items = try? await api.featuredMedia() else { return }
        discoveryItems = items
        discovery = items.compactMap(Self.wallCover(from:))
        if let data = try? JSONEncoder().encode(items) {
            try? data.write(to: file, options: .atomic)
        }
    }

    static func wallCover(from item: MediaSearchItem) -> WallCover? {
        guard let url = item.posterURL else { return nil }
        let accent: PrismAccent = switch item.cultureType {
        case .series: .series
        case .game: .game
        default: .movie
        }
        return WallCover(
            id: "featured:\(item.sourceId)",
            accent: accent,
            title: item.title,
            coverURL: url,
            lastActivity: .distantPast
        )
    }

    var isPaused: Bool { !pauseReasons.isEmpty }

    func elapsed(at date: Date) -> TimeInterval {
        clock.elapsed(at: date)
    }

    /// Decoded bytes the wall is holding, for the memory budget.
    var decodedBytes: Int {
        images.values.reduce(0) { total, image in
            guard let cgImage = image.cgImage else { return total }
            return total + cgImage.bytesPerRow * cgImage.height
        }
    }

    // MARK: Inputs

    func update(records: [RecordItem]) {
        let next = WallComposition.covers(from: records)
        guard isFixture || next != covers else { return }
        isFixture = false
        covers = next
        images = images.filter { id, _ in next.contains { $0.id == id } || discovery.contains { $0.id == id } }
        loadImages()
    }

    /// Replaces the wall with covers whose images are already decoded — the
    /// debug lab's worst-case and 200-cover fixtures.
    func useFixture(covers: [WallCover], images: [WallCover.ID: UIImage]) {
        loadTask?.cancel()
        isFixture = true
        self.covers = covers
        self.images = images
    }

    func setPaused(_ paused: Bool, for reason: WallPauseReason, at date: Date = .now) {
        if paused {
            pauseReasons.insert(reason)
        } else {
            pauseReasons.remove(reason)
        }
        if pauseReasons.isEmpty {
            clock.start(at: date)
        } else {
            clock.pause(at: date)
        }
    }

    // MARK: Images

    private func loadImages() {
        guard !isFixture else { return }
        loadTask?.cancel()
        let pending = (covers + discovery).filter { images[$0.id] == nil }
        let bucket = imagePixelBucket
        let cache = cache

        loadTask = Task { [weak self] in
            await withTaskGroup(of: (WallCover.ID, UIImage?).self) { group in
                for cover in pending {
                    group.addTask {
                        (cover.id, await Self.image(for: cover, maxPixel: bucket, cache: cache))
                    }
                }
                for await (id, image) in group {
                    guard let self, !Task.isCancelled, let image else { continue }
                    self.images[id] = image
                }
            }
        }
    }

    /// The cover's artwork, or its generated cover when there is none or it
    /// can't be fetched — the same fallback as `CoverImage`.
    private nonisolated static func image(
        for cover: WallCover,
        maxPixel: Int,
        cache: CoverThumbnailCache
    ) async -> UIImage? {
        if let url = cover.coverURL, let image = await cache.image(for: url, maxPixel: maxPixel) {
            return image
        }
        let key = CoverKey(source: .generated(cover.accent, title: cover.title), maxPixel: maxPixel)
        return await GeneratedCover.image(for: key, cache: cache)
    }
}

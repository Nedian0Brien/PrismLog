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
    /// library is on screen. The big posters draw from them.
    var feature: [WallCover.ID]? {
        didSet { if let feature { lastFeature = feature } }
    }
    /// The pager has moved onto the "now in progress" cards: the rows leave
    /// and the big posters take the stage.
    var featureActive = false {
        didSet {
            guard featureActive != oldValue else { return }
            let instant = pauseReasons.contains(.reduceMotion)
            let duration = instant ? 0 : WallStage.duration
            stage.move(to: featureActive ? 1 : 0, at: .now, duration: duration)
            // A paused wall's timeline runs only while the stage moves; this
            // tick redraws it once the move is over so it can stop again.
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(duration + 0.05))
                self?.stageSettles &+= 1
            }
        }
    }
    /// Changes when a stage move has finished.
    private(set) var stageSettles = 0
    /// Where on screen, top to bottom, the big poster may hang: below the
    /// top bar, above where the lowered pager rests.
    var posterArea: ClosedRange<CGFloat>?
    /// Which big poster is centred, fractional while the pager moves: 0 is
    /// the first, −1 puts it a page to the right (the spectrum card is up).
    var featurePosition: Double = -1
    /// The covers last featured, kept while they leave.
    private(set) var lastFeature: [WallCover.ID] = []
    private(set) var stage = WallStage()

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
        didSet { setPaused(context == .still, for: .stillContext) }
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

    var visibleCovers: [WallCover] {
        WallComposition.covers(covers, in: context)
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
        images = images.filter { id, _ in next.contains { $0.id == id } }
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
        let pending = covers.filter { images[$0.id] == nil }
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

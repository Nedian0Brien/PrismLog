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

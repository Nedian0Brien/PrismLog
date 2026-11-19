import Foundation
import ImageIO
import SwiftUI
import Testing
import UIKit
import UniformTypeIdentifiers

@testable import PrismLog

/// Pins the cover pipeline (spec §4.1–4.2): every record gets one decoded
/// image at the size it's drawn, from one download, and a dead link costs
/// one request per session.
@Suite
struct CoverPipelineTests {
    // MARK: Fixtures

    /// Counts fetches and how many ran at once.
    private actor FetchRecorder {
        private(set) var count = 0
        private(set) var active = 0
        private(set) var maxActive = 0

        func begin() {
            count += 1
            active += 1
            maxActive = max(maxActive, active)
        }

        func end() {
            active -= 1
        }
    }

    private struct FetchFailed: Error {}

    private static func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appending(path: "CoverPipelineTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    }

    /// A 600×900 PNG — the 2:3 of a real cover, larger than any bucket below
    /// the top one so downsampling has work to do.
    private static let sampleCoverData: Data = {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 600, height: 900), format: format)
        return renderer.pngData { context in
            UIColor.systemTeal.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 600, height: 900))
        }
    }()

    private static func cache(
        directory: URL = temporaryDirectory(),
        recorder: FetchRecorder,
        delay: Duration = .zero,
        data: Data? = sampleCoverData
    ) -> CoverThumbnailCache {
        CoverThumbnailCache(directory: directory) { _ in
            await recorder.begin()
            if delay > .zero { try await Task.sleep(for: delay) }
            await recorder.end()
            guard let data else { throw FetchFailed() }
            return data
        }
    }

    private static let coverURL = URL(string: "https://covers.example/book.jpg")!

    // MARK: Keys

    @Test(arguments: [
        (CGFloat(1), 128), (128, 128), (129, 256), (300, 512), (1024, 1024), (4000, 1024),
    ])
    func sizesRoundUpToABucket(pixels: CGFloat, bucket: Int) {
        #expect(CoverKey.bucket(forPixels: pixels) == bucket)
    }

    @Test func keyFromPointsAppliesTheScreenScale() {
        // 96×144pt card on a 3x screen: 432px tall → the 512 bucket.
        let key = CoverKey(source: .remote(Self.coverURL), longEdgePoints: 144, scale: 3)
        #expect(key.maxPixel == 512)
    }

    @Test func fileNamesAreStableAndDistinguishEverythingInTheKey() {
        let remote = CoverKey(source: .remote(Self.coverURL), maxPixel: 256)
        let sameRemote = CoverKey(source: .remote(Self.coverURL), maxPixel: 256)
        let biggerRemote = CoverKey(source: .remote(Self.coverURL), maxPixel: 512)
        let generated = CoverKey(source: .generated(.study, title: "선형대수"), maxPixel: 256)
        let renamed = CoverKey(source: .generated(.study, title: "미적분"), maxPixel: 256)
        let otherCategory = CoverKey(source: .generated(.reading, title: "선형대수"), maxPixel: 256)

        #expect(remote.fileStem == sameRemote.fileStem)
        let stems = [remote, biggerRemote, generated, renamed, otherCategory].map(\.fileStem)
        #expect(Set(stems).count == stems.count)
        #expect(remote.fileStem.hasSuffix("-256"))
    }

    // MARK: Remote covers

    @Test func downsamplesToTheBucketOnTheLongEdge() async throws {
        let image = try #require(await CoverThumbnailCache.downsample(Self.sampleCoverData, maxPixel: 256))
        let cgImage = try #require(image.cgImage)
        #expect(cgImage.height == 256)
        #expect(cgImage.width == 171)
    }

    @Test func aLoadedCoverIsServedFromMemoryThenFromDisk() async throws {
        let directory = Self.temporaryDirectory()
        let recorder = FetchRecorder()
        let cache = Self.cache(directory: directory, recorder: recorder)

        let first = await cache.image(for: Self.coverURL, maxPixel: 256)
        #expect(first != nil)
        let key = CoverKey(source: .remote(Self.coverURL), maxPixel: 256)
        #expect(cache.memory.image(for: key) != nil)
        await cache.flushDiskWrites()

        // JPEG on disk — HEIC hangs the simulator's HEVC codec.
        let written = try Data(contentsOf: directory.appending(path: key.fileName))
        let source = try #require(CGImageSourceCreateWithData(written as CFData, nil))
        #expect(CGImageSourceGetType(source) as String? == UTType.jpeg.identifier)

        // A fresh cache over the same directory — as after a relaunch — with
        // a network that would fail if asked.
        let offline = FetchRecorder()
        let relaunched = Self.cache(directory: directory, recorder: offline, data: nil)
        let fromDisk = try #require(await relaunched.image(for: Self.coverURL, maxPixel: 256))
        #expect(fromDisk.cgImage?.height == 256)
        #expect(await offline.count == 0)
        #expect(await recorder.count == 1)
    }

    @Test func concurrentRequestsForOneURLShareOneDownload() async {
        let recorder = FetchRecorder()
        let cache = Self.cache(recorder: recorder, delay: .milliseconds(100))

        async let small = cache.image(for: Self.coverURL, maxPixel: 128)
        async let large = cache.image(for: Self.coverURL, maxPixel: 512)
        async let smallAgain = cache.image(for: Self.coverURL, maxPixel: 128)
        let results = await [small, large, smallAgain]

        #expect(results.allSatisfy { $0 != nil })
        #expect(await recorder.count == 1)
        #expect(results[1]?.cgImage?.height == 512)
    }

    /// Regression: an encoder that never returns (the generic iOS 27.2
    /// simulator's HEVC encoder) used to hold every cover off screen, because
    /// a cover was only handed back once it was on disk.
    @Test func aStuckDiskWriteDoesNotHoldBackTheCover() async throws {
        let recorder = FetchRecorder()
        let cache = Self.cache(recorder: recorder)
        let gate = DispatchSemaphore(value: 0)
        cache.diskQueue.async { gate.wait() }
        defer { gate.signal() }

        let image = try #require(await cache.image(for: Self.coverURL, maxPixel: 256))
        #expect(image.cgImage?.height == 256)
    }

    @Test func aFailedURLIsNotRetriedThisSession() async {
        let recorder = FetchRecorder()
        let cache = Self.cache(recorder: recorder, data: nil)

        #expect(await cache.image(for: Self.coverURL, maxPixel: 256) == nil)
        #expect(await cache.image(for: Self.coverURL, maxPixel: 512) == nil)
        #expect(await cache.hasFailed(Self.coverURL))
        #expect(await recorder.count == 1)
    }

    @Test func undecodableDataCountsAsAFailure() async {
        let recorder = FetchRecorder()
        let cache = Self.cache(recorder: recorder, data: Data("<html>not an image</html>".utf8))

        #expect(await cache.image(for: Self.coverURL, maxPixel: 256) == nil)
        #expect(await cache.hasFailed(Self.coverURL))
    }

    @Test func noMoreThanFourDownloadsRunAtOnce() async {
        let recorder = FetchRecorder()
        let cache = Self.cache(recorder: recorder, delay: .milliseconds(80))
        let urls = (0..<10).map { URL(string: "https://covers.example/\($0).jpg")! }

        await withTaskGroup(of: Void.self) { group in
            for url in urls {
                group.addTask { _ = await cache.image(for: url, maxPixel: 128) }
            }
        }

        #expect(await recorder.count == 10)
        #expect(await recorder.maxActive == 4)
    }

    // MARK: Generated covers

    @Test @MainActor func generatedCoversRenderAtTheBucketSize() throws {
        let image = try #require(GeneratedCover.render(accent: .study, title: "선형대수", maxPixel: 512))
        let cgImage = try #require(image.cgImage)
        #expect(cgImage.height == 512)
        #expect(cgImage.width == 341)
    }

    @Test @MainActor func generatedCoversRenderWithoutATitle() throws {
        let image = try #require(GeneratedCover.render(accent: .game, title: nil, maxPixel: 256))
        #expect(image.cgImage?.height == 256)
    }

    @Test @MainActor func aGeneratedCoverIsRenderedOnceAndThenCached() async throws {
        let directory = Self.temporaryDirectory()
        let cache = Self.cache(directory: directory, recorder: FetchRecorder())
        let key = CoverKey(source: .generated(.study, title: "선형대수"), maxPixel: 256)

        let first = try #require(await GeneratedCover.image(for: key, cache: cache))
        let second = try #require(await GeneratedCover.image(for: key, cache: cache))
        #expect(first === second)
        await cache.flushDiskWrites()

        let relaunched = Self.cache(directory: directory, recorder: FetchRecorder())
        let fromDisk = await relaunched.storedGeneratedImage(for: key)
        #expect(fromDisk?.cgImage?.height == 256)
    }

    @Test(arguments: PrismAccent.allCases) @MainActor
    func generatedLetteringPicksTheMoreLegibleInk(accent: PrismAccent) {
        let environment = EnvironmentValues()
        let tone = GeneratedCover.relativeLuminance(accent.tone.main.resolve(in: environment))
        let ink = GeneratedCover.relativeLuminance(GeneratedCover.ink(on: accent.tone.main).resolve(in: environment))
        let other = ink > 0.5
            ? GeneratedCover.relativeLuminance(PrismColor.background.resolve(in: environment))
            : 1
        #expect(GeneratedCover.contrast(tone, ink) >= GeneratedCover.contrast(tone, other))
    }

    @Test @MainActor func studyYellowGetsDarkLettering() {
        #expect(GeneratedCover.ink(on: PrismAccent.study.tone.main) == PrismColor.background)
    }

    @Test @MainActor func aRemoteKeyIsNotAGeneratedCover() async {
        let key = CoverKey(source: .remote(Self.coverURL), maxPixel: 256)
        let cache = Self.cache(recorder: FetchRecorder())
        #expect(await GeneratedCover.image(for: key, cache: cache) == nil)
    }
}

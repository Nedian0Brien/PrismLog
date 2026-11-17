import CryptoKit
import Foundation
import ImageIO
import UIKit
import UniformTypeIdentifiers

/// Identifies one decoded cover at one size.
///
/// Sizes are bucketed so a cover laid out at 88pt and at 96pt shares one
/// entry instead of filling the cache with near-duplicates.
struct CoverKey: Hashable, Sendable {
    enum Source: Hashable, Sendable {
        case remote(URL)
        /// A typographic cover for a record with no artwork. The title is
        /// part of the key, so renaming a record yields a new cover.
        case generated(PrismAccent, title: String?)
    }

    let source: Source
    /// Longest edge, in pixels. Always one of `CoverKey.pixelBuckets`.
    let maxPixel: Int

    static let pixelBuckets = [128, 256, 512, 1024]

    /// Bump when `GeneratedCover`'s look changes, so covers rendered by an
    /// older build are redrawn instead of read back from disk.
    static let generatedDesignVersion = 1

    /// The smallest bucket that covers `pixels`, capped at the largest — no
    /// cover in the app is drawn bigger than 1024px on its long edge.
    static func bucket(forPixels pixels: CGFloat) -> Int {
        let needed = Int(pixels.rounded(.up))
        return pixelBuckets.first { $0 >= needed } ?? pixelBuckets[pixelBuckets.count - 1]
    }

    init(source: Source, maxPixel: Int) {
        self.source = source
        self.maxPixel = maxPixel
    }

    /// Key for a cover drawn `points` tall on its long edge at `scale`.
    init(source: Source, longEdgePoints points: CGFloat, scale: CGFloat) {
        self.init(source: source, maxPixel: Self.bucket(forPixels: points * scale))
    }

    /// Stable across launches — `hashValue` is seeded per process, so it
    /// can't name a file on disk.
    var fileStem: String {
        let identity: String = switch source {
        case .remote(let url): "remote|\(url.absoluteString)"
        case .generated(let accent, let title):
            "generated|v\(Self.generatedDesignVersion)|\(accent.rawValue)|\(title ?? "")"
        }
        let digest = SHA256.hash(data: Data(identity.utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return "\(hex)-\(maxPixel)"
    }

    /// The cover's file in the disk cache. The extension doubles as a format
    /// version: covers written as HEIC by earlier builds had none, so they
    /// are never read back.
    var fileName: String { "\(fileStem).jpg" }
}

/// `NSCache` is documented as thread-safe, so views can read it synchronously
/// while the actor fills it. That synchronous read is what lets a cached
/// cover appear in the first frame instead of after an actor hop.
final class CoverMemoryCache: @unchecked Sendable {
    private let storage = NSCache<NSString, UIImage>()

    init(totalCostLimit: Int) {
        storage.totalCostLimit = totalCostLimit
    }

    func image(for key: CoverKey) -> UIImage? {
        storage.object(forKey: key.fileStem as NSString)
    }

    func insert(_ image: UIImage, for key: CoverKey) {
        storage.setObject(image, forKey: key.fileStem as NSString, cost: Self.cost(of: image))
    }

    /// Decoded bytes, which is what the limit is meant to bound.
    private static func cost(of image: UIImage) -> Int {
        guard let cgImage = image.cgImage else { return 0 }
        return cgImage.bytesPerRow * cgImage.height
    }
}

/// Downloads, downsamples, and caches cover art (spec §4.2).
///
/// Every cover in the app — list cards, the detail hero, and the library
/// wall — comes out of here already decoded at the size it's drawn, so
/// scrolling never pays for a JPEG decode.
actor CoverThumbnailCache {
    typealias Fetch = @Sendable (URL) async throws -> Data

    static let shared = CoverThumbnailCache()

    /// Decoded covers, readable without awaiting the actor.
    nonisolated let memory: CoverMemoryCache

    private let directory: URL
    private let fetch: Fetch
    private let maxConcurrentDownloads: Int

    /// Disk writes run here, off Swift's cooperative pool and never awaited
    /// by a caller. Encoding can block a thread for as long as the encoder
    /// likes — on the generic iOS 27.2 simulator runtime the HEVC encoder
    /// never returns — and a cover in memory is already good enough to show.
    nonisolated let diskQueue = DispatchQueue(label: "kr.lawdigest.prismlog.covers.disk", qos: .utility)

    private var inFlight: [CoverKey: Task<UIImage?, Never>] = [:]
    private var downloads: [URL: Task<Data, Error>] = [:]
    /// URLs that failed once this session. Retrying a dead link on every
    /// appearance would keep the network busy for a cover we'll never get.
    private var failedURLs: Set<URL> = []

    private var activeDownloads = 0
    private var downloadWaiters: [CheckedContinuation<Void, Never>] = []

    init(
        directory: URL = CoverThumbnailCache.defaultDirectory,
        memoryLimitBytes: Int = 80 * 1024 * 1024,
        maxConcurrentDownloads: Int = 4,
        fetch: @escaping Fetch = CoverThumbnailCache.urlSessionFetch
    ) {
        self.directory = directory
        self.memory = CoverMemoryCache(totalCostLimit: memoryLimitBytes)
        self.maxConcurrentDownloads = maxConcurrentDownloads
        self.fetch = fetch
    }

    static var defaultDirectory: URL {
        URL.cachesDirectory.appending(path: "covers", directoryHint: .isDirectory)
    }

    static let urlSessionFetch: Fetch = { url in
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        return data
    }

    // MARK: Remote covers

    /// The cover at `url`, decoded to fit `maxPixel`. `nil` means it can't be
    /// had this session; callers fall back to a generated cover.
    func image(for url: URL, maxPixel: Int) async -> UIImage? {
        let key = CoverKey(source: .remote(url), maxPixel: maxPixel)
        if let cached = memory.image(for: key) { return cached }
        if failedURLs.contains(url) { return nil }
        if let pending = inFlight[key] { return await pending.value }

        let task = Task { await loadRemote(url, key: key) }
        inFlight[key] = task
        let image = await task.value
        inFlight[key] = nil
        return image
    }

    func hasFailed(_ url: URL) -> Bool {
        failedURLs.contains(url)
    }

    private func loadRemote(_ url: URL, key: CoverKey) async -> UIImage? {
        let fileURL = directory.appending(path: key.fileName)
        if let image = await Self.readDisk(at: fileURL) {
            memory.insert(image, for: key)
            return image
        }

        let data: Data
        do {
            data = try await download(url)
        } catch {
            failedURLs.insert(url)
            return nil
        }

        guard let image = await Self.downsample(data, maxPixel: key.maxPixel) else {
            failedURLs.insert(url)
            return nil
        }
        memory.insert(image, for: key)
        persist(image, to: fileURL)
        return image
    }

    /// One download per URL, however many sizes ask for it at once.
    private func download(_ url: URL) async throws -> Data {
        if let pending = downloads[url] { return try await pending.value }

        let task = Task<Data, Error> {
            await acquireDownloadSlot()
            defer { releaseDownloadSlot() }
            return try await fetch(url)
        }
        downloads[url] = task
        defer { downloads[url] = nil }
        return try await task.value
    }

    private func acquireDownloadSlot() async {
        if activeDownloads < maxConcurrentDownloads {
            activeDownloads += 1
            return
        }
        // The releasing task hands its slot straight to us, so the count
        // stays put across the handoff.
        await withCheckedContinuation { downloadWaiters.append($0) }
    }

    private func releaseDownloadSlot() {
        if downloadWaiters.isEmpty {
            activeDownloads -= 1
        } else {
            downloadWaiters.removeFirst().resume()
        }
    }

    // MARK: Generated covers

    /// A generated cover from memory or disk, if one was rendered before.
    func storedGeneratedImage(for key: CoverKey) async -> UIImage? {
        if let cached = memory.image(for: key) { return cached }
        guard let image = await Self.readDisk(at: directory.appending(path: key.fileName)) else {
            return nil
        }
        memory.insert(image, for: key)
        return image
    }

    func storeGeneratedImage(_ image: UIImage, for key: CoverKey) {
        memory.insert(image, for: key)
        persist(image, to: directory.appending(path: key.fileName))
    }

    /// Returns once every write queued so far has finished.
    nonisolated func flushDiskWrites() async {
        await withCheckedContinuation { continuation in
            diskQueue.async { continuation.resume() }
        }
    }

    private nonisolated func persist(_ image: UIImage, to fileURL: URL) {
        let directory = directory
        diskQueue.async {
            Self.writeDisk(image, to: fileURL, directory: directory)
        }
    }

    // MARK: Decoding and disk
    //
    // Nonisolated async, so ImageIO work runs on the global executor rather
    // than serializing every decode behind the actor.

    /// Decodes straight to the target size. ImageIO never inflates the full
    /// image, which is the point: a 3000px poster costs 1024px of memory.
    nonisolated static func downsample(_ data: Data, maxPixel: Int) async -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else {
            return nil
        }
        let thumbnailOptions = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ] as CFDictionary
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }

    nonisolated private static func readDisk(at fileURL: URL) async -> UIImage? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        // Already at its cached size; this only decodes it.
        let options = [kCGImageSourceShouldCacheImmediately: true] as CFDictionary
        guard
            let source = CGImageSourceCreateWithData(data as CFData, nil),
            let cgImage = CGImageSourceCreateImageAtIndex(source, 0, options)
        else { return nil }
        return UIImage(cgImage: cgImage)
    }

    /// JPEG rather than HEIC. HEIC goes through the HEVC codec, and on the
    /// generic iOS 27.2 simulator runtime that codec never returns from
    /// either encode or decode — a dozen concurrent cover reads parked every
    /// thread in Swift's cooperative pool and froze all async work in the
    /// app. JPEG costs about 1.6× the disk (57KB vs 36KB for a 341×512
    /// cover), which `Caches` can afford.
    nonisolated private static func writeDisk(_ image: UIImage, to fileURL: URL, directory: URL) {
        guard let cgImage = image.cgImage else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        guard let destination = CGImageDestinationCreateWithURL(
            fileURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil
        ) else { return }
        let options = [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary
        CGImageDestinationAddImage(destination, cgImage, options)
        CGImageDestinationFinalize(destination)
    }
}

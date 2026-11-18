import SwiftUI
import UIKit

/// How the background behind every screen is drawn — two directions to
/// choose between, with the Phase 2 cover wall kept as the baseline.
enum WallStyle: String, CaseIterable, Identifiable {
    /// Covers drifting in rows (Phase 2, D2 layout A). Busy under glass.
    case covers
    /// Direction 1: one cover, large and still, fading into a darkness
    /// tinted with its own colour.
    case featured
    /// Direction 2: a slow mesh of light — the categories' spectrum on the
    /// library, a record's own colours on its detail.
    case spectrum

    static let storageKey = "wall.style"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .covers: "표지 벽"
        case .featured: "표지 히어로"
        case .spectrum: "스펙트럼 빛"
        }
    }

    /// Black over the background, top and bottom, before the user's
    /// brightness setting. The two new styles darken their own colours, so
    /// they need far less on top.
    var baseDimming: (top: Double, bottom: Double) {
        switch self {
        case .covers: (0.55, 0.70)
        case .featured: (0.56, 0.64)
        case .spectrum: (0.20, 0.38)
        }
    }

    /// Only the cover wall's artwork needs taming; the others are tuned.
    var saturation: Double { self == .covers ? 0.85 : 1 }
}

// MARK: - Direction 1: featured cover

/// The current context's cover as a backdrop: full-bleed, still, softened
/// so its own type doesn't compete with the screen's, and sinking into a
/// dark wash of its own colour toward the content below.
///
/// Library: the first record in progress, the same as the first lens card. A shelf: that category's
/// latest. A record: itself. Changing context cross-fades.
struct FeaturedCoverBackdrop: View {
    let cover: WallCover?
    /// The wall's small decode, shown until the full-width one is ready.
    let preview: UIImage?
    let swatches: [CoverPalette.Swatch]
    let parallax: Double

    @State private var full: (id: WallCover.ID, image: UIImage)?
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let tint = swatches.first ?? cover?.accent.swatch ?? PrismAccent.reading.swatch

            ZStack(alignment: .top) {
                LinearGradient(
                    stops: [
                        .init(color: tint.color(brightness: 0.30), location: 0),
                        .init(color: tint.color(brightness: 0.16, saturation: 0.3...0.6), location: 0.55),
                        .init(color: PrismColor.background, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )

                if let image = displayed {
                    // Blurred enough that a cover's own type stops competing
                    // with the screen's, not so much that its shapes go.
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: size.width, height: size.height)
                        .scaleEffect(1.2)
                        .blur(radius: 12, opaque: true)
                        .clipped()
                        .overlay {
                            LinearGradient(
                                stops: [
                                    .init(color: tint.color(brightness: 0.12).opacity(0.25), location: 0),
                                    .init(color: tint.color(brightness: 0.10).opacity(0.55), location: 0.45),
                                    .init(color: PrismColor.background, location: 1),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        }
                        .offset(y: -CGFloat(parallax) * 0.5)
                        .id(cover?.id)
                        .transition(.opacity)
                }
            }
            .frame(width: size.width, height: size.height)
            .animation(.easeInOut(duration: 0.6), value: cover?.id)
            .task(id: cover?.id) {
                await loadFull(width: size.width)
            }
        }
    }

    private var displayed: UIImage? {
        if let full, full.id == cover?.id { return full.image }
        return preview
    }

    /// The full-width decode: the wall's 256px covers would blur at this size.
    private func loadFull(width: CGFloat) async {
        guard let cover, let url = cover.coverURL else { return }
        let maxPixel = CoverKey.bucket(forPixels: width / GeneratedCover.aspectRatio * displayScale)
        if let image = await CoverThumbnailCache.shared.image(for: url, maxPixel: maxPixel), !Task.isCancelled {
            full = (cover.id, image)
        }
    }
}

// MARK: - Direction 2: spectrum mesh light

/// A slow mesh of coloured light behind everything, after the way Apple
/// Music lights a song with its artwork's colours.
///
/// Two or three related colours at a time, never a rainbow: the colours of
/// the record in focus — the one in progress on the library, the latest on
/// a shelf, the record itself on its detail — then its category's.
/// Brightness falls toward the bottom, where the content is densest.
struct SpectrumMeshLight: View {
    /// One swatch per column, left to right.
    let columns: [CoverPalette.Swatch]
    let elapsed: TimeInterval
    let parallax: Double

    static let size = 4
    /// Row brightness, top to bottom.
    static let rowBrightness: [Double] = [0.56, 0.44, 0.30, 0.17]

    var body: some View {
        mesh
            // Darker corners frame the light and keep it off the edges.
            .overlay {
                RadialGradient(
                    colors: [.clear, .black.opacity(0.35)],
                    center: .center,
                    startRadius: 120,
                    endRadius: 620
                )
            }
    }

    private var mesh: some View {
        MeshGradient(
            width: Self.size,
            height: Self.size,
            points: Self.points(elapsed: elapsed, parallax: parallax),
            colors: Self.colors(columns: columns),
            background: PrismColor.background,
            smoothsColors: true,
            colorSpace: .perceptual
        )
    }

    static func colors(columns: [CoverPalette.Swatch]) -> [Color] {
        guard !columns.isEmpty else { return Array(repeating: PrismColor.background, count: size * size) }
        return (0..<size).flatMap { row in
            (0..<size).map { column in
                // Each row reads its column one step along, so colour
                // doesn't run in vertical stripes.
                let swatch = columns[(column + row) % columns.count]
                return swatch.color(brightness: rowBrightness[row], saturation: 0.35...0.66)
            }
        }
    }

    /// Interior points wander on 18–30 s loops; edge points slide only
    /// along their edge, so the mesh always covers the screen.
    static func points(elapsed: TimeInterval, parallax: Double) -> [SIMD2<Float>] {
        let last = size - 1
        let lift = min(max(parallax / 2_000, 0), 0.15)
        return (0..<size).flatMap { row in
            (0..<size).map { column in
                let x = Double(column) / Double(last)
                let y = Double(row) / Double(last)
                let seed = Double(row * size + column)
                let period = 18 + (seed * 7).truncatingRemainder(dividingBy: 12)
                let angle = elapsed / period * 2 * .pi + seed
                let interiorColumn = column > 0 && column < last
                let interiorRow = row > 0 && row < last
                let dx = interiorColumn ? cos(angle) * 0.07 : 0
                let dy = interiorRow ? sin(angle * 1.3) * 0.07 - lift : 0
                return SIMD2(Float(x + dx), Float(y + dy))
            }
        }
    }

    /// Prism order, so the library's mesh spreads like light through a prism.
    static let prismOrder: [PrismAccent] = [.movie, .series, .study, .reading, .game]

    /// Four columns sampled along the categories present, each category's
    /// stretch as long as its share of covers.
    static func spectrumColumns(for covers: [WallCover]) -> [CoverPalette.Swatch] {
        let counts = prismOrder.map { accent in (accent, covers.filter { $0.accent == accent }.count) }
            .filter { $0.1 > 0 }
        let total = Double(counts.reduce(0) { $0 + $1.1 })
        guard total > 0 else { return [] }
        return (0..<size).map { column in
            let position = (Double(column) + 0.5) / Double(size)
            var cumulative = 0.0
            for (accent, count) in counts {
                cumulative += Double(count) / total
                if position <= cumulative { return accent.swatch }
            }
            return counts[counts.count - 1].0.swatch
        }
    }

    /// A record's or a shelf's columns: its covers' colours, then the
    /// category's, so a grey cover still glows in its category.
    static func paletteColumns(
        covers: [WallCover],
        palettes: [WallCover.ID: [CoverPalette.Swatch]]
    ) -> [CoverPalette.Swatch] {
        var swatches: [CoverPalette.Swatch] = []
        for cover in covers.prefix(3) {
            swatches += palettes[cover.id] ?? []
        }
        if let accent = covers.first?.accent { swatches.append(accent.swatch) }
        return Array(swatches.prefix(size))
    }
}

// MARK: - Grain

/// Fine noise over the light, so smooth gradients don't band into steps on
/// an 8-bit display. Generated once and tiled.
struct WallGrain: View {
    static let tile: UIImage = {
        let side = 96
        var generator = SeededGenerator(seed: 0x6A1E)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { context in
            for y in 0..<side {
                for x in 0..<side {
                    let value = CGFloat(Double.random(in: 0...1, using: &generator))
                    UIColor(white: value, alpha: 1).setFill()
                    context.fill(CGRect(x: x, y: y, width: 1, height: 1))
                }
            }
        }
    }()

    var body: some View {
        Image(uiImage: Self.tile)
            .resizable(resizingMode: .tile)
            .opacity(0.05)
            .blendMode(.overlay)
            .allowsHitTesting(false)
    }
}

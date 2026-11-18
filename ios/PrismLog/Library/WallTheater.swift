import SwiftUI
import UIKit

/// The wall as a dark theater lobby: posters hang in deep darkness and each
/// one spills its own light around it (2026-11-19).
enum WallTheater {
    /// Darker than the app's background, so the posters' light has
    /// somewhere to fall.
    static let darkness = Color(hex: 0x080706)
    static let glowRadius: CGFloat = 16
    static let glowOpacity = 0.85
    /// Dimming while the library is pulled down and the posters are the
    /// point.
    static let revealedDimming = 0.12
}

/// The library's "now in progress" covers, one large poster per card,
/// following the carousel: swiping the cards slides the posters with them.
/// They arrive from the right as the wall's rows rush off.
struct FeaturedPosters: View {
    let covers: [WallCover]
    /// The wall's small decodes, shown until the large ones are ready.
    let previews: [WallCover.ID: UIImage]
    /// The carousel's page, fractional while it scrolls.
    let position: Double
    /// 0 off to the right, 1 in place.
    let entrance: Double

    @State private var full: [WallCover.ID: UIImage] = [:]
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let width = min(size.width * 0.64, 360)
            let height = width / GeneratedCover.aspectRatio
            let pitch = Double(width) + 56
            let arrived = 1 - pow(1 - entrance, 3)
            let shift = (1 - arrived) * Double(size.width / 2 + width)

            ZStack {
                ForEach(Array(covers.enumerated()), id: \.element.id) { index, cover in
                    let x = (Double(index) - position) * pitch + shift
                    if abs(x) < Double(size.width + width) {
                        TheaterPoster(
                            image: full[cover.id] ?? previews[cover.id],
                            accent: cover.accent,
                            width: width,
                            height: height
                        )
                        .position(x: size.width / 2 + CGFloat(x), y: size.height * 0.42)
                    }
                }
            }
            .frame(width: size.width, height: size.height)
            .task(id: covers.map(\.id)) {
                await load(maxPixel: CoverKey.bucket(forPixels: height * displayScale))
            }
        }
    }

    /// Large decodes: the wall's 256px covers would blur at this size.
    private func load(maxPixel: Int) async {
        for cover in covers where full[cover.id] == nil {
            let image: UIImage?
            switch cover.source {
            case .remote(let url):
                image = await CoverThumbnailCache.shared.image(for: url, maxPixel: maxPixel)
            case .generated:
                image = await GeneratedCover.image(
                    for: CoverKey(source: cover.source, maxPixel: maxPixel),
                    cache: .shared
                )
            }
            guard !Task.isCancelled else { return }
            if let image { full[cover.id] = image }
        }
    }
}

/// One poster, lit from behind: its own colours, blurred wide, glow into
/// the dark around it.
struct TheaterPoster: View {
    let image: UIImage?
    let accent: PrismAccent
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        ZStack {
            artwork
                .frame(width: width, height: height)
                .scaleEffect(1.12)
                .blur(radius: 42)
                .saturation(1.5)
                .opacity(0.9)

            artwork
                .frame(width: width, height: height)
                .clipShape(.rect(cornerRadius: 6, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(.white.opacity(0.08), lineWidth: 1)
                }
        }
    }

    @ViewBuilder
    private var artwork: some View {
        if let image {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            accent.tone.main.opacity(0.35)
        }
    }
}

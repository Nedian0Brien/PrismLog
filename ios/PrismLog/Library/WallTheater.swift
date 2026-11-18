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

/// The library's "now in progress" covers, one large poster per lens card,
/// hung in the band between the top bar and the lowered pager. They follow
/// the pager one to one: dragging onto a lens card brings its poster in
/// from the right edge.
struct FeaturedPosters: View {
    let covers: [WallCover]
    /// The wall's small decodes, shown until the large ones are ready.
    let previews: [WallCover.ID: UIImage]
    /// Which poster is centred, fractional mid-swipe: 0 is the first, −1
    /// puts it a page to the right.
    let position: Double
    /// The band, in screen points, the poster may fill.
    let area: ClosedRange<CGFloat>?
    /// Opens a poster's record, while the library is pulled down.
    var onSelect: ((WallCover) -> Void)?

    @State private var full: [WallCover.ID: UIImage] = [:]
    @Environment(\.displayScale) private var displayScale

    /// The poster fills this share of its band's height.
    static let fill: CGFloat = 0.86

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let band = area ?? (size.height * 0.08)...(size.height * 0.62)
            let height = min(
                (band.upperBound - band.lowerBound) * Self.fill,
                size.width * 0.7 / GeneratedCover.aspectRatio
            )
            let width = height * GeneratedCover.aspectRatio
            let centre = (band.lowerBound + band.upperBound) / 2

            ZStack {
                ForEach(Array(covers.enumerated()), id: \.element.id) { index, cover in
                    // A page of the pager moves the poster a screen width.
                    let x = (Double(index) - position) * Double(size.width)
                    if abs(x) < Double(size.width + width) {
                        TheaterPoster(
                            image: full[cover.id] ?? previews[cover.id],
                            accent: cover.accent,
                            width: width,
                            height: height
                        )
                        .onTapGesture { onSelect?(cover) }
                        .position(x: size.width / 2 + CGFloat(x), y: centre)
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

/// One poster under a spotlight: a soft beam falls on it from above, its
/// top catches the light, and a faint reflection lies on the floor below.
struct TheaterPoster: View {
    let image: UIImage?
    let accent: PrismAccent
    let width: CGFloat
    let height: CGFloat

    static let corner: CGFloat = 6
    /// Gap between the poster and its reflection.
    static let floorGap: CGFloat = 10

    var body: some View {
        poster
            .background(alignment: .top) { beam }
            .overlay(alignment: .bottom) { reflection }
    }

    private var poster: some View {
        artwork
            .frame(width: width, height: height)
            .clipShape(.rect(cornerRadius: Self.corner, style: .continuous))
            // Lit from above: the top catches the beam, the foot falls
            // into shadow.
            .overlay {
                LinearGradient(
                    stops: [
                        .init(color: .white.opacity(0.10), location: 0),
                        .init(color: .clear, location: 0.35),
                        .init(color: .black.opacity(0.28), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .clipShape(.rect(cornerRadius: Self.corner, style: .continuous))
            }
            .overlay {
                RoundedRectangle(cornerRadius: Self.corner, style: .continuous)
                    .strokeBorder(.white.opacity(0.08), lineWidth: 1)
            }
    }

    /// Warm light from above: a beam that widens down onto the poster and
    /// a pool on the wall behind it, so even a white cover reads as lit.
    private var beam: some View {
        let light = Color(hex: 0xFFF1D6)
        return ZStack(alignment: .top) {
            // The pool: brightest just above the poster's top edge, clear at
            // every edge of its frame so no line shows where it ends.
            EllipticalGradient(
                colors: [light.opacity(0.30), light.opacity(0.10), .clear],
                center: .center,
                startRadiusFraction: 0,
                endRadiusFraction: 0.5
            )
            .frame(width: width * 2.4, height: height * 1.3)
            .offset(y: -height * 0.7)

            // The beam: a narrow cone from above the frame.
            LinearGradient(
                colors: [light.opacity(0.18), light.opacity(0.04), .clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(width: width * 1.5, height: height * 0.9)
            .mask {
                BeamShape(topWidth: 0.35)
            }
            .offset(y: -height * 0.55)
        }
        .frame(width: width)
        .allowsHitTesting(false)
    }

    /// The poster upside down on a dark floor, fading out within a third of
    /// its height.
    private var reflection: some View {
        artwork
            .frame(width: width, height: height)
            .clipShape(.rect(cornerRadius: Self.corner, style: .continuous))
            .scaleEffect(x: 1, y: -1)
            .mask {
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.22), location: 0),
                        .init(color: .clear, location: 0.32),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .offset(y: height + Self.floorGap)
            .allowsHitTesting(false)
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

/// A trapezoid narrow at the top: a light beam's cross-section.
private struct BeamShape: Shape {
    /// The top edge's width as a share of the bottom's.
    let topWidth: CGFloat

    func path(in rect: CGRect) -> Path {
        let inset = rect.width * (1 - topWidth) / 2
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + inset, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - inset, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

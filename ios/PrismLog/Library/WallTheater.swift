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
    /// How far the covers around the stage step back.
    static let stageDimming = 0.22
    static let stageBlur: CGFloat = 1.5
    /// Covers from outside a sparse context, filling the wall behind it.
    static let fillerDimming = 0.4
    static let fillerSaturation = 0.35
}

/// A "now in progress" cover on the library's stage: it rises out of its
/// row (`from`) to hang large in the middle (`to`) under a small picture
/// light, and sinks back the same way.
struct HeroPoster: View {
    let cover: WallCover
    /// The wall's small decode, shown until the large one is ready.
    let preview: UIImage?
    let from: CGRect
    let to: CGRect
    /// 0 in its row, 1 on stage.
    let growth: Double
    let startCorner: CGFloat
    /// Opens the cover's record, while the library is pulled down.
    var onSelect: ((WallCover) -> Void)?

    @State private var full: (id: WallCover.ID, image: UIImage)?
    @Environment(\.displayScale) private var displayScale

    static let corner: CGFloat = 6
    private static let warm = Color(hex: 0xFFE9C7)

    var body: some View {
        let g = CGFloat(growth)
        let rect = CGRect(
            x: from.minX + (to.minX - from.minX) * g,
            y: from.minY + (to.minY - from.minY) * g,
            width: from.width + (to.width - from.width) * g,
            height: from.height + (to.height - from.height) * g
        )
        let corner = startCorner + (Self.corner - startCorner) * g

        ZStack(alignment: .topLeading) {
            Color.clear

            // Light thrown on the wall around the poster's top edge.
            EllipticalGradient(
                colors: [Self.warm.opacity(0.16), .clear],
                center: .center,
                startRadiusFraction: 0,
                endRadiusFraction: 0.5
            )
            .frame(width: rect.width * 1.9, height: rect.height * 0.7)
            .position(x: rect.midX, y: rect.minY + rect.height * 0.05)
            .opacity(Double(g))

            artwork
                .frame(width: rect.width, height: rect.height)
                .clipShape(.rect(cornerRadius: corner, style: .continuous))
                // The lamp's light falls off down the poster.
                .overlay {
                    LinearGradient(
                        stops: [
                            .init(color: Self.warm.opacity(0.18), location: 0),
                            .init(color: .clear, location: 0.4),
                            .init(color: .black.opacity(0.22), location: 1),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .clipShape(.rect(cornerRadius: corner, style: .continuous))
                    .opacity(Double(g))
                }
                .shadow(color: .black.opacity(0.6 * Double(g)), radius: 26 * g, y: 18 * g)
                .contentShape(.rect)
                .onTapGesture { if growth > 0.95 { onSelect?(cover) } }
                .position(x: rect.midX, y: rect.midY)

            // The picture light itself: a short warm bar above the frame.
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [Self.warm.opacity(0.35), Self.warm, Self.warm.opacity(0.35)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: rect.width * 0.36, height: 4)
                .shadow(color: Self.warm.opacity(0.7), radius: 8)
                .position(x: rect.midX, y: rect.minY - 14)
                .opacity(Double(max(0, g - 0.4) / 0.6))
        }
        .task(id: cover.id) {
            await load(maxPixel: CoverKey.bucket(forPixels: to.height * displayScale))
        }
    }

    @ViewBuilder
    private var artwork: some View {
        if let image = (full?.id == cover.id ? full?.image : nil) ?? preview {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            cover.accent.tone.main.opacity(0.35)
        }
    }

    /// A large decode: the wall's 256px cover would blur at this size.
    private func load(maxPixel: Int) async {
        let image: UIImage?
        switch cover.source {
        case .remote(let url):
            image = await CoverThumbnailCache.shared.image(for: url, maxPixel: maxPixel)
        case .generated:
            image = await GeneratedCover.image(for: CoverKey(source: cover.source, maxPixel: maxPixel), cache: .shared)
        }
        guard !Task.isCancelled, let image else { return }
        full = (cover.id, image)
    }
}

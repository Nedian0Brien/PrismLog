import SwiftUI
import UIKit

/// A typographic cover for records with no artwork — mostly study, which has
/// no catalog to pull a cover from — and for artwork that failed to load
/// (spec §4.1). It's rasterized into the same cache as downloaded covers so
/// the library wall can treat every record as one image.
struct GeneratedCover: View {
    let accent: PrismAccent
    let title: String?

    /// Covers are drawn at the 2:3 of a book jacket or a poster; other frames
    /// crop it the same way they crop real artwork.
    nonisolated static let aspectRatio: CGFloat = 2.0 / 3.0

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let tone = accent.tone
            let ink = Self.ink(on: tone.main)

            ZStack(alignment: .topLeading) {
                LinearGradient(
                    colors: [tone.light, tone.main, tone.main.mix(with: .black, by: 0.2)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                // A band of lighter tone, the way a printed spine catches light.
                Rectangle()
                    .fill(.white.opacity(0.14))
                    .frame(width: width * 0.06)

                VStack(alignment: .leading, spacing: width * 0.04) {
                    Text(accent.label)
                        .font(.custom(PrismFont.Weight.semiBold.rawValue, fixedSize: width * 0.075))
                        .foregroundStyle(ink.opacity(0.75))

                    if let title, !title.isEmpty {
                        Text(title)
                            .font(.custom(PrismFont.Weight.extraBold.rawValue, fixedSize: width * 0.13))
                            .foregroundStyle(ink)
                            .lineLimit(5)
                            .minimumScaleFactor(0.6)
                            .multilineTextAlignment(.leading)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: accent.symbol)
                        .font(.system(size: width * 0.16, weight: .semibold))
                        .foregroundStyle(ink.opacity(0.85))
                }
                .padding(.leading, width * 0.14)
                .padding([.top, .trailing, .bottom], width * 0.09)
            }
        }
        .aspectRatio(Self.aspectRatio, contentMode: .fit)
    }

    /// White or the app's near-black, whichever contrasts more with `tone`.
    /// Most category tones are light enough that white lettering washes out
    /// on them (white on study's yellow is about 1.6:1), so the choice is
    /// measured rather than fixed.
    static func ink(on tone: Color) -> Color {
        let dark = PrismColor.background
        let environment = EnvironmentValues()
        let toneLuminance = relativeLuminance(tone.resolve(in: environment))
        let darkLuminance = relativeLuminance(dark.resolve(in: environment))
        let onWhite = contrast(1, toneLuminance)
        let onDark = contrast(toneLuminance, darkLuminance)
        return onDark > onWhite ? dark : .white
    }

    /// WCAG 2 relative luminance. `Color.Resolved` is already linear.
    static func relativeLuminance(_ color: Color.Resolved) -> Double {
        0.2126 * Double(color.linearRed)
            + 0.7152 * Double(color.linearGreen)
            + 0.0722 * Double(color.linearBlue)
    }

    /// WCAG 2 contrast ratio between two relative luminances.
    static func contrast(_ first: Double, _ second: Double) -> Double {
        (max(first, second) + 0.05) / (min(first, second) + 0.05)
    }

    /// The cover rendered for `key`, from the cache when it was drawn before.
    /// `ImageRenderer` is main-actor bound, so rendering happens here rather
    /// than inside the cache actor.
    @MainActor
    static func image(
        for key: CoverKey,
        cache: CoverThumbnailCache = .shared
    ) async -> UIImage? {
        guard case .generated(let accent, let title) = key.source else { return nil }
        if let stored = await cache.storedGeneratedImage(for: key) { return stored }

        guard let image = render(accent: accent, title: title, maxPixel: key.maxPixel) else {
            return nil
        }
        await cache.storeGeneratedImage(image, for: key)
        return image
    }

    /// Draws at a 1:1 point-to-pixel scale so the long edge lands exactly on
    /// the key's pixel bucket, whatever the screen's scale.
    @MainActor
    static func render(accent: PrismAccent, title: String?, maxPixel: Int) -> UIImage? {
        let height = CGFloat(maxPixel)
        let width = (height * aspectRatio).rounded()
        let renderer = ImageRenderer(
            content: GeneratedCover(accent: accent, title: title)
                .frame(width: width, height: height)
                .environment(\.colorScheme, .dark)
        )
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

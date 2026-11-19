import SwiftUI

/// Book cover / poster art, decoded at the size it's drawn.
///
/// Artwork comes from `CoverThumbnailCache`. A record with no artwork — or
/// whose artwork can't be fetched — gets a `GeneratedCover` from its title,
/// so every record shows a cover rather than a placeholder glyph.
struct CoverImage: View {
    let url: URL?
    let accent: PrismAccent
    /// Lettered onto the generated cover. Pass it wherever the record's title
    /// is at hand; without it the generated cover shows only the category.
    var title: String? = nil
    var cornerRadius: CGFloat = 10

    @Environment(\.displayScale) private var displayScale
    @State private var longEdge: CGFloat = 0
    @State private var loaded: Loaded?

    private struct Request: Hashable {
        let url: URL?
        let accent: PrismAccent
        let title: String?
        let maxPixel: Int

        var generatedKey: CoverKey {
            CoverKey(source: .generated(accent, title: title), maxPixel: maxPixel)
        }

        /// The key the finished cover is most likely cached under.
        var preferredKey: CoverKey {
            guard let url else { return generatedKey }
            return CoverKey(source: .remote(url), maxPixel: maxPixel)
        }
    }

    private struct Loaded {
        let request: Request
        let image: UIImage
    }

    /// `nil` until layout reports a size — a cover can't be decoded for a
    /// frame it doesn't have yet.
    private var request: Request? {
        guard longEdge > 0 else { return nil }
        return Request(
            url: url,
            accent: accent,
            title: title,
            maxPixel: CoverKey.bucket(forPixels: longEdge * displayScale)
        )
    }

    var body: some View {
        let request = request
        let image = displayedImage(for: request)

        Rectangle()
            .fill(Color.white.opacity(0.04))
            .overlay {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .transition(.opacity)
                } else if url != nil, request != nil {
                    ProgressView().controlSize(.small)
                }
            }
            .onGeometryChange(for: CGFloat.self) { geometry in
                max(geometry.size.width, geometry.size.height)
            } action: { newValue in
                longEdge = newValue
            }
            .task(id: request) {
                guard let request else { return }
                await load(request)
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(PrismColor.hairline, lineWidth: 1)
            }
    }

    /// A cover already in memory shows in the first frame, with no fade. While
    /// a larger size loads, the smaller one stays up instead of blanking.
    private func displayedImage(for request: Request?) -> UIImage? {
        if let request {
            if let loaded, loaded.request == request { return loaded.image }
            if let cached = CoverThumbnailCache.shared.memory.image(for: request.preferredKey) {
                return cached
            }
        }
        return loaded?.image
    }

    private func load(_ request: Request) async {
        var image: UIImage?
        if let url = request.url {
            image = await CoverThumbnailCache.shared.image(for: url, maxPixel: request.maxPixel)
        }
        if image == nil {
            image = await GeneratedCover.image(for: request.generatedKey)
        }
        guard let image, !Task.isCancelled else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            loaded = Loaded(request: request, image: image)
        }
    }
}

/// The reading shelf's progress arc: a half donut with the cover nested in its
/// mouth. The web never tints the artwork itself — progress lives in the arc
/// around it. Ported from `HalfDonutChart` (`src/features/prismlog/ui.jsx:27`)
/// as laid out by `ReadingGridCard`
/// (`src/features/prismlog/pages/recordsPage.jsx:3179`).
struct HalfDonutCoverChart: View {
    let url: URL?
    var title: String? = nil
    let progress: Int
    var accent: PrismAccent = .reading

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var swept = false

    /// The web's phone metrics, kept as ratios of its 164pt chart so the
    /// chart can size itself to whatever column width it lands in.
    private static let referenceWidth: CGFloat = 164
    private static let referenceHeight: CGFloat = 138

    private var value: Double { Double(min(max(progress, 0), 100)) / 100 }

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size.width
            let scale = size / Self.referenceWidth

            ZStack(alignment: .top) {
                arc(size: size, lineWidth: 14 * scale)

                CoverImage(url: url, accent: accent, title: title, cornerRadius: 12 * scale)
                    .frame(width: 62 * scale, height: 88 * scale)
                    .shadow(color: .black.opacity(0.25), radius: 9 * scale, y: 8 * scale)
                    .padding(.top, 37 * scale)
            }
            .frame(width: size, alignment: .top)
        }
        .aspectRatio(Self.referenceWidth / Self.referenceHeight, contentMode: .fit)
        .onAppear {
            if reduceMotion {
                swept = true
            } else {
                withAnimation(PrismMotion.meter.delay(0.05)) { swept = true }
            }
        }
        .accessibilityHidden(true)
    }

    /// The web draws the arc left-to-right over the top; SwiftUI's circle
    /// starts at 3 o'clock, so the bottom half gets rotated into place.
    private func arc(size: CGFloat, lineWidth: CGFloat) -> some View {
        ZStack {
            Circle()
                .trim(from: 0, to: 0.5)
                .stroke(
                    Color.white.opacity(0.06),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )

            Circle()
                .trim(from: 0, to: 0.5 * (swept ? value : 0))
                .stroke(
                    accent.color,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .shadow(color: accent.color.opacity(0.45), radius: 6)
        }
        .padding(lineWidth / 2)
        .rotationEffect(.degrees(180))
        .frame(width: size, height: size)
        .frame(height: size / 2 + lineWidth, alignment: .top)
    }
}

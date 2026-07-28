import SwiftUI

/// Book cover / poster art with a graceful empty state.
struct CoverImage: View {
    let url: URL?
    let accent: PrismAccent
    var cornerRadius: CGFloat = 10

    var body: some View {
        Rectangle()
            .fill(Color.white.opacity(0.04))
            .overlay {
                if let url {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        case .failure:
                            fallback
                        case .empty:
                            ProgressView().controlSize(.small)
                        @unknown default:
                            fallback
                        }
                    }
                } else {
                    fallback
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(PrismColor.hairline, lineWidth: 1)
            }
    }

    private var fallback: some View {
        Image(systemName: accent.symbol)
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(accent.color.opacity(0.5))
    }
}

/// The reading shelf's progress arc: a half donut with the cover nested in its
/// mouth. The web never tints the artwork itself — progress lives in the arc
/// around it. Ported from `HalfDonutChart` (`src/features/prismlog/ui.jsx:27`)
/// as laid out by `ReadingGridCard`
/// (`src/features/prismlog/pages/recordsPage.jsx:3179`).
struct HalfDonutCoverChart: View {
    let url: URL?
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

                CoverImage(url: url, accent: accent, cornerRadius: 12 * scale)
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

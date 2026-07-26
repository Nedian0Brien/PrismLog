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

/// A cover that fills with category-colored light as the record progresses —
/// the reading equivalent of a rising water line, and the place progress is
/// most legible at a glance.
struct ProgressWaterCover: View {
    let url: URL?
    let progress: Int
    let accent: PrismAccent
    var width: CGFloat = 104

    private var height: CGFloat { width * 1.45 }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var filled = false

    var body: some View {
        CoverImage(url: url, accent: accent)
            .frame(width: width, height: height)
            .overlay(alignment: .bottom) {
                let level = height * CGFloat(min(max(progress, 0), 100)) / 100

                ZStack(alignment: .top) {
                    LinearGradient(
                        colors: [accent.color.opacity(0.12), accent.color.opacity(0.42)],
                        startPoint: .top,
                        endPoint: .bottom
                    )

                    // The surface line — without it the fill reads as a shadow
                    // rather than a level.
                    Rectangle()
                        .fill(accent.tone.light.opacity(0.85))
                        .frame(height: 1.5)
                        .shadow(color: accent.tone.light.opacity(0.7), radius: 3)
                }
                .frame(height: filled ? level : 0)
                .allowsHitTesting(false)
            }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .onAppear {
                if reduceMotion {
                    filled = true
                } else {
                    withAnimation(PrismMotion.meter.delay(0.05)) { filled = true }
                }
            }
            .accessibilityHidden(true)
    }
}

import SwiftUI

/// The prism glyph: white light entering a solid, split into the three record colors.
struct PrismTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// App wordmark. Ported from the header in `src/App.jsx` — spectrum-filled type
/// with a slow shimmer, next to a prism mark.
struct PrismWordmark: View {
    var size: CGFloat = 19

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shimmering = false

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: size * 0.34, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            PrismAccent.reading.color,
                            PrismAccent.study.color,
                            PrismAccent.movie.color,
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size * 1.7, height: size * 1.7)
                .overlay {
                    PrismTriangle()
                        .fill(PrismColor.background)
                        .frame(width: size * 0.86, height: size * 0.76)
                }

            Text("PrismLog")
                .font(PrismFont.text(size, .extraBold, relativeTo: .title3))
                .foregroundStyle(
                    LinearGradient(gradient: PrismColor.spectrum, startPoint: .leading, endPoint: .trailing)
                )
                .opacity(shimmering ? 0.72 : 1)
        }
        .fixedSize()
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                shimmering = true
            }
        }
    }
}

/// Standard screen heading: small uppercase eyebrow over a large title.
struct PrismScreenHeader: View {
    let eyebrow: String
    let title: String
    var accent: Color = PrismColor.text

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(eyebrow)
                .font(.prismMicro)
                .tracking(1.4)
                .textCase(.uppercase)
                .prismMuted()

            Text(title)
                .font(.prismDisplay)
                .foregroundStyle(PrismColor.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground()
        VStack(spacing: 32) {
            PrismWordmark()
            PrismScreenHeader(eyebrow: "Dashboard", title: "기록 대시보드")
        }
        .padding()
    }
}

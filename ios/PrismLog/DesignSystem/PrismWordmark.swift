import SwiftUI

/// App wordmark (2026-11-19, draft A·L3·S2, user's pick): the app icon's
/// prism beside the name, and the prism's light falling softly on the lower
/// half of the letters — teal, yellow, red in the category order the icon
/// uses (독서 · 공부 · 문화).
struct PrismWordmark: View {
    /// The name's point size; the prism is one em tall.
    var size: CGFloat = 19

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: size * 0.26) {
            PrismMark()
                .frame(width: size * PrismMark.aspectRatio, height: size)
                // The prism's foot sits a little below the baseline, as drawn.
                .alignmentGuide(.firstTextBaseline) { $0.height * (114.0 / 132.0) }

            name
        }
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("PrismLog")
        .accessibilityAddTraits(.isHeader)
    }

    private var name: some View {
        let text = Text("PrismLog")
            .font(PrismFont.text(size, .extraBold, relativeTo: .headline))
            .tracking(-0.035 * size)

        return text
            .foregroundStyle(Self.paper)
            .overlay { lit(text).opacity(0.75) }
            .background {
                // A faint spill of the same light around the letters, only
                // where it can be seen.
                if size >= 32 {
                    lit(text).blur(radius: size * 0.12).opacity(0.25)
                }
            }
    }

    /// The letters in the prism's colours, shown only toward their foot.
    private func lit(_ text: Text) -> some View {
        text
            .foregroundStyle(
                LinearGradient(colors: Self.light, startPoint: .leading, endPoint: .trailing)
            )
            .mask {
                // Pretendard's line box: the light starts a little under the
                // x-height and is full by the descenders.
                LinearGradient(
                    stops: [.init(color: .clear, location: 0.468), .init(color: .black, location: 0.862)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
    }

    static let paper = Color(hex: 0xF4F1EC)
    /// The category colours, lifted toward white so they read as light.
    static let light = [Color(hex: 0x6FD9CB), Color(hex: 0xF3D77A), Color(hex: 0xEE7A80)]
}

/// The app icon's prism (`AppIcon.icon`): bands parallel to its left face,
/// narrowing toward red, under a lit white edge.
struct PrismMark: View {
    /// Width over height of the icon's triangle.
    static let aspectRatio: CGFloat = 732.0 / 644.0

    var body: some View {
        Canvas { context, size in
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x / 732 * size.width, y: y / 644 * size.height)
            }
            func shape(_ points: [CGPoint]) -> Path {
                Path { path in path.addLines(points); path.closeSubpath() }
            }
            let triangle = shape([point(366, 0), point(732, 644), point(0, 644)])

            context.drawLayer { layer in
                layer.clip(to: triangle)
                layer.fill(shape([point(366, 0), point(488, 214.7), point(244, 644), point(0, 644)]), with: .color(Color(hex: 0x2DB5A3)))
                layer.fill(shape([point(488, 214.7), point(610, 429.3), point(488, 644), point(244, 644)]), with: .color(Color(hex: 0xF0C930)))
                layer.fill(shape([point(610, 429.3), point(732, 644), point(488, 644)]), with: .color(Color(hex: 0xE63946)))
            }
            context.stroke(
                triangle,
                with: .color(.white.opacity(0.85)),
                style: StrokeStyle(lineWidth: max(0.75, size.height * 0.034), lineJoin: .round)
            )
        }
        .accessibilityHidden(true)
    }
}

/// Standard screen heading: small uppercase eyebrow over a large title.
struct PrismScreenHeader: View {
    let eyebrow: String
    let title: String
    /// Colors the eyebrow. Muted by default; record sections tint it with the
    /// category accent, as the web does.
    var accent: Color = PrismColor.textMuted

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(eyebrow)
                .font(.prismMicro)
                .tracking(1.4)
                .textCase(.uppercase)
                .foregroundStyle(accent)

            Text(title)
                .font(.prismDisplay)
                .foregroundStyle(PrismColor.text)
                .accessibilityIdentifier("screen.title")
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

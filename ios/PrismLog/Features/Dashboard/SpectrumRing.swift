import SwiftUI

/// The app's emblem, made of the user's own data: one ring split into the
/// three record colors, with a glass lens sitting over it so the light appears
/// to bend as it passes through.
///
/// Ported from `SpectrumRing` (`src/features/prismlog/ui.jsx:452`), but the glow
/// comes from real shadows rather than an SVG blur filter.
struct SpectrumRing: View {
    struct Slice: Identifiable, Hashable {
        let accent: PrismAccent
        let count: Int

        var id: PrismAccent { accent }
    }

    let slices: [Slice]
    var diameter: CGFloat = 172
    var lineWidth: CGFloat = 15

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn = false

    private var total: Int { slices.reduce(0) { $0 + $1.count } }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.06), lineWidth: lineWidth)

            ForEach(Array(arcs.enumerated()), id: \.element.slice.id) { _, arc in
                Circle()
                    .trim(from: arc.start, to: drawn ? arc.end : arc.start)
                    .stroke(
                        AngularGradient(
                            colors: [arc.slice.accent.tone.main, arc.slice.accent.tone.light],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .shadow(color: arc.slice.accent.tone.main.opacity(0.55), radius: 7)
            }
            .rotationEffect(.degrees(-90))

            // The lens: a thin glass disc over the ring's core, so the numbers
            // read as if seen through the prism rather than printed on it.
            centerReadout
                .frame(width: diameter - lineWidth * 3.4, height: diameter - lineWidth * 3.4)
                .glassEffect(.regular, in: .circle)
        }
        .frame(width: diameter, height: diameter)
        .onAppear {
            guard !drawn else { return }
            if reduceMotion {
                drawn = true
            } else {
                withAnimation(PrismMotion.meter.delay(0.1)) { drawn = true }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("전체 기록 \(total)건")
        .accessibilityValue(
            slices
                .filter { $0.count > 0 }
                .map { "\($0.accent.label) \($0.count)건" }
                .joined(separator: ", ")
        )
    }

    private var centerReadout: some View {
        VStack(spacing: 1) {
            Text("\(total)")
                .font(PrismFont.numeral(30, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(PrismColor.text)
                .contentTransition(.numericText())

            Text("전체 기록")
                .font(.prismMicro)
                .prismMuted()
        }
    }

    private struct Arc {
        let slice: Slice
        let start: CGFloat
        let end: CGFloat
    }

    /// Segments are separated by a small gap so neighbouring colors stay legible
    /// where they meet, which round caps alone don't achieve.
    private var arcs: [Arc] {
        guard total > 0 else { return [] }

        let gap: CGFloat = slices.filter { $0.count > 0 }.count > 1 ? 0.012 : 0
        var cursor: CGFloat = 0

        return slices.compactMap { slice in
            guard slice.count > 0 else { return nil }

            let fraction = CGFloat(slice.count) / CGFloat(total)
            let start = cursor
            let end = cursor + fraction
            cursor = end

            return Arc(slice: slice, start: start, end: max(start, end - gap))
        }
    }
}

#Preview {
    ZStack {
        SpectrumBloomBackground(focus: .reading)
        SpectrumRing(slices: [
            .init(accent: .reading, count: 9),
            .init(accent: .study, count: 16),
            .init(accent: .movie, count: 14),
        ])
    }
}

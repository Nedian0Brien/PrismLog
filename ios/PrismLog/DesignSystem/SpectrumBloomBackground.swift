import SwiftUI

/// The light source the whole app refracts.
///
/// This layer is not decoration — it is load-bearing. Liquid Glass renders what
/// is *behind* it, so glass over a flat dark fill reads as a grey rectangle.
/// These slow-drifting category-colored blooms give every glass surface in the
/// app something to bend, which is what makes the prism concept legible.
struct SpectrumBloomBackground: View {
    /// The category currently in focus. Its bloom brightens, so the whole app
    /// subtly takes on the color of what you're looking at.
    var focus: PrismAccent?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drifting = false

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size

            ZStack {
                PrismColor.background

                // Matches the web's `radial-gradient(ellipse at top, …)` shell.
                RadialGradient(
                    colors: [PrismColor.backgroundLift, PrismColor.background],
                    center: .top,
                    startRadius: 0,
                    endRadius: max(size.height * 0.78, 1)
                )

                bloom(.reading,
                      anchor: UnitPoint(x: 0.16, y: 0.14),
                      travel: CGSize(width: 0.10, height: 0.05),
                      diameter: 1.05,
                      in: size)

                bloom(.study,
                      anchor: UnitPoint(x: 0.92, y: 0.34),
                      travel: CGSize(width: -0.08, height: 0.08),
                      diameter: 0.88,
                      in: size)

                bloom(.movie,
                      anchor: UnitPoint(x: 0.28, y: 0.82),
                      travel: CGSize(width: 0.09, height: -0.06),
                      diameter: 0.95,
                      in: size)
            }
            .animation(PrismMotion.screen, value: focus)
        }
        .ignoresSafeArea()
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(PrismMotion.drift) { drifting = true }
        }
    }

    /// A soft pool of category light. Built from a radial gradient rather than a
    /// blurred shape so it costs one gradient fill instead of a blur pass.
    private func bloom(
        _ accent: PrismAccent,
        anchor: UnitPoint,
        travel: CGSize,
        diameter: CGFloat,
        in size: CGSize
    ) -> some View {
        let extent = max(size.width, 1) * diameter
        let isFocused = focus == accent
        let peak = isFocused ? 0.42 : 0.24

        return Circle()
            .fill(
                RadialGradient(
                    colors: [
                        accent.tone.light.opacity(peak),
                        accent.tone.main.opacity(peak * 0.45),
                        .clear,
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: extent / 2
                )
            )
            .frame(width: extent, height: extent)
            .position(
                x: size.width * anchor.x + (drifting ? size.width * travel.width : 0),
                y: size.height * anchor.y + (drifting ? size.height * travel.height : 0)
            )
            .blendMode(.plusLighter)
            .opacity(focus == nil || isFocused ? 1 : 0.55)
    }
}

#Preview {
    SpectrumBloomBackground(focus: .reading)
}

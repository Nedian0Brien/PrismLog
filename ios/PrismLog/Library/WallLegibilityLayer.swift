import SwiftUI

/// Keeps text on glass readable over any cover (spec §4.7).
///
/// Applied to the wall itself rather than stacked as a sibling, because the
/// desaturation and blur act on the covers, not on what's above them.
struct WallLegibilityLayer: ViewModifier {
    enum Mode: Equatable {
        /// The flowing wall behind lists and dashboards.
        case standard
        /// One cover filling the screen behind its detail.
        case hero
    }

    let mode: Mode
    /// Replaces the gradient's top and bottom opacity with one value — the
    /// debug lab's dimming slider.
    var dimmingOverride: Double?

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    /// Top-to-bottom black, so the screen title at the top keeps the most
    /// wall and the dense content below gets the most help.
    static let standardDimming: (top: Double, bottom: Double) = (0.30, 0.55)
    static let heroDimming = 0.45
    static let heroBlurRadius: CGFloat = 40
    /// Reduce Transparency trades the wall for contrast.
    static let reducedTransparencyDimming = 0.75
    static let saturation = 0.85

    private var dimming: (top: Double, bottom: Double) {
        if reduceTransparency {
            return (Self.reducedTransparencyDimming, Self.reducedTransparencyDimming)
        }
        if let dimmingOverride {
            return (dimmingOverride, dimmingOverride)
        }
        switch mode {
        case .standard: return Self.standardDimming
        case .hero: return (Self.heroDimming, Self.heroDimming)
        }
    }

    func body(content: Content) -> some View {
        let dimming = dimming
        content
            .saturation(Self.saturation)
            .blur(radius: mode == .hero ? Self.heroBlurRadius : 0, opaque: true)
            .overlay {
                LinearGradient(
                    colors: [.black.opacity(dimming.top), .black.opacity(dimming.bottom)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
    }
}

import SwiftUI

/// The wall's brightness setting (spec §6.4). Every level keeps body text on
/// regular glass at 4.5:1 or better over the worst-case wall — there is no
/// "brighter" level, because 0.55 at the top is already the floor that
/// clears it (issue #19).
enum WallDimming: String, CaseIterable, Identifiable {
    case standard
    case darker
    case darkest

    static let storageKey = "wall.dimming"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .standard: "기본"
        case .darker: "어둡게"
        case .darkest: "더 어둡게"
        }
    }

    var values: (top: Double, bottom: Double) {
        switch self {
        case .standard: (0.55, 0.70)
        case .darker: (0.65, 0.80)
        case .darkest: (0.75, 0.88)
        }
    }
}

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
    var style: WallStyle = .covers
    /// Replaces the gradient's top and bottom opacity with one value — the
    /// debug lab's dimming slider.
    var dimmingOverride: Double?

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @AppStorage(WallDimming.storageKey) private var setting: WallDimming = .standard

    /// Top-to-bottom black, so the screen title at the top keeps the most
    /// wall and the dense content below gets the most help.
    ///
    /// Spec §4.7 started at 0.30 → 0.55, which left body text on regular
    /// glass at 3.90:1 over the worst-case wall. At 0.55 it measures
    /// 4.78:1, so the top starts there (issue #19, Phase 2 measurements).
    static let standardDimming = WallDimming.standard.values
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
        case .standard:
            // The style sets the base; the brightness setting adds to it.
            let extra = setting.values.top - WallDimming.standard.values.top
            let base = style.baseDimming
            return (min(base.top + extra, 0.9), min(base.bottom + extra, 0.9))
        case .hero: return (Self.heroDimming, Self.heroDimming)
        }
    }

    func body(content: Content) -> some View {
        let dimming = dimming
        content
            // Desaturation tames artwork; the light styles are already in
            // PrismLog's own tones and would only go muddy.
            .saturation(style.saturation)
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

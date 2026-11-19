import SwiftUI

enum PrismGlassMetrics {
    static let cardCorner: CGFloat = 22
    static let compactCorner: CGFloat = 16
    static let sectionSpacing: CGFloat = 14
    /// Tint is a whisper, not a coat of paint. Enough to say "this is 독서",
    /// not enough to fight the content sitting on the glass.
    static let tintStrength: Double = 0.13
    /// Darkness clear glass carries over bright backgrounds (HIG: 35%).
    static let clearDimming: Double = 0.35
    /// The library's "now in progress" lens cards (spec §5).
    static let lensCorner: CGFloat = 28
    /// Widest a column of body cards gets on a regular-width screen; the
    /// wall shows either side of it (spec §5).
    static let readableWidth: CGFloat = 640
}

// MARK: - Glass surfaces

extension Glass {
    /// The one glass every PrismLog surface is made of. Clear, so the wall
    /// refracts the same way at every card edge (2026-11-18, user decision:
    /// one material everywhere instead of clear for lens cards only).
    ///
    /// Clear glass doesn't darken what's behind it, so it carries its own
    /// dimming: Apple's HIG (Materials) suggests a 35% dark layer behind
    /// clear glass over bright content. An accent tint is mixed into that
    /// darkness rather than replacing it.
    static var prism: Glass { prism(tint: nil) }

    static func prism(tint: Color?) -> Glass {
        let dimming = Color.black.opacity(PrismGlassMetrics.clearDimming)
        guard let tint else { return .clear.tint(dimming) }
        return .clear.tint(
            Color.black.mix(with: tint, by: PrismGlassMetrics.tintStrength * 2)
                .opacity(PrismGlassMetrics.clearDimming)
        )
    }
}

extension View {
    /// A content-layer glass card.
    ///
    /// PrismLog deliberately puts glass on content (not just the navigation
    /// layer) to carry the web app's look across. The cost of that choice is
    /// render passes, so every card is expected to sit inside a
    /// `PrismGlassSection` which merges them into one pass.
    func prismGlassCard(
        tint: Color? = nil,
        corner: CGFloat = PrismGlassMetrics.cardCorner,
        padding: CGFloat = 16
    ) -> some View {
        self
            .padding(padding)
            .modifier(PrismGlassSurface(tint: tint, corner: corner))
    }
}

extension View {
    /// A lens card: the same glass as every card, with a larger corner
    /// (spec §5).
    func prismLensCard(padding: CGFloat = 18) -> some View {
        self
            .padding(padding)
            .glassEffect(.prism, in: .rect(cornerRadius: PrismGlassMetrics.lensCorner))
    }
}

// MARK: - Controls
//
// Interactive glass is NOT `.glassEffect(…)`. Applying it to a `Button` renders
// the right thing but eats every touch — the action never fires, even on a
// direct coordinate tap. Controls use `.buttonStyle(.glass)` with `.tint(…)`
// and `.buttonBorderShape(…)`; `.glassEffect` stays on inert surfaces.

private struct PrismGlassSurface: ViewModifier {
    let tint: Color?
    let corner: CGFloat

    func body(content: Content) -> some View {
        content.glassEffect(glass, in: .rect(cornerRadius: corner))
    }

    private var glass: Glass {
        .prism(tint: tint)
    }
}

// MARK: - Grouping

/// Wraps a run of glass surfaces so the system merges them into a single
/// effect. Required by our own rule: never stack raw `.glassEffect` siblings
/// outside a container — that is the "glass on glass" case Apple warns about
/// and the main performance trap of content-layer glass.
struct PrismGlassSection<Content: View>: View {
    var spacing: CGFloat = PrismGlassMetrics.sectionSpacing
    @ViewBuilder var content: Content

    var body: some View {
        GlassEffectContainer(spacing: spacing) {
            content
        }
    }
}

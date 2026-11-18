import SwiftUI

enum PrismGlassMetrics {
    static let cardCorner: CGFloat = 22
    static let compactCorner: CGFloat = 16
    static let sectionSpacing: CGFloat = 14
    /// Tint is a whisper, not a coat of paint. Enough to say "this is 독서",
    /// not enough to fight the content sitting on the glass.
    static let tintStrength: Double = 0.13
    /// The library's "now in progress" lens cards (spec §5).
    static let lensCorner: CGFloat = 28
    /// Widest a column of body cards gets on a regular-width screen; the
    /// wall shows either side of it (spec §5).
    static let readableWidth: CGFloat = 640
}

// MARK: - Glass surfaces

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
    /// A lens card: clear glass with a large corner, so the wall behind it
    /// refracts as much as possible (spec §5). Only for cards with little,
    /// large text — over the brightest covers clear glass holds large text
    /// at 3:1 but not body text at 4.5:1 (issue #19).
    func prismLensCard(padding: CGFloat = 18) -> some View {
        self
            .padding(padding)
            .glassEffect(.clear, in: .rect(cornerRadius: PrismGlassMetrics.lensCorner))
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
        guard let tint else { return .regular }
        return .regular.tint(tint.opacity(PrismGlassMetrics.tintStrength))
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

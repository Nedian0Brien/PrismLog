import SwiftUI

/// Two columns that meet at iPhone Duo's fold when the screen has one
/// (spec §7.2).
///
/// With a division region — active or not, so the layout doesn't jump as the
/// hinge moves — each column takes one side of the fold and the gap covers
/// the fold and its margins, so no card or control sits on it. Without one,
/// the width splits evenly.
struct FoldAwareColumns<Leading: View, Trailing: View>: View {
    var spacing: CGFloat = PrismGlassMetrics.sectionSpacing
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    @State private var split: ColumnSplit?

    var body: some View {
        // Captured as a value: the geometry closure must not capture `self`,
        // whose generic view types aren't `Sendable`.
        let spacing = spacing
        return HStack(alignment: .top, spacing: split?.gap ?? spacing) {
            VStack(spacing: spacing) { leading }
                .frame(width: split?.leadingWidth)
                .frame(maxWidth: split == nil ? .infinity : nil)
            VStack(spacing: spacing) { trailing }
                .frame(maxWidth: .infinity)
        }
        .onGeometryChange(for: ColumnSplit.self) { [spacing] proxy in
            ColumnSplit.make(
                width: proxy.size.width,
                height: proxy.size.height,
                divisions: proxy.reservedRegions(kind: .division, options: .includeInactive).map(\.frame),
                spacing: spacing
            )
        } action: { newValue in
            split = newValue
        }
    }
}

/// Column widths for `FoldAwareColumns`, separated out so the fold rules
/// can be tested without a device.
struct ColumnSplit: Equatable, Sendable {
    let leadingWidth: CGFloat
    let gap: CGFloat
    /// Whether the split follows a fold rather than halving the width.
    let followsFold: Bool

    /// - Parameter divisions: division-region frames in the columns' own
    ///   coordinates. Frames already include the system's margins.
    static func make(width: CGFloat, height: CGFloat, divisions: [CGRect], spacing: CGFloat) -> ColumnSplit {
        // A vertical fold that actually crosses the columns' width. A
        // horizontal one (tabletop) doesn't separate side-by-side columns.
        let fold = divisions.first { frame in
            frame.height >= frame.width && frame.minX > 0 && frame.maxX < width
        }
        if let fold {
            return ColumnSplit(
                leadingWidth: max(0, fold.minX),
                gap: max(spacing, fold.width),
                followsFold: true
            )
        }
        return ColumnSplit(
            leadingWidth: max(0, (width - spacing) / 2),
            gap: spacing,
            followsFold: false
        )
    }
}

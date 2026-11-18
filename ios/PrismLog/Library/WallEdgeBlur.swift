import SwiftUI

/// Blurs the wall toward the top and bottom of the screen: sharp in the
/// middle, softest at the two ends. The sides stay sharp (2026-11-18: a
/// blur on all four edges looked wrong).
///
/// SwiftUI has no variable blur, so the wall is drawn again at increasing
/// blur radii, each copy masked to a narrower band along the edges. The
/// bands overlap, so the blur deepens step by step toward each end.
struct WallEdgeBlur: ViewModifier {
    /// Blur radius and how far in from the top and bottom it reaches, as a
    /// share of the height. Outermost (strongest) last.
    static let levels: [(radius: CGFloat, reach: CGFloat)] = [
        (6, 0.30),
        (16, 0.21),
        (32, 0.12),
    ]

    func body(content: Content) -> some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            ZStack {
                content
                ForEach(Self.levels.indices, id: \.self) { index in
                    let level = Self.levels[index]
                    content
                        .blur(radius: level.radius, opaque: true)
                        .mask { EdgeFadeMask(reach: height * level.reach) }
                }
            }
        }
    }
}

/// Opaque at the top and bottom edges, clear `reach` points in.
struct EdgeFadeMask: View {
    let reach: CGFloat

    private var fade: Gradient {
        Gradient(stops: [
            .init(color: .black, location: 0),
            .init(color: .black.opacity(0.55), location: 0.45),
            .init(color: .clear, location: 1),
        ])
    }

    var body: some View {
        ZStack {
            LinearGradient(gradient: fade, startPoint: .top, endPoint: .bottom)
                .frame(height: reach)
                .frame(maxHeight: .infinity, alignment: .top)
            LinearGradient(gradient: fade, startPoint: .bottom, endPoint: .top)
                .frame(height: reach)
                .frame(maxHeight: .infinity, alignment: .bottom)
        }
    }
}

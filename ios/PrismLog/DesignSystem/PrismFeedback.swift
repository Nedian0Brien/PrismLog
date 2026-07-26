import SwiftUI
import UIKit

/// Touch feedback, kept in one place so a save feels the same everywhere.
@MainActor
enum PrismHaptics {
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    /// The save gesture: a firm tap followed by a soft one, so it reads as
    /// "landed" rather than "clicked". Pairs with `SaveRefractionPulse`.
    static func saved() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func failed() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }
}

/// A wash of category-colored light across the whole screen when a record
/// lands — the native descendant of the web's `glowEffect` edge flash
/// (`src/App.jsx`), but read as light passing through the prism rather than a
/// border glow.
struct SaveRefractionPulse: ViewModifier {
    let accent: PrismAccent?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                if let accent, phase > 0 {
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.clear, accent.tone.light.opacity(0.55), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: proxy.size.height * 0.6)
                        .offset(y: -proxy.size.height * 0.6 + phase * proxy.size.height * 1.6)
                        .blendMode(.plusLighter)
                    }
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
                }
            }
            .onChange(of: accent) { _, newValue in
                guard newValue != nil else { return }

                if reduceMotion {
                    // Still acknowledge the save, just without the sweep.
                    phase = 0
                    return
                }

                phase = 0
                withAnimation(.easeOut(duration: 0.85)) { phase = 1 }
            }
    }
}

extension View {
    /// Flashes refracted light in `accent`'s color whenever it becomes non-nil.
    func saveRefractionPulse(_ accent: PrismAccent?) -> some View {
        modifier(SaveRefractionPulse(accent: accent))
    }
}

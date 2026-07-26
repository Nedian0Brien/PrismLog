import SwiftUI

/// One place for the app's timing, so a spring tuned on the dashboard feels the
/// same in the reading detail. Roughly maps to the web's
/// `cubic-bezier(.32,.72,.24,1)` house curve, but as real springs.
enum PrismMotion {
    /// Screen and sheet level transitions.
    static let screen = Animation.spring(response: 0.42, dampingFraction: 0.86)
    /// Glass morphing — deliberately looser so the material reads as liquid.
    static let morph = Animation.bouncy(duration: 0.5, extraBounce: 0.08)
    /// Small state flips: chips, toggles, selection.
    static let snappy = Animation.snappy(duration: 0.28)
    /// Value changes that should feel measured — progress bars, ring segments.
    static let meter = Animation.spring(response: 0.9, dampingFraction: 0.9)
    /// Ambient background drift.
    static let drift = Animation.easeInOut(duration: 19).repeatForever(autoreverses: true)
}

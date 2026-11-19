import SwiftUI

/// What the app shows between the system launch screen and the first
/// screen: the wordmark on the wall's darkness, until the covers on the
/// first screen have their images, so the wall doesn't fill in tile by tile
/// in front of the person (2026-11-19, user decision).
struct LaunchSplash: View {
    /// The splash gives up after this, so a slow or missing network never
    /// looks like a frozen app.
    static let longestWait: Duration = .seconds(3)

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        ZStack {
            // The launch screen's colour (`LaunchBackground`, #1A1816), so
            // the hand-over from the system is invisible. iOS caches launch
            // screens across updates, so the splash matches it rather than
            // the other way round.
            PrismColor.background.ignoresSafeArea()

            PrismWordmark(size: 34)
                .opacity(shown ? 1 : 0)
                .scaleEffect(shown || reduceMotion ? 1 : 0.97)
        }
        .onAppear {
            withAnimation(.easeOut(duration: reduceMotion ? 0.15 : 0.35)) { shown = true }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("launch.splash")
    }
}

import SwiftUI

@main
struct PrismLogApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
                .tint(PrismAccent.reading.color)
        }
    }
}

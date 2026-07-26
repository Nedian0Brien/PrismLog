import Foundation
import WidgetKit

/// Thin wrapper so the store doesn't import WidgetKit directly, and so widget
/// reloads can be throttled in one place — WidgetKit budgets them, and a sync
/// can call `reload()` several times in a row.
enum WidgetRefresher {
    nonisolated(unsafe) private static var lastReload: Date?
    private static let minimumInterval: TimeInterval = 5

    static func reload() {
        let now = Date()
        if let lastReload, now.timeIntervalSince(lastReload) < minimumInterval { return }
        lastReload = now

        WidgetCenter.shared.reloadTimelines(ofKind: "PrismSpectrumWidget")
    }
}

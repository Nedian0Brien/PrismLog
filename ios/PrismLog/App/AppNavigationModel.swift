import Observation
import SwiftUI

/// Navigation state that has to survive the screen changing size (spec §7.4).
///
/// Folding or unfolding iPhone Duo rebuilds the layout, and the records tab
/// can switch between a stack and a split view as it does. Anything held in a
/// screen's own `@State` would reset; held here, it's redrawn as it was.
@Observable
@MainActor
final class AppNavigationModel {
    var tab: PrismTab = .home

    /// The records tab's open shelf. `nil` is the hub.
    var recordsSection: PrismAccent?

    /// Each tab's pushed records. Every push in the app is a record ID.
    var paths: [PrismTab: [UUID]] = [:]

    /// The dates the timeline feed is showing, once it has settled. The
    /// wall shows covers from that range (spec §6.3).
    var timelinePeriod: DateInterval?

    /// A reading session in progress (spec §6.6, §7.4). Held here because a
    /// posture change rebuilds the session screen — on the iOS 27.2 iPhone
    /// Duo simulator its own state reset the timer and lost the memo.
    var readingSession: ReadingSessionState?

    /// A composer the toolbar `+` menu asked for. The shell presents it.
    var pendingComposer: PrismAccent?

    /// Each tab's scroll offset, so the wall's parallax follows whichever
    /// tab is showing without jumping when the tab changes.
    var scrollOffsets: [PrismTab: CGFloat] = [:]

    func path(for tab: PrismTab) -> Binding<[UUID]> {
        Binding(
            get: { self.paths[tab] ?? [] },
            set: { self.paths[tab] = $0 }
        )
    }

    /// The record on top of the current tab's stack, if any.
    var topRecordID: UUID? {
        paths[tab]?.last
    }
}

/// What a reading session has so far: when it started and what's been typed.
struct ReadingSessionState: Equatable {
    let recordID: UUID
    let startedAt: Date
    var currentPage: String
    var note: String
}

extension EnvironmentValues {
    /// The tab a screen belongs to, set by the shell on each tab's content.
    /// `nil` outside the shell — the debug lab and previews.
    @Entry var prismTab: PrismTab?
}

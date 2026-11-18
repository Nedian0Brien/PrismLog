import SwiftUI

/// The four destinations, mirroring the web's `navItems` in `src/App.jsx`.
enum PrismTab: String, CaseIterable, Identifiable, Hashable {
    case home
    case records
    case timeline
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "라이브러리"
        case .records: "기록"
        case .timeline: "타임라인"
        case .settings: "설정"
        }
    }

    var symbol: String {
        switch self {
        case .home: "rectangle.stack.fill"
        case .records: "books.vertical.fill"
        case .timeline: "clock.fill"
        case .settings: "gearshape.fill"
        }
    }

    /// Per-tab accent, ported from `NAV_TAB_COLORS`. Settings stays neutral.
    var accent: PrismAccent? {
        switch self {
        case .home: .reading
        case .records: .study
        case .timeline: .movie
        case .settings: nil
        }
    }

    var tintColor: Color {
        accent?.color ?? PrismColor.text
    }
}

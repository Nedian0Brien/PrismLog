import SwiftUI

/// Shared screen chrome: a clear page over the library wall, the wordmark,
/// the composer menu, and consistent gutters.
///
/// The page draws the shared library wall behind itself (spec §4.6). Bottom room for the tab bar comes from the system's
/// safe area, not a fixed number, so it stays right when iPhone Duo moves
/// the tab bar to a vertical bar on the side (spec §7.5, audit P2).
struct PrismScreenScaffold<Content: View>: View {
    let eyebrow: String
    let title: String
    var focus: PrismAccent?
    /// Set to show a "← <label>" pill above the header, the way the web's
    /// record sections return to the hub. Purely in-place: it is not a
    /// navigation pop, so the caller owns the state it flips.
    var backLabel: String?
    var onBack: (() -> Void)?
    /// A small control parked on the title's baseline — the records hub's
    /// column switcher. Type-erased because Swift can't default a generic
    /// parameter, and one erased control per screen is cheaper than making
    /// every existing call site name a placeholder type.
    var headerAccessory: AnyView?
    /// Caps the content at `PrismGlassMetrics.readableWidth` and centres it,
    /// leaving the wall visible either side on wide screens (spec §5).
    var readableWidth = false
    /// `false` when the caller provides the navigation container — the
    /// records tab puts this page in a split view's sidebar on wide screens.
    var embedsInStack = true
    var onRefresh: (@Sendable () async -> Void)?
    @ViewBuilder var content: Content

    @Environment(\.prismTab) private var tab
    @Environment(AppNavigationModel.self) private var navigation: AppNavigationModel?
    @State private var localPath: [UUID] = []

    private var path: Binding<[UUID]> {
        if let tab, let navigation { return navigation.path(for: tab) }
        return $localPath
    }

    var body: some View {
        if embedsInStack {
            NavigationStack(path: path) { page }
        } else {
            page
        }
    }

    private var page: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                content
            }
            .frame(maxWidth: readableWidth ? PrismGlassMetrics.readableWidth : .infinity, alignment: .leading)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
        .refreshable {
            await onRefresh?()
        }
        .onScrollGeometryChange(for: CGFloat.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top
        } action: { _, offset in
            guard let tab, let navigation else { return }
            navigation.scrollOffsets[tab] = offset
        }
        .prismWallBackground()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                PrismWordmark(size: 18)
            }
            // The wordmark is a label, not a control — without this iOS 26
            // wraps it in the toolbar's glass capsule.
            .sharedBackgroundVisibility(.hidden)

            if tab != .settings, let navigation {
                ToolbarItem(placement: .topBarPinnedTrailing) {
                    PrismComposerMenu { navigation.pendingComposer = $0 }
                }
            }
        }
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let backLabel, let onBack {
                Button {
                    withAnimation(PrismMotion.screen) { onBack() }
                } label: {
                    Label(backLabel, systemImage: "chevron.left")
                        .font(.prismCaption)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.capsule)
                .tint(focus?.color ?? PrismColor.text)
                .accessibilityIdentifier("screen.back")
            }

            HStack(alignment: .bottom, spacing: 10) {
                PrismScreenHeader(
                    eyebrow: eyebrow,
                    title: title,
                    accent: backLabel == nil
                        ? PrismColor.textMuted
                        : (focus?.color ?? PrismColor.textMuted)
                )

                if let headerAccessory {
                    headerAccessory
                }
            }
        }
    }
}

/// The toolbar's `+`: one menu of the five composers (spec §3, §6.5).
///
/// A system `Menu` in the toolbar rather than the v1 floating button: the
/// toolbar morphs the menu out of its glass on its own, keeps it clear of
/// iPhone Duo's fold, and carries it into the vertical bar on the outer
/// screen — which needs an icon and a title on every item.
struct PrismComposerMenu: View {
    var onSelect: (PrismAccent) -> Void

    var body: some View {
        Menu {
            ForEach(PrismAccent.allCases) { accent in
                Button(accent.label, systemImage: accent.symbol) {
                    PrismHaptics.selection()
                    onSelect(accent)
                }
                .accessibilityIdentifier("composer.\(accent.rawValue)")
            }
        } label: {
            Label("기록 작성", systemImage: "plus")
        }
        .accessibilityIdentifier("composer.menu")
    }
}

/// A short explanatory card used where a feature has not landed yet. Keeps the
/// shell honest about what is real instead of faking data.
struct PrismPlaceholderCard: View {
    let accent: PrismAccent
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: accent.symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(accent.color)
                .frame(width: 26, height: 26)

            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.prismHeadline)
                    .foregroundStyle(PrismColor.text)
                Text(detail)
                    .font(.prismCallout)
                    .prismMuted()
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .prismGlassCard(tint: accent.color)
    }
}

import SwiftUI
import UIKit

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
    /// Set to let a pull past the top lower the whole page to the bottom
    /// of the screen, leaving the wall behind it open to touch. Takes the
    /// pull from refresh, so pass one or the other.
    var wallReveal: Binding<Bool>?
    /// Where, in the page's content (`PrismPageSpace`), the part that stays
    /// on screen when the page is lowered ends. The page lowers until that
    /// point rests just above the bottom bar; without it, `revealPeek`
    /// points of the page stay up.
    var revealAnchor: CGFloat?
    /// Reports, in screen points, the band a lowered page leaves free: from
    /// below the top bar to where the anchored block's bottom rests.
    var onRevealGeometry: ((_ resting: (top: CGFloat, bottom: CGFloat)) -> Void)?
    @ViewBuilder var content: Content

    @Environment(\.prismTab) private var tab
    @Environment(AppNavigationModel.self) private var navigation: AppNavigationModel?
    @State private var localPath: [UUID] = []
    /// How far the page is pulled past its top, in points.
    @State private var pull: CGFloat = 0
    @State private var pageHeight: CGFloat = 0
    @State private var insets = EdgeInsets()
    /// The page's safe area, top bar included — the scroll view's content
    /// insets leave the bar out where its background is hidden.
    @State private var safeTop: CGFloat = 0
    /// A drag on the lowered page, to raise it back.
    @State private var revealDrag: CGFloat = 0

    /// A pull this far past the top lowers the page.
    static var revealPull: CGFloat { 90 }
    /// How much of a lowered page stays on screen: the title and the top
    /// of the first card.
    static var revealPeek: CGFloat { 230 }

    private var isRevealed: Bool { wallReveal?.wrappedValue ?? false }

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
        refreshing(scroll)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top
            } action: { _, offset in
                pull = max(-offset, 0)
                guard let tab, let navigation else { return }
                navigation.scrollOffsets[tab] = offset
            }
            .onScrollGeometryChange(for: EdgeInsets.self) { $0.contentInsets } action: { _, new in
                insets = new
            }
            .onScrollPhaseChange { old, new in
                guard let wallReveal, !wallReveal.wrappedValue,
                      old == .interacting, new != .interacting,
                      pull > Self.revealPull else { return }
                PrismHaptics.selection()
                withAnimation(.spring(duration: 0.55, bounce: 0.18)) { wallReveal.wrappedValue = true }
            }
            .scrollDisabled(isRevealed)
            // On the lowered page, so it travels with it: an upward drag
            // raises it again. Simultaneous, so the page's own controls —
            // the lead pager's swipe, a card's tap — keep working.
            .simultaneousGesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { value in
                        guard abs(value.translation.height) > abs(value.translation.width) else { return }
                        revealDrag = value.translation.height
                    }
                    .onEnded { value in
                        let upward = value.translation.height < -60
                            && abs(value.translation.height) > abs(value.translation.width)
                        if upward { raise() }
                        withAnimation(.spring(duration: 0.4)) { revealDrag = 0 }
                    },
                isEnabled: isRevealed
            )
            // A container that keeps its children, so the action doesn't
            // fold the page into one element.
            .accessibilityElement(children: .contain)
            .offset(y: isRevealed ? max(revealDrop + min(revealDrag, 0), 0) : 0)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { pageHeight = $0 }
            .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { safeTop = $0 }
            .onChange(of: RevealBand(top: max(safeTop, insets.top), bottom: restingBottom), initial: true) { _, band in
                onRevealGeometry?((band.top, band.bottom))
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

    /// How far a lowered page drops.
    private var revealDrop: CGFloat {
        guard let revealAnchor else { return max(pageHeight - Self.revealPeek, 0) }
        return max(restingBottom - insets.top - revealAnchor, 0)
    }

    /// Where a lowered page's anchored block ends: 16pt above the bottom bar.
    private var restingBottom: CGFloat {
        pageHeight - insets.bottom - 16
    }

    private func raise() {
        withAnimation(.spring(duration: 0.5, bounce: 0.12)) { wallReveal?.wrappedValue = false }
    }

    @ViewBuilder
    private func refreshing(_ scroll: some View) -> some View {
        if let onRefresh {
            scroll.refreshable { await onRefresh() }
        } else {
            scroll
        }
    }

    private var scroll: some View {
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
            .coordinateSpace(.named(PrismPageSpace.name))
        }
        .scrollIndicators(.hidden)
        .scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
    }

    private var header: some View {
        headerContent
            // A lowered page keeps its first block, not its title: the title
            // would sit over the covers.
            .opacity(isRevealed ? 0 : 1)
    }

    private var headerContent: some View {
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
                Button {
                    PrismHaptics.selection()
                    onSelect(accent)
                } label: {
                    Label {
                        Text(accent.label)
                    } icon: {
                        Self.icon(for: accent)
                    }
                }
                .accessibilityIdentifier("composer.\(accent.rawValue)")
            }
        } label: {
            Label("기록 작성", systemImage: "plus")
        }
        .accessibilityIdentifier("composer.menu")
    }

    /// Each kind in its own colour. A menu redraws template icons in the
    /// app's tint, so the symbol goes in as an image that keeps its colour.
    private static func icon(for accent: PrismAccent) -> Image {
        guard let symbol = UIImage(systemName: accent.symbol) else { return Image(systemName: accent.symbol) }
        return Image(uiImage: symbol.withTintColor(UIColor(accent.color), renderingMode: .alwaysOriginal))
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

/// The coordinate space of a scaffold page's content, for measuring where a
/// block sits in it.
enum PrismPageSpace {
    static let name = "prism.page"
}

private struct RevealBand: Equatable {
    let top: CGFloat
    let bottom: CGFloat
}

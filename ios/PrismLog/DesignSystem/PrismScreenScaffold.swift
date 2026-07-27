import SwiftUI

/// Shared screen chrome: the bloom backdrop, a glass toolbar carrying the
/// wordmark, and consistent gutters.
///
/// The backdrop lives here rather than behind the `TabView` because the tab
/// container paints an opaque system background over anything below it — the
/// bloom has to be inside a tab's own content to be visible.
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
    var onRefresh: (@Sendable () async -> Void)?
    @ViewBuilder var content: Content

    var body: some View {
        NavigationStack {
            ZStack {
                SpectrumBloomBackground(focus: focus)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
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
                        content
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 6)
                    // Room for the floating tab bar and composer button.
                    .padding(.bottom, 130)
                }
                .scrollIndicators(.hidden)
                .refreshable {
                    await onRefresh?()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    PrismWordmark(size: 18)
                }
                // The wordmark is a label, not a control — without this iOS 26
                // wraps it in the toolbar's glass capsule.
                .sharedBackgroundVisibility(.hidden)
            }
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        }
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

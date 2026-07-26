import SwiftUI

struct RootView: View {
    @State private var tab: PrismTab = .home
    @State private var composerExpanded = false
    @State private var pendingComposer: PrismAccent?

    var body: some View {
        ZStack {
            // Fallback fill only — the visible bloom is drawn inside each
            // screen's scaffold, since the tab container covers anything here.
            PrismColor.background.ignoresSafeArea()

            TabView(selection: $tab) {
                Tab(PrismTab.home.title, systemImage: PrismTab.home.symbol, value: .home) {
                    HomeScreen()
                }
                Tab(PrismTab.records.title, systemImage: PrismTab.records.symbol, value: .records) {
                    RecordsScreen()
                }
                Tab(PrismTab.timeline.title, systemImage: PrismTab.timeline.symbol, value: .timeline) {
                    TimelineScreen()
                }
                Tab(PrismTab.settings.title, systemImage: PrismTab.settings.symbol, value: .settings) {
                    SettingsScreen()
                }
            }
            .tabBarMinimizeBehavior(.onScrollDown)
            .tint(tab.tintColor)
            // Only present while expanded, so it never blocks touches at rest.
            .overlay {
                if composerExpanded {
                    Color.black.opacity(0.32)
                        .ignoresSafeArea()
                        .contentShape(.rect)
                        .onTapGesture {
                            withAnimation(PrismMotion.morph) { composerExpanded = false }
                        }
                        .transition(.opacity)
                        .accessibilityLabel("기록 작성 닫기")
                        .accessibilityIdentifier("composer.scrim")
                }
            }
            // An overlay rather than a ZStack sibling: a full-bleed sibling
            // sits on top of the whole screen and swallows every touch,
            // including the tab bar's.
            .overlay(alignment: .bottomTrailing) {
                if tab != .settings {
                    PrismComposerButton(isExpanded: $composerExpanded) { accent in
                        pendingComposer = accent
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 78) // clears the floating tab bar
                }
            }
        }
        .animation(PrismMotion.screen, value: tab)
        .onChange(of: tab) { _, _ in
            guard composerExpanded else { return }
            withAnimation(PrismMotion.morph) { composerExpanded = false }
        }
    }
}

#Preview {
    RootView()
}

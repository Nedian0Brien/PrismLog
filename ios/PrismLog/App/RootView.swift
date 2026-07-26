import SwiftUI

struct RootView: View {
    @Environment(PrismStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
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
        .saveRefractionPulse(store.lastSavedAccent)
        .sheet(item: $pendingComposer) { accent in
            composerSheet(for: accent)
        }
        .animation(PrismMotion.screen, value: tab)
        .task { await store.sync() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.sync() }
        }
        .onChange(of: tab) { _, _ in
            guard composerExpanded else { return }
            withAnimation(PrismMotion.morph) { composerExpanded = false }
        }
    }

    /// Only 독서 has a full authoring flow so far; the rest say so plainly
    /// rather than opening a form that cannot save.
    @ViewBuilder
    private func composerSheet(for accent: PrismAccent) -> some View {
        if accent == .reading {
            NewReadingSheet()
        } else {
            NavigationStack {
                ZStack {
                    SpectrumBloomBackground(focus: accent)
                    ContentUnavailableView {
                        Label("\(accent.label) 기록 작성은 준비 중입니다", systemImage: accent.symbol)
                    } description: {
                        Text("지금은 독서 기록만 앱에서 만들 수 있습니다.\n\(accent.label) 기록은 웹에서 추가한 뒤 여기서 확인하세요.")
                    }
                }
                .navigationTitle(accent.label)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("닫기") { pendingComposer = nil }
                    }
                }
            }
        }
    }
}

#Preview {
    RootView()
        .environment(PrismStore.preview())
}

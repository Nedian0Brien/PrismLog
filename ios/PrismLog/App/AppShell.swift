import SwiftUI

/// The app's root: four tabs over the library wall (spec §3, §4.6).
///
/// The shell owns the wall's state and context; each page draws it with
/// `prismWallBackground()`, because `TabView` hides anything laid beneath
/// it. The composer lives in each screen's toolbar rather than
/// floating over the tab bar, so iPhone Duo's vertical bar and fold are the
/// system's to work around.
struct AppShell: View {
    @Environment(PrismStore.self) private var store
    @Environment(LibraryWallModel.self) private var wall
    @Environment(\.scenePhase) private var scenePhase

    @State private var navigation = AppNavigationModel()

    @SceneStorage("shell.tab") private var storedTab = PrismTab.home.rawValue
    @SceneStorage("shell.recordsSection") private var storedSection = ""
    @SceneStorage("shell.recordsTop") private var storedRecord = ""

    #if DEBUG
    @State private var showsWallLab = WallLabScreen.opensOnLaunch
    #endif
    /// A wall context change waiting for the timeline's scroll to settle.
    @State private var contextChange: Task<Void, Never>?
    /// Off once the first screen's covers are ready, or the splash gave up.
    @State private var showsSplash = true
    /// The `+` tab's kind picker, and the kind picked in it — opened once
    /// the picker has gone, so one sheet follows the other.
    @State private var choosingComposer = false
    @State private var chosenComposer: PrismAccent?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        @Bindable var navigation = navigation

        return ZStack {
            PrismColor.background.ignoresSafeArea()

            TabView(selection: selection) {
                ForEach(PrismTab.allCases) { tab in
                    Tab(tab.title, systemImage: tab.symbol, value: ShellTab.page(tab)) {
                        content(for: tab)
                            .environment(\.prismTab, tab)
                    }
                }
                // `+` rides at the tab bar's end (iOS 27 prominent tab) —
                // bottom right on iPhone, the foot of iPhone Duo's vertical
                // bar — instead of floating in each screen's top bar
                // (user decision 2026-11-20). It opens the kind picker and
                // never becomes the selected tab.
                Tab("기록 작성", systemImage: "plus", value: ShellTab.compose, role: .prominent) {
                    Color.clear
                }
            }
            .tabViewStyle(.sidebarAdaptable)
            .tabBarMinimizeBehavior(.onScrollDown)
            .tint(navigation.tab.tintColor)

            if showsSplash {
                LaunchSplash()
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .onChange(of: wall.isReadyForLaunch, initial: true) { _, ready in
            if ready { liftSplash() }
        }
        .task {
            try? await Task.sleep(for: LaunchSplash.longestWait)
            liftSplash()
        }
        .environment(navigation)
        .saveRefractionPulse(store.lastSavedAccent)
        .sheet(item: $navigation.pendingComposer) { accent in
            composerSheet(for: accent)
        }
        .sheet(isPresented: $choosingComposer, onDismiss: {
            if let kind = chosenComposer {
                chosenComposer = nil
                navigation.pendingComposer = kind
            }
        }) {
            ComposerKindPicker { kind in
                chosenComposer = kind
                choosingComposer = false
            }
        }
        #if DEBUG
        .fullScreenCover(isPresented: $showsWallLab) { WallLabScreen() }
        #endif
        .task { await store.sync() }
        .task { await wall.loadDiscovery() }
        .onAppear(perform: restore)
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await store.sync() }
        }
        .onChange(of: store.records, initial: true) { wall.update(records: store.records) }
        .onChange(of: wallContext, initial: true) { old, new in
            contextChange?.cancel()
            // Scrolling the timeline changes its period continuously; the
            // wall relights its covers only once the scroll has settled.
            if case .period = old, case .period = new {
                contextChange = Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(400))
                    guard !Task.isCancelled else { return }
                    wall.context = new
                }
            } else {
                wall.context = new
            }
        }
        .onChange(of: libraryFeature, initial: true) { wall.feature = libraryFeature }
        .onChange(of: libraryFeatureActive, initial: true) { wall.featureActive = libraryFeatureActive }
        .onChange(of: libraryRevealed, initial: true) { wall.revealed = libraryRevealed }
        .onChange(of: navigation.tab) { storedTab = navigation.tab.rawValue }
        .onChange(of: navigation.recordsSection) { storedSection = navigation.recordsSection?.rawValue ?? "" }
        .onChange(of: navigation.paths[.records]) {
            storedRecord = navigation.paths[.records]?.last?.uuidString ?? ""
        }
    }

    @ViewBuilder
    private func content(for tab: PrismTab) -> some View {
        switch tab {
        case .home: LibraryScreen()
        case .records: RecordsScreen()
        case .timeline: TimelineScreen()
        case .settings: SettingsScreen()
        }
    }

    /// The library's big cover and pulled-down wall belong to the library
    /// page alone: another tab or a pushed record puts the plain wall back.
    private var onLibraryPage: Bool {
        navigation.tab == .home && navigation.topRecordID == nil
    }

    private var libraryFeature: [String]? {
        onLibraryPage ? navigation.libraryFeature : nil
    }

    private var libraryFeatureActive: Bool {
        onLibraryPage && navigation.libraryFeatureActive
    }

    private var libraryRevealed: Bool {
        onLibraryPage && navigation.libraryRevealed
    }

    /// The tab bar's selection: one of the four pages, or the `+` tab.
    private enum ShellTab: Hashable {
        case page(PrismTab)
        case compose
    }

    /// Picking `+` opens the kind picker and leaves the page where it was.
    private var selection: Binding<ShellTab> {
        Binding(
            get: { .page(navigation.tab) },
            set: { picked in
                switch picked {
                case .page(let tab): navigation.tab = tab
                case .compose:
                    PrismHaptics.selection()
                    choosingComposer = true
                }
            }
        )
    }

    /// The wall lights up as the splash fades away.
    private func liftSplash() {
        guard showsSplash else { return }
        withAnimation(.easeInOut(duration: reduceMotion ? 0.2 : 0.6)) { showsSplash = false }
    }

    /// What the wall shows behind the current screen (spec §3, §4.5).
    private var wallContext: WallContext {
        // A pushed record on any tab puts its cover behind it as the hero.
        if navigation.tab != .settings,
           let id = navigation.topRecordID,
           let record = store.record(id: id) {
            return .hero(record.entityID?.uuidString ?? record.id.uuidString)
        }
        switch navigation.tab {
        case .home:
            return .all
        case .records:
            return navigation.recordsSection.map(WallContext.category) ?? .all
        case .timeline:
            return navigation.timelinePeriod.map(WallContext.period) ?? .all
        case .settings:
            return .still
        }
    }

    /// Scene restoration: the tab, the open shelf, and the record on top of
    /// the records stack come back after the app is relaunched.
    private func restore() {
        if let tab = PrismTab(rawValue: storedTab) { navigation.tab = tab }
        navigation.recordsSection = PrismAccent(rawValue: storedSection)
        if let id = UUID(uuidString: storedRecord), store.record(id: id) != nil {
            navigation.paths[.records] = [id]
        }
    }

    @ViewBuilder
    private func composerSheet(for accent: PrismAccent) -> some View {
        switch accent {
        case .reading: NewReadingSheet()
        case .study: NewStudySheet()
        case .movie: NewCultureSheet(type: .movie)
        case .series: NewCultureSheet(type: .series)
        case .game: NewCultureSheet(type: .game)
        }
    }
}

// `PrismStore.preview()` exists in debug builds only.
#if DEBUG
#Preview {
    AppShell()
        .environment(PrismStore.preview())
        .environment(LibraryWallModel())
}
#endif

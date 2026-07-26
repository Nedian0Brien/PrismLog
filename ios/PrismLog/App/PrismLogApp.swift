import SwiftData
import SwiftUI

@main
struct PrismLogApp: App {
    private let container: ModelContainer
    @State private var store: PrismStore

    init() {
        let container = Self.makeContainer()
        self.container = container
        _store = State(initialValue: PrismStore(container: container))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .modelContainer(container)
                .preferredColorScheme(.dark)
                .tint(PrismAccent.reading.color)
        }
    }

    /// Falls back to an in-memory store rather than crashing on launch: a
    /// migration problem should cost the local cache, not the whole app.
    ///
    /// Unit tests run *inside* this app as their host, so the app would open the
    /// real on-disk store alongside the container each test builds. Two live
    /// stores for the same model traps inside SwiftData, which took down the
    /// whole test host — so under XCTest the app stays in memory.
    private static func makeContainer() -> ModelContainer {
        let inMemory = ModelConfiguration(isStoredInMemoryOnly: true)

        if isRunningTests {
            return try! ModelContainer(for: StoredLog.self, configurations: inMemory)
        }

        do {
            return try ModelContainer(for: StoredLog.self)
        } catch {
            return try! ModelContainer(for: StoredLog.self, configurations: inMemory)
        }
    }

    private static var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }
}

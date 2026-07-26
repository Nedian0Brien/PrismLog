import Foundation
import SwiftData

/// Local-first record store.
///
/// Reads and writes always hit SwiftData first so the app works offline and
/// edits appear instantly; the server is reconciled afterwards. Everything here
/// is main-actor bound because `ModelContext` is not `Sendable` — network calls
/// hop to `PrismAPIClient` (an actor) and come back with plain value types.
@MainActor
@Observable
final class PrismStore {
    enum SyncStatus: Equatable, Sendable {
        case idle
        case syncing
        case offline
        case failed(String)
    }

    private(set) var records: [RecordItem] = []
    private(set) var status: SyncStatus = .idle
    private(set) var lastSyncedAt: Date?
    private(set) var hasLoadedOnce = false

    var userID: String {
        didSet {
            UserDefaults.standard.set(userID, forKey: Self.userIDKey)
            reload()
        }
    }

    private static let userIDKey = "prism.userID"
    private static let defaultUserID = "demo-user"

    /// Held, not just borrowed: a `ModelContext` does not keep its container
    /// alive, and once the container deallocates every later fetch traps inside
    /// SwiftData with no diagnostic. Taking the container here makes that
    /// impossible to get wrong at a call site.
    private let container: ModelContainer
    private let context: ModelContext
    private let api: PrismAPIClient

    init(container: ModelContainer, api: PrismAPIClient = .shared) {
        self.container = container
        self.context = container.mainContext
        self.api = api
        self.userID = UserDefaults.standard.string(forKey: Self.userIDKey) ?? Self.defaultUserID
        reload()
    }

    /// Pending local writes, surfaced so Settings can show "n건 대기 중".
    var pendingChangeCount: Int {
        (try? context.fetchCount(FetchDescriptor<StoredLog>(
            predicate: #Predicate { $0.syncStateRaw != "synced" }
        ))) ?? 0
    }

    // MARK: - Local reads

    func reload() {
        let user = userID
        var descriptor = FetchDescriptor<StoredLog>(
            predicate: #Predicate { $0.userID == user && $0.syncStateRaw != "deletedLocally" },
            sortBy: [SortDescriptor(\.occurredAt, order: .reverse)]
        )
        descriptor.fetchLimit = 500

        let stored = (try? context.fetch(descriptor)) ?? []
        records = stored.map(RecordItem.init(stored:))
    }

    func records(in category: LogCategory) -> [RecordItem] {
        records.filter { $0.category == category }
    }

    func record(id: UUID) -> RecordItem? {
        records.first { $0.id == id }
    }

    // MARK: - Sync

    /// Pushes queued local changes, then pulls the server's view of the world.
    func sync() async {
        guard status != .syncing else { return }
        status = .syncing

        do {
            try await push()
            try await pull()
            lastSyncedAt = .now
            hasLoadedOnce = true
            status = .idle
        } catch is CancellationError {
            status = .idle
        } catch PrismAPIError.offline {
            hasLoadedOnce = true
            status = .offline
        } catch {
            status = .failed(error.localizedDescription)
        }

        reload()
    }

    private func push() async throws {
        let pending = try context.fetch(FetchDescriptor<StoredLog>(
            predicate: #Predicate { $0.syncStateRaw != "synced" }
        ))

        for log in pending {
            switch log.syncState {
            case .synced:
                continue

            case .createdLocally:
                let dto = try await api.createLog(LogCreateDTO(
                    userId: log.userID,
                    category: log.category,
                    entityId: log.entityID,
                    title: log.title,
                    summary: log.summary,
                    tags: log.tags,
                    payload: log.payload,
                    occurredAt: log.occurredAt
                ))
                // The server assigns the real id; drop the local placeholder.
                context.delete(log)
                context.insert(StoredLog(dto: dto))

            case .modifiedLocally:
                let dto = try await api.updateLog(id: log.id, patch: LogUpdateDTO(
                    title: .some(log.title),
                    summary: log.summary,
                    tags: log.tags,
                    payload: log.payload,
                    occurredAt: log.occurredAt
                ))
                log.apply(dto)

            case .deletedLocally:
                try await api.deleteLog(id: log.id)
                context.delete(log)
            }
        }

        try context.save()
    }

    private func pull() async throws {
        let user = userID
        let remote = try await api.fetchAllLogs(userID: user)

        let local = try context.fetch(FetchDescriptor<StoredLog>(
            predicate: #Predicate { $0.userID == user }
        ))
        var byID = Dictionary(local.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

        for dto in remote {
            if let existing = byID.removeValue(forKey: dto.id) {
                // A local edit that hasn't reached the server yet outranks the
                // server copy; it will be pushed on the next round.
                if existing.syncState == .synced {
                    existing.apply(dto)
                }
            } else {
                context.insert(StoredLog(dto: dto))
            }
        }

        // Anything left is gone from the server. Rows still carrying local work
        // are kept so the push can finish.
        for orphan in byID.values where orphan.syncState == .synced {
            context.delete(orphan)
        }

        try context.save()
    }

    // MARK: - Local writes

    /// Edits a record's payload without disturbing keys this app doesn't model.
    ///
    /// `mutate` receives the record's full payload — including every field the
    /// web wrote — and whatever it leaves in place is sent back verbatim.
    func updateRecord(id: UUID, mutate: (inout [String: JSONValue]) -> Void) async {
        guard let log = storedLog(id: id) else { return }

        var payload = log.payload
        mutate(&payload)
        log.payload = payload
        log.updatedAt = .now
        if log.syncState == .synced { log.syncState = .modifiedLocally }

        try? context.save()
        reload()

        await sync()
    }

    func deleteRecord(id: UUID) async {
        guard let log = storedLog(id: id) else { return }

        if log.syncState == .createdLocally {
            context.delete(log) // never reached the server
        } else {
            log.syncState = .deletedLocally
        }

        try? context.save()
        reload()

        await sync()
    }

    private func storedLog(id: UUID) -> StoredLog? {
        var descriptor = FetchDescriptor<StoredLog>(predicate: #Predicate { $0.id == id })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }
}

#if DEBUG
extension PrismStore {
    /// An empty in-memory store for previews, so canvases never touch the
    /// real database or the network.
    static func preview() -> PrismStore {
        PrismStore(
            container: try! ModelContainer(
                for: StoredLog.self,
                configurations: ModelConfiguration(isStoredInMemoryOnly: true)
            )
        )
    }
}
#endif

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

    /// Set briefly after a successful write so the UI can flash refracted light
    /// in that category's color. Cleared on its own.
    private(set) var lastSavedAccent: PrismAccent?

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
        publishSnapshot()
    }

    /// Keeps the home screen widget in step with what the app is showing.
    private func publishSnapshot() {
        let snapshot = SpectrumSnapshot(
            reading: records(in: .reading).count,
            study: records(in: .study).count,
            culture: records(in: .culture).count,
            streakDays: currentStreak,
            latestTitle: records.first?.title,
            updatedAt: .now
        )

        SpectrumSnapshotStore.write(snapshot)
        WidgetRefresher.reload()
    }

    /// Consecutive days ending today (or yesterday, so a streak doesn't look
    /// broken before you've recorded anything today).
    private var currentStreak: Int {
        let calendar = Calendar.current
        let days = Set(records.map { calendar.startOfDay(for: $0.occurredAt) })
        guard !days.isEmpty else { return 0 }

        var cursor = calendar.startOfDay(for: .now)
        if !days.contains(cursor) {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor),
                  days.contains(yesterday) else { return 0 }
            cursor = yesterday
        }

        var streak = 0
        while days.contains(cursor) {
            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return streak
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
                // The entity has to exist first — the web creates one for every
                // record and links it, and the backend's uniqueness on
                // (user_id, source_id) is what stops the same book being added
                // twice from two clients.
                if log.needsEntity, log.entityID == nil {
                    let entity = try await api.createEntity(LogEntityCreateDTO(
                        userId: log.userID,
                        category: log.category,
                        title: log.title ?? "제목 없음",
                        sourceId: log.pendingEntitySourceID,
                        entityMetadata: log.payload
                    ))
                    log.entityID = entity.id
                    log.needsEntity = false
                    try context.save()
                }

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
        flashSaved(record(id: id)?.accent)

        await sync()
    }

    private func flashSaved(_ accent: PrismAccent?) {
        guard let accent else { return }
        lastSavedAccent = accent

        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(1100))
            guard let self, self.lastSavedAccent == accent else { return }
            self.lastSavedAccent = nil
        }
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

    // MARK: - Reading writes
    //
    // Payload keys mirror what the web writes (`src/App.jsx` addReadingProgress /
    // addReadingNote). Anything not named here is carried over untouched.

    /// Creates a book record from a search result.
    ///
    /// The payload mirrors what the web writes field for field — a record
    /// created here has to open cleanly in the web's edit sheet, which reads
    /// `medium`, `reading_status`, `progress_mode` and friends.
    func createReadingRecord(
        from book: BookSearchItem,
        enrichment: BookEnrichment?,
        draft: ReadingDraft
    ) async {
        let total = max(draft.pagesTotal, 0)
        let read = min(max(draft.pagesRead, 0), total > 0 ? total : draft.pagesRead)

        var payload: [String: JSONValue] = [
            "author": .string(book.authorLine),
            "pages_read": .int(read),
            "pages_total": .int(total),
            "progress": .int(draft.progress),
            "progress_mode": .string("page"),
            "progress_value": .int(draft.progress),
            "medium": .string(draft.medium.rawValue),
            "reading_status": .string(draft.status.rawValue),
            "rating": .int(draft.rating),
            "review": .string(draft.review),
            "reading_sessions": .array([]),
            "reading_notes": .array([]),
            "source_provider": .string(book.sourceProvider),
            "source_id": .string(book.sourceId),
        ]

        if let service = draft.ebookService, draft.medium == .ebook {
            payload["ebook_service"] = .string(service.rawValue)
        }
        if let publisher = book.publisher { payload["publisher"] = .string(publisher) }
        if let isbn = book.isbn { payload["isbn"] = .string(isbn) }
        if let isbn13 = book.isbn13 { payload["isbn13"] = .string(isbn13) }
        if let date = book.publishedDate { payload["published_date"] = .string(date) }
        if let description = book.description { payload["description"] = .string(description) }
        if let cover = book.coverUrl { payload["cover"] = .string(cover) }
        if let enrichment {
            payload["enrichment_provider"] = .string(enrichment.sourceProvider)
            if !enrichment.sourceMetadata.isEmpty {
                payload["source_metadata"] = .object(enrichment.sourceMetadata)
            }
        }

        let memo = draft.memo.trimmingCharacters(in: .whitespacesAndNewlines)
        if !memo.isEmpty {
            payload["reading_notes"] = .array([Self.note(text: memo, page: read, date: .now)])
        }

        // Same precedence the web uses when it creates the entity.
        let entitySourceID = book.sourceId.isEmpty
            ? (book.isbn13 ?? book.isbn)
            : book.sourceId

        let log = StoredLog(
            id: UUID(),
            userID: userID,
            category: LogCategory.reading.rawValue,
            title: book.title,
            tags: draft.tags,
            payloadData: StoredLog.encodeObject(payload),
            pendingEntitySourceID: entitySourceID,
            needsEntity: true,
            syncState: .createdLocally
        )

        context.insert(log)
        try? context.save()
        reload()
        flashSaved(.reading)

        await sync()
    }

    /// Edits the fields the web's `ReadingEditSheet` exposes. Title and tags
    /// live on the log row; the rest live in the payload.
    func updateReadingMeta(
        id: UUID,
        title: String,
        author: String,
        rating: Int,
        review: String,
        status: ReadingStatus,
        medium: ReadingMedium,
        ebookService: EbookService?,
        tags: [String]
    ) async {
        guard let log = storedLog(id: id) else { return }

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTitle.isEmpty { log.title = trimmedTitle }
        log.tags = tags

        var payload = log.payload
        payload["author"] = .string(author)
        payload["rating"] = .int(min(max(rating, 0), 5))
        payload["review"] = .string(review)
        payload["reading_status"] = .string(status.rawValue)
        payload["medium"] = .string(medium.rawValue)
        if medium == .ebook, let ebookService {
            payload["ebook_service"] = .string(ebookService.rawValue)
        } else {
            payload["ebook_service"] = nil
        }
        log.payload = payload

        log.updatedAt = .now
        if log.syncState == .synced { log.syncState = .modifiedLocally }

        try? context.save()
        reload()
        flashSaved(.reading)

        await sync()
    }

    /// Compresses and uploads photos, returning the stored (relative) paths.
    /// Failures are skipped rather than aborting the whole batch — losing one
    /// photo should not lose the reading session it belongs to.
    func uploadPhotos(_ images: [Data], category: String = "reading-sessions") async -> [String] {
        var stored: [String] = []
        for image in images {
            if let path = try? await api.uploadPhoto(category: category, jpeg: image) {
                stored.append(path)
            }
        }
        return stored
    }

    /// Records progress and appends a reading session, the way the web does —
    /// one session per day, extended rather than duplicated.
    func addReadingProgress(
        to id: UUID,
        currentPage: Int,
        totalPages: Int,
        note: String,
        startedAt: Date? = nil,
        endedAt: Date? = nil,
        photoPaths: [String] = [],
        at date: Date = .now
    ) async {
        guard let existing = record(id: id) else { return }

        let total = max(totalPages, 1)
        let read = min(max(currentPage, 0), total)
        let progress = Int((Double(read) / Double(total) * 100).rounded())
        let fromPages = existing.pagesRead
        let fromProgress = existing.progress

        await updateRecord(id: id) { payload in
            payload["pages_read"] = .int(read)
            payload["pages_total"] = .int(total)
            payload["progress"] = .int(progress)

            let ended = endedAt ?? date
            let started = startedAt ?? ended
            // Same derivation as the web: duration comes from the two stamps,
            // never entered directly.
            let minutes = max(0, Int(ended.timeIntervalSince(started) / 60))

            let dayKey = ISO8601DateFormatter().string(from: ended).prefix(10)
            var sessions = payload["reading_sessions"]?.arrayValue ?? []
            let existingSession = sessions.first {
                $0["id"]?.stringValue == "reading-session-\(dayKey)"
            }

            // Extending today's session keeps the photos already on it.
            let carriedPhotos = existingSession?["photos"]?.arrayValue ?? []
            let photos = carriedPhotos + photoPaths.map { JSONValue.string($0) }

            let session: JSONValue = .object([
                "id": .string("reading-session-\(dayKey)"),
                "date": .string(Self.iso(ended)),
                "started_at": .string(Self.iso(started)),
                "ended_at": .string(Self.iso(ended)),
                "from_pages": .int(existingSession?["from_pages"]?.intValue ?? fromPages),
                "to_pages": .int(read),
                "total_pages": .int(total),
                "pages_read": .int(max(0, read - (existingSession?["from_pages"]?.intValue ?? fromPages))),
                "from_progress": .int(existingSession?["from_progress"]?.intValue ?? fromProgress),
                "to_progress": .int(progress),
                "progress_delta": .int(max(0, progress - (existingSession?["from_progress"]?.intValue ?? fromProgress))),
                "duration_minutes": .int(minutes),
                "photos": .array(photos),
            ])

            // Same-day sessions merge, matching `buildReadingSessionPatch`.
            if let index = sessions.firstIndex(where: {
                $0["id"]?.stringValue == "reading-session-\(dayKey)"
            }) {
                sessions[index] = session
            } else {
                sessions.insert(session, at: 0)
            }
            payload["reading_sessions"] = .array(sessions)

            let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                var notes = payload["reading_notes"]?.arrayValue ?? []
                notes.insert(Self.note(text: trimmed, page: read, date: date), at: 0)
                payload["reading_notes"] = .array(notes)
            }
        }
    }

    func addReadingNote(to id: UUID, page: Int, text: String, at date: Date = .now) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        await updateRecord(id: id) { payload in
            var notes = payload["reading_notes"]?.arrayValue ?? []
            notes.insert(Self.note(text: trimmed, page: page, date: date), at: 0)
            payload["reading_notes"] = .array(notes)
        }
    }

    private static func note(text: String, page: Int, date: Date) -> JSONValue {
        .object([
            "id": .string("reading-note-\(Int(date.timeIntervalSince1970 * 1000))"),
            "date": .string(iso(date)),
            "page": .int(page),
            "text": .string(text),
        ])
    }

    private static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
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

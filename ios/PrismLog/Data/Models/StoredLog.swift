import Foundation
import SwiftData

/// What still needs to reach the server for this row.
enum LogSyncState: String, Codable, Sendable {
    case synced
    case createdLocally
    case modifiedLocally
    case deletedLocally
}

/// The local mirror of one `logs` row.
///
/// The joined entity is denormalized onto the row rather than modelled
/// separately: the API always returns it inline, and the UI merges
/// `entity_metadata` with `payload` anyway (see `mappers.js`).
///
/// Deletions keep the row with `.deletedLocally` until the server confirms, so
/// an offline delete survives a relaunch instead of quietly coming back on the
/// next pull.
@Model
final class StoredLog {
    #Index<StoredLog>([\.occurredAt], [\.category])

    @Attribute(.unique) var id: UUID
    var userID: String
    var category: String
    var entityID: UUID?
    var title: String?
    var summary: String
    var tags: [String]
    /// Encoded `[String: JSONValue]` — kept whole so unknown keys survive edits.
    var payloadData: Data
    var occurredAt: Date
    var createdAt: Date
    var updatedAt: Date

    var entityTitle: String?
    var entityMetadataData: Data?

    /// Set on locally-created records that still need a `LogEntity` on the
    /// server. The web always creates one first and links `entity_id`; the
    /// backend dedupes on `(user_id, source_id)`, so pushing this later gives
    /// the same result as creating it up front — and works offline.
    var pendingEntitySourceID: String?
    var needsEntity: Bool = false

    var syncStateRaw: String

    init(
        id: UUID,
        userID: String,
        category: String,
        entityID: UUID? = nil,
        title: String? = nil,
        summary: String = "",
        tags: [String] = [],
        payloadData: Data = Data("{}".utf8),
        occurredAt: Date = .now,
        createdAt: Date = .now,
        updatedAt: Date = .now,
        entityTitle: String? = nil,
        entityMetadataData: Data? = nil,
        pendingEntitySourceID: String? = nil,
        needsEntity: Bool = false,
        syncState: LogSyncState = .synced
    ) {
        self.id = id
        self.userID = userID
        self.category = category
        self.entityID = entityID
        self.title = title
        self.summary = summary
        self.tags = tags
        self.payloadData = payloadData
        self.occurredAt = occurredAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.entityTitle = entityTitle
        self.entityMetadataData = entityMetadataData
        self.pendingEntitySourceID = pendingEntitySourceID
        self.needsEntity = needsEntity
        self.syncStateRaw = syncState.rawValue
    }

    var syncState: LogSyncState {
        get { LogSyncState(rawValue: syncStateRaw) ?? .synced }
        set { syncStateRaw = newValue.rawValue }
    }

    var payload: [String: JSONValue] {
        get { Self.decodeObject(payloadData) }
        set { payloadData = Self.encodeObject(newValue) }
    }

    var entityMetadata: [String: JSONValue] {
        entityMetadataData.map(Self.decodeObject) ?? [:]
    }

    // MARK: - Server sync

    convenience init(dto: LogDTO) {
        self.init(
            id: dto.id,
            userID: dto.userId,
            category: dto.category,
            entityID: dto.entityId,
            title: dto.title,
            summary: dto.summary,
            tags: dto.tags,
            payloadData: Self.encodeObject(dto.payload),
            occurredAt: dto.occurredAt,
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
            entityTitle: dto.entity?.title,
            entityMetadataData: dto.entity.map { Self.encodeObject($0.entityMetadata) },
            syncState: .synced
        )
    }

    func apply(_ dto: LogDTO) {
        userID = dto.userId
        category = dto.category
        entityID = dto.entityId
        title = dto.title
        summary = dto.summary
        tags = dto.tags
        payloadData = Self.encodeObject(dto.payload)
        occurredAt = dto.occurredAt
        createdAt = dto.createdAt
        updatedAt = dto.updatedAt
        entityTitle = dto.entity?.title
        entityMetadataData = dto.entity.map { Self.encodeObject($0.entityMetadata) }
        pendingEntitySourceID = nil
        needsEntity = false
        syncState = .synced
    }

    // MARK: - Coding

    static func encodeObject(_ object: [String: JSONValue]) -> Data {
        (try? JSONEncoder().encode(object)) ?? Data("{}".utf8)
    }

    static func decodeObject(_ data: Data) -> [String: JSONValue] {
        (try? JSONDecoder().decode([String: JSONValue].self, from: data)) ?? [:]
    }
}

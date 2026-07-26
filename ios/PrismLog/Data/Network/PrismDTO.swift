import Foundation

/// Wire types mirroring `backend/app/schemas.py`.
///
/// Coding keys are spelled out rather than using `.convertFromSnakeCase`: that
/// strategy also rewrites the keys *inside* `[String: JSONValue]` dictionaries,
/// which would rename every payload field (`pages_read` → `pagesRead`) on the
/// way in and corrupt the record on the way back out.

struct LogEntityDTO: Codable, Sendable, Identifiable, Hashable {
    let id: UUID
    let userId: String
    let category: String
    let title: String
    let sourceId: String?
    let entityMetadata: [String: JSONValue]
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case category
        case title
        case sourceId = "source_id"
        case entityMetadata = "entity_metadata"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct LogDTO: Codable, Sendable, Identifiable, Hashable {
    let id: UUID
    let userId: String
    let category: String
    let entityId: UUID?
    let title: String?
    let summary: String
    let tags: [String]
    let payload: [String: JSONValue]
    let occurredAt: Date
    let createdAt: Date
    let updatedAt: Date
    let entity: LogEntityDTO?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case category
        case entityId = "entity_id"
        case title
        case summary
        case tags
        case payload
        case occurredAt = "occurred_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case entity
    }
}

// MARK: - Requests

struct LogCreateDTO: Codable, Sendable {
    let userId: String
    let category: String
    var entityId: UUID?
    var title: String?
    var summary: String = ""
    var tags: [String] = []
    var payload: [String: JSONValue] = [:]
    var occurredAt: Date?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case category
        case entityId = "entity_id"
        case title
        case summary
        case tags
        case payload
        case occurredAt = "occurred_at"
    }
}

/// Only the fields actually being changed are encoded — the backend applies a
/// partial update, so omitting a key leaves it alone.
struct LogUpdateDTO: Codable, Sendable {
    var title: String??
    var summary: String?
    var tags: [String]?
    var payload: [String: JSONValue]?
    var occurredAt: Date?

    enum CodingKeys: String, CodingKey {
        case title, summary, tags, payload
        case occurredAt = "occurred_at"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let title { try container.encode(title, forKey: .title) }
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encodeIfPresent(tags, forKey: .tags)
        try container.encodeIfPresent(payload, forKey: .payload)
        try container.encodeIfPresent(occurredAt, forKey: .occurredAt)
    }
}

struct LogEntityCreateDTO: Codable, Sendable {
    let userId: String
    let category: String
    let title: String
    var sourceId: String?
    var entityMetadata: [String: JSONValue] = [:]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case category
        case title
        case sourceId = "source_id"
        case entityMetadata = "entity_metadata"
    }
}

/// `entity_metadata` here is *merged* server-side (`routers/logs.py`), not
/// replaced, so a partial dictionary is safe.
struct LogEntityUpdateDTO: Codable, Sendable {
    var title: String?
    var entityMetadata: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case title
        case entityMetadata = "entity_metadata"
    }
}

// MARK: - Dates

enum PrismDateCoding {
    /// The API emits microsecond precision (`…T01:23:05.456065Z`) while nested
    /// payload timestamps written by the web use milliseconds (`…T01:23:03.584Z`)
    /// and some legacy rows carry no fractional part at all.
    static let decoding = JSONDecoder.DateDecodingStrategy.custom { decoder in
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)

        if let date = parse(raw) { return date }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "날짜 형식을 해석할 수 없음: \(raw)"
        )
    }

    static let encoding = JSONEncoder.DateEncodingStrategy.custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(fractionalFormatter.string(from: date))
    }

    static func parse(_ raw: String) -> Date? {
        if let date = fractionalFormatter.date(from: raw) { return date }
        if let date = plainFormatter.date(from: raw) { return date }

        // Trim over-long fractional digits (ISO8601DateFormatter only takes 3).
        if let dot = raw.firstIndex(of: "."),
           let fractionEnd = raw[dot...].firstIndex(where: { $0 == "Z" || $0 == "+" || $0 == "-" }) {
            let trimmed = raw[..<dot] + raw[dot...].prefix(4) + raw[fractionEnd...]
            return fractionalFormatter.date(from: String(trimmed))
        }

        return nil
    }

    // `ISO8601DateFormatter` isn't marked `Sendable`, but Foundation's date
    // formatters are documented as thread-safe once configured, and these are
    // only ever read. Rebuilding one per date would be wasteful — a sync parses
    // thousands across nested session arrays.
    nonisolated(unsafe) private static let fractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) private static let plainFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

extension JSONDecoder {
    static var prism: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = PrismDateCoding.decoding
        return decoder
    }
}

extension JSONEncoder {
    static var prism: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = PrismDateCoding.encoding
        return encoder
    }
}

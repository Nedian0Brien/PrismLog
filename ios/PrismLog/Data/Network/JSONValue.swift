import Foundation

/// A lossless representation of arbitrary JSON.
///
/// This is the single most important type in the data layer. `logs.payload` and
/// `log_entities.entity_metadata` are free-form JSONB that the web app keeps
/// writing to — a live snapshot carries 80+ distinct keys, including snake_case
/// and camelCase spellings of the same field (`pages_read` *and* `pagesRead`),
/// nested session arrays, and explicit nulls.
///
/// If iOS decoded that into a typed struct and re-encoded it on PATCH, every key
/// this app doesn't know about would be silently deleted from the user's real
/// data. So the payload is carried as `JSONValue` end to end, typed accessors
/// read from it, and edits are applied key-by-key onto the original.
enum JSONValue: Hashable, Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

// MARK: - Codable

extension JSONValue: Codable {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            // Int before Double so round-tripping 400 doesn't yield 400.0.
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "지원하지 않는 JSON 값"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

// MARK: - Reading

extension JSONValue {
    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var intValue: Int? {
        switch self {
        case .int(let value): value
        case .double(let value): Int(value)
        case .string(let value): Int(value)
        default: nil
        }
    }

    var doubleValue: Double? {
        switch self {
        case .int(let value): Double(value)
        case .double(let value): value
        case .string(let value): Double(value)
        default: nil
        }
    }

    var boolValue: Bool? {
        switch self {
        case .bool(let value): value
        case .int(let value): value != 0
        default: nil
        }
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    subscript(key: String) -> JSONValue? {
        objectValue?[key]
    }
}

// MARK: - Snake/camel tolerance

extension [String: JSONValue] {
    /// Looks a key up under both spellings the web writes.
    ///
    /// `src/features/prismlog/mappers.js` reads `pages_read || readPages` on
    /// every field; the stored data really does contain both, sometimes in the
    /// same record. Ported here so the two clients agree on what a record says.
    func value(_ key: String) -> JSONValue? {
        if let direct = self[key], !direct.isNull { return direct }

        let alternate = key.contains("_") ? key.camelCased : key.snakeCased
        if let fallback = self[alternate], !fallback.isNull { return fallback }

        return nil
    }

    func string(_ key: String) -> String? { value(key)?.stringValue }
    func int(_ key: String) -> Int? { value(key)?.intValue }
    func double(_ key: String) -> Double? { value(key)?.doubleValue }
    func bool(_ key: String) -> Bool? { value(key)?.boolValue }
    func array(_ key: String) -> [JSONValue]? { value(key)?.arrayValue }
    func object(_ key: String) -> [String: JSONValue]? { value(key)?.objectValue }
}

extension String {
    var camelCased: String {
        let parts = split(separator: "_").map(String.init)
        guard let first = parts.first else { return self }
        return ([first] + parts.dropFirst().map(\.capitalizedFirst)).joined()
    }

    var snakeCased: String {
        var result = ""
        for character in self {
            if character.isUppercase {
                result.append("_")
                result.append(Character(character.lowercased()))
            } else {
                result.append(character)
            }
        }
        return result
    }

    fileprivate var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}

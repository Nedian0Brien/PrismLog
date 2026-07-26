import Foundation

enum LogCategory: String, Codable, Sendable, CaseIterable {
    case reading, study, culture, movie, series, game
}

/// The three shapes a `culture` record can take. Stored in `payload.type` as a
/// Korean string; normalization ported from `normalizeCultureType`
/// (`src/features/prismlog/core.jsx:777`).
enum CultureType: String, Codable, Sendable, CaseIterable {
    case movie = "영화"
    case series = "시리즈"
    case game = "게임"

    init(payloadValue: String?) {
        switch payloadValue {
        case "TV", "드라마", "시리즈": self = .series
        case "게임": self = .game
        default: self = .movie
        }
    }
}

struct ReadingSession: Identifiable, Hashable, Sendable {
    let id: String
    let date: Date?
    let fromPages: Int
    let toPages: Int
    let pagesRead: Int
    let fromProgress: Int
    let toProgress: Int
    let durationMinutes: Int
    let photos: [String]
}

struct ReadingNote: Identifiable, Hashable, Sendable {
    let id: String
    let date: Date?
    let page: Int
    let text: String
}

/// One record, ready for the UI.
///
/// A port of `mapLogToUiItem` (`src/features/prismlog/mappers.js:17`), including
/// its entity-metadata-under-payload merge and its tolerance for both key
/// spellings. `payload` keeps the untouched original so edits can be applied
/// without dropping fields this app doesn't model.
struct RecordItem: Identifiable, Hashable, Sendable {
    let id: UUID
    let entityID: UUID?
    let category: LogCategory
    let cultureType: CultureType?
    let title: String
    let summary: String
    let tags: [String]
    let coverURL: URL?
    let author: String?
    let progress: Int
    let pagesRead: Int
    let pagesTotal: Int
    let rating: Int
    let review: String
    let status: String?
    let hours: Double
    let readingSessions: [ReadingSession]
    let readingNotes: [ReadingNote]
    let occurredAt: Date
    let createdAt: Date
    let updatedAt: Date
    let payload: [String: JSONValue]

    var accent: PrismAccent {
        switch category {
        case .reading: .reading
        case .study: .study
        case .movie: .movie
        case .series: .series
        case .game: .game
        case .culture:
            switch cultureType ?? .movie {
            case .movie: .movie
            case .series: .series
            case .game: .game
            }
        }
    }

    var categoryLabel: String {
        category == .culture ? (cultureType ?? .movie).rawValue : accent.label
    }
}

// MARK: - Mapping

extension RecordItem {
    init(stored: StoredLog) {
        // Entity metadata first, payload second: the payload wins on conflict,
        // matching the web's `{ ...entityMetadata, ...payload }` merge.
        var combined = stored.entityMetadata
        for (key, value) in stored.payload { combined[key] = value }

        let category = LogCategory(rawValue: stored.category) ?? .reading
        let cultureType: CultureType? = category == .culture
            ? CultureType(payloadValue: combined.string("type"))
            : nil

        let pagesRead = combined.int("pages_read") ?? combined.int("readPages") ?? 0
        let pagesTotal = combined.int("pages_total") ?? combined.int("pages") ?? 0

        var progress = combined.int("progress") ?? 0
        if category == .reading, pagesTotal > 0 {
            progress = min(max(Int((Double(pagesRead) / Double(pagesTotal) * 100).rounded()), 0), 100)
        }

        self.id = stored.id
        self.entityID = stored.entityID
        self.category = category
        self.cultureType = cultureType
        self.title = stored.title ?? stored.entityTitle ?? combined.string("title") ?? "제목 없음"
        self.summary = stored.summary
        self.tags = stored.tags
        self.coverURL = [
            combined.string("cover"),
            combined.string("poster"),
            combined.string("image_url"),
        ]
        .compactMap { $0 }
        .first
        .flatMap(URL.init(string:))
        self.author = combined.string("author")
        self.progress = progress
        self.pagesRead = pagesRead
        self.pagesTotal = pagesTotal
        self.rating = min(max(combined.int("rating") ?? 0, 0), 5)
        self.review = combined.string("review") ?? ""
        self.status = combined.string("status")
        self.hours = combined.double("hours") ?? 0
        self.readingSessions = Self.sessions(from: combined)
        self.readingNotes = Self.notes(from: combined)
        self.occurredAt = stored.occurredAt
        self.createdAt = stored.createdAt
        self.updatedAt = stored.updatedAt
        self.payload = stored.payload
    }

    private static func sessions(from combined: [String: JSONValue]) -> [ReadingSession] {
        let raw = combined.array("reading_sessions") ?? []

        return raw.enumerated().compactMap { index, entry in
            guard let fields = entry.objectValue else { return nil }
            return ReadingSession(
                id: fields.string("id") ?? "session-\(index)",
                date: (fields.string("ended_at") ?? fields.string("date")).flatMap(PrismDateCoding.parse),
                fromPages: fields.int("from_pages") ?? 0,
                toPages: fields.int("to_pages") ?? 0,
                pagesRead: fields.int("pages_read") ?? 0,
                fromProgress: fields.int("from_progress") ?? 0,
                toProgress: fields.int("to_progress") ?? 0,
                durationMinutes: fields.int("duration_minutes") ?? 0,
                photos: (fields.array("photos") ?? []).compactMap(\.stringValue)
            )
        }
        .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }

    private static func notes(from combined: [String: JSONValue]) -> [ReadingNote] {
        let raw = combined.array("reading_notes") ?? []

        return raw.enumerated().compactMap { index, entry in
            guard let fields = entry.objectValue else { return nil }
            return ReadingNote(
                id: fields.string("id") ?? "note-\(index)",
                date: fields.string("date").flatMap(PrismDateCoding.parse),
                page: fields.int("page") ?? 0,
                text: fields.string("text") ?? ""
            )
        }
        .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }
}

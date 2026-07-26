import Foundation

/// Book lookup results proxied by the backend (네이버 · 카카오 for search,
/// 구글북스 · 국립중앙도서관 for enrichment). The provider keys live on the
/// server, so the app cannot search these sources directly.
struct BookSearchItem: Codable, Sendable, Hashable, Identifiable {
    let sourceProvider: String
    let sourceId: String
    let title: String
    let authors: [String]
    let publisher: String?
    let isbn: String?
    let isbn13: String?
    let coverUrl: String?
    let publishedDate: String?
    let description: String?
    let pagesTotal: Int?

    var id: String { sourceId }

    var authorLine: String { authors.joined(separator: ", ") }
    var coverURL: URL? { coverUrl.flatMap(URL.init(string:)) }

    enum CodingKeys: String, CodingKey {
        case sourceProvider = "source_provider"
        case sourceId = "source_id"
        case title, authors, publisher, isbn
        case isbn13
        case coverUrl = "cover_url"
        case publishedDate = "published_date"
        case description
        case pagesTotal = "pages_total"
    }
}

struct BookSearchResponse: Codable, Sendable {
    let items: [BookSearchItem]
}

struct BookEnrichment: Codable, Sendable {
    let sourceProvider: String
    let isbn: String
    let pagesTotal: Int?
    let title: String?
    let authors: [String]
    let publisher: String?
    let publishedDate: String?
    let description: String?
    let coverUrl: String?
    let sourceMetadata: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case sourceProvider = "source_provider"
        case isbn
        case pagesTotal = "pages_total"
        case title, authors, publisher
        case publishedDate = "published_date"
        case description
        case coverUrl = "cover_url"
        case sourceMetadata = "source_metadata"
    }
}

extension PrismAPIClient {
    func searchBooks(query: String, limit: Int = 8) async throws -> [BookSearchItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        let response: BookSearchResponse = try await get(
            "/api/v1/books/search",
            query: [
                URLQueryItem(name: "q", value: trimmed),
                URLQueryItem(name: "limit", value: String(min(limit, 10))),
            ]
        )
        return response.items
    }

    /// Fills in the page count, which search results often omit — and without it
    /// there is no progress to track.
    func enrichBook(isbn: String) async throws -> BookEnrichment {
        try await get("/api/v1/books/enrich", query: [URLQueryItem(name: "isbn", value: isbn)])
    }
}

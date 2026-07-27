import Foundation

/// TMDB / IGDB results proxied by the backend, which holds the API keys.
struct MediaSearchItem: Codable, Sendable, Hashable, Identifiable {
    let sourceProvider: String
    let sourceId: String
    let tmdbId: Int?
    let igdbId: Int?
    let type: String
    let title: String
    let originalTitle: String?
    let posterUrl: String?
    let releaseDate: String?
    let overview: String?
    let episodeCount: Int?
    let seasonCount: Int?

    var id: String { sourceId }
    var posterURL: URL? { posterUrl.flatMap(PrismMedia.url(for:)) }
    var cultureType: CultureType {
        switch type {
        case "series": .series
        case "game": .game
        default: .movie
        }
    }

    enum CodingKeys: String, CodingKey {
        case sourceProvider = "source_provider"
        case sourceId = "source_id"
        case tmdbId = "tmdb_id"
        case igdbId = "igdb_id"
        case type, title
        case originalTitle = "original_title"
        case posterUrl = "poster_url"
        case releaseDate = "release_date"
        case overview
        case episodeCount = "episode_count"
        case seasonCount = "season_count"
    }
}

struct MediaSearchResponse: Codable, Sendable {
    let items: [MediaSearchItem]
}

struct MediaEpisodeInfo: Codable, Sendable, Hashable {
    let seasonNumber: Int
    let episodeNumber: Int
    let name: String?
    let airDate: String?
    let runtime: Int?

    enum CodingKeys: String, CodingKey {
        case seasonNumber = "season_number"
        case episodeNumber = "episode_number"
        case name
        case airDate = "air_date"
        case runtime
    }
}

struct MediaSeasonInfo: Codable, Sendable, Hashable {
    let seasonNumber: Int
    let name: String?
    let airDate: String?
    let episodeCount: Int?
    let episodes: [MediaEpisodeInfo]

    enum CodingKeys: String, CodingKey {
        case seasonNumber = "season_number"
        case name
        case airDate = "air_date"
        case episodeCount = "episode_count"
        case episodes
    }
}

struct MediaEnrichment: Codable, Sendable {
    let type: String
    let tmdbId: Int
    let episodeCount: Int?
    let seasonCount: Int?
    let runtime: Int?
    let seasons: [MediaSeasonInfo]

    enum CodingKeys: String, CodingKey {
        case type
        case tmdbId = "tmdb_id"
        case episodeCount = "episode_count"
        case seasonCount = "season_count"
        case runtime, seasons
    }
}

extension PrismAPIClient {
    /// `type` accepts movie / series / game / all.
    func searchMedia(query: String, type: String = "all", limit: Int = 10) async throws -> [MediaSearchItem] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        let response: MediaSearchResponse = try await get(
            "/api/v1/media/search",
            query: [
                URLQueryItem(name: "q", value: trimmed),
                URLQueryItem(name: "type", value: type),
                URLQueryItem(name: "limit", value: String(min(limit, 20))),
            ]
        )
        return response.items
    }

    /// Season and episode structure — only movies and series; games have none.
    func enrichMedia(tmdbID: Int, type: String) async throws -> MediaEnrichment {
        try await get(
            "/api/v1/media/enrich",
            query: [
                URLQueryItem(name: "tmdb_id", value: String(tmdbID)),
                URLQueryItem(name: "type", value: type),
            ]
        )
    }
}

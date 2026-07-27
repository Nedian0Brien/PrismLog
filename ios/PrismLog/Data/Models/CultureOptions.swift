import Foundation

/// Status vocabulary the web writes, split by type
/// (`getCultureStatusOptions`, `core.jsx:784`).
enum CultureStatus {
    static func options(for type: CultureType) -> [String] {
        type == .game
            ? ["플레이 중", "플레이 완료", "중도 하차", "기대 중"]
            : ["시청 중", "시청 완료", "중도 하차", "기대 중"]
    }

    static func `default`(for type: CultureType) -> String {
        type == .game ? "플레이 중" : "시청 중"
    }
}

struct SeriesEpisode: Identifiable, Hashable, Sendable {
    let seasonNumber: Int
    let episodeNumber: Int
    /// Position across the whole series, which is what progress counts.
    let absoluteNumber: Int
    let name: String?
    let watched: Bool
    let watchedAt: Date?
    let overview: String?
    /// TMDB still. Often absent — the timeline falls back to the code label.
    let stillURL: URL?

    /// Matches the web's map key: `"{season}-{episode}"`.
    var key: String { "\(seasonNumber)-\(episodeNumber)" }
    var id: String { key }

    /// "S1 · E3", the label the timeline shows under each still.
    var code: String { "S\(seasonNumber) · E\(episodeNumber)" }
    var displayName: String { name?.isEmpty == false ? name! : "EP \(episodeNumber)" }
}

struct SeriesSeason: Identifiable, Hashable, Sendable {
    let seasonNumber: Int
    let name: String?
    let episodes: [SeriesEpisode]

    var id: Int { seasonNumber }
    var watchedCount: Int { episodes.filter(\.watched).count }
}

/// Series progress, ported from `getSeriesProgressMetrics` (`core.jsx:624`).
///
/// Progress is a **pointer**, not a set: `watched_episode_count` says how many
/// episodes in, and everything before that point counts as watched. Tapping an
/// episode moves the pointer rather than toggling one checkbox — which is why
/// un-watching an early episode also clears the later ones.
struct SeriesProgress: Sendable {
    let seasons: [SeriesSeason]
    let totalEpisodes: Int
    let watchedEpisodes: Int

    var progress: Int {
        guard totalEpisodes > 0 else { return 0 }
        return min(max(Int((Double(watchedEpisodes) / Double(totalEpisodes) * 100).rounded()), 0), 100)
    }

    var playtimeLabel: String {
        totalEpisodes > 0 ? "\(watchedEpisodes) / \(totalEpisodes)화" : "\(watchedEpisodes)화"
    }

    var nextEpisode: SeriesEpisode? {
        seasons.flatMap(\.episodes).first { !$0.watched }
    }

    init(payload: [String: JSONValue]) {
        let watchDates = payload.object("episode_watch_dates") ?? [:]
        let rawSeasons = payload.array("seasons") ?? []

        let declaredTotal = payload.int("episode_count") ?? 0
        let seasonTotal = rawSeasons.reduce(0) { sum, season in
            let fields = season.objectValue ?? [:]
            let count = fields.int("episode_count")
                ?? fields.array("episodes")?.count
                ?? 0
            return sum + count
        }
        let total = declaredTotal > 0 ? declaredTotal : seasonTotal

        let watched = min(
            max(payload.int("watched_episode_count") ?? 0, 0),
            total > 0 ? total : Int.max
        )

        var cursor = 0
        var built: [SeriesSeason] = []

        for season in rawSeasons {
            let fields = season.objectValue ?? [:]
            let seasonNumber = fields.int("season_number") ?? built.count + 1
            let episodeObjects = fields.array("episodes") ?? []
            let count = fields.int("episode_count") ?? episodeObjects.count

            var episodes: [SeriesEpisode] = []
            for index in 0..<max(count, 0) {
                cursor += 1
                let info = index < episodeObjects.count ? episodeObjects[index].objectValue : nil
                let episodeNumber = info?.int("episode_number") ?? index + 1
                let key = "\(seasonNumber)-\(episodeNumber)"

                episodes.append(SeriesEpisode(
                    seasonNumber: seasonNumber,
                    episodeNumber: episodeNumber,
                    absoluteNumber: cursor,
                    name: info?.string("name"),
                    watched: cursor <= watched,
                    watchedAt: watchDates.string(key).flatMap(PrismDateCoding.parse),
                    overview: info?.string("overview"),
                    stillURL: info?.string("still_url").flatMap(PrismMedia.url(for:))
                ))
            }

            built.append(SeriesSeason(
                seasonNumber: seasonNumber,
                name: fields.string("name"),
                episodes: episodes
            ))
        }

        // A series with no season breakdown still has a count to track against.
        if built.isEmpty, total > 0 {
            let episodes = (1...total).map { number in
                SeriesEpisode(
                    seasonNumber: 1,
                    episodeNumber: number,
                    absoluteNumber: number,
                    name: nil,
                    watched: number <= watched,
                    watchedAt: watchDates.string("1-\(number)").flatMap(PrismDateCoding.parse),
                    overview: nil,
                    stillURL: nil
                )
            }
            built = [SeriesSeason(seasonNumber: 1, name: nil, episodes: episodes)]
        }

        self.seasons = built
        self.totalEpisodes = total
        self.watchedEpisodes = watched
    }
}

struct GameSession: Identifiable, Hashable, Sendable {
    let id: String
    let playedAt: Date?
    let durationMinutes: Int
    let note: String
    let photos: [URL]

    var durationLabel: String {
        durationMinutes >= 60
            ? "\(durationMinutes / 60)시간 \(String(format: "%02d", durationMinutes % 60))분"
            : "\(durationMinutes)분"
    }
}

extension RecordItem {
    var seriesProgress: SeriesProgress? {
        cultureType == .series ? SeriesProgress(payload: payload) : nil
    }

    var gameSessions: [GameSession] {
        (payload.array("game_sessions") ?? []).enumerated().compactMap { index, entry in
            guard let fields = entry.objectValue else { return nil }
            return GameSession(
                id: fields.string("id") ?? "game-session-\(index)",
                playedAt: (fields.string("played_at") ?? fields.string("date"))
                    .flatMap(PrismDateCoding.parse),
                durationMinutes: fields.int("duration_minutes") ?? 0,
                note: fields.string("note") ?? "",
                photos: (fields.array("photos") ?? [])
                    .compactMap(\.stringValue)
                    .compactMap(PrismMedia.url(for:))
            )
        }
        .sorted { ($0.playedAt ?? .distantPast) > ($1.playedAt ?? .distantPast) }
    }

    var totalGameMinutes: Int {
        gameSessions.reduce(0) { $0 + $1.durationMinutes }
    }

    var platformLabel: String? { payload.string("platform_label") }
    var overview: String? { payload.string("overview") }
    var releaseDate: String? { payload.string("release_date") }
}

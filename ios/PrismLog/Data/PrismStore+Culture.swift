import Foundation

struct CultureDraft: Sendable {
    var type: CultureType = .movie
    var status: String = "시청 중"
    var rating: Int = 0
    var watchedEpisodes: Int = 0
    var playtime: String = ""
    var platformLabel: String = ""
    var tags: [String] = []
}

struct StudyDraft: Sendable {
    var title: String = ""
    var goal: String = ""
    var retrospect: String = ""
    /// `page` counts pages; `chapter` counts completed table-of-contents nodes.
    var progressMode: String = "page"
    var pagesTotal: Int = 0
    var pagesRead: Int = 0
    var tocTitles: [String] = []
    var tags: [String] = []
    var coverURL: String = ""
}

@MainActor
extension PrismStore {
    // MARK: - Culture

    func createCultureRecord(
        from media: MediaSearchItem,
        enrichment: MediaEnrichment?,
        draft: CultureDraft
    ) async {
        var payload: [String: JSONValue] = [
            "type": .string(draft.type.rawValue),
            "status": .string(draft.status),
            "rating": .int(min(max(draft.rating, 0), 5)),
            "source_provider": .string(media.sourceProvider),
            "source_id": .string(media.sourceId),
        ]

        if let poster = media.posterUrl { payload["poster"] = .string(poster) }
        if let release = media.releaseDate { payload["release_date"] = .string(release) }
        if let overview = media.overview { payload["overview"] = .string(overview) }
        if let tmdbID = media.tmdbId { payload["tmdb_id"] = .int(tmdbID) }
        if let igdbID = media.igdbId { payload["igdb_id"] = .int(igdbID) }
        if !draft.platformLabel.isEmpty {
            payload["platform_label"] = .string(draft.platformLabel)
        }

        switch draft.type {
        case .series:
            let episodeCount = enrichment?.episodeCount ?? media.episodeCount ?? 0
            if episodeCount > 0 { payload["episode_count"] = .int(episodeCount) }
            if let seasonCount = enrichment?.seasonCount ?? media.seasonCount {
                payload["season_count"] = .int(seasonCount)
            }
            if let seasons = enrichment?.seasons, !seasons.isEmpty {
                payload["seasons"] = .array(seasons.map(Self.seasonJSON))
            }
            payload["watched_episode_count"] = .int(max(draft.watchedEpisodes, 0))
            payload["episode_watch_dates"] = .object([:])
            if episodeCount > 0 {
                payload["progress"] = .int(
                    min(100, Int((Double(draft.watchedEpisodes) / Double(episodeCount) * 100).rounded()))
                )
            }

        case .game:
            payload["game_sessions"] = .array([])
            if !draft.playtime.isEmpty { payload["playtime"] = .string(draft.playtime) }

        case .movie:
            if let runtime = enrichment?.runtime { payload["runtime"] = .int(runtime) }
        }

        let log = StoredLog(
            id: UUID(),
            userID: userID,
            // Every one of these is a `culture` row; the shape lives in
            // `payload.type`, exactly as the web stores it.
            category: LogCategory.culture.rawValue,
            title: media.title,
            tags: draft.tags,
            payloadData: StoredLog.encodeObject(payload),
            pendingEntitySourceID: media.sourceId,
            needsEntity: true,
            syncState: .createdLocally
        )

        context.insert(log)
        saveAndRefresh(flash: draft.type == .movie ? .movie : (draft.type == .series ? .series : .game))
        await sync()
    }

    private static func seasonJSON(_ season: MediaSeasonInfo) -> JSONValue {
        .object([
            "season_number": .int(season.seasonNumber),
            "name": season.name.map(JSONValue.string) ?? .null,
            "air_date": season.airDate.map(JSONValue.string) ?? .null,
            "episode_count": .int(season.episodeCount ?? season.episodes.count),
            "episodes": .array(season.episodes.map { episode in
                .object([
                    "season_number": .int(episode.seasonNumber),
                    "episode_number": .int(episode.episodeNumber),
                    "name": episode.name.map(JSONValue.string) ?? .null,
                    "air_date": episode.airDate.map(JSONValue.string) ?? .null,
                ])
            }),
        ])
    }

    /// Moves the watched pointer to `episode`, or back to just before it when
    /// the episode was already watched. Watch dates are recorded per episode.
    func setSeriesProgress(id: UUID, upTo episode: SeriesEpisode, at date: Date = .now) async {
        guard let record = record(id: id), let progress = record.seriesProgress else { return }

        let target = episode.watched ? episode.absoluteNumber - 1 : episode.absoluteNumber

        await updateRecord(id: id) { payload in
            payload["watched_episode_count"] = .int(max(0, target))

            var dates = payload["episode_watch_dates"]?.objectValue ?? [:]
            if episode.watched {
                // Un-watching drops the dates of everything after the new tip.
                for season in progress.seasons {
                    for candidate in season.episodes where candidate.absoluteNumber > target {
                        dates.removeValue(forKey: candidate.key)
                    }
                }
            } else {
                dates[episode.key] = .string(Self.isoStamp(date))
            }
            payload["episode_watch_dates"] = .object(dates)

            if progress.totalEpisodes > 0 {
                payload["progress"] = .int(
                    min(100, Int((Double(max(0, target)) / Double(progress.totalEpisodes) * 100).rounded()))
                )
            }
            payload["playtime"] = .string("\(max(0, target)) / \(progress.totalEpisodes)화")
        }
    }

    func addGameSession(id: UUID, playedAt: Date, durationMinutes: Int, note: String) async {
        guard durationMinutes > 0 else { return }

        await updateRecord(id: id) { payload in
            var sessions = payload["game_sessions"]?.arrayValue ?? []
            sessions.insert(.object([
                "id": .string("game-session-\(Int(playedAt.timeIntervalSince1970 * 1000))"),
                "date": .string(Self.isoStamp(playedAt)),
                "played_at": .string(Self.isoStamp(playedAt)),
                "duration_minutes": .int(durationMinutes),
                "note": .string(note.trimmingCharacters(in: .whitespacesAndNewlines)),
                "photos": .array([]),
            ]), at: 0)
            payload["game_sessions"] = .array(sessions)

            let total = sessions.reduce(0) { $0 + ($1["duration_minutes"]?.intValue ?? 0) }
            payload["playtime"] = .string("\(total / 60)시간 \(String(format: "%02d", total % 60))분")
            payload["last_played_at"] = .string(Self.isoStamp(playedAt))
        }
    }

    func updateCultureMeta(
        id: UUID,
        title: String,
        status: String,
        rating: Int,
        platformLabel: String,
        tags: [String]
    ) async {
        guard let log = storedLogForEditing(id: id) else { return }

        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { log.title = trimmed }
        log.tags = tags

        var payload = log.payload
        payload["status"] = .string(status)
        payload["rating"] = .int(min(max(rating, 0), 5))
        if platformLabel.isEmpty {
            payload["platform_label"] = nil
        } else {
            payload["platform_label"] = .string(platformLabel)
        }
        log.payload = payload
        log.updatedAt = .now
        if log.syncState == .synced { log.syncState = .modifiedLocally }

        saveAndRefresh(flash: record(id: id)?.accent)
        await sync()
    }

    // MARK: - Study

    func createStudyRecord(draft: StudyDraft) async {
        var payload: [String: JSONValue] = [
            "progress_mode": .string(draft.progressMode),
            "pages_read": .int(max(draft.pagesRead, 0)),
            "pages_total": .int(max(draft.pagesTotal, 0)),
            "goal": .string(draft.goal),
            "retrospect": .string(draft.retrospect),
            "toc": .array(draft.tocTitles.enumerated().map { index, title in
                .object([
                    "id": .string("node-\(index)"),
                    "title": .string(title),
                    "completed": .bool(false),
                    "notes": .string(""),
                    "children": .array([]),
                ])
            }),
        ]

        if !draft.coverURL.isEmpty {
            payload["image_url"] = .string(draft.coverURL)
        }

        if draft.progressMode == "page", draft.pagesTotal > 0 {
            payload["progress"] = .int(
                min(100, Int((Double(draft.pagesRead) / Double(draft.pagesTotal) * 100).rounded()))
            )
        } else {
            payload["progress"] = .int(0)
        }

        let log = StoredLog(
            id: UUID(),
            userID: userID,
            category: LogCategory.study.rawValue,
            title: draft.title,
            tags: draft.tags,
            payloadData: StoredLog.encodeObject(payload),
            pendingEntitySourceID: nil,
            needsEntity: true,
            syncState: .createdLocally
        )

        context.insert(log)
        saveAndRefresh(flash: .study)
        await sync()
    }

    /// Toggles one table-of-contents node. The tree is arbitrary depth, so this
    /// walks it rather than indexing.
    func setStudyNodeCompleted(id: UUID, nodeID: String, completed: Bool) async {
        await updateRecord(id: id) { payload in
            guard let toc = payload["toc"]?.arrayValue else { return }
            payload["toc"] = .array(Self.toggle(nodes: toc, nodeID: nodeID, completed: completed))

            if payload.string("progress_mode") != "page" {
                let (done, total) = Self.tally(payload["toc"]?.arrayValue ?? [])
                payload["progress"] = .int(
                    total > 0 ? Int((Double(done) / Double(total) * 100).rounded()) : 0
                )
            }
        }
    }

    private static func toggle(nodes: [JSONValue], nodeID: String, completed: Bool) -> [JSONValue] {
        nodes.map { node in
            guard var fields = node.objectValue else { return node }

            if fields.string("id") == nodeID {
                fields["completed"] = .bool(completed)
            }
            if let children = fields["children"]?.arrayValue {
                fields["children"] = .array(toggle(nodes: children, nodeID: nodeID, completed: completed))
            }
            return .object(fields)
        }
    }

    private static func tally(_ nodes: [JSONValue]) -> (done: Int, total: Int) {
        nodes.reduce(into: (0, 0)) { result, node in
            guard let fields = node.objectValue else { return }
            result.0 += (fields.bool("completed") ?? false) ? 1 : 0
            result.1 += 1

            let nested = tally(fields["children"]?.arrayValue ?? [])
            result.0 += nested.done
            result.1 += nested.total
        }
    }

    static func isoStamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

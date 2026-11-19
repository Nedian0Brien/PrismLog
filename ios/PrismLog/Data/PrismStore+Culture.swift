import Foundation

struct CultureDraft: Sendable {
    var type: CultureType = .movie
    var status: String = "시청 중"
    var rating: Int = 0
    var watchedEpisodes: Int = 0
    var playtime: String = ""
    /// The web's `platform_key` (series only); `platformLabel` is the name
    /// typed for 기타.
    var platformKey: String = ""
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
        // The web keeps a platform for series alone (`core.jsx:743`).
        if draft.type == .series, !draft.platformKey.isEmpty {
            payload["platform_key"] = .string(draft.platformKey)
            payload["platform_label"] = .string(SeriesPlatformOption.label(key: draft.platformKey, custom: draft.platformLabel))
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
            "episodes": .array(season.episodes.map(episodeJSON)),
        ])
    }

    /// One episode as the web stores it (`normalizeSeriesEpisode`,
    /// `core.jsx:538`), still and synopsis included.
    private static func episodeJSON(_ episode: MediaEpisodeInfo) -> JSONValue {
        .object([
            "season_number": .int(episode.seasonNumber),
            "episode_number": .int(episode.episodeNumber),
            "name": episode.name.map(JSONValue.string) ?? .null,
            "air_date": episode.airDate.map(JSONValue.string) ?? .null,
            "runtime": episode.runtime.map(JSONValue.int) ?? .null,
            "overview": episode.overview.map(JSONValue.string) ?? .null,
            "still_url": episode.stillUrl.map(JSONValue.string) ?? .null,
        ])
    }

    /// Series saved before episode stills were kept — every one added on
    /// iOS, and those the web stored without them — get the stills, and the
    /// synopses and titles they're missing, from TMDB the first time their
    /// detail opens. What was watched, and when, stays as it was.
    func fillSeriesEpisodeDetails(id: UUID) async {
        guard let record = record(id: id),
              let tmdbID = record.payload.int("tmdb_id"),
              let progress = record.seriesProgress,
              progress.seasons.flatMap(\.episodes).contains(where: { $0.stillURL == nil }),
              episodeDetailsRequested.insert(id).inserted,
              let enrichment = try? await api.enrichMedia(tmdbID: tmdbID, type: "series")
        else { return }

        let stored = record.payload.array("seasons") ?? []
        let filled = Self.fillingEpisodeDetails(stored, from: enrichment.seasons)
        guard filled != stored else { return }
        await updateRecord(id: id, flash: false) { payload in
            payload["seasons"] = .array(filled)
        }
    }

    /// `stored` seasons with what TMDB knows filled in: missing stills,
    /// synopses, titles and runtimes, matched by season and episode number.
    /// Seasons stored without episodes take TMDB's list; a record with no
    /// seasons at all takes TMDB's seasons.
    static func fillingEpisodeDetails(_ stored: [JSONValue], from remote: [MediaSeasonInfo]) -> [JSONValue] {
        if stored.isEmpty { return remote.map(seasonJSON) }
        let remoteSeasons = Dictionary(remote.map { ($0.seasonNumber, $0) }, uniquingKeysWith: { first, _ in first })

        return stored.map { season in
            guard var fields = season.objectValue,
                  let number = fields.int("season_number"),
                  let remoteSeason = remoteSeasons[number]
            else { return season }

            let remoteEpisodes = Dictionary(
                remoteSeason.episodes.map { ($0.episodeNumber, $0) },
                uniquingKeysWith: { first, _ in first }
            )
            let episodes = fields.array("episodes") ?? []
            if episodes.isEmpty {
                fields["episodes"] = .array(remoteSeason.episodes.map(episodeJSON))
                return .object(fields)
            }
            fields["episodes"] = .array(episodes.map { episode in
                guard var details = episode.objectValue,
                      let episodeNumber = details.int("episode_number"),
                      let match = remoteEpisodes[episodeNumber]
                else { return episode }
                if details.string("still_url") == nil, let still = match.stillUrl { details["still_url"] = .string(still) }
                if details.string("overview") == nil, let overview = match.overview { details["overview"] = .string(overview) }
                if details.string("name") == nil, let name = match.name { details["name"] = .string(name) }
                if details.int("runtime") == nil, let runtime = match.runtime { details["runtime"] = .int(runtime) }
                return .object(details)
            })
            return .object(fields)
        }
    }

    /// Moves the watched pointer to `episode`, or back to just before it when
    /// the episode was already watched — the web's `commitEpisodeSelection`
    /// (`recordsPage.jsx:1196`): every episode up to the pointer keeps its
    /// watch date or gets today's, everything after loses it, and the status
    /// follows the count.
    func setSeriesProgress(id: UUID, upTo episode: SeriesEpisode, at date: Date = .now) async {
        guard let record = record(id: id), let progress = record.seriesProgress else { return }

        let target = max(0, episode.watched ? episode.absoluteNumber - 1 : episode.absoluteNumber)
        let total = progress.totalEpisodes

        await updateRecord(id: id) { payload in
            payload["watched_episode_count"] = .int(target)

            var dates = payload["episode_watch_dates"]?.objectValue ?? [:]
            for season in progress.seasons {
                for candidate in season.episodes {
                    if candidate.absoluteNumber <= target {
                        if dates[candidate.key]?.stringValue?.isEmpty ?? true {
                            dates[candidate.key] = .string(Self.isoStamp(date))
                        }
                    } else {
                        dates.removeValue(forKey: candidate.key)
                    }
                }
            }
            payload["episode_watch_dates"] = .object(dates)

            payload["status"] = .string(
                total > 0 && target >= total ? "시청 완료" : target > 0 ? "시청 중" : "기대 중"
            )
            if total > 0 {
                payload["progress"] = .int(min(100, Int((Double(target) / Double(total) * 100).rounded())))
            }
            payload["playtime"] = .string("\(target) / \(total)화")
        }
    }

    func addGameSession(
        id: UUID,
        playedAt: Date,
        durationMinutes: Int,
        note: String,
        photoPaths: [String] = []
    ) async {
        guard durationMinutes > 0 else { return }

        await updateRecord(id: id) { payload in
            var sessions = payload["game_sessions"]?.arrayValue ?? []
            sessions.insert(.object([
                "id": .string("game-session-\(Int(playedAt.timeIntervalSince1970 * 1000))"),
                "date": .string(Self.isoStamp(playedAt)),
                "played_at": .string(Self.isoStamp(playedAt)),
                "duration_minutes": .int(durationMinutes),
                "note": .string(note.trimmingCharacters(in: .whitespacesAndNewlines)),
                "photos": .array(photoPaths.map { .string($0) }),
            ]), at: 0)
            payload["game_sessions"] = .array(sessions)
            Self.refreshGameTotals(&payload)
        }
    }

    /// Rewrites one play session in place, matching the web's
    /// `editGameSession` (`App.jsx:623`) — same fields, and the same
    /// recomputed playtime label afterwards.
    func updateGameSession(
        id: UUID,
        sessionID: String,
        playedAt: Date,
        durationMinutes: Int,
        note: String,
        photoPaths: [String]
    ) async {
        guard durationMinutes > 0 else { return }

        await updateRecord(id: id) { payload in
            var sessions = payload["game_sessions"]?.arrayValue ?? []
            guard let index = sessions.firstIndex(where: {
                $0.objectValue?.string("id") == sessionID
            }) else { return }

            var fields = sessions[index].objectValue ?? [:]
            fields["date"] = .string(Self.isoStamp(playedAt))
            fields["played_at"] = .string(Self.isoStamp(playedAt))
            fields["duration_minutes"] = .int(durationMinutes)
            fields["note"] = .string(note.trimmingCharacters(in: .whitespacesAndNewlines))
            fields["photos"] = .array(photoPaths.map { .string($0) })
            sessions[index] = .object(fields)

            payload["game_sessions"] = .array(sessions)
            Self.refreshGameTotals(&payload)
        }
    }

    /// Playtime and last-played are denormalized from the session list — the
    /// web's cards read them directly, so they must follow every mutation.
    private static func refreshGameTotals(_ payload: inout [String: JSONValue]) {
        let sessions = payload["game_sessions"]?.arrayValue ?? []

        let total = sessions.reduce(0) { $0 + ($1.objectValue?.int("duration_minutes") ?? 0) }
        payload["playtime"] = .string("\(total / 60)시간 \(String(format: "%02d", total % 60))분")

        let lastPlayed = sessions
            .compactMap { ($0.objectValue?.string("played_at") ?? $0.objectValue?.string("date")) }
            .compactMap(PrismDateCoding.parse)
            .max()
        if let lastPlayed {
            payload["last_played_at"] = .string(Self.isoStamp(lastPlayed))
        }
    }

    func updateCultureMeta(
        id: UUID,
        title: String,
        status: String,
        rating: Int,
        platformKey: String,
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
        // Only a series has a platform to pick; other types keep what they have.
        if record(id: id)?.cultureType == .series {
            if platformKey.isEmpty {
                payload["platform_key"] = nil
                payload["platform_label"] = nil
            } else {
                payload["platform_key"] = .string(platformKey)
                payload["platform_label"] = .string(SeriesPlatformOption.label(key: platformKey, custom: platformLabel))
            }
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

    /// One entry in a subject's session history.
    ///
    /// Which case applies is decided by the subject, not the caller's mood:
    /// page-based subjects count pages, chapter-based ones count chapters.
    enum StudyActivityValue: Hashable, Sendable {
        case pages(Int)
        case chapters(Int)
    }

    /// Adds one activity to a study subject.
    ///
    /// The web posts a *new* log against the existing `entity_id` instead of
    /// editing the last one, which is what gives a subject its session history
    /// (`recordsPage.jsx:4452`). Two consequences worth knowing:
    ///
    /// - The grouped card is rebuilt from the newest log **alone**, so the new
    ///   log carries the previous payload forward wholesale. Anything dropped
    ///   here vanishes from the web's view of the subject, including keys this
    ///   app never reads.
    /// - Without an `entity_id` there is nothing to attach to, so a subject
    ///   that has never reached the server updates in place instead. That only
    ///   happens offline, and the next activity after a sync branches normally.
    func addStudyActivity(
        to record: RecordItem,
        value: StudyActivityValue,
        photoPaths: [String] = []
    ) async {
        var payload = record.payload
        let title: String

        switch value {
        case .pages(let pages):
            let total = payload.int("pages_total") ?? payload.int("pages") ?? 0
            payload["pages_read"] = .int(max(pages, 0))
            payload["progress"] = .int(
                total > 0 ? min(100, Int((Double(pages) / Double(total) * 100).rounded())) : 0
            )
            title = "\(pages)p까지 공부"

        case .chapters(let done):
            let total = StudyGrouping.chapterCount(payload)
            // `completed` is what the web reads; `toc` is what this app's
            // table of contents reads. Writing only one leaves the two
            // screens disagreeing about the same subject.
            payload["completed"] = .array((0..<total).map { .bool($0 < done) })
            payload["toc"] = .array(Self.markLeading(
                nodes: payload["toc"]?.arrayValue ?? [],
                completedCount: done
            ))
            payload["progress"] = .int(
                total > 0 ? min(100, Int((Double(done) / Double(total) * 100).rounded())) : 0
            )
            title = "\(done)개 챕터 완료"
        }

        if !photoPaths.isEmpty {
            payload["photos"] = .array(photoPaths.map { .string($0) })
        }

        guard let entityID = record.entityID else {
            await updateRecord(id: record.id) { existing in existing = payload }
            return
        }

        context.insert(StoredLog(
            id: UUID(),
            userID: userID,
            category: LogCategory.study.rawValue,
            entityID: entityID,
            title: title,
            tags: record.tags,
            payloadData: StoredLog.encodeObject(payload),
            entityTitle: record.entityTitle,
            needsEntity: false,
            syncState: .createdLocally
        ))

        saveAndRefresh(flash: .study)
        await sync()
    }

    /// Edits one study activity in place — title, memo, when it happened, and
    /// its photos. The web's `StudyTimelineEditModal` patches exactly these
    /// four; progress is deliberately not editable here, because changing it
    /// retroactively would break every later activity's delta.
    func updateStudyActivity(
        id: UUID,
        title: String,
        summary: String,
        occurredAt: Date,
        photoPaths: [String]
    ) async {
        guard let log = storedLogForEditing(id: id) else { return }

        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { log.title = trimmed }
        log.summary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        log.occurredAt = occurredAt

        var payload = log.payload
        payload["photos"] = .array(photoPaths.map { .string($0) })
        log.payload = payload

        log.updatedAt = .now
        if log.syncState == .synced { log.syncState = .modifiedLocally }

        saveAndRefresh(flash: .study)
        await sync()
    }

    /// Marks the first `completedCount` top-level nodes done and the rest not.
    /// Children are left alone — the count is a pointer into the chapter list,
    /// not a claim about every leaf under it.
    private static func markLeading(nodes: [JSONValue], completedCount: Int) -> [JSONValue] {
        nodes.enumerated().map { index, node in
            guard var fields = node.objectValue else { return node }
            fields["completed"] = .bool(index < completedCount)
            return .object(fields)
        }
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

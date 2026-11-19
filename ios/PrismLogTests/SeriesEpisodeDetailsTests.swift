import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Episode stills: a series saved without them gets them from TMDB, and
/// nothing the person recorded changes on the way.
@Suite(.serialized)
@MainActor
struct SeriesEpisodeDetailsTests {
    static let remote = [
        MediaSeasonInfo(
            seasonNumber: 1,
            name: "시즌 1",
            airDate: "2026-07-17",
            episodeCount: 2,
            episodes: [
                MediaEpisodeInfo(seasonNumber: 1, episodeNumber: 1, name: "1화", airDate: "2026-07-17", runtime: 60,
                                 overview: "첫 회", stillUrl: "https://image.tmdb.org/t/p/w500/a.jpg"),
                MediaEpisodeInfo(seasonNumber: 1, episodeNumber: 2, name: "2화", airDate: "2026-07-18", runtime: 58,
                                 overview: nil, stillUrl: "https://image.tmdb.org/t/p/w500/b.jpg"),
            ]
        ),
    ]

    @Test("저장된 회차에 빠진 썸네일·줄거리만 채우고, 있던 값은 그대로 둔다")
    func fillsOnlyWhatIsMissing() throws {
        let stored: [JSONValue] = [
            .object([
                "season_number": .int(1),
                "name": .string("리미티드 시리즈"),
                "episode_count": .int(2),
                "episodes": .array([
                    .object(["season_number": .int(1), "episode_number": .int(1), "name": .string("1화"), "air_date": .string("2026-07-17")]),
                    .object(["season_number": .int(1), "episode_number": .int(2), "name": .string("내가 붙인 제목"), "still_url": .string("https://mine.jpg")]),
                ]),
            ]),
        ]

        let filled = PrismStore.fillingEpisodeDetails(stored, from: Self.remote)
        let season = try #require(filled.first?.objectValue)
        #expect(season.string("name") == "리미티드 시리즈")
        let episodes = try #require(season.array("episodes")).compactMap(\.objectValue)
        #expect(episodes[0].string("still_url") == "https://image.tmdb.org/t/p/w500/a.jpg")
        #expect(episodes[0].string("overview") == "첫 회")
        #expect(episodes[0].int("runtime") == 60)
        #expect(episodes[1].string("still_url") == "https://mine.jpg")
        #expect(episodes[1].string("name") == "내가 붙인 제목")
    }

    @Test("회차 목록 없이 저장된 시즌과 시즌 없는 기록은 TMDB 목록을 받는다")
    func emptySeasonsTakeTheRemoteList() throws {
        let bare: [JSONValue] = [.object(["season_number": .int(1), "episode_count": .int(2)])]
        let filledSeason = try #require(PrismStore.fillingEpisodeDetails(bare, from: Self.remote).first?.objectValue)
        #expect(filledSeason.array("episodes")?.count == 2)
        #expect(filledSeason.int("episode_count") == 2)

        let none = PrismStore.fillingEpisodeDetails([], from: Self.remote)
        #expect(none.count == 1)
        #expect(none.first?.objectValue?.array("episodes")?.first?.objectValue?.string("still_url") != nil)
    }

    @Test("채운 회차 정보를 진행 모델이 읽어 썸네일 주소가 생긴다")
    func progressReadsTheFilledStills() throws {
        let filled = PrismStore.fillingEpisodeDetails([], from: Self.remote)
        let payload: [String: JSONValue] = [
            "type": .string("시리즈"),
            "episode_count": .int(2),
            "watched_episode_count": .int(1),
            "seasons": .array(filled),
        ]
        let progress = SeriesProgress(payload: payload)
        let episodes = progress.seasons.flatMap(\.episodes)
        #expect(episodes.map(\.stillURL?.absoluteString) == [
            "https://image.tmdb.org/t/p/w500/a.jpg",
            "https://image.tmdb.org/t/p/w500/b.jpg",
        ])
        #expect(episodes.map(\.watched) == [true, false])
    }

    // MARK: Marking episodes (web `commitEpisodeSelection`)

    private func seriesStore(watched: Int, dates: [String: JSONValue]) throws -> (PrismStore, UUID) {
        let container = try ModelContainer(
            for: StoredLog.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let store = PrismStore(container: container, api: PrismAPIClient(baseURL: URL(string: "http://127.0.0.1:9")!))
        let id = UUID()
        let episodes: [JSONValue] = (1...4).map { .object(["season_number": .int(1), "episode_number": .int($0)]) }
        store.context.insert(StoredLog(
            id: id,
            userID: store.userID,
            category: "culture",
            title: "시리즈",
            payloadData: StoredLog.encodeObject([
                "type": .string("시리즈"),
                "status": .string("시청 중"),
                "episode_count": .int(4),
                "watched_episode_count": .int(watched),
                "episode_watch_dates": .object(dates),
                "seasons": .array([.object(["season_number": .int(1), "episode_count": .int(4), "episodes": .array(episodes)])]),
            ]),
            occurredAt: .now
        ))
        store.reload()
        return (store, id)
    }

    @Test("회차를 보면 그 앞 회차에도 날짜가 채워지고, 다 보면 시청 완료가 된다")
    func markingFillsEarlierDatesAndFinishes() async throws {
        let (store, id) = try seriesStore(watched: 1, dates: ["1-1": .string("2026-11-01T00:00:00.000Z")])
        let fourth = try #require(store.record(id: id)?.seriesProgress?.seasons.first?.episodes.last)
        let now = try #require(PrismDateCoding.parse("2026-11-19T12:00:00.000Z"))

        await store.setSeriesProgress(id: id, upTo: fourth, at: now)

        let record = try #require(store.record(id: id))
        let dates = try #require(record.payload.object("episode_watch_dates"))
        #expect(dates.keys.sorted() == ["1-1", "1-2", "1-3", "1-4"])
        // The date already there stays.
        #expect(dates["1-1"]?.stringValue == "2026-11-01T00:00:00.000Z")
        #expect(record.status == "시청 완료")
        #expect(record.payload.int("watched_episode_count") == 4)
        #expect(record.payload.int("progress") == 100)
    }

    @Test("본 회차를 해제하면 그 뒤 날짜가 지워지고, 하나도 안 남으면 기대 중이 된다")
    func unwatchingClearsLaterDatesAndStatus() async throws {
        let (store, id) = try seriesStore(watched: 2, dates: [
            "1-1": .string("2026-11-01T00:00:00.000Z"), "1-2": .string("2026-11-02T00:00:00.000Z"),
        ])
        let first = try #require(store.record(id: id)?.seriesProgress?.seasons.first?.episodes.first)

        await store.setSeriesProgress(id: id, upTo: first)

        let record = try #require(store.record(id: id))
        #expect(record.payload.object("episode_watch_dates")?.isEmpty == true)
        #expect(record.status == "기대 중")
        #expect(record.payload.int("watched_episode_count") == 0)
    }

    @Test func monthDayLabelsMatchTheWeb() {
        #expect(SeriesDates.monthDay("2026-07-17") == "7월 17일")
        #expect(SeriesDates.monthDay("2014-05") == nil)
    }
}

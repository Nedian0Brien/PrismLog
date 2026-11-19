import Foundation
import Testing

@testable import PrismLog

/// Episode stills: a series saved without them gets them from TMDB, and
/// nothing the person recorded changes on the way.
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
}

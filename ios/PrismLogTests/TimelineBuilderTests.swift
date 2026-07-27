import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Pins the timeline against the web's `TimelinePage`.
///
/// The timeline is the one screen where a log is *not* a row. Sessions buried
/// in a payload become their own entries, and entries about the same subject on
/// the same day merge back into one. Get either half wrong and the screen
/// either floods or goes almost empty — both look plausible in a screenshot.
@Suite(.serialized)
@MainActor
struct TimelineBuilderTests {
    private func makeStore() throws -> PrismStore {
        let container = try ModelContainer(
            for: StoredLog.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        return PrismStore(
            container: container,
            api: PrismAPIClient(baseURL: URL(string: "http://127.0.0.1:9")!)
        )
    }

    /// 2026-06-10 09:00 KST-ish, kept fixed so day boundaries are predictable.
    private func date(_ day: Int, _ hour: Int = 9, _ minute: Int = 0) -> Date {
        var parts = DateComponents()
        parts.year = 2026
        parts.month = 6
        parts.day = day
        parts.hour = hour
        parts.minute = minute
        return Calendar.current.date(from: parts)!
    }

    private func stamp(_ value: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: value)
    }

    private func session(
        id: String,
        at when: Date,
        from: Int,
        to: Int,
        fromProgress: Int,
        toProgress: Int,
        minutes: Int,
        note: String = "",
        photos: [String] = []
    ) -> JSONValue {
        .object([
            "id": .string(id),
            "ended_at": .string(stamp(when)),
            "from_pages": .int(from),
            "to_pages": .int(to),
            "pages_read": .int(to - from),
            "from_progress": .int(fromProgress),
            "to_progress": .int(toProgress),
            "duration_minutes": .int(minutes),
            "note": .string(note),
            "photos": .array(photos.map { .string($0) }),
        ])
    }

    private func insert(
        into store: PrismStore,
        category: String,
        title: String,
        entityID: UUID? = nil,
        entityTitle: String? = nil,
        occurredAt: Date,
        payload: [String: JSONValue]
    ) {
        store.context.insert(StoredLog(
            id: UUID(),
            userID: store.userID,
            category: category,
            entityID: entityID,
            title: title,
            payloadData: StoredLog.encodeObject(payload),
            occurredAt: occurredAt,
            entityTitle: entityTitle
        ))
    }

    // MARK: - Reading

    @Test("한 권을 여러 날 읽으면 날마다 한 줄이 된다")
    func readingSessionsBecomeOneEntryPerDay() throws {
        let store = try makeStore()

        insert(
            into: store,
            category: "reading",
            title: "무너지는 제국",
            entityID: UUID(),
            occurredAt: date(12),
            payload: [
                "pages_total": .int(400),
                "pages_read": .int(200),
                "progress": .int(50),
                "reading_sessions": .array([
                    session(id: "s1", at: date(10, 20), from: 0, to: 60,
                            fromProgress: 0, toProgress: 15, minutes: 40),
                    session(id: "s2", at: date(12, 21), from: 60, to: 200,
                            fromProgress: 15, toProgress: 50, minutes: 70),
                ])
            ]
        )
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)

        #expect(days.count == 2, "읽은 날 수만큼 나와야 한다 — 책 한 권에 한 줄이 아니다")
        #expect(days.map(\.items.count) == [1, 1])

        // Newest day first.
        let latest = try #require(days.first?.items.first)
        #expect(latest.deltaLabel == "+140p")
        #expect(latest.progressStart == 15)
        #expect(latest.progress == 50)
        #expect(latest.progressDelta == 35)
        #expect(latest.summary == "200 / 400p")
    }

    @Test("같은 날 여러 번 읽으면 한 줄로 합쳐지고 쪽수가 더해진다")
    func sameDayReadingSessionsMerge() throws {
        let store = try makeStore()

        insert(
            into: store,
            category: "reading",
            title: "프로젝트 헤일메리",
            entityID: UUID(),
            occurredAt: date(14),
            payload: [
                "pages_total": .int(500),
                "reading_sessions": .array([
                    session(id: "a", at: date(14, 9), from: 100, to: 130,
                            fromProgress: 20, toProgress: 26, minutes: 25, note: "아침"),
                    session(id: "b", at: date(14, 13), from: 130, to: 160,
                            fromProgress: 26, toProgress: 32, minutes: 30),
                    session(id: "c", at: date(14, 22), from: 160, to: 220,
                            fromProgress: 32, toProgress: 44, minutes: 45, note: "자기 전"),
                ])
            ]
        )
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)
        #expect(days.count == 1)

        let item = try #require(days.first?.items.first)
        #expect(item.deltaLabel == "+120p", "세 세션의 쪽수가 더해져야 한다")
        #expect(item.progressStart == 20, "그날 시작 지점")
        #expect(item.progress == 44, "그날 끝 지점")
        #expect(item.snippet == "자기 전", "가장 마지막 메모가 남는다")
        // The entry is stamped by the last session, so it sorts to the right
        // place among that evening's other records.
        #expect(Calendar.current.component(.hour, from: item.date) == 22)
    }

    @Test("같은 날 찍은 사진은 모두 남는다")
    func sameDayPhotosAreKept() throws {
        let store = try makeStore()

        insert(
            into: store,
            category: "reading",
            title: "사진 있는 책",
            entityID: UUID(),
            occurredAt: date(14),
            payload: [
                "pages_total": .int(300),
                "reading_sessions": .array([
                    session(id: "a", at: date(14, 9), from: 0, to: 30,
                            fromProgress: 0, toProgress: 10, minutes: 20,
                            photos: ["/uploads/reading/one.jpg"]),
                    session(id: "b", at: date(14, 20), from: 30, to: 60,
                            fromProgress: 10, toProgress: 20, minutes: 20,
                            photos: ["/uploads/reading/two.jpg"]),
                ])
            ]
        )
        try store.context.save()
        store.reload()

        let item = try #require(TimelineBuilder.days(from: store.records).first?.items.first)
        #expect(item.photos.count == 2, "두 세션의 사진이 모두 그날의 사진이다")
    }

    @Test("세션이 하나도 없는 빈 독서 기록은 타임라인에 오르지 않는다")
    func emptyReadingRecordsAreDropped() throws {
        let store = try makeStore()

        insert(
            into: store, category: "reading", title: "아직 안 읽은 책",
            entityID: UUID(), occurredAt: date(9),
            payload: ["pages_total": .int(300), "pages_read": .int(0), "progress": .int(0)]
        )
        insert(
            into: store, category: "study", title: "빈 공부 기록",
            entityID: UUID(), occurredAt: date(9),
            payload: [:]
        )
        try store.context.save()
        store.reload()

        let items = TimelineBuilder.days(from: store.records).flatMap(\.items)
        #expect(items.count == 1, "독서는 빠지고 공부는 남는다")
        #expect(items.first?.title == "빈 공부 기록")
    }

    // MARK: - Study

    @Test("공부 증분은 직전 활동과 비교해 계산된다")
    func studyDeltaComparesAgainstThePreviousActivity() throws {
        let store = try makeStore()
        let textbook = UUID()

        for (day, pages) in [(3, 100), (8, 240), (15, 300)] {
            insert(
                into: store,
                category: "study",
                title: "\(pages)p까지 공부",
                entityID: textbook,
                entityTitle: "실전 AI 애플리케이션 개발",
                occurredAt: date(day),
                payload: [
                    "progress_mode": .string("page"),
                    "pages_read": .int(pages),
                    "pages_total": .int(600),
                ]
            )
        }
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)
        #expect(days.count == 3)

        let items = days.flatMap(\.items)
        #expect(items.map(\.deltaLabel) == ["+60p", "+140p", "+100p"], "최신순으로 그날의 증분")
        #expect(items.map(\.title) == Array(repeating: "실전 AI 애플리케이션 개발", count: 3),
                "제목은 과목 이름이지 세션 제목이 아니다")

        let middle = items[1]
        #expect(middle.progressStart == 17, "직전 활동의 진행률에서 시작")
        #expect(middle.progress == 40)
    }

    @Test("챕터 기반 공부는 챕터 단위로 증분을 센다")
    func chapterStudyCountsChapters() throws {
        let store = try makeStore()
        let subject = UUID()
        let chapters: (Int) -> JSONValue = { done in
            .array((0..<10).map { .bool($0 < done) })
        }

        for (day, done) in [(4, 2), (9, 5)] {
            insert(
                into: store, category: "study", title: "\(done)개 챕터 완료",
                entityID: subject, entityTitle: "점프 투 FastAPI",
                occurredAt: date(day),
                payload: [
                    "progress_mode": .string("chapter"),
                    "chapters": .array((0..<10).map { .object(["title": .string("\($0)장")]) }),
                    "completed": chapters(done),
                ]
            )
        }
        try store.context.save()
        store.reload()

        let items = TimelineBuilder.days(from: store.records).flatMap(\.items)
        #expect(items.map(\.deltaLabel) == ["+3챕터", "+2챕터"])
        #expect(items.first?.summary == "10개 챕터")
    }

    // MARK: - Series

    @Test("시리즈는 에피소드를 본 날마다 한 줄이 된다")
    func seriesExpandsByWatchDate() throws {
        let store = try makeStore()

        insert(
            into: store,
            category: "culture",
            title: "아케인",
            entityID: UUID(),
            occurredAt: date(20),
            payload: [
                "type": .string("시리즈"),
                "episode_count": .int(9),
                "watched_episode_count": .int(4),
                "seasons": .array([
                    .object([
                        "season_number": .int(1),
                        "episode_count": .int(9),
                        // camelCase on purpose: this is how the web actually
                        // stores enriched episodes.
                        "episodes": .array((1...9).map { number in
                            .object([
                                "seasonNumber": .int(1),
                                "episodeNumber": .int(number),
                                "name": .string("EP\(number)"),
                                "overview": .string("EP\(number) 줄거리"),
                                "stillUrl": number == 3
                                    ? .string("https://image.tmdb.org/still3.jpg")
                                    : .null,
                            ])
                        }),
                    ])
                ]),
                // 3 and 4 share a timestamp, the way a binge does — the tie has
                // to break on airing order or the entry describes EP3.
                "episode_watch_dates": .object([
                    "1-1": .string(stamp(date(18, 21))),
                    "1-2": .string(stamp(date(18, 22))),
                    "1-3": .string(stamp(date(20, 20))),
                    "1-4": .string(stamp(date(20, 20))),
                ]),
            ]
        )
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)
        #expect(days.count == 2, "본 날마다 한 줄")

        let latest = try #require(days.first?.items.first)
        #expect(latest.deltaLabel == "+2화")
        #expect(latest.episodesToday.count == 2)
        // 4 of 9 watched overall, 2 of them that day.
        #expect(latest.progress == 44)
        #expect(latest.progressStart == 22)
        #expect(latest.seriesDayDelta == 22, "오늘 진행률 스탯에 쓰인다")

        // The body is the synopsis of the episode you finished on, not the one
        // you started with.
        #expect(latest.snippet == "EP4 줄거리")
        #expect(latest.episodesToday.map(\.code) == ["S1 · E3", "S1 · E4"])
        #expect(latest.episodesToday.first?.stillURL?.absoluteString
                == "https://image.tmdb.org/still3.jpg")
        #expect(latest.episodesToday.last?.stillURL == nil, "스틸이 없으면 코드로 대체된다")
    }

    // MARK: - Game

    @Test("게임은 세션마다 한 줄이다 — 같은 날이라도 합치지 않는다")
    func gameSessionsStayIndividualRows() throws {
        let store = try makeStore()

        insert(
            into: store,
            category: "culture",
            title: "발더스 게이트 3",
            entityID: UUID(),
            occurredAt: date(22),
            payload: [
                "type": .string("게임"),
                "status": .string("플레이 중"),
                "playtime": .string("3시간 00분"),
                "game_sessions": .array([
                    .object([
                        "id": .string("g1"),
                        "played_at": .string(stamp(date(21, 20))),
                        "duration_minutes": .int(90),
                        "note": .string("1막 클리어"),
                    ]),
                    .object([
                        "id": .string("g2"),
                        "played_at": .string(stamp(date(22, 19))),
                        "duration_minutes": .int(45),
                        "note": .string(""),
                    ]),
                    .object([
                        "id": .string("g3"),
                        "played_at": .string(stamp(date(22, 23))),
                        "duration_minutes": .int(75),
                        "note": .string("보스전"),
                    ]),
                ]),
            ]
        )
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)
        #expect(days.count == 2)
        #expect(days.first?.items.count == 2, "같은 날 두 번 플레이했으면 두 줄")

        let latest = try #require(days.first?.items.first)
        #expect(latest.gameMinutes == 75, "그 세션의 시간")
        #expect(latest.snippet == "보스전")
        #expect(latest.progress == nil, "게임에는 진행률이 없다")
    }

    @Test("세션에 시간이 없으면 playtime 문자열에서 읽는다")
    func playtimeStringIsParsedWhenSessionsAreMissing() throws {
        let store = try makeStore()

        insert(
            into: store, category: "culture", title: "옛날 게임 기록",
            entityID: UUID(), occurredAt: date(5),
            payload: [
                "type": .string("게임"),
                "status": .string("플레이 중"),
                "playtime": .string("2시간 30분"),
            ]
        )
        try store.context.save()
        store.reload()

        let item = try #require(TimelineBuilder.days(from: store.records).first?.items.first)
        #expect(item.gameMinutes == 150)
    }

    // MARK: - Shape

    @Test("여러 카테고리가 같은 날에 있으면 시간 역순으로 한 날에 모인다")
    func oneDayHoldsEveryCategoryNewestFirst() throws {
        let store = try makeStore()

        insert(
            into: store, category: "reading", title: "책",
            entityID: UUID(), occurredAt: date(25),
            payload: [
                "pages_total": .int(200),
                "reading_sessions": .array([
                    session(id: "r", at: date(25, 8), from: 0, to: 40,
                            fromProgress: 0, toProgress: 20, minutes: 30)
                ])
            ]
        )
        insert(
            into: store, category: "study", title: "공부",
            entityID: UUID(), occurredAt: date(25, 14),
            payload: ["progress_mode": .string("page"), "pages_read": .int(50), "pages_total": .int(100)]
        )
        insert(
            into: store, category: "culture", title: "영화",
            entityID: UUID(), occurredAt: date(25, 20),
            payload: ["type": .string("영화"), "status": .string("시청 완료")]
        )
        try store.context.save()
        store.reload()

        let days = TimelineBuilder.days(from: store.records)
        #expect(days.count == 1)

        let items = try #require(days.first?.items)
        #expect(items.map(\.title) == ["영화", "공부", "책"], "같은 날 안에서는 늦은 시각이 위")
        #expect(items.map(\.accent) == [.movie, .study, .reading])
        #expect(items[0].progress == nil, "영화에는 진행률이 없다")
    }

    @Test("공부 항목은 로그에 붙은 사진을 가져온다")
    func studyPhotosComeFromTheLogItself() throws {
        let store = try makeStore()

        insert(
            into: store, category: "study", title: "80p까지 공부",
            entityID: UUID(), entityTitle: "교재", occurredAt: date(11),
            payload: [
                "progress_mode": .string("page"),
                "pages_read": .int(80),
                "pages_total": .int(200),
                "photos": .array([
                    .string("/uploads/study-sessions/a.jpg"),
                    .string("/uploads/study-sessions/b.jpg"),
                ]),
            ]
        )
        try store.context.save()
        store.reload()

        let item = try #require(TimelineBuilder.days(from: store.records).first?.items.first)
        #expect(item.photos.count == 2, "공부는 세션이 아니라 로그에 사진이 붙는다")
        #expect(item.title == "교재", "공부 줄의 주인공은 과목이다")
    }

    @Test("공부 외에는 로그 제목을 쓴다")
    func nonStudyRowsKeepTheLogTitle() throws {
        let store = try makeStore()

        insert(
            into: store, category: "culture", title: "오펜하이머",
            entityID: UUID(), entityTitle: "엔티티 제목", occurredAt: date(2),
            payload: ["type": .string("영화"), "status": .string("시청 완료")]
        )
        try store.context.save()
        store.reload()

        let item = try #require(TimelineBuilder.days(from: store.records).first?.items.first)
        #expect(item.title == "오펜하이머")
    }

    @Test("기록이 없으면 빈 타임라인이다")
    func noRecordsMakeNoDays() throws {
        let store = try makeStore()
        store.reload()
        #expect(TimelineBuilder.days(from: store.records).isEmpty)
    }
}

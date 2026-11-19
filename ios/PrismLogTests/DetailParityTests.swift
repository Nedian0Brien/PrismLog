import Foundation
import Testing

@testable import PrismLog

/// The book, film, game and series details follow the web's pages
/// (2026-11-20); these pin the rules ported with them. The detail views
/// are main-actor types, so their helpers run there.
@MainActor
struct DetailParityTests {
    private func record(_ payload: [String: JSONValue], category: String = "reading") -> RecordItem {
        RecordItem(stored: StoredLog(
            id: UUID(),
            userID: "test",
            category: category,
            payloadData: StoredLog.encodeObject(payload)
        ))
    }

    private func session(_ date: String, from: Int, to: Int, pages: Int) -> JSONValue {
        .object([
            "date": .string(date), "from_progress": .int(from), "to_progress": .int(to),
            "from_pages": .int(from * 4), "to_pages": .int(to * 4), "pages_read": .int(pages),
        ])
    }

    @Test("플랫폼 이름은 웹 getSeriesPlatformLabel과 같다")
    func platformLabelsMatchTheWeb() {
        #expect(SeriesPlatformOption.label(key: "netflix", custom: "아무거나") == "넷플릭스")
        #expect(SeriesPlatformOption.label(key: "other", custom: " 왓챠 ") == "왓챠")
        #expect(SeriesPlatformOption.label(key: "other", custom: "") == "기타")
    }

    @Test("키 없이 이름만 저장된 기록도 플랫폼을 찾는다")
    func platformFromLabelAlone() {
        let netflix = record(["type": .string("시리즈"), "platform_label": .string("넷플릭스")], category: "culture")
        #expect(SeriesPlatformOption.of(netflix) == .netflix)
        let watcha = record(["type": .string("시리즈"), "platform_label": .string("왓챠")], category: "culture")
        #expect(SeriesPlatformOption.of(watcha) == .other)
        let keyed = record(["type": .string("시리즈"), "platform_key": .string("disney_plus"), "platform_label": .string("디즈니 플러스")], category: "culture")
        #expect(SeriesPlatformOption.of(keyed) == .disneyPlus)
        #expect(SeriesPlatformOption.of(record(["type": .string("시리즈")], category: "culture")) == nil)
    }

    @Test("플레이 시간 표기는 웹 formatDurationLabel과 같다")
    func durationLabelsMatchTheWeb() {
        #expect(DetailParts.duration(0) == "0분")
        #expect(DetailParts.duration(45) == "45분")
        #expect(DetailParts.duration(120) == "2시간")
        #expect(DetailParts.duration(65) == "1시간 5분")
    }

    @Test("독서 추세는 세션의 시작이 앞 끝과 이어지지 않을 때만 시작점을 더한다")
    func readingTrendFollowsTheWeb() {
        let book = record([
            "progress": .int(60),
            "reading_sessions": .array([
                session("2026-04-05T10:00:00.000Z", from: 0, to: 20, pages: 80),
                session("2026-04-06T10:00:00.000Z", from: 20, to: 40, pages: 80),
                session("2026-04-08T10:00:00.000Z", from: 50, to: 60, pages: 40),
            ]),
        ])
        #expect(ReadingDetailContent.trendPoints(for: book).map(\.progress) == [0, 20, 40, 50, 60])

        let unread = record(["progress": .int(30)])
        #expect(ReadingDetailContent.trendPoints(for: unread).map(\.label) == ["현재"])
        #expect(ReadingDetailContent.trendPoints(for: unread).map(\.progress) == [30])
    }

    @Test("독서 타임라인은 최근 날부터, 하루에 마지막 세션과 그날 메모를 묶는다")
    func readingDaysGroupLikeTheWeb() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let book = record([
            "reading_sessions": .array([
                session("2026-04-05T01:00:00.000Z", from: 0, to: 10, pages: 40),
                session("2026-04-05T09:00:00.000Z", from: 10, to: 20, pages: 40),
                session("2026-04-07T01:00:00.000Z", from: 20, to: 30, pages: 40),
            ]),
            "reading_notes": .array([
                .object(["date": .string("2026-04-05T03:00:00.000Z"), "text": .string("첫 메모")]),
                .object(["date": .string("2026-04-05T05:00:00.000Z"), "text": .string("둘째 메모")]),
            ]),
        ])
        let groups = ReadingDetailContent.dayGroups(for: book, calendar: calendar)
        #expect(groups.count == 2)
        #expect(groups.first?.session?.toProgress == 30)
        #expect(groups.last?.session?.toProgress == 20)
        #expect(groups.last?.notes.map(\.text) == ["둘째 메모", "첫 메모"])
    }
}

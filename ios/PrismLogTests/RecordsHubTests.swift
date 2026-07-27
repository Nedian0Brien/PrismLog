import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Pins the records hub against the web's `RecordsPage`.
///
/// Two things here are easy to get subtly wrong and impossible to spot in a
/// screenshot: study is counted by *entity* (nine sessions on one textbook is
/// one card), and the shelves are ordered by last activity, not by a fixed
/// list.
@Suite(.serialized)
@MainActor
struct RecordsHubTests {
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

    private func insert(
        into store: PrismStore,
        category: String,
        title: String,
        entityID: UUID? = nil,
        entityTitle: String? = nil,
        daysAgo: Int,
        payload: [String: JSONValue] = [:]
    ) {
        store.context.insert(StoredLog(
            id: UUID(),
            userID: store.userID,
            category: category,
            entityID: entityID,
            title: title,
            payloadData: StoredLog.encodeObject(payload),
            occurredAt: Date(timeIntervalSinceNow: TimeInterval(-86_400 * daysAgo)),
            entityTitle: entityTitle
        ))
    }

    @Test("공부는 엔티티 단위로 묶여 로그 수가 아니라 과목 수로 세어진다")
    func studyCountsByEntityNotByLog() throws {
        let store = try makeStore()
        let textbook = UUID()

        for day in 1...3 {
            insert(
                into: store,
                category: "study",
                title: "\(day * 20)p까지 공부",
                entityID: textbook,
                entityTitle: "실전 AI 애플리케이션 개발",
                daysAgo: day
            )
        }
        insert(into: store, category: "study", title: "다른 주제", daysAgo: 9)
        try store.context.save()
        store.reload()

        let groups = StudyGrouping.groups(from: store.records(in: .study))

        #expect(groups.count == 2, "로그 4건이 과목 2개로 묶여야 함")
        #expect(groups[0].title == "실전 AI 애플리케이션 개발", "그룹 제목은 엔티티 제목이어야 함")
        #expect(groups[0].activityCount == 3)
        // The newest activity represents the group, so opening it lands on the
        // session you last recorded.
        #expect(groups[0].latest.title == "20p까지 공부")
    }

    @Test("엔티티가 없는 공부 로그는 각자 하나의 그룹이 된다")
    func studyWithoutAnEntityStandsAlone() throws {
        let store = try makeStore()
        insert(into: store, category: "study", title: "혼자 있는 기록 A", daysAgo: 1)
        insert(into: store, category: "study", title: "혼자 있는 기록 B", daysAgo: 2)
        try store.context.save()
        store.reload()

        #expect(StudyGrouping.groups(from: store.records(in: .study)).count == 2)
    }

    @Test("허브 카드는 최근 활동순으로 정렬된다")
    func sectionsSortByMostRecentActivity() throws {
        let store = try makeStore()

        insert(into: store, category: "reading", title: "오래된 책", daysAgo: 30)
        insert(
            into: store,
            category: "culture",
            title: "어제 본 영화",
            daysAgo: 1,
            payload: ["type": .string("영화")]
        )
        insert(into: store, category: "study", title: "일주일 전 공부", daysAgo: 7)
        try store.context.save()
        store.reload()

        let sections = RecordSection.sections(from: store)
        let ordered = sections.prefix(3).map(\.accent)

        #expect(ordered == [.movie, .study, .reading], "가장 최근에 기록한 영역이 맨 위여야 함")
    }

    @Test("기록이 없는 영역도 카드로 남고 고정 순서로 뒤에 붙는다")
    func emptySectionsKeepTheirPlace() throws {
        let store = try makeStore()
        insert(into: store, category: "reading", title: "유일한 책", daysAgo: 1)
        try store.context.save()
        store.reload()

        let sections = RecordSection.sections(from: store)

        #expect(sections.count == 5, "다섯 영역 카드가 모두 있어야 함")
        #expect(sections[0].accent == .reading)
        #expect(sections[0].count == 1)
        // Everything else is empty and falls back to the declared order.
        #expect(sections.dropFirst().map(\.accent) == [.study, .movie, .series, .game])
        #expect(sections.dropFirst().allSatisfy { $0.count == 0 })
    }

    @Test("카드 단위와 설명이 웹과 같다")
    func unitsAndCaptionsMatchTheWeb() throws {
        let store = try makeStore()
        store.reload()

        let byAccent = Dictionary(
            uniqueKeysWithValues: RecordSection.sections(from: store).map { ($0.accent, $0) }
        )

        #expect(byAccent[.reading]?.unit == "권")
        #expect(byAccent[.study]?.unit == "개")
        #expect(byAccent[.movie]?.unit == "편")
        #expect(byAccent[.series]?.unit == "편")
        #expect(byAccent[.game]?.unit == "개")

        #expect(byAccent[.reading]?.detail == "표지와 진행률")
        #expect(byAccent[.study]?.detail == "진척률과 챕터")
        #expect(byAccent[.movie]?.detail == "포스터와 평점")
        #expect(byAccent[.series]?.detail == "회차와 상태")
        #expect(byAccent[.game]?.detail == "플레이 시간")
    }

    @Test("프리뷰는 최신 3건까지만 담는다")
    func previewsCapAtThree() throws {
        let store = try makeStore()
        for day in 1...6 {
            insert(into: store, category: "reading", title: "책 \(day)", daysAgo: day)
        }
        try store.context.save()
        store.reload()

        let reading = try #require(RecordSection.sections(from: store).first { $0.accent == .reading })

        #expect(reading.count == 6)
        #expect(reading.previews.count == 3)
        #expect(reading.previews.map(\.title) == ["책 1", "책 2", "책 3"])
    }
}

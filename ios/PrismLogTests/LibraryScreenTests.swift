import CoreGraphics
import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Pins the library screen's rules (spec §6.1, §7.2): what counts as "in
/// progress", how the streak counts, and how two columns split at a fold.
@Suite(.serialized)
@MainActor
struct LibraryScreenTests {
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
        daysAgo: Double = 0,
        payload: [String: JSONValue] = [:]
    ) {
        store.context.insert(StoredLog(
            id: UUID(),
            userID: store.userID,
            category: category,
            entityID: entityID,
            title: title,
            payloadData: StoredLog.encodeObject(payload),
            occurredAt: Date(timeIntervalSinceNow: -86_400 * daysAgo),
            entityTitle: entityID == nil ? nil : title
        ))
    }

    // MARK: In progress

    @Test("읽는 중인 책, 시청 중인 시리즈, 플레이 중인 게임, 진행 중인 공부만 진행 중으로 센다")
    func inProgressFollowsEachCategoryRule() throws {
        let store = try makeStore()
        insert(into: store, category: "reading", title: "읽는 중", daysAgo: 1,
               payload: ["pages_read": .int(120), "pages_total": .int(300)])
        insert(into: store, category: "reading", title: "다 읽음", daysAgo: 2,
               payload: ["pages_read": .int(300), "pages_total": .int(300)])
        insert(into: store, category: "reading", title: "아직 안 펼침", daysAgo: 3)
        insert(into: store, category: "culture", title: "보는 중인 시리즈", daysAgo: 4,
               payload: ["type": .string("시리즈"), "status": .string("시청 중")])
        insert(into: store, category: "culture", title: "다 본 시리즈", daysAgo: 5,
               payload: ["type": .string("시리즈"), "status": .string("시청 완료")])
        insert(into: store, category: "culture", title: "하는 중인 게임", daysAgo: 6,
               payload: ["type": .string("게임"), "status": .string("플레이 중"), "hours": .double(12.4)])
        insert(into: store, category: "culture", title: "영화", daysAgo: 7,
               payload: ["type": .string("영화"), "status": .string("시청 중")])
        insert(into: store, category: "study", title: "선형대수", entityID: UUID(), daysAgo: 8,
               payload: ["progress": .int(40)])
        insert(into: store, category: "study", title: "끝낸 과목", entityID: UUID(), daysAgo: 9,
               payload: ["progress": .int(100)])
        try store.context.save()
        store.reload()

        let items = LibraryMetrics.inProgress(from: store.records)

        #expect(items.map(\.title) == ["읽는 중", "보는 중인 시리즈", "하는 중인 게임", "선형대수"])
        #expect(items[0].detail == "120 / 300쪽")
        #expect(items[0].progress == 40)
        #expect(items[2].detail == "플레이 중 · 12시간")
        #expect(items[2].progress == nil)
        #expect(items[3].detail == "40% 진행")
    }

    @Test func inProgressStopsAtTheCarouselLimit() throws {
        let store = try makeStore()
        for index in 0..<15 {
            insert(into: store, category: "reading", title: "책 \(index)", daysAgo: Double(index),
                   payload: ["progress": .int(30)])
        }
        try store.context.save()
        store.reload()

        let items = LibraryMetrics.inProgress(from: store.records)
        #expect(items.count == LibraryMetrics.inProgressLimit)
        #expect(items.first?.title == "책 0", "가장 최근 활동이 먼저 와야 함")
    }

    // MARK: Streak

    @Test("오늘이나 어제까지 이어진 날만 연속 기록으로 센다")
    func streakCountsBackFromTodayOrYesterday() throws {
        let store = try makeStore()
        for day in [0.0, 1, 2, 4] {
            insert(into: store, category: "reading", title: "d\(day)", daysAgo: day)
        }
        try store.context.save()
        store.reload()

        let today = Date.now
        #expect(LibraryMetrics.streakDays(from: store.records, today: today) == 3)

        // Tomorrow, before anything is logged, the streak still stands.
        let tomorrow = today.addingTimeInterval(86_400)
        #expect(LibraryMetrics.streakDays(from: store.records, today: tomorrow) == 3)

        // Two days on, it's broken.
        #expect(LibraryMetrics.streakDays(from: store.records, today: today.addingTimeInterval(2 * 86_400)) == 0)
    }

    @Test func noRecordsMeansNoStreak() {
        #expect(LibraryMetrics.streakDays(from: []) == 0)
    }

    // MARK: Columns

    @Test("접힘선이 있으면 두 열이 접힘선 양쪽에 놓이고 사이 간격이 접힘선을 덮는다")
    func columnsSplitAtTheFold() {
        let fold = CGRect(x: 440, y: 0, width: 36, height: 900)
        let split = ColumnSplit.make(width: 920, height: 900, divisions: [fold], spacing: 14)
        #expect(split.followsFold)
        #expect(split.leadingWidth == 440)
        #expect(split.gap == 36)
    }

    @Test func columnsHalveTheWidthWithoutAFold() {
        let split = ColumnSplit.make(width: 920, height: 900, divisions: [], spacing: 14)
        #expect(!split.followsFold)
        #expect(split.leadingWidth == 453)
        #expect(split.gap == 14)
    }

    @Test("가로로 누운 접힘선(테이블탑)은 좌우 열을 나누지 않는다")
    func aHorizontalFoldDoesNotSplitColumns() {
        let tabletopFold = CGRect(x: 0, y: 430, width: 920, height: 30)
        let split = ColumnSplit.make(width: 920, height: 900, divisions: [tabletopFold], spacing: 14)
        #expect(!split.followsFold)
    }
}

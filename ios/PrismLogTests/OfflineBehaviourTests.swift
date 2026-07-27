import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// The denormalized game fields and the activity editor both rewrite payloads
/// in place; these pin the exact shape they leave behind.
@Suite(.serialized)
@MainActor
struct RecordMutationTests {
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

    @Test("게임 세션을 수정하면 시간·메모·사진이 바뀌고 누적이 다시 계산된다")
    func editingAGameSessionRecomputesTotals() async throws {
        let store = try makeStore()
        let id = UUID()

        store.context.insert(StoredLog(
            id: id,
            userID: store.userID,
            category: "culture",
            title: "발더스 게이트 3",
            payloadData: StoredLog.encodeObject([
                "type": .string("게임"),
                "game_sessions": .array([
                    .object([
                        "id": .string("g1"),
                        "played_at": .string("2026-06-01T20:00:00Z"),
                        "duration_minutes": .int(60),
                        "note": .string("원래 메모"),
                        "photos": .array([]),
                    ]),
                    .object([
                        "id": .string("g2"),
                        "played_at": .string("2026-06-03T21:00:00Z"),
                        "duration_minutes": .int(30),
                        "note": .string(""),
                        "photos": .array([]),
                    ]),
                ]),
                "playtime": .string("1시간 30분"),
            ])
        ))
        try store.context.save()
        store.reload()

        await store.updateGameSession(
            id: id,
            sessionID: "g1",
            playedAt: PrismDateCoding.parse("2026-06-02T19:00:00Z")!,
            durationMinutes: 90,
            note: "수정된 메모",
            photoPaths: ["/uploads/game-sessions/shot.jpg"]
        )

        let record = try #require(store.record(id: id))
        let sessions = try #require(record.payload.array("game_sessions"))
        let edited = try #require(sessions.first { $0.objectValue?.string("id") == "g1" }?.objectValue)

        #expect(edited.int("duration_minutes") == 90)
        #expect(edited.string("note") == "수정된 메모")
        #expect(edited.array("photos")?.count == 1)
        #expect(record.payload.string("playtime") == "2시간 00분", "90+30분이 다시 합산돼야 한다")
        // The untouched session must survive byte-for-byte.
        let other = try #require(sessions.first { $0.objectValue?.string("id") == "g2" }?.objectValue)
        #expect(other.int("duration_minutes") == 30)
    }

    @Test("공부 활동 수정은 제목·메모·시각·사진만 바꾸고 진행률은 남긴다")
    func editingAStudyActivityLeavesProgressAlone() async throws {
        let store = try makeStore()
        let id = UUID()
        let movedTo = PrismDateCoding.parse("2026-05-05T09:30:00Z")!

        store.context.insert(StoredLog(
            id: id,
            userID: store.userID,
            category: "study",
            title: "150p까지 공부",
            payloadData: StoredLog.encodeObject([
                "progress_mode": .string("page"),
                "pages_read": .int(150),
                "pages_total": .int(500),
                "progress": .int(30),
                "goal": .string("주 3회"),
            ])
        ))
        try store.context.save()
        store.reload()

        await store.updateStudyActivity(
            id: id,
            title: "154p까지 공부",
            summary: "새 메모",
            occurredAt: movedTo,
            photoPaths: ["/uploads/study-sessions/note.jpg"]
        )

        let record = try #require(store.record(id: id))
        #expect(record.title == "154p까지 공부")
        #expect(record.summary == "새 메모")
        #expect(record.occurredAt == movedTo)
        #expect(record.payload.array("photos")?.count == 1)
        #expect(record.payload.int("progress") == 30, "진행률은 편집 대상이 아니다")
        #expect(record.payload.string("goal") == "주 3회", "모르는 키는 남는다")
    }

    @Test("히트맵 강도는 3건이면 이미 최고 단계다")
    func heatmapIntensityMatchesTheWebCap() {
        #expect(DashboardMetrics.intensity(for: 0) == 0)
        #expect(DashboardMetrics.intensity(for: 1) == 1)
        #expect(DashboardMetrics.intensity(for: 2) == 2)
        #expect(DashboardMetrics.intensity(for: 3) == 3)
        #expect(DashboardMetrics.intensity(for: 9) == 3)
    }
}

/// Local-first means an unreachable server is a normal state, not an error
/// screen. These use a real socket that nothing is listening on rather than a
/// mock, so the actual `URLError` mapping is exercised.
///
/// Each test builds its own store; the suite is serialized so a failure is
/// attributable to one test rather than to whichever ran alongside it.
@Suite(.serialized)
@MainActor
struct OfflineBehaviourTests {
    /// Points at a port nothing listens on, so every request fails the way a
    /// real loss of connectivity does.
    private func makeStore() throws -> (PrismStore, ModelContext) {
        let container = try ModelContainer(
            for: StoredLog.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let unreachable = PrismAPIClient(baseURL: URL(string: "http://127.0.0.1:9")!)
        let store = PrismStore(container: container, api: unreachable)
        return (store, container.mainContext)
    }

    @Test("서버에 닿지 못하면 오류가 아니라 오프라인 상태가 된다")
    func unreachableServerReportsOffline() async throws {
        let (store, _) = try makeStore()

        await store.sync()

        #expect(store.status == .offline)
        #expect(store.hasLoadedOnce, "오프라인이어도 첫 로드는 끝난 것으로 취급해야 빈 화면이 안 뜬다")
    }

    @Test("오프라인이어도 캐시된 기록은 그대로 보인다")
    func cachedRecordsRemainReadableOffline() async throws {
        let (store, context) = try makeStore()

        context.insert(StoredLog(
            id: UUID(),
            userID: store.userID,
            category: "reading",
            title: "캐시된 책",
            payloadData: StoredLog.encodeObject([
                "pages_read": .int(120),
                "pages_total": .int(300),
            ])
        ))
        try context.save()

        await store.sync()

        #expect(store.records.count == 1)
        let record = try #require(store.records.first)
        #expect(record.title == "캐시된 책")
        #expect(record.progress == 40)
    }

    @Test("오프라인 수정은 큐에 남아 다음 동기화를 기다린다")
    func offlineEditsQueueUp() async throws {
        let (store, context) = try makeStore()
        let id = UUID()

        context.insert(StoredLog(
            id: id,
            userID: store.userID,
            category: "reading",
            title: "진행 중인 책",
            payloadData: StoredLog.encodeObject(["pages_read": .int(10), "note": .string("보존")])
        ))
        try context.save()

        await store.updateRecord(id: id) { payload in
            payload["pages_read"] = .int(42)
        }

        #expect(store.pendingChangeCount == 1, "전송 못 한 변경이 큐에 남아야 함")

        let record = try #require(store.record(id: id))
        #expect(record.pagesRead == 42, "서버에 못 보내도 화면에는 즉시 반영")
        #expect(record.payload["note"] == .string("보존"), "수정하지 않은 키는 유지")
    }
}

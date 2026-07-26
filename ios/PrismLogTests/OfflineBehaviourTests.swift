import Foundation
import SwiftData
import Testing

@testable import PrismLog

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

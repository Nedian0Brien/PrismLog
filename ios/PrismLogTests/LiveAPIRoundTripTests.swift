import Foundation
import UIKit
import Testing

@testable import PrismLog

/// End-to-end check against the real backend.
///
/// Runs under a throwaway `user_id` so it never touches the records the web app
/// shows, and deletes what it creates. Network-dependent by design — this is the
/// only thing that proves the Swift encoder and the FastAPI/JSONB pair agree.
/// Excluded from the default suite; run explicitly:
///
///     xcodebuild test … -only-testing:PrismLogTests/LiveAPIRoundTripTests
@Suite(.disabled("실서버에 쓰기 때문에 기본 실행에서 제외 — 필요할 때 명시적으로 실행"))
struct LiveAPIRoundTripTests {
    static let testUserID = "ios-selftest"

    /// The store swallows upload failures so one bad photo can't lose a reading
    /// session — which means a malformed multipart body would fail silently.
    @Test("multipart 사진 업로드가 서버에 실제로 통한다")
    func photoUploadIsAcceptedByTheServer() async throws {
        let api = PrismAPIClient()

        // Smallest thing UIImage will encode: a 4×4 red square.
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 4, height: 4))
        let image = renderer.image { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 4, height: 4))
        }
        let jpeg = try #require(image.jpegData(compressionQuality: 0.85))

        let path = try await api.uploadPhoto(category: "reading-sessions", jpeg: jpeg)

        #expect(path.hasPrefix("/uploads/reading-sessions/"), "예상과 다른 경로: \(path)")

        // And the stored path has to resolve to something fetchable.
        let resolved = try #require(PrismMedia.url(for: path))
        let (data, response) = try await URLSession.shared.data(from: resolved)
        #expect((response as? HTTPURLResponse)?.statusCode == 200)
        #expect(!data.isEmpty)
    }

    @Test("생성 → PATCH → 조회를 거쳐도 payload 키가 하나도 사라지지 않는다")
    func payloadSurvivesTheRealBackend() async throws {
        let api = PrismAPIClient()
        let original = try JSONDecoder().decode(
            [String: JSONValue].self,
            from: Data(PayloadFidelityTests.realWorldPayload.utf8)
        )

        let created = try await api.createLog(LogCreateDTO(
            userId: Self.testUserID,
            category: "reading",
            title: "왕복 테스트",
            payload: original,
            occurredAt: .now
        ))

        defer { Task { try? await api.deleteLog(id: created.id) } }

        #expect(created.payload == original, "생성 직후부터 payload가 달라짐")

        // Now do exactly what the app does on an edit: take the payload back,
        // change one field, send the whole thing.
        var edited = created.payload
        edited["pages_read"] = .int(412)

        let patched = try await api.updateLog(id: created.id, patch: LogUpdateDTO(payload: edited))

        #expect(patched.payload["pages_read"] == .int(412))
        for (key, value) in original where key != "pages_read" {
            #expect(patched.payload[key] == value, "PATCH 후 '\(key)' 값이 변경되거나 사라짐")
        }
        #expect(patched.payload.keys.sorted() == original.keys.sorted())

        // And a fresh read agrees.
        let refetched = try await api.fetchAllLogs(userID: Self.testUserID)
        let match = try #require(refetched.first { $0.id == created.id })
        #expect(match.payload == patched.payload)

        try await api.deleteLog(id: created.id)
        let afterDelete = try await api.fetchAllLogs(userID: Self.testUserID)
        #expect(!afterDelete.contains { $0.id == created.id })
    }
}

import Foundation
import Testing

@testable import PrismLog

/// The highest-stakes tests in the project.
///
/// `logs.payload` is free-form JSONB that the web app owns as much as this one.
/// If an iOS edit drops a key the web wrote, the user silently loses data in
/// production. These tests pin the round-trip.
struct PayloadFidelityTests {
    /// Shaped after a real record from `prism.lawdigest.kr`: both key spellings
    /// of the same field, an explicit null, nested session objects, unicode,
    /// integers that must not become floats, and a genuine float.
    static let realWorldPayload = """
    {
      "isbn": "9791187886945",
      "cover": "https://example.invalid/cover.jpg",
      "author": "저자 : 존 스칼지, 역자 : 유소영",
      "rating": 0,
      "review": "",
      "progress": 100,
      "pages_read": 400,
      "readPages": 400,
      "pages_total": 400,
      "progress_value": null,
      "progress_mode": "page",
      "reading_status": "finished",
      "score": 4.5,
      "source_metadata": {
        "form": "종이책",
        "pre_price": "16800",
        "ebook_yn": "N"
      },
      "reading_sessions": [
        {
          "id": "reading-session-2026-06-22",
          "date": "2026-06-22T01:23:03.584Z",
          "to_pages": 400,
          "from_pages": 0,
          "duration_minutes": 0,
          "photos": []
        }
      ],
      "tags": ["SF", "휴고상"],
      "watched": false
    }
    """

    private func decode(_ json: String) throws -> [String: JSONValue] {
        try JSONDecoder().decode([String: JSONValue].self, from: Data(json.utf8))
    }

    @Test("payload가 디코딩·인코딩을 거쳐도 값이 하나도 변하지 않는다")
    func roundTripPreservesEverything() throws {
        let original = try decode(Self.realWorldPayload)

        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode([String: JSONValue].self, from: encoded)

        #expect(decoded == original)
        #expect(decoded.keys.sorted() == original.keys.sorted())
    }

    @Test("정수는 정수로, null은 null로 남는다")
    func numbersAndNullsKeepTheirKind() throws {
        let payload = try decode(Self.realWorldPayload)

        #expect(payload["pages_read"] == .int(400))
        #expect(payload["score"] == .double(4.5))
        #expect(payload["progress_value"] == .null)
        #expect(payload["watched"] == .bool(false))

        // An int must not come back as 400.0 — the backend stores what we send.
        let reEncoded = String(decoding: try JSONEncoder().encode(payload["pages_read"]), as: UTF8.self)
        #expect(reEncoded == "400")
    }

    @Test("모르는 키를 건드리지 않고 한 필드만 수정할 수 있다")
    func editingOneFieldLeavesTheRestIntact() throws {
        var payload = try decode(Self.realWorldPayload)
        let untouchedKeys = payload.keys.filter { $0 != "pages_read" }.sorted()
        let before = untouchedKeys.map { payload[$0] }

        payload["pages_read"] = .int(412)

        #expect(payload["pages_read"] == .int(412))
        #expect(payload.keys.sorted() == (untouchedKeys + ["pages_read"]).sorted())
        #expect(untouchedKeys.map { payload[$0] } == before)
    }

    @Test("snake_case와 camelCase 어느 쪽으로 물어도 같은 값을 찾는다")
    func keyLookupToleratesBothSpellings() throws {
        let payload = try decode(Self.realWorldPayload)

        #expect(payload.int("pages_read") == 400)
        #expect(payload.int("pagesRead") == 400)
        #expect(payload.int("pages_total") == 400)
        // Only the camelCase spelling exists for this one in the fixture.
        #expect(payload.int("readPages") == 400)
        // Explicit nulls are treated as absent so the fallback spelling wins.
        #expect(payload.value("progress_value") == nil)
    }

    @Test("StoredLog에 저장했다 꺼내도 payload가 동일하다")
    func storageRoundTripIsLossless() throws {
        let original = try decode(Self.realWorldPayload)

        let stored = StoredLog(
            id: UUID(),
            userID: "test",
            category: "reading",
            payloadData: StoredLog.encodeObject(original)
        )

        #expect(stored.payload == original)

        // And the UI model exposes the untouched original for editing.
        let item = RecordItem(stored: stored)
        #expect(item.payload == original)
        #expect(item.pagesRead == 400)
        #expect(item.pagesTotal == 400)
        #expect(item.progress == 100)
    }
}

struct DateParsingTests {
    @Test("서버의 마이크로초·밀리초·무소수점 타임스탬프를 모두 읽는다")
    func parsesEveryTimestampShapeTheAPIEmits() {
        // logs.created_at
        #expect(PrismDateCoding.parse("2026-06-22T01:23:05.456065Z") != nil)
        // payload.reading_sessions[].date, written by the web
        #expect(PrismDateCoding.parse("2026-06-22T01:23:03.584Z") != nil)
        // legacy rows
        #expect(PrismDateCoding.parse("2026-06-22T01:23:05Z") != nil)
        // offset instead of Z
        #expect(PrismDateCoding.parse("2026-06-22T10:23:05+09:00") != nil)

        #expect(PrismDateCoding.parse("어제") == nil)
    }

    @Test("마이크로초를 잘라내도 같은 초를 가리킨다")
    func microsecondsTruncateToTheSameInstant() throws {
        let micro = try #require(PrismDateCoding.parse("2026-06-22T01:23:05.456065Z"))
        let milli = try #require(PrismDateCoding.parse("2026-06-22T01:23:05.456Z"))

        #expect(abs(micro.timeIntervalSince(milli)) < 0.001)
    }
}

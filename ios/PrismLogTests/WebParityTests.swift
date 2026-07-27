import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Pins the record shape this app writes against the shape the web writes.
///
/// The two clients share one database and one free-form `payload`. If iOS omits
/// a field the web's edit sheet reads, that book silently loses its medium,
/// status, or rating the moment someone opens it on the web.
@Suite(.serialized)
@MainActor
struct WebParityTests {
    private func makeStore() throws -> PrismStore {
        let container = try ModelContainer(
            for: StoredLog.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        // Unreachable on purpose: the local row is what's under test, and the
        // push is expected to stay queued.
        return PrismStore(
            container: container,
            api: PrismAPIClient(baseURL: URL(string: "http://127.0.0.1:9")!)
        )
    }

    private var sampleBook: BookSearchItem {
        BookSearchItem(
            sourceProvider: "naver",
            sourceId: "naver:9791187886945",
            title: "무너지는 제국",
            authors: ["존 스칼지"],
            publisher: "구픽",
            isbn: "9791187886945",
            isbn13: "9791187886945",
            coverUrl: "https://example.invalid/cover.jpg",
            publishedDate: "2023-04-28",
            description: "설명",
            pagesTotal: 400
        )
    }

    @Test("새 책 payload가 웹 폼이 쓰는 필드를 모두 포함한다")
    func createdPayloadMatchesTheWebForm() async throws {
        let store = try makeStore()

        await store.createReadingRecord(
            from: sampleBook,
            enrichment: nil,
            draft: ReadingDraft(
                pagesTotal: 400,
                pagesRead: 100,
                medium: .ebook,
                ebookService: .ridi,
                status: .reading,
                rating: 4,
                review: "좋았다",
                memo: "인상 깊은 문장",
                tags: ["SF", "휴고상"]
            )
        )

        let record = try #require(store.records.first)

        // Fields `createReadingFormState` (core.jsx:317) produces.
        #expect(record.payload["medium"] == .string("ebook"))
        #expect(record.payload["ebook_service"] == .string("ridi"))
        #expect(record.payload["reading_status"] == .string("reading"))
        #expect(record.payload["progress_mode"] == .string("page"))
        #expect(record.payload["progress_value"] == .int(25))
        #expect(record.payload["rating"] == .int(4))
        #expect(record.payload["review"] == .string("좋았다"))
        #expect(record.payload["pages_read"] == .int(100))
        #expect(record.payload["pages_total"] == .int(400))
        #expect(record.payload["progress"] == .int(25))
        #expect(record.payload["author"] == .string("존 스칼지"))
        #expect(record.payload["publisher"] == .string("구픽"))
        #expect(record.payload["isbn13"] == .string("9791187886945"))
        #expect(record.payload["cover"] == .string("https://example.invalid/cover.jpg"))
        #expect(record.payload["source_provider"] == .string("naver"))

        // Tags live on the log row, not the payload — same as the web.
        #expect(record.tags == ["SF", "휴고상"])

        // A memo becomes the first reading note.
        let notes = try #require(record.payload["reading_notes"]?.arrayValue)
        #expect(notes.count == 1)
        #expect(notes.first?["text"] == .string("인상 깊은 문장"))
        #expect(notes.first?["page"] == .int(100))
    }

    @Test("종이책이면 ebook_service를 쓰지 않는다")
    func paperBooksOmitTheEbookService() async throws {
        let store = try makeStore()

        await store.createReadingRecord(
            from: sampleBook,
            enrichment: nil,
            draft: ReadingDraft(pagesTotal: 400, medium: .paper, ebookService: .ridi)
        )

        let record = try #require(store.records.first)
        #expect(record.payload["ebook_service"] == nil, "웹도 종이책이면 이 값을 비운다")
    }

    @Test("새 기록은 서버에 엔티티를 만들도록 표시된다")
    func newRecordsAreQueuedWithAnEntity() async throws {
        let store = try makeStore()

        await store.createReadingRecord(
            from: sampleBook,
            enrichment: nil,
            draft: ReadingDraft(pagesTotal: 400)
        )

        // `needsEntity` is what makes the push create a LogEntity before the
        // log, which is how the backend dedupes books across clients. It can
        // only clear once the server has been reached.
        let record = try #require(store.records.first)
        #expect(record.entityID == nil, "아직 서버에 못 보냈으니 비어 있어야 한다")
        #expect(store.pendingChangeCount == 1)
    }

    @Test("태그 입력은 # 구분과 쉼표 구분을 모두 받는다")
    func tagInputAcceptsBothSeparators() {
        #expect(parseTagInput("#자기계발 #소설") == ["자기계발", "소설"])
        #expect(parseTagInput("자기계발, 소설") == ["자기계발", "소설"])
        #expect(parseTagInput("  ") == [])
    }
}

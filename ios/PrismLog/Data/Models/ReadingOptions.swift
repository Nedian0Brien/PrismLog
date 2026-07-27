import Foundation

/// Option sets the web writes into `payload`. The raw values are the contract —
/// changing one silently reinterprets existing records.
/// Source: `mediaOptions` / `statusOptions` in `forms/newLogForm.jsx` and
/// `EBOOK_SERVICES` in `core.jsx:296`.

enum ReadingMedium: String, CaseIterable, Identifiable, Sendable {
    case paper
    case ebook
    case rental

    var id: String { rawValue }

    var label: String {
        switch self {
        case .paper: "종이책"
        case .ebook: "전자책"
        case .rental: "대여"
        }
    }

    var symbol: String {
        switch self {
        case .paper: "book.closed.fill"
        case .ebook: "ipad"
        case .rental: "tag.fill"
        }
    }
}

enum ReadingStatus: String, CaseIterable, Identifiable, Sendable {
    case reading
    case planned
    case finished

    var id: String { rawValue }

    var label: String {
        switch self {
        case .reading: "읽는 중"
        case .planned: "읽을 예정"
        case .finished: "완독"
        }
    }
}

enum EbookService: String, CaseIterable, Identifiable, Sendable {
    case ridi
    case millie
    case kyobo
    case aladin
    case yes24

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ridi: "리디북스"
        case .millie: "밀리의서재"
        case .kyobo: "교보 eBook"
        case .aladin: "알라딘"
        case .yes24: "yes24"
        }
    }
}

/// Everything the new-book form collects, so the store's signature stays honest
/// as fields accumulate.
struct ReadingDraft: Sendable {
    var pagesTotal: Int = 0
    var pagesRead: Int = 0
    var medium: ReadingMedium = .paper
    var ebookService: EbookService?
    var status: ReadingStatus = .reading
    var rating: Int = 0
    var review: String = ""
    var memo: String = ""
    var tags: [String] = []

    var progress: Int {
        guard pagesTotal > 0 else { return 0 }
        return min(max(Int((Double(pagesRead) / Double(pagesTotal) * 100).rounded()), 0), 100)
    }
}

extension RecordItem {
    var medium: ReadingMedium? {
        payload.string("medium").flatMap(ReadingMedium.init(rawValue:))
    }

    var readingStatus: ReadingStatus? {
        payload.string("reading_status").flatMap(ReadingStatus.init(rawValue:))
    }

    var ebookService: EbookService? {
        payload.string("ebook_service").flatMap(EbookService.init(rawValue:))
    }

    var publisher: String? { payload.string("publisher") }
    var publishedDate: String? { payload.string("published_date") }
}

/// Splits a free-text tag field the way the web does — `#자기계발 #소설` or
/// comma separated, both accepted.
func parseTagInput(_ raw: String) -> [String] {
    raw
        .split(whereSeparator: { $0 == "#" || $0 == "," || $0.isWhitespace })
        .map { $0.trimmingCharacters(in: .whitespaces) }
        .filter { !$0.isEmpty }
}

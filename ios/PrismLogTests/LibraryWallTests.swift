import CoreGraphics
import Foundation
import SwiftData
import Testing

@testable import PrismLog

/// Pins the library wall's composition rules (spec §4.1, §4.3–4.5): one
/// cover per entity, rows in category order, contexts that filter, and a
/// flow that loops without seams and resumes where it paused.
@Suite
struct LibraryWallTests {
    // MARK: Fixtures

    private static func cover(
        _ id: String,
        _ accent: PrismAccent,
        daysAgo: Double = 0,
        url: URL? = nil
    ) -> WallCover {
        WallCover(
            id: id,
            accent: accent,
            title: id,
            coverURL: url,
            lastActivity: Date(timeIntervalSinceReferenceDate: 1_000_000 - daysAgo * 86_400)
        )
    }

    private static let mixed: [WallCover] = [
        cover("book-1", .reading, daysAgo: 1),
        cover("book-2", .reading, daysAgo: 4),
        cover("film-1", .movie, daysAgo: 2),
        cover("game-1", .game, daysAgo: 3),
        cover("show-1", .series, daysAgo: 5),
        cover("study-1", .study, daysAgo: 6),
    ]

    @MainActor
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

    // MARK: Covers

    @Test("같은 엔티티의 기록 여러 건은 표지 하나가 되고, 최근 활동 순으로 놓인다")
    @MainActor
    func oneCoverPerEntityMostRecentFirst() throws {
        let store = try makeStore()
        let textbook = UUID()
        for day in 1...3 {
            store.context.insert(StoredLog(
                id: UUID(),
                userID: store.userID,
                category: "study",
                entityID: textbook,
                title: "\(day * 20)p까지",
                payloadData: StoredLog.encodeObject([:]),
                occurredAt: Date(timeIntervalSinceNow: TimeInterval(-86_400 * day)),
                entityTitle: "선형대수"
            ))
        }
        store.context.insert(StoredLog(
            id: UUID(),
            userID: store.userID,
            category: "reading",
            title: "무너지는 제국",
            payloadData: StoredLog.encodeObject([:]),
            occurredAt: Date(timeIntervalSinceNow: -86_400 * 2)
        ))
        try store.context.save()
        store.reload()

        let covers = WallComposition.covers(from: store.records)

        #expect(covers.count == 2)
        #expect(covers.map(\.title) == ["선형대수", "무너지는 제국"])
        #expect(covers[0].id == textbook.uuidString)
    }

    @Test("표지가 없는 기록은 생성 표지를 원천으로 쓴다")
    func coverlessRecordsUseAGeneratedSource() {
        let url = URL(string: "https://covers.example/a.jpg")!
        #expect(Self.cover("a", .reading, url: url).source == .remote(url))
        #expect(Self.cover("b", .study).source == .generated(.study, title: "b"))
    }

    // MARK: Contexts

    @Test func contextsFilterTheCovers() {
        let all = Self.mixed
        #expect(WallComposition.covers(all, in: .all) == all)
        #expect(WallComposition.covers(all, in: .still) == all)
        #expect(WallComposition.covers(all, in: .category(.reading)).map(\.id) == ["book-1", "book-2"])

        let lastTwoDays = DateInterval(
            start: Date(timeIntervalSinceReferenceDate: 1_000_000 - 2.5 * 86_400),
            end: Date(timeIntervalSinceReferenceDate: 1_000_000)
        )
        #expect(Set(WallComposition.covers(all, in: .period(lastTwoDays)).map(\.id)) == ["book-1", "film-1"])

        #expect(WallComposition.covers(all, in: .hero("game-1")).map(\.id) == ["game-1"])
        // A hero whose cover isn't on the wall shows everything, not nothing.
        #expect(WallComposition.covers(all, in: .hero("missing")) == all)
    }

    @Test("기간 맥락은 마지막 활동이 아니라 그 기간에 기록된 적이 있는 표지를 고른다")
    func periodContextMatchesAnyActivityInRange() {
        let old = Date(timeIntervalSinceReferenceDate: 500_000)
        let recent = Date(timeIntervalSinceReferenceDate: 1_000_000)
        var reread = Self.cover("book-reread", .reading)
        reread.activities = [old, recent]
        let around = DateInterval(start: old.addingTimeInterval(-3_600), end: old.addingTimeInterval(3_600))
        #expect(WallComposition.covers([reread], in: .period(around)).map(\.id) == ["book-reread"])
    }

    @Test("타임라인 기간은 화면에 보이는 첫날 시작부터 마지막 날 끝까지다")
    @MainActor
    func timelinePeriodSpansWholeVisibleDays() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let first = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 2, hour: 15)))
        let last = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 5, hour: 9)))
        let period = try #require(TimelineFeed.period(covering: [last, first], calendar: calendar))
        #expect(period.start == calendar.date(from: DateComponents(year: 2026, month: 11, day: 2)))
        #expect(period.end == calendar.date(from: DateComponents(year: 2026, month: 11, day: 6)))
        #expect(TimelineFeed.period(covering: [], calendar: calendar) == nil)
    }

    // MARK: Rows

    @Test("배치 A의 행은 독서 → 영화 → 게임 → 시리즈 → 공부 순서로 돈다")
    func rowsFollowTheCategoryOrder() {
        let rows = WallComposition.rows(from: Self.mixed, count: 10)
        #expect(rows.count == 10)
        let accents = rows.map { Set($0.map(\.accent)) }
        let expected: [PrismAccent] = [.reading, .movie, .game, .series, .study]
        for (index, accentSet) in accents.enumerated() {
            #expect(accentSet == [expected[index % 5]])
        }
    }

    @Test("빠진 카테고리는 건너뛰고, 카테고리 하나뿐이면 모든 행을 그 카테고리로 채운다")
    func rowsSkipMissingCategories() {
        let noGames = Self.mixed.filter { $0.accent != .game }
        let accents = WallComposition.rows(from: noGames, count: 4).map { $0[0].accent }
        #expect(accents == [.reading, .movie, .series, .study])

        let books = Self.mixed.filter { $0.accent == .reading }
        let rows = WallComposition.rows(from: books, count: 3)
        #expect(rows.allSatisfy { Set($0.map(\.id)) == ["book-1", "book-2"] })
    }

    @Test func rowsAreStableAcrossCalls() {
        #expect(WallComposition.rows(from: Self.mixed, count: 10) == WallComposition.rows(from: Self.mixed, count: 10))
    }

    @Test func emptyCoversMakeNoRows() {
        #expect(WallComposition.rows(from: [], count: 10).isEmpty)
    }

    // MARK: Looping

    @Test(arguments: [0.0, 10, 72.5, 1_000.25, -10, -72.5])
    func stripsLoopWithoutGaps(distance: Double) {
        let pitch = 98.0
        let strip = WallStrip(distance: distance, pitch: pitch)
        #expect(strip.remainder >= 0 && strip.remainder < pitch)
        #expect(abs(Double(strip.shift) * pitch + strip.remainder - distance) < 1e-9)
    }

    @Test func aStripAdvancesOneItemPerPitch() {
        let before = WallStrip(distance: 10, pitch: 100)
        let after = WallStrip(distance: 110, pitch: 100)
        #expect(after.index(forSlot: 0, itemCount: 5) == before.index(forSlot: 1, itemCount: 5))
        // Moving backwards wraps to the end of the row, never negative.
        #expect(WallStrip(distance: -10, pitch: 100).index(forSlot: 0, itemCount: 5) == 4)
    }

    @Test(arguments: 2...12)
    func mosaicNeighboursAreNeverTheSameCover(count: Int) {
        for column in -3...6 {
            for row in -3...6 {
                let here = WallMosaicIndex.index(column: column, row: row, count: count)
                #expect(here != WallMosaicIndex.index(column: column + 1, row: row, count: count))
                #expect(here != WallMosaicIndex.index(column: column, row: row + 1, count: count))
                #expect((0..<count).contains(here))
            }
        }
    }

    // MARK: Palette and spectrum light

    @Test("표지 대표색은 넓은 회색보다 작아도 선명한 색을 고르고, 색상끼리 떨어져 있다")
    func paletteFavoursVividColoursOverLargeGreys() {
        let grey = (r: 0.5, g: 0.5, b: 0.52)
        let red = (r: 0.85, g: 0.15, b: 0.12)
        let blue = (r: 0.1, g: 0.3, b: 0.9)
        let pixels = Array(repeating: grey, count: 400) + Array(repeating: red, count: 40) + Array(repeating: blue, count: 25)
        let swatches = CoverPalette.swatches(fromPixels: pixels, count: 3)
        #expect(swatches.count == 2, "회색은 대표색이 되지 않아야 함")
        #expect(swatches[0].hue < 0.05 || swatches[0].hue > 0.95, "가장 큰 선명한 색(빨강)이 먼저")
        #expect(abs(swatches[1].hue - 0.62) < 0.05)
    }

    @Test func aGreyscaleCoverHasNoSwatches() {
        let pixels = (0..<100).map { index in (r: Double(index) / 100, g: Double(index) / 100, b: Double(index) / 100) }
        #expect(CoverPalette.swatches(fromPixels: pixels).isEmpty)
    }

    @Test("라이브러리 스펙트럼은 프리즘 순서로, 카테고리 몫만큼 열을 차지한다")
    @MainActor
    func spectrumColumnsFollowPrismOrderAndShare() {
        var covers = (0..<6).map { Self.cover("book-\($0)", .reading) }
        covers += (0..<2).map { Self.cover("film-\($0)", .movie) }
        let columns = SpectrumMeshLight.spectrumColumns(for: covers)
        #expect(columns.count == SpectrumMeshLight.size)
        // 영화 25%, 독서 75%: first column garnet, the other three jade.
        #expect(columns[0] == PrismAccent.movie.swatch)
        #expect(columns[1...].allSatisfy { $0 == PrismAccent.reading.swatch })
        #expect(SpectrumMeshLight.spectrumColumns(for: []).isEmpty)
    }

    @Test("기록 화면의 빛은 표지 색에서 오고, 표지에 색이 없으면 카테고리 색이 남는다")
    @MainActor
    func recordColumnsComeFromTheCover() {
        let cover = Self.cover("book-1", .reading)
        let swatch = CoverPalette.Swatch(hue: 0.6, saturation: 0.7, brightness: 0.8)
        #expect(SpectrumMeshLight.paletteColumns(covers: [cover], palettes: [cover.id: [swatch]]) == [swatch, PrismAccent.reading.swatch])
        #expect(SpectrumMeshLight.paletteColumns(covers: [cover], palettes: [:]) == [PrismAccent.reading.swatch])
    }

    @Test("메시의 가장자리 점은 화면 밖으로 나가지 않는다")
    @MainActor
    func meshEdgesStayPinned() {
        for elapsed in stride(from: 0.0, through: 120, by: 7.5) {
            let points = SpectrumMeshLight.points(elapsed: elapsed, parallax: 0)
            let size = SpectrumMeshLight.size
            for column in 0..<size {
                #expect(points[column].y == 0)
                #expect(points[(size - 1) * size + column].y == 1)
            }
            for row in 0..<size {
                #expect(points[row * size].x == 0)
                #expect(points[row * size + size - 1].x == 1)
            }
        }
    }

    // MARK: Clock

    @Test("일시 정지했다가 다시 흐르면 멈춘 위치에서 이어진다")
    func theClockResumesWhereItPaused() {
        let start = Date(timeIntervalSinceReferenceDate: 0)
        var clock = WallClock()
        clock.start(at: start)
        clock.pause(at: start.addingTimeInterval(10))
        #expect(clock.elapsed(at: start.addingTimeInterval(500)) == 10)

        clock.start(at: start.addingTimeInterval(500))
        #expect(clock.elapsed(at: start.addingTimeInterval(503)) == 13)
    }

    @Test @MainActor func anyPauseReasonStopsTheWall() {
        let model = LibraryWallModel(cache: CoverThumbnailCache(directory: FileManager.default.temporaryDirectory))
        #expect(!model.isPaused)

        model.setPaused(true, for: .lowPowerMode)
        model.setPaused(true, for: .reduceMotion)
        model.setPaused(false, for: .lowPowerMode)
        #expect(model.isPaused, "동작 줄이기가 남아 있으면 계속 멈춰 있어야 함")

        model.setPaused(false, for: .reduceMotion)
        #expect(!model.isPaused)

        model.context = .still
        #expect(model.pauseReasons == [.stillContext])
        model.context = .all
        #expect(!model.isPaused)
    }
}

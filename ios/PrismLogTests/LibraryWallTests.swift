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
        // Every category treated as full, to pin the order itself.
        let rows = WallComposition.rows(from: Self.mixed, count: 10, minimumLength: 1)
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
        let accents = WallComposition.rows(from: noGames, count: 4, minimumLength: 1).map { $0[0].accent }
        #expect(accents == [.reading, .movie, .series, .study])

        let books = Self.mixed.filter { $0.accent == .reading }
        let rows = WallComposition.rows(from: books, count: 3, minimumLength: 1)
        #expect(rows.allSatisfy { Set($0.map(\.id)) == ["book-1", "book-2"] })
    }

    @Test("표지가 적은 맥락은 맥락 밖 표지로 채우고, 채운 표지에 표시를 남긴다")
    func sparseContextsAreFilledFromOutside() {
        let few = Array(Self.mixed.prefix(3))
        let filled = WallComposition.filled(few, from: Self.mixed, context: .category(.reading))
        #expect(filled.prefix(3).map(\.id) == few.map(\.id))
        #expect(filled.prefix(3).allSatisfy { !$0.isFiller })
        #expect(filled.dropFirst(3).allSatisfy { $0.isFiller })
        #expect(filled.count == min(WallComposition.fullRowLength, Self.mixed.count))
        #expect(Set(filled.map(\.id)).count == filled.count)
        // The whole library, and an empty context, are left as they are.
        #expect(WallComposition.filled(few, from: Self.mixed, context: .all) == few)
        #expect(WallComposition.filled([], from: Self.mixed, context: .category(.game)).isEmpty)
    }

    @Test("기록이 없으면 외부 표지가 벽이 되고, 기록이 있으면 어둡게 섞인다")
    func discoveryFillsOrScattersDark() {
        let discovery = (0..<30).map { Self.cover("featured:\($0)", $0.isMultiple(of: 2) ? .movie : .series) }

        let empty = WallComposition.mixingIn(discovery, with: [], ownedCount: 0, context: .all)
        #expect(empty.count == discovery.count)
        #expect(empty.allSatisfy { !$0.isFiller })

        let few = Array(Self.mixed.prefix(3))
        let topped = WallComposition.mixingIn(discovery, with: few, ownedCount: 3, context: .all)
        #expect(topped.count == WallComposition.fullRowLength * 2)
        #expect(topped.prefix(3).allSatisfy { !$0.isFiller })
        #expect(topped.dropFirst(3).allSatisfy { $0.isFiller })

        let many = (0..<40).map { Self.cover("own-\($0)", .reading) }
        let scattered = WallComposition.mixingIn(discovery, with: many, ownedCount: 40, context: .all)
        #expect(scattered.count == 40 + 6)

        // A shelf takes only its own category's; a record's hero takes none.
        let shelf = WallComposition.mixingIn(discovery, with: few, ownedCount: 3, context: .category(.movie))
        #expect(shelf.dropFirst(3).allSatisfy { $0.accent == .movie })
        #expect(WallComposition.mixingIn(discovery, with: few, ownedCount: 3, context: .hero("x")) == few)
    }

    @Test("섞인 행은 빈칸 없이 표지를 번갈아 놓아, 같은 표지가 나란히 서지 않는다")
    func mixedRowsNeverPutACoverBesideItself() {
        let few = Array(Self.mixed.prefix(3))
        for row in WallComposition.rows(from: few, count: 10) {
            #expect(row.count == few.count)
            for index in row.indices where row.count > 1 {
                #expect(row[index].id != row[(index + 1) % row.count].id)
            }
        }
    }

    @Test("한 화면을 채우는 카테고리는 제 행을 갖고, 작은 카테고리는 한 행에 모인다")
    func fullCategoriesKeepTheirRows() {
        let books = (0..<9).map { Self.cover("b\($0)", .reading, daysAgo: Double($0)) }
        let film = Self.cover("film", .movie, daysAgo: 1)
        let game = Self.cover("game", .game, daysAgo: 2)
        let rows = WallComposition.rows(from: books + [film, game], count: 4)
        #expect(Set(rows[0].map(\.accent)) == [.reading])
        #expect(Set(rows[1].map(\.id)) == ["film", "game"])
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

    // MARK: Big cover hand-over

    @Test func focusShrinksRacesThenGrows() {
        let start = Date(timeIntervalSinceReferenceDate: 1_000)
        var focus = WallFocus()
        focus.retarget(to: .init(id: "a", row: 2, position: 7), at: start)
        // Nothing is showing yet, so the row races at once, then the cover grows.
        #expect(focus.glideStart == start)
        #expect(focus.incomingGrowth(at: start.addingTimeInterval(WallFocus.glide * 0.9)) == 0)
        #expect(focus.dim(at: start.addingTimeInterval(WallFocus.glide * 0.9)) == 0)
        let shown = start.addingTimeInterval(WallFocus.glide + WallFocus.grow + 0.01)
        #expect(focus.incomingGrowth(at: shown) == 1)
        #expect(abs(focus.dim(at: shown) - 1) < 1e-9)
        #expect(!focus.isMoving(at: shown))

        // Handing over: the first slides away at full size while the row
        // races at once, and the next rises sooner.
        focus.retarget(to: .init(id: "b", row: 2, position: 12), at: shown, direction: -1)
        #expect(focus.outgoing?.id == "a")
        #expect(focus.exiting)
        #expect(focus.glideStart == shown)
        #expect(focus.outgoingGrowth(at: shown.addingTimeInterval(WallFocus.exit * 0.9)) == 1)
        #expect(focus.outgoingExit(at: shown.addingTimeInterval(WallFocus.exit)) == 1)
        #expect(focus.outgoingGrowth(at: shown.addingTimeInterval(WallFocus.exit + 0.01)) == 0)
        let next = shown.addingTimeInterval(WallFocus.swapGlide + WallFocus.swapGrow + 0.01)
        #expect(focus.incomingGrowth(at: next) == 1)
        #expect(abs(focus.dim(at: next) - 1) < 1e-9)
        #expect(!focus.isMoving(at: next.addingTimeInterval(0.2)))
    }

    @Test func focusTurnsBackFromWhereItIs() {
        let start = Date(timeIntervalSinceReferenceDate: 1_000)
        var focus = WallFocus()
        focus.retarget(to: .init(id: "a", row: nil), at: start)
        let midway = focus.growStart.addingTimeInterval(WallFocus.grow / 2)
        let reached = focus.incomingGrowth(at: midway)
        focus.retarget(to: nil, at: midway)
        // Clearing the stage sinks the cover back rather than sliding it off.
        #expect(!focus.exiting)
        #expect(abs(focus.outgoingGrowth(at: midway) - reached) < 1e-9)
        #expect(focus.outgoingGrowth(at: midway.addingTimeInterval(WallFocus.shrink)) == 0)
        #expect(focus.target == nil)
    }

    @Test @MainActor func aRowCanBringAnyPositionDeadCentre() {
        let geometry = WallRowGeometry(rows: [], metrics: .compact, size: CGSize(width: 402, height: 874), parallax: 0)
        for direction in [1.0, -1.0] {
            let landing = geometry.positionToCentre(from: 123.4, direction: direction, minimum: 480)
            #expect(abs(geometry.centreX(ofPosition: landing.position, distance: landing.distance) - 201) < 1e-6)
            #expect((landing.distance - 123.4) * direction >= 480)
        }
    }

    @Test @MainActor func onlyTheActiveFlagPutsACoverOnStage() {
        let model = LibraryWallModel()
        model.feature = ["a", "b"]
        #expect(model.focus.target == nil)
        model.featureActive = true
        #expect(model.focus.target == "a")
        #expect(model.pauseReasons.contains(.focused))
        model.featureIndex = 1
        #expect(model.focus.target == "b")
        model.featureActive = false
        #expect(model.focus.target == nil)
    }

    @Test @MainActor func revealingTheWallSlowsItWithoutAJump() {
        let model = LibraryWallModel()
        let before = model.elapsed(at: .now)
        model.revealed = true
        #expect(model.pauseReasons.isEmpty)
        // No jump at the switch, and a third of the pace after it.
        #expect(abs(model.elapsed(at: .now) - before) < 0.05)
        let later = Date.now.addingTimeInterval(10)
        let pace = model.elapsed(at: later.addingTimeInterval(3)) - model.elapsed(at: later)
        #expect(abs(pace - 1) < 1e-6)
    }

    @Test func aReleasedRowCoastsToAStop() {
        let start = Date(timeIntervalSinceReferenceDate: 1_000)
        var nudge = RowNudge()
        nudge.move(to: 40)
        nudge.release(velocity: 1_000, at: start)
        #expect(nudge.offset(at: start) == 40)
        let far = nudge.offset(at: start.addingTimeInterval(5))
        #expect(abs(far - (40 + 1_000 * RowNudge.decay)) < 1)
        #expect(abs(nudge.offset(at: start.addingTimeInterval(6)) - far) < 0.5)
    }

    @Test @MainActor func draggingARowFollowsTheFingerAndKeepsItsPlace() {
        let model = LibraryWallModel()
        let now = Date.now
        model.dragRow(2, by: 30, at: now)
        #expect(model.nudge(row: 2, at: now) == -30)
        model.releaseRow(2, velocity: 0, at: now)
        model.dragRow(2, by: -10, at: now)
        #expect(model.nudge(row: 2, at: now) == -20)
        #expect(model.nudge(row: 3, at: now) == 0)
    }

    @Test("타임라인은 전체 벽을 같은 자리에 두고, 보이는 기간의 표지만 밝힌다")
    func timelineLightsItsPeriodOnTheWholeWall() {
        let lastTwoDays = DateInterval(
            start: Date(timeIntervalSinceReferenceDate: 1_000_000 - 2.5 * 86_400),
            end: Date(timeIntervalSinceReferenceDate: 1_000_000)
        )
        let lit = WallComposition.highlighting(Self.mixed, in: lastTwoDays)
        #expect(lit.map(\.id) == Self.mixed.map(\.id))
        #expect(Set(lit.filter { !$0.isFiller }.map(\.id)) == ["book-1", "film-1"])
        // Same covers in the same order: the rows come out in the same places.
        let rows = WallComposition.rows(from: lit, count: 6, minimumLength: 1).map { $0.map(\.id) }
        let allRows = WallComposition.rows(from: Self.mixed, count: 6, minimumLength: 1).map { $0.map(\.id) }
        #expect(rows == allRows)
        #expect(WallComposition.layoutContext(.period(lastTwoDays)) == .all)
        #expect(WallComposition.layoutContext(.category(.movie)) == .category(.movie))
    }

    @Test func relightingEasesEachCoverFromItsOldBrightness() {
        let start = Date(timeIntervalSinceReferenceDate: 1_000)
        var dimming = Self.cover("a", .reading)
        dimming.isFiller = true
        let brightening = Self.cover("b", .reading)
        let relight = WallRelight(darkBefore: ["b"], start: start)
        #expect(relight.darkness(of: dimming, at: start) == 0)
        #expect(relight.darkness(of: brightening, at: start) == 1)
        let middle = start.addingTimeInterval(WallRelight.duration / 2)
        #expect(abs(relight.darkness(of: dimming, at: middle) - 0.5) < 1e-9)
        #expect(relight.darkness(of: dimming, at: relight.end) == 1)
        #expect(relight.darkness(of: brightening, at: relight.end) == 0)
        #expect(!relight.isMoving(at: relight.end))
    }

    @Test @MainActor func timelinePeriodsRelightInsteadOfChangingTrains() {
        let model = LibraryWallModel()
        let week = DateInterval(start: .now.addingTimeInterval(-7 * 86_400), duration: 7 * 86_400)
        model.context = .period(week)
        #expect(model.relight != nil)
        #expect(model.shift == nil)
        model.context = .period(DateInterval(start: week.start.addingTimeInterval(-7 * 86_400), duration: 7 * 86_400))
        #expect(model.relight != nil)
        #expect(model.shift == nil)
    }
}

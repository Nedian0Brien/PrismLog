import XCTest

/// Interaction coverage for the app shell.
///
/// These exist partly as regression tests and partly because the shell's most
/// fragile parts are hit-testing ones: a full-bleed overlay above the `TabView`
/// silently swallows every touch in the app, and that failure is invisible in a
/// screenshot.
final class AppShellUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testAllFourTabsAreReachable() {
        let tabBar = app.tabBars.firstMatch
        XCTAssertTrue(tabBar.waitForExistence(timeout: 10), "탭바가 나타나지 않음")

        for (tab, title) in [
            ("기록", "기록 허브"),
            ("타임라인", "타임라인"),
            ("설정", "설정"),
            ("홈", "기록 대시보드"),
        ] {
            tabBar.buttons[tab].tap()
            XCTAssertTrue(
                app.staticTexts[title].waitForExistence(timeout: 5),
                "\(tab) 탭으로 이동 후 '\(title)' 제목이 보이지 않음"
            )
        }
    }

    /// The composer must both open and stay out of the way — if it blocks the
    /// tab bar, the whole app is unusable even though it looks fine.
    func testComposerExpandsIntoCategoryChipsAndReleasesTouches() {
        let toggle = app.buttons["composer.toggle"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10), "컴포저 버튼이 없음")

        toggle.tap()

        for accent in ["reading", "study", "movie", "series", "game"] {
            XCTAssertTrue(
                app.buttons["composer.chip.\(accent)"].waitForExistence(timeout: 3),
                "\(accent) 카테고리 칩이 펼쳐지지 않음"
            )
        }

        // Tapping the scrim behind the chips closes the composer.
        app.otherElements["composer.scrim"].tap()
        XCTAssertFalse(
            app.buttons["composer.chip.reading"].waitForExistence(timeout: 2),
            "스크림을 탭해도 컴포저가 접히지 않음"
        )

        // The tab bar must still be reachable with the composer on screen.
        app.tabBars.firstMatch.buttons["타임라인"].tap()
        XCTAssertTrue(
            app.staticTexts["타임라인"].waitForExistence(timeout: 5),
            "컴포저가 탭바 터치를 가로챔"
        )
    }

    /// The shelf is the app's densest screen; a book must open from it.
    func testReadingShelfOpensADetailScreen() {
        app.tabBars.firstMatch.buttons["기록"].tap()
        XCTAssertTrue(app.staticTexts["기록 허브"].waitForExistence(timeout: 5))

        let readingArea = app.buttons["records.area.reading"]
        XCTAssertTrue(readingArea.waitForExistence(timeout: 8), "독서 영역 카드가 없음")
        readingArea.tap()

        let firstBook = app.buttons["records.item"].firstMatch

        guard firstBook.waitForExistence(timeout: 8) else {
            // No reading records synced (offline, or an empty account) — the
            // empty state is the correct screen, not a failure.
            XCTAssertTrue(app.staticTexts["독서 기록이 없습니다"].exists, "책도 없고 빈 상태도 없음")
            return
        }

        firstBook.tap()

        XCTAssertTrue(
            app.buttons["기록"].waitForExistence(timeout: 5),
            "상세 화면에서 뒤로 가기 버튼이 없음 — 내비게이션이 푸시되지 않음"
        )
        XCTAssertTrue(app.staticTexts["정보"].waitForExistence(timeout: 5), "상세 화면 본문이 없음")
    }

    /// Every shelf must be reachable from the hub, and the back pill must
    /// return — the hub↔shelf move is state, not a navigation pop, so a broken
    /// back button strands the user on one shelf.
    func testEveryShelfOpensFromTheHubAndReturns() {
        app.tabBars.firstMatch.buttons["기록"].tap()
        XCTAssertTrue(app.staticTexts["기록 허브"].waitForExistence(timeout: 8))

        for (section, label) in [
            ("reading", "독서"),
            ("study", "공부"),
            ("movie", "영화"),
            ("series", "시리즈"),
            ("game", "게임"),
        ] {
            let card = app.buttons["records.area.\(section)"]
            XCTAssertTrue(card.waitForExistence(timeout: 5), "\(section) 영역 카드가 없음")
            card.tap()

            XCTAssertTrue(
                app.staticTexts["\(label) 기록"].waitForExistence(timeout: 5),
                "\(label) 목록이 열리지 않음"
            )

            let back = app.buttons["screen.back"]
            XCTAssertTrue(back.waitForExistence(timeout: 5), "\(label)에서 허브로 돌아가는 버튼이 없음")
            back.tap()
            XCTAssertTrue(app.staticTexts["기록 허브"].waitForExistence(timeout: 5), "허브로 복귀하지 못함")
        }
    }

    /// The hub's column switcher rebuilds every card; a crash here would be
    /// invisible until a user taps it.
    func testHubColumnToggleSurvivesBothLayouts() {
        app.tabBars.firstMatch.buttons["기록"].tap()

        let twoUp = app.buttons["records.columns.2"]
        XCTAssertTrue(twoUp.waitForExistence(timeout: 8), "2열 버튼이 없음")
        twoUp.tap()
        XCTAssertTrue(app.buttons["records.area.reading"].waitForExistence(timeout: 5), "2열에서 카드가 사라짐")

        app.buttons["records.columns.1"].tap()
        XCTAssertTrue(app.buttons["records.area.reading"].waitForExistence(timeout: 5), "1열에서 카드가 사라짐")
    }

    /// The timeline rebuilds every entry when the mode flips, and the feed is
    /// the app's deepest view hierarchy — a crash here is easy to miss because
    /// the tab still opens.
    func testTimelineSwitchesBetweenFeedAndCalendar() {
        app.tabBars.firstMatch.buttons["타임라인"].tap()
        XCTAssertTrue(app.staticTexts["타임라인"].waitForExistence(timeout: 8))

        let firstEntry = app.buttons["timeline.item"].firstMatch
        guard firstEntry.waitForExistence(timeout: 8) else {
            XCTAssertTrue(app.staticTexts["기록이 없습니다"].exists, "항목도 없고 빈 상태도 없음")
            return
        }

        app.buttons["timeline.mode.calendar"].tap()
        XCTAssertTrue(
            app.staticTexts["기록일 강조"].firstMatch.waitForExistence(timeout: 5),
            "캘린더로 전환되지 않음"
        )
        XCTAssertFalse(app.buttons["timeline.item"].firstMatch.exists, "캘린더인데 피드 항목이 남아 있음")

        app.buttons["timeline.mode.feed"].tap()
        XCTAssertTrue(
            app.buttons["timeline.item"].firstMatch.waitForExistence(timeout: 5),
            "피드로 돌아오지 못함"
        )
    }

    /// End-to-end through the live backend: the 네이버/카카오 keys live server
    /// side, so this is the only way to know search actually works.
    func testComposerOpensBookSearchAndReturnsResults() {
        app.buttons["composer.toggle"].tap()

        let readingChip = app.buttons["composer.chip.reading"]
        XCTAssertTrue(readingChip.waitForExistence(timeout: 5))
        readingChip.tap()

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5), "책 검색 시트가 열리지 않음")

        searchField.tap()
        searchField.typeText("한강")

        let firstResult = app.buttons["booksearch.result"].firstMatch
        guard firstResult.waitForExistence(timeout: 15) else {
            // Offline or the provider is down — the sheet must still say so
            // rather than spin forever.
            XCTAssertTrue(
                app.staticTexts["결과가 없습니다"].exists || app.staticTexts["검색에 실패했습니다"].exists,
                "결과도 없고 실패 안내도 없음"
            )
            return
        }

        firstResult.tap()
        XCTAssertTrue(
            app.buttons["다른 책 고르기"].waitForExistence(timeout: 5),
            "책을 골라도 입력 폼으로 넘어가지 않음"
        )
        XCTAssertTrue(app.buttons["booksearch.save"].exists, "기록 시작 버튼이 없음")
    }

    /// Settings is the one tab that hides the composer.
    func testComposerIsHiddenOnSettings() {
        app.tabBars.firstMatch.buttons["설정"].tap()
        XCTAssertTrue(app.staticTexts["설정"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["composer.toggle"].exists, "설정 탭에서 컴포저가 보임")
    }
}

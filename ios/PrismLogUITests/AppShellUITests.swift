import XCTest

/// Interaction coverage for the app shell.
///
/// These exist partly as regression tests and partly because the shell's most
/// fragile parts are hit-testing ones: a full-bleed overlay above the `TabView`
/// silently swallows every touch in the app, and that failure is invisible in a
/// screenshot.
///
/// Tabs are found by their button title, not through `app.tabBars`: on
/// iPhone Duo's outer screen the tab bar becomes a vertical bar that isn't a
/// `TabBar` element (issue #18), and on a regular-width screen it can be a
/// sidebar.
@MainActor
final class AppShellUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Every test starts from the library tab. Without this, scene
        // restoration reopens whatever tab and record the last test left.
        app.launchArguments += ["-ApplePersistenceIgnoreState", "YES"]
        app.launch()
    }

    /// The tab's button wherever the system put it — tab bar, vertical bar,
    /// or sidebar.
    private func tabButton(_ title: String) -> XCUIElement {
        let inTabBar = app.tabBars.buttons[title]
        return inTabBar.exists ? inTabBar : app.buttons[title].firstMatch
    }

    private func openTab(_ title: String, file: StaticString = #filePath, line: UInt = #line) {
        let button = tabButton(title)
        XCTAssertTrue(button.waitForExistence(timeout: 10), "'\(title)' 탭 버튼이 없음", file: file, line: line)
        button.tap()
    }

    /// Opens the toolbar's `+` menu and picks a composer.
    private func compose(_ accent: String, label: String) {
        let menu = app.buttons["composer.menu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 10), "작성 메뉴 버튼이 없음")
        menu.tap()
        let byID = app.buttons["composer.\(accent)"]
        let item = byID.waitForExistence(timeout: 3) ? byID : app.buttons[label].firstMatch
        XCTAssertTrue(item.waitForExistence(timeout: 3), "\(label) 작성 항목이 없음")
        item.tap()
    }

    func testAllFourTabsAreReachable() {
        for (tab, title) in [
            ("기록", "기록 허브"),
            ("타임라인", "타임라인"),
            ("설정", "설정"),
            ("라이브러리", "라이브러리"),
        ] {
            openTab(tab)
            XCTAssertTrue(
                app.staticTexts[title].waitForExistence(timeout: 5),
                "\(tab) 탭으로 이동 후 '\(title)' 제목이 보이지 않음"
            )
        }
    }

    /// The toolbar `+` menu offers all five composers, and closing it hands
    /// touches back to the tabs.
    func testComposerMenuListsEveryCategoryAndReleasesTouches() {
        let menu = app.buttons["composer.menu"]
        XCTAssertTrue(menu.waitForExistence(timeout: 10), "작성 메뉴 버튼이 없음")
        menu.tap()

        for label in ["독서", "공부", "영화", "시리즈", "게임"] {
            XCTAssertTrue(app.buttons[label].firstMatch.waitForExistence(timeout: 3), "\(label) 작성 항목이 없음")
        }

        // Tapping outside the menu closes it — on the screen title, an
        // element rather than a screen coordinate: iPhone Duo's inner
        // display doesn't map normalized coordinates where the app is.
        app.staticTexts["screen.title"].firstMatch.tap()
        // Hittable, not existing: in a vertical bar the closed menu's items
        // can stay in the accessibility tree, off screen.
        let readingItem = app.buttons["composer.reading"]
        let closed = NSPredicate { _, _ in !readingItem.exists || !readingItem.isHittable }
        expectation(for: closed, evaluatedWith: nil)
        waitForExpectations(timeout: 3)

        openTab("타임라인")
        XCTAssertTrue(
            app.staticTexts["타임라인"].waitForExistence(timeout: 5),
            "메뉴를 닫은 뒤 탭 전환이 되지 않음"
        )
    }

    /// The shelf is the app's densest screen; a book must open from it.
    func testReadingShelfOpensADetailScreen() {
        openTab("기록")
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
        openTab("기록")
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
        openTab("기록")

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
        openTab("타임라인")
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
        compose("reading", label: "독서")

        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5), "책 검색 시트가 열리지 않음")

        searchField.tap()
        searchField.typeText("한강")

        let firstResult = app.buttons["coversearch.result"].firstMatch
        guard firstResult.waitForExistence(timeout: 15) else {
            // Offline or the provider is down — the sheet must still say so
            // rather than spin forever.
            XCTAssertTrue(
                app.descendants(matching: .any)["coversearch.failure"].exists
                    || app.staticTexts["coversearch.empty"].exists,
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

    /// Settings is the one tab without the composer.
    func testComposerIsHiddenOnSettings() {
        openTab("설정")
        XCTAssertTrue(app.staticTexts["설정"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["composer.menu"].exists, "설정 탭에서 작성 메뉴가 보임")
    }
}

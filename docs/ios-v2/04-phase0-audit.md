# PrismLog iOS v2 — Phase 0 점검 기록

- 작성: 2026-10-29 · 갱신: 2026-11-17 (§6)
- 관련 문서: [01-intent.md](./01-intent.md), [02-spec.md](./02-spec.md), [03-plan.md](./03-plan.md)

## 1. 환경

| 항목 | 필요 | 2026-10-29 확인 값 |
|---|---|---|
| Xcode | 27.1 이상 | `/Applications/Xcode-beta.app` 27.0 (27A5218g) 하나 |
| iOS 런타임 | 27.1 | iOS 27.0 (24A5380i) |
| iPhone Duo 기기 유형 | 있음 | 없음. 최신 기기 유형은 iPhone 17 계열과 iPhone Air |
| xcodegen | 있음 | `/opt/homebrew/bin/xcodegen` |

- Xcode 27.1이 없어서 배포 버전 27.1 조정(D4), 듀오 API 컴파일, 듀오 시뮬레이터 검증을 진행하지 못했다.
- `~/code/DuoCanvas`는 Excalidraw 기반 웹 화이트보드이고, `~/code/duo launcher`는 Android 런처다. 두 저장소 모두 iOS 듀오 API를 쓰지 않아서 v2에 가져올 코드가 없다.

## 2. 기준선 테스트 (Xcode 27.0, 배포 버전 26.0 유지)

기기: 전용 시뮬레이터 `PrismLog-v2-baseline` (iPhone 17 Pro, iOS 27.0 24A5380i). 호스트: macOS 27.2 (26B5101f).

| 단계 | 결과 |
|---|---|
| `xcodegen generate` | 성공. 생성된 프로젝트가 커밋된 것과 같다 (diff 없음) |
| `build` | **성공** (`** BUILD SUCCEEDED **`). SDK 27의 `@State` 매크로 변경으로 생기는 컴파일 오류는 없다 |
| 앱 단독 실행 (`simctl launch`) | **성공**. 동기화된 기록 39건(독서 9, 공부 16, 문화 14)이 대시보드에 표시된다 |
| `test` (PrismLogTests + PrismLogUITests) | **실행 못 함**. 테스트 0건 실행 |

테스트 실패 내용 (4회 반복, 같은 결과. 4회째는 Claude Code 셸 샌드박스 밖의 터미널에서 실행):
- PrismLogTests: `The test runner hung before establishing connection.`
- PrismLogUITests: `Early unexpected exit, operation never finished bootstrapping … Test crashed with signal term before establishing connection.`
- xcodebuild 로그: 시뮬레이터를 `unknown class`로 인식하고 `com.apple.instruments.deviceservice.*`에 연결하지 못한다. 오류는 `DTServiceHubClient failed to bless service hub for simulator`다.
- 같은 시각에 `testmanagerd`(27.0)와 `dtdeviceinfod`가 `XPC_EXIT_REASON_SIGTERM_TIMEOUT`으로 종료된 기록이 `~/Library/Logs/DiagnosticReports`에 있다.

판단: 앱은 정상으로 실행되고 테스트 러너만 앱에 연결하지 못한다. 그래서 원인은 v1 코드가 아니라 테스트 도구로 본다.
- 기대 기준선: v1 마지막 커밋 `88756f3`의 본문에 "단위 44개 · UI 8개 통과"가 적혀 있다.
- 2026-07의 메모리 기록에는 호스트가 macOS 27.0 베타였다. 지금 호스트는 macOS 27.2이고 Xcode는 27.0 베타 그대로다. 이 조합의 호환 문제일 가능성이 높다. 이 가설은 아직 확인하지 않았다.
- Xcode 27.1 설치 후 다시 측정한다. 그때도 같으면 원인을 따로 조사한다.

## 3. v1 코드의 듀오 문제 패턴

Xcode 27.0의 `xcrun agent skills export`에는 듀오 스킬이 없다. 대신 Apple 스킬 `uikit-app-modernization`(UIScreen·방향·safe area 점검 항목)과 "Preparing your app for iPhone Duo" 문서의 규칙으로 `ios/PrismLog`, `ios/PrismLogWidget`을 검색했다. Xcode 27.1의 듀오 스킬로 같은 점검을 다시 해야 한다.

| # | 패턴 | 위치 | 문제 | v2 처리 |
|---|---|---|---|---|
| P1 | 탭바 높이를 가정한 고정 여백 | `App/RootView.swift:55` `.padding(.bottom, 78)` | 바깥 화면에서 탭바가 세로 바로 바뀌면 FAB가 엉뚱한 자리에 남는다 | FAB를 없애고 툴바 `+`로 옮긴다 (spec §3) |
| P2 | 스크롤 끝 고정 여백 | `DesignSystem/PrismScreenScaffold.swift:68`, `Features/Records/RecordDetailScreen.swift:89` `.padding(.bottom, 130)` | 탭바 높이와 FAB를 가정한 값이다. 세로 바에서는 아래 탭바가 없어서 빈 공간이 생긴다 | 시스템 safe area와 `safeAreaPadding`/`contentMargins`에 맡긴다 (Phase 3) |
| P3 | 제목만 있는 시트 툴바 버튼 | 시트 툴바 18곳 (`CategoryEditSheets`, `CategoryDetailSections`, `StudyDetailSections`, `ReadingEditSheet`, `ReadingProgressSheet`, `StudyProgressSheet`, `NewStudySheet`, `NewCultureSheet`, `NewReadingSheet`) | 제목만 있는 항목은 세로 바에 표시되지 않는다. 바깥 화면 시트는 기본으로 세로 바를 쓴다 | `Button("취소", systemImage: "xmark")`처럼 아이콘을 붙인다 |
| P4 | 루트 배경이 탭 콘텐츠에 가려짐 | `App/RootView.swift:14`, `DesignSystem/PrismScreenScaffold.swift:6` 주석 | 화면마다 배경을 다시 그려서 탭을 바꿀 때 배경이 이어지지 않는다 | spec §4.6 우선안을 Phase 3에서 빌드로 확인한다 |
| P5 | 화면 전체를 덮는 FAB 스크림 | `App/RootView.swift:31-44` | 스크림 자체는 펼친 동안만 있어서 터치 문제는 없다. FAB가 없어지면 함께 없어진다 | 툴바 메뉴로 바꾸면서 제거한다 |
| P6 | `Button` 레이블 안의 `.glassEffect` | `Features/Records/RecordsHub.swift:127` | `.buttonStyle(.plain)`인 버튼 레이블에 글래스를 걸었다. spec §2.3 규칙(버튼에 직접 걸지 않는다)과 경계에 있다. v1에서는 동작했다 | v2 카드에서도 같은 방식을 쓸지 Phase 3에서 터치 테스트로 확인한다 |
| P7 | `_x = State(initialValue:)` 초기화 | 36곳, 9개 파일 (`CategoryEditSheets` 9, `ReadingEditSheet` 9, `CategoryDetailSections` 6 등) | SDK 27에서 `@State`가 매크로로 바뀌었다. 선언에 초깃값이 있는 곳은 없다. 다른 저장 프로퍼티보다 먼저 할당하면 컴파일 오류가 난다 | 기준선 빌드 결과로 판단한다 (§2) |

검색했지만 없었던 패턴:
- `UIScreen`, `UIDevice`, `interfaceOrientation`, `userInterfaceIdiom`, `UIApplication.shared`, `connectedScenes`, `keyWindow`: 0건
- 고정 크기 300pt 이상인 `frame`: 0건
- `GeometryReader` 5곳(`PrismFeedback`, `SpectrumBloomBackground`, `RecordDetailScreen` 진행 막대, `CoverImage`, `TimelineScreen` 진행 막대)은 모두 자기 뷰의 크기를 읽는 용도다. 화면 크기나 방향으로 레이아웃을 가르지 않는다.
- `ignoresSafeArea` 7곳은 모두 배경, 전체 화면 사진 뷰어, 저장 펄스다. 상호작용 요소에는 쓰지 않았다.

## 4. Apple 문서 확인

spec의 **[확인]** 항목을 Apple 문서로 확인하고 spec 본문에 반영했다. 출처는 spec §12에 있다.

| 항목 | 결과 | spec 위치 |
|---|---|---|
| Liquid Glass iOS 27 변경 | 변경 없음. `Glass` 멤버와 `glassEffect(_:in:)` 그대로 | §5 |
| TabView 콘텐츠 배경 투명화 | `.navigation` 배치는 iOS 18+. `.tabView` 배치는 문서상 watchOS만. 빌드 확인 필요 | §4.6 |
| `reservedRegions` | 시그니처, `ReservedRegion` 멤버, 좌표 기준 확인 | §7.2 |
| `ArrangementView` | 선언, 초기화, 스타일, 배치 제약 확인 | §6.6 |
| `onHingeChange` | 시그니처, `DeviceHinge.Status` 값 세 개 확인. 인자 순서는 예제로 추정 | §7.3 |
| 시트 세로 바 끄기 | `toolbarVerticalBehavior(.disabled)`. 작성 시트에는 쓰지 않기로 함 | §7.5 |
| `scrollEdgeEffectStyle` | 시그니처 확인. 값 목록은 빌드 확인 필요 | §5 |
| zoom 전환 | `zoom(sourceID:in:)` + `matchedTransitionSource` 확인. 벽 동기화는 실기기 확인 | §4.5 |

## 5. 남은 일

2026-11-17 갱신. 처리한 항목은 §6에 있다.

- **[빌드 확인]** 남은 2개: TabView 불투명 배경(Phase 3 첫 작업), 테이블탑 `ArrangementView` 분할(세션 모드 Phase).
- 추적 이슈: https://github.com/Nedian0Brien/PrismLog/issues/17

## 6. Xcode 27.2 재측정 (2026-11-17)

### 6.1 환경

| 항목 | 값 |
|---|---|
| Xcode | `/Applications/Xcode.app` 27.2 (27B52), iOS 27.2 SDK. `xcode-select`는 여전히 `/Applications/Xcode-beta.app`(27.0)을 가리킨다. 빌드·테스트 명령마다 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`를 붙였다 |
| 시뮬레이터 | 전용 `PrismLog-v2-duo` (iPhone Duo iPhone19,4, iOS 27.2 24B91016s), 비교용 `PrismLog-v2-iphone` (iPhone 17 Pro, iOS 27.2 24B8117) |
| 실기기 | iPhone Duo (iPhone19,4), `devicectl`로 연결 확인 |
| 배포 버전 | `project.yml` 26.0 → 27.1 (D4). `xcodegen generate` 후 `project.pbxproj` 변경은 배포 버전 2줄뿐이다 |

### 6.2 기준선

| 단계 | 결과 |
|---|---|
| 시뮬레이터 빌드 | 성공. 앱·위젯 경고 0건. P7(`@State` 매크로) 컴파일 오류 없음 |
| 실기기 빌드 (`-allowProvisioningUpdates`) | 성공. 경고 0건 |
| 실기기 설치·실행 (`devicectl device install app`, `process launch`) | 성공. 앱과 위젯 프로세스가 실행된다 |
| 단위 테스트 (듀오 시뮬레이터) | 44개 중 42개 통과, `LiveAPIRoundTripTests` 2개 건너뜀(라이브 API 전용, 기존과 같음). 실패 0 |
| UI 테스트 (iPhone 17 Pro) | 8개 모두 통과 |
| UI 테스트 (듀오, 접힌 화면) | 8개 중 1개 통과, 7개 실패 |
| UI 테스트 컴파일 경고 | 171건, 모두 `PrismLogUITests`. SDK 27에서 `XCUIElement` 멤버가 main actor로 격리돼 동기 비격리 테스트 메서드에서 부르면 경고가 난다 |

- 10월에 테스트 러너가 앱에 연결하지 못한 문제는 Xcode 27.2에서 재현되지 않았다. 원인은 Xcode 27.0 베타와 macOS 27.2의 조합으로 본다.
- 듀오 UI 실패 7건의 원인은 모두 같다. `app.tabBars.buttons[...]`가 `TabBar` 요소를 찾지 못한다. 접힌 화면에서 탭바가 오른쪽 세로 바로 바뀌어 접근성 트리에 `TabBar` 유형으로 나오지 않는다. 일반 iPhone에서는 같은 테스트가 통과하므로 테스트와 앱 셸이 가로 탭바를 전제한 것이 원인이다. 앱 셸을 바꾸는 Phase 3에서 테스트의 탭 찾기를 요소 유형에 묶지 않는 방식으로 고친다.

### 6.3 듀오 화면 확인

- 접힌 화면(시뮬레이터 기본 자세, 바깥 화면 1398×2034): 탭 4개가 오른쪽 세로 바에 있다. 대시보드 카드는 세로 바를 피해 줄어든다. FAB `+`는 `bottom 78` 고정 여백 때문에 추세선 차트 위, 세로 바 왼쪽에 겹쳐 뜬다. §3의 P1·P2가 예측한 증상과 같다.
- 펼친 화면과 반쯤 펼친 자세: 시뮬레이터 경첩을 조작해 확인했다. 처음에는 경첩 조작 권한을 받지 못했고, 실기기는 다른 앱을 사용 중이어서 실기기 화면은 확인하지 않았다.
  - 반쯤 펼침(130°)과 펼침의 화면이 같다. 안쪽 화면은 951×669pt 가로이고, iPhone 방향을 세로만 선언했는데도 앱이 가로 전체 화면으로 표시된다. 탭바는 펼친 화면에서도 오른쪽 세로 바로 남는다.
  - 본문 카드가 화면 폭 전체(약 880pt)로 늘어난다. 대시보드 통계 카드는 레이블과 값 사이가 크게 벌어지고, 기록 허브 선반은 표지 3장이 왼쪽에만 있어 가운데가 빈다. 카드가 가운데 접힘선을 가로지른다. regular width에서 본문 카드의 최대 폭을 두는 spec §5 `readableWidth = 640`의 근거다.
  - FAB가 기록 허브 영화 선반의 최근 제목을 가린다. 접힌 화면과 펼친 화면 모두 그렇다(P1).
  - 연속성: 펼친 상태에서 기록 탭을 고르고 접어도 기록 탭이 유지된다. 스크롤 위치와 작성 초안의 유지는 확인하지 않았다(spec §7.4, Phase 4).
  - 확인 후 경첩을 처음 자세(접힘, 0°)로 되돌렸다.

### 6.4 듀오 스킬 점검 (`app-resizability`, Xcode 27.2)

`sudo xcode-select -s /Applications/Xcode.app` 후 내보낸 Xcode 27.2 스킬 `app-resizability`("prepare for iPhone Duo")로 `ios/PrismLog`, `ios/PrismLogWidget`을 점검했다. 코드는 바꾸지 않았다. 처음 내보낸 27.0 스킬 7개에는 이 스킬이 없었다.

사전 점검 (`Support/Info.plist`, `project.yml`):

| 항목 | 결과 |
|---|---|
| 런치 화면 | `UILaunchScreen` 있음. 통과 |
| iPad 방향 | `UISupportedInterfaceOrientations~ipad` 네 방향 모두. 통과. iPhone은 세로만 선언하며 스킬 기준으로 정상이다 |
| 전체 화면 고정 | `UIRequiresFullScreen` 없음. 통과 |
| 장면 수명 주기 | SwiftUI `App` + `UIApplicationSceneManifest`(`UIApplicationSupportsMultipleScenes` true). 이전 대상 아님 |

작업별 결과:

| 스킬 작업 | 결과 |
|---|---|
| `UIScreen.main` | 0건 |
| `interfaceOrientation` | 0건 |
| `userInterfaceIdiom` | 0건 |
| 장면 수명 주기 | 이미 장면 기반 |
| Safe area (SwiftUI 규칙 13) | 2건. 아래 표 |

| # | 위치 | 스킬 규칙 | 판단 |
|---|---|---|---|
| S1 (=P1) | `App/RootView.swift:49-56` | 오버레이에 쌓은 컨트롤과 바를 피하려는 고정 여백(`.padding(.bottom, 78)`) | 결함. 고정 여백은 런타임에 생기는 세로 바를 따라가지 못한다. 스킬은 숫자를 지우고 `safeAreaBar(edge:)` 또는 `safeAreaInset(edge:)`로 공간을 예약하라고 한다. v2는 FAB를 툴바 `+`로 옮겨 없앤다(spec §3) |
| S2 (=P2) | `DesignSystem/PrismScreenScaffold.swift:68`, `Features/Records/RecordDetailScreen.swift:89` | 바를 대신하는 고정 여백(`.padding(.bottom, 130)`) | 결함. `safeAreaPadding`으로 바꾸는 것도 해결이 아니다. 숫자를 지우고 탭바는 시스템 inset에 맡긴다. FAB를 없애면 남는 여백도 없다(Phase 3) |

결함이 아닌 것으로 판단한 항목:
- `ignoresSafeArea()` 7곳 가운데 6곳은 배경, 스크림, 저장 펄스다. 스킬은 전체 화면에 닿아야 하는 층에는 그대로 두라고 한다.
- `Features/Records/PhotoStrip.swift:91`의 페이지 `TabView`는 사진을 띄우는 미디어 면이라 그대로 둔다. 닫기 버튼과 쪽 번호는 safe area를 따르는 바깥 `ZStack`의 오버레이에 있어서 세로 바 아래로 들어가지 않는다.
- `GeometryReader` 5곳은 모두 `proxy.size`만 읽는다. 스킬은 inset을 읽어 레이아웃을 정하는 것만 금지한다.
- `.padding(.horizontal, 18)` 15곳은 바를 대신하는 값이 아니라 디자인 여백이다. §6.3 스크린샷에서도 카드가 세로 바를 피해 줄어들었다.
- 위젯은 해당 패턴이 없다.

§3의 P3(제목만 있는 시트 툴바 버튼), P4(탭 콘텐츠에 가려지는 루트 배경), P6(버튼 레이블의 글래스)은 이 스킬의 점검 범위 밖이다. 듀오 문서 규칙에 따른 기존 판단을 유지한다.

### 6.5 SDK 선언으로 확정한 항목

iOS 27.2 SDK의 `SwiftUI.swiftinterface`와 `SwiftUICore.swiftinterface`로 확인하고 spec에 반영했다.

| 항목 | 결과 | spec 위치 |
|---|---|---|
| `ScrollEdgeEffectStyle` 값 | `.automatic`, `.hard`, `.soft` | §5 |
| `ContainerBackgroundPlacement.tabView` | iOS에서 `unavailable`. TabView가 불투명 배경을 칠하는지는 런타임에서 확인한다 | §4.6 |
| `onHingeChange` 클로저 인자 | `(oldContext, newContext)` 순서 | §7.3 |
| `ToolbarVerticalBehavior` 값 | `.automatic`, `.disabled` | §7.5 |

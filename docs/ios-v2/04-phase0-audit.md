# PrismLog iOS v2 — Phase 0 점검 기록

- 작성: 2026-10-29
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

테스트 실패 내용 (3회 반복, 같은 결과):
- PrismLogTests: `The test runner hung before establishing connection.`
- PrismLogUITests: `Early unexpected exit, operation never finished bootstrapping … Test crashed with signal term before establishing connection.`
- xcodebuild 로그: 시뮬레이터를 `unknown class`로 인식하고 `com.apple.instruments.deviceservice.*`에 연결하지 못한다.
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

- Xcode 27.1을 설치한 뒤: 배포 버전 27.1로 조정, `xcodegen generate`, iPhone Duo 시뮬레이터로 기준선 재측정.
- Xcode 27.1에서 듀오 스킬을 내보내 §3 점검을 다시 한다.
- **[빌드 확인]** 항목 3개: TabView 배경, `ScrollEdgeEffectStyle` 값 목록, 테이블탑 `ArrangementView` 분할.

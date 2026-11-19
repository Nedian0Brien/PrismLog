# PrismLog iOS v2 — Spec

- 작성: 2026-10-29
- 선행 문서: [01-intent.md](./01-intent.md) · 후속 문서: [03-plan.md](./03-plan.md)
- 표기: **[확인]**은 구현 전에 Apple 문서나 실기기로 검증해야 하는 항목이다. iOS 27/27.1 API는 모델 학습 이후에 나온 것이 많으므로 Apple 문서(Context7 MCP, developer.apple.com)로 시그니처를 확인하고 쓴다.
- 2026-10-29 Phase 0: 문서로 확인한 항목은 **[확인됨]**으로 바꾸고 출처를 붙였다. 문서만으로 정할 수 없는 항목은 **[빌드 확인]**(27.1 SDK로 컴파일·시뮬레이터 확인) 또는 **[실기기]**로 남겼다. 출처는 §12에 모았다.

---

## 1. 플랫폼과 프로젝트

| 항목 | 값 |
|---|---|
| Xcode | 27.1 이상 (iPhone Duo SDK·시뮬레이터 포함). 2026-10-29 기준 개발 Mac에는 27.0 베타(27A5218g)만 있다 |
| SDK | iOS 27.1 — edge-to-edge와 세로 바 동작의 전제 조건 |
| 최소 배포 버전 | iOS 27.1 (D4 기본값) |
| 언어 | Swift 6.0, strict concurrency 유지 |
| 프로젝트 생성 | `ios/project.yml` (XcodeGen). 파일을 추가하거나 옮긴 뒤 `xcodegen generate` |
| 타깃 | PrismLog, PrismLogWidget, PrismLogTests, PrismLogUITests (변경 없음) |
| 기기군 | `TARGETED_DEVICE_FAMILY: "1,2"` 유지 |

## 2. 코드 구조

### 2.1 유지 (로직 변경 최소)
- `Data/` 전체: `PrismStore`, `PrismStore+Culture`, `StudyGrouping`, `Models/*`, `Network/*`
- `Shared/`: `SpectrumSnapshot`, `WidgetRefresher`
- `PrismLogWidget/`
- `DesignSystem/` 중 `PrismPalette`, `PrismTypography`, `PrismMotion`, `PrismFeedback`, `ImageCompressor`, `FlowLayout`, `PrismWordmark` — 토큰과 유틸은 그대로 쓰고 필요한 값만 보탠다
- `Features/Timeline/TimelineBuilder.swift` (순수 로직, 테스트 있음)
- `Resources/` (폰트, 아이콘, 에셋)

### 2.2 새로 작성
```
ios/PrismLog/
  App/
    PrismLogApp.swift          (수정) 장면 구성, 상태 모델 주입
    AppShell.swift             (신규) TabView + 표지 벽 + 작성 진입점
    AppNavigationModel.swift   (신규) 탭·선택 기록·카테고리·작성 초안 — 접기/펼치기에도 유지되는 상태
    PrismTab.swift             (수정)
  Library/                     (신규 폴더) 표지 벽
    CoverThumbnailCache.swift  다운로드·다운샘플·디스크/메모리 캐시
    GeneratedCover.swift       표지 없는 기록(주로 공부)의 타이포그래피 표지
    LibraryWallModel.swift     표지 목록 구성, 맥락 모드, 흐름 시계
    LibraryWallView.swift      배치 A(가로 행) / B(모자이크) 렌더링
    WallLegibilityLayer.swift  디밍·채도 조절 층
  DesignSystem/
    PrismGlass.swift           (재작성) 글래스 v2 토큰과 수식어
    PrismScreenScaffold.swift  (재작성) 고정 여백 제거, 표지 벽 패럴랙스 연결
    SpectrumBloomBackground.swift (유지) 표지가 없을 때의 대체 배경
  Features/
    Library/   (신규) 홈 = 라이브러리
    Records/   (이전 + 재배치) 허브 → 카테고리 → 상세, regular width에서 분할 화면
    Timeline/  (이전 + 재배치)
    Compose/   (NewLog에서 이름 변경) 작성 진입점과 시트
    Settings/  (이전)
    Session/   (신규) 독서 세션 모드 — 테이블탑 자세 대응
```
기존 `Features/` 파일의 로직은 버리지 않는다. 차트(`SpectrumRing`, `TrendChart`, `DistributionBars`, `ActivityHeatmap`), 상세 섹션(`CategoryDetailSections`, `StudyDetailSections`), 편집·작성 시트는 새 폴더로 옮긴 뒤 레이아웃과 글래스 적용 방식만 고친다.

### 2.3 v1에서 얻은 교훈 (반드시 유지)
- `Button`에 `.glassEffect(…)`를 직접 걸면 터치가 먹힌다. 컨트롤은 `.buttonStyle(.glass)` / `.glassProminent` + `.tint` + `.buttonBorderShape`를 쓰고, `.glassEffect`는 상호작용 없는 면에만 쓴다.
- 글래스 형제를 컨테이너 없이 나열하지 않는다. 같은 영역의 글래스 면들은 `GlassEffectContainer`(현 `PrismGlassSection`)로 묶어 한 번에 렌더링한다.
- `TabView`의 탭 콘텐츠는 시스템 배경을 칠한다. 루트에 깐 배경은 그대로는 보이지 않는다(§4.6 참고).
- 화면 전체를 덮는 형제 뷰는 터치를 가로챈다. 떠 있는 요소는 `overlay`로 붙이고, 펼쳐진 동안에만 스크림을 둔다.
- Google Books 표지는 `http://`로 온다. `PrismMedia.url(for:)`의 https 승격을 거쳐야 ATS에 막히지 않는다.
- `ModelContext`는 컨테이너를 붙잡지 않는다. 컨테이너 수명은 `PrismStore`가 쥔다.

## 3. 정보 구조

탭 4개는 유지해서 웹과 v1 사용 습관을 이어 간다.

| 탭 | 제목 | 역할 | 표지 벽 맥락 |
|---|---|---|---|
| `library` | 라이브러리 | 앱의 얼굴. 지금 진행 중인 기록, 스펙트럼 요약, 통계, 최근 기록 | 전체, 최근 기록 순으로 섞음 |
| `records` | 기록 | 허브 → 카테고리 목록 → 기록 상세 | 선택한 카테고리 → 상세에서는 그 표지가 히어로 |
| `timeline` | 타임라인 | 세션 단위 피드 | 피드에 보이는 기간의 표지 |
| `settings` | 설정 | 동기화, 사용자, 표시 옵션(표지 벽 배치·흐름·밝기) | 전체, 정지 상태 |

- compact width: 하단(또는 듀오 바깥 화면에서는 세로) 탭바.
- regular width: `.tabViewStyle(.sidebarAdaptable)`로 사이드바 전환을 허용한다. 사이드바도 표지 벽 위에 뜬 글래스가 된다.

**작성 진입점**: v1의 떠 있는 FAB(고정 `bottom 78`)를 없앤다. 각 화면 툴바의 `+` 버튼 하나가 카테고리 5종 메뉴를 연다. 툴바 항목이라 듀오에서 세로 바로 옮겨 가는 동작과 접힘선 회피를 시스템이 맡는다. 메뉴는 시스템 툴바 `Menu`(`topBarPinnedTrailing`)로 만든다. 툴바 메뉴는 시스템이 글래스에서 메뉴로 모핑하므로 `glassEffectID`로 따로 만들지 않는다(Phase 3).

## 4. 표지 벽 (Library Wall)

### 4.1 표지 원천
- `PrismStore.records`에서 `coverURL`이 있는 기록: 독서(책 표지), 영화·시리즈(포스터), 게임(커버).
- 같은 엔티티(`entityID`)가 여러 기록에 나오면 한 번만 쓴다.
- 표지가 없는 기록(주로 공부)은 `GeneratedCover`로 만든다: 카테고리 톤 그라디언트 + 제목(Pretendard ExtraBold) + 카테고리 심벌. `ImageRenderer`로 래스터화해서 같은 캐시에 넣는다. 그래야 벽은 모든 표지를 이미지 하나로 다룬다.
  - 글자색은 흰색과 `PrismColor.background` 중 톤과의 WCAG 대비가 큰 쪽을 고른다. 다섯 톤 모두 어두운 글자가 이긴다(흰 글자는 공부 노랑에서 약 1.6:1).
  - 비율은 2:3이다. 디자인을 바꾸면 `CoverKey.generatedDesignVersion`을 올려 디스크에 남은 이전 표지를 다시 그리게 한다.
- 표지 수에 따른 처리:
  - 0장: `SpectrumBloomBackground`로 대체한다.
  - 1–11장: 반복 배치로 화면을 채운다. 같은 표지가 이웃하지 않도록 섞는다.
  - 12장 이상: 반복 없이 쓰고, 행이 화면 폭보다 짧으면 그 행만 반복한다.

### 4.2 썸네일 파이프라인 (`CoverThumbnailCache`, actor)
- 다운로드 → ImageIO `CGImageSourceCreateThumbnailAtIndex`로 표시 크기 × 화면 배율까지 다운샘플한다. 크기는 128·256·512·1024px 단계로 올림해서 같은 표지가 크기마다 따로 쌓이지 않게 한다.
- 디스크: `Caches/covers/<sha256(원천)>-<크기>.jpg`, JPEG(품질 0.85)로 저장한다. 디스크 쓰기는 전용 직렬 큐에서 하고, 표지는 메모리에 올라가면 디스크 저장을 기다리지 않고 바로 넘긴다.
  - HEIC를 쓰지 않는 이유: iOS 27.2 일반 시뮬레이터 런타임의 HEVC 코덱이 인코딩과 디코딩 모두에서 돌아오지 않는다. 표지 읽기 십여 개가 Swift 협력 스레드를 모두 붙잡아 앱의 비동기 작업이 전부 멈췄다(2026-11-18 iPhone 17 Pro 시뮬레이터, `sample`로 확인). JPEG는 341×512 표지 기준 장당 약 57KB로 HEIC(약 36KB)의 1.6배이고, 표지 200장이면 약 11MB다. 메모리: `NSCache`(비용 = 디코딩된 바이트, 한도 80MB). 뷰는 메모리 캐시를 동기로 읽어서 캐시에 있는 표지를 첫 프레임에 그린다.
- 벽에는 디코딩을 마친 이미지만 넘긴다. 벽 렌더링 중에는 `AsyncImage`를 쓰지 않는다.
- 동시 다운로드 4개. 실패한 URL은 세션 동안 다시 시도하지 않고 `GeneratedCover`로 대체한다.
- 기존 `CoverImage` 뷰도 이 캐시를 쓰도록 바꾼다(목록·상세 공용).
- 벽은 표지를 256px로 디코딩한다(`LibraryWallModel.imagePixelBucket`). 512px로는 200장에 약 134MB가 들어 §9의 80MB를 넘는다. 256px 200장은 33.4MB다(2026-11-18 측정).

### 4.3 배치 A — 가로 행 흐름 (D2 확정, 2026-11-18)
| 파라미터 | compact | regular |
|---|---|---|
| 표지 높이 | 132pt | 168pt |
| 비율 | 2:3 고정 (게임처럼 비율이 다른 표지는 aspect fill로 잘라 리듬을 맞춘다) | 같음 |
| 표지 간격 / 행 간격 | 10pt / 12pt | 12pt / 14pt |
| 모서리 | 8pt continuous | 10pt |
| 행 구성 | 맥락 모드 "전체"에서는 독서 → 영화 → 게임 → 시리즈 → 공부 순서로 반복하고, 카테고리 맥락에서는 그 카테고리만으로 모든 행을 채운다 | 같음 |
| 흐름 | 행마다 8–14 pt/s, 이웃 행은 반대 방향 | 같음 |
| 패럴랙스 | 전경 스크롤 오프셋 × 0.35만큼 세로 이동 | 같음 |

### 4.4 배치 B — 기울어진 모자이크 (비교용, 채택 안 함)
- 2026-11-18 D2에서 A를 골랐다. B는 앱 화면에 쓰지 않고 Debug 빌드의 표지 벽 실험실에만 비교용으로 남긴다. 표지를 알아보기 어렵고, 시뮬레이터 CPU가 A보다 약 30% 높았다(13–16% 대 9–11%).
- 표지를 엇갈린 열로 빽빽하게 깔고 전체를 −12° 회전한다. 화면 모서리가 비지 않도록 각 변에 표지 한 장 이상 여유를 둔다.
- 전체가 대각선으로 5–8 pt/s 흐른다. 패럴랙스는 A와 같다.
- 사선 경계가 많아 굴절은 더 잘 보인다. 반면 표지를 알아보기 어렵다. Phase 2에서 A와 실기기로 비교한다.

### 4.5 맥락 모드 (`LibraryWallModel.context`)
```swift
enum WallContext: Equatable {
  case all                 // 최근 기록 순으로 섞음
  case category(PrismAccent)
  case period(DateInterval) // 타임라인
  case hero(RecordItem.ID)  // 상세: 그 표지를 크게, 강하게 흐려서 화면 전체에
  case still                // 설정: 정지
}
```
- 모드가 바뀌면 0.45초 크로스페이드로 전환한다. 상세 진입(`hero`)은 목록 셀의 표지에서 `navigationTransition(.zoom(sourceID:in:))`으로 이어지게 한다.
  - **[확인됨]** `static func zoom(sourceID: some Hashable, in namespace: Namespace.ID) -> ZoomNavigationTransition` (iOS 18.0+). 출발 셀에 `matchedTransitionSource(id:in:)`를 붙이고, 도착 화면에 `.navigationTransition(.zoom(sourceID:in:))`를 붙인다. 두 곳은 같은 `id`와 같은 `@Namespace`를 쓴다.
  - **[실기기]** zoom 전환과 벽의 `hero` 크로스페이드를 같은 타이밍으로 맞추는 방법은 문서에 없다. Phase 5에서 확인한다.
- 흐름 시계는 `LibraryWallModel`이 하나만 갖는다. 탭을 바꿔도 위치가 튀지 않는다.

### 4.6 렌더링과 배치 위치
- 우선안: 루트(`AppShell`)에 벽을 한 번만 깔고 탭 콘텐츠의 배경을 투명하게 한다.
  - **[확인됨]** `ContainerBackgroundPlacement.navigation`은 iOS 18.0+에서 `NavigationStack`과 `NavigationSplitView` 안쪽 배경을 바꾼다. `containerBackground(_:for:)`에 `.clear`를 넘기는 방식으로 쓴다. `NavigationSplitView`는 `.navigationSplitView` 배치를 함께 쓴다.
  - **[확인됨]** `ContainerBackgroundPlacement.tabView`는 문서에 watchOS 10.0만 적혀 있다. iOS에서는 쓸 수 있다고 가정하지 않는다.
  - **[확인됨]** SwiftUI 업데이트 문서(2026년 6월·9월 항목)에 TabView 콘텐츠 배경 투명화 API는 없다.
  - **[확인됨]** iOS 27.2 SDK(Xcode 27.2) `SwiftUI.swiftinterface`에서도 `.tabView`는 `@available(iOS, unavailable)`이다. `.navigation`과 `.navigationSplitView`만 iOS 18.0+로 열려 있다.
  - **[빌드 확인]** `.navigation` 배경만 지웠을 때 `TabView`가 그 아래에 불투명 배경을 칠하는지는 선언으로 알 수 없다. Phase 3 첫 작업에서 듀오 시뮬레이터로 확인한다. 칠하면 대안으로 간다.
- **2026-11-18 Phase 3 결과**: 듀오 시뮬레이터에서 TabView가 루트에 깐 벽 위를 불투명하게 칠했다. 그래서 아래 대안을 쓴다. 각 화면과 상세가 `prismWallBackground()`로 같은 `LibraryWallModel`의 벽을 그린다.
- 대안: v1처럼 각 화면 스캐폴드 안에 벽을 두고, 공유 `LibraryWallModel`로 시계·배치를 이어 붙인다. v1 `PrismScreenScaffold`가 이 방식이다. 탭 컨테이너가 불투명 시스템 배경을 칠하기 때문에 v1은 이 방식을 골랐다.
- 흐름은 `TimelineView(.animation)`이 구동하고, 행 하나를 `HStack` 두 벌로 이어 붙여 끊김 없이 순환시킨다. 표지 수가 많으면 `Canvas` + 미리 resolve한 이미지로 바꾼다.
- 정지 조건: `scenePhase != .active`, 저전력 모드(`ProcessInfo.isLowPowerModeEnabled`), 동작 줄이기, 설정에서 끔.

### 4.3.1 표지가 적은 벽과 외부 표지 (2026-11-19)
- 표지가 몇 장뿐이면 카테고리 행마다 한 장이 끝없이 반복돼 화면이 같은 포스터로 찼다(사용자 지적). 빈칸을 끼우는 안은 반려됐다.
- 한 카테고리의 표지가 `WallComposition.fullRowLength`(8칸)에 못 미치면 제 행을 갖지 않고, 그런 카테고리들은 섞인 행 하나에 모인다.
- 서재 맥락의 표지가 8장에 못 미치면 사용자의 다른 기록 표지로 8장까지 채운다(`WallComposition.filled`). 채운 표지는 `isFiller`로 표시해 밝기 -0.4, 채도 0.35로 그린다.
- 외부 표지(`GET /api/v1/media/featured`: TMDB 주간 화제 영화·드라마, IGDB 최근 6개월 게임, 12시간 캐시. 도서는 목록 API가 없어 제외)를 섞는다(`WallComposition.mixingIn`). 기록이 없으면 외부 표지가 벽 전체가 되고 평소 밝기로 그린다. 기록이 있으면 두 화면 분량(16장)까지 채우거나 전체의 15%를 섞되 어둡게 그린다. 서재는 그 카테고리의 외부 표지만, 기록 상세는 섞지 않는다. 외부 표지는 눌러도 아무것도 열지 않는다. 앱은 목록을 캐시 폴더에 저장해 두고 12시간이 지나면 새로 받는다.

### 4.5.1 맥락 전환: 승강장을 나가는 열차, 타임라인은 밝기만 (2026-11-19 사용자 설계·결정)
- 서로 다른 행을 그리는 맥락(전체·서재·설정) 사이를 옮길 때 크로스페이드 대신, 지금 행들이 흐르던 방향으로 점점 빨라지며 화면 밖으로 빠져나가고(0.45초) 0.3초 뒤 새 맥락의 행들이 반대편에서 들어와 감속하며 자리를 잡는다(0.55초). 행마다 0.04초씩 위에서부터 시차를 둔다(`WallShift`, `WallTrain`).
- 타임라인은 스크롤할 때마다 표지가 바뀌어 정신없었다(사용자 지적). 그래서 타임라인은 전체 벽과 같은 표지를 같은 자리에 그리고(`WallComposition.layoutContext`), 보이는 기간에 기록한 표지만 밝게, 나머지는 채운 표지처럼 어둡게 그린다(`WallComposition.highlighting`). 기간이 바뀌면 표지가 0.6초 동안 제자리에서 밝아지거나 어두워진다(`WallRelight`). 벽은 칸 단위로 그리므로 밝기는 암묵적 애니메이션이 아니라 프레임마다 표지별로 계산한다. 전체 탭과 타임라인 사이도 열차 대신 이 전환을 쓴다.
- 기간 변화는 0.4초 동안 더 바뀌지 않아야 반영한다. 동작 줄이기에서는 바로 바뀐다. 기록 상세(히어로)로의 전환은 크로스페이드다.

### 4.6.1 위·아래 가장자리 블러 (2026-11-18 사용자 결정)
- 시스템 스크롤 가장자리 효과를 쓴다: `PrismScreenScaffold`의 `ScrollView`에 `scrollEdgeEffectStyle(.soft, for: [.top, .bottom])`. 효과는 바가 겹치는 곳(위 내비게이션 바, 아래 탭 바)에만 생기고, 콘텐츠와 그 뒤 표지 벽을 함께 흐린다.
- 직접 만든 점진 블러(`WallEdgeBlur`, 벽을 반경별로 세 번 더 그려 겹침)는 경계 구간에서 표지가 이중으로 보여 폐기했다. 임의의 뷰에 쓰는 가변 블러는 공개 API에 없다(iOS 27.2 SDK `SwiftUI`·`UIKit` 헤더 확인).
- 아이폰 듀오 접힌 화면에서는 스크롤하면 위 바가 세로 바로 들어가고 탭 바도 세로 바에 있어서, 위·아래에 효과가 생기지 않는다.

### 4.6.2 극장 연출·가로 페이저·큰 표지·내려서 보기 (2026-11-19, 설계 확인 후 구현)
- 극장 연출(`WallTheater`): 벽 바탕을 `#080706`으로 더 어둡게 하고 표지 간격을 넓혔다(compact 18/22pt, regular 22/26pt). 벽을 반경 16으로 흐린 사본을 밑에 깔아 각 포스터의 색이 주변 어둠으로 번진다.
- 가로 페이저: 라이브러리 첫 블록이 1쪽 스펙트럼 카드, 2쪽부터 지금 진행 중 카드인 가로 페이저다. 아래 점으로 현재 쪽을 보인다. 진행 중 카드는 스펙트럼 카드와 높이를 맞추고 표지를 그 높이(최대 150pt)로 키운다. 쪽 간격은 화면 여백보다 넓은 26pt라 멈춰 있을 때 다음 카드가 보이지 않는다. 쪽 위치는 실제 콘텐츠 폭에서 구한다(추정한 간격은 쪽마다 오차가 쌓여 큰 표지가 밀렸다). 페이저는 `HStack`이다(`LazyHStack`은 콘텐츠 폭을 추정만 한다).
- 큰 표지(`WallFocus`, `HeroPoster`, 2026-11-19 사용자 설계): 페이저를 진행 중 카드로 넘기면 벽은 그대로 두고, 포스터 자리 가운데에 가장 가까운 행이 그 행의 흐름 방향으로 0.6초 동안 화면 폭의 1.2배 이상 빠르게 스크롤된다. 그 행에 진행 중 표지가 끼워져 들어와(카테고리와 무관, `placements`) 화면 가운데에 멈추고, 0.5초 동안 떠올라 포스터 자리(상단 바 아래부터 내린 페이저 위까지)에 높이의 86%, 2:3으로 커진다. 주위 행은 멈추고, 표지가 커지기 시작할 때부터 밝기 -0.22, 블러 1.5로 물러난다. 진행 중 카드끼리 넘기면 지금 표지가 크기를 유지한 채 넘긴 방향으로 0.5초 동안 빠져나가고(사용자 결정), 같은 순간 가운데 행이 0.45초 동안 질주한 뒤 다음 표지가 0.4초 동안 떠오른다. 빠져나간 표지의 행 자리는 질주하는 행에 실려 화면 밖으로 간다. 스펙트럼으로 돌아오면 표지가 행으로 돌아가고 주위가 다시 밝아지며 흐름이 이어진다. 끼워 넣은 표지는 그 자리에 남는다. 조명은 포스터 위의 짧은 따뜻한 등과, 그 빛이 포스터 윗부분과 주변 벽에 떨어지는 그라디언트뿐이다. 빛줄기, 바닥 반사, 뒤에서 번지는 빛은 쓰지 않는다. 동작 줄이기에서는 바로 바뀐다.
- 내려서 보기: 라이브러리 맨 위에서 90pt 넘게 당기면 내용이 내려가고 페이저와 점만 하단 바 위 16pt에 남는다. 제목과 날짜는 투명해지고, 아래 카드들은 레이아웃에서 빠진다(컨테이너 안 글래스는 카드에 준 투명도를 무시한다). 진행 중 쪽은 글래스 카드 대신 설명판이 된다: 카테고리(카테고리 색), 제목, 큰 진행률 숫자와 쪽수, 3pt 진행 막대. 벽은 위쪽 0.06에서 페이저 쪽 0.88까지 짙어지는 그라디언트로 덮어 설명판 글자를 받친다. 벽은 1/3 속도로 느리게 흐르고(시계 속도만 바꿔 위치가 튀지 않는다) 디밍이 0.12로 줄며, 표지나 큰 표지를 누르면 그 기록 상세가 열린다. 행을 좌우로 끌면 그 행만 손가락을 따라 움직이고, 놓으면 시간 상수 0.32초로 미끄러지다 멈춘다(`RowNudge`). 끌어 옮긴 위치는 올린 뒤에도 남는다. 페이저 위 손잡이를 누르거나 위로 끌면 돌아온다. 이 동작 때문에 라이브러리에서는 당겨서 새로고침을 쓰지 않는다(앱 활성화 시 동기화는 그대로).
- 가독성 층의 디밍 그라디언트는 터치를 막지 않는다(`allowsHitTesting(false)`).
- 페이지에 상태에 따라 갈리는 수정자를 걸지 않는다. 내린 상태에서만 접근성 동작을 붙였더니 페이지 전체가 다시 만들어져 페이저가 첫 쪽으로 돌아갔다.

### 4.7 가독성 층 (`WallLegibilityLayer`)
- 벽 위, 전경 아래에 깐다: 위→아래 검정 그라디언트(0.30 → 0.55) + 채도 0.85.
- 투명도 줄이기 켜짐: 디밍을 0.75로 올리고 흐름을 멈춘다.
- 히어로 모드: 표지 블러 40pt + 디밍 0.45.
- 검증 픽스처: 흰 바탕이 많은 표지 10장으로 구성한 "최악 조건 벽"을 디버그 메뉴에 넣고, 모든 화면의 텍스트 대비를 확인한다.
- 2026-11-18 측정: 위 기본 디밍으로는 최악 조건에서 `.regular` 본문 대비가 3.90:1이라 4.5:1에 못 미친다. 본문은 `.regular`에서 디밍 0.55 이상, `.clear`에서 0.7 이상이 필요하다. 수치는 03-plan Phase 2 절에 있다. 디밍 값과 보조 글자색은 Phase 3에서 정한다.

## 5. 글래스 시스템 v2 (`PrismGlass`)

| 용도 | 재질 | 비고 |
|---|---|---|
| 모든 콘텐츠 카드 (렌즈 카드 포함) | `Glass.prism` = `.clear` + 검정 35% tint | 카테고리 tint는 검정에 26% 섞는다 |
| 버튼 | `.buttonStyle(.glass)` / `.glassProminent` | §2.3 규칙 |
| 모핑 (작성 메뉴, 카드 펼침) | `glassEffectID(_:in:)` + `GlassEffectContainer` | |
| 사이드바·탭바·툴바 | 시스템 기본 | 커스텀 글래스를 덧칠하지 않는다 |

- **2026-11-18 재질 통일**(사용자 결정): 카드마다 `.regular`와 `.clear`가 섞여 굴절이 보이는 카드와 안 보이는 카드가 생겼다. 모든 콘텐츠 글래스를 `Glass.prism` 하나로 모으고 `.clear`로 정했다. clear는 뒤를 어둡게 하지 않으므로 HIG(Materials)가 밝은 배경 위 clear에 권하는 35% 어두운 층을 tint로 넣었다. 실험실 비교 샘플만 `.regular`를 그대로 쓴다.
  - 측정(듀오 펼침, 상세 화면, 흰 표지 히어로 배경): clear만 쓰면 본문 2.2–2.5:1, 보조 1.0–1.2:1. 35% tint를 넣으면 본문 4.7–4.8:1, 보조 1.9:1. 보조 글자는 여전히 4.5:1에 못 미친다(이슈 #19).
- 새 토큰: `PrismGlassMetrics.lensCorner = 28`(히어로 렌즈 카드), 카드 최대 폭 `readableWidth = 640`(regular width에서 본문 카드의 최대 폭. 남는 양옆으로 벽이 드러난다).
- 글래스 렌즈 카드: 라이브러리 상단 "지금 진행 중" 카드. 다른 카드와 같은 재질에 큰 모서리(28)와 최소한의 텍스트(제목, 진행률)만 둔다.
  - 2026-11-18: 다음 카드가 열 경계에서 잘려 보이던 문제를 고쳤다. 카드 폭을 열 폭과 같게 하고(`containerRelativeFrame`), 카드 간격을 화면 여백보다 넓게 해서 멈춰 있을 때는 한 장만 보인다. 캐러셀은 화면 여백(18pt)까지 넓혀 그 끝에서 자르고, 넘어가는 카드는 `scrollTransition`으로 흐려지며 약간 작아진다. 글래스는 `mask`를 무시하고 `clipped()`만 따르므로 페이드 마스크는 쓰지 않는다.
- 스크롤 가장자리: 시스템 scroll edge effect를 쓴다.
  - **[확인됨]** `scrollEdgeEffectStyle(_ style: ScrollEdgeEffectStyle?, for edges: Edge.Set)` (iOS 26.0+). 기본은 자동 효과다. 문서 예제에는 `.hard`만 나온다. `scrollEdgeEffectHidden(_:for:)`로 숨길 수 있다.
  - **[확인됨]** `ScrollEdgeEffectStyle`의 값은 `.automatic`, `.hard`, `.soft` 세 개다(iOS 27.2 SDK `SwiftUI.swiftinterface`).
- Liquid Glass API의 iOS 27 변경:
  - **[확인됨]** SwiftUI 업데이트 문서의 2026년 6월·9월 항목에 Liquid Glass 변경이 없다. Xcode 27.0의 Apple 스킬 `swiftui-whats-new-27`에도 Liquid Glass 항목이 없다.
  - **[확인됨]** `Glass`의 멤버는 `regular`, `clear`, `identity`, `tint(_:)`, `interactive(_:)` 다섯 개다. `glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape())`에 폐기 표시가 없다. iOS 26 규칙과 v1 코드를 그대로 쓴다.
- iOS 27 SDK에서 v2에 영향을 주는 SwiftUI 변경 (Apple 스킬 `swiftui-whats-new-27`, Xcode 27.0):
  - `@State`가 매크로로 바뀌었다. `_x = State(initialValue:)`로 초기화하는 v1 뷰는 컴파일 오류가 날 수 있다. 할당 순서를 바꾸는 수정은 틀린 수정이다. 선언의 초깃값을 지우고 `init`에서만 할당한다.
  - `AsyncImage`가 iOS 27에서 HTTP 캐시를 기본으로 쓴다. `AsyncImage(request:)`와 `asyncImageURLSession(_:)`이 추가됐다. 표지 벽은 디코딩·다운샘플을 마친 이미지가 필요하므로 `CoverThumbnailCache`는 그대로 만든다.
  - 툴바: `ToolbarItemPlacement.topBarPinnedTrailing`, `visibilityPriority(_:)`, `ToolbarOverflowMenu`, `toolbarMinimizeBehavior`가 추가됐다. 작성 `+` 버튼은 `topBarPinnedTrailing` 후보다.

## 6. 화면별 명세

### 6.1 라이브러리 (홈)
위에서 아래로:
1. 툴바: 워드마크(leading, 글래스 캡슐 숨김), `+` 작성 메뉴(trailing)
2. **지금 진행 중** — 렌즈 카드 가로 캐러셀. 읽는 중인 책, 보는 중인 시리즈, 진행 중인 게임·공부. 탭하면 상세로 간다.
3. 스펙트럼 요약 — 기존 `SpectrumRing` + 카테고리별 수 + 연속 기록일
4. 통계 — 추세선, 분포, 활동 히트맵 (기존 컴포넌트 이전)
5. 최근 기록
- regular width: 2·3·4를 두 열로 재배치하고, 최대 폭 정렬 없이 양 가장자리 여백을 따른다.

### 6.2 기록
- compact: v1 허브 구조(`RecordsHub` → 카테고리 목록 → `RecordDetailScreen`)를 `NavigationStack`으로 유지한다.
- regular: `NavigationSplitView` — 사이드바(카테고리 + 해당 목록), 상세. 듀오 펼침에서 시스템이 50/50으로 나누고 접힘선이 자연스러운 경계가 된다.
- 목록의 표지 셀에서 상세로 갈 때 벽이 `hero` 맥락으로 바뀐다.
- **Phase 7 결정**: compact에서도 `NavigationStack`으로 바꾸지 않고 `NavigationSplitView` 하나를 쓴다. 접을 때 스택과 분할 화면을 바꿔 끼우면 기록 탭 전체가 다시 만들어져서 상세에서 연 시트·세션이 닫히고 입력이 사라졌다. 분할 화면은 compact에서 스스로 접히고 열의 뷰를 유지한다. 그 대가로 기록 탭의 목록→상세 `zoom` 전환은 쓰지 않는다.
- 분할 화면은 접힘선에 열 경계를 맞추지 않았다(시뮬레이터). 사이드바의 기본 폭을 접힘선 왼쪽 끝으로 준다. 책 자세에서는 경계가 접힘선에 맞았고, 완전히 펼친 자세에서는 시스템이 사이드바를 약 418pt로 제한해 접힘선(459–497pt)에 못 미쳤다. 실기기에서 다시 본다.
- 펼친 상태에서 기록을 고른 채 접으면 상세가 스택의 루트가 되어 뒤로 가기가 사라졌다. 접힐 때 사이드바를 잠깐 보였다가 상세를 다시 올려서 뒤로 가기를 되살린다.
- 상세 섹션(독서 진행·필사·세션, 시리즈 에피소드, 게임 세션 달력, 공부 목차·활동)은 기능을 모두 유지한다.

### 6.3 타임라인
- 계속 스크롤되는 피드라 접힘선을 피해 밀어내지 않는다(Apple 가이드).
- regular width에서도 한 열, 최대 폭 640pt 가운데 정렬. 양옆에 벽이 드러난다.
- 벽 맥락은 화면에 보이는 날짜 범위를 따라간다(`period`). 스크롤이 멈춘 뒤 0.6초 지나면 갱신한다.

### 6.4 설정
- v1 항목 유지 + 표시 옵션: 표지 벽 배치(A/B), 흐름 켜기/끄기, 벽 밝기 3단계. 이 값들은 `@AppStorage`에 둔다.
- 디버그 섹션(DEBUG 빌드): 최악 조건 벽, 표지 수 시뮬레이션(0/5/30/200장), 캐시 비우기.

### 6.5 작성
- 툴바 `+` → 카테고리 메뉴 → 기존 시트(`NewReadingSheet`, `NewStudySheet`, `NewCultureSheet` 3종).
- 작성 중인 초안은 `AppNavigationModel`에 둔다. 접고 펼쳐서 시트가 다시 표시돼도 입력이 남아 있어야 한다.
- 저장 후 v1의 `saveRefractionPulse`(카테고리 색 빛 번짐)를 유지하고, 새 표지는 벽에 페이드인한다.

### 6.5.1 추가 화면 (2026-11-19 개선, 사용자 승인)
- 배경은 벽과 같은 어두운 극장 바탕에 카테고리 색 빛이 위에서 옅게 떨어진다(`TheaterSheetBackground`).
- 검색 결과는 표지 격자다(`CoverGrid`, 폭 148~220pt 적응형: iPhone 2열). 큰 표지 아래 제목 2줄, 저자·연도 1줄. 불러오는 동안 표지 모양 빈 칸이 옅게 깜빡인다(`CoverGridSkeleton`).
- 검색 전 안내 카드는 없다. 영화·시리즈·게임은 이번 주 화제작 격자(`LibraryWallModel.discoveryItems`)를 보여 누르면 바로 고를 수 있다. 도서는 화제작 출처가 없고, 이미 기록한 책을 다시 고르는 동작은 맞지 않아 검색 칸만 둔다.
- 고르면 그 표지가 커지며 위로 가고(`matchedGeometryEffect`), 제목·연도·쪽수(회차) 아래에 입력 카드와 시작 버튼이 이어진다. 문화 상태는 네 가지를 한 번에 보이는 세그먼트로 바꿨다.
- 실패는 "지금은 검색할 수 없습니다…" 또는 "인터넷 연결을 확인해 주세요." 한 줄과 다시 시도 버튼(`SearchFailureLine`)으로 보인다. 서버 원문은 보이지 않는다. 결과가 없으면 "‘검색어’에 맞는 …이 없습니다." 한 줄.
- 디버그 빌드는 `-AddSheetQuery 검색어`로 검색어를 미리 채운다(시뮬레이터에 글자를 입력할 수 없을 때 확인용).

### 6.5.2 워드마크와 스플래시 (2026-11-19, 사용자 결정)
- 워드마크(`PrismWordmark`)는 앱 아이콘의 프리즘(`PrismMark`, 세 띠는 독서·공부·문화 색) 옆에 Pretendard ExtraBold "PrismLog"를 두고, 프리즘의 빛이 글자 아랫부분에 은은하게 비친다(시안 A·L3·S2). 상단 헤더와 스플래시가 같은 컴포넌트를 쓴다.
- 앱을 켜면 시스템 실행 화면과 같은 색(#1A1816) 위에 워드마크가 떠 있다가, 벽의 첫 화면 표지(위쪽 8행의 앞 6칸과 끝 1칸)가 모두 이미지를 갖고 외부 표지 목록이 정해지면 0.6초 동안 사라지며 벽이 드러난다(`LaunchSplash`, `LibraryWallModel.isReadyForLaunch`). 최대 3초를 넘기면 준비와 상관없이 넘어간다.
- iOS는 실행 화면을 업데이트 뒤에도 캐시하므로 실행 화면 색을 바꾸지 않고 스플래시가 그 색에 맞춘다.

### 6.5.3 시리즈 상세: 웹 패리티 (2026-11-20, 사용자 결정 "웹 구성 전부 이식")
- 웹 `SeriesDetailPage`(`recordsPage.jsx:1063`) 구성을 그대로 옮겼다(`SeriesDetailContent`). 히어로 카드: 포스터, Series Detail·제목·상태/플랫폼/방영일/태그 배지·편집, 줄거리, 다음 에피소드 카드(누르면 시즌 보드의 그 회차로 이동·강조), 시청 현황 막대와 별점, 시즌별 막대, TOTAL 도넛·회차·시즌·평균 러닝타임, 진행 추세 차트(웹과 같은 점선 격자·면·점, 한 점이어도 표시).
- 시즌 보드: 시즌마다 이름·방영일·총 회차·시청 수·막대, 가로로 넘기는 회차 카드(244×350pt, 스틸·EP·제목·체크·방영일·러닝타임·줄거리 3줄·상태·시청일). 카드를 누르면 시청, 체크로 해제하며 해제는 확인창(함께 해제되는 회차 썸네일과 수)을 거친다.
- 저장은 웹 `commitEpisodeSelection`과 같다: 지정 회차까지 시청일이 없으면 오늘 날짜, 이후는 삭제, 상태는 시청 완료·시청 중·기대 중으로 바뀐다.
- 플랫폼 배지는 `platform_key`(웹)가 없으면 이름으로 넷플릭스·애플티비+·디즈니 플러스·TV를 찾아 로고를 쓴다. 로고는 웹 `public/platforms` 이미지를 PNG로 옮겼다.
- 세 칸 배치는 카드가 받는 너비가 720pt 이상일 때만 쓴다. 휴대폰과 펼친 Duo의 상세 칸은 세로로 쌓는다.

### 6.6 독서 세션 모드 (신규, 테이블탑 대응)
- 진입: 독서 상세의 "읽기 시작" 버튼.
- 기본 레이아웃: 위쪽에 표지와 경과 시간, 아래쪽에 쪽수 입력·메모·종료 버튼. 끝내면 기존 `ReadingProgressSheet` 흐름으로 세션을 저장한다.
- 테이블탑 자세: `ArrangementView`로 위·아래 영역을 접힘선 기준으로 나눈다. 다른 자세에서도 같은 컨트롤과 계층을 유지한다(Apple 가이드: 기능을 자세별로 제한하지 않는다).
- **[확인됨]** `ArrangementView` (iOS 27.1+):
  ```swift
  nonisolated struct ArrangementView<Primary, Secondary> where Primary : View, Secondary : View
  init(primary: () -> Primary, secondary: () -> Secondary)
  ```
  - 스타일: `.arrangementViewStyle(.split)`, `.arrangementViewStyle(.overlay)`. 축 제한은 `.split.axes(_:)`, `.overlay.axes(_:)`에 `Axis.Set`을 넘긴다.
  - 크기 조절: `splitArrangementLayoutRatio(_:)`, `splitArrangementLayoutSize(minWidth:idealWidth:maxWidth:minHeight:idealHeight:maxHeight:)`, `splitArrangementFixedLayoutSize(horizontal:vertical:)`, `overlayArrangementEdge(_:)`.
  - 환경 값: `EnvironmentValues.splitArrangementAxis`, `EnvironmentValues.overlayArrangementZIndex`. `overlayArrangementZIndex`는 수식어가 아니라 환경 값이다.
  - 배치 제약: `ArrangementView`를 `ScrollView`, `NavigationSplitView`, 그리드, `List` 안에 넣지 않는다. `ArrangementView` 안에 `NavigationSplitView`나 `TabView`를 넣지 않는다. 그래서 세션 모드 화면은 스크롤 없이 `ArrangementView`를 화면 최상위에 둔다. 메모 입력처럼 길어지는 영역은 primary 또는 secondary 안에서만 스크롤한다.
  - 세션 모드 기본안: `ArrangementView { 표지·경과 시간 } secondary: { 쪽수·메모·종료 }` + `.arrangementViewStyle(.split.axes(.vertical))`. **[빌드 확인]** 테이블탑에서 접힘선 기준으로 위·아래가 나뉘는지 시뮬레이터로 확인한다.
  - **Phase 7 결과**: 테이블탑에서 위·아래로 나뉜다. 그런데 세로축만 허용하면 책 자세(세로 접힘선)에서 secondary가 통째로 사라졌다. 그래서 `.arrangementViewStyle(.split)`(두 축)으로 바꿨다. 책 자세에서는 좌우로 나뉜다.
  - 세션 진행 상태(시작 시각·쪽수·메모)는 `AppNavigationModel.readingSession`에 둔다. 화면 자체 상태로 두었을 때 자세가 바뀌면 시계가 0으로 돌아갔다.

## 7. 아이폰 듀오 대응

### 7.1 원칙 (Apple "Design for iPhone Duo", "Prepare your app")
- 자세별 레이아웃을 따로 만들지 않는다. compact / regular 두 size class를 기준으로 짠다.
- 크기 판단은 실제 가용 공간(`GeometryReader`, `onGeometryChange`)으로 한다. `UIScreen.main`, `UIDevice.current.orientation`, `interfaceOrientation`, `userInterfaceIdiom` 분기, 특정 높이 비교를 쓰지 않는다.
- 레이아웃 여백과 가로 safe area inset을 따른다. 바깥 화면에서는 세로 바만큼 콘텐츠가 자동으로 밀려난다.
- 배경 이미지는 전체 폭으로 깔고 스크롤되는 전경만 inset해도 된다(Apple이 예로 든 패턴). 표지 벽이 이 패턴에 해당한다.

### 7.2 접힘선과 영역
- `GeometryProxy.reservedRegions(kind: .division, options: .includeInactive)` / `UIView.reservedRegions(kind:options:)`로 접힘선 프레임을 얻는다. Apple 문서는 기기가 일부 접혔을 때 영역이 활성이고, 완전히 펼치면 비활성이라고 설명한다.
- **[확인됨]** SwiftUI 시그니처 (iOS 27.1+):
  ```swift
  func reservedRegions(
      kind: ReservedRegion.Kind,
      options: ReservedRegion.QueryOptions = [],
      layoutDirectionBehavior: LayoutDirectionBehavior = .mirrors
  ) -> [ReservedRegion]
  ```
  - `ReservedRegion.Kind`: `.occlusion`(Dynamic Island, 카메라처럼 뷰를 가리는 영역), `.division`(접힘선처럼 뷰를 나누는 영역).
  - `ReservedRegion.QueryOptions`: `.includeInactive`. 기본값 `[]`은 활성 영역만 돌려준다.
  - `ReservedRegion` 멤버: `id: ReservedRegion.ID`(조회 사이에 유지), `kind`, `frame: CGRect`, `margins: EdgeInsets`, `isActive: Bool`.
  - `frame`은 읽은 뷰의 왼쪽 위(leading-top) 기준 좌표이고, 이미 `margins`를 포함한다. 상호작용 요소는 `frame` 밖에 두면 된다.
  - 커스텀 `Layout`에서 쓸 때 `placeSubviews(in:proposal:subviews:cache:)`의 `bounds.origin`은 (0, 0)이 아닐 수 있다. 계산은 (0, 0) 기준으로 하고 배치할 때만 `bounds.origin`을 더한다.
- 사용 순서 (Apple 포럼 답변): 시스템 컨테이너 → `ArrangementView` → reserved region 직접 조회 순으로 고른다. 라이브러리 2열 배치는 직접 조회가 필요한 경우다.
- 상호작용 요소(글래스 카드의 버튼, 렌즈 카드 캐러셀의 탭 영역)는 활성 접힘선 위에 두지 않는다.
- 표지 벽과 스크롤 피드는 접힘선을 피하지 않는다.
- 라이브러리 2열 배치는 접힘선이 있으면(비활성 포함) 짝수 열을 고르고, 접힘선 주변 간격을 넓힌다.
- 시트·알림·메뉴·툴바 버튼은 시스템이 접힘선을 피해 준다. 커스텀 팝업을 만들지 않는다.

### 7.3 자세 감지
- **[확인됨]** 시그니처 (iOS 27.1+):
  ```swift
  nonisolated func onHingeChange(
      isEnabled: Bool = true,
      _ action: @escaping (DeviceHingeContext, DeviceHingeContext) -> Void
  ) -> some View
  ```
  - `DeviceHingeContext.hinge: DeviceHinge?` — 경첩 없는 기기는 nil.
  - `DeviceHinge.angle: Angle`, `DeviceHinge.status: DeviceHinge.Status`. `Status`는 enum이 아니라 struct다. 값은 `.closed`, `.partiallyOpen`, `.fullyOpen` 세 개다(SwiftUI 업데이트 문서). `switch`에는 `default`를 둔다.
  - **[확인됨]** 클로저 인자는 `(_ oldContext: DeviceHingeContext, _ newContext: DeviceHingeContext)` 순서다(iOS 27.2 SDK `SwiftUICore.swiftinterface`, `@available(anyAppleOS 27.1, *)`).
  - `Angle`의 단위는 문서에 없다. `Angle`은 `.degrees`와 `.radians`를 둘 다 제공하므로 단위 변환 없이 쓴다.
- 용도: 세션 모드의 테이블탑 전환 연출, 벽 흐름 속도 미세 조정 정도로 한정한다. 레이아웃 결정은 arrangement와 reserved region API로 한다(Apple 권장).

### 7.4 연속성 (접기·펼치기)
- `AppNavigationModel`(`@Observable`, 장면 단위)에 둘 상태: 선택 탭, 기록 탭의 경로와 선택 기록 ID, 카테고리, 작성 초안, 세션 모드 진행 상태.
- 스크롤 위치는 `scrollPosition(id:)`로 기록 ID에 묶는다.
- 장면 복원: `@SceneStorage`에 탭과 선택 기록 ID를 저장한다.
- 크기 변화에 뷰 정체성(`id`)이 바뀌지 않게 한다. compact/regular 전환 시 `NavigationStack` ↔ `NavigationSplitView`가 바뀌어도 선택 상태는 모델에서 다시 그린다.

### 7.5 세로 바와 시트
- iOS 27.1 SDK에서 탭바·툴바가 세로로 바뀌는 상황을 전제로 한다. 폭이 넓은 툴바 항목(텍스트 버튼, 세그먼트)은 내비게이션 바에 남는다는 점을 고려해 툴바에는 아이콘 버튼만 둔다.
- 세그먼트 컨트롤(예: 추세선 누적/일별)은 카드 안에 둔다.
- **[확인됨]** 세로 바 끄기: `nonisolated func toolbarVerticalBehavior(_ behavior: ToolbarVerticalBehavior) -> some View` (iOS 27.1+). 값은 `.automatic`(기본)과 `.disabled` 두 개다(iOS 27.2 SDK `SwiftUI.swiftinterface`). UIKit은 `UIViewController.preferredVerticalBarBehavior`다.
  - Apple은 전체 화면 동영상 플레이어나 계산기처럼 가로 바가 더 나은 화면에만 끄라고 안내한다. 탐색 중에 자주 바꾸지 말라고도 안내한다.
  - 시트와 폼 안에서는 윈도나 프레젠테이션이 값을 정한다. `TabView`는 선택한 탭의 값을, `NavigationStack`은 맨 위 화면의 값을, `NavigationSplitView`는 가장 오른쪽 열의 값을 쓴다.
  - 결정: 작성 시트는 세로 바를 끄지 않는다. 시스템 기본 동작을 따른다. 바깥 화면의 시트는 기본으로 세로 바를 쓴다.
- **[확인됨]** 툴바 항목은 아이콘과 제목을 함께 준다. 세로 바는 아이콘을 쓰고 넘침 메뉴는 둘 다 쓴다. 제목만 있는 항목이나 커스텀 뷰 항목은 세로로 표시되지 않는다. v1 시트의 `Button("취소")`, `Button("저장")`은 `Button("취소", systemImage: "xmark")`처럼 바꾼다.
- **[확인됨]** 관련 API: `EnvironmentValues.toolbarVerticalEdge: HorizontalEdge?`(세로 바가 놓일 쪽), `ToolbarContent.axisBehavior(_:)`(`.horizontalOnly`, `.verticalPreferred`), `toolbarVerticalCompressionBehavior(_:)`(`.prefersToolbarItems`, `.prefersTabBar`).
- **[확인됨]** 세로 바 아래로 히어로·배경 이미지를 늘이려면 `backgroundExtensionEffect()`를 쓴다(iOS 26.0+). 상세 화면 히어로 표지에 쓴다. 표지 벽은 전체 폭으로 까는 배경이라 따로 필요하지 않다.
- 세로 바 방향 규칙 (Apple 문서): 인스펙터는 가로. 분할 화면은 사이드바·콘텐츠 열이 가로, 상세 열이 세로. 바깥 화면 시트는 기본 세로. 안쪽 화면 시트는 가운데·leading 배치면 가로, trailing 배치면 세로.

### 7.6 멀티태스킹
- iOS 27의 iPhone Split View에서 폭이 줄어도 compact 레이아웃으로 자연스럽게 내려간다.
- 새 창 요청(`UIWindowSceneActivationAction`)은 이번 범위에서 쓰지 않는다.

## 8. 접근성
- 투명도 줄이기: 디밍 강화, 흐름 정지, 글래스는 시스템이 불투명하게 처리.
- 동작 줄이기: 벽 흐름·패럴랙스 정지, 모핑을 페이드로 대체.
- Dynamic Type: 커스텀 폰트에 `relativeTo:` 유지(v1 방식). 접근성 크기에서 라이브러리 2열 → 1열.
- VoiceOver: 표지 벽은 `accessibilityHidden(true)`. 렌즈 카드는 "제목, 카테고리, 진행률" 순서로 읽는다.
- 대비 4.5:1 (§4.7 픽스처로 검증).

## 9. 성능 예산
- 홈 스크롤 hitch time ratio < 5 ms/s (120Hz 기기, Instruments Animation Hitches).
- 콜드 스타트에서 첫 프레임까지 벽 표시 < 400ms (디스크 캐시 적중 기준). 캐시가 비었으면 블룸 배경으로 먼저 그리고 표지는 들어오는 대로 페이드인한다.
- 벽 메모리 < 80MB (표지 200장 기준).
- 측정은 실기기로 한다. 시뮬레이터 수치는 참고만 한다.

## 10. 테스트
- 단위: 기존 6개 테스트 파일 유지. 신규 — 표지 목록 구성(중복 엔티티 제거, 반복 배치, 섞기), 맥락 모드 전환, `GeneratedCover` 입력별 결과, 썸네일 캐시 키·실패 처리.
- UI: 탭 전환, 작성 메뉴 → 시트 → 저장, 기록 상세 진입. v1 `AppShellUITests`를 새 구조에 맞게 고친다.
- 듀오 매트릭스 (Xcode 27.1 iPhone Duo 시뮬레이터): 바깥 화면 / 안쪽 화면 / 책 자세 / 테이블탑 / 세로로 든 안쪽 화면 / Split View 반쪽. 각 조합에서 ① 상호작용 요소가 접힘선과 세로 바에 가리지 않는지 ② 접기·펼치기 후 상태 유지 ③ 벽 연속성을 확인하고 스크린샷을 `docs/ios-v2/screens/`에 남긴다.
- 크기 변화: iOS 리사이저블 시뮬레이터와 macOS 27 iPhone Mirroring 창 크기 조절.
- 접근성: 투명도·동작 줄이기, AX5 Dynamic Type.

## 11. 참고 자료
- Preparing your app for iPhone Duo — https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo
- Three steps to make your app shine on iPhone Duo — https://developer.apple.com/iphone-duo/prepare/
- Designing for iPhone Duo (HIG) — https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo
- Tech talk: Design for iPhone Duo — https://developer.apple.com/videos/play/tech-talks/111466/
- Tech talk: Strike a pose with adaptive layouts on iPhone Duo — https://developer.apple.com/videos/play/tech-talks/111463/ (`reservedRegions`, `ArrangementView`, `overlayArrangementZIndex`)
- Tech talk: Leverage multiple displays and scenes on iPhone Duo — https://developer.apple.com/videos/play/tech-talks/111464/ (`onHingeChange`, `UIHingeInteraction`)
- Xcode의 "get my app ready for iPhone Duo" 스킬 / `xcrun agent skills export` — 다른 코딩 에이전트에서도 쓸 수 있게 내보낼 수 있다. Xcode 27.0(27A5218g)에서 내보낸 스킬 7개에는 듀오 스킬이 없다: `adopt-c-bounds-safety`, `audit-xcode-security-settings`, `device-interaction`, `modernize-tests`, `swiftui-specialist`, `swiftui-whats-new-27`, `uikit-app-modernization`.

## 12. Phase 0 확인 출처 (2026-10-29 조회)
- Preparing your app for iPhone Duo — https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo (reserved region, `ArrangementView`, 세로 바, 시트 배치, 툴바 항목 규칙)
- `GeometryProxy.reservedRegions(kind:options:layoutDirectionBehavior:)` — https://developer.apple.com/documentation/swiftui/geometryproxy/reservedregions(kind:options:layoutdirectionbehavior:)
- `ReservedRegion` — https://developer.apple.com/documentation/swiftui/reservedregion
- `ArrangementView` — https://developer.apple.com/documentation/swiftui/arrangementview
- `View.onHingeChange(isEnabled:_:)` — https://developer.apple.com/documentation/swiftui/view/onhingechange(isenabled:_:)
- `DeviceHingeContext`, `DeviceHinge` — https://developer.apple.com/documentation/swiftui/devicehingecontext, https://developer.apple.com/documentation/swiftui/devicehinge
- `View.toolbarVerticalBehavior(_:)` — https://developer.apple.com/documentation/swiftui/view/toolbarverticalbehavior(_:)
- SwiftUI updates (2026년 6월·9월 항목, `DeviceHinge.Status` 값) — https://developer.apple.com/documentation/updates/swiftui
- `Glass`, `View.glassEffect(_:in:)` — https://developer.apple.com/documentation/swiftui/glass, https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)
- `ContainerBackgroundPlacement` (`.navigation`, `.tabView`) — https://developer.apple.com/documentation/swiftui/containerbackgroundplacement
- `View.scrollEdgeEffectStyle(_:for:)` — https://developer.apple.com/documentation/swiftui/view/scrolledgeeffectstyle(_:for:)
- `NavigationTransition.zoom(sourceID:in:)` — https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:)
- Apple 스킬 `swiftui-whats-new-27`, `uikit-app-modernization` — `xcrun agent skills export` (Xcode 27.0)
- iOS 27.2 SDK 선언 (2026-11-17, Xcode 27.2 27B52) — `iPhoneOS.sdk/System/Library/Frameworks/SwiftUI.framework/Modules/SwiftUI.swiftmodule/arm64e-apple-ios.swiftinterface` (`ScrollEdgeEffectStyle`, `ContainerBackgroundPlacement`, `ToolbarVerticalBehavior`), `SwiftUICore.framework/.../arm64e-apple-ios.swiftinterface` (`onHingeChange`, `DeviceHinge`, `ArrangementView`, `ReservedRegion`)

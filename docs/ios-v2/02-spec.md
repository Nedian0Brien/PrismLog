# PrismLog iOS v2 — Spec

- 작성: 2026-10-29
- 선행 문서: [01-intent.md](./01-intent.md) · 후속 문서: [03-plan.md](./03-plan.md)
- 표기: **[확인]**은 구현 전에 Apple 문서나 실기기로 검증해야 하는 항목이다. iOS 27/27.1 API는 모델 학습 이후에 나온 것이 많으므로 Apple 문서(Context7 MCP, developer.apple.com)로 시그니처를 확인하고 쓴다.

---

## 1. 플랫폼과 프로젝트

| 항목 | 값 |
|---|---|
| Xcode | 27.1 이상 (iPhone Duo SDK·시뮬레이터 포함) |
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

**작성 진입점**: v1의 떠 있는 FAB(고정 `bottom 78`)를 없앤다. 각 화면 툴바의 `+` 버튼 하나가 카테고리 5종 메뉴를 연다. 툴바 항목이라 듀오에서 세로 바로 옮겨 가는 동작과 접힘선 회피를 시스템이 맡는다. 펼칠 때 글래스가 메뉴로 모핑하는 연출은 `glassEffectID`로 만든다.

## 4. 표지 벽 (Library Wall)

### 4.1 표지 원천
- `PrismStore.records`에서 `coverURL`이 있는 기록: 독서(책 표지), 영화·시리즈(포스터), 게임(커버).
- 같은 엔티티(`entityID`)가 여러 기록에 나오면 한 번만 쓴다.
- 표지가 없는 기록(주로 공부)은 `GeneratedCover`로 만든다: 카테고리 톤 그라디언트 + 제목(Pretendard ExtraBold) + 카테고리 심벌. `ImageRenderer`로 래스터화해서 같은 캐시에 넣는다. 그래야 벽은 모든 표지를 이미지 하나로 다룬다.
- 표지 수에 따른 처리:
  - 0장: `SpectrumBloomBackground`로 대체한다.
  - 1–11장: 반복 배치로 화면을 채운다. 같은 표지가 이웃하지 않도록 섞는다.
  - 12장 이상: 반복 없이 쓰고, 행이 화면 폭보다 짧으면 그 행만 반복한다.

### 4.2 썸네일 파이프라인 (`CoverThumbnailCache`, actor)
- 다운로드 → ImageIO `CGImageSourceCreateThumbnailAtIndex`로 표시 크기의 2배(@3x 기기는 3배)까지 다운샘플한다.
- 디스크: `Caches/covers/<sha256(url)>.heic`. 메모리: `NSCache`(비용 = 픽셀 수).
- 벽에는 디코딩을 마친 이미지만 넘긴다. 벽 렌더링 중에는 `AsyncImage`를 쓰지 않는다.
- 동시 다운로드 4개. 실패한 URL은 세션 동안 다시 시도하지 않고 `GeneratedCover`로 대체한다.
- 기존 `CoverImage` 뷰도 이 캐시를 쓰도록 바꾼다(목록·상세 공용).

### 4.3 배치 A — 가로 행 흐름 (기본값)
| 파라미터 | compact | regular |
|---|---|---|
| 표지 높이 | 132pt | 168pt |
| 비율 | 2:3 고정 (게임처럼 비율이 다른 표지는 aspect fill로 잘라 리듬을 맞춘다) | 같음 |
| 표지 간격 / 행 간격 | 10pt / 12pt | 12pt / 14pt |
| 모서리 | 8pt continuous | 10pt |
| 행 구성 | 맥락 모드 "전체"에서는 독서 → 영화 → 게임 → 시리즈 → 공부 순서로 반복하고, 카테고리 맥락에서는 그 카테고리만으로 모든 행을 채운다 | 같음 |
| 흐름 | 행마다 8–14 pt/s, 이웃 행은 반대 방향 | 같음 |
| 패럴랙스 | 전경 스크롤 오프셋 × 0.35만큼 세로 이동 | 같음 |

### 4.4 배치 B — 기울어진 모자이크 (비교용)
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
- 모드가 바뀌면 0.45초 크로스페이드로 전환한다. 상세 진입(`hero`)은 목록 셀의 표지에서 `matchedGeometryEffect`/`navigationTransition(.zoom)`으로 이어지게 한다. **[확인]** zoom 전환과 배경 히어로 동기화
- 흐름 시계는 `LibraryWallModel`이 하나만 갖는다. 탭을 바꿔도 위치가 튀지 않는다.

### 4.6 렌더링과 배치 위치
- 우선안: 루트(`AppShell`)에 벽을 한 번만 깔고 탭 콘텐츠의 배경을 투명하게 한다. **[확인]** iOS 27에서 `TabView`/`NavigationStack` 콘텐츠 배경을 지우는 방법(`containerBackground(.clear, for:)` 계열, `scrollContentBackground(.hidden)` 등)
- 대안: v1처럼 각 화면 스캐폴드 안에 벽을 두고, 공유 `LibraryWallModel`로 시계·배치를 이어 붙인다.
- 흐름은 `TimelineView(.animation)`이 구동하고, 행 하나를 `HStack` 두 벌로 이어 붙여 끊김 없이 순환시킨다. 표지 수가 많으면 `Canvas` + 미리 resolve한 이미지로 바꾼다.
- 정지 조건: `scenePhase != .active`, 저전력 모드(`ProcessInfo.isLowPowerModeEnabled`), 동작 줄이기, 설정에서 끔.

### 4.7 가독성 층 (`WallLegibilityLayer`)
- 벽 위, 전경 아래에 깐다: 위→아래 검정 그라디언트(0.30 → 0.55) + 채도 0.85.
- 투명도 줄이기 켜짐: 디밍을 0.75로 올리고 흐름을 멈춘다.
- 히어로 모드: 표지 블러 40pt + 디밍 0.45.
- 검증 픽스처: 흰 바탕이 많은 표지 10장으로 구성한 "최악 조건 벽"을 디버그 메뉴에 넣고, 모든 화면의 텍스트 대비를 확인한다.

## 5. 글래스 시스템 v2 (`PrismGlass`)

| 용도 | 재질 | 비고 |
|---|---|---|
| 글이 많은 카드 (통계, 상세 섹션, 목록 행) | `.regular` (+ 카테고리 tint 0.13) | 기본값 |
| 글이 적은 히어로·렌즈 카드, 칩 | `.clear` | 반드시 가독성 층 위에서만 |
| 버튼 | `.buttonStyle(.glass)` / `.glassProminent` | §2.3 규칙 |
| 모핑 (작성 메뉴, 카드 펼침) | `glassEffectID(_:in:)` + `GlassEffectContainer` | |
| 사이드바·탭바·툴바 | 시스템 기본 | 커스텀 글래스를 덧칠하지 않는다 |

- 새 토큰: `PrismGlassMetrics.lensCorner = 28`(히어로 렌즈 카드), 카드 최대 폭 `readableWidth = 640`(regular width에서 본문 카드의 최대 폭. 남는 양옆으로 벽이 드러난다).
- 글래스 렌즈 카드: 라이브러리 상단 "지금 진행 중" 카드. 벽이 가장 잘 비치도록 `.clear` + 큰 모서리 + 최소한의 텍스트(제목, 진행률)만 둔다.
- 스크롤 가장자리: 시스템 scroll edge effect를 쓴다. **[확인]** iOS 27 `scrollEdgeEffectStyle` 동작
- iOS 27에서 Liquid Glass API가 바뀌었는지 먼저 확인한다. **[확인]**

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

### 6.6 독서 세션 모드 (신규, 테이블탑 대응)
- 진입: 독서 상세의 "읽기 시작" 버튼.
- 기본 레이아웃: 위쪽에 표지와 경과 시간, 아래쪽에 쪽수 입력·메모·종료 버튼. 끝내면 기존 `ReadingProgressSheet` 흐름으로 세션을 저장한다.
- 테이블탑 자세: `ArrangementView`로 위·아래 영역을 접힘선 기준으로 나눈다. 다른 자세에서도 같은 컨트롤과 계층을 유지한다(Apple 가이드: 기능을 자세별로 제한하지 않는다).

## 7. 아이폰 듀오 대응

### 7.1 원칙 (Apple "Design for iPhone Duo", "Prepare your app")
- 자세별 레이아웃을 따로 만들지 않는다. compact / regular 두 size class를 기준으로 짠다.
- 크기 판단은 실제 가용 공간(`GeometryReader`, `onGeometryChange`)으로 한다. `UIScreen.main`, `UIDevice.current.orientation`, `interfaceOrientation`, `userInterfaceIdiom` 분기, 특정 높이 비교를 쓰지 않는다.
- 레이아웃 여백과 가로 safe area inset을 따른다. 바깥 화면에서는 세로 바만큼 콘텐츠가 자동으로 밀려난다.
- 배경 이미지는 전체 폭으로 깔고 스크롤되는 전경만 inset해도 된다(Apple이 예로 든 패턴). 표지 벽이 이 패턴에 해당한다.

### 7.2 접힘선과 영역
- `GeometryProxy.reservedRegions(kind: .division, options: .includeInactive)` / `UIView.reservedRegions(kind:)`로 접힘선 프레임을 얻는다. 완전히 펼치면 폭 0, 접힘 중에만 활성이다. **[확인]** 정확한 시그니처
- 상호작용 요소(글래스 카드의 버튼, 렌즈 카드 캐러셀의 탭 영역)는 활성 접힘선 위에 두지 않는다.
- 표지 벽과 스크롤 피드는 접힘선을 피하지 않는다.
- 라이브러리 2열 배치는 접힘선이 있으면(비활성 포함) 짝수 열을 고르고, 접힘선 주변 간격을 넓힌다.
- 시트·알림·메뉴·툴바 버튼은 시스템이 접힘선을 피해 준다. 커스텀 팝업을 만들지 않는다.

### 7.3 자세 감지
- `onHingeChange { old, context in … }` — `context.hinge`(경첩 없는 기기는 nil), `hinge.status`(`.partiallyOpen` 등), `hinge.angle`. **[확인]** 나머지 status 케이스 이름
- 용도: 세션 모드의 테이블탑 전환 연출, 벽 흐름 속도 미세 조정 정도로 한정한다. 레이아웃 결정은 arrangement와 reserved region API로 한다(Apple 권장).

### 7.4 연속성 (접기·펼치기)
- `AppNavigationModel`(`@Observable`, 장면 단위)에 둘 상태: 선택 탭, 기록 탭의 경로와 선택 기록 ID, 카테고리, 작성 초안, 세션 모드 진행 상태.
- 스크롤 위치는 `scrollPosition(id:)`로 기록 ID에 묶는다.
- 장면 복원: `@SceneStorage`에 탭과 선택 기록 ID를 저장한다.
- 크기 변화에 뷰 정체성(`id`)이 바뀌지 않게 한다. compact/regular 전환 시 `NavigationStack` ↔ `NavigationSplitView`가 바뀌어도 선택 상태는 모델에서 다시 그린다.

### 7.5 세로 바와 시트
- iOS 27.1 SDK에서 탭바·툴바가 세로로 바뀌는 상황을 전제로 한다. 폭이 넓은 툴바 항목(텍스트 버튼, 세그먼트)은 내비게이션 바에 남는다는 점을 고려해 툴바에는 아이콘 버튼만 둔다.
- 세그먼트 컨트롤(예: 추세선 누적/일별)은 카드 안에 둔다.
- 시트 툴바 버튼이 하나뿐인 작성 시트는 세로 바를 끄는 옵션을 검토한다. **[확인]** API 이름

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
- Xcode의 "get my app ready for iPhone Duo" 스킬 / `xcrun agent skills export` — 다른 코딩 에이전트에서도 쓸 수 있게 내보낼 수 있다.

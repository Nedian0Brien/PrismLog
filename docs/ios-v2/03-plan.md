# PrismLog iOS v2 — Plan

- 작성: 2026-10-29
- 선행 문서: [01-intent.md](./01-intent.md), [02-spec.md](./02-spec.md)
- 진행 규칙 (프로젝트 `CLAUDE.md`): 단계마다 이해한 내용을 먼저 적고 사용자 승인 → 작업 → 커밋·푸시 → 대응이 필요한 이슈는 한글로 GitHub 이슈 등록 → 후속 작업 5가지 제안.
- 각 Phase가 끝나면 이 문서의 체크박스와 "진행 기록"을 갱신한다.

## Phase 0 — 준비
- [x] 01-intent의 결정 사항 D1–D5를 사용자와 확정한다 (2026-10-29, 모두 기본값)
- [x] Xcode 27.1과 iPhone Duo 시뮬레이터가 설치돼 있는지 확인한다 (`xcodebuild -version`, `xcrun simctl list devicetypes | grep -i duo`) — 2026-11-17: `/Applications/Xcode.app` 27.2(27B52), iPhone Duo 기기 유형, iOS 27.2 런타임, 실기기 iPhone Duo(iPhone19,4) 연결 확인. `xcode-select`는 27.0 베타를 가리키므로 명령마다 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`를 붙인다
- [x] `git tag ios-v1-final` → `ios-v2` 브랜치 (`.worktree/ios-v2` 워크트리)
- [x] `docs/ios-v2/` 문서를 첫 커밋으로 올린다
- [x] `project.yml`: 배포 버전 27.1(D4), `xcodegen generate`, 기존 테스트 전체 통과를 기준선으로 기록한다 — 2026-11-17 Xcode 27.2 기준선 ([04-phase0-audit.md](./04-phase0-audit.md) §6): 단위 44개 통과(라이브 API 2개 건너뜀). UI 8개는 iPhone 17 Pro에서 모두 통과, 듀오 접힌 화면에서 7개 실패(세로 탭바를 `TabBar`로 찾지 못함, P1). 실기기 빌드·설치·실행 성공
- [x] Xcode "get my app ready for iPhone Duo" 스킬(또는 `xcrun agent skills export`)로 v1 코드를 훑어 문제 패턴 목록을 얻는다 — 2026-11-17 `xcode-select`를 27.2로 바꾼 뒤 `app-resizability` 스킬로 점검. 사전 점검 모두 통과, 공유 상태 API 0건, safe area 결함 2건(P1·P2와 같음). 새 결함 없음 (04 §6.4)
- [x] spec의 **[확인]** 항목 중 Liquid Glass·TabView 배경·reserved region·hinge API 시그니처를 Apple 문서로 확인하고 spec에 반영한다
- 완료 기준: 기준선 빌드·테스트 통과, [확인] 항목 정리 커밋 — 2026-11-17 완료. 듀오 접힌 화면 UI 실패 7건은 Phase 3에서 셸과 함께 고친다. 남은 [빌드 확인] 2건은 Phase 3(TabView 배경)과 세션 모드(테이블탑 `ArrangementView`)에서 확인한다

## Phase 1 — 표지 파이프라인
- [x] `CoverThumbnailCache` (actor): 다운로드, ImageIO 다운샘플, 디스크 + `NSCache`, 동시 4개, 실패 URL 기록 — `ios/PrismLog/Library/CoverThumbnailCache.swift`. 디스크 형식은 HEIC 대신 JPEG다(spec §4.2, 시뮬레이터 HEVC 코덱 멈춤)
- [x] `GeneratedCover`: 카테고리 톤 + 제목 타이포 → `ImageRenderer` 래스터화 → 같은 캐시 — `ios/PrismLog/Library/GeneratedCover.swift`
- [x] `CoverImage`를 캐시 기반으로 교체 (목록·상세 회귀 확인) — 호출하는 13곳에 `title:`을 넘긴다
- [x] 단위 테스트: 캐시 키, 실패 대체, 생성 표지 — `PrismLogTests/CoverPipelineTests.swift` 16개(디스크 쓰기가 멈춰도 표지가 나오는 회귀 테스트 포함)
- 완료 기준: 실데이터로 모든 기록의 표지(또는 생성 표지)가 캐시에서 즉시 나온다 — 2026-11-18 완료. iPhone 17 Pro 시뮬레이터에서 빈 캐시로 UI 테스트 8개가 모두 통과했고(156초), 표지 47개가 JPEG로 캐시됐다. 실데이터는 모든 기록에 표지가 있어서 생성 표지는 렌더링 결과물로 확인했다

## Phase 2 — 표지 벽 시제품 (A·B 비교)
- [x] `LibraryWallModel`: 표지 목록 구성(엔티티 중복 제거, 반복·섞기), 맥락 모드, 단일 흐름 시계, 정지 조건 — `Library/LibraryWallModel.swift`, `Library/WallComposition.swift`
- [x] `LibraryWallView`: 배치 A(가로 행) / B(−12° 모자이크), 패럴랙스 입력 — 행과 칸을 가상화해서 화면에 보이는 표지만 뷰로 만든다
- [x] `WallLegibilityLayer`와 최악 조건 픽스처 — `Library/WallLegibilityLayer.swift`, `Library/WallFixtures.swift`(Debug)
- [x] 디버그 샌드박스 화면: 벽 + 글래스 카드 샘플(.regular/.clear, 텍스트 많음/적음) + 배치·속도·디밍 슬라이더 — 설정 탭의 "표지 벽 실험실"(Debug 빌드). 실행 인자로 바로 열 수 있다: `-WallLab YES -WallLabLayout rows|mosaic -WallLabSource library|worstCase|synthetic30|synthetic200 -WallLabHideControls YES -WallLabDimming 0.7`
- [x] 실기기에서 A와 B를 녹화해 사용자에게 보여 주고 D2를 확정한다 — 2026-11-18 사용자 지시로 시뮬레이터에서 진행. 듀오 시뮬레이터 녹화(`docs/ios-v2/screens/phase2-wall-A-vs-B.mp4`)를 보고 사용자가 **A(가로 행)**로 확정했다
- [x] 성능 측정: 표지 30/200장에서 hitch, 메모리 — 시뮬레이터 참고값(아래). 실기기 Instruments는 Xcode 27.2와 iOS 27.3 기기 조합에서 화면·hitch·Time Profiler 데이터가 비어 와서, 실험실에 `WallFrameMeter`(CADisplayLink 기반 hitch 측정, 콘솔 `[WallMeter]` 출력)를 넣었다
- 완료 기준: D2 확정, 성능 예산 충족, 굴절이 스크린샷에서 식별됨 — 2026-11-18 완료. 성능은 시뮬레이터 참고값으로 예산 안이다. 실기기 120Hz hitch는 Xcode가 iOS 27.3을 지원할 때 다시 잰다. 가독성 미달은 이슈 #19로 Phase 3에서 처리한다

### Phase 2 측정 (2026-11-18, 듀오 시뮬레이터, 표지 256px, 참고값)
| 배치 | 표지 | hitch | fps | 벽 디코딩 메모리 | 앱 전체 메모리 | CPU(호스트) |
|---|---|---|---|---|---|---|
| A 가로 행 | 30 | 0.00 ms/s | 60 | 5.0MB | 46.9MB | 9–10% |
| A 가로 행 | 200 | 0.00 ms/s | 60 | 33.4MB | 56.8MB | 11% |
| B 모자이크 | 30 | 0.00 ms/s | 60 | 5.0MB | 48.0MB | 13–14% |
| B 모자이크 | 200 | 0.00 ms/s | 60 | 33.4MB | 57.8MB | 15–16% |
- 실기기(최적화 빌드, 표지 30장, 가로 행)의 Activity Monitor 값: 앱 메모리 62MB, CPU 22–30%. 실기기 hitch는 측정하지 못했다.
- 표지를 512px로 디코딩하면 200장에 약 134MB가 들어 예산 80MB를 넘는다. 그래서 벽은 256px로 디코딩한다(spec §4.2 갱신).

### Phase 2 발견: 가독성 (최악 조건 픽스처, 흰 표지 10장)
| 디밍 | `.regular` 본문 대비 | `.clear` 본문 대비 | 보조 글자색(`#A09890`) 대비 |
|---|---|---|---|
| spec 기본 0.30→0.55 | 3.90:1 | 1.77:1 | 1.55:1 |
| 0.55 고정 | 4.78:1 | 3.17:1 | 1.90:1 |
| 0.65 고정 | 5.82:1 | 4.37:1 | 2.32:1 |
| 0.75 고정 | 7.35:1 | 6.19:1 | 2.93:1 |
- spec의 기본 디밍으로는 성공 기준 3(본문 4.5:1)을 넘지 못한다. 본문은 `.regular`에서 디밍 0.55 이상, `.clear`에서 0.7 이상이 필요하다.
- 보조 글자색은 어떤 디밍에서도 4.5:1에 못 미친다. Phase 3 글래스 v2에서 글래스 위 보조 글자색을 바꾼다.
- 스크린샷: `docs/ios-v2/screens/phase2-wall-worst-case.jpg`

## Phase 3 — 글래스 v2와 앱 셸
- [x] `PrismGlass` v2 토큰·수식어 (spec §5) — `lensCorner = 28`, `readableWidth = 640`, `prismLensCard()`. 이슈 #19에 따라 벽 기본 디밍을 0.55 → 0.70으로 올렸다
- [x] `AppNavigationModel` + `@SceneStorage` 연결 — 탭, 기록 탭의 선반, 탭별 경로, 작성 요청, 탭별 스크롤 오프셋, 타임라인 기간. 장면 복원은 탭·선반·기록 탭 맨 위 기록
- [x] `AppShell`: TabView(4탭, `sidebarAdaptable`), 루트 벽 배치(또는 대안), 툴바 `+` 작성 메뉴와 모핑 — **[빌드 확인] 결과: TabView가 루트에 깐 벽 위에 불투명 배경을 칠한다.** 그래서 대안(각 화면이 공유 `LibraryWallModel`로 벽을 그림, `prismWallBackground()`)을 썼다. 작성은 시스템 툴바 `Menu`(`topBarPinnedTrailing`)로 바꿨다. 툴바 메뉴는 시스템이 글래스 모핑과 접힘선 회피, 세로 바 이동을 맡는다
- [x] `PrismScreenScaffold` 재작성: 고정 여백(`bottom 78`, `bottom 130`) 제거, 스크롤 오프셋 → 벽 패럴랙스 — FAB(`PrismComposerButton`)와 스크림을 지웠다(P1·P5). 시트 툴바의 제목만 있는 버튼 18곳에 아이콘을 붙였다(P3)
- [x] 코드 전체에서 `UIScreen.main`, 방향·idiom 분기, 고정 크기 비교를 찾아 없앤다 — Phase 0 점검대로 0건
- 완료 기준: 4탭 빈 화면이 compact·regular·듀오 바깥 화면(세로 바)에서 깨지지 않고, 작성 메뉴가 기존 시트를 연다 — UI 테스트 8개가 iPhone 17 Pro와 듀오 접힌 화면에서 모두 통과(이슈 #18 해결). UI 테스트 경고 171건 → 0건

## Phase 4 — 라이브러리(홈)
- [x] 렌즈 카드 캐러셀(지금 진행 중) — `LibraryMetrics.inProgress`: 읽는 중인 책, "시청 중" 시리즈, "플레이 중" 게임, 0–100% 사이 공부. 렌즈 카드는 `.clear` 글래스에 큰 글씨만 둔다(이슈 #19)
- [x] 스펙트럼 요약, 통계 카드 이전(추세·분포·히트맵), 최근 기록 — 스펙트럼 카드에 연속 기록일을 넣었다
- [x] regular width 2열 + 접힘선 대응(짝수 열, 간격) — `FoldAwareColumns`: 비활성 포함 division 영역이 있으면 두 열이 접힘선 양쪽에 놓이고 간격이 접힘선을 덮는다
- [ ] main 머지 여부를 사용자와 결정한다 (D5) — 사용자 지시로 모든 Phase를 마친 뒤 최종 보고에서 묻는다
- 탭 이름을 "라이브러리"로 바꿨다(spec §3)

## Phase 5 — 기록
- [x] compact: 허브 → 목록 → 상세 (`NavigationStack`)
- [x] regular: `NavigationSplitView` (사이드바 카테고리+목록 / 상세) — 사이드바는 compact와 같은 허브·선반 화면이고, 고른 기록은 상세 열에 열린다
- [x] 벽 맥락 연동: 카테고리 → `category`, 상세 → `hero` + 표지 zoom 전환 — 상세는 모든 탭에서 `hero`. compact 목록 카드에서 상세로 `zoom` 전환
- [x] 상세 섹션과 편집 시트 전부 이전, 기존 테스트 통과
- 완료 기준: v1의 기록 기능 전부 동작, compact↔regular 전환에서 선택 유지 — 선반과 선택 기록을 `AppNavigationModel`이 들고 있어서 두 구조가 같은 상태를 그린다

## Phase 6 — 타임라인·설정·작성
- [x] 타임라인: 한 열 640pt, `period` 맥락 — 화면에 보이는 날짜 블록을 모으고, 스크롤이 0.6초 멈추면 그 기간에 기록된 표지로 벽을 바꾼다
- [x] 설정: 표시 옵션(배치·흐름·밝기), 디버그 섹션 — 흐름 켜기/끄기와 밝기 3단계(기본·어둡게·더 어둡게, 모두 본문 4.5:1 이상). 배치는 D2에서 A로 정해서 옵션에서 뺐다. 디버그: 표지 벽 실험실(0/5/30/200장, 최악 조건), 표지 캐시 비우기
- [x] 작성 초안을 모델로 옮겨 접기·펼치기에도 유지 — 작성 시트는 TabView 바깥의 셸이 띄워서 접고 펼쳐도 다시 만들어지지 않는다. 다시 만들어지는 화면(독서 세션)의 상태는 모델로 옮겼다. 시뮬레이터에 글자를 입력할 수 없어서(맥에서 붙여넣기를 받지 않음) 작성 시트 입력 유지는 실기기에서 확인한다
- 완료 기준: v1 기능 패리티 체크리스트(아래) 전부 통과

## Phase 7 — 듀오 다듬기
- [x] reserved region으로 상호작용 요소 배치 점검 — 라이브러리 2열(`FoldAwareColumns`)과 기록 분할 화면 사이드바 폭이 division 영역을 읽는다. 렌즈 카드 캐러셀이 세로 바와 오른쪽 열 아래로 넘치던 문제를 고쳤다(캐러셀 전용 `GlassEffectContainer`)
- [x] 독서 세션 모드 + 테이블탑 `ArrangementView`, `onHingeChange` 연출 — 독서 상세 메뉴 "읽기 시작". 테이블탑은 위·아래, 책 자세는 좌우로 나뉜다. `onHingeChange`로 일부 펼침일 때 표지를 줄이고 시계를 키운다. 끝내면 `ReadingProgressSheet`로 저장
- [x] 듀오 매트릭스 테스트(spec §10)와 스크린샷 `docs/ios-v2/screens/` — 아래 표
- 완료 기준: 매트릭스 전 항목 통과

### Phase 7 듀오 매트릭스 (2026-11-18, iPhone Duo 시뮬레이터 iOS 27.2)
| 자세 | 확인한 것 | 결과 |
|---|---|---|
| 접힘(바깥 화면) | 4탭, 세로 바, 툴바 `+` 작성 메뉴, UI 테스트 8개 | 통과 |
| 펼침 | 라이브러리 2열이 접힘선 양쪽에 놓임, 기록 분할 화면, 상세 `hero` 벽 | 통과. 사이드바가 접힘선보다 약 40pt 좁다(시스템 제한, 실기기 확인 필요) |
| 책 자세(130°) | 분할 화면 경계가 접힘선에 맞음, 세션 모드 좌우 분할 | 통과 |
| 테이블탑(130°, 회전) | 세션 모드 위·아래 분할, 컨트롤 전부 표시 | 통과 |
| 접기↔펼치기 | 선택 탭·선반·선택 기록 유지, 뒤로 가기, 세션 시계 이어짐 | 통과 |
| 장면 복원 | 앱을 다시 열면 탭·선반·기록이 돌아옴 | 통과 |
- 스크린샷: `phase7-open-library.jpg`, `phase7-open-records-split.jpg`, `phase7-open-records-detail.jpg`, `phase7-book-session.jpg`, `phase7-tabletop-session.jpg`
- 이 Phase에서 찾아 고친 결함: 캐러셀이 세로 바 아래로 넘침, 펼침→접힘 뒤 뒤로 가기 사라짐, 접고 펼칠 때 상세의 시트·세션이 닫힘(분할 화면 하나로 통일), 세션 상태 초기화(모델로 이동), 책 자세에서 세션 컨트롤 사라짐(두 축 분할)

## Phase 8 — 마감
- [x] 접근성 점검(투명도·동작 줄이기, AX5, VoiceOver)
  - AX5: 라이브러리에서 스펙트럼 카드 글자가 한 글자씩 줄바꿈되고 렌즈 카드 제목이 잘리던 것을 고쳤다. 접근성 크기에서는 스펙트럼 카드를 세로로 쌓고, 렌즈 카드 높이를 글자에 맞추고, regular에서도 한 열로 보인다. 링 가운데 "전체 기록" 라벨은 여전히 줄여 표시된다(v1 컴포넌트). 스크린샷 `phase8-ax5-library-*.jpg`
  - 투명도·동작 줄이기: 시뮬레이터 `simctl`로 켤 수 없어서 화면으로는 확인하지 않았다. 벽 정지 조건은 단위 테스트(`anyPauseReasonStopsTheWall`)가, 디밍 0.75는 `WallLegibilityLayer` 코드가 다룬다
  - VoiceOver: 표지 벽은 `accessibilityHidden(true)`, 렌즈 카드는 "제목, 카테고리, 진행"을 한 요소로 읽는다
- [ ] 실기기 성능 재측정 — 사용자 지시로 시뮬레이터에서 진행해서 하지 않았다(이슈 #20)
- [x] 위젯 회귀 확인, README의 iOS 섹션 갱신 — 위젯 코드와 공유 파일(`PrismPalette`, `Shared/`)은 `ios-v1-final` 이후 바뀌지 않았고 앱과 함께 빌드된다. README에 iOS 섹션을 넣었다
- [ ] (선택) App Store Connect 듀오 스크린샷 준비 — 하지 않았다

## 배경 재설계 (Phase 8 이후, 사용자 요청)
- [-] A(기록 스펙트럼 빛)·B(분광 띠)·C(맥락 분리) 시제품 — 사용자가 셋 다 반려
- [x] 방향 1 표지 히어로(`.featured`), 방향 2 스펙트럼 빛(`.spectrum`) 구현, 설정(Debug)과 실험실에서 전환
- [x] 포인트 색을 OKLCH 스펙트럼 팔레트로 교체, `textMuted` 상향
- [x] 최악 조건 대비 측정 후 기본 디밍 조정(spec §4.8)
- [-] 사용자가 두 방향 모두 반려. 포인트 색 교체까지 커밋 전체를 되돌려 표지 벽·기존 색으로 복귀(spec §4.8–4.9 삭제)

## v1 기능 패리티 체크리스트
- [ ] 동기화: 당겨서 새로고침, 앱 활성화 시 동기화, 오프라인 쓰기·삭제, 대기 건수 표시
- [ ] 독서: 검색으로 추가(ISBN/도서 검색), 진행 기록(쪽수·시간·메모·사진), 필사 노트, 편집·삭제, 추세
- [ ] 공부: 추가, 목차, 활동(+ 기록), 진행 시트, 상태·추세
- [ ] 영화·시리즈·게임: 검색으로 추가, 시리즈 에피소드 진행·토스트, 게임 세션·달력, 포스터 채우기 진행률
- [ ] 대시보드: 스펙트럼 링, 추세선(누적/기간), 분포, 히트맵, 최근 기록
- [ ] 타임라인: 세션 단위 묶음, 에피소드 스틸, 플레이타임 도넛
- [ ] 위젯: 스펙트럼 스냅샷
- [ ] 저장 시 굴절 펄스

## 진행 기록
| 날짜 | Phase | 내용 | 커밋 |
|---|---|---|---|
| 2026-10-29 | — | intent·spec·plan 초안 작성 (클라우드 세션) | d79840c |
| 2026-10-29 | 0 | D1–D5 기본값 확정, `ios-v1-final` 태그, Apple 문서로 [확인] 항목 정리, v1 문제 패턴 점검, Xcode 27.0 기준선 기록. Xcode 27.1 미설치로 D4 조정·듀오 검증 보류 | 4b82e81 |
| 2026-11-17 | 0 | Xcode 27.2로 배포 버전 27.1 조정, 듀오 시뮬레이터·iPhone 17 Pro 기준선 측정, 실기기 설치·실행, SDK 선언으로 [빌드 확인] 2건 확정. 펼친 화면 확인은 남음 | 23bc982 |
| 2026-11-17 | 0 | `app-resizability` 스킬(Xcode 27.2)로 v1 재점검. 새 결함 없음 | d4adcc4 |
| 2026-11-17 | 0 | 듀오 시뮬레이터 접힘·반쯤 펼침·펼침 화면 확인. Phase 0 완료 | 9913696 |
| 2026-11-18 | 1 | 표지 캐시, 생성 표지, `CoverImage` 교체, 단위 테스트 16개. HEIC 대신 JPEG 디스크 캐시. Phase 1 완료 | 1b33218 |
| 2026-11-18 | 2 | 표지 벽 모델·배치 A/B·가독성 층·실험실·프레임 측정, 단위 테스트. 시뮬레이터 측정과 가독성 수치 기록 | 5f2a9be |
| 2026-11-18 | 2 | D2를 A(가로 행)로 확정. Phase 2 완료 | (이 커밋) |
| 2026-11-18 | 8+ | 배경 방식 두 갈래(표지 히어로·스펙트럼 빛), OKLCH 포인트 색, 표지 팔레트 추출, 대비 측정·디밍 조정 | 220564f |
| 2026-11-18 | 8+ | 사용자 반려로 220564f 전체 되돌림. 표지 벽·기존 포인트 색 복귀 | (이 커밋) |

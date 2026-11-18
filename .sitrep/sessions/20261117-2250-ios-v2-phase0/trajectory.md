# Trajectory: PrismLog iOS v2 Phase 0 준비

## 2026-11-17

### ~22:50 · 이어받음 · docs/ios-v2/04-phase0-audit.md
- 2026-10-29 Phase 0 기록을 이어받음. Xcode 27.1 설치 대기 상태

### ~22:55 · T3 완료 · Xcode 27.2와 듀오 환경 확인
- `/Applications/Xcode.app` 27.2 (27B52), iPhone Duo 기기 유형, iOS 27.1·27.2 런타임
- `xcode-select`는 27.0 베타 유지. `DEVELOPER_DIR`로 27.2 지정

### ~23:00 · T8 발견 · 스킬 내보내기에 듀오 스킬 없음
- `xcrun agent skills export --output-dir ~/.claude/skills` 실행(사용자 승인). 27.0 스킬 7개만 나옴

### ~23:00 · T4 완료 · 배포 버전 27.1
- `ios/project.yml`, `ios/PrismLog.xcodeproj/project.pbxproj` 각 2줄

### 23:03 · T5.4 완료 · 실기기 빌드·설치·실행 성공
- 경고 0건. 실기기는 다른 앱 사용 중이라 화면 확인 생략

### 23:04 · T5.1·T5.3 완료 · 듀오 시뮬레이터 테스트
- 단위 44개 중 42 통과, 2 건너뜀. UI 8개 중 7개 실패: `TabBar` 요소 없음
- 스크린샷: 접힌 화면에서 탭바가 오른쪽 세로 바, FAB가 차트 위에 겹침 (P1)

### ~23:10 · T5.2 완료 · iPhone 17 Pro UI 테스트 8/8 통과
- 듀오 실패 원인이 세로 탭바임을 확정

### ~23:10 · T6 완료 · SDK 선언 확인
- `ScrollEdgeEffectStyle` 값 3개, `.tabView` iOS unavailable, `onHingeChange` 인자 순서, `ToolbarVerticalBehavior` 값 2개를 `02-spec.md`에 반영

### 23:15 · 보고 · 구현 중 80%
- 기준선 확보, 듀오 접힌 화면 UI 실패 7건은 Phase 3 셸 변경에서 해결
- D1 듀오 스킬 확보 방법 결정 요청 (권장 A)

### ~23:20 · T9 완료 · 커밋 23bc982 푸시, 이슈 #17 댓글

### ~23:25 · D1 결정 · A (`xcode-select` 전환)
- 결정: 사용자. 사용자가 `sudo xcode-select -s /Applications/Xcode.app`과 스킬 내보내기를 직접 실행
- `xcode-select -p` → `/Applications/Xcode.app/Contents/Developer` (27.2) 확인

### 23:22 · T8 완료 · `app-resizability` 스킬 점검
- 사전 점검 3개 통과, 공유 상태 API 0건, 장면 수명 주기 이미 적용
- safe area 결함 2건: `RootView.swift:55` `bottom 78`, `PrismScreenScaffold.swift:68`·`RecordDetailScreen.swift:89` `bottom 130` (P1·P2와 같음). 새 결함 없음
- `04-phase0-audit.md` §6.4, `03-plan.md` 갱신

### 23:22 · 보고 · 구현 중 90%
- 남은 일: 듀오 펼친 화면·반쯤 펼친 자세 확인(시뮬레이터 패널 권한 또는 실기기 필요)

### 23:22 · T8 완료 · 커밋 d4adcc4 푸시, 이슈 #17 댓글

### 23:24 · T7 완료 · 듀오 시뮬레이터 자세별 확인
- 사용자가 시뮬레이터 패널 접근 허용
- 반쯤 펼침(130°)·펼침: 안쪽 951×669pt 가로, 세로 바 유지, 카드가 약 880pt로 늘어나 접힘선을 가로지름 (spec §5 readableWidth 근거)
- FAB가 기록 허브 최근 제목을 가림 (P1). 펼침→접힘 후 기록 탭 유지
- 경첩을 처음 자세(접힘)로 복원

### 23:24 · 보고 · 완료됨 100%
- Phase 0 완료. 이슈 #17 닫음, UI 테스트 듀오 대응 이슈 #18 등록

### 23:28 · 범위 확장 · Phase 1 시작 (사용자 승인)
- 전체 작업 제목을 "PrismLog iOS v2 Phase 0–1"로 넓힘

### ~23:45 · T10.1–T10.3 완료 · 표지 파이프라인 구현
- `ios/PrismLog/Library/CoverThumbnailCache.swift`, `GeneratedCover.swift` 신규, `CoverImage.swift` 교체, 호출 13곳 `title:` 전달
- 빌드 경고 0건 (앱·단위 테스트)

### ~23:50 · T10.2 발견 · 흰 글자가 밝은 톤에서 읽히지 않음
- 렌더링 결과 확인: 흰 글자가 공부 노랑에서 약 1.6:1
- 흰색과 `PrismColor.background` 중 WCAG 대비가 큰 쪽을 고르도록 변경. 생성 표지 캐시 키에 디자인 버전 추가

### 23:34 · T10.4–T10.5 완료 · 테스트와 실데이터 확인
- 단위 59개 중 57 통과, 2 건너뜀. 신규 `CoverPipelineTests` 15개 통과
- 듀오 시뮬레이터: 표지 15장 HEIC 341×512, 합계 544KB. 실데이터는 모든 기록에 표지가 있어 생성 표지는 렌더링 결과물로 확인

### 23:34 · 보고 · 완료됨 100%
- Phase 1 완료

## 2026-11-18

### ~23:45 · T10.5 막힘 · iPhone UI 테스트 8개 중 다수가 앱 유휴 대기로 실패
- 테스트 하나당 140–210초, "App event loop idle notification not received"
- 앞의 23:5x "보고 · 완료됨" 항목은 이 회귀를 확인하기 전에 쓴 것이다

### ~00:05 · T10.1 발견 · HEVC 코덱 멈춤
- `sample`로 확인: iOS 27.2 일반 시뮬레이터 런타임에서 HEIC 인코딩(VideoToolbox)과 디코딩이 돌아오지 않음. 표지 읽기가 Swift 협력 스레드 14개를 모두 붙잡아 비동기 작업 전체가 멈춤
- 수정 1: 표지를 메모리에 올리면 바로 반환하고, 디스크 쓰기는 전용 직렬 큐로 옮김
- 수정 2: 디스크 형식을 JPEG(품질 0.85, `.jpg`)로 변경. 장당 약 57KB로 HEIC의 1.6배
- 회귀 테스트 추가: 디스크 큐가 막혀도 표지 반환, 디스크 파일이 JPEG

### 00:07 · T10.5 완료 · 회귀 해소
- 단위 60개 중 58 통과, 2 건너뜀. iPhone 17 Pro UI 8/8 통과(156초, 유휴 대기 실패 0), 표지 47개 JPEG 캐시

### 00:07 · 보고 · 완료됨 100%
- Phase 1 완료

### ~08:55 · 범위 확장 · Phase 2 시작 (사용자 승인)
- 전체 작업 제목을 "PrismLog iOS v2 Phase 0–2"로 넓힘

### ~09:05 · T11.1–T11.4 완료 · 표지 벽 구현
- `Library/WallComposition.swift`, `LibraryWallModel.swift`, `LibraryWallView.swift`, `WallLegibilityLayer.swift`, `WallFixtures.swift`, `WallFrameMeter.swift`, `Features/Settings/WallLabScreen.swift`
- `LibraryWallTests` 12개 통과

### ~09:10 · T11.5 발견 · 최악 조건 대비 미달
- spec 기본 디밍(0.30→0.55)에서 `.regular` 본문 3.90:1, 보조 글자색 1.55:1. 디밍 0.55 고정 시 본문 4.78:1

### ~09:20 · T11.6 막힘 · 실기기 Instruments 데이터 없음
- Xcode 27.2 + iOS 27.3 기기: Animation Hitches·Time Profiler 데이터 비어 옴. Activity Monitor만 기록(메모리 62MB, CPU 22–30%)
- 대안으로 `WallFrameMeter` 추가

### 21:24 · T11.6 폐기 · 사용자 지시로 시뮬레이터에서 진행
- 시뮬레이터 측정: 모든 조합 hitch 0ms/s·60fps, 200장 벽 33.4MB, 앱 57MB

### 21:24 · 보고 · 구현 중 90%
- D2 결정 요청 (권장 A). 녹화 `docs/ios-v2/screens/phase2-wall-A-vs-B.mp4`

### 21:29 · D2 결정 · A 가로 행
- 결정: 사용자. B는 Debug 실험실에 비교용으로만 남김
- intent D2, spec §4.3·§4.4, 03-plan Phase 2 갱신

### ~09:45 · 범위 확장 · 사용자 지시 "모든 Phase 완료하고 나서 보고"
- 중간 결정은 권장안으로 진행하고 근거를 문서에 남긴다. D5(main 머지)는 최종 보고에서 묻는다

### ~10:00 · T12 발견 · TabView가 루트 벽을 가림
- 듀오 시뮬레이터 스크린샷으로 확인. spec §4.6 대안(화면별 `prismWallBackground()`, 공유 모델)으로 전환

### ~10:20 · T12 완료 · Phase 3 테스트
- 단위 70 통과·2 건너뜀, UI iPhone 8/8, UI 듀오 접힌 화면 8/8(이슈 #18 해결), 경고 0

### 21:47 · T13–T14 완료, T15 진행 · Phase 4–6 테스트
- 단위 81개 중 79 통과·2 건너뜀, UI iPhone 8/8, 듀오 8/8

### ~10:40 · T16 발견 · 듀오 매트릭스에서 결함 5건
- 렌즈 캐러셀이 세로 바·오른쪽 열 아래로 넘침 → 캐러셀 전용 GlassEffectContainer
- 펼침→접힘 뒤 기록 상세에 뒤로 가기 없음 → 접힐 때 사이드바를 거쳐 상세를 다시 올림
- 접고 펼칠 때 상세의 시트·세션이 닫힘 → 기록 탭을 NavigationSplitView 하나로 통일(목록→상세 zoom 포기)
- 세션 시계·입력 초기화 → AppNavigationModel.readingSession
- 책 자세에서 세션 컨트롤 사라짐 → ArrangementView 두 축 분할

### ~11:00 · T16 발견 · UI 테스트 2건 실패 원인
- 장면 복원이 앞 테스트의 탭·기록을 되살림 → `-ApplePersistenceIgnoreState YES`
- 듀오 안쪽 화면에서 정규화 좌표 탭이 앱 위치와 어긋남 → 제목 요소를 탭

### 22:26 · T16 완료 · Phase 7 테스트
- 단위 83개 중 81 통과·2 건너뜀, UI iPhone 8/8, 듀오(펼침) 8/8, 경고 0

### ~11:25 · T17 발견 · AX5에서 라이브러리 깨짐
- 스펙트럼 카드 글자가 한 글자씩 줄바꿈, 렌즈 카드 제목 잘림 → 접근성 크기에서 세로 배치·높이 가변·한 열

### ~11:30 · 결정 요청 → 사용자 지시 · 배경 방향 재검토
- 사용자 피드백: 포스터 이동과 굴절이 겹쳐 산만하고, 다채로운 빛이라는 기존 컨셉과 맞지 않음
- A(기록 스펙트럼 빛)·B(분광 띠)·C(맥락 분리)를 제안, 사용자가 셋 다 시제품으로 비교하라고 지시

### 22:33 · T17 완료 · Phase 8 테스트
- 단위 83개 중 81 통과·2 건너뜀, UI iPhone 8/8, 듀오 8/8. 이슈 #20 등록

### ~22:40 · T19 폐기 · A·B·C 시제품
- 사용자가 세 안 모두 반려. 대안으로 두 방향(표지 사용 방식 개선, Apple Music식 빛)과 포인트 색 교체를 지시함

### 22:55 · T20 완료 · 두 방향 구현과 측정
- `WallBackgroundStyles.swift`(`WallStyle`, `FeaturedCoverBackdrop`, `SpectrumMeshLight`, `WallGrain`), `CoverPalette.swift` 추가
- `PrismPalette` 포인트 색을 OKLCH L 0.68·C 0.12로 통일, `textMuted` #C1BDB5
- 최악 조건 대비: 표지 히어로 상단 clear 카드 2.9:1 → 디밍 위 0.56으로 5.0:1. 스펙트럼 빛 위 0.20으로 5.1:1
- 단위 83개 중 81 통과·2 건너뜀, UI iPhone 8/8, 듀오 8/8, 경고 0

### 22:55 · 보고 · D6 결정 요청
- 구현 중 95%. 두 방향을 같은 앱에 넣고 `wall.style`로 전환. 기본값은 표지 벽 유지
- D6 배경 방향 결정 요청, 권장 스펙트럼 빛

### ~23:00 · T20 폐기 · 두 방향 모두 반려
- 사용자가 비교 영상 녹화 도중 둘 다 반려하고 커밋 전체 되돌리기를 선택(사용자 결정)
- `git revert 220564f`: 표지 히어로·스펙트럼 빛·`CoverPalette`·OKLCH 포인트 색·`textMuted` 상향 모두 제거. 앱 코드는 192ebf6과 같음
- 이슈 #19(보조 글자 대비)는 다시 열린 상태

### ~23:15 · T21 시작 · 글래스 재질 통일
- 사용자 지적: 렌즈 카드(clear)만 테두리가 굴절되고 나머지(regular)는 안 됨. 규칙안(A)과 화면 clear 통일안(B)을 제시했으나 사용자가 "다 clear"를 지시함(사용자 결정)

### ~23:30 · T21 발견 · clear만 쓰면 상세 화면 글자가 사라짐
- 흰 표지 히어로 배경 위에서 본문 2.2–2.5:1, 보조 1.0–1.2:1
- `Glass.prism` 토큰에 HIG 권장 35% 검정 tint를 넣어 본문 4.7–4.8:1, 보조 1.9:1
- 단위 83 + UI 8 = 91개 중 89 통과·2 건너뜀(듀오 펼침), 경고 0

### ~23:45 · T22 완료 · 벽 가장자리 점진 블러
- `WallEdgeBlur.swift` 추가: 벽을 반경 6·16·32로 다시 그려 가장자리 그라디언트 마스크로 겹침
- 실험실 합성 200장: 정상 상태 hitch 0.0ms/s, 60fps (실행 직후 디코딩 구간은 204ms/s)

### ~23:50 · T22 발견 · 네 변 블러 반려
- 사용자: 네 변 모두 흐리니 이상함 → 위·아래만 흐리도록 변경, 반경 6·16·32를 높이의 30·21·12%에 적용

### ~23:55 · T23 발견 · 페이드 마스크가 글래스에 안 먹음
- 캐러셀에 가장자리 페이드 `mask`를 걸었으나 글래스는 마스크를 무시하고 표지만 영역 밖으로 나옴 → 폐기
- 해결: 카드 폭 = 열 폭(`containerRelativeFrame`), 간격 26pt, 화면 여백까지 넓혀 `clipped()`, `scrollTransition`으로 넘어가는 카드 흐림·축소
- 단위·UI 91개 중 89 통과·2 건너뜀(듀오 접힘), 경고 0

### ~00:05 · T22 폐기·대체 · 직접 만든 블러 → 시스템 스크롤 가장자리 효과
- 사용자: 블러가 고급스럽지 않음. Apple 기본 제공 확인 요청 → 공개 가변 블러 API 없음, `scrollEdgeEffectStyle`만 있음(사용자 선택)
- `WallEdgeBlur.swift` 삭제, `PrismScreenScaffold`에 `.scrollEdgeEffectStyle(.soft, for: [.top, .bottom])`
- iPhone: 위 바·아래 탭 바 구간에서 콘텐츠와 벽이 함께 흐려짐 확인. 듀오 접힘: 위·아래 바가 없어 효과 없음
- `toolbarBackgroundVisibility(.hidden)` 유무는 효과에 영향 없음(iPhone에서 비교)
- 단위·UI 91개 중 89 통과·2 건너뜀, 경고 0

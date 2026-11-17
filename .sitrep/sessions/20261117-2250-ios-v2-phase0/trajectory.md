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

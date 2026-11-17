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
- 완료 기준: 기준선 빌드·테스트 통과, [확인] 항목 정리 커밋

## Phase 1 — 표지 파이프라인
- [ ] `CoverThumbnailCache` (actor): 다운로드, ImageIO 다운샘플, 디스크 HEIC + `NSCache`, 동시 4개, 실패 URL 기록
- [ ] `GeneratedCover`: 카테고리 톤 + 제목 타이포 → `ImageRenderer` 래스터화 → 같은 캐시
- [ ] `CoverImage`를 캐시 기반으로 교체 (목록·상세 회귀 확인)
- [ ] 단위 테스트: 캐시 키, 실패 대체, 생성 표지
- 완료 기준: 실데이터로 모든 기록의 표지(또는 생성 표지)가 캐시에서 즉시 나온다

## Phase 2 — 표지 벽 시제품 (A·B 비교)
- [ ] `LibraryWallModel`: 표지 목록 구성(엔티티 중복 제거, 반복·섞기), 맥락 모드, 단일 흐름 시계, 정지 조건
- [ ] `LibraryWallView`: 배치 A(가로 행) / B(−12° 모자이크), 패럴랙스 입력
- [ ] `WallLegibilityLayer`와 최악 조건 픽스처
- [ ] 디버그 샌드박스 화면: 벽 + 글래스 카드 샘플(.regular/.clear, 텍스트 많음/적음) + 배치·속도·디밍 슬라이더
- [ ] 실기기에서 A와 B를 녹화해 사용자에게 보여 주고 D2를 확정한다
- [ ] 성능 측정(Instruments): 표지 30/200장에서 hitch, 메모리
- 완료 기준: D2 확정, 성능 예산 충족, 굴절이 스크린샷에서 식별됨

## Phase 3 — 글래스 v2와 앱 셸
- [ ] `PrismGlass` v2 토큰·수식어 (spec §5)
- [ ] `AppNavigationModel` + `@SceneStorage` 연결
- [ ] `AppShell`: TabView(4탭, `sidebarAdaptable`), 루트 벽 배치(또는 대안), 툴바 `+` 작성 메뉴와 모핑
- [ ] `PrismScreenScaffold` 재작성: 고정 여백(`bottom 78`, `bottom 130`) 제거, 스크롤 오프셋 → 벽 패럴랙스
- [ ] 코드 전체에서 `UIScreen.main`, 방향·idiom 분기, 고정 크기 비교를 찾아 없앤다
- 완료 기준: 4탭 빈 화면이 compact·regular·듀오 바깥 화면(세로 바)에서 깨지지 않고, 작성 메뉴가 기존 시트를 연다

## Phase 4 — 라이브러리(홈)
- [ ] 렌즈 카드 캐러셀(지금 진행 중)
- [ ] 스펙트럼 요약, 통계 카드 이전(추세·분포·히트맵), 최근 기록
- [ ] regular width 2열 + 접힘선 대응(짝수 열, 간격)
- [ ] main 머지 여부를 사용자와 결정한다 (D5)
- 완료 기준: 홈이 spec §6.1을 만족, 대비·성능 기준 통과

## Phase 5 — 기록
- [ ] compact: 허브 → 목록 → 상세 (`NavigationStack`)
- [ ] regular: `NavigationSplitView` (사이드바 카테고리+목록 / 상세)
- [ ] 벽 맥락 연동: 카테고리 → `category`, 상세 → `hero` + 표지 zoom 전환
- [ ] 상세 섹션과 편집 시트 전부 이전, 기존 테스트 통과
- 완료 기준: v1의 기록 기능 전부 동작, compact↔regular 전환에서 선택 유지

## Phase 6 — 타임라인·설정·작성
- [ ] 타임라인: 한 열 640pt, `period` 맥락
- [ ] 설정: 표시 옵션(배치·흐름·밝기), 디버그 섹션
- [ ] 작성 초안을 모델로 옮겨 접기·펼치기에도 유지
- 완료 기준: v1 기능 패리티 체크리스트(아래) 전부 통과

## Phase 7 — 듀오 다듬기
- [ ] reserved region으로 상호작용 요소 배치 점검
- [ ] 독서 세션 모드 + 테이블탑 `ArrangementView`, `onHingeChange` 연출
- [ ] 듀오 매트릭스 테스트(spec §10)와 스크린샷 `docs/ios-v2/screens/`
- 완료 기준: 매트릭스 전 항목 통과

## Phase 8 — 마감
- [ ] 접근성 점검(투명도·동작 줄이기, AX5, VoiceOver)
- [ ] 실기기 성능 재측정
- [ ] 위젯 회귀 확인, README의 iOS 섹션 갱신
- [ ] (선택) App Store Connect 듀오 스크린샷 준비

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
| 2026-11-17 | 0 | `app-resizability` 스킬(Xcode 27.2)로 v1 재점검. 새 결함 없음 | (이 커밋) |

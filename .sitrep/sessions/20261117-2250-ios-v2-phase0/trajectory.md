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

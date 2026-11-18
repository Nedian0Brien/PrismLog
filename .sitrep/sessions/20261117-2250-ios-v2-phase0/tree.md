# 작업 트리: PrismLog iOS v2 전체 Phase
갱신 2026-11-18 21:47 · 진행률 65%

- [x] T1 결정 사항 D1–D5 확정 (2026-10-29)
- [x] T2 `ios-v1-final` 태그, `ios-v2` 브랜치·워크트리 (2026-10-29)
- [x] T3 환경 확인: Xcode 27.2, 듀오 시뮬레이터, 실기기 연결
- [x] T4 배포 버전 27.1 조정, `xcodegen generate`
- [x] T5 기준선 측정
  - [x] T5.1 단위 테스트 44개 (42 통과, 2 건너뜀)
  - [x] T5.2 UI 테스트 iPhone 17 Pro 8/8
  - [x] T5.3 UI 테스트 듀오 접힌 화면 1/8 (세로 탭바)
  - [x] T5.4 실기기 빌드·설치·실행
- [x] T6 SDK 선언으로 [빌드 확인] 항목 정리
- [x] T7 듀오 펼친 화면·반쯤 펼친 자세 확인 (시뮬레이터)
- [x] T8 듀오 스킬(`app-resizability`)로 v1 재점검
- [x] T9 문서 갱신, 커밋·푸시, 이슈 #17 갱신
- [x] T10 Phase 1 표지 파이프라인
  - [x] T10.1 `CoverThumbnailCache` (다운샘플, JPEG 디스크, NSCache, 동시 4개, 실패 URL)
  - [x] T10.2 `GeneratedCover` (톤 그라디언트, 제목, 대비 기준 글자색)
  - [x] T10.3 `CoverImage` 교체, 호출 13곳에 `title:` 전달
  - [x] T10.4 단위 테스트 16개 (`CoverPipelineTests`)
  - [x] T10.5 듀오 시뮬레이터 실데이터 확인, iPhone UI 회귀
- [x] T11 Phase 2 표지 벽 시제품
  - [x] T11.1 `LibraryWallModel`, `WallComposition`, 단위 테스트 12개
  - [x] T11.2 `LibraryWallView` 배치 A(가로 행)·B(모자이크), 가상화
  - [x] T11.3 `WallLegibilityLayer`, 최악 조건·합성 픽스처
  - [x] T11.4 표지 벽 실험실(Debug), 실행 인자
  - [x] T11.5 시뮬레이터 녹화·측정, 가독성 대비 측정
  - [-] T11.6 실기기 Instruments 측정 (폐기, 2026-11-18: 사용자 지시로 시뮬레이터 진행)
  - [x] T11.7 D2 배치 확정: A 가로 행
- [x] T12 Phase 3 글래스 v2와 앱 셸 (벽은 화면별 배경 대안, 툴바 작성 메뉴, UI 테스트 듀오 통과)
- [x] T13 Phase 4 라이브러리 (렌즈 카드, 연속 기록, 접힘선 2열)
- [x] T14 Phase 5 기록 (regular 분할 화면, zoom 전환, 선택 유지)
- [~] T15 Phase 6 타임라인·설정·작성 (타임라인·설정 완료, 작성 초안 확인 남음)
- [~] T16 Phase 7 듀오 다듬기 ← 현재
  - [x] T16.1 독서 세션 모드 코드 (`ArrangementView`, `onHingeChange`)
  - [ ] T16.2 듀오 매트릭스 확인과 스크린샷
- [ ] T17 Phase 8 마감
- [ ] T18 최종 보고와 D5(main 머지) 질문

## 열린 결정
- 없음

범례: [x] 완료 · [~] 진행 중 · [?] 결정 대기 · [!] 막힘 · [ ] 예정 · [-] 폐기

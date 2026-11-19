# 맥 세션 핸드오프 프롬프트

아래 내용을 `~/code/PrismLog`에서 연 Claude Code 세션에 그대로 붙여 넣는다.

---

PrismLog iOS 앱을 v2로 재구성하는 작업을 이어서 진행하자. 클라우드 세션에서 기존 코드를 분석해 의도·스펙·계획 문서를 써 두었어.

**먼저 읽을 것 (순서대로, 끝까지)**
1. `CLAUDE.md` — 프로젝트 진행 규칙
2. `docs/ios-v2/01-intent.md` — 목표, 성공 기준, 결정 사항 D1–D5
3. `docs/ios-v2/02-spec.md` — 표지 벽, 글래스 v2, 화면별 명세, 아이폰 듀오 대응
4. `docs/ios-v2/03-plan.md` — Phase 0–8 체크리스트

**핵심 컨셉 한 줄**: 내가 기록한 책·영화·시리즈·게임·공부 표지를 화면 뒤에 넷플릭스 카탈로그처럼 깔아서(표지 벽), 그 위의 Liquid Glass가 실제로 굴절할 대상을 만든다. 아이폰 듀오(iOS 27.1, 접힘 5.4" compact / 펼침 7.6" regular)에서 하나의 경험으로 동작해야 한다.

**이번 세션에서 할 일 = Phase 0**
1. 문서를 읽고 이해한 내용을 짧게 정리한 뒤, 01-intent의 결정 사항 D1–D5를 나에게 확인받아. 각 항목의 기본값과 대안이 문서에 있어.
2. 환경 확인: `xcodebuild -version`이 27.1 이상인지, `xcrun simctl list devicetypes`에 iPhone Duo가 있는지. 없으면 멈추고 알려 줘.
3. 승인 후: `git tag ios-v1-final` → `git switch -c ios-v2` → `docs/ios-v2/` 문서를 첫 커밋으로 푸시.
4. `ios/project.yml` 배포 버전 조정(D4) → `xcodegen generate` → 기존 테스트 전체를 돌려 기준선을 기록해.
5. Xcode의 "get my app ready for iPhone Duo" 스킬(또는 `xcrun agent skills export`로 내보낸 스킬)로 v1 코드의 문제 패턴을 찾아 목록으로 정리해.
6. spec에서 **[확인]** 표시된 API(Liquid Glass의 iOS 27 변경, TabView 콘텐츠 배경 투명화, `reservedRegions`, `ArrangementView`, `onHingeChange`의 정확한 시그니처, 시트 세로 바 끄기)를 Apple 문서(Context7 MCP 또는 developer.apple.com)로 확인하고 spec에 반영해. iOS 27 API는 학습 데이터에 없을 수 있으니 기억에 의존하지 마.
7. Phase 0 완료 기준을 채우면 커밋·푸시하고, 03-plan의 체크박스와 진행 기록을 갱신한 뒤 Phase 1 계획을 제안해.

**알아 둘 것**
- v1의 데이터 계층(`Data/`, `Shared/`, 위젯)은 웹 패리티 테스트로 검증된 코드라 유지한다(D1 기본값). UI 계층만 새 구조로 옮긴다.
- spec §2.3 "v1에서 얻은 교훈"을 지켜. 특히 `Button`에 `.glassEffect`를 직접 걸면 터치가 먹히는 문제.
- 빌드 확인은 `xcodebuild -project ios/PrismLog.xcodeproj -scheme PrismLog -destination 'platform=iOS Simulator,name=<기기 이름>' build test`. 듀오 시뮬레이터 이름은 simctl 목록에서 확인해.
- `~/code/DuoCanvas`, `~/code/duo launcher`에 이전 듀오 관련 작업이 있을 수 있어. 참고할 만한지 훑어봐.
- 프로젝트 규칙대로 GitHub 이슈는 한글로, 작업이 끝나면 후속 작업 5가지를 제안해.

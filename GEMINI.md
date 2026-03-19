# GEMINI.md (Project Specific)
이 프로젝트에서는 작업 완료 시 항상 린트(`npm run lint`)를 먼저 실행하여 코드 결함을 확인해야 합니다.

## Repository Workflow Rule
사용자가 중지 요청하지 않는 한, 작업 완료 시 아래 순서를 기본으로 수행합니다:

1. 린트 실행 (`npm run lint`)
2. 관련 변경사항 커밋
3. 원격 브랜치 푸시
4. 빌드 실행
5. 배포 실행

## 주석 가이드라인
- 모든 주석 및 문서화는 한국어로 작성합니다.
- 함수 정의 시 Type Hinting을 포함합니다.
- Docstring에는 Description과 Args 정보를 상세히 기재합니다.

## 주의사항
- 정의되지 않은 변수(`no-undef`)가 없는지 항상 린트로 점검하십시오.
- `EditSheet` 등에서 `payload`를 수정할 때 기존 데이터가 유실되지 않도록 주의하십시오.

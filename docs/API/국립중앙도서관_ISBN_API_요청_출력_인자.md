# 국립중앙도서관 ISBN API 요청/출력 인자 정리

기준 문서:
- `/home/ubuntu/project/PrismLog/docs/API/국립중앙도서관_ISBN_서지정보_OPENAPI_GUIDE_v2.5.doc`

대상 API:
- `https://www.nl.go.kr/seoji/SearchApi.do`

용도:
- ISBN 기반으로 국립중앙도서관 서지 데이터를 조회하는 API
- 우리 서비스에서는 `전체 페이지 수`, `전자책 여부`, `판형`, `형태사항` 보강에 특히 유용함

## 기본 호출 예시

```text
GET https://www.nl.go.kr/seoji/SearchApi.do
  ?cert_key=YOUR_CERT_KEY
  &result_style=json
  &page_no=1
  &page_size=1
  &isbn=9788971998557
```

## 요청 인자

| 인자 | 타입 | 의미 | 활용 우선도 | 비고 |
| --- | --- | --- | --- | --- |
| `cert_key` | `String` | 인증 키 | 필수 | 문서상 일반 검색 API의 `key`와 다르게 ISBN API는 `cert_key` 사용 |
| `result_style` | `String` | 응답 형식 | 필수 | `json`, `xml` |
| `page_no` | `Integer` | 페이지 번호 | 권장 | 보통 `1` 고정 |
| `page_size` | `Integer` | 페이지 크기 | 권장 | ISBN 정확 조회면 `1` 또는 `10`이면 충분 |
| `isbn` | `String` | ISBN | 최우선 | 단권 조회 기준 핵심 파라미터 |
| `set_isbn` | `String` | 세트 ISBN | 선택 | 세트 상품 구분 시 사용 |
| `ebook_yn` | `String` | 전자책 여부 | 선택 | `Y`, `N` |
| `title` | `String` | 제목 | 선택 | 문서상 ngram 검색 지원 |
| `start_publish_date` | `String` | 발행 시작일 | 선택 | `yyyymmdd` |
| `end_publish_date` | `String` | 발행 종료일 | 선택 | `yyyymmdd` |
| `cip_yn` | `String` | CIP 여부 | 선택 | `Y`, `N` |
| `deposit_yn` | `String` | 납본 여부 | 선택 | `Y`, `N` |
| `series_title` | `String` | 총서명 | 선택 | 문서상 ngram 검색 지원 |
| `publisher` | `String` | 출판사 | 선택 | 문서상 ngram 검색 지원 |
| `author` | `String` | 저자 | 선택 | 문서상 ngram 검색 지원 |
| `form` | `String` | 형태사항 | 선택 | 인쇄/매체 형태 보조 필터로 활용 가능 |
| `sort` | `String` | 정렬 기준 | 선택 | 문서상 `PUBLISH_PREDATE`, `INPUT_DATE`, `INDEX_TITLE`, `INDEX_PUBLISHER` 확인 |
| `order_by` | `String` | 정렬 방향 | 선택 | `ASC`, `DESC` |

## 출력 인자

문서 추출 특성상 일부 필드 설명 문자열은 손실됐지만, 필드명 자체는 아래처럼 확인된다.

### 공통/메타 필드

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `PAGE_NO` | `String` | 현재 페이지 번호 |
| `TOTAL_COUNT` | `String` | 총 결과 수 |
| `INPUT_DATE` | `String` | 입력일 |
| `UPDATE_DATE` | `String` | 수정일 |

### 서지 핵심 필드

| 필드 | 타입 | 의미 | 우리 서비스 활용 |
| --- | --- | --- | --- |
| `TITLE` | `String` | 제목 | 제목 검증/자동입력 |
| `SERIES_TITLE` | `String` | 총서명 | 시리즈 정보 보강 |
| `SERIES_NO` | `String` | 총서 번호 | 시리즈 권차 보강 |
| `AUTHOR` | `String` | 저자 | 저자 자동입력 |
| `PUBLISHER` | `String` | 출판사 | 출판사 자동입력 |
| `PUBLISH_PREDATE` | `String` | 발행일 | 출간일 자동입력 |
| `EDITION_STMT` | `String` | 판사항 | 판본 구분 |
| `SUBJECT` | `String` | 주제 | 태그/분류 보강 |
| `CONTROL_NO` | `String` | 관리번호 | 내부 추적용 |

### ISBN/세트 관련 필드

| 필드 | 타입 | 의미 | 활용 |
| --- | --- | --- | --- |
| `EA_ISBN` | `String` | 낱권 ISBN | 개별 도서 식별 |
| `EA_ADD_CODE` | `String` | 낱권 ISBN 부가기호 | 부가 메타데이터 |
| `SET_ISBN` | `String` | 세트 ISBN | 세트본 식별 |
| `SET_ADD_CODE` | `String` | 세트 ISBN 부가기호 | 세트본 메타데이터 |
| `SET_EXPRESSION` | `String` | 세트 표현 정보 | 세트/권수 표기 추정 |

### 페이지/형태 관련 필드

| 필드 | 타입 | 의미 | 활용 |
| --- | --- | --- | --- |
| `PAGE` | `String` | 페이지 수 | `pages_total` 보강 핵심 필드 |
| `BOOK_SIZE` | `String` | 판형 | 메타데이터 보강 |
| `FORM` | `String` | 형태사항 | 종이책/전자책 구분 보조 |
| `EBOOK_YN` | `String` | 전자책 여부 | `Y`, `N` |

### 가격/링크 관련 필드

| 필드 | 타입 | 의미 | 활용 |
| --- | --- | --- | --- |
| `PRE_PRICE` | `String` | 정가/가격 계열 필드 | 향후 구매/메타 보강 |
| `TITLE_URL` | `String` | 제목 관련 URL | 원문 상세 링크 |
| `BOOK_TB_CNT_URL` | `String` | 목차 관련 URL | 목차 확장 가능성 |
| `BOOK_INTRODUCTION_URL` | `String` | 책 소개 URL | 소개문 보강 가능성 |
| `BOOK_SUMMARY_URL` | `String` | 요약 URL | 설명/요약 보강 가능성 |
| `PUBLISHER_URL` | `String` | 출판사 URL | 출판사 링크 |

### 기타 상태 필드

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `CIP_YN` | `String` | CIP 여부 |

## 우리 서비스 기준 최소 사용 세트

페이지 수 보강만 목표라면 아래 조합이면 충분하다.

- 요청:
  - `cert_key`
  - `result_style=json`
  - `page_no=1`
  - `page_size=1`
  - `isbn`

- 응답:
  - `PAGE`
  - `EBOOK_YN`
  - `FORM`
  - `TITLE`
  - `AUTHOR`
  - `PUBLISHER`

## 구현 시 메모

- `PAGE`는 문자열일 가능성이 높으므로 숫자 파싱이 필요하다.
- `EA_ISBN`과 `SET_ISBN`은 별도로 저장하는 편이 안전하다.
- `isbn`이 없거나 매칭이 약할 때만 `title`, `author`, `publisher` 보조 검색을 고려한다.
- 국내 도서 page count 보강은 이 API를 우선, 해외나 누락 건은 다른 API fallback이 적합하다.

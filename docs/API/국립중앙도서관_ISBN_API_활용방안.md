# 국립중앙도서관 ISBN API 활용 방안

기준 문서:
- `/home/ubuntu/project/PrismLog/docs/API/국립중앙도서관_ISBN_서지정보_OPENAPI_GUIDE_v2.5.doc`

대상 API:
- `https://www.nl.go.kr/seoji/SearchApi.do`

## 결론

이 API는 단순한 제목 검색 API가 아니라 `ISBN 기반 상세 보강 API`로 쓰는 게 가장 적합하다.  
특히 국내 도서의 `전체 페이지 수(PAGE)`를 확보하려는 목적에는 Google Books보다 우선 순위를 높게 둘 가치가 있다.

## 1. 전체 페이지 수 자동 입력

가장 직접적인 활용처다.

플로우:
1. 사용자가 검색 결과에서 책을 선택한다.
2. 선택된 항목의 `isbn13` 또는 `isbn`을 정규화한다.
3. 국립중앙도서관 API에 ISBN으로 조회한다.
4. 응답의 `PAGE`를 `pages_total`로 저장한다.
5. 페이지 수가 없으면 Google Books나 수동 입력으로 fallback 한다.

권장 우선순위:
1. 국립중앙도서관 ISBN API
2. Google Books
3. Open Library 등 해외 fallback
4. 수동 입력

## 2. 종이책/전자책 판별 보강

문서상 `EBOOK_YN`, `FORM` 필드가 존재한다.

활용 예:
- `EBOOK_YN=Y`이면 전자책 후보로 표시
- `FORM` 값이 명확하면 종이책/전자책/기타 매체 구분 보조값으로 사용
- 현재 UI의 `매체 유형` 기본 선택값 보조 힌트로 활용 가능

주의:
- 우리 서비스의 최종 매체 선택은 사용자가 직접 확정하는 구조가 더 안전하다.
- API 값은 추천값 또는 초기값 정도로 쓰는 편이 좋다.

## 3. 판본/세트본 구분

문서상 `EA_ISBN`, `SET_ISBN`, `SET_EXPRESSION`, `EDITION_STMT`가 있다.

활용 예:
- 낱권 ISBN과 세트 ISBN을 분리 저장
- 세트본일 때 경고 배지 표시
- 개정판/증보판 여부를 `EDITION_STMT`로 보강
- 같은 제목이라도 다른 판본을 서로 다른 도서로 취급

이건 지금 ISBN 불일치 이슈와도 연결된다.  
제목이 같아 보여도 ISBN, 세트 표현, 판사항이 다르면 다른 엔티티로 봐야 한다.

## 4. 메타데이터 품질 보강

문서상 아래 필드들이 기본 메타 보강에 유용하다.

- `TITLE`
- `AUTHOR`
- `PUBLISHER`
- `PUBLISH_PREDATE`
- `SUBJECT`
- `BOOK_SIZE`

활용 예:
- 검색 API 응답이 빈약할 때 최종 저장 직전 교차검증
- 저자/출판사 정규화
- 출간일 누락 보강
- 장르/주제 기반 태그 추천
- 판형이나 형태사항을 상세 메타데이터 영역에 저장

## 5. 링크성 확장

문서상 URL 계열 필드가 있다.

- `TITLE_URL`
- `BOOK_TB_CNT_URL`
- `BOOK_INTRODUCTION_URL`
- `BOOK_SUMMARY_URL`
- `PUBLISHER_URL`

활용 예:
- 책 소개/요약이 부족할 때 외부 상세 링크 연결
- 목차 데이터가 실제로 제공되면 학습용/독서용 목차 확장
- 출판사 페이지 연결

주의:
- 실제 응답에서 URL이 안정적으로 채워지는지는 별도 검증이 필요하다.
- 외부 링크는 저장하더라도 바로 UI에 노출할지는 검토가 필요하다.

## 6. 가격/상품 메타

문서상 `PRE_PRICE`가 보인다.

활용 예:
- 도서 기본 가격 저장
- 구매/대여 구분 시 참고값
- 향후 도서 상세 카드에서 부가 메타로 활용

현재 MVP에서는 우선순위가 높지 않다.  
페이지 수와 판본 식별이 먼저다.

## 7. 검색 전략 제안

### 권장 조회 전략

1. `isbn13`이 있으면 `isbn` 파라미터로 직접 조회
2. 결과가 없으면 `set_isbn`도 보조 조회
3. 그래도 없으면 `title + author + publisher` 조합으로 보조 검색
4. 페이지 수가 없으면 다른 공급자로 fallback

### 추천 파싱 필드

- 필수:
  - `PAGE`
  - `TITLE`
  - `AUTHOR`
  - `PUBLISHER`
  - `PUBLISH_PREDATE`
  - `EBOOK_YN`
- 선택:
  - `FORM`
  - `BOOK_SIZE`
  - `EA_ISBN`
  - `SET_ISBN`
  - `EDITION_STMT`
  - `SUBJECT`

## 8. 우리 서비스 적용안

### 단기

- `books/enrich`에 국립중앙도서관 ISBN API fallback 추가
- `PAGE`를 `pages_total`로 매핑
- `EBOOK_YN`, `FORM`을 payload 확장 후보로 저장

### 중기

- `EDITION_STMT`, `SET_EXPRESSION`까지 저장해서 판본 구분 강화
- `SUBJECT` 기반 태그 추천
- `BOOK_INTRODUCTION_URL` 또는 `BOOK_SUMMARY_URL` 활용 여부 검토

### 장기

- 국내 도서 메타데이터의 1차 소스를 국립중앙도서관 API로 승격
- 검색 공급자와 상세 보강 공급자를 명확히 분리

## 9. 구현 시 주의사항

- `PAGE`는 문자열이므로 숫자 파싱이 필요하다.
- 결과가 여러 건이면 `EA_ISBN` 정확 일치 우선으로 좁혀야 한다.
- `EBOOK_YN`만으로 최종 매체를 자동 확정하지 말고, 사용자 확인을 남기는 편이 안전하다.
- API 인증 파라미터 이름은 `cert_key`다.
- 일반 검색 API와 ISBN API를 혼동하지 않도록 엔드포인트를 분리해야 한다.

## 10. 실전 권장안

지금 PrismLog 기준으로 가장 실용적인 구조는 아래다.

1. 검색/자동완성: 네이버 책 검색
2. 선택 후 국내 상세 보강: 국립중앙도서관 ISBN API
3. 국내 API 페이지 수 누락 시: Google Books fallback
4. 그래도 없으면: 수동 입력

이 구조가 가장 현실적이다.

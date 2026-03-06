# PrismLog — Record the colors of your life

**PrismLog**는 독서·공부·문화생활 기록을 한 곳에서 관리하는 올인원 기록 플랫폼입니다.
흩어져 있는 개인의 성장을 시각화하고, 취향의 역사를 기록합니다.

[![Deploy Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://prism.lawdigest.cloud)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://react.dev)

## ✨ 주요 특징

### 📚 세 가지 기록 카테고리

| 카테고리 | 주요 기능 | 색상 |
|---------|---------|------|
| **독서** 📖 | 도서 진척도 관리, 필사, 평점 & 한 줄 평 | 청록색 (Teal) |
| **공부** 📝 | AI 기반 목차 생성, 학습 목표 관리, 회고 기록 | 노란색 (Yellow) |
| **문화** 🎬 | 영화/TV/게임 기록, 포스터 갤러리, 상태 추적 | 빨강색 (Red) |

### 🎨 디자인 철학

- **Glass Morphism**: 반투명 카드로 깊이감 있는 UI
- **다크 모드 우선**: 색상을 돋보이게 하는 최적화된 디자인
- **모바일 최우선**: 반응형 레이아웃으로 어느 기기에서나 완벽
- **부드러운 애니메이션**: 불필요한 과한 효과 제거

### 📊 통합 대시보드

- **스펙트럼 링 차트**: 카테고리별 기록 비율을 색깔로 시각화
- **활동 히트맵**: 주간 기록 현황을 한눈에 확인
- **최근 기록**: 방금 남긴 기록을 빠르게 확인

### 🎯 핵심 인터랙션

- **FAB 버튼**: 어디서든 원탭으로 새 기록 시작
- **바텀 시트**: 카테고리별 맞춤형 입력 폼
- **아코디언 메뉴**: 공부 기록의 목차를 접고 펼치며 관리
- **포스터 갤러리**: 영화/게임을 마치 스트리밍 앱처럼 탐색

## 🚀 시작하기

### 설치

```bash
# 저장소 복제
git clone https://github.com/Nedian0Brien/PrismLog.git
cd PrismLog

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버는 `http://localhost:5173`에서 실행됩니다.

### 빌드 및 배포

**원클릭 배포** (권장):
```bash
./deploy.sh
```

**수동 배포**:
```bash
npm run build
sudo cp -r dist/* /var/www/prism.lawdigest.cloud/
```

자세한 배포 가이드는 [DEPLOY.md](./DEPLOY.md)를 참고하세요.

## 📁 프로젝트 구조

```
PrismLog/
├── src/
│   ├── main.jsx           # React 진입점
│   └── App.jsx            # 메인 컴포넌트 (빌드용)
├── prismlog.jsx           # React 컴포넌트 (원본)
├── index.html             # HTML 템플릿
├── package.json           # 의존성 관리
├── vite.config.js         # Vite 빌드 설정
├── deploy.sh              # 배포 자동화 스크립트
├── DEPLOY.md              # 배포 가이드 문서
├── docs/                  # 설계 및 기획 문서
│   ├── design concept.md  # UI/UX 디자인
│   ├── specification.md   # 서비스 설명서
│   └── implementation plan.md # 구현 계획
└── README.md              # 이 파일
```

## 🛠 기술 스택

### Frontend
- **React 18**: 최신 UI 라이브러리
- **Vite 4**: 초고속 번들러
- **인라인 CSS-in-JS**: 가벼운 스타일링

### 배포
- **Nginx 1.18**: 정적 파일 서빙
- **Let's Encrypt**: 자동 HTTPS
- **Node.js 18**: 빌드 환경

### 성능
- **번들 크기**: ~175 KB (gzip: ~54 KB)
- **빌드 시간**: ~1.3초
- **캐시 전략**: 자산 1년 캐싱

## 📦 의존성

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0"
}
```

빌드 의존성:
```json
{
  "vite": "^4.3.9",
  "@vitejs/plugin-react": "^4.0.0"
}
```

## 🎯 핵심 컴포넌트

### 유틸리티 컴포넌트
- `GlassCard`: Glass Morphism 스타일의 재사용 가능 카드
- `ProgressBar`: 진척도 표시
- `Badge`: 태그 표시
- `RatingStars`: 별점 평가

### 페이지 컴포넌트
- `DashboardPage`: 통합 대시보드 (홈)
- `ReadingPage`: 독서 기록
- `StudyPage`: 공부 기록 (상세 뷰 포함)
- `CulturePage`: 문화생활 기록 (필터링 포함)

### 인터랙티브 컴포넌트
- `BottomSheet`: 기록 작성용 바텀 시트
- `CategorySelector`: 카테고리 선택 탭
- `StudyAccordion`: 학습 목차 아코디언
- `Heatmap`: 주간 활동 히트맵
- `SpectrumRing`: 스펙트럼 링 차트

## 🎨 색상 시스템

```javascript
const COLORS = {
  dark: {
    bg: "#1a1816",           // 배경
    text: "#f5f0eb",         // 텍스트
    textMuted: "#a09890",    // 부텍스트
  },
  reading: { main: "#2db5a3", glow: "rgba(45,181,163,0.35)" },  // 청록색
  study: { main: "#f0c930", glow: "rgba(240,201,48,0.35)" },    // 노란색
  culture: { main: "#e63946", glow: "rgba(230,57,70,0.35)" },    // 빨강색
};
```

## 📱 반응형 디자인

- **모바일**: 최적화된 터치 인터페이스
- **태블릿**: 확장된 대시보드 레이아웃
- **데스크톱**: 풀 너비 콘텐츠 표시

## 🔐 보안

- HTTPS: Let's Encrypt SSL 자동 갱신
- 정적 파일 서빙: XSS 취약점 최소화
- 클라이언트 사이드 렌더링: 서버 부하 감소

## 📚 문서

- [DEPLOY.md](./DEPLOY.md) - 배포 가이드
- [docs/design concept.md](./docs/design%20concept.md) - UI/UX 디자인
- [docs/specification.md](./docs/specification.md) - 서비스 설명서

## 🗺 로드맵

### 현재 (목업 단계)
- ✅ UI/UX 디자인 완성
- ✅ Vite + React 18 프로젝트 구성
- ✅ 배포 자동화

### 다음 단계
- [ ] 백엔드 API 구축 (FastAPI)
- [ ] 데이터베이스 설계 (PostgreSQL)
- [ ] 사용자 인증 (소셜 로그인)
- [ ] 외부 API 연동 (도서/영화/게임)
- [ ] AI 기반 목차 생성

## 🤝 기여

버그 리포트 또는 기능 제안은 [Issues](https://github.com/Nedian0Brien/PrismLog/issues)에서 해주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 🌐 라이브 서버

**https://prism.lawdigest.cloud**

---

**PrismLog** — Record the colors of your life

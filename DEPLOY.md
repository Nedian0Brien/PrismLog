# PrismLog 배포 가이드

## 📋 개요

PrismLog는 독서·공부·문화생활 기록을 위한 React 웹 애플리케이션입니다.

- **도메인**: https://prism.lawdigest.kr
- **서버**: Ubuntu 22.04 + Nginx 1.18.0
- **빌드**: Vite + React 19
- **SSL**: Let's Encrypt (자동 갱신)

## 🚀 빠른 배포

프로젝트 루트에서 다음 명령을 실행하면 자동으로 빌드, 배포, 검증을 수행합니다:

```bash
./deploy.sh
```

## 📝 배포 스크립트가 하는 일

1. **의존성 확인**: npm 패키지 설치 (필요시)
2. **빌드**: Vite로 프로덕션 빌드
3. **배포**: 빌드 파일을 `/var/www/prism.lawdigest.kr/` 복사
4. **검증**: 라이브 서버의 해시값 확인

## 🔧 수동 배포 (단계별)

### 1. 의존성 설치
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install
```

### 2. 빌드
```bash
npm run build
```

### 3. 배포
```bash
sudo mkdir -p /var/www/prism.lawdigest.kr
sudo rm -rf /var/www/prism.lawdigest.kr/*
sudo cp -r dist/* /var/www/prism.lawdigest.kr/
sudo chown -R www-data:www-data /var/www/prism.lawdigest.kr
```

### 4. 검증
```bash
curl https://prism.lawdigest.kr/
```

## 🐛 일반적인 문제

### 변경사항이 브라우저에 반영되지 않음

이는 브라우저 캐시 때문입니다. 다음 중 하나를 시도하세요:

- **강제 새로고침**: `Ctrl+F5` (Windows) 또는 `Cmd+Shift+R` (Mac)
- **캐시 삭제**: `Ctrl+Shift+Delete` (개발자도구 → 캐시 및 쿠키 삭제)

### 변경사항이 배포 서버에 반영되지 않음

소스 파일은 이제 `src/App.jsx` 하나만 관리합니다. 다음 순서로 다시 확인하세요:

```bash
npm run build
./deploy.sh
```

## 📁 프로젝트 구조

```
/home/ubuntu/project/PrismLog/
├── package.json            # npm 설정
├── vite.config.js         # Vite 빌드 설정
├── index.html             # HTML 진입점
├── deploy.sh              # 배포 스크립트 ⭐
├── DEPLOY.md              # 이 문서
├── src/
│   ├── main.jsx           # React 진입점
│   └── App.jsx            # React 컴포넌트
├── dist/                  # 빌드 결과물 (배포 대상)
│   ├── index.html
│   └── assets/
│       └── index-[hash].js
└── docs/                  # 문서
```

## 🔐 Nginx 설정

```nginx
server {
    server_name prism.lawdigest.kr;
    root /var/www/prism.lawdigest.kr;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;  # SPA 라우팅
    }

    # 자산 캐싱 (JS, CSS)
    location ~* ^/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SSL (Certbot 자동 관리)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/prism.lawdigest.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prism.lawdigest.kr/privkey.pem;
}
```

## 📊 성능 정보

- **번들 크기**: ~175 KB (gzip: ~54 KB)
- **빌드 시간**: ~1.3초
- **배포 시간**: ~5초

## 🔄 CI/CD 통합 (선택사항)

GitHub Actions 등으로 자동 배포를 설정하려면:

```yaml
name: Deploy PrismLog

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd PrismLog && ./deploy.sh
```

## 📞 도움말

문제가 발생하면:

1. 배포 스크립트 출력 확인
2. 브라우저 캐시 비우기
3. Nginx 로그 확인: `/var/log/nginx/prism.lawdigest.kr.error.log`

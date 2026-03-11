#!/bin/bash

# PrismLog 배포 스크립트
# 사용법: ./deploy.sh

set -e

echo "🚀 PrismLog 배포 시작..."
echo ""

# NVM 설정
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 프로젝트 디렉토리
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="/var/www/prism.lawdigest.cloud"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

cd "$PROJECT_DIR"

# 1. 의존성 확인
echo "📦 1/4 의존성 확인 중..."
if [ ! -d "node_modules" ]; then
  npm install
  echo "   ✓ npm install 완료"
else
  echo "   ✓ node_modules 존재"
fi

# 2. 빌드
echo "🔨 2/4 빌드 중..."
rm -rf dist/
npm run build > /dev/null 2>&1
BUILD_SIZE=$(du -sh dist | cut -f1)
echo "   ✓ 빌드 완료 (크기: $BUILD_SIZE)"

# 3. 배포
echo "📤 3/4 배포 중..."
sudo rm -rf "$DEPLOY_DIR"/*
sudo cp -r dist/* "$DEPLOY_DIR/"
sudo chown -R www-data:www-data "$DEPLOY_DIR"
echo "   ✓ 배포 완료 ($DEPLOY_DIR)"

# 4. 검증
echo "✅ 4/4 검증 중..."
HASH=$(grep -oP "(?<=src=\"/assets/)index-[a-z0-9]+\.js" "$DEPLOY_DIR/index.html" | cut -d'-' -f2 | cut -d'.' -f1)
LIVE_HASH=$(curl -s https://prism.lawdigest.cloud/ | grep -oP "(?<=src=\"/assets/)index-[a-z0-9]+\.js" | cut -d'-' -f2 | cut -d'.' -f1)

if [ "$HASH" = "$LIVE_HASH" ]; then
  echo "   ✓ 라이브 서버 검증 완료"
else
  echo "   ⚠ 라이브 서버 캐시 비우기 필요 (Ctrl+Shift+Delete)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 배포 완료! [$TIMESTAMP]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 https://prism.lawdigest.cloud"
echo "📄 빌드 파일: dist/ → $DEPLOY_DIR"
echo ""

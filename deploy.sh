#!/bin/bash
# Deploy react-app to GitHub Pages (gh-pages branch)
# Usage: ./deploy.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_TMP="/tmp/cf-deploy-dist"

echo "📦 Building react-app..."
cd "$REPO_DIR/react-app"
rm -rf dist
npm run build

echo "📋 Copying dist to temp..."
rm -rf "$DIST_TMP"
cp -r dist "$DIST_TMP"

echo "🔄 Switching to gh-pages..."
cd "$REPO_DIR"
git stash --quiet 2>/dev/null || true
git checkout gh-pages
git pull origin gh-pages --quiet

echo "🗑️  Replacing assets..."
rm -rf assets
cp "$DIST_TMP/index.html" .
cp "$DIST_TMP/404.html" .
cp -r "$DIST_TMP/assets" .

echo "🚀 Committing and pushing..."
git add -A index.html 404.html assets/
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push origin gh-pages

echo "↩️  Switching back to main..."
git checkout main
git stash pop --quiet 2>/dev/null || true

rm -rf "$DIST_TMP"
echo "✅ Deployed to gh-pages!"

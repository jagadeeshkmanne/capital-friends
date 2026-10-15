#!/bin/bash
# Deploy react-app to GitHub Pages (gh-pages branch)
# Usage: ./deploy.sh
#
# WHEN TO RUN: Only when react-app/ source code changes (components, pages, styles, .env)
# NOT NEEDED: When only GAS backend code changes (gas-webapp/ or master-mf-db/)
#             GAS backends are called live at runtime — no React redeploy needed.
#
# See also: ./deploy-all.sh for deploying GAS projects

set -e

# --- safety: only deploy from the main branch (feature branches must never reach production) ---
CURRENT_BRANCH="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "❌ Refusing to deploy: you are on branch '$CURRENT_BRANCH'. Switch to main first (git checkout main)."
  exit 1
fi


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

echo "🗑️  Replacing the published site with the new build..."
# Everything in dist/ is the site: index.html, 404.html, assets/, the static calculator and guide pages, goal-planner/,
# seo/, sitemap.xml, robots.txt, ga.js, logos. Only the files tracked on gh-pages are removed (ignored files from main,
# such as react-app/node_modules and .env, stay untouched); .nojekyll and the runtime UPI QR are kept.
OLD_FILES="$(git ls-tree --name-only HEAD)"
for f in $OLD_FILES; do
  case "$f" in .nojekyll|upi-qr-code.png) ;; *) rm -rf "$f" ;; esac
done
cp -r "$DIST_TMP"/. .
touch .nojekyll

echo "📄 Ensuring CNAME is present..."
cp "$REPO_DIR/CNAME" . 2>/dev/null || true

echo "🚀 Committing and pushing..."
# stage only the site files (old names too, so removed pages are deleted from the branch)
git add -A -- .nojekyll CNAME $OLD_FILES $(ls "$DIST_TMP")
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push origin gh-pages

echo "↩️  Switching back to main..."
git checkout main
git stash pop --quiet 2>/dev/null || true

rm -rf "$DIST_TMP"
echo "✅ Deployed to gh-pages!"

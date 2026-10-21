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

# Keep the page files (assets/) of the last 3 deploys: a tab, or a cached index.html (GitHub's CDN keeps it up to
# 10 minutes), still asks for the old file names, and deleting them gives "Failed to fetch dynamically imported module".
KEEP_TMP="/tmp/cf-deploy-keep"
rm -rf "$KEEP_TMP" && mkdir -p "$KEEP_TMP"
for rev in HEAD~2 HEAD~1 HEAD; do
  git rev-parse -q --verify "$rev^{commit}" >/dev/null || continue
  for f in $(git ls-tree --name-only "$rev" assets/); do git show "$rev:$f" > "$KEEP_TMP/$(basename "$f")"; done
done

echo "🗑️  Replacing the published site with the new build..."
# Everything in dist/ is the site: index.html, 404.html, assets/, the static calculator and guide pages, goal-planner/,
# seo/, sitemap.xml, robots.txt, ga.js, logos. Only the files tracked on gh-pages are removed (ignored files from main,
# such as react-app/node_modules and .env, stay untouched); .nojekyll and the runtime UPI QR are kept.
OLD_FILES="$(git ls-tree --name-only HEAD)"
for f in $OLD_FILES; do
  case "$f" in .nojekyll|upi-qr-code.png) ;; *) rm -rf "$f" ;; esac
done
cp -r "$DIST_TMP"/. .
# old page files the new build doesn't have (see KEEP_TMP above)
for f in "$KEEP_TMP"/*; do [ -e "$f" ] && [ ! -e "assets/$(basename "$f")" ] && cp "$f" assets/; done
rm -rf "$KEEP_TMP"
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

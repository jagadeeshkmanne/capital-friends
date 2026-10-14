#!/bin/bash
# Deploy the phone version (branch mobile-ui) as a preview at https://capitalfriends.in/beta/
# The live app at capitalfriends.in is NOT touched. Same Google sign-in and same data as the live app.
# Usage: git checkout mobile-ui && ./deploy-beta.sh
set -e
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "mobile-ui" ]; then echo "❌ Run this from the mobile-ui branch (you are on '$BRANCH')."; exit 1; fi
DIST_TMP="/tmp/cf-beta-dist"

echo "📦 Building the phone preview for /beta/ ..."
cd "$REPO_DIR/react-app"
rm -rf "$DIST_TMP"
npx vite build --base /beta/ --outDir "$DIST_TMP" --emptyOutDir
# keep Google from listing the preview
sed -i.bak 's#<head>#<head><meta name="robots" content="noindex">#' "$DIST_TMP/index.html" && rm -f "$DIST_TMP/index.html.bak"

echo "🔄 Switching to gh-pages..."
cd "$REPO_DIR"
git stash --quiet 2>/dev/null || true
git checkout gh-pages
git pull origin gh-pages --quiet
rm -rf beta && mkdir beta
cp "$DIST_TMP/index.html" beta/
cp -r "$DIST_TMP/assets" beta/
cp "$DIST_TMP"/*.png beta/ 2>/dev/null || true
# a refresh on a /beta/... page comes back to the preview, not the live app
cat > 404.html <<'H'
<!doctype html>
<html><head><meta charset="UTF-8" /><title>Capital Friends</title>
<script>
  sessionStorage.setItem('spa-redirect', window.location.pathname + window.location.search + window.location.hash);
  window.location.replace(window.location.pathname.indexOf('/beta/') === 0 ? '/beta/' : '/');
</script></head><body></body></html>
H
git add -A beta 404.html
git commit -m "Beta (phone preview): $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push origin gh-pages

echo "↩️  Back to mobile-ui..."
git checkout mobile-ui
git stash pop --quiet 2>/dev/null || true
rm -rf "$DIST_TMP"
echo "✅ Phone preview: https://capitalfriends.in/beta/  (open it on your phone)"

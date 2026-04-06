#!/bin/bash
# =============================================================================
# Deploy Capital Friends — GAS projects + React app
# =============================================================================
#
# ARCHITECTURE:
#   master-mf-db/  — Master DB: MF NAVs, ATH tracking, stock data
#   gas-webapp/    — API router: React app talks to this via Execution API
#   react-app/     — Frontend: capitalfriends.in (GitHub Pages)
#
# WHEN TO DEPLOY WHAT:
#   Changed master-mf-db/ code  → ./deploy-all.sh master
#   Changed gas-webapp/ code    → ./deploy-all.sh webapp
#   Changed react-app/ code     → ./deploy-all.sh react
#   Changed multiple            → ./deploy-all.sh all
#
#   GAS backend changes do NOT require React redeploy (APIs called live at runtime)
#   React redeploy only needed when React source code / .env changes
#
# DEPLOYMENT IDs are locked — same ID updates to latest code version each time.
# One-time setup (already done):
#   - Master DB deployed as web app for admin endpoint
#   - Admin secret stored in Master DB Script Properties (ADMIN_API_SECRET)
#   - Master DB URL + secret stored in gas-webapp Script Properties
#     (MASTER_DB_ADMIN_URL, MASTER_DB_ADMIN_SECRET)
#
# Usage:
#   ./deploy-all.sh          # Deploy everything
#   ./deploy-all.sh react    # React only
#   ./deploy-all.sh gas      # Both GAS projects only
#   ./deploy-all.sh webapp   # Gas WebApp only
#   ./deploy-all.sh master   # Master MF DB only

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-all}"

# Deployment IDs (locked — never change)
WEBAPP_DEPLOY_ID="AKfycbyFaPjl26iBGym2ZymJqHlHTDEx7-qjPoHXUKPIy51E1Hjh2svLgmDEuQsC4TGGoHT-"
MASTER_DEPLOY_ID="AKfycbxdTWO2_k9sVKokJoHTqoEDGnqbW7Y0blVp3pe7ihlCP-h1KdhRlzTDkrvOae5nvvOK"

deploy_webapp() {
  echo "🔧 Deploying gas-webapp..."
  cd "$REPO_DIR/gas-webapp"
  clasp push --force
  clasp deploy -i "$WEBAPP_DEPLOY_ID" -d "Deploy: $(date '+%Y-%m-%d %H:%M')"
  echo "✅ gas-webapp deployed"
}

deploy_master() {
  echo "🔧 Deploying master-mf-db..."
  cd "$REPO_DIR/master-mf-db"
  clasp push --force
  clasp deploy -i "$MASTER_DEPLOY_ID" -d "Deploy: $(date '+%Y-%m-%d %H:%M')"
  echo "✅ master-mf-db deployed"
}

deploy_react() {
  echo "📦 Deploying react-app..."
  cd "$REPO_DIR"
  ./deploy.sh
}

case "$TARGET" in
  all)
    deploy_master
    deploy_webapp
    deploy_react
    echo ""
    echo "🚀 All deployed!"
    ;;
  react)
    deploy_react
    ;;
  gas)
    deploy_master
    deploy_webapp
    echo ""
    echo "🚀 Both GAS projects deployed!"
    ;;
  webapp)
    deploy_webapp
    ;;
  master)
    deploy_master
    ;;
  *)
    echo "Usage: ./deploy-all.sh [all|react|gas|webapp|master]"
    exit 1
    ;;
esac

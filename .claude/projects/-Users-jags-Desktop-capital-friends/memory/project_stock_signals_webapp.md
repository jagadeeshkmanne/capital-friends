---
name: Stock signals webapp integration (future)
description: Future feature to add stock screener signals to webapp API and React app with separate settings page
type: project
---

Stock screener signals need webapp + React integration (not started yet).

**Planned features:**
- WebApp API endpoints for stock signals (read signals, update status, mark executed/skipped)
- React app: Stock Signals page with 5 tabs (Watchlist, Signals, Holdings, History, Near Miss)
- Separate settings section for stock signal email preferences (independent of MF email reports)
- Weekly summary email showing watchlist status + open signals even when no new signals

**Why:** User wants to see signals in the React dashboard, not just email. Also wants configurable email preferences for stock signals separate from MF reports.

**How to apply:** This is Phase 2 — only start when user explicitly asks. Current Phase 1 is standalone GAS automation with email-only signals. Don't mix stock signal features into existing MF email/webapp code.

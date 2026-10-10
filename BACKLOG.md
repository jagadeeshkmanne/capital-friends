# Backlog

## Daily updates popup fails when the app account is not the first Google account (found 10 Oct 2026)

**What happens:** "Turn on daily updates" opens the GAS web app (`exec?action=installTriggers`). If the user's
Capital Friends account is not account 0 in that Chrome (e.g. personal Gmail first, app account at `/u/1/`),
Google shows "Sorry, unable to open the file at present" and the daily jobs (dailyUserSync, daily email,
reminders) never get installed.

**Tested:** `/u/1/` in the URL and `&authuser=<email>` both route to the right account and still fail
(Apps Script web apps fail for non-default accounts — Google-side bug).
The Apps Script API (scripts.run) cannot create triggers (Google docs), so it can't be done from the app's API.

**Plan (agreed):**
1. Keep the one-click popup (works when the app account is account 0 — most users).
2. If `triggers:status` is still off ~15 s after the popup, show in DailyUpdatesBanner and Settings:
   a real link "Turn on daily email" + "Right-click → Open link in Incognito window, sign in, done (one time)".
3. Keep polling `triggers:status`; turn green ("Daily email is on") when it works.

Files: react-app/src/services/api.js (installUserTriggers), components/DailyUpdatesBanner.jsx, pages/SettingsPage.jsx.

## First sign-in: show a proper "creating your sheet" step for brand-new users (found 10 Oct 2026)

**What happens:** a brand-new user only sees "Connecting to Google" for 1–2 minutes while the server creates
their sheet and all tabs. It looks stuck. (Only the "my sheet is deleted – start a new one" path shows the
"Creating your new sheet… about 1–2 minutes" card.)

**Plan:** for a new registration, show the same card: "Setting up your Capital Friends sheet in your own
Google Drive. First time only, about 1–2 minutes. The app opens by itself." Ideally with 3 ticks
(Sheet created → Tabs ready → Loading your dashboard).

Files: react-app/src/context/AuthContext.jsx (init / data:init), the sheet-picker card component.

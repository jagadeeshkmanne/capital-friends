# drive.file migration (remove the "spreadsheets" scope)

Branch: drive-file-migration (this folder is a git worktree of ~/Desktop/capital-friends).
~/Desktop/capital-friends stays on main = the live app. Deploy only from there.

## Why
Google refused the "spreadsheets" scope and asked for drive.file + Google Picker.

## Proven in scope-test/ (see scope-test/README.md)
- SpreadsheetApp needs "spreadsheets" -> use Sheets API (Advanced Sheets) + Drive API instead.
- Adapter batches calls: 101 operations -> 5 API calls.
- Existing owners' sheets stay readable with drive.file (no action for them).
- Spouse: one-time Picker (filtered to the sheet name, ID checked), then works forever.
- Picker works without an API key (OAuth token + project number).
- Master MF/ATH/Stock data via public CSV (UrlFetch quota, not Sheets API).

## Plan
1. Adapter + getSpreadsheet() switch (Script Property USE_SHEETS_API + email allow-list) + flush in WebApp.js.
2. Formatting/structure calls (sheet setup), SpreadsheetApp.flush(), border/conditional-format rules.
3. UserRegistry: create via Sheets API, share via Drive API. Master data + fund search from cached public CSV.
4. React: remove "spreadsheets" from SCOPES, Picker step for spouses.
5. Test in cf-scope-test project, then live app with switch on for owner only, then everyone,
   then remove the scope from appsscript.json + React and re-submit in the EXISTING Cloud project.

## Test resources (delete when done)
- Cloud project cf-scope-test (944346365396), Apps Script "CF scope test (throwaway)",
  Drive sheets "CF scope test (API)", "CF adapter test", "CF legacy owner test", "CF picker test outside".

## Phase 1 status (5 Oct 2026)
- gas-webapp/SheetsAdapter.js: SpreadsheetApp look-alike on the Sheets API (batched reads/writes,
  dates as Date objects, formulas, formatting, merges, borders, protection, conditional formats,
  insert/delete rows/sheets, sharing via Drive API). Auto-flush outside API requests (triggers).
- Code.js: getSpreadsheet() switch (Script Property USE_SHEETS_API = '' | 'all' | emails),
  flushSheets_(), newConditionalFormatRule_(). WebApp.js: batch mode + flush per request.
- SpreadsheetApp.flush() -> flushSheets_() (9), rule builders -> newConditionalFormatRule_() (17).
- appsscript.json: Advanced Sheets v4 + Drive v3 services (scopes unchanged for now).
- deploy.sh / deploy-all.sh refuse to run unless on main.
- TEST ONLY: gas-webapp/TestAdapter.js (remove before merging to main).
- This worktree's gas-webapp/.clasp.json points to the TEST script
  1bTf3twn6pl-gdeOpaanjI5WhCevps_hiPkRtEAu2PIXASVBuIDfNOZqj (marked skip-worktree, never committed).

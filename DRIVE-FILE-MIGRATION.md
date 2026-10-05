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

## Test results in the TEST project (5 Oct 2026)
- TEST_1 setup: all 21 tabs identical (values, formulas, colours, widths, frozen rows, rules).
  18 API calls (was 132 before batching formats). Only cosmetic diff: date cells get a yyyy-mm-dd format.
- TEST_2 add members + bank: identical rows (9 API calls); only created/updated timestamps differ.
- TEST_3 load-all on test sheet: identical output (6 API calls).
- TEST_4 load-all on a COPY of the owner's real sheet: identical (only 0.185 s in one goal's created time).
- TEST_5 master download vs SpreadsheetApp, every cell: MF_Data 14,787 + Stock_Data 5,908 identical;
  MF_ATH identical except "Last Checked" (date-only format -> time of day not exported; app never reads it).
- TEST_6/6b WITHOUT the spreadsheets scope (manifest edited in the TEST editor only):
  new user sheet (21 tabs, 20 calls), add data, load-all, master refresh (13 calls), fund search,
  sheet owner lookup, email PDF, access check - all OK. onEdit trigger install is skipped (needs the scope;
  only reacted to edits made directly in the sheet).

## Phase 3/4 changes
- MasterSource.js: masterRows_() reads the public master DB via gviz JSON (UrlFetch) - raw values, exact.
- MasterDataSync copy/refresh use it; refresh clears data columns without reading the big tabs.
- FundCache: fund list in shared CacheService (old User Properties cache never fit 500 KB -> always fell back).
- Code.js: createUserSpreadsheet_, openSpreadsheetById_, spreadsheetAccess_ ('ok' | 'missing' | 'error').
- UserRegistry: create/share/remove via the active path. A MEMBER without access -> needsFilePicker,
  never a new sheet. Owner sheet recreated only on a definite 'missing'.
- WebApp.apiRouter: returns code 428 NEEDS_FILE_PICKER {spreadsheetId, sheetTitle, ownerEmail}.
- EmailReports.convertHTMLToPDF: in-memory blob conversion (no DriveApp).
- Adapter share keeps Google's share email (same as SpreadsheetApp.addEditor).
- Scope added: script.external_request (GAS manifest + React SCOPES). Live gold price was failing without it.
- React: services/picker.js + components/FilePickerGate.jsx; api.js retries after the pick.

## Rollout (live app, existing Cloud project)
1. Merge branch to main WITHOUT TestAdapter.js. Keep "spreadsheets" in appsscript.json + React for now.
   Script Property USE_SHEETS_API = owner email. Deploy GAS + React. Every user sees one consent
   screen (new external_request scope).
2. Owner uses the app for a few days. Then USE_SHEETS_API = all.
3. Remove "spreadsheets" from appsscript.json and React SCOPES, deploy, re-submit verification
   (drive.file + Picker justification). Spouses see the one-time Picker.
4. Rollback at any step: USE_SHEETS_API = '' (old path) while the scope is still present.

# drive.file scope test (throwaway)

Separate Apps Script project to check how Capital Friends can work with only the
`drive.file` scope (Google rejected `spreadsheets`). It does NOT touch the live app:
new script project, new deployment URL, its own Script Properties, test accounts only.

Files: appsscript.json (manifest, only drive.file), Code.gs, Page.html.

Steps
1. script.google.com -> New project "CF scope test" -> paste the 3 files
   (show appsscript.json: Project Settings -> "Show appsscript.json manifest file").
2. Deploy -> Test deployments -> Web app -> copy the /dev URL.
3. Owner (your Gmail): open URL, allow access, click 1, then 2 with the spouse test Gmail.
4. Spouse (second Gmail): open the same URL, click 3. (Picker step 4 needs a test
   Cloud project: API key + project number in Code.gs.)
5. Send the ✅/❌ results.

What we learn
- Does SpreadsheetApp.openById work with only drive.file on a sheet the app created?
- Does sharing work (Drive API permissions.create vs addEditor)?
- Spouse: no access before Picker, access after Picker, and it stays.

## Results

### Owner test, 5 Oct 2026 (jagadeesh.k.manne@gmail.com, only drive.file)
- FAIL SpreadsheetApp.create -> "Required permissions: .../auth/spreadsheets"
- OK   Sheets API Spreadsheets.create (app-created sheet)
- FAIL SpreadsheetApp.openById on the app's own sheet -> needs .../auth/spreadsheets
- OK   Sheets API values.update + values.get on that sheet
- OK   Drive API files.get on that sheet

Conclusion: with drive.file, SpreadsheetApp cannot be used at all (not even on the
app's own sheets). Everything must go through the Sheets API (Advanced Sheets
service) + Drive API. Plan: an adapter that mimics the SpreadsheetApp calls the app
uses, backed by the Sheets API, so most of gas-webapp stays unchanged.

### Adapter test (owner)
- RUN_adapterTest: 101 getRange/setValues/appendRow calls in app-style code -> 5 Sheets API requests, values and formulas correct.

### Sharing (owner -> Visali)
- OK   Drive API permissions.create on the app-created sheet (drive.file)
- FAIL SpreadsheetApp addEditor (needs spreadsheets)
- Visali before Picker: Sheets API "Requested entity was not found", Drive "File not found" (expected)

### Picker grant (owner, on a sheet made in Google Sheets, i.e. NOT by the app = same as spouse case)
- Test Cloud project cf-scope-test (944346365396), Testing mode, test users: owner + Visali. APIs: Sheets, Drive, Picker.
- Before Picker: Sheets API / Drive API -> not found.
- Picker works WITHOUT an API key (setOAuthToken + setAppId(project number)).
- setFileIds([id]) showed an empty list without an API key; setQuery('<exact sheet title>') shows only that sheet -> works.
- After picking: OK Sheets API write/read, OK Drive API files.get. drive.file grant confirmed.

Next: same Picker step as Visali (needs her own browser profile / incognito because web-app links
don't handle several signed-in accounts), then move the adapter into gas-webapp on this branch.

### Public master data (5 Oct 2026)
- Anonymous CSV fetch (gviz out:csv) of the master DB works: MF_Data 14,788 rows / 2.2 MB / 1.6 s,
  MF_ATH 15,226 rows / 2.0 MB, Stock_Data 5,909 rows / 0.5 MB. Uses UrlFetch quota, NOT the Sheets API quota.
- Plan: stop copying NAVs into user sheets; read master CSV once, cache, join at read time.

### LEGACY test = existing users' sheets (5 Oct 2026)
- Sheet created with SpreadsheetApp.create while the app HAD the spreadsheets scope, then scope removed:
  FAIL SpreadsheetApp.openById (confirms spreadsheets scope really gone)
  OK   Sheets API read, OK Sheets API write, OK Drive API files.get
- => Existing owners need NO action after the switch. Only existing spouses need the one-time Picker.

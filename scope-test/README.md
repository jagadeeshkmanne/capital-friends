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

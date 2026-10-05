/**
 * Capital Friends - drive.file scope test (THROWAWAY, separate from the live app)
 * Only scope for files: drive.file. No "spreadsheets" scope.
 *
 * Owner (you):  open the web app link -> "1. Create test sheet" -> "2. Share with spouse"
 * Spouse (2nd Gmail): open the same link -> "3. Try opening (before Picker)" -> "4. Pick the file" -> "5. Try again"
 */

// Fill these two only for the Picker step (from the test Cloud project). Leave empty for steps 1-3.
var PICKER_API_KEY = '';
var CLOUD_PROJECT_NUMBER = '';

var PROP_ID = 'testSheetId';

function doGet() {
  var t = HtmlService.createTemplateFromFile('Page');
  t.pickerKey = PICKER_API_KEY;
  t.appId = CLOUD_PROJECT_NUMBER;
  return t.evaluate().setTitle('CF drive.file test').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function whoAmI() { return Session.getActiveUser().getEmail(); }
function getToken() { return ScriptApp.getOAuthToken(); }
function getSheetId() { return PropertiesService.getScriptProperties().getProperty(PROP_ID) || ''; }

function try_(name, fn) {
  try { var v = fn(); return { step: name, ok: true, detail: String(v) }; }
  catch (e) { return { step: name, ok: false, detail: String(e && e.message || e) }; }
}

// 1. Owner: create a sheet with the app, then open / write / read it in 3 ways
function step1_createAndOpen() {
  var out = [];
  var id = null;
  out.push(try_('Create sheet with SpreadsheetApp.create', function () {
    var ss = SpreadsheetApp.create('CF scope test ' + new Date().toISOString().slice(0, 16));
    id = ss.getId(); return id;
  }));
  if (!id) out.push(try_('Create sheet with Sheets API instead', function () {
    var r = Sheets.Spreadsheets.create({ properties: { title: 'CF scope test (API) ' + new Date().toISOString().slice(0, 16) } });
    id = r.spreadsheetId; return id;
  }));
  if (id) PropertiesService.getScriptProperties().setProperty(PROP_ID, id);
  out = out.concat(checkAccess_(id, 'owner'));
  return out;
}

// 2. Owner: share the sheet with the spouse test account
function step2_share(email) {
  var id = getSheetId(); var out = [];
  out.push(try_('Share via Drive API permissions.create (drive.file)', function () {
    Drive.Permissions.create({ role: 'writer', type: 'user', emailAddress: email }, id, { sendNotificationEmail: false });
    return 'shared with ' + email;
  }));
  out.push(try_('Share via SpreadsheetApp addEditor (old way)', function () {
    SpreadsheetApp.openById(id).addEditor(email); return 'ok';
  }));
  return out;
}

// 3 / 5. Anyone: try to open the shared sheet
function step3_tryOpen() { return checkAccess_(getSheetId(), whoAmI()); }

function checkAccess_(id, who) {
  if (!id) return [{ step: 'No test sheet yet', ok: false, detail: 'Owner must run step 1 first' }];
  var stamp = who + ' @ ' + new Date().toLocaleString();
  return [
    try_('SpreadsheetApp.openById + write/read A1', function () {
      var sh = SpreadsheetApp.openById(id).getSheets()[0];
      sh.getRange('A1').setValue(stamp); return sh.getRange('A1').getValue();
    }),
    try_('Sheets API values.update + get (A2)', function () {
      Sheets.Spreadsheets.Values.update({ values: [[stamp]] }, id, 'A2', { valueInputOption: 'RAW' });
      return Sheets.Spreadsheets.Values.get(id, 'A2').values[0][0];
    }),
    try_('Drive API files.get (metadata)', function () { return Drive.Files.get(id, { fields: 'name' }).name; })
  ];
}

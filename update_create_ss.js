const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'gas-webapp', 'UserRegistry.js');
let code = fs.readFileSync(file, 'utf8');

const target = `  var spreadsheet = SpreadsheetApp.create('Capital Friends - ' + name);`;
const replacement = `  // Use Drive API via UrlFetchApp to create the spreadsheet using ONLY drive.file scope.
  // SpreadsheetApp.create() strictly requires the full spreadsheets scope at runtime.
  var token = ScriptApp.getOAuthToken();
  var url = 'https://www.googleapis.com/drive/v3/files';
  var payload = {
    name: 'Capital Friends - ' + name,
    mimeType: 'application/vnd.google-apps.spreadsheet'
  };
  var options = {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    throw new Error('Failed to create spreadsheet via Drive API: ' + response.getContentText());
  }
  var json = JSON.parse(response.getContentText());
  var spreadsheet = SpreadsheetApp.openById(json.id);`;

if (!code.includes(target)) {
  console.log('Target not found!');
} else {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Replaced successfully!');
}

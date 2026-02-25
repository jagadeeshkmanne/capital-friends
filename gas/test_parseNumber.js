/**
 * Change Google Sheets locale to India
 * This will format all numbers in Indian format (₹36,30,283.15 instead of ₹3,630,283.15)
 */
function changeLocaleToIndia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get current settings
  const currentLocale = ss.getSpreadsheetLocale();
  const currentTimezone = ss.getSpreadsheetTimeZone();

  Logger.log('Current Locale: ' + currentLocale);
  Logger.log('Current Timezone: ' + currentTimezone);

  // Change to India locale
  ss.setSpreadsheetLocale('en_IN');  // English (India)
  ss.setSpreadsheetTimeZone('Asia/Kolkata');  // Indian Standard Time

  // Verify changes
  Logger.log('New Locale: ' + ss.getSpreadsheetLocale());
  Logger.log('New Timezone: ' + ss.getSpreadsheetTimeZone());

  SpreadsheetApp.getUi().alert(
    'Locale Changed!',
    'Spreadsheet locale changed to India (en_IN)\n' +
    'Timezone changed to Asia/Kolkata\n\n' +
    'Numbers will now display in Indian format:\n' +
    '₹36,30,283.15 instead of ₹3,630,283.15\n\n' +
    'Refresh the page if numbers don\'t update immediately.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

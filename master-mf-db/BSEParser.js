/**
 * ============================================================================
 * BSE PARSER — Corporate announcements scanner for held stocks
 * ============================================================================
 *
 * Searches BSE corporate announcements for flagged keywords (auditor changes,
 * SEBI actions, management changes, fraud, penalties, etc.) and creates
 * MANUAL_REVIEW signals for human evaluation.
 *
 * API: BSE India AnnSubCategoryGetData endpoint
 * Fallback: None (skips stocks without BSE code)
 */

var BSE_ANNOUNCEMENT_KEYWORDS = [
  'auditor',
  'resignation',
  'sebi',
  'investigation',
  'credit rating',
  'downgrade',
  'kmp',
  'key managerial',
  'change in management',
  'fraud',
  'penalty'
];

/**
 * Parse BSE announcements for a single stock symbol.
 * Looks up BSE code from Stock_Data sheet, fetches last 7 days of
 * announcements, and returns any that match flagged keywords.
 *
 * @param {string} symbol - NSE symbol (e.g. 'RELIANCE')
 * @returns {Array<{keyword: string, headline: string, date: string, url: string}>}
 */
function parseBSEAnnouncements(symbol) {
  var results = [];

  try {
    // Look up BSE code from Stock_Data sheet
    var bseCode = _getBSECodeForSymbol(symbol);
    if (!bseCode) {
      Logger.log('BSEParser: No BSE code found for ' + symbol + ', skipping');
      return results;
    }

    // Build date range: last 7 days
    var today = new Date();
    var weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    var tz = Session.getScriptTimeZone();
    var toDate = Utilities.formatDate(today, tz, 'yyyyMMdd');
    var fromDate = Utilities.formatDate(weekAgo, tz, 'yyyyMMdd');

    var url = 'https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w'
      + '?strCat=Company%20Update'
      + '&strPrevDate=' + fromDate
      + '&strScrip=' + bseCode
      + '&strSearch='
      + '&strToDate=' + toDate
      + '&strType=C';

    Logger.log('BSEParser: Fetching announcements for ' + symbol + ' (BSE: ' + bseCode + ')');

    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();

    if (code !== 200) {
      Logger.log('BSEParser: HTTP ' + code + ' for ' + symbol);
      return results;
    }

    var body = response.getContentText();
    if (!body || body === '[]' || body === 'null') {
      return results;
    }

    var announcements = JSON.parse(body);
    if (!Array.isArray(announcements)) {
      // BSE sometimes wraps in { Table: [...] }
      if (announcements && Array.isArray(announcements.Table)) {
        announcements = announcements.Table;
      } else {
        Logger.log('BSEParser: Unexpected response format for ' + symbol);
        return results;
      }
    }

    for (var i = 0; i < announcements.length; i++) {
      var ann = announcements[i];
      // BSE fields: NEWSSUB (headline/subject), NEWS_DT (date), NSURL or ATTACHMENTNAME (url)
      var headline = String(ann.NEWSSUB || ann.HEAD || '');
      var annDate = String(ann.NEWS_DT || ann.DT_TM || '');
      var annUrl = String(ann.NSURL || ann.ATTACHMENTNAME || '');

      if (!annUrl && ann.NEWSID) {
        annUrl = 'https://www.bseindia.com/xml-data/corpfiling/AttachLive/' + ann.NEWSID + '.pdf';
      }

      var headlineLower = headline.toLowerCase();

      for (var k = 0; k < BSE_ANNOUNCEMENT_KEYWORDS.length; k++) {
        var keyword = BSE_ANNOUNCEMENT_KEYWORDS[k];
        if (headlineLower.indexOf(keyword) !== -1) {
          results.push({
            keyword: keyword,
            headline: headline,
            date: annDate,
            url: annUrl
          });
          // Only match the first keyword per announcement to avoid duplicates
          break;
        }
      }
    }

    Logger.log('BSEParser: Found ' + results.length + ' flagged announcement(s) for ' + symbol);

  } catch (e) {
    Logger.log('BSEParser: Error parsing announcements for ' + symbol + ': ' + e.message);
  }

  return results;
}

/**
 * Check BSE announcements for ALL active holdings.
 * Creates MANUAL_REVIEW signals for any keyword matches.
 */
function checkAnnouncementsForAllHoldings() {
  try {
    var holdings = _getActiveHoldings();
    if (!holdings || holdings.length === 0) {
      Logger.log('BSEParser: No active holdings to check');
      return;
    }

    var totalFlags = 0;

    for (var i = 0; i < holdings.length; i++) {
      var h = holdings[i];
      var symbol = h.symbol;

      if (!symbol) continue;

      try {
        var flags = parseBSEAnnouncements(symbol);

        for (var j = 0; j < flags.length; j++) {
          var flag = flags[j];

          _createSignal({
            type: 'MANUAL_REVIEW',
            symbol: symbol,
            name: h.name || symbol,
            triggerDetail: 'BSE announcement flagged [' + flag.keyword.toUpperCase() + ']: '
              + flag.headline
              + (flag.date ? ' (' + flag.date + ')' : '')
              + (flag.url ? ' | ' + flag.url : '')
          });

          totalFlags++;
        }

      } catch (e) {
        Logger.log('BSEParser: Error checking ' + symbol + ': ' + e.message);
      }

      // 500ms delay between API calls to avoid rate limiting
      if (i < holdings.length - 1) {
        Utilities.sleep(500);
      }
    }

    Logger.log('BSEParser: Checked ' + holdings.length + ' holdings, created ' + totalFlags + ' MANUAL_REVIEW signal(s)');

  } catch (e) {
    Logger.log('BSEParser: Fatal error in checkAnnouncementsForAllHoldings: ' + e.message);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Look up BSE code for a symbol from the Stock_Data sheet.
 * Stock_Data: Column A = Symbol, Column B = BSE Code
 *
 * @param {string} symbol - NSE symbol
 * @returns {string|null} BSE code or null if not found
 */
function _getBSECodeForSymbol(symbol) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.stockData);
    if (!sheet) {
      Logger.log('BSEParser: Stock_Data sheet not found');
      return null;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // A=Symbol, B=BSE Code

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === symbol.toUpperCase()) {
        var bseCode = String(data[i][1]).trim();
        return bseCode && bseCode !== '' && bseCode !== 'undefined' ? bseCode : null;
      }
    }

    return null;

  } catch (e) {
    Logger.log('BSEParser: Error looking up BSE code for ' + symbol + ': ' + e.message);
    return null;
  }
}

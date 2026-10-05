/**
 * ============================================================================
 * MASTER SOURCE - read the public master DB without the spreadsheets scope
 * ============================================================================
 *
 * The master DB is shared "Anyone with the link can view". Instead of opening
 * it with SpreadsheetApp (needs the full spreadsheets scope), we download a tab
 * through the public Google Visualization endpoint with UrlFetchApp:
 *   - no Sheets API quota is used (it's a plain URL fetch)
 *   - raw values (numbers, dates, booleans) come back exactly, not as display text
 *
 * masterRows_(tab, numCols) returns the same 2D array that
 *   openMasterDB().getSheetByName(tab).getRange(2, 1, lastRow - 1, numCols).getValues()
 * returned (header row skipped, '' for empty cells, Date objects for dates).
 *
 * Needs scope: https://www.googleapis.com/auth/script.external_request
 * ============================================================================
 */

function masterRows_(tabName, numCols) {
  // Note: cells formatted as date-only come back as whole days (time of day dropped).
  // In the master DB that is only MF_ATH "Last Checked", which the app never reads.
  var json = gvizFetch_(tabName, 'select *');

  var tz = Session.getScriptTimeZone();
  var cols = json.table.cols || [];
  var n = numCols ? Math.min(numCols, cols.length) : cols.length;
  var out = [];
  (json.table.rows || []).forEach(function (row) {
    var cells = row.c || [], vals = [];
    for (var i = 0; i < n; i++) {
      var cell = cells[i], type = cols[i] ? cols[i].type : 'string';
      if (!cell || cell.v === null || cell.v === undefined) { vals.push(''); continue; }
      vals.push(gvizValue_(cell.v, type, tz));
    }
    // skip fully empty rows (getValues() range ended at lastRow, so trailing blanks never appear)
    if (vals.some(function (v) { return v !== ''; })) out.push(vals);
  });
  return out;
}

function gvizFetch_(tabName, tq) {
  var url = 'https://docs.google.com/spreadsheets/d/' + CONFIG.masterDbId +
    '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(tabName) + '&tq=' + encodeURIComponent(tq);
  var resp = null, lastErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) break;
      lastErr = new Error('HTTP ' + resp.getResponseCode());
    } catch (e) { lastErr = e; }
    resp = null;
    Utilities.sleep(1000 * (attempt + 1));
  }
  if (!resp) throw new Error('Master DB download failed for ' + tabName + ': ' + (lastErr && lastErr.message));
  var text = resp.getContentText();
  var json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (json.status !== 'ok') {
    throw new Error('Master DB query error for ' + tabName + ': ' + JSON.stringify(json.errors || json.status).slice(0, 300));
  }
  return json;
}

function gvizValue_(v, type, tz) {
  if (type === 'date' || type === 'datetime') {
    var m = String(v).match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+)(?:,(\d+))?)?\)/);
    if (!m) return v;
    var wall = m[1] + '-' + pad2_(+m[2] + 1) + '-' + pad2_(m[3]) + ' ' + pad2_(m[4] || 0) + ':' + pad2_(m[5] || 0) + ':' + pad2_(m[6] || 0);
    var d = Utilities.parseDate(wall, tz, 'yyyy-MM-dd HH:mm:ss');
    if (m[7]) d = new Date(d.getTime() + (+m[7]));
    return d;
  }
  if (type === 'timeofday' && Array.isArray(v)) {
    // Sheets' time-only cells are dates on 30 Dec 1899
    var t = Utilities.parseDate('1899-12-30 ' + pad2_(v[0]) + ':' + pad2_(v[1]) + ':' + pad2_(v[2] || 0), tz, 'yyyy-MM-dd HH:mm:ss');
    return new Date(t.getTime() + (v[3] || 0));
  }
  return v;
}

function pad2_(x) { x = String(x); return x.length < 2 ? '0' + x : x; }

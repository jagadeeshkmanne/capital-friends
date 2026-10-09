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
 * Needs scope: https://www.googleapis.com/auth/script.external_request (sensitive - add it only
 * together with the Google verification). Without it, falls back to SpreadsheetApp.
 * ============================================================================
 */

function masterRows_(tabName, numCols) {
  // Note: cells formatted as date-only come back as whole days (time of day dropped).
  // In the master DB that is only MF_ATH "Last Checked", which the app never reads.
  var json;
  try {
    json = gvizFetch_(tabName, 'select *');
  } catch (e) {
    // Until Google approves script.external_request the app has no UrlFetch permission:
    // read the master DB the old way (needs the spreadsheets scope, still present then).
    if (/permission|Required permissions|not sufficient/i.test(String(e && e.message))) return masterRowsViaSpreadsheetApp_(tabName, numCols);
    throw e;
  }

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

/** Old way (same result as before the migration). */
function masterRowsViaSpreadsheetApp_(tabName, numCols) {
  var sh = SpreadsheetApp.openById(CONFIG.masterDbId).getSheetByName(tabName);
  if (!sh) throw new Error(tabName + ' sheet not found in master database');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = numCols ? Math.min(sh.getLastColumn(), numCols) : sh.getLastColumn();
  return sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
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
    } catch (e) {
      if (/permission|not sufficient/i.test(String(e && e.message))) throw e; // no retry: permission missing
      lastErr = e;
    }
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

// ---------------------------------------------------------------------------
// Shared cache of the master tabs, used by the Sheets API adapter to answer reads
// of a user's MutualFundData / MF_ATH_Data / StockMasterData tabs (which hold the
// same data) without downloading ~15,000 rows per request. Cached for 1 hour for
// all users (it is public data).
// ---------------------------------------------------------------------------
var USER_MASTER_TABS_ = { MutualFundData: ['MF_Data', 8], MF_ATH_Data: ['MF_ATH', 7], StockMasterData: ['Stock_Data', 10] };

function userMasterTabSource_(userTab) {
  var m = USER_MASTER_TABS_[userTab];
  if (!m) return null;
  var cache = CacheService.getScriptCache();
  // The stock list grows when the master DB adds stocks or ETFs: key its copy by the master row count
  // (checked at most every 10 minutes), so new rows show up within minutes instead of after the 1-hour cache.
  var ver = m[0] === 'Stock_Data' ? masterRowCount_(m[0], cache) : '';
  var key = 'mtab_v1:' + m[0] + (ver ? ':' + ver : '');
  var n = +cache.get(key + ':n');
  if (n) {
    var keys = []; for (var i = 0; i < n; i++) keys.push(key + ':' + i);
    var got = cache.getAll(keys), json = '', ok = true;
    for (var j = 0; j < n; j++) { if (got[keys[j]] === undefined || got[keys[j]] === null) { ok = false; break; } json += got[keys[j]]; }
    if (ok) return JSON.parse(json, function (k, v) { return v && typeof v === 'object' && v.$d !== undefined ? new Date(v.$d) : v; });
  }
  var rows = masterRows_(m[0], m[1]);
  try {
    var str = JSON.stringify(rows, function (k, v) { return this[k] instanceof Date ? { $d: this[k].getTime() } : v; });
    var put = {}, size = 90000, c = 0;
    for (var p = 0; p < str.length; p += size) put[key + ':' + (c++)] = str.substring(p, p + size);
    put[key + ':n'] = String(c);
    cache.putAll(put, 3600);
  } catch (e) { Logger.log('master tab cache put failed: ' + e); }
  return rows;
}

/** Master tab row count, cached 10 minutes ('' when it can't be read: then the plain 1-hour cache is used). */
function masterRowCount_(tabName, cache) {
  var k = 'mtab_cnt:' + tabName, hit = cache.get(k);
  if (hit) return hit;
  try {
    var json = gvizFetch_(tabName, 'select count(A)');
    var n = String((((json.table.rows || [])[0] || {}).c || [])[0] ? json.table.rows[0].c[0].v : '');
    if (n) cache.put(k, n, 600);
    return n;
  } catch (e) { return ''; }
}

/** Drop the shared copies of the master tabs (Settings → Refresh Now), so the next read downloads them fresh. */
function clearMasterTabCache_() {
  var cache = CacheService.getScriptCache(), keys = [];
  Object.keys(USER_MASTER_TABS_).forEach(function (u) { var t = USER_MASTER_TABS_[u][0]; keys.push('mtab_v1:' + t + ':n', 'mtab_cnt:' + t); });
  var cnt = cache.get('mtab_cnt:Stock_Data'); if (cnt) keys.push('mtab_v1:Stock_Data:' + cnt + ':n');
  cache.removeAll(keys);
}

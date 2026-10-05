/**
 * ============================================================================
 * TEST ADAPTER - compare the old SpreadsheetApp path with the Sheets API adapter
 * (TEST project only - "Capital Friends v2 (TEST - drive.file migration)")
 * ============================================================================
 * Run from the Apps Script editor, results in the Execution log.
 *
 *  TEST_1_setupBoth()      creates 2 fresh user sheets: one with the old path,
 *                          one with the adapter, and compares every tab
 *                          (names, header rows, all values).
 *  TEST_2_sampleData()     adds the same sample data to both (members, bank,
 *                          investment account, other investment, liability,
 *                          reminder) - old path vs adapter - and compares.
 *  TEST_3_loadAllBoth()    runs data:load-all on the OLD sheet with both paths
 *                          and compares the JSON the React app would receive.
 *  TEST_4_realCopy()       optional: same as 3 on a COPY of a real sheet
 *                          (Script Property TEST_REAL_SHEET_ID). Values are
 *                          not printed, only where they differ.
 */

function testProps_() { return PropertiesService.getScriptProperties(); }

function runPath_(useApi, sheetId, fn) {
  _currentUserSpreadsheetId = sheetId;
  _useSheetsApi = useApi;
  _ssAdapter = null; _ssAdapterId = null;
  _inApiRequest = true;
  allPortfoliosCache = null;
  SHEETS_API_CALLS = 0;
  var t0 = Date.now();
  var out = fn();
  flushSheets_();
  return { out: out, ms: Date.now() - t0, calls: SHEETS_API_CALLS };
}

function TEST_1_setupBoth() {
  var stamp = new Date().toISOString().slice(0, 16);
  // Reuse the old-path sheet from an earlier run (it never changes); only the
  // adapter sheet is made fresh each time.
  var oldSs = null, r1 = { ms: 0, out: 'reused existing old-path sheet' };
  var prevOld = testProps_().getProperty('TEST_OLD_ID');
  if (prevOld) { try { oldSs = SpreadsheetApp.openById(prevOld); oldSs.getSheetByName('FamilyMembers').getLastRow(); } catch (e) { oldSs = null; } }
  if (!oldSs) {
    oldSs = SpreadsheetApp.create('CF TEST old-path ' + stamp);
    r1 = runPath_(false, oldSs.getId(), function () { return createAllSheets(); });
    testProps_().setProperty('TEST_OLD_ID', oldSs.getId());
  }
  var newSs = SheetsAdapter.create('CF TEST adapter ' + stamp);
  var r2 = runPath_(true, newSs.getId(), function () { return createAllSheets(); });
  testProps_().setProperty('TEST_OLD_ID', oldSs.getId());
  testProps_().setProperty('TEST_NEW_ID', newSs.getId());
  Logger.log('Old path setup: ' + r1.ms + ' ms, result ' + JSON.stringify(r1.out).slice(0, 300));
  Logger.log('Adapter setup:  ' + r2.ms + ' ms, ' + r2.calls + ' Sheets API calls, result ' + JSON.stringify(r2.out).slice(0, 300));
  Logger.log('Now run TEST_1b_compare (separate run, the 6-minute limit is too short for both).');
}

function TEST_1b_compare() {
  compareSheets_(testProps_().getProperty('TEST_OLD_ID'), testProps_().getProperty('TEST_NEW_ID'), ['Sheet1']);
}

function TEST_2_sampleData() {
  var oldId = testProps_().getProperty('TEST_OLD_ID'), newId = testProps_().getProperty('TEST_NEW_ID');
  var script = function () {
    var log = [];
    // obviously fake test identifiers (test sheets only)
    var m1 = safeTry_(function () { return addFamilyMember({ memberName: 'Test Owner', relationship: 'Self', email: 'owner@example.com', mobile: '9000000001', pan: 'ABCDE1234F', aadhar: '234567890123', dateOfBirth: '1984-05-10', includeInEmailReports: true }); });
    var m2 = safeTry_(function () { return addFamilyMember({ memberName: 'Test Spouse', relationship: 'Spouse', email: 'spouse@example.com', mobile: '9000000002', pan: 'FGHIJ5678K', aadhar: '345678901234', dateOfBirth: '1988-02-01' }); });
    log.push(m1, m2);
    var memberId = m1 && (m1.memberId || (m1.data && m1.data.memberId));
    log.push(safeTry_(function () { return addBankAccount({ memberId: memberId, accountName: 'Test Savings', bankName: 'Test Bank', accountNumber: '000011112222', accountType: 'Savings', ifscCode: 'TEST0000001', branchName: 'Test Branch' }); }));
    log.push(safeTry_(function () { return getAllFamilyMembers().length + ' members, ' + getAllBankAccounts().length + ' banks'; }));
    return log;
  };
  var a = runPath_(false, oldId, script), b = runPath_(true, newId, script);
  Logger.log('Old path sample data: ' + JSON.stringify(a.out).slice(0, 400));
  Logger.log('Adapter sample data:  ' + JSON.stringify(b.out).slice(0, 400) + '  [' + b.calls + ' API calls]');
  compareSheets_(oldId, newId, ['Sheet1', 'StockMasterData', 'MF_ATH_Data', 'MutualFundData'], /ID$|Id$|Created|Updated|Date Added/);
}

function TEST_3_loadAllBoth() {
  var id = testProps_().getProperty('TEST_OLD_ID');
  compareLoadAll_(id, true);
}

function TEST_4_realCopy() {
  var realId = testProps_().getProperty('TEST_REAL_SHEET_ID') || '1FhHhQdFP4Mq2lYnepEIhWx-JIfDL_vBvr3HUSEbosow'; // owner's sheet, read-only (a copy is tested)
  if (!realId) { Logger.log('Set Script Property TEST_REAL_SHEET_ID first'); return; }
  var copyId = testProps_().getProperty('TEST_COPY_ID');
  if (!copyId) {
    copyId = SpreadsheetApp.openById(realId).copy('CF TEST copy of real sheet ' + new Date().toISOString().slice(0, 16)).getId();
    testProps_().setProperty('TEST_COPY_ID', copyId);
  }
  compareLoadAll_(copyId, false);
}

function compareLoadAll_(id, showValues) {
  var a = runPath_(false, id, loadAllData), b = runPath_(true, id, loadAllData);
  var A = JSON.parse(JSON.stringify(a.out)), B = JSON.parse(JSON.stringify(b.out));
  var diffs = [];
  diff_(A, B, '', diffs, showValues);
  Logger.log('load-all: old ' + a.ms + ' ms | adapter ' + b.ms + ' ms, ' + b.calls + ' Sheets API calls');
  Object.keys(A).forEach(function (k) { Logger.log('  ' + k + ': ' + (Array.isArray(A[k]) ? A[k].length + ' rows' : typeof A[k])); });
  Logger.log(diffs.length ? ('DIFFERENCES (' + diffs.length + '):\n' + diffs.slice(0, 60).join('\n')) : '✅ IDENTICAL output');
}

function diff_(a, b, path, out, showValues) {
  if (out.length > 200) return;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    out.push(path + ': type ' + describe_(a, showValues) + ' vs ' + describe_(b, showValues)); return;
  }
  if (a && typeof a === 'object') {
    var keys = {}; Object.keys(a).forEach(function (k) { keys[k] = 1; }); Object.keys(b).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) { diff_(a[k], b[k], path + '.' + k, out, showValues); });
    return;
  }
  if (a !== b) {
    if (typeof a === 'number' && Math.abs(a - b) < 1e-9) return;
    var iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/;
    if (!showValues && typeof a === 'string' && iso.test(a) && iso.test(b)) { out.push(path + ': dates differ by ' + ((Date.parse(b) - Date.parse(a)) / 1000) + ' s'); return; }
    out.push(path + ': ' + describe_(a, showValues) + ' vs ' + describe_(b, showValues));
  }
}
function describe_(v, show) {
  if (show) return JSON.stringify(v === undefined ? '(missing)' : v).slice(0, 60);
  if (v === undefined) return '(missing)';
  return typeof v + (typeof v === 'string' ? '[' + v.length + ']' : '');
}

function compareSheets_(oldId, newId, ignoreTabs, ignoreHeaderRegex) {
  var o = SpreadsheetApp.openById(oldId), n = SpreadsheetApp.openById(newId);
  var on = o.getSheets().map(function (s) { return s.getName(); }).filter(function (x) { return ignoreTabs.indexOf(x) < 0; });
  var nn = n.getSheets().map(function (s) { return s.getName(); }).filter(function (x) { return ignoreTabs.indexOf(x) < 0; });
  Logger.log('Tabs old (' + on.length + '): ' + on.join(', '));
  if (on.join('|') !== nn.join('|')) Logger.log('❌ Tabs differ. Adapter (' + nn.length + '): ' + nn.join(', '));
  var problems = 0;
  on.forEach(function (t) {
    var os = o.getSheetByName(t), ns = n.getSheetByName(t);
    if (!ns) return;
    var ov = os.getDataRange().getValues(), nv = ns.getDataRange().getValues();
    var of = os.getDataRange().getFormulas(), nf = ns.getDataRange().getFormulas();
    var rows = Math.max(ov.length, nv.length), cols = Math.max(ov[0].length, nv[0].length), d = [];
    var hdr = ov[0] || [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      if (ignoreHeaderRegex && ignoreHeaderRegex.test(String(hdr[c] || '')) && r > 0) continue;
      var x = (ov[r] || [])[c], y = (nv[r] || [])[c], fx = (of[r] || [])[c], fy = (nf[r] || [])[c];
      if (x instanceof Date) x = x.getTime(); if (y instanceof Date) y = y.getTime();
      if (String(fx || '') !== String(fy || '')) d.push('R' + (r + 1) + 'C' + (c + 1) + ' formula "' + String(fx).slice(0, 40) + '" vs "' + String(fy).slice(0, 40) + '"');
      else if (String(x === undefined ? '' : x) !== String(y === undefined ? '' : y)) d.push('R' + (r + 1) + 'C' + (c + 1) + ' "' + String(x).slice(0, 30) + '" vs "' + String(y).slice(0, 30) + '"');
    }
    var fmt = sameFormatting_(os, ns);
    if (d.length || fmt) { problems++; Logger.log('❌ ' + t + ': ' + d.length + ' value diffs' + (fmt ? ', ' + fmt : '') + (d.length ? '\n   ' + d.slice(0, 8).join('\n   ') : '')); }
    else Logger.log('✅ ' + t + ' (' + ov.length + ' rows) identical');
  });
  Logger.log(problems ? ('❌ ' + problems + ' tabs differ') : '✅ ALL TABS IDENTICAL');
}

function sameFormatting_(a, b) {
  var issues = [];
  if (a.getFrozenRows() !== b.getFrozenRows()) issues.push('frozen ' + a.getFrozenRows() + '/' + b.getFrozenRows());
  if (String(a.getTabColor()) !== String(b.getTabColor())) issues.push('tab color ' + a.getTabColor() + '/' + b.getTabColor());
  if (a.isSheetHidden() !== b.isSheetHidden()) issues.push('hidden ' + a.isSheetHidden() + '/' + b.isSheetHidden());
  var cols = Math.min(a.getMaxColumns(), b.getMaxColumns(), 20), w = [];
  for (var c = 1; c <= cols; c++) if (a.getColumnWidth(c) !== b.getColumnWidth(c)) w.push(c + ':' + a.getColumnWidth(c) + '/' + b.getColumnWidth(c));
  if (w.length) issues.push('col widths ' + w.slice(0, 5).join(' '));
  var lc = Math.max(1, Math.min(a.getLastColumn(), 20));
  var ra = a.getRange(1, 1, Math.min(3, a.getMaxRows()), lc), rb = b.getRange(1, 1, Math.min(3, b.getMaxRows()), lc);
  if (JSON.stringify(ra.getBackgrounds()) !== JSON.stringify(rb.getBackgrounds())) issues.push('header backgrounds');
  var na = ra.getNumberFormats(), nb = rb.getNumberFormats();
  outer: for (var r = 0; r < na.length; r++) for (var c = 0; c < na[r].length; c++) if (na[r][c] !== nb[r][c]) { issues.push('number format R' + (r + 1) + 'C' + (c + 1) + ' "' + na[r][c] + '" vs "' + nb[r][c] + '"'); break outer; }
  if (JSON.stringify(ra.getFontWeights()) !== JSON.stringify(rb.getFontWeights())) issues.push('header bold');
  if (a.getConditionalFormatRules().length !== b.getConditionalFormatRules().length) issues.push('cond. rules ' + a.getConditionalFormatRules().length + '/' + b.getConditionalFormatRules().length);
  return issues.join(', ');
}

function safeTry_(fn) { try { return fn(); } catch (e) { return 'ERROR: ' + e.message; } }

/** Master data via public download vs SpreadsheetApp (TEST project still has the spreadsheets scope). */
function TEST_5_masterSource() {
  var master = SpreadsheetApp.openById(CONFIG.masterDbId);
  [[CONFIG.masterMFDataSheet, 8], [CONFIG.masterATHSheet, 7], [CONFIG.masterStockDataSheet, 10]].forEach(function (x) {
    var t0 = Date.now(), got = masterRows_(x[0], x[1]), ms = Date.now() - t0;
    var sh = master.getSheetByName(x[0]), lr = sh.getLastRow(), lc = Math.min(sh.getLastColumn(), x[1]);
    var exp = sh.getRange(2, 1, lr - 1, lc).getValues().filter(function (r) { return r.some(function (v) { return v !== ''; }); });
    var d = [], types = {}, timeDropped = {};
    if (got.length !== exp.length) d.push('rows ' + exp.length + ' vs ' + got.length);
    if (got[0] && got[0].length !== lc) d.push('cols ' + lc + ' vs ' + got[0].length);
    for (var r = 0; r < Math.min(got.length, exp.length) && d.length < 12; r++) for (var c = 0; c < lc; c++) {
      var a = exp[r][c], b = got[r][c];
      if (a instanceof Date && b instanceof Date) {
        var tz = Session.getScriptTimeZone(), day = function (x) { return Utilities.formatDate(x, tz, 'yyyy-MM-dd'); };
        if (a.getTime() !== b.getTime() && day(a) === day(b) && Utilities.formatDate(b, tz, 'HH:mm:ss') === '00:00:00') { timeDropped[c + 1] = (timeDropped[c + 1] || 0) + 1; continue; }
        if (a.getTime() !== b.getTime()) d.push('R' + (r + 2) + 'C' + (c + 1) + ' date ' + a.toISOString() + ' vs ' + b.toISOString()); continue; }
      if (typeof a !== typeof b || (a instanceof Date) !== (b instanceof Date)) { types[c + 1] = (types[c + 1] || 0) + 1; if (types[c + 1] <= 2) d.push('R' + (r + 2) + 'C' + (c + 1) + ' type ' + (a instanceof Date ? 'Date' : typeof a) + ' "' + String(a).slice(0, 25) + '" vs ' + (b instanceof Date ? 'Date' : typeof b) + ' "' + String(b).slice(0, 25) + '"'); continue; }
      if (typeof a === 'number' ? Math.abs(a - b) > 1e-9 : a !== b) d.push('R' + (r + 2) + 'C' + (c + 1) + ' "' + String(a).slice(0, 25) + '" vs "' + String(b).slice(0, 25) + '"');
    }
    Object.keys(timeDropped).forEach(function (c) { Logger.log('   note: ' + x[0] + ' column ' + c + ' has a date-only format; time of day not downloaded in ' + timeDropped[c] + ' cells (same date)'); });
    Logger.log((d.length ? '❌ ' : '✅ ') + x[0] + ': ' + got.length + ' rows downloaded in ' + ms + ' ms' + (d.length ? '\n   ' + d.join('\n   ') : ', identical to SpreadsheetApp'));
  });
}

/**
 * TEST_6: the whole flow WITHOUT the spreadsheets permission (remove it from the TEST
 * project's manifest before running). Uses only the new path - no SpreadsheetApp.
 *   part 1: new user sheet + sample data + load-all
 *   part 2 (TEST_6b): master data refresh + owner lookup + email PDF
 */
function TEST_6_noScope() {
  var res = noScopeStep_('create sheet', function () {
    var ss = createUserSpreadsheet_('CF TEST no-scope ' + new Date().toISOString().slice(0, 16));
    testProps_().setProperty('TEST_NOSCOPE_ID', ss.getId());
    _currentUserSpreadsheetId = ss.getId();
    var r = createAllSheets();
    var book = getSpreadsheet(), s1 = book.getSheetByName('Sheet1');
    if (s1 && book.getSheets().length > 1) book.deleteSheet(s1);
    flushSheets_();
    return (r && r.created ? r.created.length : '?') + ' tabs';
  });
  if (!res) return;
  noScopeStep_('add 2 members + bank', function () {
    var m = addFamilyMember({ memberName: 'Test Owner', relationship: 'Self', email: 'owner@example.com', mobile: '9000000001', pan: 'ABCDE1234F', aadhar: '234567890123', dateOfBirth: '1984-05-10', includeInEmailReports: true });
    addFamilyMember({ memberName: 'Test Spouse', relationship: 'Spouse', email: 'spouse@example.com', mobile: '9000000002', pan: 'FGHIJ5678K', aadhar: '345678901234', dateOfBirth: '1988-02-01' });
    addBankAccount({ memberId: m.memberId, accountName: 'Test Savings', bankName: 'Test Bank', accountNumber: '000011112222', accountType: 'Savings', ifscCode: 'TEST0000001', branchName: 'Test Branch' });
    flushSheets_();
    return getAllFamilyMembers().length + ' members, ' + getAllBankAccounts().length + ' banks';
  });
  noScopeStep_('load-all', function () {
    var d = JSON.parse(JSON.stringify(loadAllData()));
    return Object.keys(d).map(function (k) { return k + ':' + (Array.isArray(d[k]) ? d[k].length : typeof d[k]); }).join(' ');
  });
}

function TEST_6b_noScope() {
  _currentUserSpreadsheetId = testProps_().getProperty('TEST_NOSCOPE_ID');
  noScopeStep_('master data refresh (MF + ATH + stocks)', function () { var r = refreshAllMasterData(); return JSON.stringify(r).slice(0, 200); });
  noScopeStep_('fund search', function () { var r = searchFundsWithCache('nifty'); return (r && r.length !== undefined ? r.length : JSON.stringify(r).slice(0, 100)) + ' results'; });
  noScopeStep_('sheet owner (reminders)', function () { return getSpreadsheet().getOwner().getEmail() ? 'found' : 'empty'; });
  noScopeStep_('email PDF', function () { var b = convertHTMLToPDF('<h1>Capital Friends test</h1><p>PDF without Drive</p>', 'cf-test'); return b.getBytes().length + ' bytes'; });
  noScopeStep_('user check (owner access)', function () { return spreadsheetAccess_(_currentUserSpreadsheetId); });
}

function noScopeStep_(name, fn) {
  _useSheetsApi = true; _inApiRequest = true; SHEETS_API_CALLS = 0;
  var t0 = Date.now();
  try {
    var out = fn();
    flushSheets_();
    Logger.log('✅ ' + name + ': ' + out + '  (' + (Date.now() - t0) + ' ms, ' + SHEETS_API_CALLS + ' API calls)');
    return out || true;
  } catch (e) {
    Logger.log('❌ ' + name + ': ' + e.message + '\n' + String(e.stack || '').split('\n').slice(0, 6).join('\n'));
    return null;
  }
}

/** TEST_7: create a portfolio (17 conditional-format rules) on the old sheet (old path) and the adapter sheet, compare. */
function TEST_7_portfolio() {
  var oldId = testProps_().getProperty('TEST_OLD_ID'), newId = testProps_().getProperty('TEST_NEW_ID');
  var make = function () { var mem = getAllFamilyMembers()[0] || {}; var banks = getAllBankAccounts(); var ia = addInvestmentAccount({ accountName: 'Test Demat', accountType: 'Demat + Trading', platformBroker: 'Test Broker', memberId: mem.memberId, bankAccountId: banks[0] && banks[0].accountId, registeredEmail: 'owner@example.com', registeredPhone: '9000000001' }); var iaId = ia && (ia.accountId || ia.investmentAccountId || (ia.data && ia.data.accountId)); return { ia: ia, pf: processAddPortfolio({ portfolioName: 'Test Portfolio', investmentAccount: iaId || 'Test Demat', initialInvestment: 0, sipTarget: 1000, lumpsumTarget: 0, rebalanceThreshold: 5 }) }; };
  var a = runPath_(false, oldId, function () { return safeTry_(make); });
  var b = runPath_(true, newId, function () { return safeTry_(make); });
  Logger.log('old: ' + JSON.stringify(a.out).slice(0, 300));
  Logger.log('new: ' + JSON.stringify(b.out).slice(0, 300) + '  [' + b.calls + ' API calls, ' + b.ms + ' ms]');
  var o = SpreadsheetApp.openById(oldId), n = SpreadsheetApp.openById(newId);
  var on = o.getSheets().map(function (s) { return s.getName(); }), nn = n.getSheets().map(function (s) { return s.getName(); });
  var keep = on.filter(function (t) { return /^PFL/.test(t) || t === 'AllPortfolios'; });
  Logger.log('portfolio tabs old: ' + keep.join(', ') + ' | new: ' + nn.filter(function (t) { return /^PFL/.test(t); }).join(', '));
  compareSheets_(oldId, newId, on.filter(function (t) { return keep.indexOf(t) < 0; }), /ID$|Id$|Created|Updated|Date Added/);
}

/**
 * ============================================================================
 * TEST_8: every WRITE action of routeAction(), same script on both sheets
 * ============================================================================
 * Runs one scripted create/update/delete sequence through routeAction() on the
 * old-path sheet (SpreadsheetApp, TEST_OLD_ID) and on the adapter sheet (Sheets
 * API, TEST_NEW_ID), then the read actions, then logs both side by side and
 * compares every tab with compareSheets_.
 *
 *   ❌ = success / error / throw differs between the paths
 *   ⚠️ = both "ok" (or both failed) but the result differs (IDs + volatile dates stripped)
 *   ✅ = same
 *
 * Params are the shapes the React app sends (forms -> DataContext -> api.js).
 * Where React and GAS disagree on field names (MF redeem / switch) the step sends
 * both spellings, and an extra step sends the exact React shape.
 *
 * 6-minute limit: the work is split into phases (old path, new path, report,
 * compare). Each phase only starts when there is enough time left; the rest is
 * kept in the script cache (6 h). If the log says so, run TEST_8b_continue.
 * The Sheets API allows ~60 reads/min per user, so the adapter phase usually
 * needs its own run.
 *
 * Every step is followed by flushSheets_() and (T8_FRESH_PER_STEP) a fresh
 * adapter, like a new apiRouter request. Set T8_FRESH_PER_STEP = false to keep
 * the adapter's in-memory tab cache across steps (stress test for the cache).
 *
 * Run on the TEST sheets only: it adds fake data (names "Test ...") every run.
 */
var T8_FRESH_PER_STEP = true;
var T8_BUDGET_MS = 290000;       // stop starting new steps after ~5 min (one slow step can take 40 s)
var T8_PATH_NEEDS_MS = 200000;   // only start a path phase with >= 200 s left
var T8_COMPARE_NEEDS_MS = 100000;
var T8_FUND_A = '120503', T8_FUND_B = '118989';
var T8_READS = ['data:load-all', 'goals:list', 'mf-holdings:list', 'mf-transactions:list', 'stock-holdings:list-all', 'reminders:list', 'settings:list'];
var T8_VOLATILE_KEY = /(Id|ID|Ids)$|^id$|^(createdDate|createdAt|created|lastUpdated|updatedAt|timestamp|lastSentDate|nextSendDate|stack)$/;
var T8_ID_RE = /\b(?:[A-Z]{2,5}-)+\d{3,}\b/g; // FM-001, PFL-STK-002, TXN-STK-010, POL-INS-001, LIA-1696..., GOAL-003

function TEST_8_crudAll() { crud8_(true); }
function TEST_8b_continue() { crud8_(false); }
function TEST_8c_compare() {
  compareSheets_(testProps_().getProperty('TEST_OLD_ID'), testProps_().getProperty('TEST_NEW_ID'),
    ['Sheet1', 'StockMasterData', 'MF_ATH_Data', 'MutualFundData'], /ID$|Id$|Created|Updated|Date Added|Last|Timestamp|Time/);
}

function crud8_(fresh) {
  var t0 = Date.now();
  var oldId = testProps_().getProperty('TEST_OLD_ID'), newId = testProps_().getProperty('TEST_NEW_ID');
  if (!oldId || !newId || oldId === newId) { Logger.log('TEST_OLD_ID / TEST_NEW_ID missing or equal - run TEST_1_setupBoth (+ TEST_2_sampleData) first'); return; }
  var state = fresh ? null : t8Get_('state');
  if (!state) {
    if (!fresh) { Logger.log('No saved TEST_8 state (cache expired?). Run TEST_8_crudAll.'); return; }
    // one run stamp for both paths, so both sheets get the same names / PAN / account numbers
    state = { run: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'ddHHmm'), oldId: oldId, newId: newId, done: {} };
    t8Put_('state', state);
  }
  if (state.oldId !== oldId || state.newId !== newId) { Logger.log('Sheet IDs changed since TEST_8_crudAll started - run TEST_8_crudAll again'); return; }
  Logger.log('TEST_8 run ' + state.run + ' | done so far: ' + (Object.keys(state.done).join(', ') || 'nothing'));

  var paths = [['old', false, oldId], ['new', true, newId]];
  for (var i = 0; i < paths.length; i++) {
    var key = paths[i][0];
    if (state.done[key]) continue;
    if (T8_BUDGET_MS - (Date.now() - t0) < T8_PATH_NEEDS_MS) return t8Later_();
    var r = t8RunPath_(paths[i][1], paths[i][2], state.run, t0, key);
    if (r.out.partial) { Logger.log((key === 'old' ? 'Old path' : 'Adapter') + ': ' + r.out.stepsDone + ' steps done so far'); return t8Later_(); }
    t8Put_(key, r.out);
    state.done[key] = { ms: r.ms, calls: r.calls };
    t8Put_('state', state);
    var skipped = r.out.steps.filter(function (s) { return s.skipped; }).length;
    Logger.log((key === 'old' ? 'Old path' : 'Adapter') + ' sequence: ' + r.ms + ' ms' + (paths[i][1] ? ', ' + r.calls + ' Sheets API calls' : '') +
      (skipped ? ' - ' + skipped + ' steps SKIPPED (time limit), results incomplete' : ''));
  }
  if (!state.done.report) {
    var A = t8Get_('old'), B = t8Get_('new');
    if (!A || !B) { Logger.log('Saved results missing (cache expired?). Run TEST_8_crudAll on fresh sheets.'); return; }
    t8Report_(A, B, state);
    state.done.report = true;
    t8Put_('state', state);
  }
  if (!state.done.compare) {
    if (T8_BUDGET_MS - (Date.now() - t0) < T8_COMPARE_NEEDS_MS) return t8Later_('(or TEST_8c_compare)');
    TEST_8c_compare();
    state.done.compare = true;
    t8Put_('state', state);
  }
  Logger.log('TEST_8 complete (run ' + state.run + ').');
}

function t8Later_(extra) { Logger.log('⏸ Time budget used. Run TEST_8b_continue ' + (extra || '') + ' to go on (state is kept in the script cache for 6 h).'); }

/** One path: the whole sequence + read actions inside ONE runPath_ call. */
function t8RunPath_(useApi, sheetId, run, t0, key) {
  // progress is saved after every step, so a path can continue in the next run
  var prog = t8Get_('prog_' + key) || { i: 0, out: [], ids: {}, fund: {}, stockName: {} };
  return runPath_(useApi, sheetId, function () {
    var ctx = {
      run: run, ids: prog.ids, fund: prog.fund, stockName: prog.stockName,
      user: { email: 'owner@example.com', role: 'owner', spreadsheetId: sheetId },
      pan: 'TSTZZ' + run.slice(-4) + 'Q',     // unique per run: dup checks include inactive rows
      aadhar: '8' + run + '00001',             // 12 digits
      acct: '7' + run + '00042'                // 12 digits
    };
    var steps = t8Steps_(), out = prog.out, reads = {};
    for (var si = prog.i; si < steps.length; si++) {
      var s = steps[si];
      var rec = { name: s.name, action: s.action || '(setup)' };
      if (Date.now() - t0 > T8_BUDGET_MS) {
        prog.i = si; t8Put_('prog_' + key, prog);
        return { partial: true, stepsDone: si };
      }
      var c0 = SHEETS_API_CALLS, s0 = Date.now();
      try {
        var res = s.fn ? s.fn(ctx) : routeAction(s.action, s.params ? s.params(ctx) : {}, ctx.user);
        t8EndRequest_();
        rec.res = t8Norm_(res);
        rec.status = t8Status_(res);
        if (s.save) {
          try { s.save(res, ctx); } catch (e) { rec.saveErr = String(e && e.message || e).slice(0, 200); }
          t8EndRequest_();
        }
      } catch (e) {
        rec.threw = String(e && e.message || e).slice(0, 300);
        try { t8EndRequest_(); } catch (e2) { rec.flushErr = String(e2 && e2.message || e2).slice(0, 200); }
      }
      rec.ms = Date.now() - s0;
      rec.calls = SHEETS_API_CALLS - c0;
      out.push(rec);
      prog.i = si + 1; t8Put_('prog_' + key, prog);
    }
    if (Date.now() - t0 > T8_BUDGET_MS - 60000) { return { partial: true, stepsDone: prog.i }; }
    T8_READS.forEach(function (a) {
      if (Date.now() - t0 > T8_BUDGET_MS) { reads[a] = { __skipped: true }; return; }
      try { reads[a] = t8Norm_(routeAction(a, {}, ctx.user)); }
      catch (e) { reads[a] = { __threw: String(e && e.message || e).slice(0, 300) }; }
      try { t8EndRequest_(); } catch (e3) { }
    });
    return { steps: out, reads: reads, ids: ctx.ids };
  });
}

/** End of one "request": send queued writes; optionally start the next step with a fresh adapter. */
function t8EndRequest_() {
  flushSheets_();
  if (T8_FRESH_PER_STEP) { _ssAdapter = null; _ssAdapterId = null; allPortfoliosCache = null; }
}

// ---------------------------------------------------------------------------
// The scripted sequence. params(ctx) builds the request from this path's own
// earlier results (ctx.ids); save(res, ctx) records new IDs.
// ---------------------------------------------------------------------------
function t8Steps_() {
  var A = T8_FUND_A, B = T8_FUND_B;
  function own(ctx) { return ctx.ids.ownerId; }
  function member(ctx, edited) {
    // MemberForm: { ...form, pan: upper, dynamicFields }
    return { memberName: 'Test Temp ' + ctx.run + (edited ? ' Edited' : ''), relationship: 'Brother', dob: '1990-01-15',
      pan: ctx.pan, aadhar: ctx.aadhar, email: 'temp' + ctx.run + '@example.com', mobile: edited ? '9000000004' : '9000000003',
      includeInEmailReports: false, status: 'Active', dynamicFields: { DOB: '1990-01-15', 'Test Note': 'fake data' } };
  }
  function bank(ctx, edited) {
    return { accountName: 'Test Bank Acct ' + ctx.run, memberId: own(ctx), bankName: 'Test Bank', accountNumber: ctx.acct,
      ifscCode: 'TEST0000002', branchName: edited ? 'Test Branch 2' : 'Test Branch', accountType: 'Savings', status: 'Active' };
  }
  function invAcct(ctx, edited) {
    return { accountName: 'Test Demat ' + ctx.run, memberId: own(ctx), bankAccountId: ctx.ids.bankId, accountType: 'Demat + Trading',
      platformBroker: edited ? 'Test Broker 2' : 'Test Broker', accountClientId: 'TCL' + ctx.run, dematDpId: '',
      registeredEmail: 'owner@example.com', registeredPhone: '9000000001', status: 'Active' };
  }
  function mfPortfolio(ctx, name, sip, lump) {
    // MFPortfolioForm: { ...form, investmentAccount: "<account name> - <broker>", numbers }
    return { portfolioName: name, investmentAccountId: ctx.ids.iaId, ownerId: own(ctx),
      investmentAccount: 'Test Demat ' + ctx.run + ' - Test Broker 2',
      initialInvestment: 0, sipTarget: sip, lumpsumTarget: lump, rebalanceThreshold: 5, skipRebalance: false };
  }
  function invest(ctx, code, type, date, units, price) {
    // MFInvestForm (strings from the inputs)
    return { portfolioId: ctx.ids.pfId, fundCode: code, fundName: ctx.fund[code] || '', transactionType: type,
      purchaseDate: date, units: units, avgPrice: price, notes: 'Test ' + type.toLowerCase() };
  }
  function goal(ctx, name, amount, date) {
    // GoalForm (undefined fields dropped by JSON)
    return { goalType: 'Child Education', goalName: name, familyMemberId: own(ctx), familyMember: ctx.ownerName || 'Family',
      targetAmount: amount, targetDate: date, priority: 'High', notes: 'Test goal', expectedInflation: 0.06, expectedCAGR: 0.12,
      monthlyInvestment: 5000, lumpsumInvested: 0, isRetirement: false, initialCost: 800000 };
  }
  function policy(ctx, sum) {
    return { policyType: 'Health', company: 'Test Insurer', policyNumber: 'TESTPOL' + ctx.run, policyName: 'Test Health Plan',
      insuredMember: ctx.ownerName || '', memberId: own(ctx), sumAssured: sum, nominee: 'Test Nominee', premium: 12000,
      premiumFrequency: 'Annual', status: 'Active', notes: 'Test policy' };
  }
  function liability(ctx, bal) {
    return { liabilityType: 'Personal Loan', lenderName: 'Test Lender', familyMemberId: own(ctx), outstandingBalance: bal,
      emiAmount: 5000, interestRate: 11.5, linkedInvestmentId: '', status: 'Active', notes: 'Test loan' };
  }
  function fd(ctx, value) {
    // OtherInvestmentForm: familyMember = familyMemberId, linkedLiabilityId comma list, no customType
    return { investmentType: 'Fixed Deposit', investmentCategory: 'Debt', investmentName: 'Test FD ' + ctx.run,
      familyMemberId: own(ctx), familyMember: own(ctx), investedAmount: 100000, currentValue: value,
      linkedLiabilityId: ctx.ids.liabilityId || '', status: 'Active', notes: 'Test FD' };
  }
  function stockPf(ctx, name) { return { portfolioName: name, ownerId: own(ctx), investmentAccountId: ctx.ids.iaId }; }
  function stockTx(ctx, sym, date, qty, price) {
    // BuyStockForm / SellStockForm send the raw input strings (brokerage '0')
    return { portfolioId: ctx.ids.spId, symbol: sym, companyName: ctx.stockName[sym] || '', exchange: 'NSE', date: date,
      quantity: qty, pricePerShare: price, brokerage: '0', notes: 'Test ' + sym };
  }
  function reminder(ctx, edited) {
    return { reminderType: 'Insurance Renewal', title: 'Test Reminder ' + ctx.run + (edited ? ' Edited' : ''), description: 'Test reminder',
      familyMemberId: own(ctx), dueDate: edited ? '2026-12-20' : '2026-12-15', advanceNoticeDays: 7, frequency: 'Yearly',
      priority: 'High', status: 'Pending' };
  }
  function merge(a, b) { var o = {}; [a, b].forEach(function (x) { Object.keys(x).forEach(function (k) { o[k] = x[k]; }); }); return o; }
  function pfIdByName(ctx, fullName) {
    var list = routeAction('portfolios:list', {}, ctx.user) || [];
    var m = list.filter(function (p) { return p.portfolioName === fullName; });
    return m.length ? m[m.length - 1].portfolioId : '';
  }
  function mfTxnId(ctx, code, type) {
    var list = routeAction('mf-transactions:list', {}, ctx.user) || [];
    var m = list.filter(function (t) { return String(t.portfolioId) === String(ctx.ids.pfId) && String(t.fundCode) === code && t.transactionType === type; });
    return m.length ? m[m.length - 1].transactionId : '';
  }
  function setId(name, keys) { return function (res, ctx) { ctx.ids[name] = t8Id_(res, keys); }; }

  return [
    { name: 'setup: owner, fund names, stocks', fn: function (ctx) {
        var members = routeAction('members:list', {}, ctx.user) || [];
        var act = members.filter(function (m) { return m.status === 'Active' && !/^Test Temp/.test(m.memberName); });
        var owner = act.filter(function (m) { return String(m.relationship).toLowerCase() === 'self'; })[0] || act[0];
        if (owner) { ctx.ids.ownerId = owner.memberId; ctx.ownerName = owner.memberName; }
        var mf = getSheet(CONFIG.mutualFundDataSheet), rows = mf ? mf.getDataRange().getValues() : [];
        rows.forEach(function (r) { var c = String(r[0]); if (c === A || c === B) ctx.fund[c] = r[1]; });
        ['INFY', 'TCS'].forEach(function (s) { var x = getStockBySymbol(s); ctx.stockName[s] = x ? x.companyName : ''; });
        return { members: members.length, owner: owner ? owner.memberName : '(none - the temp member is used)', funds: ctx.fund, stocks: ctx.stockName };
      } },

    // ── Family members (throwaway member; existing members are kept) ──
    { name: 'member:create (temp)', action: 'member:create', params: function (c) { return member(c, false); },
      save: function (res, ctx) { ctx.ids.tmpMemberId = t8Id_(res, ['memberId']); if (!ctx.ids.ownerId) { ctx.ids.ownerId = ctx.ids.tmpMemberId; ctx.ownerName = 'Test Temp ' + ctx.run; } } },
    { name: 'member:update (temp)', action: 'member:update', params: function (c) { return merge({ memberId: c.ids.tmpMemberId }, member(c, true)); } },

    // ── Bank + investment account ──
    { name: 'bank:create', action: 'bank:create', params: function (c) { return bank(c, false); }, save: setId('bankId', ['accountId']) },
    { name: 'bank:update', action: 'bank:update', params: function (c) { return merge({ accountId: c.ids.bankId }, bank(c, true)); } },
    { name: 'invacct:create', action: 'invacct:create', params: function (c) { return invAcct(c, false); }, save: setId('iaId', ['accountId', 'investmentAccountId']) },
    { name: 'invacct:update', action: 'invacct:update', params: function (c) { return merge({ accountId: c.ids.iaId }, invAcct(c, true)); } },

    // ── MF portfolios ──
    { name: 'portfolio:create', action: 'portfolio:create', params: function (c) { return mfPortfolio(c, 'Test MF ' + c.run, 5000, 10000); },
      save: function (res, ctx) { ctx.ids.pfId = pfIdByName(ctx, 'PFL-Test MF ' + ctx.run); } },
    { name: 'portfolio:update', action: 'portfolio:update', params: function (c) { return merge({ portfolioId: c.ids.pfId }, mfPortfolio(c, 'Test MF ' + c.run, 6000, 12000)); } },
    { name: 'portfolio:create (temp)', action: 'portfolio:create', params: function (c) { return mfPortfolio(c, 'Test MF Temp ' + c.run, 1000, 0); },
      save: function (res, ctx) { ctx.ids.pf2Id = pfIdByName(ctx, 'PFL-Test MF Temp ' + ctx.run); } },
    { name: 'portfolio:delete (temp)', action: 'portfolio:delete', params: function (c) { return { portfolioId: c.ids.pf2Id }; } },

    // ── MF transactions ──
    { name: 'mf:invest LUMPSUM fund A (adds fund)', action: 'mf:invest', params: function (c) { return invest(c, A, 'LUMPSUM', '2026-09-01', '100', '50'); } },
    { name: 'mf:invest SIP fund A', action: 'mf:invest', params: function (c) { return invest(c, A, 'SIP', '2026-09-15', '20', '52'); },
      save: function (res, ctx) { ctx.ids.sipTxnId = mfTxnId(ctx, A, 'SIP'); } },
    { name: 'mf:invest LUMPSUM fund B (adds fund)', action: 'mf:invest', params: function (c) { return invest(c, B, 'LUMPSUM', '2026-09-05', '50', '80'); } },
    { name: 'mf:redeem (exact React form params)', action: 'mf:redeem', params: function (c) {
        return { portfolioId: c.ids.pfId, fundCode: A, fundName: c.fund[A] || '', date: '2026-09-20', units: '10', price: '55', notes: 'Test redeem' }; } },
    { name: 'mf:redeem fund A', action: 'mf:redeem', params: function (c) {
        // MFRedeemForm keys + the keys processRedeem reads (as GoalWithdrawalPlan sends them)
        return { portfolioId: c.ids.pfId, fundCode: A, fundName: c.fund[A] || '', date: '2026-09-20', units: '10', price: '55', notes: 'Test redeem',
          saleDate: '2026-09-20', salePrice: '55' }; } },
    { name: 'mf:switch (exact React form params)', action: 'mf:switch', params: function (c) {
        return { fromPortfolioId: c.ids.pfId, toPortfolioId: c.ids.pfId, fromFundCode: A, fromFundName: c.fund[A] || '', toFundCode: B, toFundName: c.fund[B] || '',
          date: '2026-09-25', units: '10', fromPrice: '56', toPrice: '82', targetAllocation: '', notes: 'Test switch' }; } },
    { name: 'mf:switch fund A -> B', action: 'mf:switch', params: function (c) {
        // MFSwitchForm keys + the keys processSwitchFunds reads (as GlidepathRebalancePlan sends them)
        return { fromPortfolioId: c.ids.pfId, toPortfolioId: c.ids.pfId, fromFundCode: A, fromFundName: c.fund[A] || '', toFundCode: B, toFundName: c.fund[B] || '',
          date: '2026-09-25', units: '10', fromPrice: '56', toPrice: '82', targetAllocation: '', notes: 'Test switch',
          switchDate: '2026-09-25', fromFundPrice: '56', toFundPrice: '82' }; } },
    { name: 'mf:allocations-update 60/40', action: 'mf:allocations-update', params: function (c) {
        return { portfolioId: c.ids.pfId, allocations: [
          { schemeCode: A, fundName: c.fund[A] || '', targetAllocationPct: 60, isNew: false },
          { schemeCode: B, fundName: c.fund[B] || '', targetAllocationPct: 40, isNew: false }] }; } },
    { name: 'asset-allocation:save fund A', action: 'asset-allocation:save', params: function (c) {
        return { fundCode: A, fundName: c.fund[A] || 'Test Fund', equity: 95, debt: 0, cash: 5, commodities: 0, realEstate: 0, other: 0, customAsset: {},
          giantCap: 50, largeCap: 30, midCap: 15, smallCap: 5, microCap: 0, customCap: {}, geoIndia: 90, geoGlobal: 10, customGeo: {} }; } },
    { name: 'mf:lumpsum-restricted A = true', action: 'mf:lumpsum-restricted', params: function (c) { return { portfolioId: c.ids.pfId, fundCode: A, restricted: true }; } },
    { name: 'mf:sip-restricted A = true', action: 'mf:sip-restricted', params: function (c) { return { portfolioId: c.ids.pfId, fundCode: A, restricted: true }; } },
    { name: 'mf:lumpsum-restricted A = false', action: 'mf:lumpsum-restricted', params: function (c) { return { portfolioId: c.ids.pfId, fundCode: A, restricted: false }; } },
    { name: 'mf-transaction:edit (SIP)', action: 'mf-transaction:edit', params: function (c) {
        return { transactionId: c.ids.sipTxnId, date: '2026-09-16', units: '21', price: '52.5', notes: 'Test SIP edited' }; } },
    { name: 'mf-transaction:delete (SIP)', action: 'mf-transaction:delete', params: function (c) { return { transactionId: c.ids.sipTxnId }; } },
    { name: 'mf:delete-fund B', action: 'mf:delete-fund', params: function (c) { return { portfolioId: c.ids.pfId, fundCode: B }; } },

    // ── Goals ──
    { name: 'goal:create', action: 'goal:create', params: function (c) { return goal(c, 'Test Goal ' + c.run, 1500000, '2036-06-01'); }, save: setId('goalId', ['goalId']) },
    { name: 'goal:update', action: 'goal:update', params: function (c) { return merge({ goalId: c.ids.goalId }, goal(c, 'Test Goal ' + c.run + ' Edited', 1600000, '2036-07-01')); } },
    { name: 'goal:mappings-update', action: 'goal:mappings-update', params: function (c) {
        return { goalId: c.ids.goalId, mappings: [{ portfolioId: c.ids.pfId, allocationPct: 100, investmentType: 'MF' }] }; } },
    { name: 'goal:create (temp)', action: 'goal:create', params: function (c) { return goal(c, 'Test Goal Temp ' + c.run, 500000, '2030-01-01'); }, save: setId('goal2Id', ['goalId']) },
    { name: 'goal:delete (temp)', action: 'goal:delete', params: function (c) { return { goalId: c.ids.goal2Id }; } },

    // ── Insurance ──
    { name: 'insurance:create', action: 'insurance:create', params: function (c) { return policy(c, 500000); }, save: setId('policyId', ['policyId']) },
    { name: 'insurance:update', action: 'insurance:update', params: function (c) { return merge({ policyId: c.ids.policyId }, policy(c, 700000)); } },
    { name: 'insurance:delete', action: 'insurance:delete', params: function (c) { return { policyId: c.ids.policyId }; } },

    // ── Liabilities + other investments (linked both ways) ──
    { name: 'liability:create', action: 'liability:create', params: function (c) { return liability(c, 200000); }, save: setId('liabilityId', ['liabilityId']) },
    { name: 'liability:update', action: 'liability:update', params: function (c) { return merge({ liabilityId: c.ids.liabilityId }, liability(c, 190000)); } },
    { name: 'otherinv:create FD (linked to loan)', action: 'otherinv:create', params: function (c) { return fd(c, 105000); }, save: setId('investmentId', ['investmentId']) },
    { name: 'otherinv:update FD', action: 'otherinv:update', params: function (c) { return merge({ investmentId: c.ids.investmentId }, fd(c, 106000)); } },
    { name: 'otherinv:create gold + quickLoan (kept)', action: 'otherinv:create', params: function (c) {
        return { investmentType: 'Physical Gold', investmentCategory: 'Gold', investmentName: 'Test Gold ' + c.run, familyMemberId: own(c), familyMember: own(c),
          investedAmount: 50000, currentValue: 60000, linkedLiabilityId: '', status: 'Active', notes: 'Test gold',
          dynamicFields: JSON.stringify({ weightGrams: 10, purity: '22K' }),
          quickLoan: { liabilityType: 'Gold Loan', lender: 'Test Gold Lender', outstanding: 30000, emiAmount: 0, interestRate: 9 } }; } },
    { name: 'liability:delete (unlinks FD)', action: 'liability:delete', params: function (c) { return { liabilityId: c.ids.liabilityId }; } },
    { name: 'otherinv:delete FD', action: 'otherinv:delete', params: function (c) { return { investmentId: c.ids.investmentId }; } },

    // ── Stocks ──
    { name: 'stock-portfolio:create', action: 'stock-portfolio:create', params: function (c) { return stockPf(c, 'Test Stocks ' + c.run); }, save: setId('spId', ['portfolioId']) },
    { name: 'stock-portfolio:update', action: 'stock-portfolio:update', params: function (c) { return merge({ portfolioId: c.ids.spId }, stockPf(c, 'Test Stocks ' + c.run + ' Edited')); } },
    { name: 'stock:buy INFY 10 @1500', action: 'stock:buy', params: function (c) { return stockTx(c, 'INFY', '2026-09-02', '10', '1500'); }, save: setId('buyInfyId', ['transactionId']) },
    { name: 'stock:buy TCS 5 @3500', action: 'stock:buy', params: function (c) { return stockTx(c, 'TCS', '2026-09-03', '5', '3500'); }, save: setId('buyTcsId', ['transactionId']) },
    { name: 'stock:buy INFY 5 @1550 (2nd lot)', action: 'stock:buy', params: function (c) { return stockTx(c, 'INFY', '2026-09-10', '5', '1550'); } },
    { name: 'stock:sell INFY 4 @1600', action: 'stock:sell', params: function (c) { return stockTx(c, 'INFY', '2026-09-20', '4', '1600'); }, save: setId('sellInfyId', ['transactionId']) },
    { name: 'stock-transaction:edit (TCS buy)', action: 'stock-transaction:edit', params: function (c) {
        return { transactionId: c.ids.buyTcsId, date: '2026-09-04', quantity: '6', pricePerShare: '3450', brokerage: '0', notes: 'Test TCS edited' }; } },
    { name: 'stock-transaction:delete (TCS buy)', action: 'stock-transaction:delete', params: function (c) { return { transactionId: c.ids.buyTcsId }; } },
    { name: 'stock-portfolio:create (temp)', action: 'stock-portfolio:create', params: function (c) { return stockPf(c, 'Test Stocks Temp ' + c.run); }, save: setId('sp2Id', ['portfolioId']) },
    { name: 'stock-portfolio:delete (temp)', action: 'stock-portfolio:delete', params: function (c) { return { portfolioId: c.ids.sp2Id }; } },

    // ── Reminders ──
    { name: 'reminder:create', action: 'reminder:create', params: function (c) { return reminder(c, false); }, save: setId('reminderId', ['reminderId']) },
    { name: 'reminder:update', action: 'reminder:update', params: function (c) { return merge({ reminderId: c.ids.reminderId }, reminder(c, true)); } },
    { name: 'reminder:delete', action: 'reminder:delete', params: function (c) { return { reminderId: c.ids.reminderId }; } },

    // ── Settings + health check ──
    // Email*/Reminder* keys would reinstall triggers on the TEST project, so a neutral key is used.
    { name: 'settings:update', action: 'settings:update', params: function (c) { return { TestCrudSetting: 'Test value ' + c.run, TestCrudFlag: 'TRUE' }; } },
    { name: 'healthcheck:save', action: 'healthcheck:save', params: function () {
        return { healthIns: 'Yes', termLife: 'No', emergencyFund: 'Yes', familyAware: 'Yes', hasWill: 'No', nominees: 'Yes', goals: 'Yes', score: 5, total: 7 }; } },

    // ── Clean-up deletes (soft deletes: status Inactive) ──
    { name: 'invacct:delete', action: 'invacct:delete', params: function (c) { return { accountId: c.ids.iaId }; } },
    { name: 'bank:delete', action: 'bank:delete', params: function (c) { return { accountId: c.ids.bankId }; } },
    { name: 'member:delete (temp)', action: 'member:delete', params: function (c) { return { memberId: c.ids.tmpMemberId }; } }
  ];
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
function t8Report_(A, B, state) {
  Logger.log('══ TEST_8 run ' + state.run + ': ' + A.steps.length + ' steps, OLD (SpreadsheetApp) vs NEW (Sheets API adapter) ══');
  var hard = 0, soft = 0;
  for (var i = 0; i < Math.max(A.steps.length, B.steps.length); i++) {
    var a = A.steps[i], b = B.steps[i];
    var name = (a || b).name;
    var ka = t8Kind_(a), kb = t8Kind_(b), d = [];
    var bad = ka !== 'skip' && kb !== 'skip' && (ka !== kb || t8Success_(a) !== t8Success_(b));
    if (!bad && ka !== 'skip' && kb !== 'skip') diff_(a.res, b.res, '', d, true);
    var mark = (ka === 'skip' || kb === 'skip') ? '⏭' : bad ? '❌' : d.length ? '⚠️' : '✅';
    if (bad) hard++; else if (d.length) soft++;
    Logger.log(mark + ' ' + (i + 1) + '. ' + name +
      '\n     OLD: ' + t8Desc_(a) + (a && !a.skipped ? '  [' + a.ms + ' ms]' : '') +
      '\n     NEW: ' + t8Desc_(b) + (b && !b.skipped ? '  [' + b.ms + ' ms, ' + b.calls + ' API calls]' : '') +
      (d.length ? '\n     result diff: ' + d.slice(0, 6).join(' | ') : '') +
      ((a && a.saveErr) || (b && b.saveErr) ? '\n     id lookup error: ' + ((a && a.saveErr) || '-') + ' / ' + ((b && b.saveErr) || '-') : ''));
  }
  Logger.log('IDs old: ' + JSON.stringify(A.ids));
  Logger.log('IDs new: ' + JSON.stringify(B.ids));
  var readDiffs = 0;
  T8_READS.forEach(function (r) {
    var d = [];
    diff_(A.reads[r], B.reads[r], '', d, true);
    if (d.length) readDiffs++;
    Logger.log((d.length ? '❌ ' : '✅ ') + 'read ' + r + (d.length ? ': ' + d.length + ' differences\n     ' + d.slice(0, 25).join('\n     ') : ': identical (IDs/timestamps stripped)'));
  });
  Logger.log('SUMMARY: ' + hard + ' steps with different success/error, ' + soft + ' steps with different results, ' + readDiffs + '/' + T8_READS.length + ' read actions differ.');
}

function t8Kind_(r) {
  if (!r || r.skipped) return 'skip';
  if (r.threw) return 'threw';
  return /^ERR/.test(r.status) ? 'err' : 'ok';
}
function t8Success_(r) {
  if (!r || r.threw) return 'threw';
  return r.res && typeof r.res === 'object' && !Array.isArray(r.res) && r.res.success !== undefined ? r.res.success : true;
}
function t8Desc_(r) {
  if (!r) return '(missing)';
  if (r.skipped) return 'SKIPPED (time)';
  if (r.threw) return 'THREW ' + r.threw;
  var msg = r.res && typeof r.res === 'object' && !Array.isArray(r.res) ? (r.res.message || r.res.error || '') : '';
  return (r.status === 'ok' ? 'ok' : r.status) + (msg && r.status === 'ok' ? ' - ' + String(msg) : '').slice(0, 160);
}
function t8Status_(res) {
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    if (res.success === false) return 'ERR ' + String(res.error || res.message || '(no message)').slice(0, 200);
    if (res.error && res.success !== true) return 'ERR ' + String(res.error).slice(0, 200);
  }
  return 'ok';
}
function t8Id_(res, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (res && res[keys[i]]) return res[keys[i]];
    if (res && res.data && res.data[keys[i]]) return res.data[keys[i]];
  }
  return '';
}
/** JSON round trip (what apiRouter sends to React), then drop IDs / volatile timestamps. */
function t8Norm_(v) {
  if (v === undefined) return null;
  var j;
  try { j = JSON.parse(JSON.stringify(v)); } catch (e) { return String(v); }
  return t8Strip_(j);
}
function t8Strip_(v) {
  if (Array.isArray(v)) return v.map(t8Strip_);
  if (v && typeof v === 'object') {
    var o = {};
    Object.keys(v).forEach(function (k) { if (!T8_VOLATILE_KEY.test(k)) o[k] = t8Strip_(v[k]); });
    return o;
  }
  if (typeof v === 'string') return v.replace(T8_ID_RE, '<ID>');
  return v;
}

// Script cache, chunked (100 KB per value; 25k chars stays below it even with ₹).
function t8Put_(key, obj) {
  var s = JSON.stringify(obj), size = 25000, n = Math.max(1, Math.ceil(s.length / size)), m = {};
  for (var i = 0; i < n; i++) m['T8_' + key + '_' + i] = s.substr(i * size, size);
  m['T8_' + key + '_n'] = String(n);
  CacheService.getScriptCache().putAll(m, 21600);
}
function t8Get_(key) {
  var c = CacheService.getScriptCache(), n = +c.get('T8_' + key + '_n');
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push('T8_' + key + '_' + i);
  var got = c.getAll(keys), s = '';
  for (var j = 0; j < n; j++) { if (got[keys[j]] === undefined || got[keys[j]] === null) return null; s += got[keys[j]]; }
  return JSON.parse(s);
}

/** Start over with two brand-new sheets: run this, then TEST_1_setupBoth, TEST_2_sampleData, TEST_8_crudAll (+ TEST_8b_continue). */
function TEST_0_reset() {
  ['TEST_OLD_ID', 'TEST_NEW_ID'].forEach(function (k) { testProps_().deleteProperty(k); });
  ['state', 'old', 'new', 'prog_old', 'prog_new'].forEach(function (k) { CacheService.getScriptCache().remove('T8_' + k + '_n'); });
  Logger.log('Reset done. Next: TEST_1_setupBoth, then TEST_2_sampleData, then TEST_8_crudAll.');
}

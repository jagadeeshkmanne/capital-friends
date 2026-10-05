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

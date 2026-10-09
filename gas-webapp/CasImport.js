/**
 * ============================================================================
 * CAS IMPORT - import a CAMS "Consolidated Account Statement" into mutual fund portfolios
 * ============================================================================
 *
 * Separate from the rest of the app: only the 'import:*' API actions call this file. On for every
 * user; Script Property IMPORT_ENABLED = off switches it off (see casImportEnabled_).
 *
 * The PDF is read in the browser (react-app/src/utils/cas). The server gets the parsed folios:
 *   { meta: {source, from, to, email}, folios: [{ folio, pan, holder, isin, scheme, platformCode,
 *     platform, demat, opening, close, nav, reconciled, txns: [{date, desc, amount, units, stamp, tax, kind}] }] }
 *
 * How an import changes the sheet (per portfolio + fund the statement covers):
 *   - the fund's transactions in that portfolio that were typed by hand (no folio) or came from the
 *     same folios are replaced by the statement's full history (no double counting)
 *   - transactions of other folios / other funds are not touched
 *   - TransactionHistory gets two extra columns at the end: O = Folio, P = Import ID (A-N unchanged)
 *
 * Safety:
 *   - "Check" (import:preview) never writes anything
 *   - before writing: units in the statement must add up, the statement must start at the first
 *     purchase (opening balance 0) and must not be older than what is in the app
 *   - every row that is replaced is first copied to the TransactionHistory_Backup tab and read back
 *   - removing old rows + adding new rows is ONE Sheets API request (all or nothing)
 *   - after writing, units in each portfolio are compared with the statement; if anything is off
 *     the import is rolled back automatically
 *   - ImportLog tab keeps each import's steps; an import that was cut off (e.g. a timeout) is
 *     rolled back the next time the import page opens; Undo puts back the previous rows
 * ============================================================================
 */

var CASIMP_ = {
  backupSheet: 'TransactionHistory_Backup',
  logSheet: 'ImportLog',
  txSheet: 'TransactionHistory',
  folioCol: 15,      // O
  importCol: 16,     // P
  maxRunMs: 6.5 * 60 * 1000 // Apps Script stops an execution after 6 minutes
};

// ----------------------------------------------------------------------------
// On/off switch
// On for everyone. Emergency off: Script Property IMPORT_ENABLED = off (the app owner keeps it,
// so it can still be tested). IMPORT_BETA_EMAILS (comma-separated) keeps working while it is off.
// ----------------------------------------------------------------------------
var CASIMP_OWNERS_ = ['jagadeesh.k.manne@gmail.com'];

function casImportEnabled_() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) return false;
  if (CASIMP_OWNERS_.indexOf(email) >= 0) return true;
  var props = PropertiesService.getScriptProperties();
  if ((props.getProperty('IMPORT_ENABLED') || '').trim().toLowerCase() !== 'off') return true;
  var items = (props.getProperty('IMPORT_BETA_EMAILS') || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return items.indexOf('*') >= 0 || items.indexOf(email) >= 0;
}
function casImportGuard_() {
  if (!casImportEnabled_()) throw new Error('Statement import is not switched on for this account yet.');
}

/** Router entry: one function so WebApp.js only needs one line per action. */
function casImportRoute_(action, params) {
  if (action === 'import:enabled') {
    return { enabled: casImportEnabled_() };
  }
  casImportGuard_();
  switch (action) {
    case 'import:preview': return casImportPreview_(params);
    case 'import:save': return casImportSave_(params);
    case 'import:status': return casImportStatus_();
    case 'import:undo': return casImportUndo_(params);
    case 'import:move-fund': return casImportMoveFund_(params);
  }
  throw new Error('Unknown action: ' + action);
}

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
function casR2_(v) { return Math.round(v * 100) / 100; }
function casR4_(v) { return Math.round(v * 10000) / 10000; }
function casSerialToIso_(s) {
  if (typeof s !== 'number' || !isFinite(s)) return '';
  var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(s) * 86400000);
  return d.toISOString().slice(0, 10);
}
function casIsoToSerial_(iso) {
  var p = String(iso).split('-');
  return (Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
}
function casNowSerial_(tz) {
  var w = Utilities.formatDate(new Date(), tz || 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss').split(/[- :]/);
  return (Date.UTC(+w[0], +w[1] - 1, +w[2], +w[3], +w[4], +w[5]) - Date.UTC(1899, 11, 30)) / 86400000;
}
function casQ_(t) { return "'" + String(t).replace(/'/g, "''") + "'"; }
function casNameTokens_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) { return t.length > 1; });
}
function casUniq_(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function casPlatformKey_(platform) {
  var p = String(platform || '').toLowerCase();
  if (p.indexOf('zerodha') >= 0) return 'zerodha';
  if (p.indexOf('groww') >= 0) return 'groww';
  if (p.indexOf('direct') >= 0) return 'direct';
  if (p.indexOf('distributor') >= 0 || p.indexOf('arn') >= 0) return 'distributor';
  return p.split(/\s+/)[0] || 'unknown';
}
function casAccountMatchesPlatform_(acct, platform) {
  var key = casPlatformKey_(platform);
  var hay = (String(acct.platformBroker || '') + ' ' + String(acct.accountName || '')).toLowerCase();
  if (key === 'distributor') return /distributor|agent|advisor|adviser|arn|regular|nj|broker/.test(hay) || hay.indexOf(String(platform).toLowerCase().replace('distributor ', '')) >= 0;
  if (key === 'direct') return /direct|amc|cams|mf central|mfcentral/.test(hay);
  return hay.indexOf(key) >= 0;
}
function casDisplayPortfolioName_(n) { return String(n || '').replace(/^PFL-/, ''); }

// ----------------------------------------------------------------------------
// Reading the user's data (all reads, no writes)
// ----------------------------------------------------------------------------
function casLoad_(isins) {
  flushSheets_(); // anything queued earlier in this request goes out first
  var id = _currentUserSpreadsheetId;
  var meta = Sheets.Spreadsheets.get(id, { fields: 'properties(timeZone),sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))' });
  var sheets = {};
  (meta.sheets || []).forEach(function (s) { sheets[s.properties.title] = s.properties; });
  if (!sheets[CASIMP_.txSheet]) throw new Error('TransactionHistory sheet not found');

  // never ask for columns past the sheet's edge (the API refuses the whole read)
  var colA1 = function (title, want) { var n = Math.min(want, (sheets[title].gridProperties || {}).columnCount || want); return String.fromCharCode(64 + n); };
  var raw = (Sheets.Spreadsheets.Values.get(id, casQ_(CASIMP_.txSheet) + '!A3:' + colA1(CASIMP_.txSheet, 16), { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' }).values) || [];
  var rows = [];
  raw.forEach(function (r, i) {
    if (!r || !r.length || (r[0] === '' && r[1] === '' && r[3] === '')) return;
    rows.push({
      row: i + 3, raw: r,
      date: casSerialToIso_(r[0]), pid: String(r[1] || ''), pname: r[2] || '', code: String(r[3] || ''),
      type: String(r[5] || ''), ttype: String(r[6] || ''), units: +r[7] || 0, price: +r[8] || 0, amount: +r[9] || 0,
      txnId: String(r[13] || ''), folio: String(r[14] || ''), imp: String(r[15] || '')
    });
  });

  var portfolios = getAllPortfolios();
  var pRows = {};
  var active = portfolios.filter(function (p) { return p.status !== 'Inactive' && sheets[p.portfolioId]; });
  if (active.length) {
    var vr = Sheets.Spreadsheets.Values.batchGet(id, { ranges: active.map(function (p) { return casQ_(p.portfolioId) + '!A4:' + colA1(p.portfolioId, 21); }), valueRenderOption: 'UNFORMATTED_VALUE' }).valueRanges || [];
    active.forEach(function (p, i) {
      pRows[p.portfolioId] = ((vr[i] && vr[i].values) || []).map(function (r, k) {
        return { row: k + 4, code: String(r[0] || ''), units: +r[2] || 0, target: r[8] === undefined ? '' : r[8], lr: r[19] === undefined ? '' : r[19], sr: r[20] === undefined ? '' : r[20] };
      }).filter(function (x) { return x.code; });
    });
  }

  return {
    id: id, tz: meta.properties.timeZone || 'Asia/Kolkata', sheets: sheets, rows: rows,
    members: getAllFamilyMembers(), accounts: getAllInvestmentAccounts(), banks: getAllBankAccounts(),
    portfolios: portfolios, portfolioRows: pRows,
    mappings: (function () { try { return getGoalPortfolioMappings(); } catch (e) { return []; } })(),
    funds: isins ? casFundIndex_(isins) : {}
  };
}

/** ISIN -> { code, name, nav } from the master fund list (public, read with a URL fetch). */
function casFundIndex_(isins) {
  // Ask the master list only for the ISINs in this statement (small, fast) instead of all ~15,000 funds
  var list = [];
  isins.forEach(function (x) { if (/^INF[A-Z0-9]{9}$/.test(x) && list.indexOf(x) < 0) list.push(x); });
  var out = {};
  // Shared cache (all users, 6 hours): repeat checks and other users' imports of the same funds need no download
  var cache = null, CK = 'casisin2:'; // v2: SIF funds added to the master list (forget cached "not found")
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (cache) {
    var hit = cache.getAll(list.map(function (x) { return CK + x; })) || {};
    list = list.filter(function (x) {
      var v = hit[CK + x];
      if (!v) return true;
      if (v !== '-') { try { out[x] = JSON.parse(v); } catch (e) { return true; } }
      return false;
    });
  }
  // Apps Script allows URLs of about 2,000 characters: 20 ISINs per request keeps well under that
  for (var i = 0; i < list.length; i += 20) {
    var part = list.slice(i, i + 20);
    var rx = part.join('|');
    var json = gvizFetch_(CONFIG.masterMFDataSheet, "select A,B,D,I,J where I matches '" + rx + "' or J matches '" + rx + "'");
    (json.table.rows || []).forEach(function (row) {
      var c = row.c || [];
      var v = function (k) { return c[k] && c[k].v !== null && c[k].v !== undefined ? c[k].v : ''; };
      var code = v(0);
      if (code === '') return;
      code = String(typeof code === 'number' ? Math.round(code) : code).trim();
      var rec = { code: code, name: String(v(1)), nav: +v(2) || 0 };
      [v(3), v(4)].forEach(function (isin) { if (isin && part.indexOf(isin) >= 0 && !out[isin]) out[isin] = rec; });
    });
    if (cache) {
      var put = {};
      part.forEach(function (x) { put[CK + x] = out[x] ? JSON.stringify(out[x]) : '-'; }); // '-' = not in the list (checked)
      try { cache.putAll(put, 6 * 3600); } catch (e) { }
    }
  }
  return out;
}

/** Changes whenever transactions or portfolios change: save refuses if data moved since the check. */
function casToken_(data) {
  var s = data.rows.length + '|' + data.rows.map(function (r) { return r.txnId + ':' + r.pid + ':' + r.code + ':' + r.units; }).join(',') +
    '|' + data.portfolios.map(function (p) { return p.portfolioId + ':' + p.status + ':' + p.initialInvestment; }).join(',');
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s));
}

// ----------------------------------------------------------------------------
// The plan: what would change. Pure (only uses the data passed in) so it can be tested.
// ----------------------------------------------------------------------------
function casBuildPlan_(statement, data, mapping) {
  mapping = mapping || {};
  var meta = statement.meta || {};
  var folios = (statement.folios || []).slice();
  var funds = data.funds || {};
  var plan = { meta: meta, groups: [], buckets: [], missingMembers: [], unknownFunds: [], skipped: [], warnings: [], kept: [], resetInitial: [], goals: [], blocked: false, totals: {} };

  var portfolioById = {};
  data.portfolios.forEach(function (p) { portfolioById[p.portfolioId] = p; });
  var accountById = {};
  data.accounts.forEach(function (a) { accountById[a.accountId] = a; });
  // AllPortfolios column C holds the account ID, or (portfolios made in the app) "Account name - Platform"
  function accountOf(p) {
    var v = String(p.investmentAccountId || '').trim();
    if (accountById[v]) return accountById[v];
    var best = null;
    data.accounts.forEach(function (a) {
      var n = String(a.accountName || '').trim();
      if (n && (v === n || v.indexOf(n + ' - ') === 0) && (!best || n.length > best.accountName.length)) best = a;
    });
    return best;
  }
  var activePortfolios = data.portfolios.filter(function (p) { return p.status !== 'Inactive'; });

  // ---- 1. who is each folio? (PAN + name; minors' old folios carry the parent's PAN, so the name decides)
  var members = data.members.filter(function (m) { return m.status !== 'Inactive'; });
  // A family shares a surname, so a shared surname alone is not a match: every name part of the
  // member must be in the statement name (or the other way round). "Manne Sanjith" is Sanjith Manne,
  // never Jagadeesh Manne. Word order and short initials don't matter. PAN only breaks ties.
  function matchMember(f) {
    var ht = casNameTokens_(f.holder);
    if (!ht.length) return null;
    var cands = members.map(function (m) {
      var mt = casNameTokens_(m.memberName);
      var shared = mt.filter(function (t) { return ht.indexOf(t) >= 0; }).length;
      var ok = mt.length > 0 && (shared === casUniq_(mt).length || shared === casUniq_(ht).length);
      return { m: m, ok: ok, shared: shared };
    }).filter(function (x) { return x.ok; });
    if (cands.length === 1) return cands[0].m;
    var pan0 = String(f.pan || '').toUpperCase();
    if (!cands.length) {
      // surname changed (e.g. after marriage): same PAN and the member's first name is in the statement name
      var byPanFirst = members.filter(function (m) { var mt = casNameTokens_(m.memberName); return pan0 && String(m.pan || '').toUpperCase() === pan0 && mt.length && ht.indexOf(mt[0]) >= 0; });
      return byPanFirst.length === 1 ? byPanFirst[0] : null;
    }
    var pan = String(f.pan || '').toUpperCase();
    var byPan = cands.filter(function (x) { return pan && String(x.m.pan || '').toUpperCase() === pan; });
    if (byPan.length === 1) return byPan[0].m;
    cands.sort(function (a, b) { return b.shared - a.shared; });
    return cands[0].shared > cands[1].shared ? cands[0].m : null;
  }

  // Specialised Investment Funds (SIF) are left out of the import for now: AMFI lists them separately and
  // they have no NAV history yet, so the app can't value or track them properly.
  folios = folios.filter(function (f) {
    var fund = funds[f.isin];
    var isSif = (fund && Number(fund.code) >= 900000000) || /\bSIF\b|specialised investment fund/i.test(String(f.scheme || ''));
    if (isSif) plan.skipped.push({ folio: f.folio, scheme: f.scheme, reason: 'Specialised Investment Fund (SIF): not imported, the app does not track SIFs yet. Skipped.' });
    return !isSif;
  });

  var missing = {};
  folios.forEach(function (f) {
    var m = matchMember(f);
    f._member = m;
    if (!m) {
      var k = (f.holder || 'Unknown').toUpperCase();
      if (!missing[k]) missing[k] = { holder: f.holder || 'Unknown', pan: f.pan ? f.pan.slice(0, 2) + '•••••' + f.pan.slice(-3) : '', folios: 0 };
      missing[k].folios++;
    }
    var fund = funds[f.isin];
    f._code = fund ? fund.code : '';
    f._fundName = fund ? fund.name : f.scheme;
    f._nav = fund && fund.nav ? fund.nav : (+f.nav || 0);
  });
  plan.missingMembers = Object.keys(missing).map(function (k) { return missing[k]; });
  if (plan.missingMembers.length) plan.blocked = true;

  // ---- 2. where do imported folios already live? (the current place wins over the group choice)
  var loc = {};
  data.rows.forEach(function (r) {
    if (!r.folio) return;
    var k = r.folio + '|' + r.code;
    loc[k] = loc[k] || {};
    loc[k][r.pid] = (loc[k][r.pid] || 0) + 1;
  });
  function currentPlace(f) {
    var m = loc[f.folio + '|' + f._code];
    if (!m) return '';
    var best = '', n = -1;
    Object.keys(m).forEach(function (pid) { if (m[pid] > n && portfolioById[pid] && portfolioById[pid].status !== 'Inactive') { best = pid; n = m[pid]; } });
    return best;
  }

  // ---- 3. groups: one person + one platform
  var groups = {};
  folios.forEach(function (f) {
    if (!f._member) return;
    var key = f._member.memberId + '|' + (f.platform || 'Unknown');
    var g = groups[key];
    if (!g) {
      g = groups[key] = { key: key, memberId: f._member.memberId, memberName: f._member.memberName, platform: f.platform || 'Unknown', platformCode: f.platformCode || '', demat: false, folios: 0, live: 0, value: 0, pinned: {}, options: [], suggestion: '', target: '' };
    }
    g.folios++;
    if (f.close > 0 && f._code) { g.live++; g.value += f.close * f._nav; } // unclaimed-money plans are not holdings
    if (f.demat) g.demat = true;
    var cp = f._code ? currentPlace(f) : '';
    if (cp) g.pinned[cp] = (g.pinned[cp] || 0) + 1;
  });
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var mine = activePortfolios.filter(function (p) { var a = accountOf(p); return a && a.memberId === g.memberId; });
    g.options = activePortfolios.map(function (p) {
      var a = accountOf(p);
      return { portfolioId: p.portfolioId, name: casDisplayPortfolioName_(p.portfolioName), account: a ? a.accountName : '', owner: a ? a.memberName : '', mine: mine.indexOf(p) >= 0 };
    });
    var pinnedIds = Object.keys(g.pinned);
    var byPlatform = mine.filter(function (p) { var a = accountOf(p); return a && casAccountMatchesPlatform_(a, g.platform); });
    if (!byPlatform.length && casPlatformKey_(g.platform) === 'distributor') {
      byPlatform = mine.filter(function (p) { var a = accountOf(p); return a && !['zerodha', 'groww', 'direct'].some(function (k) { return casAccountMatchesPlatform_(a, k); }); });
    }
    if (pinnedIds.length) g.suggestion = pinnedIds[0];
    else if (!g.live) g.suggestion = 'skip'; // everything already sold: don't create or fill a portfolio unless asked
    else if (byPlatform.length === 1) g.suggestion = byPlatform[0].portfolioId;
    else if (mine.length === 1) g.suggestion = mine[0].portfolioId;
    else g.suggestion = 'new';
    var chosen = mapping[key];
    g.target = chosen && (chosen === 'new' || chosen === 'skip' || (portfolioById[chosen] && portfolioById[chosen].status !== 'Inactive')) ? chosen : g.suggestion;
    g.newName = g.memberName + ' – ' + g.platform.replace(/^Distributor\s+/, 'Agent ');
    g.value = Math.round(g.value);
    // accounts the person already has (used if a new portfolio is created)
    g.accounts = data.accounts.filter(function (a) { return a.memberId === g.memberId && a.status !== 'Inactive'; }).map(function (a) { return { accountId: a.accountId, name: a.accountName, platform: a.platformBroker, match: casAccountMatchesPlatform_(a, g.platform) }; });
    plan.groups.push(g);
  });
  // a new portfolio gets an investment account; a bank account is no longer needed (it is optional)
  plan.needsBank = false;
  plan.groups.sort(function (a, b) { return a.memberName < b.memberName ? -1 : a.memberName > b.memberName ? 1 : (a.platform < b.platform ? -1 : 1); });

  // ---- 4. route every folio to a portfolio, collect per (portfolio, fund)
  var buckets = {};
  folios.forEach(function (f) {
    if (!f._member) return;
    if (!f._code) {
      if (!/^INF[A-Z0-9]{9}$/.test(f.isin) || /unclaim/i.test(f.scheme)) {
        plan.skipped.push({ folio: f.folio, scheme: f.scheme, reason: 'Unclaimed redemption / dividend money held by the fund house, not an investment. Skipped.' });
        return;
      }
      if (f.close > 0) {
        // Not in AMFI's lists yet (e.g. a new kind of fund). Leave just this one out and import the rest:
        // it is listed in the preview, and importing the same statement later adds it once it is listed.
        plan.unknownFunds.push({ folio: f.folio, isin: f.isin, scheme: f.scheme, units: f.close });
      } else plan.skipped.push({ folio: f.folio, scheme: f.scheme, reason: 'Old fund that is no longer listed (fully sold). Skipped.' });
      return;
    }
    var g = groups[f._member.memberId + '|' + (f.platform || 'Unknown')];
    var pid = currentPlace(f) || g.target;
    if (pid === 'skip') { plan.skipped.push({ folio: f.folio, scheme: f.scheme, reason: 'Not imported (you chose "Don\'t import" for ' + g.memberName + ' · ' + g.platform + ').' }); return; }
    var key = (pid === 'new' ? 'new:' + g.key : pid) + '|' + f._code;
    var b = buckets[key];
    if (!b) b = buckets[key] = { key: key, portfolioId: pid, groupKey: g.key, isNew: pid === 'new', code: f._code, fundName: f._fundName, nav: f._nav, folios: [], problems: [] };
    b.folios.push(f);
  });

  // ---- 5. per bucket: checks, rows to replace, new rows, before/after
  var mfRowsBy = {};
  data.rows.forEach(function (r) { var k = r.pid + '|' + r.code; (mfRowsBy[k] = mfRowsBy[k] || []).push(r); });

  function invested(list) { // same rule as AllPortfolios "Total Investment" (switches excluded)
    var s = 0;
    list.forEach(function (r) {
      if (r.type === 'BUY' && (r.ttype === 'INITIAL' || r.ttype === 'SIP' || r.ttype === 'LUMPSUM')) s += r.amount;
      else if (r.type === 'SELL' && r.ttype === 'WITHDRAWAL') s -= r.amount;
    });
    return s;
  }
  function unitsOf(list) { return list.reduce(function (s, r) { return s + (r.type === 'BUY' ? r.units : r.type === 'SELL' ? -r.units : 0); }, 0); }

  Object.keys(buckets).forEach(function (key) {
    var b = buckets[key];
    var folioSet = {};
    b.folios.forEach(function (f) { folioSet[f.folio] = true; });
    var existing = b.isNew ? [] : (mfRowsBy[b.portfolioId + '|' + b.code] || []);
    var replace = existing.filter(function (r) { return !r.folio || folioSet[r.folio]; });
    var keep = existing.filter(function (r) { return r.folio && !folioSet[r.folio]; });

    b.folios.forEach(function (f) {
      if (!f.reconciled) b.problems.push('Units in folio ' + f.folio + ' do not add up in the statement.');
      if (f.opening > 0.0005) b.problems.push('Folio ' + f.folio + ' does not start from the first purchase. Download the statement "since inception".');
    });
    var newer = replace.filter(function (r) { return meta.to && r.date && r.date > meta.to; });
    if (newer.length) b.problems.push(newer.length + ' transaction(s) in the app are newer than this statement (' + meta.to + '). Download a fresh statement.');

    // new rows, in date order across folios
    var tx = [];
    b.folios.forEach(function (f, fi) { f.txns.forEach(function (t, ti) { if (Math.abs(+t.units || 0) > 0) tx.push({ f: f, t: t, o: fi * 100000 + ti }); }); });
    tx.sort(function (x, y) { return x.t.date < y.t.date ? -1 : x.t.date > y.t.date ? 1 : x.o - y.o; });
    var buyAmt = 0, buyUnits = 0;
    keep.forEach(function (r) { if (r.type === 'BUY') { buyAmt += r.amount; buyUnits += r.units; } }); // other folios' buys are part of the app's average too
    var newRows = tx.map(function (x) {
      var t = x.t, units = Math.abs(+t.units), amt = Math.abs(+t.amount);
      var isIn = t.units > 0, row;
      var dl = String(t.desc || '').toLowerCase();
      if (isIn) {
        var total = casR2_(amt + (+t.stamp || 0));
        var tt = (t.kind === 'SWITCH_IN') ? 'SWITCH' : (t.kind === 'DIV_REINVEST') ? 'DIVIDEND' : (/sip|systematic investment|sys investment/.test(dl) ? 'SIP' : 'LUMPSUM');
        buyAmt += total; buyUnits += units;
        row = { date: t.date, type: 'BUY', ttype: tt, units: casR4_(units), price: units ? total / units : 0, amount: total, gain: 0 };
      } else {
        var net = casR2_(Math.max(0, amt - (+t.tax || 0)));
        var tt2 = (t.kind === 'SWITCH_OUT') ? 'SWITCH' : 'WITHDRAWAL';
        var price = units ? net / units : 0, avg = buyUnits ? buyAmt / buyUnits : 0;
        row = { date: t.date, type: 'SELL', ttype: tt2, units: casR4_(units), price: price, amount: net, gain: casR2_((price - avg) * units) };
      }
      row.folio = x.f.folio;
      row.notes = (meta.source || 'CAMS') + ' · folio ' + x.f.folio + ' · ' + String(t.desc || '').slice(0, 80);
      return row;
    });

    var closeSum = b.folios.reduce(function (s, f) { return s + (+f.close || 0); }, 0);
    var after = keep.concat(newRows);
    b.before = { units: casR4_(unitsOf(existing)), invested: Math.round(invested(existing)), rows: existing.length };
    b.after = { units: casR4_(unitsOf(after)), invested: Math.round(invested(after)), rows: after.length };
    b.expectedUnits = casR4_(closeSum + unitsOf(keep));
    if (Math.abs(b.after.units - b.expectedUnits) > 0.01) b.problems.push('Units after import (' + b.after.units + ') would not match the statement (' + b.expectedUnits + ').');
    b.replaceRows = replace;
    b.manualReplaced = replace.filter(function (r) { return !r.folio; }).length;
    b.keptOtherFolios = keep.length;
    b.newRows = newRows;
    b.blocked = b.problems.length > 0;
    b.valueBefore = Math.round(b.before.units * b.nav);
    b.valueAfter = Math.round(b.after.units * b.nav);
    b.folioList = b.folios.map(function (f) { return f.folio; });
    delete b.folios;
    plan.buckets.push(b);
  });
  plan.buckets.sort(function (a, b) { return a.portfolioId < b.portfolioId ? -1 : a.portfolioId > b.portfolioId ? 1 : (a.fundName < b.fundName ? -1 : 1); });

  // ---- 6. portfolio-level notes
  var touched = {};
  plan.buckets.forEach(function (b) { if (!b.isNew && !b.blocked) touched[b.portfolioId] = true; });
  var covered = {};
  plan.buckets.forEach(function (b) { covered[b.portfolioId + '|' + b.code] = true; });
  Object.keys(touched).forEach(function (pid) {
    var p = portfolioById[pid];
    (data.portfolioRows[pid] || []).forEach(function (pr) {
      if (!covered[pid + '|' + pr.code] && Math.abs(pr.units) > 0.0005) {
        var nm = (data.rows.filter(function (r) { return r.pid === pid && r.code === pr.code; })[0] || { raw: [] }).raw[4] || pr.code;
        plan.kept.push({ portfolioId: pid, portfolio: casDisplayPortfolioName_(p.portfolioName), code: pr.code, fund: nm, units: casR4_(pr.units) });
      }
    });
    if (p && (+p.initialInvestment || 0) > 0) {
      plan.resetInitial.push({ portfolioId: pid, portfolio: casDisplayPortfolioName_(p.portfolioName), old: +p.initialInvestment });
    }
  });
  // same fund typed by hand in a portfolio this statement does not write to
  var codesInPlan = {};
  var membersByCode = {};
  plan.buckets.forEach(function (b) {
    codesInPlan[b.code] = codesInPlan[b.code] || {}; codesInPlan[b.code][b.portfolioId] = true;
    (membersByCode[b.code] = membersByCode[b.code] || {})[String(b.groupKey).split('|')[0]] = true;
  });
  var seenWarn = {};
  data.rows.forEach(function (r) {
    if (r.folio || !codesInPlan[r.code] || codesInPlan[r.code][r.pid]) return;
    var p = portfolioById[r.pid];
    if (!p || p.status === 'Inactive') return;
    // only the same person's other portfolio can be a double count (another family member may own the same fund)
    var owner = accountOf(p);
    if (!owner || !membersByCode[r.code][owner.memberId]) return;
    var k = r.pid + '|' + r.code;
    if (seenWarn[k]) return;
    seenWarn[k] = true;
    var name = plan.buckets.filter(function (b) { return b.code === r.code; })[0].fundName;
    plan.warnings.push(getBaseFundName(name) + ' is also in "' + casDisplayPortfolioName_(p.portfolioName) + '" (typed in by hand). If it is the same investment, it will be counted twice - delete it there after the import.');
  });

  // ---- 7. goals linked to the portfolios that change
  var deltaBy = {};
  plan.buckets.forEach(function (b) { if (!b.blocked && !b.isNew) deltaBy[b.portfolioId] = (deltaBy[b.portfolioId] || 0) + (b.valueAfter - b.valueBefore); });
  var goalAgg = {};
  (data.mappings || []).forEach(function (m) {
    if (!deltaBy[m.portfolioId]) return;
    var g = goalAgg[m.goalId] || (goalAgg[m.goalId] = { goalId: m.goalId, goalName: m.goalName, change: 0, portfolios: [] });
    g.change += deltaBy[m.portfolioId] * (m.allocationPct || 0) / 100;
    g.portfolios.push(casDisplayPortfolioName_(m.portfolioName) + ' (' + (m.allocationPct || 0) + '%)');
  });
  plan.goals = Object.keys(goalAgg).map(function (k) { goalAgg[k].change = Math.round(goalAgg[k].change); return goalAgg[k]; });

  // ---- totals
  var ok = plan.buckets.filter(function (b) { return !b.blocked; });
  plan.totals = {
    funds: ok.length,
    blockedFunds: plan.buckets.length - ok.length,
    newRows: ok.reduce(function (s, b) { return s + b.newRows.length; }, 0),
    replacedRows: ok.reduce(function (s, b) { return s + b.replaceRows.length; }, 0),
    manualReplaced: ok.reduce(function (s, b) { return s + b.manualReplaced; }, 0),
    valueBefore: ok.reduce(function (s, b) { return s + b.valueBefore; }, 0),
    valueAfter: ok.reduce(function (s, b) { return s + b.valueAfter; }, 0),
    investedBefore: ok.reduce(function (s, b) { return s + b.before.invested; }, 0),
    investedAfter: ok.reduce(function (s, b) { return s + b.after.invested; }, 0)
  };
  if (!ok.length) plan.blocked = true;
  return plan;
}

/** What the browser needs (no full row lists). */
function casPlanForClient_(plan, token) {
  return {
    token: token, meta: plan.meta, blocked: plan.blocked, needsBank: !!plan.needsBank, groups: plan.groups, missingMembers: plan.missingMembers,
    unknownFunds: plan.unknownFunds, skipped: plan.skipped, warnings: plan.warnings, kept: plan.kept,
    resetInitial: plan.resetInitial, goals: plan.goals, totals: plan.totals,
    funds: plan.buckets.map(function (b) {
      return {
        portfolioId: b.portfolioId, groupKey: b.groupKey, isNew: b.isNew, code: b.code, fundName: getBaseFundName(b.fundName), folios: b.folioList,
        before: b.before, after: b.after, valueBefore: b.valueBefore, valueAfter: b.valueAfter,
        newRows: b.newRows.length, replaced: b.replaceRows.length, manualReplaced: b.manualReplaced, keptOtherFolios: b.keptOtherFolios,
        blocked: b.blocked, problems: b.problems
      };
    })
  };
}

// ----------------------------------------------------------------------------
// import:preview  (read only)
// ----------------------------------------------------------------------------
function casImportPreview_(params) {
  var st = casCheckStatement_(params.statement);
  var data = casLoad_(st.folios.map(function (f) { return f.isin; }));
  var plan = casBuildPlan_(st, data, params.mapping || {});
  return casPlanForClient_(plan, casToken_(data));
}

function casCheckStatement_(st) {
  if (!st || !st.folios || !st.folios.length) throw new Error('No funds found in the statement.');
  if (st.folios.length > 2000) throw new Error('Statement is too large.');
  st.folios.forEach(function (f) {
    if (!f.folio || !f.isin || !Array.isArray(f.txns)) throw new Error('Statement data is incomplete. Please choose the file again.');
  });
  return st;
}

// ----------------------------------------------------------------------------
// ImportLog / Backup tabs (created only when someone imports)
// ----------------------------------------------------------------------------
function casEnsureTabs_(data) {
  var req = [];
  if (!data.sheets[CASIMP_.logSheet]) req.push({ addSheet: { properties: { title: CASIMP_.logSheet, hidden: true, gridProperties: { rowCount: 200, columnCount: 12 } } } });
  if (!data.sheets[CASIMP_.backupSheet]) req.push({ addSheet: { properties: { title: CASIMP_.backupSheet, hidden: true, gridProperties: { rowCount: 1000, columnCount: 4 } } } });
  if (!req.length) return;
  Sheets.Spreadsheets.batchUpdate({ requests: req }, data.id);
  var hdr = [];
  if (!data.sheets[CASIMP_.logSheet]) hdr.push({ range: casQ_(CASIMP_.logSheet) + '!A1:F1', values: [['Import ID', 'Started', 'Status', 'Statement', 'Summary', 'Details (JSON)']] });
  if (!data.sheets[CASIMP_.backupSheet]) hdr.push({ range: casQ_(CASIMP_.backupSheet) + '!A1:C1', values: [['Import ID', 'Row (JSON)', 'Old row number']] });
  Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: 'RAW', data: hdr }, data.id);
}

function casLogRead_(id) {
  var v = [];
  try { v = Sheets.Spreadsheets.Values.get(id, casQ_(CASIMP_.logSheet) + '!A2:L', { valueRenderOption: 'UNFORMATTED_VALUE' }).values || []; } catch (e) { return []; }
  return v.map(function (r, i) {
    var json = r.slice(5).join('');
    var details = {};
    try { details = json ? JSON.parse(json) : {}; } catch (e) { details = {}; }
    return { row: i + 2, importId: String(r[0] || ''), started: String(r[1] || ''), status: String(r[2] || ''), statement: String(r[3] || ''), summary: String(r[4] || ''), details: details };
  }).filter(function (x) { return x.importId; });
}

function casLogWrite_(id, importId, fields) {
  var log = casLogRead_(id).filter(function (x) { return x.importId === importId; })[0];
  var row = log ? log.row : null;
  if (!row) {
    var res = Sheets.Spreadsheets.Values.append({ values: [[importId]] }, id, casQ_(CASIMP_.logSheet) + '!A:A', { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
    var m = /![A-Z]+(\d+)/.exec(res.updates.updatedRange);
    row = +m[1];
  }
  var cur = log || { started: '', status: '', statement: '', summary: '', details: {} };
  var details = fields.details !== undefined ? fields.details : cur.details;
  var json = JSON.stringify(details || {});
  var chunks = [];
  for (var i = 0; i < json.length; i += 45000) chunks.push(json.slice(i, i + 45000));
  while (chunks.length < 7) chunks.push('');
  if (chunks.length > 7) throw new Error('Import details too large to record');
  var vals = [importId, fields.started !== undefined ? fields.started : cur.started, fields.status !== undefined ? fields.status : cur.status,
    fields.statement !== undefined ? fields.statement : cur.statement, fields.summary !== undefined ? fields.summary : cur.summary].concat(chunks);
  Sheets.Spreadsheets.Values.update({ values: [vals] }, id, casQ_(CASIMP_.logSheet) + '!A' + row + ':L' + row, { valueInputOption: 'RAW' });
}

// ----------------------------------------------------------------------------
// Cell building for direct Sheets API writes (typed values, no guessing by Sheets)
// ----------------------------------------------------------------------------
var CASIMP_FMT_ = {
  date: { numberFormat: { type: 'DATE', pattern: 'dd-mmm-yyyy' } },
  stamp: { numberFormat: { type: 'DATE_TIME', pattern: 'dd-mmm-yyyy hh:mm:ss' } },
  units: { numberFormat: { type: 'NUMBER', pattern: '#,##0.0000' } },
  money: { numberFormat: { type: 'CURRENCY', pattern: '₹#,##,##0.00' } }
};
function casCell_(v, fmt) {
  var c = {};
  if (v === null || v === undefined || v === '') c.userEnteredValue = { stringValue: '' };
  else if (typeof v === 'number') c.userEnteredValue = { numberValue: v };
  else if (typeof v === 'boolean') c.userEnteredValue = { boolValue: v };
  else c.userEnteredValue = { stringValue: String(v) };
  if (fmt) c.userEnteredFormat = fmt;
  return c;
}
/** One TransactionHistory row (16 values A-P) -> RowData. Dates in A and L are sheet serial numbers. */
function casRowData_(vals) {
  var cells = [];
  for (var i = 0; i < 16; i++) {
    var v = vals[i];
    var fmt = i === 0 ? CASIMP_FMT_.date : i === 11 ? CASIMP_FMT_.stamp : i === 7 ? CASIMP_FMT_.units : (i === 8 || i === 9 || i === 12) ? CASIMP_FMT_.money : null;
    if ((i === 0 || i === 11) && typeof v !== 'number') fmt = null; // a text date stays text
    cells.push(casCell_(v, fmt));
  }
  return { values: cells };
}
function casDeleteRequests_(sheetId, rowNumbers) {
  var rows = rowNumbers.slice().sort(function (a, b) { return b - a; });
  var req = [], i = 0;
  while (i < rows.length) {
    var end = rows[i], start = end;
    while (i + 1 < rows.length && rows[i + 1] === start - 1) { i++; start = rows[i]; }
    req.push({ deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: start - 1, endIndex: end } } });
    i++;
  }
  return req; // bottom-up, so earlier deletes don't move later ones
}
function casResetAdapter_() {
  // The direct Sheets API writes bypass the adapter's cache: start a fresh one
  try { if (_ssAdapter && _ssAdapter.hasPending && _ssAdapter.hasPending()) _ssAdapter.flush(); } catch (e) { }
  _ssAdapter = null; _ssAdapterId = null;
}

// ----------------------------------------------------------------------------
// import:save
// ----------------------------------------------------------------------------
function casImportSave_(params) {
  var st = casCheckStatement_(params.statement);
  var lock = LockService.getUserLock();
  if (!lock.tryLock(30000)) throw new Error('Another import or update is running. Please try again in a minute.');
  var importId = null, id = _currentUserSpreadsheetId, stage = 'check';
  try {
    var isins = st.folios.map(function (f) { return f.isin; });
    var data = casLoad_(isins);
    if (params.token && params.token !== casToken_(data)) throw new Error('Your data changed after the check. Please press Check again.');
    var unfinished = casLogRead_(id).filter(function (x) { return /^(STARTED|BACKED_UP|WRITTEN)$/.test(x.status); });
    if (unfinished.length) throw new Error('An earlier import did not finish. Open this page again to restore it first.');
    var mapping = params.mapping || {};
    var plan = casBuildPlan_(st, data, mapping);
    if (plan.blocked) throw new Error(plan.missingMembers.length ? 'Add the missing family members first.' : plan.unknownFunds.length ? 'Some funds could not be found.' : 'Nothing can be imported.');

    casEnsureTabs_(data);
    importId = 'IMP-' + Utilities.formatDate(new Date(), data.tz, 'yyyyMMdd-HHmmss');
    var details = { created: { accounts: [], portfolios: [] }, resetInitial: [], addedRows: [], removedRows: [], buckets: [] };
    var statementLabel = (st.meta.source || 'CAMS') + ' ' + (st.meta.from || '') + ' to ' + (st.meta.to || '') + (st.meta.email ? ' (' + st.meta.email + ')' : '');
    casLogWrite_(id, importId, { started: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), status: 'STARTED', statement: statementLabel, summary: '', details: details });
    stage = 'create';

    // ---- 1. new portfolios (and accounts) for groups sent to "new"
    var newFor = {};
    plan.buckets.forEach(function (b) { if (b.isNew && !b.blocked) newFor[b.groupKey] = true; });
    var newIds = {};
    Object.keys(newFor).forEach(function (gk) {
      var g = plan.groups.filter(function (x) { return x.key === gk; })[0];
      var acctId = (params.accounts || {})[gk] || '';
      if (!acctId || acctId === 'new') {
        var match = g.accounts.filter(function (a) { return a.match; });
        acctId = match.length === 1 ? match[0].accountId : '';
      }
      if (!acctId) {
        var member = data.members.filter(function (m) { return m.memberId === g.memberId; })[0] || {};
        var bank = data.banks.filter(function (b) { return b.memberId === g.memberId && b.status !== 'Inactive'; })[0] || data.banks.filter(function (b) { return b.status !== 'Inactive'; })[0];
        var email = member.email || st.meta.email || Session.getActiveUser().getEmail();
        var res = addInvestmentAccount({
          accountName: g.newName, memberId: g.memberId, bankAccountId: bank ? bank.accountId : '',
          accountType: g.demat ? 'Demat' : 'Mutual Fund', platformBroker: g.platform.replace(/^Distributor\s+/, 'Agent '),
          accountClientId: '', registeredEmail: email, registeredPhone: member.mobile || ''
        });
        if (!res || !res.success) throw new Error('Could not create the investment account for ' + g.memberName + ': ' + (res && res.message));
        acctId = res.accountId;
        details.created.accounts.push(acctId);
        flushSheets_();
      }
      var before = getAllPortfolios().map(function (p) { return p.portfolioId; });
      // store the account the way the app's portfolio form does: "Account name - Platform"
      var acct = getAllInvestmentAccounts().filter(function (a) { return a.accountId === acctId; })[0];
      var acctLabel = acct ? acct.accountName + ' - ' + acct.platformBroker : acctId;
      var pr = processAddPortfolio({ portfolioName: g.newName, investmentAccount: acctLabel, initialInvestment: 0 });
      if (!pr || !pr.success) throw new Error('Could not create the portfolio for ' + g.memberName + ': ' + (pr && pr.message));
      flushSheets_();
      casResetAdapter_();
      var created = getAllPortfolios().map(function (p) { return p.portfolioId; }).filter(function (x) { return before.indexOf(x) < 0; });
      if (created.length !== 1) throw new Error('Could not find the new portfolio');
      newIds[gk] = created[0];
      details.created.portfolios.push(created[0]);
    });
    casLogWrite_(id, importId, { details: details });

    if (Object.keys(newIds).length) {
      // reload with the new portfolios and point the "new" groups at them
      casResetAdapter_();
      data = casLoad_(isins);
      Object.keys(newIds).forEach(function (gk) { mapping[gk] = newIds[gk]; });
      plan = casBuildPlan_(st, data, mapping);
      if (plan.buckets.some(function (b) { return b.isNew && !b.blocked; })) throw new Error('New portfolio was not used');
    }
    var ok = plan.buckets.filter(function (b) { return !b.blocked; });

    // ---- 2. backup the rows that will be replaced, and read it back
    stage = 'backup';
    var replaced = [];
    ok.forEach(function (b) { b.replaceRows.forEach(function (r) { replaced.push(r); }); });
    if (replaced.length) {
      var bvals = replaced.map(function (r) { var v = r.raw.slice(0, 16); while (v.length < 16) v.push(''); return [importId, JSON.stringify(v), r.row]; });
      for (var i = 0; i < bvals.length; i += 2000) {
        Sheets.Spreadsheets.Values.append({ values: bvals.slice(i, i + 2000) }, id, casQ_(CASIMP_.backupSheet) + '!A:C', { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
      }
      var back = casBackupRows_(id, importId);
      if (back.length !== replaced.length) throw new Error('Backup could not be confirmed (' + back.length + ' of ' + replaced.length + ' rows).');
    }
    details.resetInitial = plan.resetInitial.map(function (x) { return { portfolioId: x.portfolioId, old: x.old }; });
    details.buckets = ok.map(function (b) { return { portfolioId: b.portfolioId, code: b.code, folios: b.folioList, replaced: b.replaceRows.length, added: b.newRows.length, expected: b.expectedUnits }; });
    casLogWrite_(id, importId, { status: 'BACKED_UP', details: details });

    // ---- 3. one request: remove replaced rows, add new rows, zero "Initial Investment" where needed
    stage = 'write';
    var txMeta = data.sheets[CASIMP_.txSheet];
    var req = [];
    if ((txMeta.gridProperties.columnCount || 0) < 16) req.push({ appendDimension: { sheetId: txMeta.sheetId, dimension: 'COLUMNS', length: 16 - txMeta.gridProperties.columnCount } });
    req.push({ updateCells: { range: { sheetId: txMeta.sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 14, endColumnIndex: 16 }, rows: [{ values: [casCell_('Folio'), casCell_('Import ID')] }], fields: 'userEnteredValue' } });
    req = req.concat(casDeleteRequests_(txMeta.sheetId, replaced.map(function (r) { return r.row; })));
    var maxId = 0;
    data.rows.forEach(function (r) { var m = /^TXN-(\d+)$/.exec(r.txnId); if (m && +m[1] > maxId) maxId = +m[1]; });
    var nowSerial = casNowSerial_(data.tz), seq = 0, newRowData = [];
    var pName = {};
    data.portfolios.forEach(function (p) { pName[p.portfolioId] = p.portfolioName; });
    ok.forEach(function (b) {
      var codeVal = /^\d+$/.test(b.code) ? +b.code : b.code;
      b.newRows.forEach(function (r) {
        seq++;
        newRowData.push(casRowData_([
          casIsoToSerial_(r.date), b.portfolioId, pName[b.portfolioId] || '', codeVal, getBaseFundName(b.fundName), r.type, r.ttype,
          r.units, casR4_(r.price), r.amount, r.notes, nowSerial, r.gain, 'TXN-' + String(maxId + seq).padStart(3, '0'),
          r.folio, importId + ':' + seq
        ]));
      });
    });
    if (newRowData.length) req.push({ appendCells: { sheetId: txMeta.sheetId, rows: newRowData, fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
    var apMeta = data.sheets[CONFIG.portfolioMetadataSheet];
    if (plan.resetInitial.length) {
      var apIds = (Sheets.Spreadsheets.Values.get(id, casQ_(CONFIG.portfolioMetadataSheet) + '!A1:A', { valueRenderOption: 'UNFORMATTED_VALUE' }).values) || [];
      plan.resetInitial.forEach(function (x) {
        var idx = -1;
        for (var k = 3; k < apIds.length; k++) if (String(apIds[k][0]) === x.portfolioId) { idx = k; break; }
        if (idx < 0) throw new Error('Portfolio row not found: ' + x.portfolioId);
        req.push({ updateCells: { range: { sheetId: apMeta.sheetId, startRowIndex: idx, endRowIndex: idx + 1, startColumnIndex: 3, endColumnIndex: 4 }, rows: [{ values: [casCell_(0)] }], fields: 'userEnteredValue' } });
      });
    }
    Sheets.Spreadsheets.batchUpdate({ requests: req }, id);
    casResetAdapter_();
    casLogWrite_(id, importId, { status: 'WRITTEN' });

    // ---- 4. portfolio tabs: a row for every fund held now, no row for funds sold out
    stage = 'rows';
    casSyncPortfolioRows_(ok.map(function (b) { return { portfolioId: b.portfolioId, code: b.code }; }), details);
    flushSheets_();
    casResetAdapter_();
    casLogWrite_(id, importId, { details: details });

    // ---- 5. check units against the statement
    stage = 'verify';
    var problems = casVerify_(id, ok);
    if (problems.length) throw new Error('Check after saving failed: ' + problems.slice(0, 3).join('; '));

    var summary = ok.length + ' funds, ' + newRowData.length + ' transactions added, ' + replaced.length + ' replaced';
    casLogWrite_(id, importId, { status: 'DONE', summary: summary, details: details });
    return { importId: importId, summary: summary, funds: ok.length, added: newRowData.length, replaced: replaced.length, createdPortfolios: details.created.portfolios.length };
  } catch (e) {
    if (importId && stage !== 'check') {
      var restoredMsg = '';
      try { casRollback_(id, importId, 'ROLLED_BACK'); restoredMsg = ' Nothing was changed - your data is as it was.'; }
      catch (e2) { restoredMsg = ' Restoring also failed (' + e2.message + '). Open the import page again to retry the restore.'; log('casRollback failed: ' + e2 + '\n' + e2.stack); }
      throw new Error('Import failed: ' + e.message + restoredMsg);
    }
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (e3) { }
  }
}

/** Add rows for funds now held, remove rows of funds sold out. Records what changed in details. */
function casSyncPortfolioRows_(pairs, details) {
  var data = casLoad_(null);
  var unitsBy = {};
  data.rows.forEach(function (r) { var k = r.pid + '|' + r.code; unitsBy[k] = (unitsBy[k] || 0) + (r.type === 'BUY' ? r.units : r.type === 'SELL' ? -r.units : 0); });
  var pName = {};
  data.portfolios.forEach(function (p) { pName[p.portfolioId] = p.portfolioName; });
  var seen = {};
  // removals first (bottom-up per portfolio), then additions
  var byP = {};
  pairs.forEach(function (x) { if (!seen[x.portfolioId + '|' + x.code]) { seen[x.portfolioId + '|' + x.code] = true; (byP[x.portfolioId] = byP[x.portfolioId] || []).push(x.code); } });
  Object.keys(byP).forEach(function (pid) {
    var sheet = getPortfolioSheet(pid);
    if (!sheet) throw new Error('Portfolio sheet not found: ' + pid);
    var rows = data.portfolioRows[pid] || [];
    var toRemove = rows.filter(function (pr) { return byP[pid].indexOf(pr.code) >= 0 && Math.abs(unitsBy[pid + '|' + pr.code] || 0) < 0.0005; });
    toRemove.sort(function (a, b) { return b.row - a.row; }).forEach(function (pr) {
      details.removedRows.push({ portfolioId: pid, code: pr.code, target: pr.target, lr: pr.lr, sr: pr.sr });
      sheet.deleteRow(pr.row);
    });
    var have = {};
    rows.forEach(function (pr) { have[pr.code] = true; });
    byP[pid].forEach(function (code) {
      if (!have[code] && Math.abs(unitsBy[pid + '|' + code] || 0) >= 0.0005) {
        addFundToPortfolioSheet(sheet, pid, pName[pid], code, 0);
        details.addedRows.push({ portfolioId: pid, code: code });
      }
    });
  });
}

function casVerify_(id, buckets) {
  var data = casLoad_(null);
  var problems = [];
  buckets.forEach(function (b) {
    var rows = data.portfolioRows[b.portfolioId] || [];
    var pr = rows.filter(function (x) { return x.code === String(b.code); })[0];
    var txUnits = data.rows.filter(function (r) { return r.pid === b.portfolioId && r.code === String(b.code); })
      .reduce(function (s, r) { return s + (r.type === 'BUY' ? r.units : r.type === 'SELL' ? -r.units : 0); }, 0);
    if (Math.abs(txUnits - b.expectedUnits) > 0.01) problems.push(getBaseFundName(b.fundName) + ': ' + casR4_(txUnits) + ' units, statement says ' + b.expectedUnits);
    if (b.expectedUnits > 0.0005 && !pr) problems.push(getBaseFundName(b.fundName) + ' is missing in the portfolio');
    if (pr && Math.abs(pr.units - b.expectedUnits) > 0.01) problems.push(getBaseFundName(b.fundName) + ' shows ' + pr.units + ' units, statement says ' + b.expectedUnits);
  });
  return problems;
}

function casBackupRows_(id, importId) {
  var v = [];
  try { v = Sheets.Spreadsheets.Values.get(id, casQ_(CASIMP_.backupSheet) + '!A2:C', { valueRenderOption: 'UNFORMATTED_VALUE' }).values || []; } catch (e) { return []; }
  return v.filter(function (r) { return String(r[0]) === importId; }).map(function (r) { return { vals: JSON.parse(r[1]), oldRow: +r[2] }; });
}

// ----------------------------------------------------------------------------
// Rollback / Undo: put back exactly what was there before the import
// ----------------------------------------------------------------------------
function casRollback_(id, importId, finalStatus) {
  casResetAdapter_();
  var log = casLogRead_(id).filter(function (x) { return x.importId === importId; })[0];
  if (!log) throw new Error('Import not found: ' + importId);
  var details = log.details || {};
  var data = casLoad_(null);
  var txMeta = data.sheets[CASIMP_.txSheet];

  // 1. one request: remove the imported rows, put the backed-up rows back, restore "Initial Investment"
  var mine = data.rows.filter(function (r) { return r.imp.indexOf(importId + ':') === 0; });
  // The write is one all-or-nothing request: it happened if its rows are there (or the log says so).
  var wrote = mine.length > 0 || log.status === 'WRITTEN' || log.status === 'DONE';
  var back = wrote ? casBackupRows_(id, importId) : [];
  var present = {}; // extra guard: never add a row whose transaction ID is still in the sheet
  data.rows.forEach(function (r) { if (r.txnId) present[r.txnId] = true; });
  var restore = back.filter(function (b) { return !(b.vals[13] && present[String(b.vals[13])]); });
  var req = casDeleteRequests_(txMeta.sheetId, mine.map(function (r) { return r.row; }));
  if (restore.length) req.push({ appendCells: { sheetId: txMeta.sheetId, rows: restore.map(function (b) { return casRowData_(b.vals); }), fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
  var reset = details.resetInitial || [];
  if (reset.length) {
    var apMeta = data.sheets[CONFIG.portfolioMetadataSheet];
    var apIds = (Sheets.Spreadsheets.Values.get(id, casQ_(CONFIG.portfolioMetadataSheet) + '!A1:D', { valueRenderOption: 'UNFORMATTED_VALUE' }).values) || [];
    reset.forEach(function (x) {
      for (var k = 3; k < apIds.length; k++) {
        if (String(apIds[k][0]) === x.portfolioId) {
          if (!(+apIds[k][3])) req.push({ updateCells: { range: { sheetId: apMeta.sheetId, startRowIndex: k, endRowIndex: k + 1, startColumnIndex: 3, endColumnIndex: 4 }, rows: [{ values: [casCell_(x.old)] }], fields: 'userEnteredValue' } });
          break;
        }
      }
    });
  }
  if (req.length) Sheets.Spreadsheets.batchUpdate({ requests: req }, id);
  casResetAdapter_();

  // 2. portfolio tabs: rows back the way they were
  data = casLoad_(null);
  var unitsBy = {}, anyRows = {};
  data.rows.forEach(function (r) { var k = r.pid + '|' + r.code; anyRows[k] = true; unitsBy[k] = (unitsBy[k] || 0) + (r.type === 'BUY' ? r.units : r.type === 'SELL' ? -r.units : 0); });
  var pName = {};
  data.portfolios.forEach(function (p) { pName[p.portfolioId] = p.portfolioName; });
  var byP = {};
  (details.addedRows || []).forEach(function (x) { (byP[x.portfolioId] = byP[x.portfolioId] || { add: [], del: [] }).del.push(x.code); });
  (details.removedRows || []).forEach(function (x) { (byP[x.portfolioId] = byP[x.portfolioId] || { add: [], del: [] }).add.push(x); });
  Object.keys(byP).forEach(function (pid) {
    var sheet = getPortfolioSheet(pid);
    if (!sheet) return;
    var rows = data.portfolioRows[pid] || [];
    rows.filter(function (pr) { return byP[pid].del.indexOf(pr.code) >= 0 && Math.abs(unitsBy[pid + '|' + pr.code] || 0) < 0.0005; })
      .sort(function (a, b) { return b.row - a.row; })
      .forEach(function (pr) { sheet.deleteRow(pr.row); });
    var have = {};
    rows.forEach(function (pr) { have[pr.code] = true; });
    byP[pid].add.forEach(function (x) {
      if (have[x.code]) return;
      addFundToPortfolioSheet(sheet, pid, pName[pid], x.code, x.target === '' ? 0 : x.target);
      flushSheets_();
      var after = casLoad_(null).portfolioRows[pid] || [];
      var pr = after.filter(function (y) { return y.code === x.code; })[0];
      if (pr) {
        if (x.lr !== '') sheet.getRange(pr.row, 20).setValue(x.lr);
        if (x.sr !== '') sheet.getRange(pr.row, 21).setValue(x.sr);
      }
    });
  });
  flushSheets_();
  casResetAdapter_();

  // 3. portfolios / accounts the import created: switch off if nothing uses them now
  data = casLoad_(null);
  var used = {};
  data.rows.forEach(function (r) { used[r.pid] = true; });
  ((details.created || {}).portfolios || []).forEach(function (pid) { if (!used[pid]) deletePortfolio(pid); });
  flushSheets_();
  casResetAdapter_();
  var activeP = getAllPortfolios().filter(function (p) { return p.status !== 'Inactive'; });
  ((details.created || {}).accounts || []).forEach(function (aid) {
    var acc = getAllInvestmentAccounts().filter(function (a) { return a.accountId === aid; })[0];
    var label = acc ? acc.accountName + ' - ' : '\u0000';
    if (!activeP.some(function (p) { var v = String(p.investmentAccountId || ''); return v === aid || v.indexOf(label) === 0; })) deleteInvestmentAccount(aid);
  });
  flushSheets_();
  casResetAdapter_();

  casLogWrite_(id, importId, { status: finalStatus });
  return { restored: restore.length, removed: mine.length };
}

// ----------------------------------------------------------------------------
// import:status  - history, and recovery of an import that was cut off
// ----------------------------------------------------------------------------
function casImportStatus_() {
  var id = _currentUserSpreadsheetId;
  var logs = casLogRead_(id);
  var recovered = null, running = false;
  var open = logs.filter(function (x) { return /^(STARTED|BACKED_UP|WRITTEN)$/.test(x.status); });
  if (open.length) {
    var x = open[open.length - 1];
    var started = Utilities.parseDate(x.started, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    if (Date.now() - started.getTime() < CASIMP_.maxRunMs) {
      running = true; // still saving (e.g. the page was refreshed): don't touch it
    } else {
      var lock = LockService.getUserLock();
      if (lock.tryLock(30000)) {
        try { casRollback_(id, x.importId, 'RESTORED'); recovered = x.importId; }
        finally { lock.releaseLock(); }
        logs = casLogRead_(id);
      } else running = true;
    }
  }
  var lastDone = null;
  logs.forEach(function (l) { if (l.status === 'DONE') lastDone = l.importId; });
  return {
    running: running, recovered: recovered,
    history: logs.slice(-20).reverse().map(function (l) {
      return { importId: l.importId, started: l.started, status: l.status, statement: l.statement, summary: l.summary, canUndo: l.status === 'DONE' && l.importId === lastDone };
    }),
    imported: casImportedFolios_()
  };
}

/** Imported folios per portfolio (for "Move to another portfolio"). */
function casImportedFolios_() {
  var data = casLoad_(null);
  var pName = {};
  data.portfolios.forEach(function (p) { if (p.status !== 'Inactive') pName[p.portfolioId] = casDisplayPortfolioName_(p.portfolioName); });
  var agg = {};
  data.rows.forEach(function (r) {
    if (!r.folio || !pName[r.pid]) return;
    var k = r.pid + '|' + r.code + '|' + r.folio;
    var a = agg[k] || (agg[k] = { portfolioId: r.pid, portfolio: pName[r.pid], code: r.code, fund: '', folio: r.folio, units: 0, rows: 0 });
    a.units += r.type === 'BUY' ? r.units : r.type === 'SELL' ? -r.units : 0;
    a.rows++;
    a.fund = r.raw[4] || a.fund;
  });
  return {
    folios: Object.keys(agg).map(function (k) { agg[k].units = casR4_(agg[k].units); return agg[k]; }),
    portfolios: Object.keys(pName).map(function (pid) { return { portfolioId: pid, name: pName[pid] }; })
  };
}

// ----------------------------------------------------------------------------
// import:undo
// ----------------------------------------------------------------------------
function casImportUndo_(params) {
  var id = _currentUserSpreadsheetId;
  var logs = casLogRead_(id);
  var target = logs.filter(function (l) { return l.importId === params.importId; })[0];
  if (!target) throw new Error('Import not found');
  if (target.status !== 'DONE') throw new Error('Only a finished import can be undone.');
  var lastDone = null;
  logs.forEach(function (l) { if (l.status === 'DONE') lastDone = l.importId; });
  if (lastDone !== target.importId) throw new Error('Undo the newest import first.');
  var lock = LockService.getUserLock();
  if (!lock.tryLock(30000)) throw new Error('Another import or update is running. Please try again in a minute.');
  try { return casRollback_(id, target.importId, 'UNDONE'); }
  finally { lock.releaseLock(); }
}

// ----------------------------------------------------------------------------
// import:move-fund  - move one folio's fund to another portfolio (future imports follow it)
// ----------------------------------------------------------------------------
function casImportMoveFund_(params) {
  var from = String(params.fromPortfolioId || ''), to = String(params.toPortfolioId || ''), code = String(params.code || ''), folio = String(params.folio || '');
  if (!from || !to || !code || !folio || from === to) throw new Error('Choose a different portfolio.');
  var lock = LockService.getUserLock();
  if (!lock.tryLock(30000)) throw new Error('Another import or update is running. Please try again in a minute.');
  try {
    var data = casLoad_(null);
    var target = data.portfolios.filter(function (p) { return p.portfolioId === to && p.status !== 'Inactive'; })[0];
    if (!target) throw new Error('Portfolio not found');
    var rows = data.rows.filter(function (r) { return r.pid === from && r.code === code && r.folio === folio; });
    if (!rows.length) throw new Error('Nothing to move');
    var txMeta = data.sheets[CASIMP_.txSheet];
    var req = rows.map(function (r) {
      return { updateCells: { range: { sheetId: txMeta.sheetId, startRowIndex: r.row - 1, endRowIndex: r.row, startColumnIndex: 1, endColumnIndex: 3 }, rows: [{ values: [casCell_(to), casCell_(target.portfolioName)] }], fields: 'userEnteredValue' } };
    });
    // realised profit of imported sales depends on the portfolio's average cost: recompute both sides
    var moved = {};
    rows.forEach(function (r) { moved[r.row] = true; });
    [from, to].forEach(function (pid) {
      var list = data.rows.filter(function (r) { return r.code === code && ((pid === from && r.pid === from && !moved[r.row]) || (pid === to && (r.pid === to || moved[r.row]))); })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row; });
      var amt = 0, u = 0;
      list.forEach(function (r) {
        if (r.type === 'BUY') { amt += r.amount; u += r.units; return; }
        if (r.type === 'SELL' && r.imp) {
          var g = casR2_((r.price - (u ? amt / u : 0)) * r.units);
          req.push({ updateCells: { range: { sheetId: txMeta.sheetId, startRowIndex: r.row - 1, endRowIndex: r.row, startColumnIndex: 12, endColumnIndex: 13 }, rows: [{ values: [casCell_(g, CASIMP_FMT_.money)] }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
        }
      });
    });
    Sheets.Spreadsheets.batchUpdate({ requests: req }, data.id);
    casResetAdapter_();
    var details = { addedRows: [], removedRows: [] };
    casSyncPortfolioRows_([{ portfolioId: from, code: code }, { portfolioId: to, code: code }], details);
    flushSheets_();
    casResetAdapter_();
    return { moved: rows.length };
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }
}

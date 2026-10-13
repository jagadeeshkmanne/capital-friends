/**
 * Monthly retirement income: the app takes the monthly amount out of a savings account / sweep-in FD by itself.
 * Same rules as react-app/src/utils/incomePlan.js (keep them in step):
 *   Settings 'IncomePlan:<goalId>'  { v, start: 'YYYY-MM', day, sources: [{ kind: 'cash' | 'swp', ref, name, amount }] }
 *   Settings 'IncomeLog:<goalId>'   [{ m, ref, amt, bal, at, short?, skip? }]  one line per cash source per month
 *   Settings 'RefillLog:<goalId>'   [{ at, ops: [{ from, to, amount, toRef? }] }]
 * - cash sources: on/after the pay day, deduct once per month (the log keeps a rerun from deducting again; missed
 *   months are caught up). Not enough money: take what is there and log the shortfall. Source gone: log a skip.
 * - swp sources: nothing is written; the CAS import brings the real sale (the app shows an estimate until then).
 * Runs from the daily background job (dailyUserSync) and when the app opens ('income:apply'), so it works with the
 * app closed and never twice.
 */

var INCOME_LOG_KEEP_ = 72; // months of log kept per goal

function incomeJson_(v, fallback) {
  if (v && typeof v === 'object') return v;
  try { var x = JSON.parse(v || ''); return x === null || x === undefined ? fallback : x; } catch (e) { return fallback; }
}

function incomePayMonths_(plan, today) {
  var out = [];
  if (!plan || !plan.start) return out;
  var parts = String(plan.start).split('-');
  var y = Number(parts[0]), m = Number(parts[1]);
  var day = Math.min(28, Math.max(1, Number(plan.day) || 1));
  for (var i = 0; i < 600; i++) {
    var pay = new Date(y, m - 1, day);
    if (pay > today) break;
    out.push(y + '-' + (m < 10 ? '0' : '') + m);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** She typed the balance herself since the last deduction (it differs, or was saved on a later day): remember the date,
 *  so the "check your savings balance" reminder counts 3 months from then. */
function noteTypedBalance_(ref, inv, entries, settings) {
  var mine = entries.filter(function (e) { return e.ref === ref && e.amt > 0; });
  var last = mine[mine.length - 1];
  if (!last) return;
  var upd = incomeParseDay_(inv.lastUpdated), autoDay = incomeParseDay_(last.at);
  var cv = parseFloat(inv.currentValue) || 0;
  var manual = (last.bal !== undefined && Math.abs(cv - last.bal) > 1) || (upd && autoDay && upd > autoDay);
  if (!manual) return;
  var day = Utilities.formatDate(upd || new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (settings['BalanceChecked:' + ref] !== day) { updateSetting('BalanceChecked:' + ref, day); settings['BalanceChecked:' + ref] = day; }
}

/** Deduct this month's (and any missed month's) income from cash sources. Returns what was done. */
function applyMonthlyIncome(params) {
  // the daily job and an app open can run at the same moment: one at a time, so nothing is deducted twice
  var lock = LockService.getUserLock();
  if (!lock.tryLock(20000)) return { applied: [], changed: false, busy: true };
  try { return applyMonthlyIncomeLocked_(params); } finally { lock.releaseLock(); }
}

function applyMonthlyIncomeLocked_(params) {
  var today = params && params.today ? new Date(params.today) : new Date();
  var balances = {}; // running balance per account in this run (sheet reads inside one request can lag the writes)
  var settings = getAllSettings();
  var applied = [], changed = false;
  Object.keys(settings).forEach(function (key) {
    if (key.indexOf('IncomePlan:') !== 0) return;
    var goalId = key.substring('IncomePlan:'.length);
    var plan = incomeJson_(settings[key], null);
    if (!plan || !plan.sources || !plan.sources.length || plan.paused) return;
    var logKey = 'IncomeLog:' + goalId;
    var entries = incomeJson_(settings[logKey], []);
    var done = {};
    entries.forEach(function (e) { done[e.m + '|' + e.ref] = true; });
    var months = incomePayMonths_(plan, today);
    var wrote = false;
    months.forEach(function (m) {
      plan.sources.forEach(function (s) {
        if (s.kind !== 'cash' || !(Number(s.amount) > 0) || done[m + '|' + s.ref]) return;
        var amount = Number(s.amount);
        var inv = getInvestmentById(s.ref);
        var entry = { m: m, ref: s.ref, at: Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd') };
        if (!inv || inv.status === 'Inactive') {
          entry.amt = 0; entry.short = amount; entry.skip = (s.name || 'The savings account') + ' is no longer in your investments';
        } else {
          if (balances[s.ref] === undefined) noteTypedBalance_(s.ref, inv, entries, settings);
          var cv = balances[s.ref] !== undefined ? balances[s.ref] : (parseFloat(inv.currentValue) || 0);
          var take = Math.min(amount, Math.max(0, cv));
          entry.amt = take; entry.bal = cv - take;
          if (take < amount) entry.short = amount - take;
          if (take > 0) {
            var res = processEditInvestment({
              investmentId: inv.investmentId, investmentType: inv.investmentType, investmentCategory: inv.investmentCategory,
              investmentName: inv.investmentName, familyMember: inv.familyMemberId, investmentAccount: inv.investmentAccount,
              investedAmount: inv.investedAmount, currentValue: cv - take, linkedLiabilityId: inv.linkedLiabilityId,
              dynamicFields: incomeJson_(inv.dynamicFields, {}), notes: inv.notes || '', status: inv.status || 'Active'
            });
            if (res && res.success === false) { entry.amt = 0; entry.bal = cv; entry.short = amount; entry.skip = 'could not update ' + (inv.investmentName || 'the account') + ': ' + res.error; }
            else balances[s.ref] = cv - take;
          }
        }
        entries.push(entry); done[m + '|' + s.ref] = true; wrote = true;
        applied.push({ goalId: goalId, month: m, ref: s.ref, amount: entry.amt, short: entry.short || 0, skip: entry.skip || '' });
      });
    });
    if (wrote) {
      if (entries.length > INCOME_LOG_KEEP_ * Math.max(1, plan.sources.length)) entries = entries.slice(-INCOME_LOG_KEEP_ * plan.sources.length);
      updateSetting(logKey, JSON.stringify(entries));
      changed = true;
    }
  });
  return { applied: applied, changed: changed };
}

/**
 * "Mark done" on a refill: one RefillLog line; money that landed in a savings account / sweep-in FD is added to
 * its balance here (nobody updates savings by hand). Mutual fund sales arrive later with the CAS import.
 * params: { goalId, at?, ops: [{ from, to, amount, toRef? }] }
 */
function markRefillDone(params) {
  if (!params || !params.goalId || !params.ops || !params.ops.length) return { success: false, error: 'Nothing to mark.' };
  var at = params.at || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var key = 'RefillLog:' + params.goalId;
  var entries = incomeJson_(getSetting(key), []);
  var added = [];
  params.ops.forEach(function (op) {
    if (!op.toRef || !(Number(op.amount) > 0)) return;
    var inv = getInvestmentById(op.toRef);
    if (!inv || inv.status === 'Inactive') return;
    var cv = parseFloat(inv.currentValue) || 0;
    processEditInvestment({
      investmentId: inv.investmentId, investmentType: inv.investmentType, investmentCategory: inv.investmentCategory,
      investmentName: inv.investmentName, familyMember: inv.familyMemberId, investmentAccount: inv.investmentAccount,
      investedAmount: inv.investedAmount, currentValue: cv + Number(op.amount), linkedLiabilityId: inv.linkedLiabilityId,
      dynamicFields: incomeJson_(inv.dynamicFields, {}), notes: inv.notes || '', status: inv.status || 'Active'
    });
    added.push(op.toRef);
  });
  entries.push({ at: at, ops: params.ops.map(function (o) { return { from: o.from, to: o.to, amount: Math.round(Number(o.amount) || 0), toRef: o.toRef || '' }; }) });
  if (entries.length > 60) entries = entries.slice(-60);
  updateSetting(key, JSON.stringify(entries));
  return { success: true, added: added };
}

/** One or two lines for the email's action items: this month's income, and a source running low. */
function incomeEmailItems_() {
  var items = [];
  try {
    var settings = getAllSettings();
    var now = new Date();
    var m = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
    Object.keys(settings).forEach(function (key) {
      if (key.indexOf('IncomePlan:') !== 0) return;
      var plan = incomeJson_(settings[key], null);
      if (!plan || !plan.sources) return;
      var entries = incomeJson_(settings['IncomeLog:' + key.substring(11)], []);
      plan.sources.forEach(function (s) {
        if (s.kind !== 'cash') return;
        var e = entries.filter(function (x) { return x.m === m && x.ref === s.ref; })[0];
        if (!e) return;
        var amt = Number(s.amount) || 0;
        var months = amt > 0 && e.bal !== undefined ? Math.floor(e.bal / amt) : null;
        if (e.short > 0) items.push({ type: 'warning', title: 'Monthly income short', description: (s.name || 'Savings') + ' had only ' + formatCurrency(e.amt) + ': ' + formatCurrency(e.short) + ' of this month\'s income still to pay. Refill Income from Stability.' });
        else if (months !== null && months <= 3) items.push({ type: 'warning', title: 'Income running low', description: formatCurrency(e.amt) + ' paid from ' + (s.name || 'savings') + '. Only about ' + months + ' months left there: refill it.' });
        else items.push({ type: 'info', title: 'Monthly income paid', description: formatCurrency(e.amt) + ' paid from ' + (s.name || 'savings') + (months !== null ? '. About ' + months + ' months left there.' : '.') });
      });
    });
  } catch (err) { log('incomeEmailItems_: ' + err); }
  return items;
}

// ============================================================================
// ACTION REQUIRED: what the family has to do for the retirement buckets
// ============================================================================

var APP_GOALS_URL_ = 'https://capitalfriends.in/goals';

/** 'dd/MM/yyyy' (the sheet lists) or 'yyyy-MM-dd' / ISO -> Date at midnight, or null. */
function incomeParseDay_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v));
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(v); return isNaN(d) ? null : d;
}

function incomeFmtDate_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd MMM yyyy'); }

/**
 * Retirement bucket action items for the email: the app's own list (saved when it opens, with amounts and steps)
 * plus the checks this job can do by itself, so the email still asks even if nobody opened the app:
 *  - yearly refill date reached (retirement anniversary, 45-day window) and not marked done
 *  - a savings / sweep-in FD source has 12 months of income or less left (3 or less: critical)
 *  - this month's income came up short, or the source is gone
 *  - a regular FD has matured and is still not marked Received
 * Each item: { key, type: 'critical' | 'warning', title, description }
 */
function bucketActionItems_(today) {
  today = today || new Date();
  var items = [], seen = {};
  var add = function (it) { var k = it.title + '|' + it.description; if (seen[k]) return; seen[k] = true; items.push(it); };
  var settings = getAllSettings();
  var goals = [];
  try { goals = (getAllGoals() || []).filter(function (g) { return g.isActive !== false && g.goalType === 'Retirement'; }); } catch (e) { log('bucketActionItems_ goals: ' + e); }
  var month = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM');

  goals.forEach(function (g) {
    var gid = g.goalId, gname = g.goalName || 'Retirement';
    var snap = incomeJson_(settings['BucketActions:' + gid], null);
    var refills = incomeJson_(settings['RefillLog:' + gid], []);
    var lastDone = refills.reduce(function (mx, e) { var d = new Date(e.at); return !isNaN(d) && (!mx || d > mx) ? d : mx; }, null);
    var hasAppRefill = false;
    // 1. the app's list (dropped once a refill is marked done after it was saved)
    if (snap && snap.items) snap.items.forEach(function (it) {
      if ((it.code === 'refill' || it.code === 'build') && lastDone && new Date(snap.at) <= lastDone) return;
      if (it.code === 'refill' || it.code === 'build') hasAppRefill = true;
      add({ key: gid + ':' + it.code + ':' + month, type: it.type === 'critical' ? 'critical' : 'warning', title: it.title, description: it.description });
    });
    // 2. yearly refill date
    var start = new Date(g.targetDate);
    var retired = !isNaN(start) && (start <= today || g.status === 'Achieved');
    if (retired && !isNaN(start) && start <= today) {
      var anniv = new Date(start); anniv.setFullYear(today.getFullYear());
      if (anniv > today) anniv.setFullYear(anniv.getFullYear() - 1);
      var since = (today - anniv) / 864e5;
      var doneThisYear = lastDone && lastDone >= new Date(anniv.getTime() - 45 * 864e5);
      if (since <= 45 && !doneThisYear && !hasAppRefill) add({ key: gid + ':yearly:' + anniv.getFullYear(), type: 'warning', title: gname + ': yearly bucket refill',
        description: 'Your yearly refill date was ' + incomeFmtDate_(anniv) + '. Open Goals → Refill now to see the switches, do them in your fund app, then press Mark done.' });
    }
    // 3. monthly income sources
    var plan = incomeJson_(settings['IncomePlan:' + gid], null);
    var ilog = incomeJson_(settings['IncomeLog:' + gid], []);
    if (plan && plan.sources) plan.sources.forEach(function (s) {
      if (s.kind !== 'cash') return;
      var amt = Number(s.amount) || 0;
      var mine = ilog.filter(function (e) { return e.ref === s.ref; });
      var last = mine[mine.length - 1];
      if (last && last.m === month && (last.short > 0 || last.skip)) {
        add({ key: gid + ':short:' + month + ':' + s.ref, type: 'critical', title: gname + ': this month\'s income is short',
          description: last.skip ? 'This month\'s income was not taken: ' + last.skip + '. Open Goals and pick another place to pay from.'
            : (s.name || 'Savings') + ' had only ' + formatCurrency(last.amt) + '. ' + formatCurrency(last.short) + ' of this month\'s income is still to pay: refill Income now (Goals → Refill now).' });
        return;
      }
      var inv = getInvestmentById(s.ref);
      var bal = inv ? parseFloat(inv.currentValue) || 0 : (last ? last.bal : null);
      if (!(amt > 0) || bal === null || bal === undefined) return;
      var months = Math.floor(bal / amt);
      if (months <= 12 && !hasAppRefill) add({ key: gid + ':low:' + month + ':' + s.ref, type: months <= 3 ? 'critical' : 'warning', title: gname + ': Income running low',
        description: (s.name || 'Savings') + ' has about ' + months + ' month' + (months === 1 ? '' : 's') + ' of income left (' + formatCurrency(bal) + '). Refill it from Stability: open Goals → Refill now.' });
    });
  });

  // 4. keep the Income numbers real: import the CAS for SWPs, check the savings balance every 3 months
  var txns = null;
  goals.forEach(function (g) {
    var gid = g.goalId, gname = g.goalName || 'Retirement';
    var plan = incomeJson_(settings['IncomePlan:' + gid], null);
    if (!plan || !plan.sources) return;
    var ilog = incomeJson_(settings['IncomeLog:' + gid], []);
    var started = incomeParseDay_(plan.start + '-01');
    plan.sources.forEach(function (s) {
      if (s.kind === 'swp') {
        if (txns === null) { try { txns = getAllMFTransactions() || []; } catch (e) { txns = []; } }
        var pid = String(s.ref).split('::')[0];
        var last = txns.filter(function (t) { return t.portfolioId === pid; }).reduce(function (mx, t) { var d = incomeParseDay_(t.date); return d && (!mx || d > mx) ? d : mx; }, null);
        var since = last && started && last < started ? started : last; // the plan started after the last statement
        if (since && (today - since) / 864e5 > 60) add({ key: gid + ':cas:' + Utilities.formatDate(since, Session.getScriptTimeZone(), 'yyyy-MM-dd'), type: 'warning', title: gname + ': import your CAS statement',
          description: 'Your SWP from ' + (s.name || 'the liquid fund') + ' has been estimated since ' + incomeFmtDate_(since) + '. Import your latest CAS (Mutual Funds → Import statement) so Income shows the real balance.' });
      } else if (s.kind === 'cash') {
        var inv = getInvestmentById(s.ref);
        if (!inv) return;
        var mine = ilog.filter(function (e) { return e.ref === s.ref && e.amt > 0; });
        if (!mine.length) return;
        var lastAuto = mine[mine.length - 1];
        // she updated it herself: the balance differs from what the last deduction left, or it was saved on a later day
        var upd = incomeParseDay_(inv.lastUpdated);
        var autoDay = incomeParseDay_(lastAuto.at);
        var cv = parseFloat(inv.currentValue) || 0;
        var manual = (lastAuto.bal !== undefined && Math.abs(cv - lastAuto.bal) > 1) || (upd && autoDay && upd > autoDay);
        if (manual) return;
        // last time she typed the balance herself (noted by the deduction job), else when the deductions started
        var firstAuto = incomeParseDay_(mine[0].at);
        var typed = incomeParseDay_(settings['BalanceChecked:' + s.ref]);
        var checkedAt = typed && (!firstAuto || typed > firstAuto) ? typed : firstAuto;
        if (checkedAt && (today - checkedAt) / 864e5 >= 90) add({ key: gid + ':check:' + s.ref + ':' + Utilities.formatDate(checkedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd'), type: 'warning', title: gname + ': check your savings balance',
          description: 'Since ' + incomeFmtDate_(checkedAt) + ' the app has taken ' + formatCurrency(Number(s.amount) || 0) + ' a month from ' + (s.name || 'savings') + ' (now ' + formatCurrency(cv) + '). Interest and other spending are not known to the app: if your bank shows a different amount, update it in Other investments.' });
      }
    });
  });

  // 4. FDs that matured but are still open
  try {
    (getAllInvestments() || []).forEach(function (inv) {
      if (inv.status === 'Inactive' || !/fixed deposit|^fd$/i.test(inv.investmentType || '')) return;
      var dyn = incomeJson_(inv.dynamicFields, {});
      var md = dyn && dyn.maturityDate ? new Date(dyn.maturityDate) : null;
      if (!md || isNaN(md) || md > today) return;
      add({ key: 'fd:' + inv.investmentId, type: 'warning', title: (inv.investmentName || 'FD') + ' has matured',
        description: 'It matured on ' + incomeFmtDate_(md) + '. When the money reaches your bank, press Received on it in Other investments so it refills Income.' });
    });
  } catch (e) { log('bucketActionItems_ FDs: ' + e); }

  items.sort(function (a, b) { return (a.type === 'critical' ? 0 : 1) - (b.type === 'critical' ? 0 : 1); });
  return items;
}

/**
 * A separate alert email (not the family report) the day an action first appears, from the daily job, then a
 * reminder every 3 days (critical) or 7 days (others) until it's done: Mark done / Received / refilled makes it
 * leave the list. 'BucketAlertsSent' remembers when each one was first and last sent.
 */
var BUCKET_REMIND_DAYS_ = { critical: 3, warning: 7 }; // reminder until it's done (Mark done / Received clears it)

function sendBucketAlerts_(today) {
  today = today || new Date();
  var items = bucketActionItems_(today);
  var sentMap = incomeJson_(getSetting('BucketAlertsSent'), {});
  var todayKey = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var rec = function (k) { var v = sentMap[k]; return typeof v === 'string' ? { first: v, last: v, n: 1 } : v; };
  var due = items.filter(function (it) {
    var r = rec(it.key);
    if (!r) return true; // first time
    var days = (today - new Date(r.last + 'T00:00:00')) / 864e5;
    return days >= (BUCKET_REMIND_DAYS_[it.type] || 7);
  });
  if (!due.length) return { sent: 0 };
  var recipients = getEmailRecipients();
  if (!recipients.length) return { sent: 0 };
  var isReminder = due.every(function (it) { return !!rec(it.key); });
  var crit = due.some(function (it) { return it.type === 'critical'; });
  var subject = (isReminder ? 'Reminder: ' : '') + (crit ? 'Action needed today: ' : 'Action needed: ') + due[0].title + (due.length > 1 ? ' (+' + (due.length - 1) + ' more)' : '');
  var html = buildBucketAlertHTML_(due.map(function (it) {
    var r = rec(it.key);
    return r ? { type: it.type, title: it.title, description: it.description + ' (Still open since ' + incomeFmtDate_(new Date(r.first + 'T00:00:00')) + '.)' } : it;
  }));
  var n = 0;
  recipients.forEach(function (r) {
    try { GmailApp.sendEmail(r.email, subject, due.map(function (it) { return it.title + ': ' + it.description; }).join('\n') + '\n\nOpen Capital Friends: ' + APP_GOALS_URL_, { htmlBody: html, name: 'Capital Friends' }); n++; }
    catch (e) { log('sendBucketAlerts_ to ' + r.email + ': ' + e); }
  });
  if (n) {
    due.forEach(function (it) { var r = rec(it.key); sentMap[it.key] = { first: r ? r.first : todayKey, last: todayKey, n: (r ? r.n : 0) + 1 }; });
    // forget actions that are done (no longer in the list) after a while, and keep the map small
    var live = {}; items.forEach(function (it) { live[it.key] = true; });
    Object.keys(sentMap).forEach(function (k) { var r = rec(k); if (!live[k] && (today - new Date(r.last + 'T00:00:00')) / 864e5 > 400) delete sentMap[k]; });
    var keys = Object.keys(sentMap).sort(function (a, b) { return rec(a).last < rec(b).last ? -1 : 1; });
    while (keys.length > 200) delete sentMap[keys.shift()];
    updateSetting('BucketAlertsSent', JSON.stringify(sentMap));
  }
  return { sent: n, items: due.length, reminder: isReminder };
}

/** The Action Required block of the separate alert email (the family report email doesn't carry it). */
function bucketActionsHTML_(items) {
  var h = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #fecaca;border-radius:12px;margin:0 0 16px 0"><tbody><tr><td style="padding:20px">';
  h += '<div style="font-size:15px;font-weight:800;color:#dc2626;margin-bottom:10px">&#9888; Action required (' + items.length + ')</div>';
  items.forEach(function (it, i) {
    var col = it.type === 'critical' ? '#dc2626' : '#d97706';
    h += '<div style="padding:10px 0;' + (i ? 'border-top:1px solid #f1f5f9;' : '') + '"><div style="font-size:13px;font-weight:700;color:' + col + '">' + escHtml_(it.title) + '</div>';
    h += '<div style="font-size:13px;color:#475569;line-height:1.5;margin-top:2px">' + escHtml_(it.description) + '</div></div>';
  });
  h += '<div style="margin-top:14px"><a href="' + APP_GOALS_URL_ + '" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px">Open Capital Friends &rsaquo;</a></div>';
  h += '<div style="font-size:11px;color:#94a3b8;margin-top:10px">Do the switches in your fund-house or broker app, then press Mark done in Capital Friends. Not investment advice.</div>';
  h += '</td></tr></tbody></table>';
  return h;
}

function buildBucketAlertHTML_(items) {
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f8fafc;padding:20px"><div style="max-width:600px;margin:0 auto">'
    + '<div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:12px">Capital Friends</div>' + bucketActionsHTML_(items) + '</div></div>';
}

function escHtml_(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

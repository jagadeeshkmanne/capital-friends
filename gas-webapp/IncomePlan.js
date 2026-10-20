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

/** A month / day saved in Settings comes back as a Date (Google Sheets converts "2026-10" and "2026-10-19"): compare as text. */
function settingDay_(v, fmt) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), fmt);
  return String(v == null ? '' : v).slice(0, fmt.length);
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
  if (settingDay_(settings['BalanceChecked:' + ref], 'yyyy-MM-dd') !== day) { updateSetting('BalanceChecked:' + ref, day); settings['BalanceChecked:' + ref] = day; }
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

/** Who gets the alert emails (Settings > Alerts & reminders): 'self' = only the family head, 'all' = everyone who
 *  gets the family report. */
function alertRecipients_() {
  var to = String(getSetting('AlertsTo') || 'self');
  var all = getEmailRecipients();
  if (to === 'all' && all.length) return all;
  try {
    var self = (getAllFamilyMembers() || []).filter(function (m) { return m.status === 'Active' && m.relationship === 'Self' && m.email; })[0];
    if (self) return [{ name: self.memberName, email: String(self.email).trim() }];
  } catch (e) { log('alertRecipients_: ' + e); }
  var me = Session.getEffectiveUser().getEmail();
  return me ? [{ name: 'You', email: me }] : all;
}

function sendBucketAlerts_(today) {
  today = today || new Date();
  if (String(getSetting('AlertsBuckets') || 'ON').toUpperCase() === 'OFF') return { sent: 0, off: true };
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
  var recipients = alertRecipients_();
  if (!recipients.length) return { sent: 0 };
  var isReminder = due.every(function (it) { return !!rec(it.key); });
  var crit = due.some(function (it) { return it.type === 'critical'; });
  var subject = 'Capital Friends' + (isReminder ? ' reminder' : '') + ': ' + (crit ? 'today, ' : '') + due[0].title + (due.length > 1 ? ' (+' + (due.length - 1) + ' more)' : '');
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

/** Outer layout of the alert emails: the same header and footer as the family report (EmailTemplate.js). */
var CF_LOGO_URL_ = 'https://capitalfriends.in/email/logo.png';
var CF_CARD_ = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;';
function alertShell_(inner, why) {
  var tz = Session.getScriptTimeZone();
  var h = '<div style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;background-color:#f8fafc">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc"><tbody><tr><td style="padding:24px">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;margin:0 auto"><tbody><tr><td>';
  // header (same as the family report)
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0f1f;border-radius:10px;margin-bottom:16px"><tbody><tr><td style="padding:14px 20px">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>'
    + '<td style="vertical-align:middle;padding-right:12px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr>'
    + '<td style="vertical-align:middle;padding-right:8px"><img src="' + CF_LOGO_URL_ + '" alt="Capital Friends" style="display:block;border:0;height:36px;width:auto"></td>'
    + '<td style="vertical-align:middle"><span style="font-family:\'Poppins\',sans-serif;font-size:16px;letter-spacing:-0.3px;line-height:1"><span style="font-weight:700;color:#f1f5f9">Capital</span> <span style="font-weight:800;color:#34d399">Friends</span></span></td>'
    + '</tr></tbody></table></td>'
    + '<td align="right" style="vertical-align:middle;padding-left:12px">'
    + '<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Auto-generated from your Google Sheets</div>'
    + '<div style="font-size:13px;color:#cbd5e1;font-weight:500">Made with &#10084;&#65039; by <strong style="color:#f1f5f9">Jagadeesh Manne</strong></div>'
    + '</td></tr></tbody></table></td></tr></tbody></table>';
  h += inner;
  // footer (same as the family report) + why this email came
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + CF_CARD_ + '"><tbody><tr><td style="padding:20px;text-align:center">'
    + '<div style="font-size:13px;color:#64748b;margin-bottom:8px">Auto-generated from your Google Sheets &middot; Generated: ' + Utilities.formatDate(new Date(), tz, 'dd MMM yyyy') + '</div>'
    + '<div style="font-size:14px;color:#475569;font-weight:600;margin-bottom:10px">Made with &#10084;&#65039; in India by <strong style="color:#1e293b">Jagadeesh Manne</strong></div>'
    + '<a href="https://capitalfriends.in/donate" style="display:inline-block;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.2);color:#059669;font-size:13px;font-weight:600;padding:6px 16px;border-radius:6px;text-decoration:none;letter-spacing:0.3px">&#9829; Support this project</a>'
    + '<div style="font-size:12px;color:#94a3b8;line-height:1.55;margin-top:14px">' + why + '<br>Information only, not investment advice.</div>'
    + '</td></tr></tbody></table>';
  h += '</td></tr></tbody></table></td></tr></tbody></table></div>';
  return h;
}

/** Section title with the coloured bar, as in the family report. */
function alertSecH_(label, accent, right) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px"><tbody><tr>'
    + '<td style="width:3px"><div style="width:3px;height:14px;background:' + accent + ';border-radius:2px"></div></td>'
    + '<td style="padding-left:10px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px">' + label + '</td>'
    + (right ? '<td align="right">' + right + '</td>' : '') + '</tr></tbody></table>';
}

/** The green "Open Capital Friends" button card of the family report. */
function alertAppButton_(url, label, note) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + CF_CARD_ + '"><tbody><tr><td style="padding:18px;text-align:center">'
    + (note ? '<div style="font-size:12.5px;color:#64748b;line-height:1.6;margin-bottom:14px;text-align:left">' + note + '</div>' : '')
    + '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tbody><tr><td style="background:#10b981;border-radius:8px"><a href="' + url + '" style="display:inline-block;padding:11px 24px;font-size:13.5px;font-weight:700;color:#06281b;text-decoration:none">' + label + ' &rarr;</a></td></tr></tbody></table>'
    + '</td></tr></tbody></table>';
}

function buildBucketAlertHTML_(items) {
  return alertShell_(bucketActionsHTML_(items), 'You get this because Retirement &amp; income alerts are on in Settings &rsaquo; Alerts &amp; reminders.');
}

function escHtml_(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ============================================================================
// MONTHLY CAS REMINDER (Settings > Alerts & reminders: on/off and the day, e.g. a few days after the SIP dates)
// ============================================================================

var CAMS_CAS_URL_ = 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement';
var APP_IMPORT_URL_ = 'https://capitalfriends.in/import';

/** Once a month, on the chosen day (or the first run after it): "request your CAS from CAMS, then import it". */
function sendCasReminder_(today) {
  today = today || new Date();
  var on = String(getSetting('CasReminder') || 'ON').toUpperCase(); // on by default (Settings shows it on)
  if (on !== 'ON') return { sent: 0, off: true };
  var txAll = [];
  try { txAll = getAllMFTransactions() || []; } catch (e) { }
  if (!txAll.length) return { sent: 0, noFunds: true }; // nothing imported yet: the reminder starts after the first import
  // the day picked in Settings, else 5 days after the last SIP date of the month (same as the app's suggestion)
  var sipMax = 0, yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  txAll.forEach(function (t) { var d = incomeParseDay_(t.date); if (String(t.type).toUpperCase() === 'BUY' && /SIP/i.test(t.transactionType || '') && d && d >= yearAgo && d.getDate() > sipMax) sipMax = d.getDate(); });
  var day = Math.min(28, Math.max(1, parseInt(getSetting('CasReminderDay'), 10) || (sipMax ? sipMax + 5 : 10)));
  if (today.getDate() < day) return { sent: 0 };
  var month = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM');
  if (settingDay_(getSetting('CasReminderSent'), 'yyyy-MM') === month) return { sent: 0 }; // Sheets turns "2026-10" into a date
  var recipients = alertRecipients_();
  if (!recipients.length) return { sent: 0 };
  var since = '';
  try {
    var last = txAll.reduce(function (mx, t) { var d = incomeParseDay_(t.date); return d && (!mx || d > mx) ? d : mx; }, null);
    if (last) since = ' Your last statement in the app ends on ' + incomeFmtDate_(last) + '.';
  } catch (e) { }
  var items = [
    { type: 'warning', title: '1. Ask CAMS for your statement', description: 'On the CAMS website choose Detailed statement, the period from your last import (or 01-Jan-2000), with zero-balance folios, and your email. It arrives as a PDF with your password.' },
    { type: 'warning', title: '2. Import it in Capital Friends', description: 'Mutual Funds → Import statement: choose the PDF, type the password. New SIPs, SWPs and switches are added; nothing you have is duplicated.' + since }
  ];
  var html = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #ddd6fe;border-radius:12px;margin-bottom:14px"><tbody><tr><td style="padding:20px">'
    + '<div style="font-size:15px;font-weight:800;color:#7c3aed;margin-bottom:10px">Time for your monthly mutual fund update</div>';
  items.forEach(function (it, i) {
    html += '<div style="padding:10px 0;' + (i ? 'border-top:1px solid #f1f5f9;' : '') + '"><div style="font-size:13px;font-weight:700;color:#0f172a">' + escHtml_(it.title) + '</div><div style="font-size:13px;color:#475569;line-height:1.5;margin-top:2px">' + escHtml_(it.description) + '</div></div>';
  });
  html += '<div style="margin-top:14px"><a href="' + CAMS_CAS_URL_ + '" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:9px 14px;border-radius:8px;margin-right:8px">Open CAMS &rsaquo;</a>'
    + '<a href="' + APP_IMPORT_URL_ + '" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:9px 14px;border-radius:8px">Import in Capital Friends &rsaquo;</a></div>'
    + '</td></tr></tbody></table>';
  html = alertShell_(html, 'You get this on day ' + day + ' of each month. Change the day or turn it off in Settings &rsaquo; Alerts &amp; reminders.');
  var n = 0;
  recipients.forEach(function (r) {
    try { GmailApp.sendEmail(r.email, 'Capital Friends: your monthly mutual fund update', '1) Request your CAS from CAMS: ' + CAMS_CAS_URL_ + '\n2) Import it: ' + APP_IMPORT_URL_, { htmlBody: html, name: 'Capital Friends' }); n++; }
    catch (e) { log('sendCasReminder_ to ' + r.email + ': ' + e); }
  });
  if (n) updateSetting('CasReminderSent', month);
  return { sent: n };
}

// ============================================================================
// GOAL DE-RISK ALERT (Settings > Alerts & reminders: "Goal de-risk alerts", on by default)
// ============================================================================
// The family report shows each goal's glide path (recommended vs actual equity) for information only. When a goal
// holds clearly more equity than its glide path (more than 15 points), send a short separate email, once a day at
// most, and a reminder every 14 days until it is back in line. A new glide step (e.g. 3 years left) is a new alert.
var GOAL_DERISK_GAP_ = 15, GOAL_DERISK_REMIND_DAYS_ = 14;

function sendGoalDeriskAlerts_(today) {
  today = today || new Date();
  if (String(getSetting('AlertsGoals') || 'ON').toUpperCase() === 'OFF') return { sent: 0, off: true };
  var tz = Session.getScriptTimeZone(), todayKey = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  if (settingDay_(getSetting('GoalAlertsChecked'), 'yyyy-MM-dd') === todayKey) return { sent: 0, checked: true }; // the sync runs 3 times a day
  var data = buildDashboardReportData();
  var moves = (data && data.goalMoves) || { steps: [] };
  // the same steps as the app's Goals page ("To do this month"): family switches to safe funds, and near goals
  // that hold far more equity than their plan
  var items = (moves.steps || []).map(function (st) {
    return Object.assign({ key: st.t === 'protect' ? 'goal:' + st.goalId + ':eq' + st.eqTarget : 'family:' + st.portfolioId }, st);
  });
  updateSetting('GoalAlertsChecked', todayKey);
  var sentMap = incomeJson_(getSetting('GoalAlertsSent'), {});
  var live = {}; items.forEach(function (it) { live[it.key] = true; });
  Object.keys(sentMap).forEach(function (k) { if (!live[k]) delete sentMap[k]; }); // back in line: a later drift is a fresh alert
  var due = items.filter(function (it) {
    var r = sentMap[it.key];
    return !r || (today - new Date(r.last + 'T00:00:00')) / 864e5 >= GOAL_DERISK_REMIND_DAYS_;
  });
  if (!due.length) { updateSetting('GoalAlertsSent', JSON.stringify(sentMap)); return { sent: 0 }; }
  var recipients = alertRecipients_();
  if (!recipients.length) return { sent: 0 };
  var isReminder = due.every(function (it) { return !!sentMap[it.key]; });
  var html = alertShell_(goalDeriskHTML_(items, moves), 'You get this because Goal de-risk alerts are on in Settings &rsaquo; Alerts &amp; reminders. A reminder comes every ' + GOAL_DERISK_REMIND_DAYS_ + ' days until the steps are done. Check exit load and tax before you sell.');
  var near = items.filter(function (it) { return it.t === 'protect'; })[0];
  var subject = 'Capital Friends' + (isReminder ? ' reminder' : '') + ': ' + (near ? near.goalName + ' needs a safer mix' : 'time to make your goal money safer')
    + ' (' + items.length + ' switch' + (items.length > 1 ? 'es' : '') + ')';
  var text = items.map(function (it, i) {
    return 'Step ' + (i + 1) + ' - ' + (it.portfolioName || 'Portfolio') + ': ' + it.sells.map(function (r) { return 'sell ' + goalUnitsTxt_(r) + ' of ' + r.fundName; }).join(', ')
      + '; buy ' + (it.buyFund || 'a debt / liquid fund of your choice') + ' for about Rs ' + it.total + '.';
  }).join('\n') + '\n\nOpen Capital Friends: ' + APP_GOALS_URL_;
  var n = 0;
  recipients.forEach(function (r) {
    try { GmailApp.sendEmail(r.email, subject, text, { htmlBody: html, name: 'Capital Friends' }); n++; }
    catch (e) { log('sendGoalDeriskAlerts_ to ' + r.email + ': ' + e); }
  });
  if (n) items.forEach(function (it) { var r = sentMap[it.key]; sentMap[it.key] = { first: r ? r.first : todayKey, last: todayKey, n: (r ? r.n : 0) + 1 }; });
  updateSetting('GoalAlertsSent', JSON.stringify(sentMap));
  return { sent: n, steps: items.length };
}

function goalUnitsTxt_(r) {
  if (r.units == null) return 'about ' + formatCurrency(r.value);
  return (r.all ? 'all ' : '') + (Math.floor(r.units * 1000) / 1000).toFixed(3) + ' units';
}

/** Body of the goal de-risk email: the goals' mix, then one card per switch with the exact funds and units. */
function goalDeriskHTML_(items, moves) {
  var C = CF_CARD_, money = function (v) { return escHtml_(formatCurrency(Math.round(v))); };
  var total = items.reduce(function (t, it) { return t + (it.total || 0); }, 0);
  var h = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + C + '"><tbody><tr><td style="padding:20px">'
    + alertSecH_('Goal alert', '#d97706', '<span style="background:rgba(217,119,6,0.08);color:#b45309;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">' + items.length + ' STEP' + (items.length > 1 ? 'S' : '') + '</span>')
    + '<div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:6px">Time to move some goal money to safer funds</div>'
    + '<div style="font-size:13px;color:#64748b;line-height:1.6">As a goal comes closer, its plan keeps less in equity, so a market fall just before the date can\'t hurt it. '
    + 'Switch about <strong style="color:#0f172a">' + money(total) + '</strong> as shown below. These are the same steps as in the app, on the Goals page under <strong style="color:#475569">To do this month</strong>.</div>';
  if (moves && moves.haveEq != null && moves.status === 'steps') {
    var bar = function (label, pct, col) {
      return '<tr><td style="font-size:12px;color:#64748b;padding:4px 10px 4px 0;white-space:nowrap;width:110px">' + label + '</td>'
        + '<td style="padding:4px 0"><div style="background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden"><div style="height:8px;border-radius:4px;background:' + col + ';width:' + Math.max(0, Math.min(100, pct)) + '%"></div></div></td>'
        + '<td style="font-size:13px;font-weight:700;color:#1e293b;padding:4px 0 4px 10px;text-align:right;white-space:nowrap;width:90px">' + pct + '% equity</td></tr>';
    };
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;background:#f8fafc;border-radius:8px"><tbody><tr><td style="padding:10px 12px">'
      + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>'
      + bar('All goals now', moves.haveEq, '#d97706') + bar('Their plan today', moves.needEq, '#059669')
      + '</tbody></table></td></tr></tbody></table>';
  }
  h += '</td></tr></tbody></table>';

  items.forEach(function (it, i) {
    var who = [it.owner, it.platform].filter(function (x) { return x; }).join(' &middot; ');
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + C + '"><tbody><tr><td style="padding:20px">'
      + alertSecH_('Step ' + (i + 1) + ' &middot; ' + (it.t === 'protect' ? 'Protect ' + escHtml_(it.goalName) : 'Switch in ' + escHtml_(it.portfolioName || 'portfolio')), it.t === 'protect' ? '#7c3aed' : '#2563eb',
        '<span style="font-size:13px;font-weight:700;color:#1e293b">' + money(it.total) + '</span>');
    if (it.t === 'protect') {
      var yrs = it.goalYears < 1 ? 'less than a year' : (Math.round(it.goalYears * 10) / 10) + ' years';
      h += '<div style="font-size:13px;color:#64748b;line-height:1.55;margin:-4px 0 12px 0">' + escHtml_(it.goalName) + ' is ' + yrs + ' away. Its plan is <strong style="color:#059669">' + it.eqTarget + '% equity</strong>, its money is <strong style="color:#b45309">' + it.eqNow + '% equity</strong> now.'
        + (it.portfolioName ? ' In ' + escHtml_(it.portfolioName) + (who ? ' (' + who + ')' : '') + '.' : '') + '</div>';
    } else if (who) {
      h += '<div style="font-size:13px;color:#64748b;margin:-4px 0 12px 0">' + who + '</div>';
    }
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate"><tbody>'
      + '<tr style="background:#f8fafc"><td style="padding:8px 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-radius:8px 0 0 0">Fund</td>'
      + '<td style="padding:8px 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:right;width:70px">Units</td>'
      + '<td style="padding:8px 10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-radius:0 8px 0 0">About</td></tr>';
    it.sells.forEach(function (r) {
      h += '<tr><td style="padding:10px;border-top:1px solid #f1f5f9;font-size:13px;color:#1e293b"><span style="background:rgba(220,38,38,0.08);color:#dc2626;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;margin-right:6px">SELL</span>' + escHtml_(r.fundName) + '</td>'
        + '<td style="padding:10px 6px;border-top:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#1e293b;text-align:right;white-space:nowrap">' + (r.units == null ? '&ndash;' : (r.all ? 'All &middot; ' : '') + (Math.floor(r.units * 1000) / 1000).toFixed(3)) + '</td>'
        + '<td style="padding:10px;border-top:1px solid #f1f5f9;font-size:13px;color:#475569;text-align:right;white-space:nowrap">' + money(r.value) + '</td></tr>';
    });
    h += '<tr><td style="padding:10px;border-top:1px solid #f1f5f9;font-size:13px;color:#1e293b"><span style="background:rgba(5,150,105,0.1);color:#059669;font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;margin-right:6px">BUY</span>'
      + (it.buyFund ? escHtml_(it.buyFund) : '<span style="color:#64748b">A debt or liquid fund of your choice in this portfolio</span>')
      + '<div style="font-size:11px;color:#94a3b8;margin-top:3px">Units depend on that day\'s NAV</div></td>'
      + '<td style="padding:10px;border-top:1px solid #f1f5f9;font-size:13px;color:#94a3b8;text-align:right">&ndash;</td>'
      + '<td style="padding:10px;border-top:1px solid #f1f5f9;font-size:13px;font-weight:700;color:#059669;text-align:right;white-space:nowrap">' + money(it.total) + '</td></tr>'
      + '</tbody></table>'
      + '</td></tr></tbody></table>';
  });
  h += alertAppButton_(APP_GOALS_URL_, 'Open Capital Friends',
    '&#128161; Same fund house? Use <strong>Switch</strong> on your platform and the money moves in one go. Otherwise redeem first and buy when the money reaches your bank. After the switch, import your statement or add the transactions so the app sees it.');
  return h;
}

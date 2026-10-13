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

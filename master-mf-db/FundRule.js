/**
 * Fund rule (index fund + gold) — daily check with an email when the target split changes.
 * Same rule as react-app/src/pages/FundRulePage.jsx and the paper book G (fund.py); no Claude, no server: this file runs
 * on a daily Apps Script trigger, reads the index fund's NAV history from api.mfapi.in (as the app does) and emails the
 * script owner only when the rule's target changed since the last check. Information, not advice.
 *
 * One-time: run setupFundRuleTrigger() from the Apps Script editor (authorises UrlFetch + Mail), or deploy and run it
 * with clasp. runFundRuleNow() prints today's state without emailing. Properties used: FUND_RULE_LAST (JSON).
 */
var FUND_RULE = {
  signalCode: 150738,          // Tata Nifty Midcap 150 Momentum 50 Index Fund - Direct - Growth (longest NAV history)
  lo: 0, hi: 0.20, eLo: 0.2, eMid: 0.5, eHi: 0.8, k: 50, band: 0.02, cut: 0.5, notch: { '0.5': 0.8, '0.8': 1 },
  fastK: 20, fastBand: 0.04, goldCap: 0.6, look: 248,
  hour: 7                      // daily trigger hour (script time zone); AMFI's NAV for a day is out the previous evening
};

function fundRuleTrendE_(r) { return r < FUND_RULE.lo ? FUND_RULE.eLo : r > FUND_RULE.hi ? FUND_RULE.eHi : FUND_RULE.eMid; }
function fundRuleShare_(e, x, up) { return x < 1 ? e * x : up ? (FUND_RULE.notch[String(e)] || e) : e; }
function fundRuleTargets_(e, x, up, fast) {
  var fs = fundRuleShare_(e, x, up);
  var w = fast ? { fund: 0, gold: 1 - fs, liq: fs } : { fund: fs, gold: 1 - fs, liq: 0 };
  if (w.gold > FUND_RULE.goldCap) { w.liq += w.gold - FUND_RULE.goldCap; w.gold = FUND_RULE.goldCap; }
  return w;
}
function fundRuleIsoWeek_(d) {   // d = 'YYYY-MM-DD' -> 'YYYY-WW'
  var x = new Date(d + 'T00:00:00Z'); var n = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - n + 3);
  var y = x.getUTCFullYear(); var j4 = new Date(Date.UTC(y, 0, 4));
  return y + '-' + Math.round(1 + ((x - j4) / 864e5 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
}
function fundRuleSplit_(w) { return Math.round(w.fund * 100) + '% fund / ' + Math.round(w.gold * 100) + '% gold' + (w.liq > 0.001 ? ' / ' + Math.round(w.liq * 100) + '% liquid' : ''); }
function fundRulePct_(v) { return (v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%'; }

/** Daily NAVs of the signal fund, oldest first: { dates: ['YYYY-MM-DD'], navs: [number] } */
function fundRuleNavs_() {
  var res = UrlFetchApp.fetch('https://api.mfapi.in/mf/' + FUND_RULE.signalCode, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('mfapi HTTP ' + res.getResponseCode());
  var rows = (JSON.parse(res.getContentText()).data || []).map(function (x) {
    var p = String(x.date).split('-'); return [p[2] + '-' + p[1] + '-' + p[0], parseFloat(x.nav)];
  }).filter(function (r) { return r[1] > 0; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  return { dates: rows.map(function (r) { return r[0]; }), navs: rows.map(function (r) { return r[1]; }) };
}

/** Replay the rule over the NAV history (decide at the month's / week's last NAV, act at the next). */
function fundRuleReplay_(h) {
  var d = h.dates, nav = h.navs, n = nav.length;
  var mean = function (i, k) { var s = 0; for (var j = i - k + 1; j <= i; j++) s += nav[j]; return s / k; };
  var S = { e: null, x: 1, up: false, fast: false, r12: null, gap: null, fgap: null, target: null, changed: null, why: '' };
  for (var i = FUND_RULE.look + 5; i < n; i++) {
    var why = [];
    if (S.e === null || d[i].slice(0, 7) !== d[i - 1].slice(0, 7)) {
      S.r12 = nav[i - 1] / nav[i - 1 - FUND_RULE.look] - 1; var e = fundRuleTrendE_(S.r12);
      if (S.e !== null && e !== S.e) why.push('12-month return ' + fundRulePct_(S.r12) + ' -> fund share ' + e * 100 + '%');
      S.e = e;
    }
    if (S.gap === null || fundRuleIsoWeek_(d[i]) !== fundRuleIsoWeek_(d[i - 1])) {
      S.gap = nav[i - 1] / mean(i - 1, FUND_RULE.k) - 1; var x = S.x; var up = S.gap > FUND_RULE.band;
      if (S.gap < -FUND_RULE.band) x = 1 - FUND_RULE.cut; else if (S.gap > FUND_RULE.band) x = 1;
      if (x !== S.x) why.push('vs 50-day avg ' + fundRulePct_(S.gap) + ' -> guard ' + (x < 1 ? 'ON (fund sleeve halved)' : 'off'));
      if (up !== S.up && x === 1) why.push('vs 50-day avg ' + fundRulePct_(S.gap) + ' -> ' + (up ? 'one notch up' : 'back to the monthly share'));
      S.x = x; S.up = up;
      S.fgap = nav[i - 1] / mean(i - 1, FUND_RULE.fastK) - 1; var fast = S.fast;
      if (S.fgap < -FUND_RULE.fastBand) fast = true; else if (S.fgap > 0) fast = false;
      if (fast !== S.fast) why.push('vs 20-day avg ' + fundRulePct_(S.fgap) + ' -> crash guard ' + (fast ? 'ON (fund sleeve to liquid)' : 'off'));
      S.fast = fast;
    }
    var t = fundRuleTargets_(S.e, S.x, S.up, S.fast);
    if (!S.target || Math.abs(t.fund - S.target.fund) > 1e-9 || Math.abs(t.gold - S.target.gold) > 1e-9) { S.changed = d[i]; S.why = why.join('; ') || 'start'; }
    S.target = t;
  }
  S.asOf = d[n - 1]; S.nav = nav[n - 1];
  return S;
}

/** Daily trigger: email the owner only when the target split changed since the last check (or on the first run). */
function fundRuleDailyCheck() {
  var S = fundRuleReplay_(fundRuleNavs_());
  var props = PropertiesService.getScriptProperties();
  var last = JSON.parse(props.getProperty('FUND_RULE_LAST') || 'null');
  var split = fundRuleSplit_(S.target);
  var changed = !last || last.split !== split;
  props.setProperty('FUND_RULE_LAST', JSON.stringify({ split: split, asOf: S.asOf, checked: new Date().toISOString() }));
  if (!changed) { Logger.log('Fund rule unchanged: ' + split + ' (NAV ' + S.asOf + ')'); return; }
  var email = Session.getEffectiveUser().getEmail();
  var body = 'Fund rule (index fund + gold) - the target split changed.\n\n' +
    'New target: ' + split + '\n' + (last ? 'Was: ' + last.split + '\n' : '') +
    'Why (' + (S.changed || S.asOf) + '): ' + S.why + '\n\n' +
    'State at the ' + S.asOf + ' NAV: trend ' + (S.e === FUND_RULE.eLo ? 'weak' : S.e === FUND_RULE.eHi ? 'strong' : 'normal') +
    ' (12-month return ' + fundRulePct_(S.r12) + ') | vs 50-day avg ' + fundRulePct_(S.gap) + (S.x < 1 ? ' guard ON' : S.up ? ' notch up' : '') +
    ' | vs 20-day avg ' + fundRulePct_(S.fgap) + (S.fast ? ' crash guard ON' : '') + '\n\n' +
    'Open capitalfriends.in/admin/fund-rule for the switch amounts of the satellite portfolio. ' +
    'Rule output for your own portfolio - information, not advice. Paper book G follows the same rule.';
  MailApp.sendEmail({ to: email, subject: '[Capital Friends] Fund rule: now ' + split, body: body });
  Logger.log('Fund rule email sent: ' + split);
}

/** Prints today's state without emailing or saving. */
function runFundRuleNow() {
  var S = fundRuleReplay_(fundRuleNavs_());
  Logger.log(JSON.stringify({ asOf: S.asOf, target: fundRuleSplit_(S.target), changedOn: S.changed, why: S.why, r12: S.r12, gap50: S.gap, gap20: S.fgap }));
}

/** One-time: a daily trigger for fundRuleDailyCheck (replaces an existing one). */
function setupFundRuleTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'fundRuleDailyCheck') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fundRuleDailyCheck').timeBased().atHour(FUND_RULE.hour).everyDays(1).create();
  Logger.log('Fund rule: daily trigger set for ' + FUND_RULE.hour + ':00; first email comes at the first run.');
}

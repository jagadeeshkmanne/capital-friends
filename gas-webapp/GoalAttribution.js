/**
 * GOAL ATTRIBUTION + GLIDE PATH — same rules as the app (react-app/src/data/glidePath.js, utils/goalAttribution.js).
 * Keep the two in step: the family email, the goal de-risk alert and the app's goal cards must show the same mix.
 *
 * A portfolio can be linked to several goals (the app's "Money for goals" pool writes those links). Each goal gets
 * its allocation % of the portfolio, but the safe (debt-like) holdings go first to the goals that need them most
 * (lowest target equity), so a near goal is not told to "move to debt" when the shared portfolio already holds it.
 */
var GLIDE_PATH_ = [
  { maxYears: 1, equity: 10, label: 'Short-term' },
  { maxYears: 3, equity: 30, label: 'Short-term' },
  { maxYears: 5, equity: 50, label: 'Medium-term' },
  { maxYears: 7, equity: 65, label: 'Medium-term' },
  { maxYears: 10, equity: 75, label: 'Long-term' },
  { maxYears: Infinity, equity: 85, label: 'Long-term' }
];
var GOAL_YEAR_MS_ = 365.25 * 24 * 60 * 60 * 1000;

function goalRecommended_(goalType, yearsLeft) {
  if (goalType === 'Emergency Fund') return { equity: 0, debt: 100, label: 'Safety' };
  if (goalType === 'Retirement') {
    var y = Math.max(0, Number(yearsLeft) || 0);
    var e = y <= 5 ? 75 : y >= 10 ? 85 : Math.round(75 + 2 * (y - 5));
    return { equity: e, debt: 100 - e, label: y <= 5 ? 'Retirement buckets' : 'Long-term' };
  }
  var st = GLIDE_PATH_.filter(function (s) { return yearsLeft <= s.maxYears; })[0];
  return { equity: st.equity, debt: 100 - st.equity, label: st.label };
}

/** A goal paid over several years (payYears > 1): each year's part follows its own glide path. */
function goalAllocation_(goal, yearsLeft) {
  var type = goal && goal.goalType, n = Math.max(1, Math.round(Number(goal && goal.payYears) || 1));
  if (n === 1 || type === 'Retirement' || type === 'Emergency Fund') return goalRecommended_(type, yearsLeft);
  var y = Number(yearsLeft) || 0, r = Number(goal.expectedCAGR) > 0 ? Number(goal.expectedCAGR) : 0.12, w = 0, eq = 0;
  for (var k = 0; k < n; k++) {
    var yk = y + k, e = yk > 0 ? goalRecommended_(type, yk).equity : 0, wk = 1 / Math.pow(1 + r, Math.max(0, yk));
    w += wk; eq += wk * e;
  }
  var equity = Math.round(eq / w);
  return { equity: equity, debt: 100 - equity, label: equity >= 75 ? 'Long-term' : equity >= 50 ? 'Medium-term' : 'Short-term' };
}

function goalSpendsOverYears_(goal) {
  return Math.round(Number(goal && goal.payYears) || 1) > 1 && goal.goalType !== 'Retirement' && goal.goalType !== 'Emergency Fund';
}

/** Target equity share (0..1) for a goal today; goals due now and the emergency fund: 0. */
function goalTargetEquity_(goal, now) {
  if (!goal || !goal.targetDate) return null;
  var yl = (new Date(goal.targetDate) - (now || new Date())) / GOAL_YEAR_MS_;
  if (goal.goalType === 'Emergency Fund' || !(yl > 0 || (goalSpendsOverYears_(goal) && yl > -1))) return 0;
  return (goalAllocation_(goal, yl).equity || 0) / 100;
}

var GOAL_GOLD_RX_ = /gold|silver|\bsgb\b|sovereign/i;
function goalIsGold_(h) { return GOAL_GOLD_RX_.test([h && h.category, h && h.fundName, h && h.schemeName, h && h.investmentType, h && h.investmentCategory].join(' ')); }
/** Growth share of a fund (equity + gold / commodities count as growth, as in the app). */
function goalRiskFraction_(h, allocMap) {
  if (goalIsGold_(h)) return 1;
  var d = allocMap && allocMap[h.schemeCode || h.fundCode];
  if (d) return Math.max(0, Math.min(1, ((Number(d.Equity) || 0) + (Number(d.Gold) || 0) + (Number(d.Commodities) || 0)) / 100));
  if (h.category === 'Equity' || h.category === 'ELSS' || h.category === 'Index') return 1;
  if (h.category === 'Hybrid') return 0.65;
  if (h.category === 'Multi-Asset') return 0.5;
  return 0;
}

/** { goalId: { total, equity } } for the goals, from the saved goal links. Same algorithm as the app. */
function attributeGoals_(goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap, now) {
  var out = {}, ids = {}, tgt = {};
  (goals || []).forEach(function (g) {
    ids[g.goalId] = true; out[g.goalId] = { total: 0, equity: 0 };
    var t = goalTargetEquity_(g, now); tgt[g.goalId] = (t === null || !isFinite(t)) ? 1 : Math.max(0, Math.min(1, t));
  });
  var bySource = {};
  (mappings || []).forEach(function (m) {
    if (!ids[m.goalId]) return;
    var pct = Math.max(0, Number(m.allocationPct) || 0); if (!pct) return;
    (bySource[m.portfolioId] = bySource[m.portfolioId] || []).push({ goalId: m.goalId, share: pct / 100 });
  });
  Object.keys(bySource).forEach(function (pid) {
    var items = (mfHoldings || []).filter(function (h) { return h.portfolioId === pid && Number(h.units) > 0; })
      .map(function (h) { return { value: Number(h.currentValue) || 0, eq: goalRiskFraction_(h, allocMap) }; });
    if (!items.length) items = (stockHoldings || []).filter(function (h) { return h.portfolioId === pid && Number(h.quantity) > 0; })
      .map(function (h) { return { value: Number(h.currentValue) || 0, eq: 1 }; });
    if (!items.length) {
      var inv = (otherInvList || []).filter(function (i) { return i.investmentId === pid; })[0];
      if (inv) items = [{ value: Number(inv.currentValue) || 0, eq: inv.investmentCategory === 'Equity' || goalIsGold_(inv) ? 1 : 0 }];
    }
    items = items.filter(function (it) { return it.value > 0; });
    if (!items.length) return;
    var totalValue = items.reduce(function (s, it) { return s + it.value; }, 0);
    var left = items.map(function (it) { return it.value; });
    var links = bySource[pid].slice().sort(function (a, b) { return (tgt[a.goalId] - tgt[b.goalId]) || (b.share - a.share) || String(a.goalId).localeCompare(String(b.goalId)); });
    var shareSum = links.reduce(function (s, l) { return s + l.share; }, 0), scale = shareSum > 1 ? 1 / shareSum : 1;
    var levels = [];
    items.forEach(function (it) { var lv = Math.round(it.eq * 1000) / 1000; if (levels.indexOf(lv) < 0) levels.push(lv); });
    levels.sort(function (a, b) { return a - b; });
    var groups = levels.map(function (lv) { return items.map(function (_, i) { return i; }).filter(function (i) { return Math.round(items[i].eq * 1000) / 1000 === lv; }); });
    links.forEach(function (l) {
      var budget = totalValue * l.share * scale, taken = 0, debtGot = 0;
      var take = function (i, x) { if (x <= 1e-9) return; left[i] -= x; taken += x; debtGot += x * (1 - items[i].eq); };
      var takeGroup = function (grp, amount) {
        var avail = grp.reduce(function (t, i) { return t + left[i]; }, 0);
        if (avail <= 1e-9 || amount <= 1e-9) return;
        var x = Math.min(amount, avail);
        grp.forEach(function (i) { take(i, (left[i] / avail) * x); });
      };
      var wantDebt = budget * (1 - tgt[l.goalId]);
      for (var gi = 0; gi < groups.length; gi++) {
        var need = wantDebt - debtGot, room = budget - taken;
        if (need <= 1e-6 || room <= 1e-6) break;
        var d = 1 - items[groups[gi][0]].eq;
        if (d <= 1e-9) break;
        takeGroup(groups[gi], Math.min(need / d, room));
      }
      takeGroup(items.map(function (_, i) { return i; }).filter(function (i) { return items[i].eq >= 0.5; }), budget - taken);
      for (var gj = groups.length - 1; gj >= 0; gj--) {
        if (budget - taken <= 1e-6) break;
        takeGroup(groups[gj], budget - taken);
      }
      out[l.goalId].total += taken; out[l.goalId].equity += taken - debtGot;
    });
  });
  return out;
}

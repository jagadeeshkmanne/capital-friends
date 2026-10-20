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

/** { goalId: { total, equity, items } } for the goals, from the saved goal links. Same algorithm as the app. */
function attributeGoals_(goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap, now) {
  var out = {}, ids = {}, tgt = {};
  (goals || []).forEach(function (g) {
    ids[g.goalId] = true; out[g.goalId] = { total: 0, equity: 0, items: [] };
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
      .map(function (h) { return { kind: 'mf', key: pid + '::' + (h.schemeCode || h.fundCode), holding: h, value: Number(h.currentValue) || 0, eq: goalRiskFraction_(h, allocMap) }; });
    if (!items.length) items = (stockHoldings || []).filter(function (h) { return h.portfolioId === pid && Number(h.quantity) > 0; })
      .map(function (h) { return { kind: 'stock', key: pid + '::' + h.symbol, holding: h, value: Number(h.currentValue) || 0, eq: 1 }; });
    if (!items.length) {
      var inv = (otherInvList || []).filter(function (i) { return i.investmentId === pid; })[0];
      if (inv) items = [{ kind: 'other', key: pid + '::other', holding: inv, value: Number(inv.currentValue) || 0, eq: inv.investmentCategory === 'Equity' || goalIsGold_(inv) ? 1 : 0 }];
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
      var budget = totalValue * l.share * scale, taken = 0, debtGot = 0, g = out[l.goalId];
      var take = function (i, x) {
        if (x <= 1e-9) return;
        left[i] -= x; taken += x; debtGot += x * (1 - items[i].eq);
        var ex = g.items.filter(function (y) { return y.key === items[i].key; })[0];
        if (ex) { ex.value += x; ex.fraction = ex.value / items[i].value; }
        else g.items.push({ kind: items[i].kind, portfolioId: pid, key: items[i].key, holding: items[i].holding, value: x, eq: items[i].eq, fraction: x / items[i].value });
      };
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

// ══════════════════════════════════════════════════════════════════════
// FAMILY PLAN — the exact switches the app's Goals page shows under "To do this month"
// (react-app/src/utils/familyPlan.js + the 'switch' and 'protect' steps of utils/goalTodo.js). Keep in step.
// ══════════════════════════════════════════════════════════════════════
var FAMILY_BAND_ = 10;
var GOAL_RET_ONLY_ = ['epf', 'ppf', 'nps', 'vpf', 'sukanya samriddhi', 'sukanya', 'ssy'];
function goalIsElss_(h) { return /elss/i.test((h && h.category) || '') || /\b(elss|tax ?saver)\b/i.test((h && h.fundName) || ''); }
function goalNavOf_(h) { return Number(h.currentNav) || ((Number(h.currentValue) || 0) / (Number(h.units) || 1)) || 0; }

/** Plans for the active goals as the app builds them in pool mode (only what the family plan needs). */
function goalPlans_(goals, att, now) {
  return (goals || []).filter(function (g) { return g.targetDate && isFinite(new Date(g.targetDate).getTime()); }).map(function (g) {
    var years = Math.max(0, (new Date(g.targetDate) - now) / GOAL_YEAR_MS_);
    var a = att[g.goalId] || { total: 0, equity: 0, items: [] };
    var isRet = g.goalType === 'Retirement';
    var eqTarget = years > 0 || isRet || goalSpendsOverYears_(g) ? goalAllocation_(g, years).equity : 0;
    if (years <= 0 && !isRet && !goalSpendsOverYears_(g)) eqTarget = 0;
    return { goal: g, years: years, isRet: isRet, has: a.total, att: a, eqTarget: eqTarget, eqNow: a.total > 0 ? Math.round(a.equity / a.total * 100) : null,
      bucketMode: isRet && years <= 5, state: years <= 0 ? 'due' : 'live' };
  }).sort(function (x, y) { return x.years - y.years; });
}

/** familyPlan() of the app. cashItems: idle cash for the "too little equity" case. */
function familyPlan_(plans, mfHoldings, included, cashItems, eqOf, lockedIds) {
  var live = (plans || []).filter(function (p) { return p.has > 0; });
  var per = live.map(function (p) {
    var items = (p.att && p.att.items) || [];
    var locked = items.filter(function (it) { return lockedIds[it.portfolioId]; }).reduce(function (t, it) { return t + it.value; }, 0);
    var want = Math.min(p.has - locked, p.has * (p.eqTarget || 0) / 100);
    return { p: p, items: items, gap: ((p.att && p.att.equity) || 0) - want };
  });
  var P = live.reduce(function (t, p) { return t + p.has; }, 0);
  var haveE = live.reduce(function (t, p) { return t + ((p.att && p.att.equity) || 0); }, 0);
  var gapAll = per.reduce(function (t, x) { return t + x.gap; }, 0);
  var out = { P: P, haveEq: P ? haveE / P * 100 : 0, needEq: P ? (haveE - gapAll) / P * 100 : 0, gap: gapAll, steps: [] };
  if (!(P > 0) || Math.abs(gapAll) / P * 100 < FAMILY_BAND_) { out.status = 'ok'; return out; }
  var tooMuchEq = gapAll > 0;
  var givers = per.filter(function (x) { return tooMuchEq ? x.gap > 0 : x.gap < 0 && (x.p.years == null ? 99 : x.p.years) > 5; });
  var share = {};
  givers.forEach(function (x) { x.items.forEach(function (it) {
    if (it.kind === 'mf' && !lockedIds[it.portfolioId]) { var k = it.portfolioId + '::' + (it.holding.schemeCode || it.holding.fundCode); share[k] = Math.min(1, (share[k] || 0) + (it.fraction || 0)); }
  }); });
  var keyOf = function (h) { return h.portfolioId + '::' + (h.schemeCode || h.fundCode); };
  var giveGap = givers.reduce(function (t, x) { return t + Math.abs(x.gap); }, 0);
  var cashOf = {};
  givers.forEach(function (x) { x.items.forEach(function (it) { if (it.kind === 'other') cashOf[it.portfolioId] = (cashOf[it.portfolioId] || 0) + it.value; }); });
  var myCash = (cashItems || []).map(function (c) { return Object.assign({}, c, { value: Math.min(c.value, cashOf[c.id] || 0) }); }).filter(function (c) { return c.value > 0; });
  var pv = {};
  var H = (mfHoldings || []).filter(function (h) { return included[h.portfolioId] && Number(h.units) > 0; });
  H.forEach(function (h) { pv[h.portfolioId] = (pv[h.portfolioId] || 0) + (Number(h.currentValue) || 0); });
  var F = H.map(function (h) {
    var v = Number(h.currentValue) || 0, t = Number(h.targetAllocationPct) || 0, sh = share[keyOf(h)] || 0;
    var cur = pv[h.portfolioId] > 0 ? v / pv[h.portfolioId] * 100 : 0;
    return { h: h, v: v, mine: v * sh, sh: sh, eq: eqOf(h), over: t > 0 ? cur - t : 0, overRs: t > 0 ? Math.max(0, v - t / 100 * pv[h.portfolioId]) * sh : 0, underRs: t > 0 ? Math.max(0, t / 100 * pv[h.portfolioId] - v) : 0 };
  });
  var start = Math.min(Math.abs(gapAll), giveGap), left = start, band = FAMILY_BAND_ / 100 * P;
  var fromKind = function (f) { return (tooMuchEq ? f.eq >= 0.5 : f.eq < 0.5) && f.sh > 0; };
  var toKind = function (f) { return tooMuchEq ? f.eq < 0.5 : f.eq >= 0.5; };
  var destIn = function (pid) {
    return F.filter(function (f) { return toKind(f) && !f.h.lumpsumRestricted && (!pid || f.h.portfolioId === pid); })
      .sort(function (a, b) { return (b.underRs - a.underRs) || (b.v - a.v); })[0] || null;
  };
  if (!tooMuchEq && left > band) {
    for (var ci = 0; ci < myCash.length; ci++) {
      var c = myCash[ci];
      if (left <= band) break;
      var amt = Math.floor(Math.min(c.value, left) / 1000) * 1000;
      if (amt < 5000) continue;
      var dests = F.filter(function (f) { return f.eq >= 0.5 && !f.h.lumpsumRestricted; }).sort(function (a, b) { return (b.underRs - a.underRs) || (b.v - a.v); }).slice(0, 3);
      if (!dests.length) { out.steps.push({ t: 'lump', from: c, fund: null, amount: amt, wantSafe: false }); left -= amt; continue; }
      var W = dests.reduce(function (t, f) { return t + (f.underRs || f.v); }, 0), rest0 = amt;
      dests.forEach(function (f, i) { var a = i === dests.length - 1 ? rest0 : Math.floor(amt * (f.underRs || f.v) / W / 100) * 100; rest0 -= a; if (a > 0) out.steps.push({ t: 'lump', from: c, fund: f.h, portfolioId: f.h.portfolioId, amount: a }); });
      left -= amt;
    }
  }
  if (left > band) {
    var ports = Object.keys(pv).map(function (pid) {
      return { pid: pid, v: F.filter(function (f) { return f.h.portfolioId === pid && fromKind(f) && !goalIsElss_(f.h); }).reduce(function (t, f) { return t + f.mine; }, 0) };
    }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    for (var pi = 0; pi < ports.length; pi++) {
      var pid = ports[pi].pid;
      if (left <= 500) break;
      var src = F.filter(function (f) { return f.h.portfolioId === pid && fromKind(f) && !goalIsElss_(f.h); }).sort(function (a, b) { return (b.overRs - a.overRs) || (b.v - a.v); });
      var can = src.reduce(function (t, f) { return t + f.mine; }, 0);
      var sellAll = Math.min(left, can * 0.9);
      var overSum = src.reduce(function (t, f) { return t + f.overRs; }, 0);
      var dest = destIn(pid), rest = sellAll;
      for (var si = 0; si < src.length; si++) {
        var f = src[si];
        if (rest < 500) break;
        var part = overSum >= sellAll ? f.overRs / overSum : (f.overRs + (sellAll - overSum) * f.mine / can) / sellAll;
        var sv = Math.min(f.mine, Math.max(0, sellAll * part), rest);
        if (sv < 500) continue;
        var nav = goalNavOf_(f.h);
        out.steps.push({ t: 'sell', fund: f.h, portfolioId: pid, value: sv, units: nav > 0 ? sv / nav : null, nav: nav });
        rest -= sv;
      }
      var sold = sellAll - rest;
      if (sold >= 500) out.steps.push({ t: 'buy', fund: dest ? dest.h : null, portfolioId: pid, value: sold, wantSafe: tooMuchEq });
      left -= sold;
    }
  }
  out.status = out.steps.some(function (x) { return x.t !== 'note'; }) ? 'steps' : 'ok';
  out.doable = Math.max(0, start - left);
  out.after = Math.max(0, Math.abs(gapAll) - out.doable);
  return out;
}

/** The 'switch' and 'protect' steps of the app's goalTodo(): exact funds, units to sell and the fund to buy. */
function goalSwitchSteps_(plans, family) {
  var steps = [];
  var fkey = function (h) { return (h && h.portfolioId) + '::' + ((h && (h.schemeCode || h.fundCode || h.fundName)) || ''); };
  if (family && family.status === 'steps') {
    var byPort = {}, order = [];
    family.steps.filter(function (x) { return x.t === 'sell' || x.t === 'buy'; }).forEach(function (s) {
      if (!byPort[s.portfolioId]) { byPort[s.portfolioId] = { sells: [], buys: [] }; order.push(s.portfolioId); }
      byPort[s.portfolioId][s.t === 'sell' ? 'sells' : 'buys'].push(s);
    });
    order.forEach(function (pid) {
      var g = byPort[pid];
      if (!g.sells.length) return;
      steps.push({ t: 'switch', portfolioId: pid, sells: g.sells.map(function (s) { return Object.assign({}, s, { units: s.units != null ? s.units : (goalNavOf_(s.fund) ? s.value / goalNavOf_(s.fund) : null) }); }),
        buys: g.buys, total: g.sells.reduce(function (t, s) { return t + s.value; }, 0), toSafe: !!(g.buys[0] && g.buys[0].wantSafe) });
    });
  }
  var sold = {};
  steps.forEach(function (st) { st.sells.forEach(function (r) { sold[fkey(r.fund)] = (sold[fkey(r.fund)] || 0) + (r.value || 0); }); });
  (plans || []).forEach(function (p) {
    if (p.isRet || p.state === 'due' || !(p.years > 0) || p.years > 5 || p.eqNow == null) return;
    var over = p.eqNow - p.eqTarget;
    var amount = Math.round(((over / 100) * p.has) / 1000) * 1000;
    if (over <= 20 || amount < 25000) return;
    var eqMf = ((p.att && p.att.items) || []).filter(function (it) { return it.kind === 'mf' && it.eq >= 0.65 && it.value > 0.5 && !goalIsElss_(it.holding); }).sort(function (a, b) { return b.value - a.value; });
    var left = amount, sells = [];
    for (var i = 0; i < eqMf.length; i++) {
      var it = eqMf[i];
      if (left < 1000) break;
      var free = Math.min(it.value, (Number(it.holding.currentValue) || 0) - (sold[fkey(it.holding)] || 0));
      var v = Math.min(left, free);
      if (v < 1000) continue;
      sold[fkey(it.holding)] = (sold[fkey(it.holding)] || 0) + v;
      var nav = goalNavOf_(it.holding);
      sells.push({ fund: it.holding, portfolioId: it.portfolioId, value: v, units: nav ? v / nav : null, all: v >= (Number(it.holding.currentValue) || 0) - 1 });
      left -= v;
    }
    if (!sells.length) return;
    var pid = sells[0].portfolioId;
    var debt = (plans || []).reduce(function (a, q) { return a.concat((q.att && q.att.items) || []); }, [])
      .filter(function (it) { return it.kind === 'mf' && it.portfolioId === pid && it.eq < 0.2 && !(it.holding && it.holding.lumpsumRestricted); }).sort(function (a, b) { return b.value - a.value; })[0];
    steps.push({ t: 'protect', goal: p.goal, portfolioId: pid, eqNow: p.eqNow, eqTarget: p.eqTarget, years: p.years, total: sells.reduce(function (t, x) { return t + x.value; }, 0), sells: sells, buy: debt ? debt.holding : null });
  });
  return steps;
}

/** Everything the de-risk alert needs, from the same data the family email reads. */
function goalMoves_(goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap, now) {
  var att = attributeGoals_(goals, mappings, mfHoldings, stockHoldings, otherInvList, allocMap, now);
  var plans = goalPlans_(goals, att, now);
  var included = {}, lockedIds = {};
  (mappings || []).forEach(function (m) { if (Number(m.allocationPct) > 0) included[m.portfolioId] = true; });
  (otherInvList || []).forEach(function (i) { if (GOAL_RET_ONLY_.indexOf(String(i.investmentType || '').trim().toLowerCase()) >= 0) lockedIds[i.investmentId] = true; });
  var eqOf = function (h) { return goalRiskFraction_(h, allocMap); };
  var family = familyPlan_(plans.filter(function (p) { return !(p.years <= 0 && !p.isRet); }), mfHoldings, included, [], eqOf, lockedIds);
  return { att: att, plans: plans, family: family, steps: goalSwitchSteps_(plans, family) };
}

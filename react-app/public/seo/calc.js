/* Capital Friends public calculators. Plain JS, no framework: every page is indexable HTML with the form in it. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fmt; fmt = function (n) {
    if (!isFinite(n)) return '—';
    var neg = n < 0; n = Math.abs(Math.round(n));
    var s = n.toString(), last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last3 = ',' + last3;
    return (neg ? '-' : '') + '₹' + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3;
  };
  var short = function (n) {
    if (!isFinite(n)) return '—';
    var a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e12) return s + '₹' + Math.round(a / 1e7).toLocaleString('en-IN') + ' Cr';   // never scientific notation
    if (a >= 1e7) return s + '₹' + (a / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
    if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
    return fmt(n);
  };
  var pct = function (x) { return (x * 100).toFixed(2).replace(/\.?0+$/, '') + '%'; };
  // Read a field, kept inside its min/max (typed values ignore the attributes). The box is corrected too, so the user sees it.
  var num = function (id) {
    var el = $(id) || {}, v = parseFloat(el.value); if (!isFinite(v)) return 0;
    var lo = parseFloat(el.min), hi = parseFloat(el.max), c = v;
    if (isFinite(lo) && c < lo) c = lo; if (isFinite(hi) && c > hi) c = hi;
    if (c !== v && document.activeElement !== el) el.value = c;
    return c;
  };
  var fmt0 = fmt; fmt = function (n) { return Math.abs(n) >= 1e12 ? short(n) : fmt0(n); };   // huge rupee amounts also stay readable
  var setText = function (id, t) { var e = $(id); if (e) e.textContent = t; };

  // ---------- maths ----------
  function sipFV(p, annualPct, years, stepUpPct, lump) {
    var r = annualPct / 100 / 12, n = Math.round(years * 12), fv = lump || 0, inv = lump || 0, rows = [], m = p;
    for (var i = 1; i <= n; i++) {
      if (stepUpPct && i > 1 && (i - 1) % 12 === 0) m = m * (1 + stepUpPct / 100);
      fv = (fv + m) * (1 + r); inv += m;
      if (i % 12 === 0 || i === n) rows.push({ year: Math.ceil(i / 12), invested: inv, value: fv, sip: m });
    }
    return { fv: fv, invested: inv, rows: rows };
  }
  function lumpFV(p, annualPct, years) {
    var rows = [], v = p;
    for (var y = 1; y <= Math.ceil(years); y++) { v = p * Math.pow(1 + annualPct / 100, Math.min(y, years)); rows.push({ year: y, invested: p, value: v }); }
    return { fv: p * Math.pow(1 + annualPct / 100, years), invested: p, rows: rows };
  }
  function swp(corpus, monthly, annualPct, years, inflPct) {
    var r = annualPct / 100 / 12, bal = corpus, out = 0, rows = [], w = monthly, lastedMonths = 0, n = Math.round(years * 12);
    for (var i = 1; i <= n; i++) {
      if (inflPct && i > 1 && (i - 1) % 12 === 0) w = w * (1 + inflPct / 100);
      bal = bal * (1 + r) - w; out += w; lastedMonths = i;
      if (bal <= 0) { out += bal; bal = 0; rows.push({ year: Math.ceil(i / 12), withdrawn: out, value: 0, w: w }); break; }
      if (i % 12 === 0 || i === n) rows.push({ year: Math.ceil(i / 12), withdrawn: out, value: bal, w: w });
    }
    return { final: bal, withdrawn: out, rows: rows, lasted: lastedMonths, exhausted: bal <= 0 && lastedMonths < n };
  }
  function cagr(pv, fv, years) { return years > 0 && pv > 0 ? Math.pow(fv / pv, 1 / years) - 1 : NaN; }
  function xirr(flows) { // flows: [{d: Date, a: amount}], at least one negative and one positive
    var t0 = flows[0].d.getTime(), f = function (r) { var s = 0; for (var i = 0; i < flows.length; i++) { var y = (flows[i].d.getTime() - t0) / 31536e6; s += flows[i].a / Math.pow(1 + r, y); } return s; };
    var lo = -0.99, hi = 10, mid;
    if (f(lo) * f(hi) > 0) return NaN;
    for (var k = 0; k < 200; k++) { mid = (lo + hi) / 2; var v = f(mid); if (Math.abs(v) < 1e-6) break; if (f(lo) * v < 0) hi = mid; else lo = mid; }
    return mid;
  }
  function bar(id, a, b, la, lb) {
    var e = $(id); if (!e) return; var tot = a + b; if (tot <= 0) { e.innerHTML = ''; return; }
    var pa = Math.max(2, Math.round(a / tot * 100)), pb = 100 - pa;
    e.innerHTML = '<div class="bar"><span style="width:' + pa + '%" class="bar-a"></span><span style="width:' + pb + '%" class="bar-b"></span></div>' +
      '<div class="bar-l"><span><i class="dot dot-a"></i>' + la + ' ' + short(a) + '</span><span><i class="dot dot-b"></i>' + lb + ' ' + short(b) + '</span></div>';
  }
  function table(id, head, rows) {
    var e = $(id); if (!e) return;
    var h = '<table><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; });
    e.innerHTML = h + '</tbody></table>';
  }

  // ---------- calculators ----------
  var C = {
    sip: function () {
      var p = num('f-amount'), r = num('f-rate'), y = num('f-years'), s = num('f-stepup'), l = num('f-lump');
      var o = sipFV(p, r, y, s, l);
      setText('r-value', short(o.fv)); setText('r-invested', short(o.invested)); setText('r-gain', short(o.fv - o.invested));
      setText('r-note', (l ? fmt(l) + ' today, plus ' : 'Invest ') + fmt(p) + ' a month' + (s ? ', increasing ' + s + '% every year,' : '') + ' for ' + y + ' years at ' + r + '% a year gives about ' + fmt(o.fv) + '.');
      bar('r-bar', o.invested, o.fv - o.invested, 'Invested', 'Returns');
      table('r-table', ['Year', 'Monthly SIP', 'Total invested', 'Value'], o.rows.map(function (x) { return [x.year, fmt(x.sip), short(x.invested), short(x.value)]; }));
    },
    lumpsum: function () {
      var p = num('f-amount'), r = num('f-rate'), y = num('f-years'); var o = lumpFV(p, r, y);
      setText('r-value', short(o.fv)); setText('r-invested', short(p)); setText('r-gain', short(o.fv - p));
      setText('r-note', fmt(p) + ' invested once, growing at ' + r + '% a year for ' + y + ' years, becomes about ' + fmt(o.fv) + ' (' + (o.fv / p).toFixed(1) + 'x).');
      bar('r-bar', p, o.fv - p, 'Invested', 'Returns');
      table('r-table', ['Year', 'Value'], o.rows.map(function (x) { return [x.year, short(x.value)]; }));
    },
    swp: function () {
      var c = num('f-corpus'), w = num('f-withdraw'), r = num('f-rate'), y = num('f-years'), inf = num('f-inflation'); var o = swp(c, w, r, y, inf);
      setText('r-value', short(o.final)); setText('r-invested', short(o.withdrawn)); setText('r-gain', o.exhausted ? (Math.floor(o.lasted / 12) + ' yrs ' + (o.lasted % 12) + ' mo') : y + ' years');
      setText('r-note', o.exhausted ? 'At ' + fmt(w) + ' a month the corpus runs out after ' + Math.floor(o.lasted / 12) + ' years and ' + (o.lasted % 12) + ' months. Lower the withdrawal or the inflation step-up.' :
        'Withdraw ' + fmt(w) + ' a month' + (inf ? ' (rising ' + inf + '% a year)' : '') + ' for ' + y + ' years and about ' + fmt(o.final) + ' is still left, because the corpus keeps earning ' + r + '%.');
      bar('r-bar', o.withdrawn, Math.max(0, o.final), 'Withdrawn', 'Left');
      table('r-table', ['Year', 'Monthly withdrawal', 'Total withdrawn', 'Corpus left'], o.rows.map(function (x) { return [x.year, fmt(x.w), short(x.withdrawn), short(x.value)]; }));
    },
    cagr: function () {
      var pv = num('f-start'), fv = num('f-end'), y = num('f-years'); var g = cagr(pv, fv, y);
      setText('r-value', isFinite(g) ? pct(g) : '—'); setText('r-invested', short(fv - pv)); setText('r-gain', pv > 0 ? ((fv / pv - 1) * 100).toFixed(1) + '%' : '—');
      setText('r-note', isFinite(g) ? fmt(pv) + ' growing to ' + fmt(fv) + ' in ' + y + ' years is a CAGR of ' + pct(g) + ' a year. Absolute return ' + ((fv / pv - 1) * 100).toFixed(1) + '%.' : 'Enter a start value, an end value and the number of years.');
      bar('r-bar', pv, Math.max(0, fv - pv), 'Start', 'Growth');
      var rows = []; for (var k = 1; k <= Math.min(30, Math.ceil(y)); k++) rows.push([k, short(pv * Math.pow(1 + g, k))]); table('r-table', ['Year', 'Value at this CAGR'], rows);
    },
    xirr: function () {
      var rowsEl = document.querySelectorAll('#flows .flow'), flows = [], inv = 0;
      rowsEl.forEach(function (row) { var d = row.querySelector('.fd').value, a = parseFloat(row.querySelector('.fa').value); if (d && isFinite(a) && a > 0) { flows.push({ d: new Date(d), a: -a }); inv += a; } });
      var vd = $('f-vdate').value, vv = num('f-value');
      if (vd && vv > 0) flows.push({ d: new Date(vd), a: vv });
      flows.sort(function (a, b) { return a.d - b.d; });
      var g = flows.length >= 2 ? xirr(flows) : NaN;
      setText('r-value', isFinite(g) ? pct(g) : '—'); setText('r-invested', short(inv)); setText('r-gain', short(vv - inv));
      setText('r-note', isFinite(g) ? 'Your money earned ' + pct(g) + ' a year (XIRR), counting the exact date of every purchase. Total invested ' + fmt(inv) + ', worth ' + fmt(vv) + ' today.' : 'Add at least one purchase and today\'s value.');
      bar('r-bar', inv, Math.max(0, vv - inv), 'Invested', 'Gain');
    },
    retirement: function () {
      var exp = num('f-expense'), age = num('f-age'), rage = num('f-retire'), life = num('f-life'), inf = num('f-inflation'), ret = num('f-rate'), pre = num('f-prerate'), have = num('f-have');
      if (rage <= age) { rage = age + 1; } if (life <= rage) { life = rage + 1; }   // retire after today, money lasts past retirement
      var yrs = Math.max(0, rage - age), fexp = exp * Math.pow(1 + inf / 100, yrs), years = Math.max(1, life - rage);
      // Same rule as the Capital Friends app: a safe withdrawal rate by how long the money must last (post-retirement years)
      // 40+ yrs 3.0% (33x) · 35+ 3.3% (30x) · 25+ 4.0% (25x) · 18+ 5.0% (20x) · else 6.0% (17x) of the first year's expenses
      var swr = years >= 40 ? 0.030 : years >= 35 ? 0.033 : years >= 25 ? 0.040 : years >= 18 ? 0.050 : 0.060;
      var corpus = fexp * 12 / swr;
      var haveFV = have * Math.pow(1 + pre / 100, yrs), gap = Math.max(0, corpus - haveFV);
      var r = pre / 100 / 12, n = yrs * 12, sip = n > 0 && r > 0 ? gap * r / ((Math.pow(1 + r, n) - 1) * (1 + r)) : (n > 0 ? gap / n : gap);
      setText('r-value', short(corpus)); setText('r-invested', short(fexp)); setText('r-gain', short(sip));
      setText('r-note', 'Today\'s ' + fmt(exp) + ' a month becomes ' + fmt(fexp) + ' a month at ' + inf + '% inflation when you retire at ' + rage + '. For ' + years + ' years of retirement the app plans a ' + (swr * 100).toFixed(1) + '% safe withdrawal rate, so you need about ' + fmt(corpus) + ' at retirement (' + Math.round(1 / swr) + 'x the first year\'s expenses)' + (have ? ', of which your current ' + fmt(have) + ' grows to ' + short(haveFV) : '') + '. The gap needs a SIP of about ' + fmt(sip) + ' a month for ' + yrs + ' years.');
      bar('r-bar', haveFV, gap, 'From what you have', 'Still to build');
      var rows = [], bal = corpus, w = fexp * 12; for (var k = 1; k <= Math.min(years, 40); k++) { bal = bal * (1 + ret / 100) - w; rows.push([rage + k, short(w), short(Math.max(0, bal))]); w *= 1 + inf / 100; }
      table('r-table', ['Age', 'Yearly expenses', 'Corpus left'], rows);
    },
    emergency: function () {
      var exp = num('f-expense'), m = num('f-months'), emi = num('f-emi'), have = num('f-have'); var need = (exp + emi) * m, gap = Math.max(0, need - have);
      setText('r-value', short(need)); setText('r-invested', short(have)); setText('r-gain', short(gap));
      setText('r-note', 'With ' + fmt(exp + emi) + ' of monthly expenses and EMIs, a ' + m + '-month emergency fund is ' + fmt(need) + '.' + (gap > 0 ? ' You still need ' + fmt(gap) + '. Keep it in a savings account, sweep-in FD or liquid fund, not in equity.' : ' You already have it. Keep it separate from your investments.'));
      bar('r-bar', Math.min(have, need), gap, 'You have', 'To add');
    },
    fire: function () {
      var exp = num('f-expense'), age = num('f-age'), have = num('f-have'), save = num('f-save'), ret = num('f-rate'), inf = num('f-inflation'), swr = num('f-swr');
      var real = (1 + ret / 100) / (1 + inf / 100) - 1, target = exp * 12 / (swr / 100), bal = have, yrs = 0, rows = [];
      while (bal < target && yrs < 60) { bal = bal * (1 + real) + save * 12; yrs++; rows.push([age + yrs, short(bal), short(target)]); }
      setText('r-value', short(target)); setText('r-invested', (bal >= target ? yrs : '60+') + ' years'); setText('r-gain', bal >= target ? 'age ' + (age + yrs) : '—');
      setText('r-note', 'Your FIRE number at a ' + swr + '% withdrawal rate is ' + fmt(target) + ' in today\'s money (' + (100 / swr).toFixed(0) + 'x yearly expenses). Saving ' + fmt(save) + ' a month at a real return of ' + pct(real) + ' (' + ret + '% minus ' + inf + '% inflation), you reach it in ' + (bal >= target ? yrs + ' years, at age ' + (age + yrs) : 'more than 60 years') + '.');
      bar('r-bar', Math.min(have, target), Math.max(0, target - have), 'Have today', 'To build');
      table('r-table', ['Age', 'Corpus (today\'s money)', 'Target'], rows);
    },
    goal: function () {
      var cost = num('f-cost'), y = num('f-years'), inf = num('f-inflation'), ret = num('f-rate'), have = num('f-have');
      var fcost = cost * Math.pow(1 + inf / 100, y), haveFV = have * Math.pow(1 + ret / 100, y), gap = Math.max(0, fcost - haveFV);
      var r = ret / 100 / 12, n = y * 12, sip = n > 0 && r > 0 ? gap * r / ((Math.pow(1 + r, n) - 1) * (1 + r)) : (n > 0 ? gap / n : gap), lump = gap / Math.pow(1 + ret / 100, y);
      setText('r-value', short(fcost)); setText('r-invested', short(sip)); setText('r-gain', short(lump));
      setText('r-note', 'Something that costs ' + fmt(cost) + ' today will cost about ' + fmt(fcost) + ' in ' + y + ' years at ' + inf + '% inflation. ' + (have ? 'Your ' + fmt(have) + ' grows to ' + short(haveFV) + ', so the gap is ' + short(gap) + '. ' : '') + 'Cover it with a SIP of ' + fmt(sip) + ' a month, or ' + fmt(lump) + ' invested today, at ' + ret + '% a year.');
      bar('r-bar', haveFV, gap, 'From what you have', 'Still to build');
      var rows = []; for (var k = 1; k <= y; k++) rows.push([k, short(cost * Math.pow(1 + inf / 100, k))]); table('r-table', ['Year', 'Cost of the goal'], rows);
    },
    networth: function () {
      var a = ['f-mf', 'f-stocks', 'f-fd', 'f-epf', 'f-gold', 'f-property', 'f-cash', 'f-other'].reduce(function (s, id) { return s + num(id); }, 0);
      var l = ['f-home', 'f-car', 'f-personal', 'f-cc'].reduce(function (s, id) { return s + num(id); }, 0);
      setText('r-value', short(a - l)); setText('r-invested', short(a)); setText('r-gain', short(l));
      setText('r-note', 'Assets ' + fmt(a) + ' minus loans ' + fmt(l) + ' gives a net worth of ' + fmt(a - l) + '.' + (a > 0 ? ' Liquid investments (funds, stocks, FD, EPF, gold, cash) are ' + pct((a - num('f-property')) / a) + ' of your assets.' : ''));
      bar('r-bar', Math.max(0, a - l), l, 'Net worth', 'Loans');
    }
  };

  function run() { var el = document.querySelector('[data-calc]'); if (!el) return; var fn = C[el.getAttribute('data-calc')]; if (fn) { try { fn(); } catch (e) { } } }
  document.addEventListener('input', function (e) { if (e.target && e.target.matches('.calc input, .calc select')) run(); });
  document.addEventListener('focusout', function (e) { if (e.target && e.target.matches('.calc input[type=number]')) { num(e.target.id); run(); } }, true);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'add-flow') { var t = document.querySelector('#flows .flow'); var c = t.cloneNode(true); c.querySelector('.fa').value = ''; $('flows').appendChild(c); }
    if (e.target && e.target.classList.contains('rm-flow')) { var rows = document.querySelectorAll('#flows .flow'); if (rows.length > 1) e.target.closest('.flow').remove(); run(); }
  });
  document.addEventListener('DOMContentLoaded', run); run();
})();

// Who is this? Match a name from a statement or broker file to a family member.
// Platforms write the same person differently: "MANNE JAGADEESH KUMAR", "Jagadeesh Kumar Manne", "J K Manne",
// "JAGADEESHKUMAR MANNE", "Mr. Jagdeesh Manne". So:
//  - word order does not matter, titles (Mr, Mrs, Smt, Dr…) are ignored
//  - an initial matches a word starting with that letter (J ↔ Jagadeesh)
//  - spellings close enough count (Jagdeesh ↔ Jagadeesh, Vishali ↔ Visali, Sanjit ↔ Sanjith)
//  - two words written together match the two words apart (Jagadeeshkumar ↔ Jagadeesh Kumar)
//  - every part of the shorter name must be explained by the longer one, with at least one full word.
//    A family shares a surname, so "Visali Manne" never matches "Jagadeesh Manne".
//  - PAN breaks ties, and finds someone whose surname changed (same PAN, first name in the statement name).
// The same code (ES5) is in gas-webapp/NameMatch.js for the server: change both together.

var NM_TITLES_ = { mr: 1, mrs: 1, ms: 1, miss: 1, dr: 1, shri: 1, sri: 1, smt: 1, kum: 1, kumari: 1, master: 1, mast: 1, late: 1, prof: 1, minor: 1 };

function nmTokens_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) { return t && !NM_TITLES_[t]; });
}
// sound-alike spelling: th/dh/bh/kh/gh/ph/sh/ch → t/d/b/k/g/p/s/c, w → v, z → j, ee → i, oo → u, double letters once, last a dropped
function nmCanon_(t) {
  return t.replace(/([bcdgkpst])h/g, '$1').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/(.)\1+/g, '$1').replace(/y$/, 'i').replace(/a$/, '');
}
function nmLev1_(a, b) {   // edit distance <= 1
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  var i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
/** 'full' | 'initial' | '' */
function nmWord_(a, b) {
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 'initial' : '';
  var ca = nmCanon_(a), cb = nmCanon_(b);
  if (ca === cb) return 'full';
  if (ca.length >= 5 && cb.length >= 5 && nmLev1_(ca, cb)) return 'full';
  return '';
}
// "jagadeeshkumar" on one side and "jagadeesh kumar" on the other: join the two words
function nmJoin_(a, b) {
  var out = a.slice();
  for (var i = 0; i < out.length - 1; i++) {
    var joined = out[i] + out[i + 1];
    if (out[i].length > 1 && out[i + 1].length > 1 && b.some(function (w) { return w.length > 1 && nmWord_(w, joined) === 'full'; })) { out.splice(i, 2, joined); i--; }
  }
  return out;
}

/** How well two names fit: null when they are not the same person, else { full, initial } (higher = better). */
function nameFit(nameA, nameB) {
  var a = nmTokens_(nameA), b = nmTokens_(nameB);
  if (!a.length || !b.length) return null;
  a = nmJoin_(a, b); b = nmJoin_(b, a);
  var fullsA = a.filter(function (t) { return t.length > 1; }).length, fullsB = b.filter(function (t) { return t.length > 1; }).length;
  // the shorter name must be explained part by part by the longer one
  var S = a.length < b.length || (a.length === b.length && fullsA <= fullsB) ? a : b, L = S === a ? b : a;
  var used = [], full = 0, initial = 0;
  for (var pass = 0; pass < 2; pass++) {
    // pass 0: whole words first, so an initial can't take a word another whole word needs
    for (var i = 0; i < S.length; i++) {
      if (used.indexOf('s' + i) >= 0) continue;
      if (pass === 0 && S[i].length === 1) continue;
      for (var j = 0; j < L.length; j++) {
        if (used.indexOf('l' + j) >= 0) continue;
        var k = nmWord_(S[i], L[j]);
        if (pass === 0 && k !== 'full') continue;
        if (!k) continue;
        used.push('s' + i, 'l' + j);
        if (k === 'full') full++; else initial++;
        break;
      }
    }
  }
  if (full + initial < S.length || full < 1) return null;
  return { full: full, initial: initial };
}

/**
 * The family member a statement name belongs to, or null (nobody, or two people fit equally: let the user pick).
 * members: [{ memberId, memberName, pan }]
 */
function matchMemberName(members, holderName, pan) {
  var P = String(pan || '').toUpperCase().trim();
  // words two or more members share (the family surname): matching only those, plus an initial, needs the
  // initial to be the member's own first name ("J K Manne" is Jagadeesh Kumar Manne, "K Manne" is nobody)
  var count = {};
  (members || []).forEach(function (m) { var seen = {}; nmTokens_(m.memberName).forEach(function (t) { var c = nmCanon_(t); if (t.length > 1 && !seen[c]) { seen[c] = 1; count[c] = (count[c] || 0) + 1; } }); });
  var ht = nmTokens_(holderName);
  var ownWordsOk = function (m) {
    var mt = nmJoin_(nmTokens_(m.memberName), ht), hj = nmJoin_(ht, mt);
    var own = mt.filter(function (t) { return t.length > 1 && !(count[nmCanon_(t)] >= 2); });
    if (!own.length) return true;
    if (own.some(function (t) { return hj.some(function (h) { return h.length > 1 && nmWord_(t, h) === 'full'; }); })) return true;
    return hj.some(function (h) { return h.length === 1 && h === own[0][0]; });
  };
  var fits = [];
  (members || []).forEach(function (m) { var f = nameFit(m.memberName, holderName); if (f && ownWordsOk(m)) fits.push({ m: m, f: f, pan: !!P && String(m.pan || '').toUpperCase().trim() === P }); });
  if (!fits.length) {
    // surname changed (after marriage): same PAN and the first name is in the statement name
    if (!P) return null;
    var byPan = (members || []).filter(function (m) {
      if (String(m.pan || '').toUpperCase().trim() !== P) return false;
      var first = nmTokens_(m.memberName)[0];
      return !!first && nmTokens_(holderName).some(function (t) { return nmWord_(first, t) === 'full'; });
    });
    return byPan.length === 1 ? byPan[0] : null;
  }
  if (fits.length === 1) return fits[0].m;
  var withPan = fits.filter(function (x) { return x.pan; });
  if (withPan.length === 1) return withPan[0].m;
  fits.sort(function (x, y) { return (y.f.full * 2 + y.f.initial) - (x.f.full * 2 + x.f.initial); });
  var s0 = fits[0].f.full * 2 + fits[0].f.initial, s1 = fits[1].f.full * 2 + fits[1].f.initial;
  return s0 > s1 ? fits[0].m : null;
}

export { nameFit, matchMemberName, nmTokens_ as nameTokens }

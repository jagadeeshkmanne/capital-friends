/**
 * EmailTemplate.js — Family Wealth Dashboard HTML Email (Light Professional Theme)
 *
 * buildDashboardPDFHTML(data)  — Light-themed HTML matching email preview
 * buildSimpleEmailBody(...)    — Compact email body with financial highlights
 */

// ── Helpers ──

// Logo rendered as text in email header (no external image fetch needed)

function _escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmtDate(ds) {
  if (!ds) return '-';
  try {
    var d = new Date(ds);
    if (isNaN(d.getTime())) return String(ds);
    return Utilities.formatDate(d, 'Asia/Kolkata', 'dd MMM yyyy');
  } catch (e) { return String(ds); }
}

function _fmtCur(amount) { return formatEmailCurrency(amount); }
function _plColor(v) { return v >= 0 ? '#059669' : '#dc2626'; }
function _plSign(v) { return v >= 0 ? '+' : ''; }

function _maskAadhar(a) {
  if (!a) return '-';
  var s = String(a).replace(/\D/g, '');
  return s.length >= 4 ? 'XXXX-XXXX-' + s.slice(-4) : s;
}

function _fmtCurShort(amount) {
  if (!amount || isNaN(amount)) return '\u20B90';
  var neg = amount < 0, abs = Math.abs(amount), fmt;
  if (abs >= 10000000) { var cr = abs / 10000000; fmt = '\u20B9' + (cr >= 100 ? cr.toFixed(0) : cr.toFixed(cr === Math.floor(cr) ? 0 : 1)) + 'Cr'; }
  else if (abs >= 100000) { var lk = abs / 100000; fmt = '\u20B9' + (lk >= 100 ? lk.toFixed(0) : lk.toFixed(lk === Math.floor(lk) ? 0 : 1)) + 'L'; }
  else if (abs >= 1000) { var k = abs / 1000; fmt = '\u20B9' + (k >= 100 ? k.toFixed(0) : k.toFixed(k === Math.floor(k) ? 0 : 1)) + 'K'; }
  else fmt = '\u20B9' + abs.toFixed(0);
  return neg ? '-' + fmt : fmt;
}

function _hexBg(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// ── Light Theme Constants ──

var _ASSET_COLORS = {
  Equity: '#7c3aed', Debt: '#2563eb', Gold: '#d97706', Commodities: '#d97706',
  'Real Estate': '#f97316', Hybrid: '#6366f1', Cash: '#94a3b8', Other: '#94a3b8'
};
var _MEMBER_COLORS = ['#7c3aed', '#db2777', '#2563eb', '#d97706', '#059669', '#dc2626'];

var _QUEST_CONFIG = {
  'Health Insurance': { sev: 'CRITICAL', col: '#dc2626', title: 'No Health Insurance', desc: 'Get minimum \u20B95L coverage per family member. \u20B910L+ recommended for comprehensive protection.' },
  'Term Insurance': { sev: 'CRITICAL', col: '#dc2626', title: 'No Term Insurance', desc: 'Get 10-15x annual income as term cover. Critical for family financial security.' },
  'Emergency Fund': { sev: 'WARNING', col: '#d97706', title: 'No Emergency Fund', desc: 'Build 6-12 months of expenses as emergency fund before investing.' },
  'Family Awareness': { sev: 'WARNING', col: '#d97706', title: 'Family Not Aware of Finances', desc: 'Share this report with your family. Ensure at least one family member knows all account details.' },
  'Will': { sev: 'WARNING', col: '#d97706', title: 'Registered Will Not Created', desc: 'Create a registered Will for smooth asset transfer. One-time cost \u20B95,000\u201310,000.' },
  'Nominees': { sev: 'WARNING', col: '#d97706', title: 'Nominees Not Updated', desc: 'Add/update nominees on all bank accounts, investments, insurance, PF, PPF.' },
  'Goals': { sev: 'WARNING', col: '#d97706', title: 'Financial Goals Not Set', desc: 'Set clear financial goals with target amounts and dates to track progress.' }
};

// Section header helper
function _secH(label, accent, badge) {
  var h = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px"><tbody><tr>';
  h += '<td style="width:3px"><div style="width:3px;height:14px;background:' + accent + ';border-radius:2px"></div></td>';
  h += '<td style="padding-left:10px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px">' + _escHtml(label) + '</td>';
  if (badge) h += '<td align="right">' + badge + '</td>';
  h += '</tr></tbody></table>';
  return h;
}


// ══════════════════════════════════════════════════════════════════════
// MAIN TEMPLATE
// ══════════════════════════════════════════════════════════════════════

function buildDashboardPDFHTML(data) {
  var d = data || {};
  var logoUrl = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/logo-new.png';

  // ── Extract data ──
  var netWorth = d.netWorth || 0, totalAssets = d.totalAssets || 0, totalInvested = d.totalInvested || 0;
  var totalPL = d.totalPL || 0, plPct = d.plPct || (totalInvested > 0 ? (totalPL / totalInvested * 100) : 0);
  var totalLiabilities = d.totalLiabilities || 0, totalEMI = d.totalEMI || 0;
  var lifeCover = d.lifeCover || 0, healthCover = d.healthCover || 0;
  var assetClassList = d.assetClassList || [], allocByType = d.allocByType || [];
  var buyOpportunities = d.buyOpportunities || [], rebalanceItems = d.rebalanceItems || [];
  var activeInsurance = d.activeInsurance || [], activeLiabilities = d.activeLiabilities || [];
  var activeGoals = d.activeGoals || [];
  var familyMembers = d.familyMembers || [];
  var bankAccounts = d.bankAccounts || [], investmentAccounts = d.investmentAccounts || [];
  var allMFPortfolios = d.allMFPortfoliosFlat || [], allStockPortfolios = d.allStockPortfoliosFlat || [];
  var allOtherInvestments = d.allOtherInvestments || [];
  var membersData = d.membersData || [];
  var generatedAt = d.generatedAt || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');
  var questionnaireData = d.questionnaireData || null;

  // ── Reusable styles ──
  var _cs = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px;';
  var _th = 'padding:6px 8px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;';
  var _thL = _th + 'text-align:left;';
  var _thR = _th + 'text-align:right;';
  var _td = 'padding:6px 8px;font-size:13px;color:#475569;';
  var _tdR = _td + 'text-align:right;';
  var _tdB = 'padding:6px 8px;font-size:13px;font-weight:600;color:#1e293b;text-align:right;';
  var _tdMono = 'padding:6px 8px;font-size:13px;font-family:monospace;color:#475569;';
  var _rowBd = 'border-bottom:1px solid #e2e8f0';

  // ── Investment account lookup ──
  var iaLookup = {};
  for (var iai = 0; iai < investmentAccounts.length; iai++) iaLookup[investmentAccounts[iai].accountId] = investmentAccounts[iai];

  // ── Build per-member data ──
  var memberMap = {};
  for (var fmi = 0; fmi < familyMembers.length; fmi++) {
    var fm = familyMembers[fmi];
    memberMap[fm.memberId] = { member: fm, mfPortfolios: [], stockPortfolios: [], otherInvestments: [], liabilities: [], insurance: [], bankAccts: [] };
  }
  for (var mi = 0; mi < allMFPortfolios.length; mi++) {
    var mp = allMFPortfolios[mi];
    if (mp.ownerId && memberMap[mp.ownerId]) memberMap[mp.ownerId].mfPortfolios.push(mp);
  }
  for (var si = 0; si < allStockPortfolios.length; si++) {
    var sp = allStockPortfolios[si];
    if (sp.ownerId && memberMap[sp.ownerId]) memberMap[sp.ownerId].stockPortfolios.push(sp);
  }
  for (var oi = 0; oi < allOtherInvestments.length; oi++) {
    var inv = allOtherInvestments[oi];
    if (inv.familyMemberId && memberMap[inv.familyMemberId]) memberMap[inv.familyMemberId].otherInvestments.push(inv);
  }
  for (var li = 0; li < activeLiabilities.length; li++) {
    var lb = activeLiabilities[li];
    if (lb.familyMemberId && memberMap[lb.familyMemberId]) memberMap[lb.familyMemberId].liabilities.push(lb);
  }
  for (var ii = 0; ii < activeInsurance.length; ii++) {
    var ins = activeInsurance[ii];
    if (ins.memberId && memberMap[ins.memberId]) memberMap[ins.memberId].insurance.push(ins);
  }
  for (var bai = 0; bai < bankAccounts.length; bai++) {
    var ba = bankAccounts[bai];
    if (ba.memberId && memberMap[ba.memberId]) memberMap[ba.memberId].bankAccts.push(ba);
  }

  // ── Member name lookup ──
  var memNames = {};
  for (var mnli = 0; mnli < familyMembers.length; mnli++) memNames[familyMembers[mnli].memberId] = familyMembers[mnli].memberName;

  // ── Precompute per-member totals (for Family Breakdown) ──
  var memberTotals = [];
  var totalFamilyNW = 0;
  for (var mti = 0; mti < familyMembers.length; mti++) {
    var mtm = familyMembers[mti];
    var mtd = memberMap[mtm.memberId] || { mfPortfolios: [], stockPortfolios: [], otherInvestments: [], liabilities: [] };
    var mtMF = 0, mtStk = 0, mtOth = 0, mtLiab = 0;
    for (var j = 0; j < mtd.mfPortfolios.length; j++) mtMF += parseFloat(mtd.mfPortfolios[j].currentValue) || 0;
    for (var j2 = 0; j2 < mtd.stockPortfolios.length; j2++) mtStk += parseFloat(mtd.stockPortfolios[j2].currentValue) || 0;
    for (var j3 = 0; j3 < mtd.otherInvestments.length; j3++) mtOth += parseFloat(mtd.otherInvestments[j3].currentValue) || 0;
    for (var j4 = 0; j4 < mtd.liabilities.length; j4++) mtLiab += parseFloat(mtd.liabilities[j4].outstandingBalance) || 0;
    var mtNW = mtMF + mtStk + mtOth - mtLiab;
    totalFamilyNW += mtNW;
    memberTotals.push({ memberId: mtm.memberId, name: mtm.memberName, assets: mtMF + mtStk + mtOth, liabilities: mtLiab, netWorth: mtNW });
  }

  var plCol = totalPL >= 0 ? '#059669' : '#dc2626';
  var plS = totalPL >= 0 ? '+' : '';

  // ══════════════════════════════════════════════════════════════════
  // BUILD HTML
  // ══════════════════════════════════════════════════════════════════
  var h = '';
  h += '<div style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;background-color:#f8fafc">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc"><tbody><tr><td style="padding:24px">';

  // ══════════════════════════════════════════════════════════════════
  // 1. HEADER
  // ══════════════════════════════════════════════════════════════════
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0f1f;border-radius:10px;margin-bottom:16px"><tbody><tr><td style="padding:14px 20px">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="vertical-align:middle;padding-right:12px">';
  h += '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="vertical-align:middle;padding-right:8px"><img src="' + logoUrl + '" alt="Capital Friends" style="display:block;border:0;height:36px;width:auto"></td>';
  h += '<td style="vertical-align:middle"><span style="font-family:\'Poppins\',sans-serif;font-size:16px;letter-spacing:-0.3px;line-height:1"><span style="font-weight:700;color:#f1f5f9">Capital</span> <span style="font-weight:800;color:#34d399">Friends</span></span></td>';
  h += '</tr></tbody></table></td>';
  h += '<td align="right" style="vertical-align:middle;padding-left:12px">';
  h += '<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Auto-generated from your Google Sheets</div>';
  h += '<div style="font-size:13px;color:#cbd5e1;font-weight:500">Made with &#10084;&#65039; by <strong style="color:#f1f5f9">Jagadeesh Manne</strong></div>';
  h += '</td></tr></tbody></table></td></tr></tbody></table>';

  // ══════════════════════════════════════════════════════════════════
  // 1B. FINANCIAL LEGACY GUIDE
  // ══════════════════════════════════════════════════════════════════
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:rgba(5,150,105,0.06);border:1px solid rgba(52,211,153,0.15);border-radius:10px;margin-bottom:20px"><tbody><tr><td style="padding:16px 20px">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="vertical-align:top;width:28px;padding-right:10px"><div style="font-size:18px;line-height:1">&#128274;</div></td>';
  h += '<td style="vertical-align:top">';
  h += '<div style="font-size:13px;font-weight:700;color:#059669;margin-bottom:4px">Family Financial Blueprint</div>';
  h += '<div style="font-size:13px;color:#64748b;line-height:1.5">This report is a complete record of your family\'s financial life &mdash; every bank account, investment, insurance policy, loan, and goal. <strong style="color:#475569">Store it safely.</strong> In an emergency, this document helps your family locate and claim every asset.</div>';
  h += '</td></tr></tbody></table></td></tr></tbody></table>';

  // ══════════════════════════════════════════════════════════════════
  // 1C. CRITICAL ALERTS (Questionnaire "No" items)
  // ══════════════════════════════════════════════════════════════════
  if (questionnaireData && questionnaireData.hasData) {
    var noItems = [];
    var answers = questionnaireData.answers || [];
    for (var qi = 0; qi < answers.length; qi++) {
      if (answers[qi].answer !== 'Yes') {
        var qcfg = _QUEST_CONFIG[answers[qi].shortLabel] || _QUEST_CONFIG[answers[qi].question];
        if (qcfg) noItems.push(qcfg);
      }
    }
    if (noItems.length > 0) {
      var qScore = questionnaireData.yesCount || 0;
      var qTotal = questionnaireData.totalQuestions || 7;
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
      h += _secH('Critical Alerts', '#dc2626', '<span style="background:rgba(220,38,38,0.08);color:#dc2626;font-size:12px;font-weight:700;padding:3px 10px;border-radius:5px">Score: ' + qScore + '/' + qTotal + '</span>');
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
      for (var ni = 0; ni < noItems.length; ni++) {
        var nit = noItems[ni];
        var isLast = ni === noItems.length - 1;
        h += '<tr><td style="padding:10px 12px;' + (isLast ? '' : 'border-bottom:1px solid #f1f5f9;') + '">';
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
        h += '<td style="width:28px;vertical-align:top"><div style="width:22px;height:22px;background:' + _hexBg(nit.col, 0.1) + ';border-radius:50%;text-align:center;line-height:22px;font-size:12px">&#9888;</div></td>';
        h += '<td style="vertical-align:top;padding-left:8px">';
        h += '<div style="font-size:13px;font-weight:700;color:' + nit.col + ';margin-bottom:2px">' + _escHtml(nit.title) + '</div>';
        h += '<div style="font-size:12px;color:#64748b;line-height:1.4">' + _escHtml(nit.desc) + '</div>';
        h += '</td>';
        h += '<td style="width:70px;vertical-align:middle;text-align:right"><span style="background:' + _hexBg(nit.col, 0.08) + ';color:' + nit.col + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">' + nit.sev + '</span></td>';
        h += '</tr></tbody></table></td></tr>';
      }
      h += '</tbody></table></td></tr></tbody></table>';
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. NET WORTH
  // ══════════════════════════════════════════════════════════════════
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td>';
  // Header bar
  h += '<div style="padding:14px 24px;border-bottom:1px solid rgba(0,0,0,0.05);background:rgba(128,128,128,0.04);border-radius:12px 12px 0 0">';
  h += '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="width:3px"><div style="width:3px;height:14px;background:#94a3b8;border-radius:2px"></div></td>';
  h += '<td style="padding-left:10px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px">Net Worth</td>';
  h += '</tr></tbody></table></div>';
  // Content
  h += '<div style="padding:28px 24px 24px">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px"><tbody><tr>';
  h += '<td style="vertical-align:bottom"><div style="font-size:34px;font-weight:700;color:#1e293b;line-height:1.1;margin-bottom:6px">' + _fmtCur(netWorth) + '</div>';
  h += '<div style="font-size:14px"><span style="color:' + plCol + ';font-weight:600">' + plS + _fmtCur(Math.abs(totalPL)) + '</span> <span style="color:#64748b;margin-left:4px">(' + plS + plPct.toFixed(1) + '% returns)</span></div></td>';
  h += '<td style="vertical-align:top;text-align:right">';
  h += '<div style="font-size:13px;color:#64748b">Total Assets</div><div style="font-size:18px;font-weight:600;color:#475569;margin-bottom:8px">' + _fmtCur(totalAssets) + '</div>';
  h += '<div style="font-size:13px;color:#64748b">Liabilities</div><div style="font-size:18px;font-weight:600;color:#dc2626">' + _fmtCur(totalLiabilities) + '</div>';
  h += '</td></tr></tbody></table>';
  // Asset class bar
  if (assetClassList.length > 0) {
    h += '<div style="margin-bottom:10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:5px;overflow:hidden"><tbody><tr style="height:10px">';
    for (var bi = 0; bi < assetClassList.length; bi++) {
      var bc = assetClassList[bi];
      if ((bc.pct || 0) <= 0) continue;
      var bColor = bc.color || bc.fill || (_ASSET_COLORS[bc.name] || '#94a3b8');
      var bRad = '';
      if (bi === 0) bRad = 'border-radius:5px 0 0 5px;';
      if (bi === assetClassList.length - 1) bRad += 'border-radius:0 5px 5px 0;';
      if (assetClassList.length === 1) bRad = 'border-radius:5px;';
      if (bi > 0) h += '<td style="width:2px"></td>';
      h += '<td style="width:' + bc.pct.toFixed(1) + '%;background:' + bColor + ';' + bRad + '"></td>';
    }
    h += '</tr></tbody></table></div>';
    // Legend
    h += '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    for (var bli = 0; bli < assetClassList.length; bli++) {
      var blc = assetClassList[bli];
      if ((blc.pct || 0) <= 0) continue;
      var blColor = blc.color || blc.fill || (_ASSET_COLORS[blc.name] || '#94a3b8');
      h += '<td style="padding-right:16px;font-size:13px;color:#475569;font-weight:500">';
      h += '<span style="display:inline-block;width:8px;height:8px;background:' + blColor + ';border-radius:50%;vertical-align:middle;margin-right:4px"></span>';
      h += _escHtml(blc.name) + ' ' + Math.round(blc.pct) + '%</td>';
    }
    h += '</tr></tbody></table>';
  }
  h += '</div></td></tr></tbody></table>';

  // ══════════════════════════════════════════════════════════════════
  // 3. ASSET ALLOCATION (with SVG donut)
  // ══════════════════════════════════════════════════════════════════
  var allocItems = allocByType.length > 0 ? allocByType : assetClassList;
  if (allocItems.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td>';
    // Header bar
    h += '<div style="padding:14px 24px;border-bottom:1px solid rgba(0,0,0,0.05);background:rgba(128,128,128,0.04);border-radius:12px 12px 0 0">';
    h += '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:3px"><div style="width:3px;height:14px;background:#94a3b8;border-radius:2px"></div></td>';
    h += '<td style="padding-left:10px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px">Asset Allocation</td>';
    h += '</tr></tbody></table></div>';
    // Content
    h += '<div style="padding:24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    // LEFT: QuickChart.io donut (PNG image, renders in Gmail) + Assets/Liabilities
    h += '<td style="width:40%;vertical-align:top;padding-right:24px">';
    // Build QuickChart.io donut URL — PNG renders in Gmail unlike SVG
    var _qcData = [], _qcColors = [];
    for (var _qi = 0; _qi < allocItems.length; _qi++) {
      var _qit = allocItems[_qi];
      if ((_qit.pct || 0) <= 0) continue;
      _qcData.push(+(_qit.pct).toFixed(1));
      _qcColors.push(_qit.color || _qit.fill || (_ASSET_COLORS[_qit.name] || '#94a3b8'));
    }
    var _qcConfig = {
      type: 'doughnut',
      data: { datasets: [{ data: _qcData, backgroundColor: _qcColors, borderWidth: 3, borderColor: '#ffffff' }] },
      options: {
        plugins: {
          doughnutlabel: { labels: [
            { text: 'NET WORTH', font: { size: 10, weight: 'bold' }, color: '#475569' },
            { text: _fmtCur(netWorth), font: { size: 16, weight: 'bold' }, color: '#1e293b' }
          ]},
          legend: { display: false }
        },
        cutout: '70%'
      }
    };
    var _qcUrl = 'https://quickchart.io/chart?v=2&w=220&h=220&bkg=white&c=' + encodeURIComponent(JSON.stringify(_qcConfig));
    h += '<div style="text-align:center;padding:0 0 16px">';
    h += '<img src="' + _qcUrl + '" width="220" height="220" alt="Asset Allocation" style="display:block;margin:0 auto">';
    h += '</div>';
    // Assets + Liabilities cards
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:48%;background:rgba(139,92,246,0.08);border-radius:8px;padding:12px;text-align:center">';
    h += '<div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Assets</div>';
    h += '<div style="font-size:14px;font-weight:700;color:#1e293b">' + _fmtCur(totalAssets) + '</div>';
    h += '<div style="font-size:13px;color:' + plCol + ';margin-top:3px">' + plS + _fmtCur(Math.abs(totalPL)) + ' P&amp;L</div></td>';
    h += '<td style="width:4%"></td>';
    h += '<td style="width:48%;background:rgba(244,63,94,0.08);border-radius:8px;padding:12px;text-align:center">';
    h += '<div style="font-size:13px;color:#e11d48;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Liabilities</div>';
    h += '<div style="font-size:14px;font-weight:700;color:#e11d48">' + _fmtCur(totalLiabilities) + '</div>';
    var loanCount = activeLiabilities.length;
    h += '<div style="font-size:13px;color:#64748b;margin-top:3px">' + loanCount + ' Loan' + (loanCount !== 1 ? 's' : '') + '</div></td>';
    h += '</tr></tbody></table></td>';

    // RIGHT: Breakdown rows
    h += '<td style="width:60%;vertical-align:top">';
    for (var ati = 0; ati < allocItems.length; ati++) {
      var at = allocItems[ati];
      if ((at.pct || 0) <= 0) continue;
      var atColor = at.color || at.fill || (_ASSET_COLORS[at.name] || '#94a3b8');
      h += '<div style="background:rgba(0,0,0,0.03);border-radius:8px;padding:10px 14px;margin-bottom:6px">';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
      h += '<td style="vertical-align:middle;width:12px"><div style="width:8px;height:8px;background:' + atColor + ';border-radius:50%"></div></td>';
      h += '<td style="padding-left:8px;font-size:13px;color:#475569;font-weight:500">' + _escHtml(at.name) + '</td>';
      h += '<td align="right" style="font-size:13px;color:#475569;font-weight:600;padding-right:10px">' + _fmtCur(at.value) + '</td>';
      h += '<td align="right" style="width:50px"><div style="background:rgba(0,0,0,0.05);color:' + atColor + ';font-size:10px;font-weight:600;padding:2px 8px;border-radius:5px;text-align:center">' + Math.round(at.pct) + '%</div></td>';
      h += '</tr></tbody></table></div>';
    }
    // Loans row
    if (totalLiabilities > 0) {
      h += '<div style="background:rgba(248,113,113,0.06);border-radius:8px;padding:10px 14px;margin-top:4px">';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
      h += '<td style="vertical-align:middle;width:12px"><div style="width:8px;height:8px;background:#dc2626;border-radius:50%"></div></td>';
      h += '<td style="padding-left:8px;font-size:13px;color:#dc2626;font-weight:500">' + loanCount + ' Loan' + (loanCount !== 1 ? 's' : '') + '</td>';
      h += '<td align="right" style="font-size:13px;color:#dc2626;font-weight:600">&minus;' + _fmtCur(totalLiabilities) + '</td>';
      h += '</tr></tbody></table></div>';
    }
    h += '</td></tr></tbody></table></div></td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 3B. FAMILY BREAKDOWN
  // ══════════════════════════════════════════════════════════════════
  if (memberTotals.length > 1) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
    h += _secH('Family Breakdown', '#db2777');
    // Colored bar
    h += '<div style="margin-bottom:12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:5px;overflow:hidden"><tbody><tr style="height:10px">';
    for (var fbi = 0; fbi < memberTotals.length; fbi++) {
      var fbPct = totalFamilyNW > 0 ? (memberTotals[fbi].netWorth / totalFamilyNW * 100) : (100 / memberTotals.length);
      var fbColor = _MEMBER_COLORS[fbi % _MEMBER_COLORS.length];
      var fbRad = '';
      if (fbi === 0) fbRad = 'border-radius:5px 0 0 5px;';
      if (fbi === memberTotals.length - 1) fbRad += 'border-radius:0 5px 5px 0;';
      if (fbi > 0) h += '<td style="width:2px"></td>';
      h += '<td style="width:' + Math.max(1, fbPct).toFixed(0) + '%;background:' + fbColor + ';' + fbRad + '"></td>';
    }
    h += '</tr></tbody></table></div>';
    // Member rows
    for (var fri = 0; fri < memberTotals.length; fri++) {
      var frm = memberTotals[fri];
      var frColor = _MEMBER_COLORS[fri % _MEMBER_COLORS.length];
      var frPct = totalFamilyNW > 0 ? (frm.netWorth / totalFamilyNW * 100) : 0;
      h += '<div style="background:rgba(0,0,0,0.03);border-radius:8px;padding:12px 14px;margin-bottom:6px">';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
      h += '<td style="vertical-align:middle;width:12px"><div style="width:8px;height:8px;background:' + frColor + ';border-radius:50%"></div></td>';
      h += '<td style="padding-left:8px;font-size:13px;color:#1e293b;font-weight:600">' + _escHtml(frm.name) + '</td>';
      h += '<td align="right" style="font-size:13px;color:#1e293b;font-weight:700;padding-right:10px">' + _fmtCur(frm.netWorth) + '</td>';
      h += '<td align="right" style="width:50px"><div style="background:rgba(0,0,0,0.05);color:' + frColor + ';font-size:10px;font-weight:600;padding:2px 8px;border-radius:5px;text-align:center">' + Math.round(frPct) + '%</div></td>';
      h += '</tr></tbody></table></div>';
    }
    h += '</td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. BUY OPPORTUNITIES
  // ══════════════════════════════════════════════════════════════════
  if (buyOpportunities.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
    h += _secH('Buy Opportunities (Below ATH)', '#d97706');
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px"><tbody>';
    h += '<tr style="background:#f8fafc"><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:left">Fund Name</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:left">Portfolio</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Below ATH</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Signal</th></tr>';
    for (var boi = 0; boi < buyOpportunities.length; boi++) {
      var bo = buyOpportunities[boi];
      var boColor = bo.isStrongBuy ? '#ea580c' : '#b45309';
      var boLabel = bo.isStrongBuy ? 'STRONG BUY' : 'BUY';
      h += '<tr' + (boi < buyOpportunities.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b">' + _escHtml(bo.fundName) + '</td>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#475569">' + _escHtml(bo.portfolioName) + '</td>';
      h += '<td style="padding:8px 10px;font-size:13px;font-weight:700;color:' + boColor + ';text-align:right">-' + bo.belowATHPct.toFixed(1) + '%</td>';
      h += '<td style="padding:8px 10px;text-align:right"><span style="background:' + _hexBg(boColor, 0.08) + ';color:' + boColor + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">' + boLabel + '</span></td></tr>';
    }
    h += '</tbody></table></td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. REBALANCE REQUIRED
  // ══════════════════════════════════════════════════════════════════
  if (rebalanceItems.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
    h += _secH('Rebalance Required', '#2563eb');
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px"><tbody>';
    h += '<tr style="background:#f8fafc"><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:left">Fund Name</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:left">Portfolio</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Current%</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Target%</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Drift</th><th style="padding:8px 10px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;text-align:right">Action</th></tr>';
    for (var rbi = 0; rbi < rebalanceItems.length; rbi++) {
      var rb = rebalanceItems[rbi];
      var rbBlocked = rb.lumpsumRestricted && rb.sipRestricted;
      var rbAction = rb.drift > 0 ? 'SELL' : (rbBlocked ? 'BLOCKED' : rb.lumpsumRestricted ? 'SIP ONLY' : rb.sipRestricted ? 'LUMPSUM ONLY' : 'BUY');
      var rbColor = rb.drift > 0 ? '#dc2626' : (rbBlocked ? '#dc2626' : (rb.lumpsumRestricted || rb.sipRestricted) ? '#d97706' : '#059669');
      h += '<tr' + (rbi < rebalanceItems.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b">' + _escHtml(rb.fundName) + '</td>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#475569">' + _escHtml(rb.portfolioName) + '</td>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#475569;text-align:right">' + rb.currentPct + '%</td>';
      h += '<td style="padding:8px 10px;font-size:13px;color:#475569;text-align:right">' + rb.targetPct + '%</td>';
      h += '<td style="padding:8px 10px;font-size:13px;font-weight:600;color:' + rbColor + ';text-align:right">' + (rb.drift > 0 ? '+' : '') + rb.drift + '%</td>';
      h += '<td style="padding:8px 10px;text-align:right"><span style="background:' + _hexBg(rbColor, 0.08) + ';color:' + rbColor + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">' + rbAction + '</span></td></tr>';
    }
    h += '</tbody></table></td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 7. PER-MEMBER CARDS
  // ══════════════════════════════════════════════════════════════════
  for (var mci = 0; mci < familyMembers.length; mci++) {
    var mem = familyMembers[mci];
    var md2 = memberMap[mem.memberId] || { mfPortfolios: [], stockPortfolios: [], otherInvestments: [], liabilities: [], insurance: [], bankAccts: [] };
    var mColor = _MEMBER_COLORS[mci % _MEMBER_COLORS.length];
    var mt = memberTotals[mci] || { assets: 0, liabilities: 0, netWorth: 0 };

    // Member totals
    var mMFInv = 0, mMFCur = 0, mStkInv = 0, mStkCur = 0, mOthCur = 0, mLiab = mt.liabilities;
    for (var mpi = 0; mpi < md2.mfPortfolios.length; mpi++) { mMFInv += parseFloat(md2.mfPortfolios[mpi].totalInvestment) || 0; mMFCur += parseFloat(md2.mfPortfolios[mpi].currentValue) || 0; }
    for (var msi = 0; msi < md2.stockPortfolios.length; msi++) { mStkInv += parseFloat(md2.stockPortfolios[msi].totalInvestment) || 0; mStkCur += parseFloat(md2.stockPortfolios[msi].currentValue) || 0; }
    for (var moi = 0; moi < md2.otherInvestments.length; moi++) { mOthCur += parseFloat(md2.otherInvestments[moi].currentValue) || 0; }
    var mTotalAssets = mt.assets;
    var mNetWorth = mt.netWorth;
    var mPortCount = md2.mfPortfolios.length + md2.stockPortfolios.length;
    var mTermCover = 0;
    for (var mii = 0; mii < md2.insurance.length; mii++) { if (md2.insurance[mii].policyType === 'Term Life') mTermCover += parseFloat(md2.insurance[mii].sumAssured) || 0; }

    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';

    // Member name header
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0"><tbody><tr>';
    h += '<td style="font-size:20px;font-weight:700;color:' + mColor + '">' + _escHtml(mem.memberName) + '</td>';
    h += '<td align="right" style="font-size:14px;font-weight:500;color:#64748b;vertical-align:bottom">Financial Summary</td>';
    h += '</tr></tbody></table>';

    // Financial Summary + Personal Details box
    h += '<div style="margin-bottom:20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc"><tbody><tr><td style="padding:16px">';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    // LEFT: Financial Summary
    h += '<td style="width:50%;vertical-align:top;padding-right:16px">';
    h += '<div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Financial Summary</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:50%;vertical-align:middle;padding-right:10px">';
    h += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:3px">Total Assets</div><div style="font-size:16px;font-weight:700;color:#059669">' + _fmtCur(mTotalAssets) + '</div></div>';
    h += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:3px">Liabilities</div><div style="font-size:16px;font-weight:700;color:#dc2626">' + _fmtCur(mLiab) + '</div></div>';
    h += '<div><div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:3px">Term Cover</div><div style="font-size:16px;font-weight:700;color:#7c3aed">' + (mTermCover > 0 ? _fmtCur(mTermCover) : '<span style="color:#64748b;font-style:italic">None</span>') + '</div></div>';
    h += '</td>';
    h += '<td style="width:50%;vertical-align:middle;padding-left:10px;border-left:2px solid #2563eb;text-align:center">';
    h += '<div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:6px">Net Worth</div>';
    h += '<div style="font-size:22px;font-weight:800;color:#2563eb">' + _fmtCur(mNetWorth) + '</div>';
    h += '<div style="font-size:13px;color:#64748b;margin-top:6px">' + mPortCount + ' Portfolio' + (mPortCount !== 1 ? 's' : '') + '</div>';
    h += '</td></tr></tbody></table></td>';
    // RIGHT: Personal Details
    h += '<td style="width:50%;vertical-align:top;padding-left:16px;border-left:1px solid #e2e8f0">';
    h += '<div style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:12px">Personal Details</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:50%;vertical-align:top;padding-right:8px">';
    h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px">Email</div><div style="font-size:13px;color:#1e293b;font-weight:600;word-break:break-all">' + _escHtml(mem.email || '-') + '</div></div>';
    h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px"><div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px">PAN</div><div style="font-size:13px;color:#1e293b;font-weight:600;font-family:monospace">' + _escHtml(mem.pan || '-') + '</div></div>';
    h += '</td><td style="width:50%;vertical-align:top;padding-left:8px">';
    h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px">Mobile</div><div style="font-size:13px;color:#1e293b;font-weight:600;font-family:monospace">' + _escHtml(mem.mobile || '-') + '</div></div>';
    h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:10px"><div style="font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:4px">Aadhar</div><div style="font-size:13px;color:#1e293b;font-weight:600;font-family:monospace">' + _maskAadhar(mem.aadhar) + '</div></div>';
    h += '</td></tr></tbody></table></td>';
    h += '</tr></tbody></table></td></tr></tbody></table></div>';

    // ── Mutual Funds ──
    if (md2.mfPortfolios.length > 0) {
      h += '<div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:2px">&#9679; Mutual Funds</div>';
      for (var mpi2 = 0; mpi2 < md2.mfPortfolios.length; mpi2++) {
        var mp2 = md2.mfPortfolios[mpi2];
        var mpF = mp2.funds || [];
        var mpia = mp2.investmentAccountId ? iaLookup[mp2.investmentAccountId] : null;
        var mpcid = mpia ? (mpia.clientId || '') : '';
        var psI = parseFloat(mp2.totalInvestment) || 0, psC = parseFloat(mp2.currentValue) || 0;
        var psUPL = parseFloat(mp2.unrealizedPL) || 0;
        var psRPL = parseFloat(mp2.realizedPL) || 0;
        var psTPL = parseFloat(mp2.totalPL) || 0;
        var psTPP = parseFloat(mp2.totalPLPct) || (psI > 0 ? (psTPL / psI * 100) : 0);

        // ── Redesigned MF portfolio card ──
        h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid #7c3aed;border-radius:10px;margin-bottom:16px;overflow:hidden">';
        // Header: name + platform left | current value + returns badge right
        h += '<div style="padding:14px 16px;border-bottom:1px solid #f1f5f9">';
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
        h += '<td style="vertical-align:middle">';
        h += '<div style="font-size:16px;font-weight:700;color:#7c3aed">' + _escHtml(mp2.portfolioName) + '</div>';
        var iaD = [];
        if (mp2.platformBroker) iaD.push(_escHtml(mp2.platformBroker));
        if (mpcid) iaD.push('<span style="font-family:monospace;font-size:12px">' + _escHtml(mpcid) + '</span>');
        if (mpia && mpia.accountType) iaD.push(_escHtml(mpia.accountType));
        if (iaD.length > 0) h += '<div style="font-size:13px;color:#94a3b8;margin-top:3px">' + iaD.join(' &middot; ') + '</div>';
        h += '</td>';
        var _mfRtColor = _plColor(psTPP), _mfRtSign = psTPP >= 0 ? '+' : '';
        h += '<td align="right" style="vertical-align:middle;padding-left:12px">';
        h += '<div style="font-size:20px;font-weight:700;color:#1e293b;line-height:1">' + _fmtCur(psC) + '</div>';
        h += '<div style="margin-top:4px"><span style="display:inline-block;background:' + _hexBg(_mfRtColor, 0.1) + ';color:' + _mfRtColor + ';font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">' + _mfRtSign + psTPP.toFixed(1) + '% returns</span></div>';
        h += '</td>';
        h += '</tr></tbody></table></div>';
        // Stats strip: Invested | Unr.P&L | Real.P&L | Total P&L
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-bottom:1px solid #f1f5f9"><tbody><tr>';
        var _mfStats = [
          { l: 'Invested', v: _fmtCurShort(psI), c: '#64748b' },
          { l: 'Unr. P&amp;L', v: _plSign(psUPL) + _fmtCurShort(Math.abs(psUPL)), c: _plColor(psUPL) },
          { l: 'Real. P&amp;L', v: _plSign(psRPL) + _fmtCurShort(Math.abs(psRPL)), c: _plColor(psRPL) },
          { l: 'Total P&amp;L', v: _plSign(psTPL) + _fmtCurShort(Math.abs(psTPL)), c: _plColor(psTPL) }
        ];
        for (var _msi = 0; _msi < _mfStats.length; _msi++) {
          if (_msi > 0) h += '<td style="width:1px;background:#f1f5f9"></td>';
          h += '<td style="padding:10px 14px;text-align:center;background:#fafafa">';
          h += '<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">' + _mfStats[_msi].l + '</div>';
          h += '<div style="font-size:14px;font-weight:700;color:' + _mfStats[_msi].c + '">' + _mfStats[_msi].v + '</div>';
          h += '</td>';
        }
        h += '</tr></tbody></table>';
        // Fund holdings table
        if (mpF.length > 0) {
          var _mfThS = 'padding:8px 10px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;background:#fafafa';
          h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
          h += '<tr>';
          h += '<th style="' + _mfThS + ';text-align:left">Fund</th>';
          h += '<th style="' + _mfThS + ';text-align:right">Units</th>';
          h += '<th style="' + _mfThS + ';text-align:right">NAV (Cur/Avg)</th>';
          h += '<th style="' + _mfThS + ';text-align:right">ATH / Below Peak</th>';
          h += '<th style="' + _mfThS + ';text-align:right">Alloc (Cur/Tgt)</th>';
          h += '<th style="' + _mfThS + ';text-align:right">Amount (Cur/Inv)</th>';
          h += '<th style="' + _mfThS + ';text-align:right">P&amp;L</th>';
          h += '</tr>';
          for (var fi = 0; fi < mpF.length; fi++) {
            var f = mpF[fi], fI = parseFloat(f.investment) || 0, fC = parseFloat(f.currentValue) || 0;
            var fPL = fC - fI, fPP = fI > 0 ? (fPL / fI * 100) : 0;
            var fU = parseFloat(f.units) || 0;
            var fCurNav = parseFloat(f.currentNav) || (fU > 0 ? fC / fU : 0);
            var fAvgNav = parseFloat(f.avgNav) || (fU > 0 ? fI / fU : 0);
            var fCurAlloc = parseFloat(f.currentAllocationPct) || 0;
            var fTgtAlloc = parseFloat(f.targetAllocationPct) || 0;
            var fATH = parseFloat(f.athNav) || 0;
            var fBelowATH = parseFloat(f.belowATHPct) || 0;
            var fATHColor = fBelowATH >= 20 ? '#b91c1c' : fBelowATH >= 10 ? '#c2410c' : fBelowATH >= 5 ? '#b45309' : fBelowATH >= 1 ? '#a16207' : '#94a3b8';
            var fATHW = fBelowATH >= 5 ? '700' : '600';
            var fPLColor = _plColor(fPL);
            h += '<tr style="border-bottom:1px solid #f8fafc;' + (fi % 2 === 1 ? 'background:#fafafa' : '') + '">';
            h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b;font-weight:500">' + _escHtml(f.fundName);
            if (f.planName) h += '<div style="font-size:12px;color:#94a3b8;font-weight:400;margin-top:2px">' + _escHtml(f.planName) + '</div>';
            h += '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;color:#64748b;text-align:right">' + fU.toFixed(2) + '</td>';
            h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:600;color:#1e293b">\u20B9' + fCurNav.toFixed(2) + '</div><div style="font-size:12px;color:#94a3b8">\u20B9' + fAvgNav.toFixed(2) + '</div></td>';
            h += '<td style="padding:8px 10px;text-align:right">';
            if (fATH > 0) {
              h += '<div style="font-size:13px;font-weight:600;color:#1e293b">\u20B9' + fATH.toFixed(2) + '</div>';
              if (fBelowATH > 0) h += '<div style="font-size:12px;font-weight:' + fATHW + ';color:' + fATHColor + '">\u2193' + fBelowATH.toFixed(1) + '%</div>';
            } else { h += '<span style="font-size:12px;color:#e2e8f0">\u2014</span>'; }
            h += '</td>';
            h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:600;color:#1e293b">' + fCurAlloc.toFixed(1) + '%</div><div style="font-size:12px;color:#94a3b8">' + fTgtAlloc.toFixed(1) + '%</div></td>';
            h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:600;color:#1e293b">' + _fmtCur(fC) + '</div><div style="font-size:12px;color:#94a3b8">' + _fmtCur(fI) + '</div></td>';
            h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:' + fPLColor + '">' + _plSign(fPL) + _fmtCur(Math.abs(fPL)) + '</div><div style="font-size:12px;font-weight:600;color:' + fPLColor + '">' + _plSign(fPP) + fPP.toFixed(1) + '%</div></td>';
            h += '</tr>';
          }
          h += '</tbody></table>';
        }
        h += '</div>'; // close MF portfolio card
      }
    }

    // ── Stocks ──
    if (md2.stockPortfolios.length > 0) {
      h += '<div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:2px">&#9679; Stocks</div>';
      for (var msi2 = 0; msi2 < md2.stockPortfolios.length; msi2++) {
        var msp = md2.stockPortfolios[msi2];
        var msH = msp.holdings || [];
        var msia = msp.investmentAccountId ? iaLookup[msp.investmentAccountId] : null;
        var mscid = msia ? (msia.clientId || '') : '';
        var ssI = parseFloat(msp.totalInvestment) || 0, ssC = parseFloat(msp.currentValue) || 0;
        var ssPL = ssC - ssI, ssPP = ssI > 0 ? (ssPL / ssI * 100) : 0;

        // ── Redesigned stock portfolio card ──
        h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid #2563eb;border-radius:10px;margin-bottom:16px;overflow:hidden">';
        // Header: name + platform left | current value + returns badge right
        h += '<div style="padding:14px 16px;border-bottom:1px solid #f1f5f9">';
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
        h += '<td style="vertical-align:middle">';
        h += '<div style="font-size:16px;font-weight:700;color:#2563eb">' + _escHtml(msp.portfolioName || msp.platformBroker) + '</div>';
        var stkD = [];
        if (msp.platformBroker) stkD.push(_escHtml(msp.platformBroker));
        if (mscid) stkD.push('<span style="font-family:monospace;font-size:12px">' + _escHtml(mscid) + '</span>');
        if (msia && msia.accountType) stkD.push(_escHtml(msia.accountType));
        if (stkD.length > 0) h += '<div style="font-size:13px;color:#94a3b8;margin-top:3px">' + stkD.join(' &middot; ') + '</div>';
        h += '</td>';
        var _sRtColor = _plColor(ssPP), _sRtSign = ssPP >= 0 ? '+' : '';
        h += '<td align="right" style="vertical-align:middle;padding-left:12px">';
        h += '<div style="font-size:20px;font-weight:700;color:#1e293b;line-height:1">' + _fmtCur(ssC) + '</div>';
        h += '<div style="margin-top:4px"><span style="display:inline-block;background:' + _hexBg(_sRtColor, 0.1) + ';color:' + _sRtColor + ';font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px">' + _sRtSign + ssPP.toFixed(1) + '% returns</span></div>';
        h += '</td>';
        h += '</tr></tbody></table></div>';
        // Stats strip: Invested | P&L
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-bottom:1px solid #f1f5f9"><tbody><tr>';
        var _stkStats2 = [
          { l: 'Invested', v: _fmtCurShort(ssI), c: '#64748b' },
          { l: 'P&amp;L', v: _plSign(ssPL) + _fmtCurShort(Math.abs(ssPL)), c: _plColor(ssPL) }
        ];
        for (var _ssi = 0; _ssi < _stkStats2.length; _ssi++) {
          if (_ssi > 0) h += '<td style="width:1px;background:#f1f5f9"></td>';
          h += '<td style="padding:10px 14px;text-align:center;background:#fafafa">';
          h += '<div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">' + _stkStats2[_ssi].l + '</div>';
          h += '<div style="font-size:14px;font-weight:700;color:' + _stkStats2[_ssi].c + '">' + _stkStats2[_ssi].v + '</div>';
          h += '</td>';
        }
        h += '</tr></tbody></table>';
        // Stock holdings table
        if (msH.length > 0) {
          var _sthS = 'padding:8px 10px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;background:#fafafa';
          h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
          h += '<tr>';
          h += '<th style="' + _sthS + ';text-align:left">Stock</th>';
          h += '<th style="' + _sthS + ';text-align:left">Symbol</th>';
          h += '<th style="' + _sthS + ';text-align:right">Qty</th>';
          h += '<th style="' + _sthS + ';text-align:right">Avg Price</th>';
          h += '<th style="' + _sthS + ';text-align:right">LTP</th>';
          h += '<th style="' + _sthS + ';text-align:right">Current Value</th>';
          h += '<th style="' + _sthS + ';text-align:right">P&amp;L</th>';
          h += '</tr>';
          for (var shi = 0; shi < msH.length; shi++) {
            var sk = msH[shi], skI = parseFloat(sk.totalInvestment) || 0, skC = parseFloat(sk.currentValue) || 0;
            var skPL = parseFloat(sk.unrealizedPL) || (skC - skI), skPP = parseFloat(sk.unrealizedPLPct) || (skI > 0 ? (skPL / skI * 100) : 0);
            var skPLColor = _plColor(skPL);
            h += '<tr style="border-bottom:1px solid #f8fafc;' + (shi % 2 === 1 ? 'background:#fafafa' : '') + '">';
            h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b;font-weight:500">' + _escHtml(sk.companyName) + '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;font-family:monospace;font-weight:600;color:#475569">' + _escHtml(sk.symbol) + '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;color:#64748b;text-align:right">' + (parseFloat(sk.quantity) || 0) + '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;color:#64748b;text-align:right">\u20B9' + (parseFloat(sk.avgBuyPrice) || 0).toLocaleString('en-IN') + '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;font-weight:600;color:#1e293b;text-align:right">\u20B9' + (parseFloat(sk.currentPrice) || 0).toLocaleString('en-IN') + '</td>';
            h += '<td style="padding:8px 10px;font-size:13px;font-weight:600;color:#1e293b;text-align:right">' + _fmtCur(skC) + '</td>';
            h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:' + skPLColor + '">' + _plSign(skPL) + _fmtCur(Math.abs(skPL)) + '</div><div style="font-size:12px;font-weight:600;color:' + skPLColor + '">' + _plSign(skPP) + skPP.toFixed(1) + '%</div></td>';
            h += '</tr>';
          }
          h += '</tbody></table>';
        }
        h += '</div>'; // close stock portfolio card
      }
    }

    // ── Other Investments ──
    if (md2.otherInvestments.length > 0) {
      h += '<div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:2px">&#9679; Other Investments</div>';
      h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid #d97706;border-radius:10px;margin-bottom:16px;overflow:hidden">';
      var _oiThS = 'padding:8px 10px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;background:#fafafa';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
      h += '<tr><th style="' + _oiThS + ';text-align:left">Type</th><th style="' + _oiThS + ';text-align:left">Name</th><th style="' + _oiThS + ';text-align:left">Category</th><th style="' + _oiThS + ';text-align:right">Current Value</th></tr>';
      var moiTotal = 0;
      for (var moi2 = 0; moi2 < md2.otherInvestments.length; moi2++) {
        var moiv = md2.otherInvestments[moi2];
        var moiC2 = parseFloat(moiv.currentValue) || 0;
        moiTotal += moiC2;
        var cat = moiv.assetClass || moiv.category || 'Other';
        var catColor = _ASSET_COLORS[cat] || '#94a3b8';
        h += '<tr style="border-bottom:1px solid #f8fafc;' + (moi2 % 2 === 1 ? 'background:#fafafa' : '') + '">';
        h += '<td style="padding:8px 10px;font-size:13px;color:#64748b">' + _escHtml(moiv.investmentType) + '</td>';
        h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b;font-weight:500">' + _escHtml(moiv.investmentName) + '</td>';
        h += '<td style="padding:8px 10px"><span style="background:' + _hexBg(catColor, 0.08) + ';color:' + catColor + ';font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px">' + _escHtml(cat) + '</span></td>';
        h += '<td style="padding:8px 10px;font-size:13px;font-weight:700;color:#1e293b;text-align:right">' + _fmtCur(moiC2) + '</td></tr>';
      }
      h += '<tr style="background:#fafafa;border-top:2px solid #f1f5f9"><td colspan="3" style="padding:8px 10px;font-size:13px;font-weight:600;color:#64748b">Total Other Investments</td>';
      h += '<td style="padding:8px 10px;font-size:14px;font-weight:700;color:#1e293b;text-align:right">' + _fmtCur(moiTotal) + '</td></tr>';
      h += '</tbody></table></div>';
    }

    // ── Liabilities (inside member card) ──
    if (md2.liabilities.length > 0) {
      h += '<div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-left:2px">&#9679; Liabilities</div>';
      h += '<div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid #dc2626;border-radius:10px;margin-bottom:16px;overflow:hidden">';
      var _lbThS = 'padding:8px 10px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;background:#fafafa';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
      h += '<tr><th style="' + _lbThS + ';text-align:left">Type</th><th style="' + _lbThS + ';text-align:left">Lender</th><th style="' + _lbThS + ';text-align:left">Loan A/C</th><th style="' + _lbThS + ';text-align:right">Outstanding</th><th style="' + _lbThS + ';text-align:right">EMI</th><th style="' + _lbThS + ';text-align:right">Interest</th></tr>';
      var mLiabTot = 0, mEmiTot = 0;
      for (var mli = 0; mli < md2.liabilities.length; mli++) {
        var mlb = md2.liabilities[mli];
        var mlBal = parseFloat(mlb.outstandingBalance) || 0;
        var mlEmi = parseFloat(mlb.emiAmount) || 0;
        mLiabTot += mlBal;
        mEmiTot += mlEmi;
        h += '<tr style="border-bottom:1px solid #f8fafc;' + (mli % 2 === 1 ? 'background:#fafafa' : '') + '">';
        h += '<td style="padding:8px 10px;font-size:13px;color:#64748b">' + _escHtml(mlb.liabilityType) + '</td>';
        h += '<td style="padding:8px 10px;font-size:13px;color:#1e293b;font-weight:600">' + _escHtml(mlb.lenderName) + '</td>';
        h += '<td style="padding:8px 10px;font-size:13px;font-family:monospace;color:#64748b">' + _escHtml(mlb.loanAccountNumber || '\u2014') + '</td>';
        h += '<td style="padding:8px 10px;font-size:13px;font-weight:700;color:#dc2626;text-align:right">' + _fmtCur(mlBal) + '</td>';
        h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:600;color:#1e293b">' + (mlEmi > 0 ? _fmtCur(mlEmi) : '\u2014') + '</div>' + (mlEmi > 0 ? '<div style="font-size:11px;color:#94a3b8">/month</div>' : '') + '</td>';
        h += '<td style="padding:8px 10px;font-size:13px;font-weight:600;color:#b45309;text-align:right">' + (mlb.interestRate ? mlb.interestRate + '%' : '\u2014') + '</td></tr>';
      }
      h += '<tr style="background:#fafafa;border-top:2px solid #f1f5f9">';
      h += '<td colspan="3" style="padding:8px 10px;font-size:13px;font-weight:600;color:#64748b">Total Outstanding</td>';
      h += '<td style="padding:8px 10px;font-size:14px;font-weight:700;color:#dc2626;text-align:right">' + _fmtCur(mLiabTot) + '</td>';
      h += '<td style="padding:8px 10px;font-size:13px;font-weight:600;color:#1e293b;text-align:right">' + (mEmiTot > 0 ? _fmtCur(mEmiTot) : '\u2014') + '</td>';
      h += '<td style="padding:8px 10px;font-size:12px;color:#94a3b8;text-align:right">' + md2.liabilities.length + ' loan' + (md2.liabilities.length !== 1 ? 's' : '') + '</td></tr>';
      h += '</tbody></table></div>';
    }

    h += '</td></tr></tbody></table>'; // close member card
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. GOALS (with allocation health + suggestions)
  // ══════════════════════════════════════════════════════════════════
  var goalHealth = data.goalHealth || {};
  if (activeGoals.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
    h += _secH('Financial Goals', '#7c3aed');

    for (var gi = 0; gi < activeGoals.length; gi++) {
      var g = activeGoals[gi];
      var gTarget = parseFloat(g.targetAmount) || 0;
      var gCurrent = parseFloat(g.currentValue) || 0;
      var gProgress = parseFloat(g.progressPercent) || (gTarget > 0 ? Math.min(100, (gCurrent / gTarget) * 100) : 0);
      var gColor = gProgress >= 100 ? '#059669' : gProgress >= 75 ? '#059669' : gProgress >= 40 ? '#d97706' : '#ea580c';
      var gLabel = gProgress >= 100 ? 'ACHIEVED' : gProgress >= 75 ? 'ALMOST' : gProgress >= 40 ? 'ON TRACK' : 'BEHIND';
      var gh = goalHealth[g.goalId];
      var labelColor = gh ? (gh.label === 'Short-term' ? '#3b82f6' : gh.label === 'Medium-term' ? '#d97706' : gh.label === 'Long-term' ? '#059669' : '#64748b') : '#64748b';
      var gap = Math.max(0, gTarget - gCurrent);

      h += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;' + (gi < activeGoals.length - 1 ? 'margin-bottom:12px' : '') + '">';

      // Row 1: Name + Status badge
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      h += '<div>';
      h += '<span style="font-size:14px;font-weight:700;color:#1e293b">' + _escHtml(g.goalName) + '</span>';
      if (gh) h += ' <span style="font-size:10px;font-weight:700;color:' + labelColor + ';background:' + _hexBg(labelColor, 0.1) + ';padding:2px 6px;border-radius:10px;margin-left:4px">' + gh.label + '</span>';
      h += '</div>';
      h += '<span style="background:' + _hexBg(gColor, 0.08) + ';color:' + gColor + ';font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px">' + gProgress.toFixed(0) + '% &middot; ' + gLabel + '</span>';
      h += '</div>';

      // Row 2: Type + Target Date
      h += '<div style="font-size:12px;color:#64748b;margin-bottom:10px">' + _escHtml(g.goalType) + ' &middot; Target: ' + _fmtDate(g.targetDate);
      if (gh) h += ' &middot; ' + gh.yearsLeft.toFixed(1) + ' yrs left';
      h += '</div>';

      // Progress bar
      h += '<div style="background:#f1f5f9;border-radius:4px;height:6px;margin-bottom:10px;overflow:hidden"><div style="height:6px;border-radius:4px;background:' + gColor + ';width:' + Math.min(gProgress, 100).toFixed(0) + '%"></div></div>';

      // Stats row: Current | Target | Gap
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:8px"><tbody><tr>';
      h += '<td style="font-size:11px;color:#64748b">Current<br><span style="font-size:13px;font-weight:600;color:#1e293b">' + _fmtCur(gCurrent) + '</span></td>';
      h += '<td style="font-size:11px;color:#64748b;text-align:center">Target<br><span style="font-size:13px;font-weight:600;color:#1e293b">' + _fmtCur(gTarget) + '</span></td>';
      h += '<td style="font-size:11px;color:#64748b;text-align:right">Gap<br><span style="font-size:13px;font-weight:600;color:' + (gap > 0 ? '#d97706' : '#059669') + '">' + (gap > 0 ? _fmtCur(gap) : 'On track') + '</span></td>';
      h += '</tr></tbody></table>';

      // Allocation health (if available)
      if (gh) {
        h += '<div style="background:#f8fafc;border-radius:6px;padding:8px 10px;margin-bottom:6px">';
        h += '<div style="font-size:11px;color:#64748b;margin-bottom:4px">Recommended: <strong>' + gh.recommendedEquity + '% Equity</strong> &middot; <strong>' + gh.recommendedDebt + '% Debt</strong></div>';
        if (gh.isMapped && gh.actualEquity !== null) {
          // Allocation bar
          h += '<div style="display:flex;align-items:center;gap:6px">';
          var barBg = gh.needsAttention ? '#fef3c7' : '#f1f5f9';
          var eqColor = gh.needsAttention ? '#ef4444' : '#8b5cf6';
          var dtColor = gh.needsAttention ? '#d97706' : '#3b82f6';
          h += '<div style="flex:1;height:5px;border-radius:3px;overflow:hidden;display:flex;background:' + barBg + '">';
          h += '<div style="width:' + gh.actualEquity + '%;height:5px;background:' + eqColor + '"></div>';
          h += '<div style="width:' + (100 - gh.actualEquity) + '%;height:5px;background:' + dtColor + '"></div>';
          h += '</div>';
          h += '<span style="font-size:11px;font-weight:600;color:' + (gh.needsAttention ? '#d97706' : '#64748b') + '">' + gh.actualEquity + '% Equity</span>';
          h += '</div>';
          if (gh.needsAttention && gh.mismatch > 0) {
            h += '<div style="font-size:11px;color:#d97706;margin-top:4px">&#9888; ' + gh.mismatch + '% over recommended equity — consider shifting to debt</div>';
          }
          if (gh.needsAttention && gh.mismatch < 0) {
            h += '<div style="font-size:11px;color:#3b82f6;margin-top:4px">&#8505; ' + Math.abs(gh.mismatch) + '% under equity — room for more growth</div>';
          }
        }
        if (!gh.isMapped) {
          h += '<div style="font-size:11px;color:#94a3b8">No investments linked yet</div>';
        }
        h += '</div>';

        // SIP / Lumpsum suggestions
        if (gap > 0 && gh.liveSIP > 0) {
          h += '<div style="background:#f5f3ff;border-radius:6px;padding:8px 10px">';
          h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>';
          h += '<tr><td style="font-size:11px;color:#64748b">SIP Needed</td><td style="font-size:12px;font-weight:700;color:#7c3aed;text-align:right">' + _fmtCur(gh.liveSIP) + '/mo</td></tr>';
          h += '<tr><td style="font-size:11px;color:#64748b">Or Lumpsum Today</td><td style="font-size:12px;font-weight:700;color:#7c3aed;text-align:right">' + _fmtCur(gh.liveLumpsum) + '</td></tr>';
          h += '</tbody></table>';
          var cagr = parseFloat(g.expectedCAGR) || 0.12;
          h += '<div style="font-size:10px;color:#94a3b8;margin-top:2px">at ' + (cagr * 100).toFixed(0) + '% expected return</div>';
          h += '</div>';
        }
      }

      h += '</div>'; // close goal card
    }
    h += '</td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 8b. FUND PERFORMANCE (Top Gainers + Losers)
  // ══════════════════════════════════════════════════════════════════
  var topGainers = data.topGainers || [];
  var topLosers = data.topLosers || [];
  var topPortfolios = data.topPortfolios || [];
  var bottomPortfolios = data.bottomPortfolios || [];

  if (topGainers.length > 0 || topLosers.length > 0 || topPortfolios.length > 0 || bottomPortfolios.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';

    // Fund Performance
    if (topGainers.length > 0 || topLosers.length > 0) {
      h += _secH('Fund Performance', '#8b5cf6');
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px"><tbody>';

      if (topGainers.length > 0) {
        h += '<tr><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.5px;background:#f0fdf4;border-radius:8px 8px 0 0">&#x2197; Top Gainers</td></tr>';
        for (var tgi = 0; tgi < topGainers.length; tgi++) {
          var tg = topGainers[tgi];
          var tgName = _splitFundName ? _splitFundName(tg.fundName) : tg.fundName;
          h += '<tr' + (tgi < topGainers.length - 1 || topLosers.length > 0 ? ' style="' + _rowBd + '"' : '') + '>';
          h += '<td style="padding:8px 10px"><div style="font-size:13px;font-weight:600;color:#1e293b">' + _escHtml(tgName) + '</div>';
          if (tg.portfolios && tg.portfolios.length > 0) {
            h += '<div style="margin-top:2px">';
            for (var pi = 0; pi < tg.portfolios.length; pi++) {
              h += '<span style="font-size:10px;color:#64748b;background:#f1f5f9;padding:1px 5px;border-radius:3px;margin-right:3px">' + _escHtml(tg.portfolios[pi]) + '</span>';
            }
            h += '</div>';
          }
          h += '</td>';
          h += '<td style="padding:8px 10px;font-size:12px;color:#64748b;text-align:right">' + _fmtCur(tg.investment) + '</td>';
          h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:#059669">+' + tg.plPct.toFixed(1) + '%</div><div style="font-size:11px;color:#059669">+' + _fmtCur(tg.pl) + '</div></td>';
          h += '</tr>';
        }
      }

      if (topLosers.length > 0) {
        h += '<tr><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;background:#fef2f2">&#x2198; Top Losers</td></tr>';
        for (var tli = 0; tli < topLosers.length; tli++) {
          var tl = topLosers[tli];
          var tlName = _splitFundName ? _splitFundName(tl.fundName) : tl.fundName;
          h += '<tr' + (tli < topLosers.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
          h += '<td style="padding:8px 10px"><div style="font-size:13px;font-weight:600;color:#1e293b">' + _escHtml(tlName) + '</div>';
          if (tl.portfolios && tl.portfolios.length > 0) {
            h += '<div style="margin-top:2px">';
            for (var pli = 0; pli < tl.portfolios.length; pli++) {
              h += '<span style="font-size:10px;color:#64748b;background:#f1f5f9;padding:1px 5px;border-radius:3px;margin-right:3px">' + _escHtml(tl.portfolios[pli]) + '</span>';
            }
            h += '</div>';
          }
          h += '</td>';
          h += '<td style="padding:8px 10px;font-size:12px;color:#64748b;text-align:right">' + _fmtCur(tl.investment) + '</td>';
          h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:#dc2626">' + tl.plPct.toFixed(1) + '%</div><div style="font-size:11px;color:#dc2626">' + _fmtCur(tl.pl) + '</div></td>';
          h += '</tr>';
        }
      }
      h += '</tbody></table>';
    }

    // Portfolio Performance
    if (topPortfolios.length > 0 || bottomPortfolios.length > 0) {
      h += _secH('Portfolio Performance', '#d97706');
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px"><tbody>';

      if (topPortfolios.length > 0) {
        h += '<tr><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.5px;background:#f0fdf4;border-radius:8px 8px 0 0">&#x2197; Top Performing</td></tr>';
        for (var tpi = 0; tpi < topPortfolios.length; tpi++) {
          var tp = topPortfolios[tpi];
          h += '<tr' + (tpi < topPortfolios.length - 1 || bottomPortfolios.length > 0 ? ' style="' + _rowBd + '"' : '') + '>';
          h += '<td style="padding:8px 10px"><div style="font-size:13px;font-weight:600;color:#1e293b">' + _escHtml(tp.portfolioName) + '</div><div style="font-size:11px;color:#94a3b8">' + _escHtml(tp.ownerName) + '</div></td>';
          h += '<td style="padding:8px 10px;font-size:12px;color:#64748b;text-align:right">' + _fmtCur(tp.invested) + '</td>';
          h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:#059669">+' + tp.plPct.toFixed(1) + '%</div><div style="font-size:11px;color:#059669">+' + _fmtCur(tp.pl) + '</div></td>';
          h += '</tr>';
        }
      }

      if (bottomPortfolios.length > 0) {
        h += '<tr><td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;background:#fef2f2">&#x2198; Underperforming</td></tr>';
        for (var bpi = 0; bpi < bottomPortfolios.length; bpi++) {
          var bp = bottomPortfolios[bpi];
          h += '<tr' + (bpi < bottomPortfolios.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
          h += '<td style="padding:8px 10px"><div style="font-size:13px;font-weight:600;color:#1e293b">' + _escHtml(bp.portfolioName) + '</div><div style="font-size:11px;color:#94a3b8">' + _escHtml(bp.ownerName) + '</div></td>';
          h += '<td style="padding:8px 10px;font-size:12px;color:#64748b;text-align:right">' + _fmtCur(bp.invested) + '</td>';
          h += '<td style="padding:8px 10px;text-align:right"><div style="font-size:13px;font-weight:700;color:#dc2626">' + bp.plPct.toFixed(1) + '%</div><div style="font-size:11px;color:#dc2626">' + _fmtCur(bp.pl) + '</div></td>';
          h += '</tr>';
        }
      }
      h += '</tbody></table>';
    }

    h += '</td></tr></tbody></table>';
  }

  // ══════════════════════════════════════════════════════════════════
  // 9. ACCOUNT DIRECTORY
  // ══════════════════════════════════════════════════════════════════
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:6px"><tbody><tr>';
  h += '<td style="width:3px"><div style="width:3px;height:14px;background:#059669;border-radius:2px"></div></td>';
  h += '<td style="padding-left:10px;font-size:13px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px">Account Directory</td>';
  h += '</tr></tbody></table>';
  h += '<div style="font-size:13px;color:#64748b;margin-bottom:16px">Complete list of all accounts across institutions &mdash; keep this for your records</div>';

  // Bank Accounts
  if (bankAccounts.length > 0) {
    h += '<div style="font-size:13px;font-weight:600;color:#059669;margin-bottom:8px">&#127974; Bank Accounts</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px"><tbody>';
    h += '<tr style="background:#f1f5f9"><th style="' + _thL + 'width:18%">Member</th><th style="' + _thL + 'width:18%">Bank</th><th style="' + _thL + 'width:22%">Account No</th><th style="' + _thL + 'width:16%">Type</th><th style="' + _thL + 'width:26%">Branch</th></tr>';
    for (var bki = 0; bki < bankAccounts.length; bki++) {
      var bk = bankAccounts[bki];
      var bkMN = memNames[bk.memberId] || '-';
      var bkAN = bk.accountNumber || ''; if (bkAN.length > 4) bkAN = 'XXXX-' + bkAN.slice(-4);
      h += '<tr' + (bki < bankAccounts.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
      h += '<td style="' + _td + '">' + _escHtml(bkMN) + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#1e293b;font-weight:600">' + _escHtml(bk.bankName) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(bkAN) + '</td>';
      h += '<td style="' + _td + '">' + _escHtml(bk.accountType || '-') + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#64748b">' + _escHtml(bk.branch || '-') + '</td></tr>';
    }
    h += '</tbody></table>';
  }

  // Investment Accounts
  if (investmentAccounts.length > 0) {
    h += '<div style="font-size:13px;font-weight:600;color:#7c3aed;margin-bottom:8px">&#128200; Investment Accounts</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px"><tbody>';
    h += '<tr style="background:#f1f5f9"><th style="' + _thL + 'width:18%">Member</th><th style="' + _thL + 'width:18%">Platform</th><th style="' + _thL + 'width:18%">Client ID</th><th style="' + _thL + 'width:16%">Type</th><th style="' + _thL + 'width:30%">Registered Email</th></tr>';
    for (var iak = 0; iak < investmentAccounts.length; iak++) {
      var ia = investmentAccounts[iak];
      var iaMN = memNames[ia.memberId] || '-';
      h += '<tr' + (iak < investmentAccounts.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
      h += '<td style="' + _td + '">' + _escHtml(iaMN) + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#1e293b;font-weight:600">' + _escHtml(ia.platform) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(ia.clientId || '-') + '</td>';
      h += '<td style="' + _td + '">' + _escHtml(ia.accountType || '-') + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#64748b">' + _escHtml(ia.email || '-') + '</td></tr>';
    }
    h += '</tbody></table>';
  }

  // Insurance Policies
  if (activeInsurance.length > 0) {
    var insTypeColors = { 'Health': '#059669', 'Term Life': '#7c3aed', 'Term': '#7c3aed', 'Vehicle': '#2563eb', 'Motor': '#2563eb', 'Home': '#d97706', 'Travel': '#db2777' };
    h += '<div style="font-size:13px;font-weight:600;color:#b45309;margin-bottom:8px">&#128737; Insurance Policies</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px"><tbody>';
    h += '<tr style="background:#f1f5f9"><th style="' + _thL + 'width:13%">Member</th><th style="' + _thL + 'width:14%">Provider</th><th style="' + _thL + 'width:13%">Policy No</th><th style="' + _thL + 'width:10%">Type</th><th style="' + _thR + 'width:12%">Cover</th><th style="' + _thR + 'width:22%">Premium</th><th style="' + _thL + 'width:16%">Nominee</th></tr>';
    for (var ipi = 0; ipi < activeInsurance.length; ipi++) {
      var ip = activeInsurance[ipi];
      var ipMN = ip.insuredMember || memNames[ip.memberId] || '-';
      var ipColor = insTypeColors[ip.policyType] || '#64748b';
      var nominee = ip.nominee || (ip.dynamicFields ? (ip.dynamicFields['Nominee'] || ip.dynamicFields['nominee'] || '') : '') || '-';
      var premAmt = parseFloat(ip.premium) || 0;
      var premHtml = premAmt > 0 ? _fmtCur(premAmt) : '-';
      var premFreq = ip.premiumFrequency || '';
      var premDue = ip.premiumDueDate || ip.renewalDate || '';
      if (premFreq || premDue) {
        var premD = [];
        if (premFreq) premD.push(_escHtml(premFreq));
        if (premDue) premD.push('Due: ' + _fmtDate(premDue));
        premHtml += '<div style="font-size:13px;color:#64748b">' + premD.join(' &middot; ') + '</div>';
      }
      h += '<tr' + (ipi < activeInsurance.length - 1 ? ' style="' + _rowBd + '"' : '') + '>';
      h += '<td style="' + _td + '">' + _escHtml(ipMN) + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#1e293b;font-weight:600">' + _escHtml(ip.company) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(ip.policyNumber) + '</td>';
      h += '<td style="padding:6px 8px"><span style="background:' + _hexBg(ipColor, 0.08) + ';color:' + ipColor + ';font-size:10px;font-weight:600;padding:2px 5px;border-radius:3px">' + _escHtml(ip.policyType) + '</span></td>';
      h += '<td style="padding:6px 8px;font-size:13px;font-weight:600;color:#1e293b;text-align:right">' + _fmtCur(ip.sumAssured) + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;color:#475569;text-align:right">' + premHtml + '</td>';
      h += '<td style="padding:6px 8px;font-size:13px;font-weight:600;color:#b45309">' + _escHtml(nominee) + '</td></tr>';
    }
    h += '</tbody></table>';
  }

  h += '</td></tr></tbody></table>'; // close Account Directory

  // ══════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _cs + '"><tbody><tr><td style="padding:20px;text-align:center">';
  h += '<div style="font-size:13px;color:#64748b;margin-bottom:8px">Auto-generated from your Google Sheets &middot; Generated: ' + _escHtml(generatedAt) + '</div>';
  h += '<div style="font-size:14px;color:#475569;font-weight:600;margin-bottom:10px">Made with &#10084;&#65039; in India by <strong style="color:#1e293b">Jagadeesh Manne</strong></div>';
  h += '<a href="https://capitalfriends.in/donate" style="display:inline-block;background:rgba(5,150,105,0.08);border:1px solid rgba(5,150,105,0.2);color:#059669;font-size:13px;font-weight:600;padding:6px 16px;border-radius:6px;text-decoration:none;letter-spacing:0.3px">&#9829; Support this project</a>';
  h += '</td></tr></tbody></table>';

  // Close wrapper
  h += '</td></tr></tbody></table></div>';
  return h;
}


// ══════════════════════════════════════════════════════════════════════
// SIMPLE EMAIL BODY (inline — not the PDF attachment)
// ══════════════════════════════════════════════════════════════════════

function _emailMetricCard(label, value, pl, accentColor) {
  var plHtml = '';
  if (pl !== null && pl !== undefined) {
    var plCol = pl >= 0 ? '#059669' : '#dc2626';
    var plSgn = pl >= 0 ? '+' : '';
    plHtml = '<div style="font-size:11px;color:' + plCol + ';margin-top:2px;">' + plSgn + formatEmailCurrency(pl) + '</div>';
  }
  return '<td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;border-top:3px solid ' + accentColor + ';"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">' + _escHtml(label) + '</div><div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:2px;">' + value + '</div>' + plHtml + '</td>';
}

function buildSimpleEmailBody(recipientName, dashData, familyHeadName) {
  var greeting = getTimeBasedGreeting();
  var date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');
  var name = recipientName || '';
  var d = dashData || {};
  var ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
  var familyLabel = 'Your Family';
  if (familyHeadName) { var pts = familyHeadName.trim().split(/\s+/); familyLabel = (pts.length > 1 ? pts[pts.length - 1] : pts[0]) + ' Family'; }
  var nw = d.netWorth || 0, ta = d.totalAssets || 0, ti = d.totalInvested || 0, tl = d.totalLiabilities || 0;
  var tPL = d.totalPL || 0, pp = d.plPct || (ti > 0 ? ((tPL / ti) * 100) : 0);
  var pc = tPL >= 0 ? '#059669' : '#dc2626', ps = tPL >= 0 ? '+' : '';
  var mfI = parseFloat(d.mfInvested) || 0, mfC = parseFloat(d.mfCurrentValue) || 0;
  var skI = parseFloat(d.stkInvested) || 0, skC = parseFloat(d.stkCurrentValue) || 0;
  var oC = parseFloat(d.otherCurrentValue) || 0;
  var eL = ''; // Logo rendered as text fallback (no external fetch needed)
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:' + ff + ';background-color:#f0f4f8;"><div style="margin:0 auto;padding:0;">';
  h += '<div style="background:linear-gradient(135deg,#059669 0%,#047857 50%,#065f46 100%);padding:32px 28px 24px;text-align:center;">';
  h += (eL ? '<img src="' + eL + '" alt="Capital Friends" style="height:44px;width:auto;display:inline-block;margin-bottom:8px;filter:brightness(0) invert(1);" />' : '<div style="margin-bottom:8px;"><span style="font-size:24px;font-weight:800;color:#fff;">Capital</span><span style="font-size:24px;font-weight:800;color:#a7f3d0;">Friends</span></div>');
  h += '<div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:0.5px;">FAMILY PORTFOLIO MANAGER</div></div>';
  h += '<div style="background:#065f46;padding:12px 28px;text-align:center;"><span style="font-size:13px;color:rgba(255,255,255,0.6);">' + _escHtml(date) + '</span><span style="color:rgba(255,255,255,0.3);margin:0 8px;">\u2022</span><span style="font-size:13px;font-weight:700;color:#fff;">' + _escHtml(familyLabel) + '</span></div>';
  h += '<div style="background:#fff;padding:28px;"><p style="margin:0 0 20px;font-size:16px;color:#1e293b;font-weight:600;">' + greeting + (name ? ', ' + _escHtml(name) : '') + '</p>';
  h += '<p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">Here\'s your ' + _escHtml(familyLabel) + ' financial summary for <strong>' + _escHtml(date) + '</strong>. Scroll down for the complete report.</p>';
  h += '<div style="background:linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 100%);border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:20px;text-align:center;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px;">Net Worth</div><div style="font-size:32px;font-weight:800;color:#065f46;">' + formatEmailCurrency(nw) + '</div>';
  h += '<div style="margin-top:8px;"><span style="font-size:12px;color:' + pc + ';font-weight:600;">' + ps + formatEmailCurrency(tPL) + ' (' + ps + (typeof pp === 'number' ? pp.toFixed(1) : pp) + '%)</span><span style="font-size:12px;color:#94a3b8;margin-left:4px;">overall P&amp;L</span></div></div>';
  h += '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;"><tr>' + _emailMetricCard('Mutual Funds', formatEmailCurrency(mfC), mfC - mfI, '#10b981') + '<td style="width:12px;"></td>' + _emailMetricCard('Stocks', formatEmailCurrency(skC), skC - skI, '#3b82f6') + '<td style="width:12px;"></td>' + _emailMetricCard('Other Inv.', formatEmailCurrency(oC), null, '#8b5cf6') + '</tr></table>';
  if (tl > 0) h += '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;"><tr><td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;"><div style="font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;">Total Liabilities</div><div style="font-size:18px;font-weight:700;color:#dc2626;margin-top:2px;">' + formatEmailCurrency(tl) + '</div></td><td style="width:12px;"></td><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total Investments</div><div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:2px;">' + formatEmailCurrency(ta) + '</div></td></tr></table>';
  h += '</div>';
  h += '<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;"><table cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="vertical-align:middle;text-align:left;">' + (eL ? '<img src="' + eL + '" alt="Capital Friends" style="height:30px;width:auto;display:block;margin-bottom:6px;" />' : '') + '<div style="font-size:11px;color:#94a3b8;margin-top:4px;">Built with love by Jagadeesh Manne</div></td></tr></table></div></div></body></html>';
  return h;
}

function getTimeBasedGreeting() {
  var now = new Date(), ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 19800000);
  var hr = ist.getHours();
  return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
}

function formatEmailCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '\u20B90';
  var neg = amount < 0, abs = Math.abs(amount), fmt;
  if (abs >= 10000000) fmt = '\u20B9' + (abs / 10000000).toFixed(2) + ' Cr';
  else if (abs >= 100000) fmt = '\u20B9' + (abs / 100000).toFixed(2) + ' L';
  else if (abs >= 1000) fmt = '\u20B9' + (abs / 1000).toFixed(2) + ' K';
  else fmt = '\u20B9' + (abs === Math.floor(abs) ? abs.toFixed(0) : abs.toFixed(2));
  return neg ? '-' + fmt : fmt;
}

function formatCurrencyForEmail(amount) { return formatEmailCurrency(amount); }
function buildConsolidatedEmailBody(data, reportType) { return buildDashboardPDFHTML(data); }
function buildConsolidatedEmailBodyInlineStyles(data, reportType) { return buildDashboardPDFHTML(data); }

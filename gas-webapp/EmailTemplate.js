/**
 * EmailTemplate.js — Family Wealth Dashboard HTML Email
 *
 * buildDashboardPDFHTML(data) — Generates HTML email body matching ref.html design exactly
 * buildSimpleEmailBody(...)   — Compact email body with financial highlights
 *
 * Design: Uses ref.html template directly — white cards with colored left borders,
 * border-radius, box-shadow, linear-gradient bars. Designed for HTML email clients.
 */

// ── Helpers ──

var _imageBase64Cache = {};

function _getImageBase64(url) {
  if (_imageBase64Cache[url]) return _imageBase64Cache[url];
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return '';
    var b = r.getBlob();
    var uri = 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes());
    _imageBase64Cache[url] = uri;
    return uri;
  } catch (e) { return ''; }
}

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

function _fmtCur(amount) { return formatCurrencyForEmail(amount); }
function _plColor(v) { return v >= 0 ? '#10b981' : '#dc2626'; }
function _plSign(v) { return v >= 0 ? '+' : ''; }
function _maskAadhar(a) {
  if (!a) return '-';
  var s = String(a).replace(/\D/g, '');
  return s.length >= 4 ? 'XXXX-XXXX-' + s.slice(-4) : s;
}

var _ALLOC_GRADIENT = {
  Equity: ['#10b981', '#059669'], Debt: ['#3b82f6', '#2563eb'],
  Gold: ['#f59e0b', '#d97706'], Commodities: ['#f59e0b', '#d97706'],
  'Real Estate': ['#f97316', '#ea580c'], Hybrid: ['#8b5cf6', '#7c3aed'],
  Cash: ['#0891b2', '#0e7490'], Other: ['#8b5cf6', '#7c3aed']
};
var _MEMBER_COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];
var _ACTION_STYLES = {
  critical: { bg: '#fef2f2', border: '#ef4444', titleColor: '#7f1d1d', descColor: '#991b1b', actionBg: '#fecaca', actionColor: '#7f1d1d' },
  warning: { bg: '#fff7ed', border: '#f97316', titleColor: '#7c2d12', descColor: '#9a3412', actionBg: '#fed7aa', actionColor: '#7c2d12' },
  info: { bg: '#eff6ff', border: '#3b82f6', titleColor: '#1e3a5f', descColor: '#1e40af', actionBg: '#bfdbfe', actionColor: '#1e3a5f' },
  success: { bg: '#f0fdf4', border: '#10b981', titleColor: '#14532d', descColor: '#166534', actionBg: '#bbf7d0', actionColor: '#14532d' }
};

function buildDashboardPDFHTML(data) {
  var d = data || {};
  var logoUrl = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/logo-new.png';
  var netWorth = d.netWorth || 0, totalAssets = d.totalAssets || 0, totalInvested = d.totalInvested || 0;
  var totalLiabilities = d.totalLiabilities || 0;
  var lifeCover = d.lifeCover || 0, healthCover = d.healthCover || 0;
  var assetClassList = d.assetClassList || [], actionItems = d.actionItems || [];
  var activeInsurance = d.activeInsurance || [], membersData = d.membersData || [];
  var activeLiabilities = d.activeLiabilities || [];
  var familyMembers = d.familyMembers || [], bankAccounts = d.bankAccounts || [];
  var investmentAccounts = d.investmentAccounts || [];
  var allMFPortfolios = d.allMFPortfoliosFlat || [], allStockPortfolios = d.allStockPortfoliosFlat || [];
  var allOtherInvestments = d.allOtherInvestments || [];
  var generatedAt = d.generatedAt || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');
  // memberNetWorth available via d.memberNetWorth if needed

  // Build investment account lookup
  var iaLookup = {};
  for (var iai = 0; iai < investmentAccounts.length; iai++) iaLookup[investmentAccounts[iai].accountId] = investmentAccounts[iai];

  // No "Open Google Sheet" button per user request

  // Style constants
  var _thS = 'padding:8px;font-size:11px;font-weight:600;color:#1f2937;text-align:left;';
  var _thR = 'padding:8px;font-size:11px;font-weight:600;color:#1f2937;text-align:right;';
  var _thC = 'padding:8px;font-size:11px;font-weight:600;color:#1f2937;text-align:center;';
  var _tdS = 'padding:8px;font-size:12px;color:#111827;';
  var _tdSec = 'padding:8px;font-size:12px;color:#374151;';
  var _tdMono = 'padding:8px;font-size:11px;font-family:monospace;color:#374151;';
  var _tdR = 'padding:8px;font-size:12px;color:#111827;text-align:right;';
  var _tdSecR = 'padding:8px;font-size:12px;color:#374151;text-align:right;'; // used in buildSimpleEmailBody
  var _tdBoldR = 'padding:8px;font-size:12px;font-weight:600;color:#111827;text-align:right;';
  var _tdC = 'padding:8px;font-size:12px;color:#4b5563;text-align:center;';
  var _fThS = 'padding:6px 8px;font-size:10px;font-weight:600;color:#1f2937;text-align:left;';
  var _fThR = 'padding:6px 8px;font-size:10px;font-weight:600;color:#1f2937;text-align:right;';
  var _fTdS = 'padding:6px 8px;font-size:11px;color:#111827;';
  var _fTdMono = 'padding:6px 8px;font-size:11px;font-family:monospace;color:#374151;';
  var _fTdSecR = 'padding:6px 8px;font-size:11px;color:#374151;text-align:right;';
  var _fTdR = 'padding:6px 8px;font-size:11px;color:#111827;text-align:right;';
  var _fTdBoldR = 'padding:6px 8px;font-size:11px;font-weight:700;text-align:right;';
  var _card = 'background:white;border-top:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;';

  // Build per-member data from flat arrays
  var memberMap = {};
  for (var fmi = 0; fmi < familyMembers.length; fmi++) {
    var fm = familyMembers[fmi];
    memberMap[fm.memberId] = { member: fm, mfPortfolios: [], stockPortfolios: [], otherInvestments: [], liabilities: [], insurance: [] };
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

  var h = '<div style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;background-color:#fafafa"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fafafa"><tbody><tr><td style="padding:24px">';

  // 1. HEADER
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(90deg,#eef2ff 0%,#f3e8ff 50%,#fce7f3 100%);border-left:4px solid #6366f1;border-top:1px solid #d1d5db;border-right:1px solid #d1d5db;border-bottom:1px solid #d1d5db;border-radius:8px;margin-bottom:24px"><tbody><tr><td style="padding:20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="vertical-align:middle;width:220px;padding-right:15px"><img src="' + logoUrl + '" alt="Capital Friends Logo" style="display:block;border:0;max-width:200px;height:auto;max-height:100px"></td>';
  h += '<td align="right" style="vertical-align:top;padding-left:15px"><div style="font-size:11px;color:#4b5563;margin-bottom:8px">This report is auto-generated from your Google Sheets. Keep your financial data secure.</div>';
  h += '<div style="font-size:13px;color:#374151;font-weight:600;margin-bottom:10px">Made with &#10084;&#65039; in India by <strong>Jagadeesh Manne</strong> &middot; Donate: <strong>8977099970</strong> (GPay)</div>';
  if (ssUrl) h += '<div><a href="' + ssUrl + '" style="display:inline-block;padding:8px 16px;background:#10b981;color:white;text-decoration:none;font-size:12px;font-weight:600;border-radius:6px" target="_blank">&#128202; Open Google Sheet</a></div>';
  h += '</td></tr></tbody></table></td></tr></tbody></table>';

  // 2. FAMILY WEALTH DASHBOARD
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #818cf8;"><tbody><tr><td style="padding:20px">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px"><tbody><tr><td style="font-size:18px;font-weight:700;color:#111827">Family Wealth Dashboard</td><td align="right" style="font-size:12px;color:#6b7280;vertical-align:bottom">Generated on: ' + _escHtml(generatedAt) + '</td></tr></tbody></table>';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  // LEFT: Net Worth + Life Cover
  h += '<td style="width:48%;vertical-align:top;padding-right:12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr><td style="vertical-align:top">';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #e5e7eb;border-radius:12px;background:white;margin-bottom:20px"><tbody><tr><td style="padding:24px">';
  h += '<div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">Net Worth Breakdown</div>';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
  h += '<td style="width:50%;vertical-align:middle;padding-right:14px">';
  h += '<div style="margin-bottom:18px"><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Total Wealth</div><div style="font-size:22px;font-weight:700;color:#10b981;line-height:1.2">' + _fmtCur(totalAssets) + '</div></div>';
  h += '<div style="margin-bottom:18px"><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Liabilities</div><div style="font-size:22px;font-weight:700;color:#ef4444;line-height:1.2">' + _fmtCur(totalLiabilities) + '</div></div>';
  h += '<div><div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Total Invested</div><div style="font-size:22px;font-weight:700;color:#3b82f6;line-height:1.2">' + _fmtCur(totalInvested) + '</div></div></td>';
  h += '<td style="width:50%;vertical-align:middle;padding-left:14px;border-left:2px solid #3b82f6;text-align:center"><div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.9px;margin-bottom:10px">Your Net Worth</div><div style="font-size:36px;font-weight:800;color:#3b82f6;line-height:1;white-space:nowrap">' + _fmtCur(netWorth) + '</div><div style="font-size:10px;color:#6b7280;margin-top:10px">Wealth minus liabilities</div></td>';
  h += '</tr></tbody></table></td></tr></tbody></table>';
  // Life Cover
  var coverMsg = lifeCover > 0 ? 'Your family is protected' : 'No life cover found';
  var coverCol = lifeCover > 0 ? '#059669' : '#dc2626';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #e5e7eb;border-radius:12px;background:white"><tbody><tr><td style="padding:20px;text-align:center">';
  h += '<div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.9px;margin-bottom:8px">Total Life Cover</div>';
  h += '<div style="font-size:30px;font-weight:800;color:#8b5cf6;line-height:1;white-space:nowrap">' + _fmtCur(lifeCover) + '</div>';
  h += '<div style="font-size:10px;color:' + coverCol + ';margin-top:8px;font-weight:600">' + coverMsg + '</div></td></tr></tbody></table>';
  h += '</td></tr></tbody></table></td>';
  // RIGHT: Asset Allocation
  h += '<td style="width:48%;vertical-align:top;padding-left:12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #e5e7eb;border-radius:12px;background:white;height:100%"><tbody><tr><td style="padding:24px">';
  h += '<div style="font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">Asset Allocation</div>';
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">';
  for (var ai = 0; ai < assetClassList.length; ai++) {
    var ac = assetClassList[ai]; if ((ac.pct || 0) <= 0) continue;
    var g = _ALLOC_GRADIENT[ac.name] || _ALLOC_GRADIENT.Other;
    h += '<tr><td style="padding:12px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="vertical-align:middle;width:80px"><div style="font-size:11px;color:#6b7280;font-weight:600">' + _escHtml(ac.name) + '</div></td>';
    h += '<td align="right" style="vertical-align:middle;width:60px;padding-right:10px"><div style="font-size:13px;font-weight:700;color:#1f2937">' + ac.pct.toFixed(1) + '%</div></td>';
    h += '<td align="right" style="vertical-align:middle"><div style="font-size:12px;color:#6b7280">' + _fmtCur(ac.value) + '</div></td></tr>';
    h += '<tr><td colspan="3" style="padding-top:6px"><div style="width:100%;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">';
    h += '<div style="width:' + Math.max(1, ac.pct).toFixed(1) + '%;height:100%;background:linear-gradient(90deg,' + g[0] + ' 0%,' + g[1] + ' 100%);border-radius:4px"></div></div></td></tr></tbody></table></td></tr>';
  }
  h += '</table></td></tr></tbody></table></td></tr></tbody></table>';
  h += '</td></tr></tbody></table>';

  // 3. ACTION ITEMS
  if (actionItems.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #fbbf24;"><tbody><tr><td style="padding:20px">';
    h += '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:16px">Action Items &amp; Recommendations</div>';
    for (var aci = 0; aci < actionItems.length; aci++) {
      var itm = actionItems[aci], st = _ACTION_STYLES[itm.type] || _ACTION_STYLES.warning;
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:10px"><tbody><tr><td style="background:' + st.bg + ';border-left:4px solid ' + st.border + ';border-radius:6px;padding:14px">';
      h += '<div style="font-size:14px;font-weight:700;color:' + st.titleColor + ';margin-bottom:6px">' + _escHtml(itm.title) + '</div>';
      h += '<div style="font-size:12px;color:' + st.descColor + ';margin-bottom:8px;line-height:1.5">' + _escHtml(itm.description) + '</div>';
      if (itm.action) h += '<div style="font-size:11px;color:' + st.actionColor + ';background:' + st.actionBg + ';display:inline-block;padding:6px 10px;border-radius:4px"><strong>Action:</strong> ' + _escHtml(itm.action) + '</div>';
      h += '</td></tr></tbody></table>';
    }
    var hs = 0;
    if (lifeCover > 0) hs++; if (healthCover > 0) hs++;
    if (totalAssets > 0) hs++; if (totalLiabilities === 0) hs++; if (assetClassList.length >= 2) hs++;
    if (membersData.length > 0) hs++; if (activeInsurance.length > 0) hs++;
    if (familyMembers.length > 0) hs++;
    h += '<div style="border-top:1px solid #d1d5db;padding-top:12px;margin-top:10px"><div style="font-size:12px;color:#6b7280"><strong>Financial Health Score: ' + hs + '/8</strong> - Complete these actions to improve your score</div></div>';
    h += '</td></tr></tbody></table>';
  }

  // 4. INSURANCE (grouped by type with subtotals, matching ref.html)
  if (activeInsurance.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #818cf8;"><tbody><tr><td style="padding:20px">';
    h += '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:16px">Insurance Policies</div>';
    var ibt = {};
    for (var iig = 0; iig < activeInsurance.length; iig++) { var ip0 = activeInsurance[iig]; var pt = ip0.policyType || 'Other'; if (!ibt[pt]) ibt[pt] = []; ibt[pt].push(ip0); }
    var itk = Object.keys(ibt);
    // Preferred order: Health first, then Term
    itk.sort(function(a, b) { var ord = {'Health':0, 'Term Life':1}; return (ord[a]||9) - (ord[b]||9); });
    var insTypeColors = {'Health':'#10b981', 'Term Life':'#7c3aed'};
    for (var iti = 0; iti < itk.length; iti++) {
      var it = itk[iti], ipl = ibt[it], ilt = (iti === itk.length - 1);
      var insColor = insTypeColors[it] || '#6b7280';
      h += '<div style="margin-bottom:' + (ilt ? '0' : '20') + 'px"><div style="font-size:14px;font-weight:600;color:' + insColor + ';margin-bottom:12px">' + _escHtml(it === 'Term Life' ? 'Term Insurance' : it + ' Insurance') + '</div>';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
      h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Member</th><th style="' + _thS + '">Policy Name</th><th style="' + _thS + '">Provider</th><th style="' + _thS + '">Policy Number</th><th style="' + _thR + '">Sum Assured</th><th style="' + _thS + '">Nominee</th></tr>';
      var insTypeTotal = 0;
      for (var ipi = 0; ipi < ipl.length; ipi++) {
        var ip = ipl[ipi], ipLast = (ipi === ipl.length - 1);
        insTypeTotal += (parseFloat(ip.sumAssured) || 0);
        var nominee = ip.nominee || (ip.dynamicFields ? (ip.dynamicFields['Nominee'] || ip.dynamicFields['nominee'] || '') : '');
        h += '<tr' + (ipLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
        h += '<td style="' + _tdS + '">' + _escHtml(ip.insuredMember) + '</td>';
        h += '<td style="' + _tdSec + '">' + _escHtml(ip.policyName || ip.policyType) + '</td>';
        h += '<td style="' + _tdS + '">' + _escHtml(ip.company) + '</td>';
        h += '<td style="' + _tdMono + '">' + _escHtml(ip.policyNumber) + '</td>';
        h += '<td style="' + _tdBoldR + '">' + _fmtCur(ip.sumAssured) + '</td>';
        h += '<td style="' + _tdSec + '">' + _escHtml(nominee || '-') + '</td></tr>';
      }
      // Subtotal row
      h += '<tr style="background:#f9fafb;font-weight:600;border-top:2px solid #d1d5db"><td colspan="4" style="' + _tdS + '">Total ' + _escHtml(it === 'Term Life' ? 'Term Insurance' : it + ' Insurance') + ' Coverage</td>';
      h += '<td style="padding:8px;font-size:12px;font-weight:700;color:' + insColor + ';text-align:right">' + _fmtCur(insTypeTotal) + '</td>';
      h += '<td style="padding:8px;font-size:11px;color:#6b7280">' + ipl.length + ' polic' + (ipl.length === 1 ? 'y' : 'ies') + '</td></tr>';
      h += '</tbody></table></div>';
    }
    h += '</td></tr></tbody></table>';
  }

  // 5. PER-MEMBER SECTIONS (Financial Summary + Portfolios + Other Inv + Liabilities)
  for (var mci = 0; mci < familyMembers.length; mci++) {
    var mem = familyMembers[mci];
    var md = memberMap[mem.memberId] || { mfPortfolios: [], stockPortfolios: [], otherInvestments: [], liabilities: [], insurance: [] };
    var mColor = _MEMBER_COLORS[mci % _MEMBER_COLORS.length];

    // Compute member totals
    var mMFInv = 0, mMFCur = 0, mStkInv = 0, mStkCur = 0, mOthInv = 0, mOthCur = 0, mLiab = 0;
    for (var mpi = 0; mpi < md.mfPortfolios.length; mpi++) { mMFInv += parseFloat(md.mfPortfolios[mpi].totalInvestment) || 0; mMFCur += parseFloat(md.mfPortfolios[mpi].currentValue) || 0; }
    for (var msi = 0; msi < md.stockPortfolios.length; msi++) { mStkInv += parseFloat(md.stockPortfolios[msi].totalInvestment) || 0; mStkCur += parseFloat(md.stockPortfolios[msi].currentValue) || 0; }
    for (var moi = 0; moi < md.otherInvestments.length; moi++) { mOthCur += parseFloat(md.otherInvestments[moi].currentValue) || 0; mOthInv += parseFloat(md.otherInvestments[moi].investedAmount) || 0; }
    for (var mli = 0; mli < md.liabilities.length; mli++) { mLiab += parseFloat(md.liabilities[mli].outstandingBalance) || 0; }
    var mTotalAssets = mMFCur + mStkCur + mOthCur;
    var mNetWorth = mTotalAssets - mLiab;
    var mPortCount = md.mfPortfolios.length + md.stockPortfolios.length;

    // Member term cover
    var mTermCover = 0;
    for (var mii = 0; mii < md.insurance.length; mii++) { if (md.insurance[mii].policyType === 'Term Life') mTermCover += parseFloat(md.insurance[mii].sumAssured) || 0; }

    // Member card
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid ' + mColor + ';"><tbody><tr><td style="padding:20px">';

    // Member name header
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #d1d5db"><tbody><tr>';
    h += '<td style="font-size:20px;font-weight:700;color:' + mColor + '">' + _escHtml(mem.memberName) + '</td>';
    h += '<td align="right" style="font-size:14px;font-weight:500;color:#4b5563;vertical-align:bottom">Financial Summary</td>';
    h += '</tr></tbody></table>';

    // Financial Summary + Personal Details box
    h += '<div style="margin-bottom:20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #e5e7eb;border-radius:8px;background:linear-gradient(135deg,#f9fafb 0%,#ffffff 100%)"><tbody><tr><td style="padding:16px">';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';

    // LEFT: Financial Summary
    h += '<td style="width:50%;vertical-align:top;padding-right:16px">';
    h += '<div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Financial Summary</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:50%;vertical-align:middle;padding-right:10px">';
    h += '<div style="margin-bottom:12px"><div style="font-size:9px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Total Assets</div><div style="font-size:16px;font-weight:700;color:#10b981;line-height:1.2">' + _fmtCur(mTotalAssets) + '</div></div>';
    h += '<div style="margin-bottom:12px"><div style="font-size:9px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Liabilities</div><div style="font-size:16px;font-weight:700;color:#ef4444;line-height:1.2">' + _fmtCur(mLiab) + '</div></div>';
    h += '<div><div style="font-size:9px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Term Cover</div><div style="font-size:16px;font-weight:700;color:#8b5cf6;line-height:1.2">' + (mTermCover > 0 ? _fmtCur(mTermCover) : '<span style="color:#6b7280;font-style:italic">None</span>') + '</div></div>';
    h += '</td>';
    h += '<td style="width:50%;vertical-align:middle;padding-left:10px;border-left:2px solid #3b82f6;text-align:center">';
    h += '<div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:6px">Net Worth</div>';
    h += '<div style="font-size:22px;font-weight:800;color:#3b82f6;line-height:1;white-space:nowrap">' + _fmtCur(mNetWorth) + '</div>';
    h += '<div style="font-size:9px;color:#6b7280;margin-top:6px">' + mPortCount + ' Portfolio' + (mPortCount !== 1 ? 's' : '') + '</div>';
    h += '</td></tr></tbody></table></td>';

    // RIGHT: Personal Details
    h += '<td style="width:50%;vertical-align:top;padding-left:16px;border-left:2px solid #d1d5db">';
    h += '<div style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Personal Details</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
    h += '<td style="width:50%;vertical-align:top;padding-right:8px">';
    h += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Email</div><div style="font-size:11px;color:#111827;font-weight:600;word-break:break-all;line-height:1.3">' + _escHtml(mem.email || '-') + '</div></div>';
    h += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px"><div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">PAN</div><div style="font-size:11px;color:#111827;font-weight:600;font-family:monospace">' + _escHtml(mem.pan || '-') + '</div></div>';
    h += '</td><td style="width:50%;vertical-align:top;padding-left:8px">';
    h += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px;margin-bottom:10px"><div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Mobile</div><div style="font-size:11px;color:#111827;font-weight:600;font-family:monospace">' + _escHtml(mem.mobile || '-') + '</div></div>';
    h += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px"><div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Aadhar</div><div style="font-size:11px;color:#111827;font-weight:600;font-family:monospace">' + _maskAadhar(mem.aadhar) + '</div></div>';
    h += '</td></tr></tbody></table></td>';

    h += '</tr></tbody></table></td></tr></tbody></table></div>';

    // Member MF Portfolios table
    if (md.mfPortfolios.length > 0) {
      h += '<div style="margin-bottom:20px"><div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:12px">Mutual Funds Portfolios</div>';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
      h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Portfolio Name</th><th style="' + _thR + '">Invested</th><th style="' + _thR + '">Current Value</th><th style="' + _thR + '">Unrealized P&amp;L</th><th style="' + _thR + '">Realized P&amp;L</th><th style="' + _thR + '">Total P&amp;L</th><th style="' + _thR + '">Returns %</th><th style="padding:8px;font-size:11px;font-weight:600;color:#8b5cf6;text-align:right">XIRR %</th><th style="padding:8px;font-size:11px;font-weight:600;color:#8b5cf6;text-align:right">CAGR %</th><th style="' + _thC + '">Funds</th></tr>';
      var mmti = 0, mmtc = 0, mmtUPL = 0, mmtRPL = 0, mmtTPL = 0, mmtf = 0;
      for (var mpi2 = 0; mpi2 < md.mfPortfolios.length; mpi2++) {
        var mp2 = md.mfPortfolios[mpi2];
        var mpI = parseFloat(mp2.totalInvestment) || 0, mpC = parseFloat(mp2.currentValue) || 0;
        var mpUPL = parseFloat(mp2.unrealizedPL) || 0, mpUPLPct = parseFloat(mp2.unrealizedPLPct) || (mpI > 0 ? ((mpC - mpI) / mpI * 100) : 0);
        var mpRPL = parseFloat(mp2.realizedPL) || 0, mpRPLPct = parseFloat(mp2.realizedPLPct) || 0;
        var mpTPL = parseFloat(mp2.totalPL) || (mpC - mpI + mpRPL), mpTPP = mpI > 0 ? ((mpC - mpI) / mpI * 100) : 0;
        var mpF = (mp2.funds || []).length;
        mmti += mpI; mmtc += mpC; mmtUPL += mpUPL; mmtRPL += mpRPL; mmtTPL += mpTPL; mmtf += mpF;
        var mpLast = (mpi2 === md.mfPortfolios.length - 1);
        h += '<tr' + (mpLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
        h += '<td style="' + _tdS + 'font-weight:600">' + _escHtml(mp2.portfolioName) + '</td>';
        h += '<td style="' + _tdR + '">' + _fmtCur(mpI) + '</td>';
        h += '<td style="' + _tdBoldR + '">' + _fmtCur(mpC) + '</td>';
        h += '<td style="padding:8px;font-size:11px;color:#3b82f6;text-align:right">' + _plSign(mpUPL) + _fmtCur(Math.abs(mpUPL)) + '<br><span style="font-size:10px">' + _plSign(mpUPLPct) + mpUPLPct.toFixed(1) + '%</span></td>';
        h += '<td style="padding:8px;font-size:11px;color:#34d399;text-align:right">' + _plSign(mpRPL) + _fmtCur(Math.abs(mpRPL)) + '<br><span style="font-size:10px">' + _plSign(mpRPLPct) + mpRPLPct.toFixed(1) + '%</span></td>';
        h += '<td style="' + _tdR + 'color:' + _plColor(mpTPL) + '">' + _plSign(mpTPL) + _fmtCur(Math.abs(mpTPL)) + '</td>';
        h += '<td style="' + _fTdBoldR + 'color:' + _plColor(mpTPP) + '">' + _plSign(mpTPP) + mpTPP.toFixed(1) + '%</td>';
        h += '<td style="padding:8px;font-size:12px;font-weight:600;color:#6b7280;text-align:right">-</td>';
        h += '<td style="padding:8px;font-size:12px;font-weight:600;color:#6b7280;text-align:right">-</td>';
        h += '<td style="' + _tdC + '">' + mpF + '</td></tr>';
      }
      // MF totals row
      var mmtPP = mmti > 0 ? ((mmtc - mmti) / mmti * 100) : 0;
      var mmtUPLPct = mmti > 0 ? ((mmtc - mmti) / mmti * 100) : 0;
      h += '<tr style="background:#f9fafb;font-weight:600;border-top:2px solid #d1d5db"><td style="' + _tdS + '">Total Mutual Funds</td>';
      h += '<td style="' + _tdR + '">' + _fmtCur(mmti) + '</td><td style="' + _tdR + '">' + _fmtCur(mmtc) + '</td>';
      h += '<td style="padding:8px;font-size:11px;color:#3b82f6;text-align:right">' + _plSign(mmtUPL) + _fmtCur(Math.abs(mmtUPL)) + '<br><span style="font-size:10px">' + _plSign(mmtUPLPct) + mmtUPLPct.toFixed(1) + '%</span></td>';
      h += '<td style="padding:8px;font-size:11px;color:#34d399;text-align:right">' + _plSign(mmtRPL) + _fmtCur(Math.abs(mmtRPL)) + '<br><span style="font-size:10px">+0.0%</span></td>';
      h += '<td style="' + _tdR + 'color:' + _plColor(mmtTPL) + '">' + _plSign(mmtTPL) + _fmtCur(Math.abs(mmtTPL)) + '</td>';
      h += '<td style="' + _tdR + 'color:' + _plColor(mmtPP) + '">' + _plSign(mmtPP) + mmtPP.toFixed(1) + '%</td>';
      h += '<td style="' + _tdR + '"></td><td style="' + _tdR + '"></td><td style="' + _tdC + '">' + mmtf + '</td></tr>';
      h += '</tbody></table></div>';
    }

    // Member Stock Portfolios table
    if (md.stockPortfolios.length > 0) {
      h += '<div style="margin-bottom:20px"><div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:12px">Stock Portfolios</div>';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
      h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Platform</th><th style="' + _thS + '">Client ID</th><th style="' + _thR + '">Invested</th><th style="' + _thR + '">Current Value</th><th style="' + _thR + '">P&amp;L</th><th style="' + _thR + '">Returns %</th><th style="' + _thC + '">Stocks</th></tr>';
      var msti = 0, mstc = 0, msth = 0;
      for (var msi2 = 0; msi2 < md.stockPortfolios.length; msi2++) {
        var msp = md.stockPortfolios[msi2];
        var msI = parseFloat(msp.totalInvestment) || 0, msC = parseFloat(msp.currentValue) || 0;
        var msPL = msC - msI, msPP = msI > 0 ? (msPL / msI * 100) : 0, msH = (msp.holdings || []).length;
        msti += msI; mstc += msC; msth += msH;
        var msia = msp.investmentAccountId ? iaLookup[msp.investmentAccountId] : null;
        var mscid = msia ? (msia.clientId || '') : 'N/A';
        h += '<tr><td style="' + _tdS + 'font-weight:600">' + _escHtml(msp.platformBroker || msp.portfolioName) + '</td>';
        h += '<td style="' + _tdMono + '">' + _escHtml(mscid) + '</td>';
        h += '<td style="' + _tdR + '">' + _fmtCur(msI) + '</td><td style="' + _tdBoldR + '">' + _fmtCur(msC) + '</td>';
        h += '<td style="' + _tdR + 'color:' + _plColor(msPL) + '">' + _plSign(msPL) + _fmtCur(Math.abs(msPL)) + '</td>';
        h += '<td style="' + _fTdBoldR + 'color:' + _plColor(msPL) + '">' + _plSign(msPL) + msPP.toFixed(1) + '%</td>';
        h += '<td style="' + _tdC + '">' + msH + '</td></tr>';
      }
      var mstPL = mstc - msti, mstPP = msti > 0 ? (mstPL / msti * 100) : 0;
      h += '<tr style="background:#f9fafb;font-weight:600;border-top:2px solid #d1d5db"><td colspan="2" style="' + _tdS + '">Total Stocks</td>';
      h += '<td style="' + _tdR + '">' + _fmtCur(msti) + '</td><td style="' + _tdR + '">' + _fmtCur(mstc) + '</td>';
      h += '<td style="' + _tdR + 'color:' + _plColor(mstPL) + '">' + _plSign(mstPL) + _fmtCur(Math.abs(mstPL)) + '</td>';
      h += '<td style="' + _tdR + 'color:' + _plColor(mstPL) + '">' + _plSign(mstPL) + mstPP.toFixed(1) + '%</td>';
      h += '<td style="' + _tdC + '">' + msth + '</td></tr></tbody></table></div>';
    }

    // Member Other Investments table
    if (md.otherInvestments.length > 0) {
      h += '<div style="margin-bottom:20px"><div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:12px">Other Investments</div>';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
      h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Type</th><th style="' + _thS + '">Name</th><th style="' + _thR + '">Invested</th><th style="' + _thR + '">Current Value</th><th style="' + _thR + '">Returns</th></tr>';
      for (var moi2 = 0; moi2 < md.otherInvestments.length; moi2++) {
        var moInv = md.otherInvestments[moi2];
        var moI = parseFloat(moInv.investedAmount) || 0, moC = parseFloat(moInv.currentValue) || 0;
        var moRet = moI > 0 ? (moC - moI) : 0;
        var moLast = (moi2 === md.otherInvestments.length - 1);
        h += '<tr' + (moLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
        h += '<td style="' + _tdS + '">' + _escHtml(moInv.investmentType) + '</td>';
        h += '<td style="' + _tdSec + '"><div>' + _escHtml(moInv.investmentName) + '</div></td>';
        h += '<td style="' + _tdR + '">' + (moI > 0 ? _fmtCur(moI) : '<span style="font-style:italic;color:#6b7280">Unknown</span>') + '</td>';
        h += '<td style="' + _tdBoldR + '">' + _fmtCur(moC) + '</td>';
        h += '<td style="' + _tdR + 'color:' + (moRet >= 0 ? '#10b981' : '#dc2626') + '">' + (moI > 0 ? _plSign(moRet) + _fmtCur(Math.abs(moRet)) : 'N/A') + '</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    // Member Liabilities table
    if (md.liabilities.length > 0) {
      h += '<div style="margin-bottom:20px"><div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:12px">Liabilities</div>';
      h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
      h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Type</th><th style="' + _thS + '">Lender</th><th style="' + _thR + '">Outstanding Balance</th></tr>';
      var mlTotal = 0;
      for (var mli2 = 0; mli2 < md.liabilities.length; mli2++) {
        var mlb = md.liabilities[mli2];
        var mlBal = parseFloat(mlb.outstandingBalance) || 0;
        mlTotal += mlBal;
        h += '<tr><td style="' + _tdS + '">' + _escHtml(mlb.liabilityType) + '</td>';
        h += '<td style="' + _tdSec + '">' + _escHtml(mlb.lenderName) + '</td>';
        h += '<td style="padding:8px;font-size:12px;font-weight:600;color:#ef4444;text-align:right">' + _fmtCur(mlBal) + '</td></tr>';
      }
      h += '<tr style="background:#f9fafb;font-weight:600;border-top:2px solid #d1d5db"><td colspan="2" style="' + _tdS + '">Total Outstanding</td>';
      h += '<td style="padding:8px;font-size:12px;font-weight:700;color:#ef4444;text-align:right">' + _fmtCur(mlTotal) + '</td></tr></tbody></table></div>';
    }

    h += '</td></tr></tbody></table>'; // close member card
  }

  // 6. DETAILED PORTFOLIO HOLDINGS (matching ref.html — rich fund tables with NAV, Allocation, Rebalance)
  if (allMFPortfolios.length > 0 || allStockPortfolios.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #818cf8;"><tbody><tr><td style="padding:20px">';
    h += '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:16px">Detailed Portfolio Holdings</div>';

    // MF fund details
    if (allMFPortfolios.length > 0) {
      h += '<div style="margin-bottom:24px"><div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px">Mutual Funds - Individual Fund Details</div>';
      for (var dpi = 0; dpi < allMFPortfolios.length; dpi++) {
        var dp = allMFPortfolios[dpi], dfs = dp.funds || []; if (dfs.length === 0) continue;
        var dpI = parseFloat(dp.totalInvestment) || 0, dpC = parseFloat(dp.currentValue) || 0;
        var dpPL = dpC - dpI, dpPP = dpI > 0 ? (dpPL / dpI * 100) : 0;
        var dpia = dp.investmentAccountId ? iaLookup[dp.investmentAccountId] : null;
        var dcid = dpia ? (dpia.clientId || '') : 'N/A';
        var dpOwner = dp.ownerName || (dpia ? dpia.member : '') || '';
        var dpEmail = dpia ? (dpia.email || '') : '';
        var dpPhone = dpia ? (dpia.phone || '') : '';

        // Portfolio header card
        h += '<div style="background:#f9fafb;border-left:4px solid #9ca3af;border-radius:6px;padding:12px;margin-bottom:16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
        h += '<td style="vertical-align:top"><div style="font-size:14px;font-weight:700;color:#111827">' + _escHtml(dpOwner) + ' - ' + _escHtml(dp.portfolioName) + '</div>';
        h += '<div style="font-size:11px;color:#4b5563;margin-top:4px"><strong>Platform:</strong> ' + _escHtml(dp.platformBroker || 'N/A') + ' | <strong>Client ID:</strong> ' + _escHtml(dcid) + ' | <strong>Email:</strong> ' + _escHtml(dpEmail || '-') + ' | <strong>Mobile:</strong> ' + _escHtml(dpPhone || '-') + '</div></td>';
        h += '<td align="right" style="vertical-align:top"><div style="font-size:11px;color:#4b5563">Portfolio Value</div><div style="font-size:18px;font-weight:700;color:' + _plColor(dpPL) + '">' + _fmtCur(dpC) + '</div><div style="font-size:11px;color:' + _plColor(dpPL) + ';font-weight:600">' + _plSign(dpPL) + dpPP.toFixed(1) + '% returns</div></td>';
        h += '</tr></tbody></table>';

        // Show invested & P&L summary line
        if (dpC > 0) {
          h += '<div style="padding-top:8px;border-top:1px solid #d1d5db;margin-top:8px;font-size:11px"><strong style="color:#4b5563">Invested:</strong> <strong style="color:#6b7280">' + _fmtCur(dpI) + '</strong> <span style="color:#9ca3af;margin:0 6px">&bull;</span> <strong style="color:#4b5563">P&amp;L:</strong> <strong style="color:' + _plColor(dpPL) + '">' + _plSign(dpPL) + _fmtCur(Math.abs(dpPL)) + ' (' + _plSign(dpPP) + dpPP.toFixed(1) + '%)</strong></div>';
        }
        h += '</div>';

        // Fund detail table with rich columns
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px;margin-bottom:20px;font-size:11px"><tbody>';
        h += '<tr style="background:#f3f4f6">';
        h += '<th style="' + _fThS + '">Fund Name</th>';
        h += '<th style="' + _fThR + '">Units</th>';
        h += '<th style="padding:6px 8px;font-size:10px;text-align:right;border-left:2px solid #d1d5db"><div style="font-weight:700;color:#1f2937">NAV</div><div style="font-size:8px;font-weight:500;color:#6b7280">Current / Avg</div></th>';
        h += '<th style="padding:6px 8px;font-size:10px;text-align:right;border-left:2px solid #d1d5db"><div style="font-weight:700;color:#1f2937">Allocation %</div><div style="font-size:8px;font-weight:500;color:#6b7280">Current / Target</div></th>';
        h += '<th style="padding:6px 8px;font-size:10px;text-align:right;border-left:2px solid #d1d5db"><div style="font-weight:700;color:#1f2937">Amount</div><div style="font-size:8px;font-weight:500;color:#6b7280">Current / Invested</div></th>';
        h += '<th style="padding:6px 8px;font-size:10px;font-weight:600;color:#1f2937;text-align:center;border-left:2px solid #d1d5db">Rebalance<br>via SIP</th>';
        h += '<th style="padding:6px 8px;font-size:10px;font-weight:600;color:#1f2937;text-align:center;border-left:2px solid #d1d5db">Rebalance<br>via Buy/Sell</th>';
        h += '<th style="padding:6px 8px;font-size:10px;text-align:right;border-left:2px solid #d1d5db"><div style="font-weight:700;color:#1f2937">P&amp;L</div><div style="font-size:8px;font-weight:500;color:#6b7280">Amount / %</div></th>';
        h += '</tr>';
        for (var fi = 0; fi < dfs.length; fi++) {
          var f = dfs[fi], fI = parseFloat(f.investment) || 0, fC = parseFloat(f.currentValue) || 0;
          var fPL = fC - fI, fPP = fI > 0 ? (fPL / fI * 100) : 0;
          var fU = parseFloat(f.units) || 0;
          var fCurNav = parseFloat(f.currentNav) || (fU > 0 ? fC / fU : 0);
          var fAvgNav = parseFloat(f.avgNav) || (fU > 0 ? fI / fU : 0);
          var fCurAlloc = parseFloat(f.currentAllocationPct) || 0;
          var fTgtAlloc = parseFloat(f.targetAllocationPct) || 0;
          var fRebSIP = parseFloat(f.rebalanceSIP) || 0;
          var fBuySell = parseFloat(f.buySell) || 0;
          var fLast = (fi === dfs.length - 1);
          h += '<tr' + (fLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
          h += '<td style="' + _fTdS + 'max-width:200px">' + _escHtml(f.fundName) + '</td>';
          h += '<td style="' + _fTdSecR + '">' + fU.toFixed(2) + '</td>';
          // NAV Current/Avg
          h += '<td style="padding:6px 8px;font-size:11px;text-align:right;border-left:2px solid #e5e7eb"><div style="font-weight:700;color:#111827">\u20B9' + fCurNav.toFixed(2) + '</div><div style="font-size:10px;color:#6b7280">\u20B9' + fAvgNav.toFixed(2) + '</div></td>';
          // Allocation Current/Target
          h += '<td style="padding:6px 8px;font-size:11px;text-align:right;border-left:2px solid #e5e7eb"><div style="font-weight:700;color:#111827">' + fCurAlloc.toFixed(1) + '%</div><div style="font-size:10px;color:#6b7280">' + fTgtAlloc.toFixed(1) + '%</div></td>';
          // Amount Current/Invested
          h += '<td style="padding:6px 8px;font-size:11px;text-align:right;border-left:2px solid #e5e7eb"><div style="font-weight:700;color:#111827">' + _fmtCur(fC) + '</div><div style="font-size:10px;color:#6b7280">' + _fmtCur(fI) + '</div></td>';
          // Rebalance SIP
          var sipTxt = '-';
          if (fRebSIP > 0) sipTxt = '<span style="color:#3b82f6">+' + _fmtCur(fRebSIP) + '</span>';
          else if (fRebSIP < 0) sipTxt = '<span style="color:#ef4444">' + _fmtCur(fRebSIP) + '</span>';
          h += '<td style="padding:6px 8px;font-size:11px;font-weight:600;text-align:center;border-left:2px solid #e5e7eb">' + sipTxt + '</td>';
          // Rebalance Buy/Sell
          var bsTxt = '-';
          if (fBuySell > 0) bsTxt = '<span style="color:#3b82f6">Buy ' + _fmtCur(fBuySell) + '</span>';
          else if (fBuySell < 0) bsTxt = '<span style="color:#ef4444">Sell ' + _fmtCur(Math.abs(fBuySell)) + '</span>';
          h += '<td style="padding:6px 8px;font-size:11px;font-weight:600;text-align:center;border-left:2px solid #e5e7eb">' + bsTxt + '</td>';
          // P&L Amount/%
          h += '<td style="padding:6px 8px;font-size:11px;text-align:right;border-left:2px solid #e5e7eb"><div style="font-weight:700;color:' + _plColor(fPL) + '">' + _plSign(fPL) + _fmtCur(Math.abs(fPL)) + '</div><div style="font-size:8px;font-weight:700;color:' + _plColor(fPL) + '">' + _plSign(fPP) + fPP.toFixed(1) + '%</div></td>';
          h += '</tr>';
        }
        h += '</tbody></table>';
      }
      h += '</div>';
    }

    // Stock details
    if (allStockPortfolios.length > 0) {
      h += '<div><div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px">Stocks - Individual Stock Details</div>';
      for (var sdpi = 0; sdpi < allStockPortfolios.length; sdpi++) {
        var sdp = allStockPortfolios[sdpi], sdh = sdp.holdings || []; if (sdh.length === 0) continue;
        var sdI = parseFloat(sdp.totalInvestment) || 0, sdC = parseFloat(sdp.currentValue) || 0;
        var sdPL = sdC - sdI, sdPP = sdI > 0 ? (sdPL / sdI * 100) : 0;
        var sdia = sdp.investmentAccountId ? iaLookup[sdp.investmentAccountId] : null;
        var sdcid = sdia ? (sdia.clientId || '') : 'N/A';
        var sdOwner = sdp.ownerName || (sdia ? sdia.member : '') || '';

        h += '<div style="background:#f9fafb;border-left:4px solid #9ca3af;border-radius:6px;padding:12px;margin-bottom:8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>';
        h += '<td style="vertical-align:top"><div style="font-size:14px;font-weight:700;color:#111827">' + _escHtml(sdOwner) + ' - ' + _escHtml(sdp.platformBroker || sdp.portfolioName) + ' Demat</div>';
        h += '<div style="font-size:11px;color:#4b5563;margin-top:4px"><strong>Platform:</strong> ' + _escHtml(sdp.platformBroker) + ' | <strong>Client ID:</strong> ' + _escHtml(sdcid) + '</div></td>';
        h += '<td align="right" style="vertical-align:top"><div style="font-size:11px;color:#4b5563">Portfolio Value</div><div style="font-size:18px;font-weight:700;color:' + _plColor(sdPL) + '">' + _fmtCur(sdC) + '</div><div style="font-size:11px;color:' + _plColor(sdPL) + ';font-weight:600">' + _plSign(sdPL) + sdPP.toFixed(1) + '% returns</div></td>';
        h += '</tr></tbody></table></div>';

        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px;margin-bottom:20px"><tbody>';
        h += '<tr style="background:#f3f4f6"><th style="' + _fThS + '">Stock Name</th><th style="' + _fThS + '">Symbol</th><th style="' + _fThR + '">Qty</th><th style="' + _fThR + '">Avg Price</th><th style="' + _fThR + '">LTP</th><th style="' + _fThR + '">Invested</th><th style="' + _fThR + '">Current</th><th style="' + _fThR + '">P&amp;L</th><th style="' + _fThR + '">Returns %</th></tr>';
        for (var shi = 0; shi < sdh.length; shi++) {
          var sk = sdh[shi], skI = parseFloat(sk.totalInvestment) || 0, skC = parseFloat(sk.currentValue) || 0;
          var skPL = parseFloat(sk.unrealizedPL) || (skC - skI), skPP = parseFloat(sk.unrealizedPLPct) || (skI > 0 ? (skPL / skI * 100) : 0);
          var skl = (shi === sdh.length - 1);
          h += '<tr' + (skl ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
          h += '<td style="' + _fTdS + '">' + _escHtml(sk.companyName) + '</td>';
          h += '<td style="' + _fTdMono + '">' + _escHtml(sk.symbol) + '</td>';
          h += '<td style="' + _fTdSecR + '">' + (parseFloat(sk.quantity) || 0) + '</td>';
          h += '<td style="' + _fTdSecR + '">\u20B9' + (parseFloat(sk.avgBuyPrice) || 0).toLocaleString('en-IN') + '</td>';
          h += '<td style="' + _fTdR + '">\u20B9' + (parseFloat(sk.currentPrice) || 0).toLocaleString('en-IN') + '</td>';
          h += '<td style="' + _fTdSecR + '">' + _fmtCur(skI) + '</td>';
          h += '<td style="' + _fTdR + '">' + _fmtCur(skC) + '</td>';
          h += '<td style="' + _fTdSecR + 'color:' + _plColor(skPL) + '">' + _plSign(skPL) + _fmtCur(Math.abs(skPL)) + '</td>';
          h += '<td style="' + _fTdBoldR + 'color:' + _plColor(skPL) + '">' + _plSign(skPL) + skPP.toFixed(1) + '%</td></tr>';
        }
        h += '</tbody></table>';
      }
      h += '</div>';
    }
    h += '</td></tr></tbody></table>';
  }

  // 7. BANK ACCOUNTS
  if (bankAccounts.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #2dd4bf;"><tbody><tr><td style="padding:20px">';
    h += '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:16px">Bank Accounts</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
    h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Member</th><th style="' + _thS + '">Bank Name</th><th style="' + _thS + '">Account Number</th><th style="' + _thS + '">Account Type</th><th style="' + _thS + '">Branch</th></tr>';
    for (var bi = 0; bi < bankAccounts.length; bi++) {
      var bk = bankAccounts[bi], bLast = (bi === bankAccounts.length - 1);
      var an = bk.accountNumber || ''; if (an.length > 4) an = 'XXXX-XXXX-' + an.slice(-4);
      h += '<tr' + (bLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
      h += '<td style="' + _tdS + '">' + _escHtml(bk.member) + '</td>';
      h += '<td style="' + _tdS + '">' + _escHtml(bk.bankName) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(an) + '</td>';
      h += '<td style="' + _tdSec + '">' + _escHtml(bk.accountType) + '</td>';
      h += '<td style="' + _tdSec + '">' + _escHtml(bk.branch) + '</td></tr>';
    }
    h += '</tbody></table></td></tr></tbody></table>';
  }

  // 8. INVESTMENT ACCOUNTS
  if (investmentAccounts.length > 0) {
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #818cf8;"><tbody><tr><td style="padding:20px">';
    h += '<div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:16px">Investment Accounts</div>';
    h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #d1d5db;border-radius:8px"><tbody>';
    h += '<tr style="background:#f3f4f6"><th style="' + _thS + '">Member</th><th style="' + _thS + '">Platform</th><th style="' + _thS + '">Account Type</th><th style="' + _thS + '">Account ID</th><th style="' + _thS + '">Email</th><th style="' + _thS + '">Phone</th></tr>';
    for (var iv = 0; iv < investmentAccounts.length; iv++) {
      var ia2 = investmentAccounts[iv], ivLast = (iv === investmentAccounts.length - 1);
      h += '<tr' + (ivLast ? '' : ' style="border-bottom:1px solid #d1d5db"') + '>';
      h += '<td style="' + _tdS + '">' + _escHtml(ia2.member) + '</td>';
      h += '<td style="' + _tdS + '">' + _escHtml(ia2.platform) + '</td>';
      h += '<td style="' + _tdSec + '">' + _escHtml(ia2.accountType) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(ia2.clientId) + '</td>';
      h += '<td style="' + _tdSec + '">' + _escHtml(ia2.email) + '</td>';
      h += '<td style="' + _tdMono + '">' + _escHtml(ia2.phone) + '</td></tr>';
    }
    h += '</tbody></table></td></tr></tbody></table>';
  }

  // 9. FOOTER
  h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="' + _card + 'border-left:4px solid #6366f1;"><tbody><tr><td style="padding:20px;text-align:center">';
  h += '<div style="font-size:12px;color:#6b7280;margin-bottom:8px">This report is auto-generated from your Google Sheets. Keep your financial data secure.</div>';
  h += '<div style="font-size:14px;color:#374151;font-weight:600">Made with &#10084;&#65039; in India by <strong>Jagadeesh Manne</strong> &middot; Donate: <strong>8977099970</strong> (GPay)</div>';
  h += '</td></tr></tbody></table>';

  h += '</td></tr></tbody></table></div>';
  return h;
}


// ============================================================================
// SIMPLE EMAIL BODY
// ============================================================================

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
  var eL = _getImageBase64('https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/logo-new.png');
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

function buildConsolidatedEmailBody(data, reportType) { return buildDashboardPDFHTML(data); }
function buildConsolidatedEmailBodyInlineStyles(data, reportType) { return buildDashboardPDFHTML(data); }

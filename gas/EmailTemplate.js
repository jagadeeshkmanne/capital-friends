/**
 * ============================================================================
 * EMAIL TEMPLATE - Build HTML Email Body with Tailwind CSS (for email)
 * and Inline CSS (for PDF)
 * ============================================================================
 * Creates consolidated wealth reports with light theme matching app dialogs
 */

/**
 * Member color palette (Tailwind colors)
 */
const MEMBER_COLORS = [
  { border: 'border-sky-400', name: 'text-sky-600', bg: 'bg-sky-50' },      // Sky Blue
  { border: 'border-rose-400', name: 'text-rose-600', bg: 'bg-rose-50' },   // Rose
  { border: 'border-purple-400', name: 'text-purple-600', bg: 'bg-purple-50' }, // Purple
  { border: 'border-emerald-400', name: 'text-emerald-600', bg: 'bg-emerald-50' }, // Emerald
  { border: 'border-orange-400', name: 'text-orange-600', bg: 'bg-orange-50' }, // Orange
  { border: 'border-cyan-400', name: 'text-cyan-600', bg: 'bg-cyan-50' }    // Cyan
];

/**
 * Member color palette (Inline styles for PDF)
 */
const MEMBER_COLORS_INLINE = [
  { border: '#38bdf8', name: '#0284c7', bg: '#f0f9ff' },  // Sky Blue
  { border: '#fb7185', name: '#e11d48', bg: '#fff1f2' },  // Rose
  { border: '#c084fc', name: '#9333ea', bg: '#faf5ff' },  // Purple
  { border: '#34d399', name: '#059669', bg: '#ecfdf5' },  // Emerald
  { border: '#fb923c', name: '#ea580c', bg: '#fff7ed' },  // Orange
  { border: '#22d3ee', name: '#0891b2', bg: '#ecfeff' }   // Cyan
];

/**
 * Build consolidated email body showing ALL family members
 * @param {Object} data - Consolidated family dashboard data from getConsolidatedFamilyDashboardData()
 * @param {string} reportType - 'daily', 'weekly', or 'manual'
 * @returns {string} HTML email body
 */
function buildConsolidatedEmailBody(data, reportType) {
  const greeting = getTimeBasedGreeting();
  const date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');

  // Build member sections (only for members with holdings)
  let memberSectionsHTML = '';
  data.membersData.forEach((memberData, index) => {
    const memberColor = MEMBER_COLORS[index % MEMBER_COLORS.length];
    memberSectionsHTML += buildMemberSection(memberData, memberColor);
  });

  // Build new sections
  const actionItemsHTML = buildActionItemsSection(data.questionnaireData);
  const insuranceHTML = buildInsurancePoliciesSection(data.insuranceData);
  const familyMembersHTML = buildFamilyMemberDetailsSection(data.familyMembers);
  const accountSummaryHTML = buildAccountSummarySection(data.bankAccounts, data.investmentAccounts);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    /* Ensure box styles work in all email clients */
    .box-card {
      background-color: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      margin-bottom: 1rem;
    }
  </style>
</head>
<body class="m-0 p-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 font-sans">

<div class="max-w-6xl mx-auto p-6">

  <!-- MAIN CONTAINER -->
  <div class="bg-white border border-gray-300 rounded-xl shadow-lg p-6">

    <!-- HEADER -->
    <div class="bg-white border-l-4 border-indigo-500 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-6 mb-6">
      <div class="flex items-center gap-6">
        <img src="/Users/jags/Desktop/cfv1/logo-main.png" alt="Capital Friends Logo" style="height:65px;width:auto;object-fit:contain;" onerror="this.outerHTML='<div style=\\'font-size:32px\\'>💰 <span style=\\'font-size:24px;font-weight:bold;color:#059669\\'>Capital Friends</span></div>';" />
        <div class="border-l-2 border-gray-300 pl-6 flex-1 text-center">
          <h2 class="text-xl font-bold text-gray-900 m-0 mb-1">Family Wealth Report</h2>
          <p class="text-sm text-gray-600 m-0">${greeting} · ${date}</p>
        </div>
        <div class="border-l-2 border-gray-300 pl-6 text-right flex-shrink-0">
          <p class="text-xs text-gray-500 m-0 mb-1">💝 Free Tool - Donations Welcome</p>
          <p class="text-base font-bold text-gray-900 m-0">Jagadeesh Manne</p>
          <p class="text-sm text-gray-600 m-0 mt-1">💰 UPI: jagadeeshmanne.hdfc@kphdfc</p>
        </div>
      </div>
    </div>

  ${buildFamilyWealthDashboard(data)}

  ${actionItemsHTML}

  ${insuranceHTML}

  ${memberSectionsHTML}

  ${familyMembersHTML}

  ${accountSummaryHTML}

    <!-- FOOTER -->
    <div class="bg-white border-l-4 border-indigo-500 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mt-8">
      <p class="text-xs text-gray-600 m-0 mb-3 text-center">
        🔒 This report is auto-generated from your Google Sheets. Keep your financial data secure.
      </p>
      <p class="text-sm text-gray-700 m-0 text-center font-semibold">
        Made with ❤️ in India by <strong>Jagadeesh Manne</strong> · 💝 Donate via UPI: <strong>jagadeeshmanne.hdfc@kphdfc</strong>
      </p>
    </div>

  </div>

</div>

</body>
</html>
  `.trim();
}

/**
 * Build Family Wealth Dashboard section (3 cards + asset allocation + insurance)
 */
function buildFamilyWealthDashboard(data) {
  const totalWealth = formatCurrency(data.familyTotals.totalWealth);
  const liabilities = formatCurrency(data.familyTotals.liabilities);
  const netWorth = formatCurrency(data.familyTotals.totalWealth - data.familyTotals.liabilities);

  // Net Worth and Asset Allocation with Pie Charts
  let chartsHTML = '';
  let chartsScript = '';

  // Net Worth Chart (Total Wealth vs Liabilities)
  const netWorthChartLabels = ['Total Wealth', 'Liabilities'];
  const netWorthChartData = [data.familyTotals.totalWealth, data.familyTotals.liabilities];
  const netWorthChartColors = ['#10b981', '#ef4444'];

  chartsHTML += `
    <div class="flex gap-6">
      <!-- Net Worth Breakdown -->
      <div class="flex-1 bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">Net Worth Breakdown</h3>
        <div class="flex items-start gap-4">
          <div class="w-32 h-32 flex-shrink-0">
            <canvas id="netWorthChart"></canvas>
          </div>
          <div class="flex flex-col gap-y-2 flex-1">
            <div>
              <div class="text-xs text-gray-500 uppercase">Total Wealth</div>
              <div class="text-lg font-bold text-emerald-600">${totalWealth}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase">Liabilities</div>
              <div class="text-lg font-bold text-red-600">${liabilities}</div>
            </div>
            <div class="pt-2 border-t border-gray-300">
              <div class="text-xs text-gray-500 uppercase">Net Worth</div>
              <div class="text-lg font-bold text-sky-600">${netWorth}</div>
            </div>
          </div>
        </div>
      </div>
  `;

  // Asset Allocation Chart
  if (data.assetAllocation && data.assetAllocation.breakdown) {
    const assetLabels = data.assetAllocation.breakdown.map(item => item.assetClass);
    const assetData = data.assetAllocation.breakdown.map(item => item.percentage);
    const assetColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];

    // Icon and color mapping for the 6 main asset classes
    const assetIconMap = {
      'Equity': { icon: '📈', bgColor: 'bg-emerald-50' },
      'Debt': { icon: '💰', bgColor: 'bg-blue-50' },
      'Commodities': { icon: '🥇', bgColor: 'bg-amber-50' },
      'Real Estate': { icon: '🏠', bgColor: 'bg-purple-50' },
      'Crypto': { icon: '₿', bgColor: 'bg-orange-50' },
      'Other': { icon: '💎', bgColor: 'bg-gray-50' }
    };

    const assetItems = data.assetAllocation.breakdown.map(item => {
      const assetInfo = assetIconMap[item.assetClass] || { icon: '💎', bgColor: 'bg-gray-50' };
      return `
      <div class="flex items-center justify-between py-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-sm">${assetInfo.icon}</span>
          <span style="font-size: 10px;" class="font-medium text-gray-600 uppercase">${item.assetClass}</span>
        </div>
        <span class="text-xs font-bold text-gray-900">${item.percentage.toFixed(1)}%</span>
      </div>
      `;
    }).join('');

    chartsHTML += `
      <!-- Asset Allocation -->
      <div class="flex-1 bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">Asset Allocation</h3>
        <div class="flex items-start gap-4">
          <div class="w-32 h-32 flex-shrink-0">
            <canvas id="assetChart"></canvas>
          </div>
          <div class="flex flex-col flex-1">
            ${assetItems}
          </div>
        </div>
      </div>
    `;

    chartsScript = `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          // Net Worth Chart
          const netWorthCtx = document.getElementById('netWorthChart');
          if (netWorthCtx) {
            new Chart(netWorthCtx, {
              type: 'doughnut',
              data: {
                labels: ${JSON.stringify(netWorthChartLabels)},
                datasets: [{
                  data: ${JSON.stringify(netWorthChartData)},
                  backgroundColor: ${JSON.stringify(netWorthChartColors)},
                  borderWidth: 2,
                  borderColor: '#ffffff'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        const value = context.parsed;
                        const crores = (value / 10000000).toFixed(2);
                        const lakhs = (value / 100000).toFixed(2);
                        return context.label + ': ₹' + (value >= 10000000 ? crores + ' Cr' : lakhs + ' L');
                      }
                    }
                  }
                }
              }
            });
          }

          // Asset Allocation Chart
          const assetCtx = document.getElementById('assetChart');
          if (assetCtx) {
            new Chart(assetCtx, {
              type: 'doughnut',
              data: {
                labels: ${JSON.stringify(assetLabels)},
                datasets: [{
                  data: ${JSON.stringify(assetData)},
                  backgroundColor: ${JSON.stringify(assetColors.slice(0, assetData.length))},
                  borderWidth: 2,
                  borderColor: '#ffffff'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        return context.label + ': ' + context.parsed + '%';
                      }
                    }
                  }
                }
              }
            });
          }
        });
      </script>
    `;
  }

  // Insurance Summary - add as third column inside the grid
  let insuranceHTML = '';
  if (data.familyTotals.termInsurance || data.familyTotals.healthInsurance) {
    const termCount = data.familyTotals.termInsurance?.count || 0;
    const termCover = formatCurrency(data.familyTotals.termInsurance?.totalCover || 0);
    const healthCount = data.familyTotals.healthInsurance?.count || 0;
    const healthCover = formatCurrency(data.familyTotals.healthInsurance?.totalCover || 0);

    insuranceHTML = `
      <!-- Insurance Coverage -->
      <div class="flex-1 bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">Insurance Coverage</h3>
        <div class="flex flex-col gap-3">
          <div class="flex items-start gap-3">
            <span class="text-xl">🛡️</span>
            <div class="flex-1">
              <div class="text-xs font-medium text-gray-500 uppercase mb-1">Term Insurance</div>
              <div class="text-sm font-bold text-gray-900">${termCount} ${termCount === 1 ? 'policy' : 'policies'}</div>
              <div class="text-xs text-gray-600">${termCover} cover</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-xl">🏥</span>
            <div class="flex-1">
              <div class="text-xs font-medium text-gray-500 uppercase mb-1">Health Insurance</div>
              <div class="text-sm font-bold text-gray-900">${healthCount} ${healthCount === 1 ? 'policy' : 'policies'}</div>
              <div class="text-xs text-gray-600">${healthCover} cover</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  chartsHTML += `
      ${insuranceHTML}
    </div>
  `;

  // Don't include Chart.js script in return (charts won't work in PDF anyway)
  return `
    <!-- FAMILY WEALTH DASHBOARD -->
    <div class="bg-white border-l-4 border-indigo-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">

      <!-- Section Title -->
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">📊 Family Wealth Dashboard</h2>

      <!-- 3-Column Grid: Net Worth + Asset Allocation + Insurance -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        ${chartsHTML}
      </div>

    </div>
  `;
}

/**
 * Build member section with all investment details
 */
function buildMemberSection(memberData, memberColor) {
  const mutualFundsHTML = buildMutualFundsSection(memberData.mutualFunds, memberData.memberName);
  const stocksHTML = buildStocksSection(memberData.stocks, memberData.memberName);
  const otherInvestmentsHTML = buildOtherInvestmentsSection(memberData.otherInvestments);
  const liabilitiesHTML = buildLiabilitiesSection(memberData.liabilities);

  // CRITICAL FIX: Only show member section if they have HOLDINGS (MF, Stocks, or Other Investments)
  // Liabilities alone don't count - member must have actual investments
  const hasHoldings = mutualFundsHTML || stocksHTML || otherInvestmentsHTML;

  if (!hasHoldings) {
    return '';
  }

  return `
    <!-- MEMBER SECTION -->
    <div class="bg-white border-l-4 ${memberColor.border} border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">

      <!-- Member Header -->
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <h2 class="text-lg font-bold ${memberColor.name} m-0">${memberData.memberName}</h2>
        <span class="text-sm font-medium text-gray-600">Investment Summary</span>
      </div>

      ${mutualFundsHTML}
      ${stocksHTML}
      ${otherInvestmentsHTML}
      ${liabilitiesHTML}

    </div>
  `;
}

/**
 * Build Mutual Funds section for a member
 */
function buildMutualFundsSection(mfData, memberName) {
  if (!mfData || !mfData.portfolios || mfData.portfolios.length === 0) {
    return '';
  }

  // Filter portfolios to only include those with invested > 0
  const activePortfolios = mfData.portfolios.filter(p => p.invested > 0);
  if (activePortfolios.length === 0) {
    return '';
  }

  let portfoliosHTML = '';

  activePortfolios.forEach(portfolio => {
    // Portfolio summary cards (5 cards)
    const summaryCardsHTML = `
      <div class="grid grid-cols-5 gap-3 mb-4">
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Invested</div>
          <div class="text-base font-bold text-gray-900">${formatCurrency(portfolio.invested)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Current</div>
          <div class="text-base font-bold text-gray-900">${formatCurrency(portfolio.current)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Unrealized</div>
          <div class="text-base font-bold ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.unrealizedPnL)}</div>
          <div class="text-xs ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${portfolio.unrealizedPnL >= 0 ? '+' : ''}${portfolio.unrealizedPnLPercent.toFixed(2)}%</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Realized</div>
          <div class="text-base font-bold ${portfolio.realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.realizedPnL)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Total P&L</div>
          <div class="text-base font-bold ${portfolio.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.totalPnL)}</div>
          <div class="text-xs ${portfolio.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%</div>
        </div>
      </div>
    `;

    // Asset Allocation + Market Cap (portfolio level)
    // CRITICAL FIX: Only show allocation if there's actual data in breakdown arrays
    let allocationHTML = '';
    const hasAssetData = portfolio.assetAllocation?.breakdown && portfolio.assetAllocation.breakdown.length > 0;
    const hasMarketCapData = portfolio.marketCapAllocation?.breakdown && portfolio.marketCapAllocation.breakdown.length > 0;

    if (hasAssetData || hasMarketCapData) {
      const assetItems = hasAssetData ? portfolio.assetAllocation.breakdown.map(item =>
        `<span class="text-xs text-gray-700">${item.assetClass}: ${item.percentage.toFixed(1)}%</span>`
      ).join(' · ') : '';

      const marketCapItems = hasMarketCapData ? portfolio.marketCapAllocation.breakdown.map(item =>
        `<span class="text-xs text-gray-700">${item.marketCap}: ${item.percentage.toFixed(1)}%</span>`
      ).join(' · ') : '';

      // Only render the allocation box if we have at least one type of data
      if (assetItems || marketCapItems) {
        allocationHTML = `
          <div class="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            ${assetItems ? `<div class="mb-1"><span class="text-xs font-semibold text-gray-800">Asset:</span> ${assetItems}</div>` : ''}
            ${marketCapItems ? `<div><span class="text-xs font-semibold text-gray-800">Market Cap:</span> ${marketCapItems}</div>` : ''}
          </div>
        `;
      }
    }

    // Funds table
    let fundsTableHTML = '';
    if (portfolio.funds && portfolio.funds.length > 0) {
      const fundsRows = portfolio.funds.map(fund => `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
          <td class="py-1.5 px-2 text-gray-900">${fund.schemeName}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(fund.invested)}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(fund.current)}</td>
          <td class="py-1.5 px-2 text-right font-medium ${fund.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(fund.pnl)}</td>
          <td class="py-1.5 px-2 text-right ${fund.pnlPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}">${fund.pnlPercent >= 0 ? '+' : ''}${fund.pnlPercent.toFixed(2)}%</td>
          <td class="py-1.5 px-2 text-right ${fund.rebalanceSip >= 0 ? 'text-emerald-700' : 'text-red-700'} font-semibold">${fund.rebalanceSip ? (fund.rebalanceSip >= 0 ? '+' : '') + formatCurrency(fund.rebalanceSip) : '—'}</td>
          <td class="py-1.5 px-2 text-right ${fund.buySell >= 0 ? 'text-emerald-700' : 'text-red-700'} font-semibold">${fund.buySell ? (fund.buySell >= 0 ? '+' : '') + formatCurrency(fund.buySell) : '—'}</td>
        </tr>
      `).join('');

      fundsTableHTML = `
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-gray-100">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Fund Name</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Invested</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Current</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">P&L</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">P&L %</th>
                <th class="py-1.5 px-2 font-semibold text-emerald-700 text-right bg-emerald-50" style="font-size: 11px;">Rebalance SIP ₹</th>
                <th class="py-1.5 px-2 font-semibold text-orange-700 text-right bg-orange-50" style="font-size: 11px;">Buy/Sell ₹</th>
              </tr>
            </thead>
            <tbody>
              ${fundsRows}
            </tbody>
          </table>
        </div>
      `;
    }

    portfoliosHTML += `
      <div class="mb-4 bg-gray-50 border-l-4 border-gray-300 border-t border-r border-b border-gray-100 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-gray-800 m-0">📁 ${portfolio.portfolioName}</h4>
          ${portfolio.clientId ? `<span class="text-xs text-gray-500 font-mono">Client ID: ${portfolio.clientId}</span>` : ''}
        </div>
        ${summaryCardsHTML}
        ${allocationHTML}
        ${fundsTableHTML}
      </div>
    `;
  });

  return `
    <!-- MUTUAL FUNDS -->
    <div class="mb-5">
      <h3 class="text-base font-semibold text-gray-800 mb-3 m-0">📊 Mutual Funds</h3>
      ${portfoliosHTML}
    </div>
  `;
}

/**
 * Build Stocks section for a member
 */
function buildStocksSection(stocksData, memberName) {
  if (!stocksData || !stocksData.portfolios || stocksData.portfolios.length === 0) {
    return '';
  }

  // Filter portfolios to only include those with invested > 0
  const activePortfolios = stocksData.portfolios.filter(p => p.invested > 0);
  if (activePortfolios.length === 0) {
    return '';
  }

  let portfoliosHTML = '';

  activePortfolios.forEach(portfolio => {
    // Portfolio summary cards (5 cards)
    const summaryCardsHTML = `
      <div class="grid grid-cols-5 gap-3 mb-4">
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Invested</div>
          <div class="text-base font-bold text-gray-900">${formatCurrency(portfolio.invested)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Current</div>
          <div class="text-base font-bold text-gray-900">${formatCurrency(portfolio.current)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Unrealized</div>
          <div class="text-base font-bold ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.unrealizedPnL)}</div>
          <div class="text-xs ${portfolio.unrealizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${portfolio.unrealizedPnL >= 0 ? '+' : ''}${portfolio.unrealizedPnLPercent.toFixed(2)}%</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Realized</div>
          <div class="text-base font-bold ${portfolio.realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.realizedPnL)}</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <div class="text-xs text-gray-600 mb-1">Total P&L</div>
          <div class="text-base font-bold ${portfolio.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(portfolio.totalPnL)}</div>
          <div class="text-xs ${portfolio.totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}">${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%</div>
        </div>
      </div>
    `;

    // Holdings table
    let holdingsTableHTML = '';
    if (portfolio.holdings && portfolio.holdings.length > 0) {
      const holdingsRows = portfolio.holdings.map(holding => `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
          <td class="py-1.5 px-2 text-gray-900">${holding.stockName}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${holding.quantity}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(holding.avgPrice)}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(holding.ltp)}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(holding.invested)}</td>
          <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(holding.current)}</td>
          <td class="py-1.5 px-2 text-right font-medium ${holding.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(holding.pnl)}</td>
          <td class="py-1.5 px-2 text-right ${holding.pnlPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}">${holding.pnlPercent >= 0 ? '+' : ''}${holding.pnlPercent.toFixed(2)}%</td>
        </tr>
      `).join('');

      holdingsTableHTML = `
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-gray-100">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Stock</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Qty</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Avg Price</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">LTP</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Invested</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Current</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">P&L</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">P&L %</th>
              </tr>
            </thead>
            <tbody>
              ${holdingsRows}
            </tbody>
          </table>
        </div>
      `;
    }

    portfoliosHTML += `
      <div class="mb-4 bg-gray-50 border-l-4 border-gray-300 border-t border-r border-b border-gray-100 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-gray-800 m-0">📁 ${portfolio.portfolioName}</h4>
          ${portfolio.clientId ? `<span class="text-xs text-gray-500 font-mono">Client ID: ${portfolio.clientId}</span>` : ''}
        </div>
        ${summaryCardsHTML}
        ${holdingsTableHTML}
      </div>
    `;
  });

  return `
    <!-- STOCKS -->
    <div class="mb-5">
      <h3 class="text-base font-semibold text-gray-800 mb-3 m-0">📈 Stocks</h3>
      ${portfoliosHTML}
    </div>
  `;
}

/**
 * Build Other Investments section for a member
 */
function buildOtherInvestmentsSection(otherData) {
  if (!otherData || !otherData.investments || otherData.investments.length === 0) {
    return '';
  }

  const investmentRows = otherData.investments.map(inv => `
    <tr class="border-b border-gray-200 hover:bg-gray-50">
      <td class="py-1.5 px-2 text-gray-900">${inv.investmentType}</td>
      <td class="py-1.5 px-2 text-gray-700">${inv.description || '-'}</td>
      <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(inv.amount)}</td>
    </tr>
  `).join('');

  const totalAmount = otherData.investments.reduce((sum, inv) => sum + inv.amount, 0);

  return `
    <!-- OTHER INVESTMENTS -->
    <div class="mb-5">
      <h3 class="text-base font-semibold text-gray-800 mb-3 m-0">💎 Other Investments</h3>
      <div class="mb-4 bg-gray-50 border-l-4 border-gray-300 border-t border-r border-b border-gray-100 rounded-lg p-4">
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-gray-100">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Description</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${investmentRows}
              <tr class="bg-gray-50 font-semibold">
                <td colspan="2" class="py-1.5 px-2 text-gray-900">Total</td>
                <td class="py-1.5 px-2 text-right text-gray-900">${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build Liabilities section for a member
 */
function buildLiabilitiesSection(liabilitiesData) {
  if (!liabilitiesData || !liabilitiesData.liabilities || liabilitiesData.liabilities.length === 0) {
    return '';
  }

  const liabilityRows = liabilitiesData.liabilities.map(liab => `
    <tr class="border-b border-gray-200 hover:bg-gray-50">
      <td class="py-1.5 px-2 text-gray-900">${liab.liabilityType}</td>
      <td class="py-1.5 px-2 text-gray-700">${liab.description || '-'}</td>
      <td class="py-1.5 px-2 text-right text-gray-700">${formatCurrency(liab.outstandingAmount)}</td>
    </tr>
  `).join('');

  const totalAmount = liabilitiesData.liabilities.reduce((sum, liab) => sum + liab.outstandingAmount, 0);

  return `
    <!-- LIABILITIES -->
    <div class="mb-5">
      <h3 class="text-base font-semibold text-gray-800 mb-3 m-0">💳 Liabilities</h3>
      <div class="mb-4 bg-gray-50 border-l-4 border-gray-300 border-t border-r border-b border-gray-100 rounded-lg p-4">
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-gray-100">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Description</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              ${liabilityRows}
              <tr class="bg-gray-50 font-semibold">
                <td colspan="2" class="py-1.5 px-2 text-gray-900">Total</td>
                <td class="py-1.5 px-2 text-right text-gray-900">${formatCurrency(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get time-based greeting
 */
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Format currency (Indian format)
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';

  const absAmount = Math.abs(amount);
  let formatted = '';

  if (absAmount >= 10000000) { // >= 1 Crore
    formatted = '₹' + (absAmount / 10000000).toFixed(2) + ' Cr';
  } else if (absAmount >= 100000) { // >= 1 Lakh
    formatted = '₹' + (absAmount / 100000).toFixed(2) + ' L';
  } else if (absAmount >= 1000) { // >= 1 Thousand
    formatted = '₹' + (absAmount / 1000).toFixed(2) + ' K';
  } else {
    formatted = '₹' + absAmount.toFixed(2);
  }

  return amount < 0 ? '-' + formatted : formatted;
}

/**
 * Build Action Items & Recommendations section based on questionnaire
 * @param {Object} questionnaireData - Data from getQuestionnaireData()
 * @returns {string} HTML for action items section
 */
function buildActionItemsSection(questionnaireData) {
  if (!questionnaireData || !questionnaireData.hasData || questionnaireData.answers.length === 0) {
    return '';
  }

  // Find all "No" answers to show as action items
  const actionItems = questionnaireData.answers.filter(item => item.answer === 'No');

  if (actionItems.length === 0) {
    // All "Yes" - show congratulatory message
    return `
    <!-- ACTION ITEMS & RECOMMENDATIONS -->
    <div class="bg-white border-l-4 border-emerald-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">✅ Financial Health Check - Excellent!</h2>
      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p class="text-sm text-emerald-800 m-0">🎉 Congratulations! You've answered "Yes" to all ${questionnaireData.totalQuestions} financial health questions. Your family's financial foundation is strong!</p>
      </div>
    </div>
    `;
  }

  // Action item icon and color mapping based on question number
  const actionMapping = {
    1: { icon: '👨‍👩‍👧‍👦', color: 'bg-red-50 border-red-200', title: 'Family Awareness Missing', severity: 'critical' },
    2: { icon: '🏥', color: 'bg-orange-50 border-orange-200', title: 'Health Insurance Gap', severity: 'critical' },
    3: { icon: '🛡️', color: 'bg-red-50 border-red-200', title: 'Term Insurance Missing', severity: 'critical' },
    4: { icon: '📜', color: 'bg-orange-50 border-orange-200', title: 'Will Not Created', severity: 'important' },
    5: { icon: '👤', color: 'bg-yellow-50 border-yellow-200', title: 'Nominees Not Updated', severity: 'important' },
    6: { icon: '💰', color: 'bg-amber-50 border-amber-200', title: 'Emergency Fund Missing', severity: 'critical' },
    7: { icon: '📁', color: 'bg-blue-50 border-blue-200', title: 'Documents Not Organized', severity: 'recommended' },
    8: { icon: '🔐', color: 'bg-purple-50 border-purple-200', title: 'Access Not Shared', severity: 'important' }
  };

  const actionCardsHTML = actionItems.map(item => {
    const mapping = actionMapping[item.questionNumber] || { icon: '⚠️', color: 'bg-gray-50 border-gray-200', title: 'Action Required', severity: 'recommended' };

    return `
      <div class="border ${mapping.color} rounded-lg p-4 mb-3">
        <div class="flex items-start gap-3">
          <span class="text-2xl">${mapping.icon}</span>
          <div class="flex-1">
            <h4 class="text-sm font-bold text-gray-900 m-0 mb-1">${mapping.title}</h4>
            <p class="text-xs text-gray-700 m-0 mb-2">${item.questionText}</p>
            <p class="text-xs text-gray-600 m-0 italic">💡 Recommendation: ${getRecommendation(item.questionNumber)}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const score = questionnaireData.yesCount;
  const total = questionnaireData.totalQuestions;
  const scoreColor = score >= 6 ? 'text-emerald-600' : (score >= 4 ? 'text-amber-600' : 'text-red-600');

  return `
    <!-- ACTION ITEMS & RECOMMENDATIONS -->
    <div class="bg-white border-l-4 border-amber-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">⚠️ Action Items & Recommendations</h2>
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        ${actionCardsHTML}
        <div class="mt-4 pt-3 border-t border-gray-300 text-center">
          <span class="text-xs text-gray-600">Financial Health Score: </span>
          <span class="text-base font-bold ${scoreColor}">${score}/${total}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get recommendation text for each question
 */
function getRecommendation(questionNumber) {
  const recommendations = {
    1: 'Schedule a family meeting to discuss financial accounts and share account details with your spouse.',
    2: 'Get family floater health insurance with adequate coverage (₹10L+ per person) from a reputable insurer.',
    3: 'Purchase term life insurance with coverage 15-20x of annual income to protect your family financially.',
    4: 'Consult a lawyer to draft a legal Will to ensure smooth asset transfer and avoid family disputes.',
    5: 'Update nominees in all bank accounts, investments, and insurance policies. Keep nomination documents updated.',
    6: 'Build emergency fund covering 6-12 months of expenses in a liquid savings account or liquid fund.',
    7: 'Organize all financial documents (insurance, deeds, accounts) in a secure physical and digital folder.',
    8: 'Share account access details (logins, passwords) with a trusted family member in a secure manner.'
  };
  return recommendations[questionNumber] || 'Take necessary action to improve your financial security.';
}

/**
 * Build Insurance Policies section showing Term and Health insurance
 * @param {Object} insuranceData - Data from getAllInsurancePoliciesDetailed()
 * @returns {string} HTML for insurance policies section
 */
function buildInsurancePoliciesSection(insuranceData) {
  if (!insuranceData || insuranceData.totalPolicies === 0) {
    return '';
  }

  const hasTermInsurance = insuranceData.termInsurance && insuranceData.termInsurance.length > 0;
  const hasHealthInsurance = insuranceData.healthInsurance && insuranceData.healthInsurance.length > 0;

  if (!hasTermInsurance && !hasHealthInsurance) {
    return '';
  }

  let termTableHTML = '';
  if (hasTermInsurance) {
    const termRows = insuranceData.termInsurance.map(policy => `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="py-1.5 px-2 text-gray-900">${policy.member}</td>
        <td class="py-1.5 px-2 text-gray-700">${policy.provider}</td>
        <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${policy.policyNumber || '—'}</td>
        <td class="py-1.5 px-2 text-gray-700">${policy.policyType}</td>
        <td class="py-1.5 px-2 text-right font-semibold text-gray-900">${formatCurrency(policy.sumAssured)}</td>
        <td class="py-1.5 px-2 text-right text-gray-700">${policy.premium || '—'}</td>
        <td class="py-1.5 px-2 text-center text-gray-700">${policy.maturityDate || '—'}</td>
        <td class="py-1.5 px-2 text-center">
          <span class="text-xs px-2 py-0.5 rounded ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}">${policy.status}</span>
        </td>
      </tr>
    `).join('');

    termTableHTML = `
      <div class="mb-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">🛡️ Term Life Insurance</h3>
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-indigo-50">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Member</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Provider</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Policy No.</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Policy Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Sum Assured</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Annual Premium</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-center" style="font-size: 11px;">Maturity Date</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-center" style="font-size: 11px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${termRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  let healthTableHTML = '';
  if (hasHealthInsurance) {
    const healthRows = insuranceData.healthInsurance.map(policy => `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="py-1.5 px-2 text-gray-900">${policy.member}</td>
        <td class="py-1.5 px-2 text-gray-700">${policy.provider}</td>
        <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${policy.policyNumber || '—'}</td>
        <td class="py-1.5 px-2 text-gray-700">${policy.policyType}</td>
        <td class="py-1.5 px-2 text-right font-semibold text-gray-900">${formatCurrency(policy.sumAssured)}</td>
        <td class="py-1.5 px-2 text-right text-gray-700">${policy.premium || '—'}</td>
        <td class="py-1.5 px-2 text-center text-gray-700">${policy.renewalDate || '—'}</td>
        <td class="py-1.5 px-2 text-center">
          <span class="text-xs px-2 py-0.5 rounded ${policy.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}">${policy.status}</span>
        </td>
      </tr>
    `).join('');

    healthTableHTML = `
      <div class="mb-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">🏥 Health Insurance</h3>
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-emerald-50">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Member</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Provider</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Policy No.</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Policy Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Sum Assured</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-right" style="font-size: 11px;">Annual Premium</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-center" style="font-size: 11px;">Renewal Date</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-center" style="font-size: 11px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${healthRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `
    <!-- INSURANCE POLICIES -->
    <div class="bg-white border-l-4 border-indigo-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">🛡️ Insurance Policies Overview</h2>
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        ${termTableHTML}
        ${healthTableHTML}
      </div>
    </div>
  `;
}

/**
 * Build Family Member Details section
 * @param {Array} familyMembers - Data from getAllFamilyMembersForReport()
 * @returns {string} HTML for family member details section
 */
function buildFamilyMemberDetailsSection(familyMembers) {
  if (!familyMembers || familyMembers.length === 0) {
    return '';
  }

  const memberRows = familyMembers.map(member => {
    // Mask Aadhar number for privacy (show only last 4 digits)
    const maskedAadhar = member.aadharNumber ? 'XXXX-XXXX-' + member.aadharNumber.slice(-4) : '—';

    return `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="py-1.5 px-2 font-medium text-gray-900">${member.memberName}</td>
        <td class="py-1.5 px-2 text-gray-700">${member.relationship}</td>
        <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${maskedAadhar}</td>
        <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${member.panNumber || '—'}</td>
        <td class="py-1.5 px-2 text-center text-gray-700">${member.dateOfBirth || '—'}</td>
        <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${member.mobileNumber || '—'}</td>
        <td class="py-1.5 px-2 text-gray-700 text-xs">${member.emailAddress || '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <!-- FAMILY MEMBER DETAILS -->
    <div class="bg-white border-l-4 border-purple-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">👨‍👩‍👧‍👦 Family Member Details</h2>
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-purple-50">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Member Name</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Relationship</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Aadhar Number</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">PAN Number</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-center" style="font-size: 11px;">Date of Birth</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Mobile</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Email</th>
              </tr>
            </thead>
            <tbody>
              ${memberRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Build Account Summary section (Bank + Investment Accounts)
 * @param {Array} bankAccounts - Data from getAllBankAccountsForReport()
 * @param {Array} investmentAccounts - Data from getAllInvestmentAccountsForReport()
 * @returns {string} HTML for account summary section
 */
function buildAccountSummarySection(bankAccounts, investmentAccounts) {
  const hasBankAccounts = bankAccounts && bankAccounts.length > 0;
  const hasInvestmentAccounts = investmentAccounts && investmentAccounts.length > 0;

  if (!hasBankAccounts && !hasInvestmentAccounts) {
    return '';
  }

  let bankTableHTML = '';
  if (hasBankAccounts) {
    const bankRows = bankAccounts.map(account => {
      // Mask account number (show only last 4 digits)
      const maskedAccountNumber = account.accountNumber ? 'XXXX-' + account.accountNumber.slice(-4) : '—';

      return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
          <td class="py-1.5 px-2 text-gray-900">${account.member}</td>
          <td class="py-1.5 px-2 text-gray-700">${account.bankName}</td>
          <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${maskedAccountNumber}</td>
          <td class="py-1.5 px-2 text-gray-700">${account.accountType}</td>
          <td class="py-1.5 px-2 text-gray-700">${account.branch || '—'}</td>
        </tr>
      `;
    }).join('');

    bankTableHTML = `
      <div class="mb-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">🏦 Bank Accounts</h3>
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-teal-50">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Member</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Bank Name</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Account Number</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Account Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Branch</th>
              </tr>
            </thead>
            <tbody>
              ${bankRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  let investmentTableHTML = '';
  if (hasInvestmentAccounts) {
    const investmentRows = investmentAccounts.map(account => {
      return `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
          <td class="py-1.5 px-2 text-gray-900">${account.member}</td>
          <td class="py-1.5 px-2 text-gray-700">${account.platform}</td>
          <td class="py-1.5 px-2 text-gray-700">${account.accountType}</td>
          <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${account.accountId || account.clientId || '—'}</td>
          <td class="py-1.5 px-2 text-gray-700 text-xs">${account.emailAddress || '—'}</td>
          <td class="py-1.5 px-2 text-gray-700 font-mono text-xs">${account.phoneNumber || '—'}</td>
        </tr>
      `;
    }).join('');

    investmentTableHTML = `
      <div class="mb-4">
        <h3 class="text-sm font-semibold text-gray-800 mb-3 m-0">📈 Investment Accounts</h3>
        <div class="overflow-x-auto">
          <table class="w-full border border-gray-200 rounded" style="font-size: 12px;">
            <thead class="bg-blue-50">
              <tr>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Member</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Platform</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Account Type</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Account ID</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Email</th>
                <th class="py-1.5 px-2 font-semibold text-gray-800 text-left" style="font-size: 11px;">Phone</th>
              </tr>
            </thead>
            <tbody>
              ${investmentRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `
    <!-- ACCOUNT SUMMARY -->
    <div class="bg-white border-l-4 border-teal-400 border-t border-r border-b border-gray-100 rounded-lg shadow-sm p-5 mb-6">
      <h2 class="text-base font-bold text-gray-900 mb-4 m-0">💳 Account Summary</h2>
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        ${bankTableHTML}
        ${investmentTableHTML}
      </div>
    </div>
  `;
}

// ============================================================================
// INLINE STYLES VERSIONS (FOR PDF)
// ============================================================================

/**
 * Build consolidated email body with INLINE STYLES (for PDF generation)
 * @param {Object} data - Consolidated family dashboard data from getConsolidatedFamilyDashboardData()
 * @param {string} reportType - 'daily', 'weekly', or 'manual'
 * @returns {string} HTML email body with inline CSS
 */
function buildConsolidatedEmailBodyInlineStyles(data, reportType) {
  const greeting = getTimeBasedGreeting();
  const date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');

  // Build member sections (only for members with holdings)
  let memberSectionsHTML = '';
  data.membersData.forEach((memberData, index) => {
    const memberColor = MEMBER_COLORS_INLINE[index % MEMBER_COLORS_INLINE.length];
    memberSectionsHTML += buildMemberSectionInlineStyles(memberData, memberColor);
  });

  // Build new sections
  const actionItemsHTML = buildActionItemsSectionInlineStyles(data.questionnaireData);
  const insuranceHTML = buildInsurancePoliciesSectionInlineStyles(data.insuranceData);
  const familyMembersHTML = buildFamilyMemberDetailsSectionInlineStyles(data.familyMembers);
  const accountSummaryHTML = buildAccountSummarySectionInlineStyles(data.bankAccounts, data.investmentAccounts);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #EBF4FF 0%, #E0E7FF 50%, #F3E8FF 100%);
      padding: 32px;
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
    }
    .container { max-width: 1152px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; font-size: 12px; }
    thead { background: #f3f4f6; }
    th { padding: 6px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 11px; border-bottom: 1px solid #d1d5db; }
    td { padding: 6px 8px; color: #4b5563; border-bottom: 1px solid #e5e7eb; }
    tr:hover { background: #f9fafb; }
  </style>
</head>
<body>

<div class="container">
  <!-- MAIN CONTAINER -->
  <div style="background: white; border: 1px solid #d1d5db; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); padding: 24px;">

    <!-- DEVELOPER CREDIT SECTION -->
    <div style="background: linear-gradient(90deg, #EEF2FF 0%, #F3E8FF 50%, #FCE7F3 100%); border-left: 4px solid #6366f1; border-top: 1px solid #d1d5db; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
        <td style="border: none; padding: 0; width: 80px; vertical-align: middle;">
          <div style="font-size: 32px;">💰 <span style="font-size: 24px; font-weight: 700; color: #059669;">Capital Friends</span></div>
        </td>
        <td style="border: none; padding: 0; text-align: right; vertical-align: middle;">
          <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">
            🔒 This report is auto-generated from your Google Sheets. Keep your financial data secure.
          </div>
          <div style="font-size: 14px; color: #374151; font-weight: 600;">
            Made with ❤️ in India by <strong>Jagadeesh Manne</strong> · 💝 Donate via UPI: <strong>jagadeeshmanne.hdfc@kphdfc</strong>
          </div>
        </td>
      </tr></table>
    </div>

    ${buildFamilyWealthDashboardInlineStyles(data)}

    ${actionItemsHTML}

    ${insuranceHTML}

    ${memberSectionsHTML}

    ${familyMembersHTML}

    ${accountSummaryHTML}

  </div>
  <!-- END MAIN CONTAINER -->

</div>

</body>
</html>
  `.trim();
}

/**
 * Build Family Wealth Dashboard with inline styles
 * MATCHES preview HTML: 2-column layout (Net Worth + Asset Allocation)
 */
function buildFamilyWealthDashboardInlineStyles(data) {
  const totalWealth = formatCurrency(data.familyTotals.totalWealth);
  const liabilities = formatCurrency(data.familyTotals.liabilities);
  const netWorth = formatCurrency(data.familyTotals.totalWealth - data.familyTotals.liabilities);

  // Column 1: Net Worth Breakdown with chart placeholder
  const column1HTML = `
    <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px;">
      <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">Net Worth Breakdown</div>
      <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
        <td style="border: none; padding: 0; width: 160px; vertical-align: top;">
          <div style="width: 160px; height: 160px; background: #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-top: 8px;">
            <div style="text-align: center; color: #9ca3af; font-size: 11px;">Chart<br/>Placeholder</div>
          </div>
        </td>
        <td style="border: none; padding: 0 0 0 24px; vertical-align: top;">
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Total Wealth</div>
            <div style="font-size: 18px; font-weight: 700; color: #10b981;">${totalWealth}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Liabilities</div>
            <div style="font-size: 18px; font-weight: 700; color: #dc2626;">${liabilities}</div>
          </div>
          <div style="padding-top: 8px; border-top: 1px solid #d1d5db;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Net Worth</div>
            <div style="font-size: 20px; font-weight: 700; color: #0ea5e9;">${netWorth}</div>
          </div>
        </td>
      </tr></table>
    </div>
  `;

  // Column 2: Asset Allocation with chart placeholder
  let column2HTML = '';
  if (data.assetAllocation && data.assetAllocation.breakdown && data.assetAllocation.breakdown.length > 0) {
    const assetIconMap = {
      'Equity': '📈',
      'Debt': '💰',
      'Commodities': '🥇',
      'Real Estate': '🏠',
      'Crypto': '₿',
      'Other': '💎'
    };

    const assetItems = data.assetAllocation.breakdown.map(item => {
      const icon = assetIconMap[item.assetClass] || '💎';
      return `
        <div style="padding: 6px 0;">
          <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
            <td style="border: none; padding: 0; text-align: left;">
              <span style="font-size: 16px;">${icon}</span>
              <span style="font-size: 12px; font-weight: 500; color: #4b5563; text-transform: uppercase; margin-left: 8px;">${item.assetClass}</span>
            </td>
            <td style="border: none; padding: 0; text-align: right;">
              <span style="font-size: 14px; font-weight: 700; color: #111827;">${item.percentage.toFixed(1)}%</span>
            </td>
          </tr></table>
        </div>
      `;
    }).join('');

    column2HTML = `
      <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px;">
        <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">Asset Allocation</div>
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
          <td style="border: none; padding: 0; width: 160px; vertical-align: top;">
            <div style="width: 160px; height: 160px; background: #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-top: 8px;">
              <div style="text-align: center; color: #9ca3af; font-size: 11px;">Chart<br/>Placeholder</div>
            </div>
          </td>
          <td style="border: none; padding: 0 0 0 24px; vertical-align: top;">
            ${assetItems}
          </td>
        </tr></table>
      </div>
    `;
  }

  // Build 2-column dashboard using table layout for PDF compatibility
  const columnsHTML = `
    <table style="width: 100%; border: none; border-collapse: separate; border-spacing: 24px; margin: 0;">
      <tr>
        <td style="border: none; padding: 0; width: 50%; vertical-align: top;">${column1HTML}</td>
        ${column2HTML ? `<td style="border: none; padding: 0; width: 50%; vertical-align: top;">${column2HTML}</td>` : ''}
      </tr>
    </table>
  `;

  return `
    <div style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #f3f4f6; border-right: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 20px; margin-bottom: 24px;">
      <table style="width: 100%; border: none; margin: 0 0 16px 0; border-collapse: collapse;"><tr>
        <td style="border: none; padding: 0; text-align: left;">
          <div style="font-size: 16px; font-weight: 700; color: #111827;">📊 Family Wealth Dashboard</div>
        </td>
        <td style="border: none; padding: 0; text-align: right;">
          <div style="font-size: 12px; color: #6b7280;">Generated on: ${Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a')}</div>
        </td>
      </tr></table>
      ${columnsHTML}
    </div>
  `;
}

/**
 * Build Insurance Summary section (separate from dashboard) - inline styles
 */
function buildInsuranceSummarySectionInlineStyles(familyTotals) {
  if (!familyTotals.termInsurance && !familyTotals.healthInsurance) {
    return '';
  }

  const termCount = familyTotals.termInsurance?.count || 0;
  const termCover = formatCurrency(familyTotals.termInsurance?.totalCover || 0);
  const healthCount = familyTotals.healthInsurance?.count || 0;
  const healthCover = formatCurrency(familyTotals.healthInsurance?.totalCover || 0);

  let termHTML = '';
  if (termCount > 0) {
    termHTML = `
      <div style="margin-bottom: 12px;">
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
          <td style="border: none; padding: 0; width: 40px; vertical-align: top;"><span style="font-size: 24px;">🛡️</span></td>
          <td style="border: none; padding: 0;">
            <div style="font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Term Insurance</div>
            <div style="font-size: 16px; font-weight: 700; color: #111827;">${termCount} ${termCount === 1 ? 'policy' : 'policies'}</div>
            <div style="font-size: 13px; color: #6b7280;">${termCover} cover</div>
          </td>
        </tr></table>
      </div>
    `;
  }

  let healthHTML = '';
  if (healthCount > 0) {
    healthHTML = `
      <div>
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
          <td style="border: none; padding: 0; width: 40px; vertical-align: top;"><span style="font-size: 24px;">🏥</span></td>
          <td style="border: none; padding: 0;">
            <div style="font-size: 12px; font-weight: 500; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Health Insurance</div>
            <div style="font-size: 16px; font-weight: 700; color: #111827;">${healthCount} ${healthCount === 1 ? 'policy' : 'policies'}</div>
            <div style="font-size: 13px; color: #6b7280;">${healthCover} cover</div>
          </td>
        </tr></table>
      </div>
    `;
  }

  return `
    <div style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">🛡️ Insurance Coverage</div>
      <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px;">
        ${termHTML}
        ${healthHTML}
      </div>
    </div>
  `;
}

/**
 * Build Action Items section with inline styles
 * MATCHES preview HTML: Colored borders matching severity (red, orange, yellow, blue, purple)
 */
function buildActionItemsSectionInlineStyles(questionnaireData) {
  if (!questionnaireData || !questionnaireData.hasData || questionnaireData.answers.length === 0) {
    return '';
  }

  const actionItems = questionnaireData.answers.filter(item => item.answer === 'No');

  if (actionItems.length === 0) {
    return `
    <div style="background: white; border-left: 4px solid #34d399; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">✅ Financial Health Check - Excellent!</div>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px;">
        <p style="font-size: 14px; color: #065f46;">🎉 Congratulations! You have answered "Yes" to all ${questionnaireData.totalQuestions} financial health questions.</p>
      </div>
    </div>
    `;
  }

  // Color mapping matching preview HTML exactly
  const actionMapping = {
    3: { icon: '🛡️', bgColor: '#fef2f2', borderColor: '#ef4444', textColor: '#7f1d1d', title: 'Missing Term Life Insurance' },
    2: { icon: '🏥', bgColor: '#fff7ed', borderColor: '#f97316', textColor: '#7c2d12', title: 'Inadequate Health Insurance' },
    4: { icon: '📜', bgColor: '#fefce8', borderColor: '#eab308', textColor: '#713f12', title: 'Legal Will Not Created' },
    5: { icon: '👤', bgColor: '#fefce8', borderColor: '#eab308', textColor: '#713f12', title: 'Nominees Not Added' },
    6: { icon: '💰', bgColor: '#fef3c7', borderColor: '#f59e0b', textColor: '#78350f', title: 'Emergency Fund Missing' },
    1: { icon: '👨‍👩‍👧‍👦', bgColor: '#eff6ff', borderColor: '#3b82f6', textColor: '#1e3a8a', title: 'Family Not Aware of Accounts' },
    7: { icon: '📁', bgColor: '#eef2ff', borderColor: '#6366f1', textColor: '#312e81', title: 'Important Documents Not Organized' },
    8: { icon: '🔑', bgColor: '#faf5ff', borderColor: '#a855f7', textColor: '#581c87', title: 'Access Details Not Shared' }
  };

  const actionCardsHTML = actionItems.map(item => {
    const mapping = actionMapping[item.questionNumber] || { icon: '⚠️', bgColor: '#f9fafb', borderColor: '#d1d5db', textColor: '#1f2937', title: 'Action Required' };

    return `
      <div style="border-left: 4px solid ${mapping.borderColor}; background: ${mapping.bgColor}; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
        <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;"><tr>
          <td style="border: none; padding: 0; width: 40px; vertical-align: top;"><span style="font-size: 20px;">${mapping.icon}</span></td>
          <td style="border: none; padding: 0;">
            <div style="font-size: 14px; font-weight: 700; color: ${mapping.textColor}; margin-bottom: 4px;">${mapping.title}</div>
            <div style="font-size: 12px; color: ${mapping.textColor}; margin-bottom: 8px;">${item.questionText}</div>
            <div style="font-size: 11px; color: ${mapping.textColor}; background: rgba(255,255,255,0.5); display: inline-block; padding: 4px 8px; border-radius: 4px;">
              💡 <strong>Action:</strong> ${getRecommendation(item.questionNumber)}
            </div>
          </td>
        </tr></table>
      </div>
    `;
  }).join('');

  const score = questionnaireData.yesCount;
  const total = questionnaireData.totalQuestions;
  const scoreColor = score >= 6 ? '#10b981' : (score >= 4 ? '#f59e0b' : '#ef4444');

  return `
    <div style="background: white; border-left: 4px solid #f59e0b; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 24px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">⚠️ Action Items & Recommendations</div>
      ${actionCardsHTML}
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #d1d5db;">
        <span style="font-size: 12px; color: #6b7280;">📊 <strong>Financial Health Score: ${score}/${total}</strong> - Complete these actions to improve your score</span>
      </div>
    </div>
  `;
}

/**
 * Build Insurance Policies section with inline styles
 */
function buildInsurancePoliciesSectionInlineStyles(insuranceData) {
  if (!insuranceData || insuranceData.totalPolicies === 0) {
    return '';
  }

  const hasTermInsurance = insuranceData.termInsurance && insuranceData.termInsurance.length > 0;
  const hasHealthInsurance = insuranceData.healthInsurance && insuranceData.healthInsurance.length > 0;

  if (!hasTermInsurance && !hasHealthInsurance) {
    return '';
  }

  let termTableHTML = '';
  if (hasTermInsurance) {
    const termRows = insuranceData.termInsurance.map(policy => `
      <tr>
        <td>${policy.member}</td>
        <td>${policy.provider}</td>
        <td style="font-family: monospace; font-size: 11px;">${policy.policyNumber || '—'}</td>
        <td>${policy.policyType}</td>
        <td style="text-align: right; font-weight: 700;">${formatCurrency(policy.sumAssured)}</td>
        <td style="text-align: right;">${policy.premium || '—'}</td>
        <td style="text-align: center;">${policy.maturityDate || '—'}</td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; ${policy.status === 'Active' ? 'background: #d1fae5; color: #065f46;' : 'background: #f3f4f6; color: #4b5563;'}">${policy.status}</span>
        </td>
      </tr>
    `).join('');

    termTableHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">🛡️ Term Life Insurance</div>
        <table>
          <thead style="background: #eef2ff;">
            <tr>
              <th>Member</th>
              <th>Provider</th>
              <th>Policy No.</th>
              <th>Policy Type</th>
              <th style="text-align: right;">Sum Assured</th>
              <th style="text-align: right;">Annual Premium</th>
              <th style="text-align: center;">Maturity Date</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${termRows}
          </tbody>
        </table>
      </div>
    `;
  }

  let healthTableHTML = '';
  if (hasHealthInsurance) {
    const healthRows = insuranceData.healthInsurance.map(policy => `
      <tr>
        <td>${policy.member}</td>
        <td>${policy.provider}</td>
        <td style="font-family: monospace; font-size: 11px;">${policy.policyNumber || '—'}</td>
        <td>${policy.policyType}</td>
        <td style="text-align: right; font-weight: 700;">${formatCurrency(policy.sumAssured)}</td>
        <td style="text-align: right;">${policy.premium || '—'}</td>
        <td style="text-align: center;">${policy.renewalDate || '—'}</td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; ${policy.status === 'Active' ? 'background: #d1fae5; color: #065f46;' : 'background: #f3f4f6; color: #4b5563;'}">${policy.status}</span>
        </td>
      </tr>
    `).join('');

    healthTableHTML = `
      <div>
        <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">🏥 Health Insurance</div>
        <table>
          <thead style="background: #d1fae5;">
            <tr>
              <th>Member</th>
              <th>Provider</th>
              <th>Policy No.</th>
              <th>Policy Type</th>
              <th style="text-align: right;">Sum Assured</th>
              <th style="text-align: right;">Annual Premium</th>
              <th style="text-align: center;">Renewal Date</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${healthRows}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">🛡️ Insurance Policies Overview</div>
      <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px;">
        ${termTableHTML}
        ${healthTableHTML}
      </div>
    </div>
  `;
}

/**
 * Build Member section with inline styles
 */
function buildMemberSectionInlineStyles(memberData, memberColor) {
  const mutualFundsHTML = buildMutualFundsSectionInlineStyles(memberData.mutualFunds, memberData.memberName);
  const stocksHTML = buildStocksSectionInlineStyles(memberData.stocks, memberData.memberName);
  const otherInvestmentsHTML = buildOtherInvestmentsSectionInlineStyles(memberData.otherInvestments);
  const liabilitiesHTML = buildLiabilitiesSectionInlineStyles(memberData.liabilities);

  const hasHoldings = mutualFundsHTML || stocksHTML || otherInvestmentsHTML;

  if (!hasHoldings) {
    return '';
  }

  return `
    <div style="background: white; border-left: 4px solid ${memberColor.border}; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
        <div style="font-size: 18px; font-weight: 700; color: ${memberColor.name};">${memberData.memberName}</div>
        <div style="font-size: 13px; color: #6b7280;">Investment Summary</div>
      </div>

      ${mutualFundsHTML}
      ${stocksHTML}
      ${otherInvestmentsHTML}
      ${liabilitiesHTML}
    </div>
  `;
}

/**
 * Build Mutual Funds section with inline styles
 */
function buildMutualFundsSectionInlineStyles(mfData, memberName) {
  if (!mfData || !mfData.portfolios || mfData.portfolios.length === 0) {
    return '';
  }

  const activePortfolios = mfData.portfolios.filter(p => p.invested > 0);
  if (activePortfolios.length === 0) {
    return '';
  }

  let portfoliosHTML = '';

  activePortfolios.forEach(portfolio => {
    // Use table layout for 5-column summary cards (PDF compatible)
    const summaryCardsHTML = `
      <table style="width: 100%; border: none; border-collapse: separate; border-spacing: 8px; margin-bottom: 12px;">
        <tr>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Invested</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatCurrency(portfolio.invested)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Current</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatCurrency(portfolio.current)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Unrealized</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.unrealizedPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.unrealizedPnL)}</div>
            <div style="font-size: 10px; color: ${portfolio.unrealizedPnL >= 0 ? '#10b981' : '#ef4444'};">${portfolio.unrealizedPnL >= 0 ? '+' : ''}${portfolio.unrealizedPnLPercent.toFixed(2)}%</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Realized</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.realizedPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.realizedPnL)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Total P&L</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.totalPnL)}</div>
            <div style="font-size: 10px; color: ${portfolio.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%</div>
          </td>
        </tr>
      </table>
    `;

    let fundsTableHTML = '';
    if (portfolio.funds && portfolio.funds.length > 0) {
      const fundsRows = portfolio.funds.map(fund => `
        <tr>
          <td style="text-align: left;">${fund.schemeName}</td>
          <td style="text-align: right;">${formatCurrency(fund.invested)}</td>
          <td style="text-align: right;">${formatCurrency(fund.current)}</td>
          <td style="text-align: right; font-weight: 600; color: ${fund.pnl >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(fund.pnl)}</td>
          <td style="text-align: right; color: ${fund.pnlPercent >= 0 ? '#10b981' : '#ef4444'};">${fund.pnlPercent >= 0 ? '+' : ''}${fund.pnlPercent.toFixed(2)}%</td>
          <td style="text-align: right; font-weight: 600; color: ${fund.rebalanceSip >= 0 ? '#065f46' : '#991b1b'};">${fund.rebalanceSip ? (fund.rebalanceSip >= 0 ? '+' : '') + formatCurrency(fund.rebalanceSip) : '—'}</td>
          <td style="text-align: right; font-weight: 600; color: ${fund.buySell >= 0 ? '#065f46' : '#7c2d12'};">${fund.buySell ? (fund.buySell >= 0 ? '+' : '') + formatCurrency(fund.buySell) : '—'}</td>
        </tr>
      `).join('');

      fundsTableHTML = `
        <table>
          <thead style="background: #f3f4f6;">
            <tr>
              <th style="text-align: left;">Fund Name</th>
              <th style="text-align: right;">Invested</th>
              <th style="text-align: right;">Current</th>
              <th style="text-align: right;">P&L</th>
              <th style="text-align: right;">P&L %</th>
              <th style="text-align: right; background: #d1fae5; color: #065f46;">Rebalance SIP ₹</th>
              <th style="text-align: right; background: #fed7aa; color: #7c2d12;">Buy/Sell ₹</th>
            </tr>
          </thead>
          <tbody>
            ${fundsRows}
          </tbody>
        </table>
      `;
    }

    portfoliosHTML += `
      <div style="background: #f9fafb; border-left: 4px solid #d1d5db; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 14px; font-weight: 600; color: #374151;">📁 ${portfolio.portfolioName}</div>
          ${portfolio.clientId ? `<div style="font-size: 11px; color: #6b7280; font-family: monospace;">Client ID: ${portfolio.clientId}</div>` : ''}
        </div>
        ${summaryCardsHTML}
        ${fundsTableHTML}
      </div>
    `;
  });

  return `
    <div style="margin-bottom: 14px;">
      <div style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px;">📊 Mutual Funds</div>
      ${portfoliosHTML}
    </div>
  `;
}

/**
 * Build Stocks section with inline styles
 */
function buildStocksSectionInlineStyles(stocksData, memberName) {
  if (!stocksData || !stocksData.portfolios || stocksData.portfolios.length === 0) {
    return '';
  }

  const activePortfolios = stocksData.portfolios.filter(p => p.invested > 0);
  if (activePortfolios.length === 0) {
    return '';
  }

  let portfoliosHTML = '';

  activePortfolios.forEach(portfolio => {
    // Use table layout for 5-column summary cards (PDF compatible)
    const summaryCardsHTML = `
      <table style="width: 100%; border: none; border-collapse: separate; border-spacing: 8px; margin-bottom: 12px;">
        <tr>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Invested</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatCurrency(portfolio.invested)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Current</div>
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${formatCurrency(portfolio.current)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Unrealized</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.unrealizedPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.unrealizedPnL)}</div>
            <div style="font-size: 10px; color: ${portfolio.unrealizedPnL >= 0 ? '#10b981' : '#ef4444'};">${portfolio.unrealizedPnL >= 0 ? '+' : ''}${portfolio.unrealizedPnLPercent.toFixed(2)}%</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Realized</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.realizedPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.realizedPnL)}</div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; width: 20%;">
            <div style="font-size: 10px; color: #6b7280; margin-bottom: 3px;">Total P&L</div>
            <div style="font-size: 14px; font-weight: 700; color: ${portfolio.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(portfolio.totalPnL)}</div>
            <div style="font-size: 10px; color: ${portfolio.totalPnL >= 0 ? '#10b981' : '#ef4444'};">${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnLPercent.toFixed(2)}%</div>
          </td>
        </tr>
      </table>
    `;

    let holdingsTableHTML = '';
    if (portfolio.holdings && portfolio.holdings.length > 0) {
      const holdingsRows = portfolio.holdings.map(holding => `
        <tr>
          <td>${holding.stockName}</td>
          <td style="text-align: right;">${holding.quantity}</td>
          <td style="text-align: right;">${formatCurrency(holding.avgPrice)}</td>
          <td style="text-align: right;">${formatCurrency(holding.ltp)}</td>
          <td style="text-align: right;">${formatCurrency(holding.invested)}</td>
          <td style="text-align: right;">${formatCurrency(holding.current)}</td>
          <td style="text-align: right; font-weight: 600; color: ${holding.pnl >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(holding.pnl)}</td>
          <td style="text-align: right; color: ${holding.pnlPercent >= 0 ? '#10b981' : '#ef4444'};">${holding.pnlPercent >= 0 ? '+' : ''}${holding.pnlPercent.toFixed(2)}%</td>
        </tr>
      `).join('');

      holdingsTableHTML = `
        <table>
          <thead style="background: #f3f4f6;">
            <tr>
              <th>Stock</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Avg Price</th>
              <th style="text-align: right;">LTP</th>
              <th style="text-align: right;">Invested</th>
              <th style="text-align: right;">Current</th>
              <th style="text-align: right;">P&L</th>
              <th style="text-align: right;">P&L %</th>
            </tr>
          </thead>
          <tbody>
            ${holdingsRows}
          </tbody>
        </table>
      `;
    }

    portfoliosHTML += `
      <div style="background: #f9fafb; border-left: 4px solid #d1d5db; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 14px; font-weight: 600; color: #374151;">📁 ${portfolio.portfolioName}</div>
          ${portfolio.clientId ? `<div style="font-size: 11px; color: #6b7280; font-family: monospace;">Client ID: ${portfolio.clientId}</div>` : ''}
        </div>
        ${summaryCardsHTML}
        ${holdingsTableHTML}
      </div>
    `;
  });

  return `
    <div style="margin-bottom: 14px;">
      <div style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px;">📈 Stocks</div>
      ${portfoliosHTML}
    </div>
  `;
}

/**
 * Build Other Investments section with inline styles
 */
function buildOtherInvestmentsSectionInlineStyles(otherData) {
  if (!otherData || !otherData.investments || otherData.investments.length === 0) {
    return '';
  }

  const investmentRows = otherData.investments.map(inv => `
    <tr>
      <td>${inv.investmentType}</td>
      <td>${inv.description || '—'}</td>
      <td style="text-align: right;">${formatCurrency(inv.amount)}</td>
    </tr>
  `).join('');

  const totalAmount = otherData.investments.reduce((sum, inv) => sum + inv.amount, 0);

  return `
    <div style="margin-bottom: 14px;">
      <div style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px;">💎 Other Investments</div>
      <div style="background: #f9fafb; border-left: 4px solid #d1d5db; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <table>
          <thead style="background: #f3f4f6;">
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${investmentRows}
            <tr style="background: #f9fafb; font-weight: 700;">
              <td colspan="2">Total</td>
              <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Build Liabilities section with inline styles
 */
function buildLiabilitiesSectionInlineStyles(liabilitiesData) {
  if (!liabilitiesData || !liabilitiesData.liabilities || liabilitiesData.liabilities.length === 0) {
    return '';
  }

  const liabilityRows = liabilitiesData.liabilities.map(liab => `
    <tr>
      <td>${liab.liabilityType}</td>
      <td>${liab.description || '—'}</td>
      <td style="text-align: right;">${formatCurrency(liab.outstandingAmount)}</td>
    </tr>
  `).join('');

  const totalAmount = liabilitiesData.liabilities.reduce((sum, liab) => sum + liab.outstandingAmount, 0);

  return `
    <div style="margin-bottom: 14px;">
      <div style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px;">💳 Liabilities</div>
      <div style="background: #f9fafb; border-left: 4px solid #d1d5db; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <table>
          <thead style="background: #f3f4f6;">
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th style="text-align: right;">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            ${liabilityRows}
            <tr style="background: #f9fafb; font-weight: 700;">
              <td colspan="2">Total</td>
              <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Build Family Member Details section with inline styles
 */
function buildFamilyMemberDetailsSectionInlineStyles(familyMembers) {
  if (!familyMembers || familyMembers.length === 0) {
    return '';
  }

  const memberRows = familyMembers.map(member => {
    const maskedAadhar = member.aadharNumber ? 'XXXX-XXXX-' + member.aadharNumber.slice(-4) : '—';

    return `
      <tr>
        <td style="font-weight: 600;">${member.memberName}</td>
        <td>${member.relationship}</td>
        <td style="font-family: monospace; font-size: 11px;">${maskedAadhar}</td>
        <td style="font-family: monospace; font-size: 11px;">${member.panNumber || '—'}</td>
        <td style="text-align: center;">${member.dateOfBirth || '—'}</td>
        <td style="font-family: monospace; font-size: 11px;">${member.mobileNumber || '—'}</td>
        <td style="font-size: 11px;">${member.emailAddress || '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="background: white; border-left: 4px solid #a78bfa; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">👨‍👩‍👧‍👦 Family Member Details</div>
      <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px;">
        <table>
          <thead style="background: #f3e8ff;">
            <tr>
              <th>Member Name</th>
              <th>Relationship</th>
              <th>Aadhar Number</th>
              <th>PAN Number</th>
              <th style="text-align: center;">Date of Birth</th>
              <th>Mobile</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${memberRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Build Account Summary section with inline styles
 */
function buildAccountSummarySectionInlineStyles(bankAccounts, investmentAccounts) {
  const hasBankAccounts = bankAccounts && bankAccounts.length > 0;
  const hasInvestmentAccounts = investmentAccounts && investmentAccounts.length > 0;

  if (!hasBankAccounts && !hasInvestmentAccounts) {
    return '';
  }

  let bankTableHTML = '';
  if (hasBankAccounts) {
    const bankRows = bankAccounts.map(account => {
      const maskedAccountNumber = account.accountNumber ? 'XXXX-' + account.accountNumber.slice(-4) : '—';

      return `
        <tr>
          <td>${account.member}</td>
          <td>${account.bankName}</td>
          <td style="font-family: monospace; font-size: 11px;">${maskedAccountNumber}</td>
          <td>${account.accountType}</td>
          <td>${account.branch || '—'}</td>
        </tr>
      `;
    }).join('');

    bankTableHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">🏦 Bank Accounts</div>
        <table>
          <thead style="background: #ccfbf1;">
            <tr>
              <th>Member</th>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>Account Type</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            ${bankRows}
          </tbody>
        </table>
      </div>
    `;
  }

  let investmentTableHTML = '';
  if (hasInvestmentAccounts) {
    const investmentRows = investmentAccounts.map(account => {
      return `
        <tr>
          <td>${account.member}</td>
          <td>${account.platform}</td>
          <td>${account.accountType}</td>
          <td style="font-family: monospace; font-size: 11px;">${account.accountId || account.clientId || '—'}</td>
          <td style="font-size: 11px;">${account.emailAddress || '—'}</td>
          <td style="font-family: monospace; font-size: 11px;">${account.phoneNumber || '—'}</td>
        </tr>
      `;
    }).join('');

    investmentTableHTML = `
      <div>
        <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">📈 Investment Accounts</div>
        <table>
          <thead style="background: #dbeafe;">
            <tr>
              <th>Member</th>
              <th>Platform</th>
              <th>Account Type</th>
              <th>Account ID</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            ${investmentRows}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div style="background: white; border-left: 4px solid #14b8a6; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 16px;">💳 Account Summary</div>
      <div style="background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px;">
        ${bankTableHTML}
        ${investmentTableHTML}
      </div>
    </div>
  `;
}

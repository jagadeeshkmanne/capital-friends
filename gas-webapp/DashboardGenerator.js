/**
 * ============================================================================
 * DASHBOARDGENERATOR.GS - Generate Family Wealth Dashboard in Excel & Email
 * ============================================================================
 *
 * This script generates a comprehensive family wealth dashboard showing:
 * - Family summary with total wealth, investment, liabilities, P&L
 * - Overall asset allocation (Equity, Debt, Gold) and market cap allocation
 * - All portfolios summary with unrealized, realized, and total P&L
 * - Family members details (Email, Mobile, PAN, Aadhar, DOB)
 * - Investment accounts
 * - Bank accounts
 * - Other investments (PPF, NPS, Stocks, Gold Bonds)
 * - Liabilities
 * - Individual portfolio details with:
 *   - Asset Type, Target%, Current%, Investment, Current Value, P&L
 *   - Ongoing SIP, Rebalance SIP, Switch Funds recommendations
 */

/**
 * Generate Dashboard and send via Email
 */
function sendDashboardEmail() {
  try {
    const emailHtml = generateDashboardHTML();
    const recipient = Session.getActiveUser().getEmail();
    const subject = '💰 Capital Friends - Family Wealth Dashboard';

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: emailHtml
    });

    SpreadsheetApp.getUi().alert('Dashboard email sent successfully to ' + recipient);
    return { success: true };

  } catch (error) {
    logError('sendDashboardEmail', error);
    SpreadsheetApp.getUi().alert('Error sending email: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate Dashboard in Excel sheet
 */
function generateDashboardExcel() {
  try {
    const ss = getSpreadsheet();

    // Check if Dashboard sheet exists, create if not
    let dashboardSheet = ss.getSheetByName('Family Dashboard');
    if (!dashboardSheet) {
      dashboardSheet = ss.insertSheet('Family Dashboard');
      dashboardSheet.setTabColor('#10b981');
    } else {
      dashboardSheet.clear();
    }

    // Get all the data
    const familyData = getDashboardData();

    // Render the dashboard in Excel format
    renderExcelDashboard(dashboardSheet, familyData);

    SpreadsheetApp.getUi().alert('Dashboard generated successfully in "Family Dashboard" sheet!');
    return { success: true };

  } catch (error) {
    logError('generateDashboardExcel', error);
    SpreadsheetApp.getUi().alert('Error generating dashboard: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get all dashboard data from sheets
 */
function getDashboardData() {
  const data = {
    family: getFamilySummary(),
    members: getFamilyMembersData(),
    investmentAccounts: getInvestmentAccountsData(),
    bankAccounts: getBankAccountsData(),
    otherInvestments: getOtherInvestmentsData(),
    liabilities: getLiabilitiesData(),
    portfolios: getPortfoliosData()
  };

  return data;
}

/**
 * Get family summary data
 */
function getFamilySummary() {
  // This would calculate totals across all members
  // For now, using sample data - implement actual calculation later
  return {
    totalWealth: 14600000, // ₹1.46Cr
    totalInvestment: 10700000, // ₹1.07Cr
    currentValue: 15300000, // ₹1.53Cr
    totalLiabilities: 680000, // ₹6.8L
    netPL: 4510000, // ₹45.1L
    netPLPercent: 42.0,
    assetAllocation: {
      equity: { percent: 78.5, value: 12000000 },
      debt: { percent: 17.8, value: 2720000 },
      gold: { percent: 3.7, value: 560000 }
    },
    capAllocation: {
      large: { percent: 45.2, value: 5430000 },
      mid: { percent: 37.5, value: 4500000 },
      small: { percent: 17.3, value: 2070000 }
    }
  };
}

/**
 * Get family members data
 */
function getFamilyMembersData() {
  const members = getAllFamilyMembers();
  const result = [];

  members.forEach(member => {
    result.push({
      name: member.memberName,
      email: member.emailPrimary || '',
      mobile: member.mobilePrimary || '',
      pan: member.panNumber || '',
      aadhar: member.aadharNumber || '',
      dob: member.dateOfBirth || ''
    });
  });

  return result;
}

/**
 * Get investment accounts data
 */
function getInvestmentAccountsData() {
  const accounts = getAllInvestmentAccounts();
  const result = [];

  accounts.forEach(account => {
    const member = getFamilyMemberById(account.memberId);
    result.push({
      memberName: member ? member.memberName : '',
      platform: account.platformBroker || '',
      accountType: account.accountType || '',
      clientId: account.clientId || '',
      email: member ? member.emailPrimary : '',
      mobile: member ? member.mobilePrimary : ''
    });
  });

  return result;
}

/**
 * Get bank accounts data
 */
function getBankAccountsData() {
  const accounts = getAllBankAccounts();
  const result = [];

  accounts.forEach(account => {
    const member = getFamilyMemberById(account.memberId);
    result.push({
      memberName: member ? member.memberName : '',
      bankName: account.bankName || '',
      accountNumber: account.accountNumber || '',
      ifscCode: account.ifscCode || '',
      accountType: account.accountType || ''
    });
  });

  return result;
}

/**
 * Get other investments data
 */
function getOtherInvestmentsData() {
  const investments = getAllOtherInvestments();
  const result = [];

  investments.forEach(inv => {
    const member = getFamilyMemberById(inv.memberId);
    result.push({
      memberName: member ? member.memberName : '',
      investmentType: inv.investmentType || '',
      accountPlatform: inv.accountPlatform || '',
      description: inv.investmentName || '',
      invested: inv.investedAmount || 0,
      currentValue: inv.currentValue || 0,
      pl: (inv.currentValue || 0) - (inv.investedAmount || 0),
      plPercent: inv.investedAmount > 0 ? (((inv.currentValue || 0) - (inv.investedAmount || 0)) / inv.investedAmount) * 100 : 0
    });
  });

  return result;
}

/**
 * Get liabilities data
 */
function getLiabilitiesData() {
  const liabilities = getAllLiabilities();
  const result = [];

  liabilities.forEach(liability => {
    const member = getFamilyMemberById(liability.memberId);
    result.push({
      memberName: member ? member.memberName : '',
      liabilityType: liability.liabilityType || '',
      lenderBank: liability.lenderBank || '',
      outstandingBalance: liability.outstandingBalance || 0,
      status: liability.status || 'Active'
    });
  });

  return result;
}

/**
 * Get portfolios data with funds
 */
function getPortfoliosData() {
  const portfolios = getAllPortfolios();
  const result = [];

  portfolios.forEach(portfolio => {
    const account = getInvestmentAccountById(portfolio.investmentAccountId);
    const member = account ? getFamilyMemberById(account.memberId) : null;
    const summary = getPortfolioSummary(portfolio.portfolioId);
    const funds = getPortfolioFunds(portfolio.portfolioId, portfolio.rebalanceThreshold);

    result.push({
      memberName: member ? member.memberName : '',
      portfolioName: portfolio.portfolioName,
      platform: account ? account.platformBroker : '',
      clientId: account ? account.clientId : '',
      accountType: account ? account.accountType : '',
      invested: summary.totalInvested || 0,
      currentValue: summary.currentValue || 0,
      unrealizedPL: summary.unrealizedGainLoss || 0,
      realizedPL: summary.realizedGainLoss || 0,
      totalPL: (summary.unrealizedGainLoss || 0) + (summary.realizedGainLoss || 0),
      totalPLPercent: summary.totalInvested > 0 ? (((summary.unrealizedGainLoss || 0) + (summary.realizedGainLoss || 0)) / summary.totalInvested) * 100 : 0,
      assetAllocation: getPortfolioAssetAllocation(portfolio.portfolioId),
      capAllocation: getPortfolioCapAllocation(portfolio.portfolioId),
      funds: funds
    });
  });

  return result;
}

/**
 * Get portfolio asset allocation
 */
function getPortfolioAssetAllocation(portfolioId) {
  // Sample data - implement actual calculation
  return {
    equity: { percent: 72.5, value: 1120000 },
    debt: { percent: 22.3, value: 350000 },
    others: { percent: 5.2, value: 80000 }
  };
}

/**
 * Get portfolio market cap allocation
 */
function getPortfolioCapAllocation(portfolioId) {
  // Sample data - implement actual calculation
  return {
    large: { percent: 35.2, value: 400000 },
    mid: { percent: 42.8, value: 480000 },
    small: { percent: 22.0, value: 250000 }
  };
}

/**
 * Get portfolio funds with rebalancing info
 */
function getPortfolioFunds(portfolioId, rebalanceThreshold) {
  const sheet = getSheet(CONFIG.mutualFundsSheet);
  if (!sheet) return [];

  // Use portfolio's rebalance threshold (stored as decimal, e.g. 0.05 = 5%), default 5%
  const thresholdPct = (rebalanceThreshold || 0.05) * 100;

  const data = sheet.getDataRange().getValues();
  const funds = [];

  for (let i = 3; i <= sheet.getLastRow(); i++) {
    const row = data[i - 1];
    const fundPortfolioId = row[3]; // Column D: Portfolio ID

    if (fundPortfolioId === portfolioId) {
      const targetPercent = row[7] || 0; // Column H: Target Allocation %
      const currentPercent = row[8] || 0; // Column I: Current Allocation %
      const invested = row[12] || 0; // Column M: Total Invested
      const currentValue = row[13] || 0; // Column N: Current Value
      const pl = currentValue - invested;
      const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
      const ongoingSIP = row[9] || 0; // Column J: Monthly SIP Amount
      const rebalanceSIP = row[11] || 0; // Column L: Rebalance SIP ₹

      // Calculate switch suggestion using portfolio's rebalance threshold
      let switchSuggestion = '—';
      const deviation = currentPercent - targetPercent;
      if (Math.abs(deviation) > thresholdPct) {
        if (deviation > 0) {
          // Overweight - suggest switching out
          const switchAmount = (deviation / 100) * currentValue;
          switchSuggestion = `Switch ₹${formatCurrency(switchAmount)} to underweight fund`;
        } else {
          // Underweight - suggest receiving from overweight
          const receiveAmount = (Math.abs(deviation) / 100) * currentValue;
          switchSuggestion = `Receive ₹${formatCurrency(receiveAmount)} from overweight fund`;
        }
      }

      // Determine rebalance SIP display
      let rebalanceSIPDisplay = '—';
      if (rebalanceSIP < 0) {
        rebalanceSIPDisplay = 'Stop SIP';
      } else if (rebalanceSIP > 0) {
        rebalanceSIPDisplay = `+₹${formatNumber(rebalanceSIP)}`;
      }

      funds.push({
        fundName: row[2] || '', // Column C: Fund Name
        assetType: row[5] || 'Equity', // Column F: Asset Class
        targetPercent: targetPercent,
        currentPercent: currentPercent,
        invested: invested,
        currentValue: currentValue,
        pl: pl,
        plPercent: plPercent,
        ongoingSIP: ongoingSIP,
        rebalanceSIP: rebalanceSIPDisplay,
        switchFunds: switchSuggestion
      });
    }
  }

  return funds;
}

/**
 * Format currency for display (convert to Cr/L format)
 */
function formatCurrency(amount) {
  if (amount >= 10000000) {
    return (amount / 10000000).toFixed(1) + 'Cr';
  } else if (amount >= 100000) {
    return (amount / 100000).toFixed(1) + 'L';
  } else {
    return '₹' + formatNumber(amount);
  }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Generate HTML for email dashboard
 */
function generateDashboardHTML() {
  const data = getDashboardData();
  const template = HtmlService.createTemplateFromFile('DASHBOARD_FINAL');

  // Pass data to template
  template.familyData = data.family;
  template.members = data.members;
  template.investmentAccounts = data.investmentAccounts;
  template.bankAccounts = data.bankAccounts;
  template.otherInvestments = data.otherInvestments;
  template.liabilities = data.liabilities;
  template.portfolios = data.portfolios;

  return template.evaluate().getContent();
}

/**
 * Render Excel dashboard with enhanced styling
 */
function renderExcelDashboard(sheet, data) {
  let row = 1;

  // Set sheet background to dark theme
  sheet.getRange(1, 1, 1000, 15).setBackground('#111827');

  // Title with better styling
  sheet.getRange(row, 1, 1, 15).merge()
    .setValue('💰 CAPITAL FRIENDS - FAMILY WEALTH DASHBOARD')
    .setBackground('#10b981').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(18).setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 50);
  row += 2;

  // FAMILY SUMMARY
  row = renderFamilySummaryExcel(sheet, row, data.family);
  row += 2;

  // ALL PORTFOLIOS SUMMARY
  row = renderAllPortfoliosSummaryExcel(sheet, row, data.portfolios);
  row += 2;

  // FAMILY MEMBERS
  row = renderFamilyMembersExcel(sheet, row, data.members);
  row += 2;

  // INVESTMENT ACCOUNTS
  row = renderInvestmentAccountsExcel(sheet, row, data.investmentAccounts);
  row += 2;

  // BANK ACCOUNTS
  row = renderBankAccountsExcel(sheet, row, data.bankAccounts);
  row += 2;

  // OTHER INVESTMENTS
  row = renderOtherInvestmentsExcel(sheet, row, data.otherInvestments);
  row += 2;

  // LIABILITIES
  row = renderLiabilitiesExcel(sheet, row, data.liabilities);
  row += 2;

  // INDIVIDUAL PORTFOLIOS
  data.portfolios.forEach(portfolio => {
    row = renderPortfolioDetailsExcel(sheet, row, portfolio);
    row += 2;
  });

  // Enhanced column formatting
  sheet.setColumnWidth(1, 280); // Fund Name column - wider
  sheet.setColumnWidths(2, 3, 100); // Target/Current % columns
  sheet.setColumnWidths(4, 7, 130); // Investment/Value/P&L/SIP columns
  sheet.setColumnWidths(8, 9, 150); // Rebalance/Switch columns

  // Apply borders with dark theme color
  const lastRow = sheet.getLastRow();
  sheet.getRange(1, 1, lastRow, 15).setBorder(
    true, true, true, true, true, true,
    '#374151', SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  );

  // Freeze header row
  sheet.setFrozenRows(1);

  // Add alternating row colors for better readability (applied in individual render functions)
}

/**
 * Render family summary in Excel with enhanced card styling
 */
function renderFamilySummaryExcel(sheet, startRow, family) {
  // Section Header with rounded appearance
  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue('Family Wealth Dashboard')
    .setBackground('#1f2937').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 35);
  sheet.getRange(startRow, 1).setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID_THICK);
  startRow++;

  // Metric cards with enhanced styling (compact boxes)
  const metrics = [
    { label: 'Total Wealth', value: family.totalWealth, bgColor: '#064e3b', labelColor: '#6ee7b7', valueColor: '#e5e7eb', borderColor: '#047857' },
    { label: 'Total Investment', value: family.totalInvestment, bgColor: '#1e3a8a', labelColor: '#93c5fd', valueColor: '#e5e7eb', borderColor: '#1e40af' },
    { label: 'Current Value', value: family.currentValue, bgColor: '#064e3b', labelColor: '#6ee7b7', valueColor: '#e5e7eb', borderColor: '#047857' },
    { label: 'Total Liabilities', value: family.totalLiabilities, bgColor: '#7f1d1d', labelColor: '#fecaca', valueColor: '#e5e7eb', borderColor: '#991b1b' },
    { label: 'Net P&L', value: family.netPL, bgColor: '#064e3b', labelColor: '#6ee7b7', valueColor: '#10b981', borderColor: '#047857' }
  ];

  // Create card-like appearance with labels
  metrics.forEach((metric, i) => {
    const col = i + 1;
    // Label row (smaller)
    sheet.getRange(startRow, col)
      .setValue(metric.label)
      .setBackground(metric.bgColor).setFontColor(metric.labelColor)
      .setFontSize(9).setFontWeight('normal')
      .setHorizontalAlignment('center').setVerticalAlignment('bottom')
      .setBorder(true, true, true, false, false, false, metric.borderColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.setRowHeight(startRow, 25);
  });
  startRow++;

  // Values row (larger, bold)
  metrics.forEach((metric, i) => {
    const col = i + 1;
    sheet.getRange(startRow, col)
      .setValue(metric.value)
      .setBackground(metric.bgColor).setFontColor(metric.valueColor)
      .setFontWeight('bold').setFontSize(14)
      .setNumberFormat('₹#,##0.0,,"Cr"')
      .setHorizontalAlignment('center').setVerticalAlignment('top')
      .setBorder(false, true, true, true, false, false, metric.borderColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.setRowHeight(startRow, 30);
  });
  startRow++;

  // Percentage row for Net P&L
  sheet.getRange(startRow - 1, 5)
    .setValue(family.netPL)
    .setNumberFormat('₹#,##0.0,,"Cr"');

  // Add P&L percentage in a separate small row under Net P&L
  sheet.getRange(startRow, 5)
    .setValue(`+${family.netPLPercent}%`)
    .setBackground('#064e3b').setFontColor('#10b981')
    .setFontSize(10).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(false, true, true, true, false, false, '#047857', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(startRow, 20);
  startRow++;

  // Asset Allocation with better formatting and colors
  const assetText = 'Asset:  ' +
    `Equity ${family.assetAllocation.equity.percent}% (₹${formatCurrency(family.assetAllocation.equity.value)})  •  ` +
    `Debt ${family.assetAllocation.debt.percent}% (₹${formatCurrency(family.assetAllocation.debt.value)})  •  ` +
    `Gold ${family.assetAllocation.gold.percent}% (₹${formatCurrency(family.assetAllocation.gold.value)})  |  ` +
    'Cap:  ' +
    `Large ${family.capAllocation.large.percent}% (₹${formatCurrency(family.capAllocation.large.value)})  •  ` +
    `Mid ${family.capAllocation.mid.percent}% (₹${formatCurrency(family.capAllocation.mid.value)})  •  ` +
    `Small ${family.capAllocation.small.percent}% (₹${formatCurrency(family.capAllocation.small.value)})`;

  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue(assetText)
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontSize(11).setFontWeight('normal')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(startRow, 28);
  startRow++;

  // Rebalance alert row
  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue('⚠️ Rebalance: Review allocation deviations from target in individual portfolios below')
    .setBackground('#7f1d1d').setFontColor('#fca5a5')
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#991b1b', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(startRow, 28);
  startRow++;

  return startRow;
}

/**
 * Render all portfolios summary in Excel with enhanced styling
 */
function renderAllPortfoliosSummaryExcel(sheet, startRow, portfolios) {
  // Section Header
  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue('📊 All Portfolios Summary')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 35);
  sheet.getRange(startRow, 1).setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID_THICK);
  startRow++;

  // Column headers with better styling
  const headers = ['Member', 'Platform', 'Invested', 'Current', 'Unrealized P&L', 'Realized P&L', 'Total P&L', 'Rebalance'];
  const headerWidths = [2, 2, 2, 2, 2, 2, 2, 1.5]; // Column span weights

  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment(i < 2 ? 'left' : (i === 7 ? 'center' : 'right'))
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID);
  });
  sheet.setRowHeight(startRow, 30);
  startRow++;

  // Data rows with alternating colors
  portfolios.forEach((portfolio, index) => {
    const rowBg = index % 2 === 0 ? '#1f2937' : '#111827';

    sheet.getRange(startRow, 1).setValue(portfolio.memberName)
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('left');

    sheet.getRange(startRow, 2).setValue(portfolio.platform)
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('left');

    sheet.getRange(startRow, 3).setValue(portfolio.invested)
      .setNumberFormat('₹#,##0.0,,"L"')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('right');

    sheet.getRange(startRow, 4).setValue(portfolio.currentValue)
      .setNumberFormat('₹#,##0.0,,"L"')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('right');

    // Unrealized P&L with color
    const unrealizedColor = portfolio.unrealizedPL >= 0 ? '#10b981' : '#ef4444';
    const unrealizedText = portfolio.unrealizedPL >= 0 ?
      `▲ ₹${formatCurrency(portfolio.unrealizedPL)} (+${(portfolio.unrealizedPL/portfolio.invested*100).toFixed(0)}%)` :
      `▼ ₹${formatCurrency(Math.abs(portfolio.unrealizedPL))} (${(portfolio.unrealizedPL/portfolio.invested*100).toFixed(0)}%)`;
    sheet.getRange(startRow, 5).setValue(unrealizedText)
      .setBackground(rowBg).setFontColor(unrealizedColor).setFontSize(11)
      .setFontWeight('bold').setHorizontalAlignment('right');

    // Realized P&L with color
    const realizedColor = portfolio.realizedPL >= 0 ? '#10b981' : '#ef4444';
    const realizedText = portfolio.realizedPL >= 0 ?
      `▲ ₹${formatCurrency(portfolio.realizedPL)} (+${(portfolio.realizedPL/portfolio.invested*100).toFixed(0)}%)` :
      `▼ ₹${formatCurrency(Math.abs(portfolio.realizedPL))} (${(portfolio.realizedPL/portfolio.invested*100).toFixed(0)}%)`;
    sheet.getRange(startRow, 6).setValue(realizedText)
      .setBackground(rowBg).setFontColor(realizedColor).setFontSize(11)
      .setFontWeight('bold').setHorizontalAlignment('right');

    // Total P&L with color
    const totalColor = portfolio.totalPL >= 0 ? '#10b981' : '#ef4444';
    const totalText = portfolio.totalPL >= 0 ?
      `▲ ₹${formatCurrency(portfolio.totalPL)} (+${portfolio.totalPLPercent.toFixed(0)}%)` :
      `▼ ₹${formatCurrency(Math.abs(portfolio.totalPL))} (${portfolio.totalPLPercent.toFixed(0)}%)`;
    sheet.getRange(startRow, 7).setValue(totalText)
      .setBackground(rowBg).setFontColor(totalColor).setFontSize(11)
      .setFontWeight('bold').setHorizontalAlignment('right');

    sheet.getRange(startRow, 8).setValue(`${portfolio.funds.length} funds`)
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('center');

    // Add borders
    sheet.getRange(startRow, 1, 1, 8).setBorder(
      false, true, true, true, true, false,
      '#374151', SpreadsheetApp.BorderStyle.SOLID
    );

    sheet.setRowHeight(startRow, 28);
    startRow++;
  });

  return startRow;
}

/**
 * Render family members in Excel
 */
function renderFamilyMembersExcel(sheet, startRow, members) {
  // Header
  sheet.getRange(startRow, 1, 1, 11).merge()
    .setValue('👥 Family Members')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Column headers
  const headers = ['Member Name', 'Email', 'Mobile', 'PAN Number', 'Aadhar Number', 'Date of Birth'];
  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
  });
  startRow++;

  // Data rows
  members.forEach(member => {
    sheet.getRange(startRow, 1).setValue(member.name);
    sheet.getRange(startRow, 2).setValue(member.email);
    sheet.getRange(startRow, 3).setValue(member.mobile);
    sheet.getRange(startRow, 4).setValue(member.pan);
    sheet.getRange(startRow, 5).setValue(member.aadhar);
    sheet.getRange(startRow, 6).setValue(member.dob);

    sheet.getRange(startRow, 1, 1, 6).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(10);
    startRow++;
  });

  return startRow;
}

/**
 * Render investment accounts in Excel
 */
function renderInvestmentAccountsExcel(sheet, startRow, accounts) {
  // Header
  sheet.getRange(startRow, 1, 1, 11).merge()
    .setValue('💼 Investment Accounts')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Column headers
  const headers = ['Member', 'Platform', 'Account Type', 'Client ID', 'Email', 'Mobile'];
  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
  });
  startRow++;

  // Data rows
  accounts.forEach(account => {
    sheet.getRange(startRow, 1).setValue(account.memberName);
    sheet.getRange(startRow, 2).setValue(account.platform);
    sheet.getRange(startRow, 3).setValue(account.accountType);
    sheet.getRange(startRow, 4).setValue(account.clientId);
    sheet.getRange(startRow, 5).setValue(account.email);
    sheet.getRange(startRow, 6).setValue(account.mobile);

    sheet.getRange(startRow, 1, 1, 6).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(10);
    startRow++;
  });

  return startRow;
}

/**
 * Render bank accounts in Excel
 */
function renderBankAccountsExcel(sheet, startRow, accounts) {
  // Header
  sheet.getRange(startRow, 1, 1, 11).merge()
    .setValue('🏦 Bank Accounts')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Column headers
  const headers = ['Member', 'Bank Name', 'Account Number', 'IFSC Code', 'Type'];
  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
  });
  startRow++;

  // Data rows
  accounts.forEach(account => {
    sheet.getRange(startRow, 1).setValue(account.memberName);
    sheet.getRange(startRow, 2).setValue(account.bankName);
    sheet.getRange(startRow, 3).setValue(account.accountNumber);
    sheet.getRange(startRow, 4).setValue(account.ifscCode);
    sheet.getRange(startRow, 5).setValue(account.accountType);

    sheet.getRange(startRow, 1, 1, 5).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(10);
    startRow++;
  });

  return startRow;
}

/**
 * Render other investments in Excel
 */
function renderOtherInvestmentsExcel(sheet, startRow, investments) {
  // Header
  sheet.getRange(startRow, 1, 1, 11).merge()
    .setValue('📈 Other Investments')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Column headers
  const headers = ['Member', 'Investment Type', 'Account/Platform', 'Description', 'Invested', 'Current Value', 'P&L'];
  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
  });
  startRow++;

  // Data rows
  investments.forEach(inv => {
    sheet.getRange(startRow, 1).setValue(inv.memberName);
    sheet.getRange(startRow, 2).setValue(inv.investmentType);
    sheet.getRange(startRow, 3).setValue(inv.accountPlatform);
    sheet.getRange(startRow, 4).setValue(inv.description);
    sheet.getRange(startRow, 5).setValue(inv.invested).setNumberFormat('₹#,##0');
    sheet.getRange(startRow, 6).setValue(inv.currentValue).setNumberFormat('₹#,##0');
    sheet.getRange(startRow, 7).setValue(inv.pl).setNumberFormat('₹#,##0');

    sheet.getRange(startRow, 1, 1, 7).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(10);

    const plColor = inv.pl >= 0 ? '#10b981' : '#ef4444';
    sheet.getRange(startRow, 7).setFontColor(plColor).setFontWeight('bold');

    startRow++;
  });

  return startRow;
}

/**
 * Render liabilities in Excel
 */
function renderLiabilitiesExcel(sheet, startRow, liabilities) {
  // Header
  sheet.getRange(startRow, 1, 1, 11).merge()
    .setValue('💳 Liabilities')
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Column headers
  const headers = ['Member', 'Liability Type', 'Lender/Bank', 'Outstanding Balance', 'Status'];
  headers.forEach((header, i) => {
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
  });
  startRow++;

  // Data rows
  liabilities.forEach(liability => {
    sheet.getRange(startRow, 1).setValue(liability.memberName);
    sheet.getRange(startRow, 2).setValue(liability.liabilityType);
    sheet.getRange(startRow, 3).setValue(liability.lenderBank);
    sheet.getRange(startRow, 4).setValue(liability.outstandingBalance).setNumberFormat('₹#,##0');
    sheet.getRange(startRow, 5).setValue(liability.status);

    sheet.getRange(startRow, 1, 1, 5).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(10);
    sheet.getRange(startRow, 4).setFontColor('#fca5a5').setFontWeight('bold');

    startRow++;
  });

  return startRow;
}

/**
 * Render portfolio details in Excel with enhanced styling
 */
function renderPortfolioDetailsExcel(sheet, startRow, portfolio) {
  // Portfolio header with client info
  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue(`${portfolio.memberName} → 📱 ${portfolio.platform}`)
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 35);
  sheet.getRange(startRow, 1).setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID_THICK);
  startRow++;

  // Client ID info row
  sheet.getRange(startRow, 1, 1, 15).merge()
    .setValue(`Client ID: ${portfolio.clientId} • ${portfolio.accountType}`)
    .setBackground('#374151').setFontColor('#9ca3af')
    .setFontSize(10).setFontStyle('italic')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 22);
  startRow++;

  // Portfolio metrics with card styling
  const metrics = [
    { label: 'Invested', value: portfolio.invested, bgColor: '#1e3a8a', labelColor: '#93c5fd' },
    { label: 'Current Value', value: portfolio.currentValue, bgColor: '#064e3b', labelColor: '#6ee7b7' },
    { label: 'Unrealized P&L', value: portfolio.unrealizedPL, bgColor: portfolio.unrealizedPL >= 0 ? '#064e3b' : '#7f1d1d', labelColor: '#6ee7b7' },
    { label: 'Realized P&L', value: portfolio.realizedPL, bgColor: portfolio.realizedPL >= 0 ? '#064e3b' : '#7f1d1d', labelColor: '#6ee7b7' },
    { label: 'Total P&L', value: portfolio.totalPL, bgColor: portfolio.totalPL >= 0 ? '#064e3b' : '#7f1d1d', labelColor: '#6ee7b7' }
  ];

  // Labels
  metrics.forEach((metric, i) => {
    sheet.getRange(startRow, i + 1).setValue(metric.label)
      .setBackground(metric.bgColor).setFontColor(metric.labelColor)
      .setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('bottom');
  });
  sheet.setRowHeight(startRow, 22);
  startRow++;

  // Values
  metrics.forEach((metric, i) => {
    const valueColor = i < 2 ? '#e5e7eb' : (metric.value >= 0 ? '#10b981' : '#ef4444');
    sheet.getRange(startRow, i + 1).setValue(metric.value)
      .setNumberFormat('₹#,##0.0,,"L"')
      .setBackground(metric.bgColor).setFontColor(valueColor)
      .setFontWeight('bold').setFontSize(13)
      .setHorizontalAlignment('center').setVerticalAlignment('top');
  });
  sheet.setRowHeight(startRow, 28);
  startRow++;

  // Asset allocation row
  const assetText = `Asset:  Equity ${portfolio.assetAllocation.equity.percent}%  •  Debt ${portfolio.assetAllocation.debt.percent}%  •  Others ${portfolio.assetAllocation.others.percent}%  |  ` +
                   `Cap:  Large ${portfolio.capAllocation.large.percent}%  •  Mid ${portfolio.capAllocation.mid.percent}%  •  Small ${portfolio.capAllocation.small.percent}%`;
  sheet.getRange(startRow, 1, 1, 15).merge().setValue(assetText)
    .setBackground('#111827').setFontColor('#e5e7eb')
    .setFontSize(11).setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(startRow, 26);
  startRow++;

  // Fund table headers with enhanced styling
  const fundHeaders = ['Fund Name', 'Target %', 'Current %', 'Investment', 'Current Value', 'P&L', 'Ongoing SIP', 'Rebalance SIP', 'Switch Funds'];
  fundHeaders.forEach((header, i) => {
    const align = i === 0 ? 'left' : (i >= 7 ? 'center' : 'right');
    sheet.getRange(startRow, i + 1)
      .setValue(header)
      .setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment(align).setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false, '#374151', SpreadsheetApp.BorderStyle.SOLID);
  });
  sheet.setRowHeight(startRow, 30);
  startRow++;

  // Fund data rows with enhanced styling
  portfolio.funds.forEach((fund, index) => {
    const rowBg = index % 2 === 0 ? '#1f2937' : '#111827';

    // Fund Name
    sheet.getRange(startRow, 1).setValue(fund.fundName)
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    // Target %
    const targetColor = '#9ca3af';
    sheet.getRange(startRow, 2).setValue(fund.targetPercent / 100)
      .setNumberFormat('0.0%')
      .setBackground(rowBg).setFontColor(targetColor).setFontSize(11)
      .setHorizontalAlignment('right');

    // Current %
    sheet.getRange(startRow, 3).setValue(fund.currentPercent / 100)
      .setNumberFormat('0.0%')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('right');

    // Investment
    sheet.getRange(startRow, 4).setValue(fund.invested)
      .setNumberFormat('₹#,##0.0,,"L"')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('right');

    // Current Value
    sheet.getRange(startRow, 5).setValue(fund.currentValue)
      .setNumberFormat('₹#,##0.0,,"L"')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(11)
      .setHorizontalAlignment('right');

    // P&L with color and formatting
    const plColor = fund.pl >= 0 ? '#10b981' : '#ef4444';
    const plText = fund.pl >= 0 ?
      `▲ ₹${formatCurrency(fund.pl)} (+${fund.plPercent.toFixed(0)}%)` :
      `▼ ₹${formatCurrency(Math.abs(fund.pl))} (${fund.plPercent.toFixed(0)}%)`;
    sheet.getRange(startRow, 6).setValue(plText)
      .setBackground(rowBg).setFontColor(plColor).setFontSize(11)
      .setFontWeight('bold').setHorizontalAlignment('right');

    // Ongoing SIP
    sheet.getRange(startRow, 7).setValue(fund.ongoingSIP)
      .setNumberFormat('₹#,##0')
      .setBackground(rowBg).setFontColor('#e5e7eb').setFontSize(10)
      .setHorizontalAlignment('center');

    // Rebalance SIP with color coding
    let rebalanceSIPColor = '#6ee7b7';
    if (fund.rebalanceSIP === 'Stop SIP') {
      rebalanceSIPColor = '#fca5a5';
    } else if (fund.rebalanceSIP !== '—') {
      rebalanceSIPColor = '#10b981';
    }
    sheet.getRange(startRow, 8).setValue(fund.rebalanceSIP)
      .setBackground(rowBg).setFontColor(rebalanceSIPColor).setFontSize(10)
      .setFontWeight('bold').setHorizontalAlignment('center');

    // Switch Funds with color coding
    let switchColor = '#6ee7b7';
    if (fund.switchFunds.includes('Switch ₹')) {
      switchColor = '#fca5a5'; // Red for selling/switching out
    } else if (fund.switchFunds.includes('Receive ₹')) {
      switchColor = '#10b981'; // Green for receiving
    }
    sheet.getRange(startRow, 9).setValue(fund.switchFunds)
      .setBackground(rowBg).setFontColor(switchColor).setFontSize(10)
      .setFontWeight('bold').setHorizontalAlignment('center');

    // Add borders to row
    sheet.getRange(startRow, 1, 1, 9).setBorder(
      false, true, true, true, true, false,
      '#374151', SpreadsheetApp.BorderStyle.SOLID
    );

    sheet.setRowHeight(startRow, 28);
    startRow++;
  });

  return startRow;
}

// ============================================================================
// END OF DASHBOARDGENERATOR.GS
// ============================================================================

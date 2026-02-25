/**
 * ============================================================================
 * DASHBOARDDATA_V2.GS - Enhanced Dashboard with Family Member Breakdown
 * ============================================================================
 *
 * Dashboard Structure:
 * 1. Family-Wide Summary (Total Wealth across all members)
 * 2. Overall Asset Allocation
 * 3. Family Member-Wise Breakdown:
 *    - Member → Investment Accounts → Portfolios
 *    - Member's Other Investments
 *    - Member's Total Wealth
 *    - Member's Asset Allocation
 * 4. Rebalancing Alerts (Portfolio-wise)
 */

// Cache for getAllPortfolios to avoid multiple reads
let allPortfoliosCache = null;

/**
 * Clear the portfolios cache (call at start of data generation)
 */
function clearAllPortfoliosCache() {
  allPortfoliosCache = null;
}

/**
 * Get comprehensive family wealth data
 * Returns family-wide summary + member-wise breakdown
 */
function getFamilyWealthData() {
  try {
    // Clear cache at the start to ensure fresh data
    clearAllPortfoliosCache();

    const familyMembers = getAllFamilyMembers();
    const familyData = {
      totalWealth: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalMutualFunds: 0,
      totalOtherInvestments: 0,
      totalBankAccounts: 0,
      members: []
    };

    // Process each family member
    familyMembers.forEach(member => {
      const memberData = getMemberWealthData(member.memberId);

      // Aggregate family totals
      familyData.totalMutualFunds += memberData.mutualFundsValue;
      familyData.totalOtherInvestments += memberData.otherInvestmentsValue;
      familyData.totalBankAccounts += memberData.bankAccountsValue;
      familyData.totalLiabilities += memberData.liabilitiesValue;

      familyData.members.push({
        memberId: member.memberId,
        memberName: member.memberName,
        totalAssets: memberData.totalAssets,
        totalLiabilities: memberData.liabilitiesValue,
        netWorth: memberData.netWorth,
        mutualFunds: memberData.mutualFunds,
        otherInvestments: memberData.otherInvestments,
        bankAccounts: memberData.bankAccountsValue,
        portfolios: memberData.portfolios,
        assetAllocation: memberData.assetAllocation
      });
    });

    // Calculate family-level totals
    familyData.totalAssets = familyData.totalBankAccounts + familyData.totalMutualFunds + familyData.totalOtherInvestments;
    familyData.totalWealth = familyData.totalAssets - familyData.totalLiabilities;

    return {
      success: true,
      data: familyData
    };

  } catch (error) {
    logError('getFamilyWealthData', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get wealth data for a single family member
 */
function getMemberWealthData(memberId) {
  // Get member's bank accounts
  const bankAccountsValue = getMemberBankAccountsValue(memberId);

  // Get member's portfolios (mutual funds)
  const portfolios = getMemberPortfolios(memberId);
  let mutualFundsValue = 0;
  let mutualFundsInvested = 0;
  let mutualFundsUnrealizedPL = 0;
  let mutualFundsRealizedPL = 0;

  portfolios.forEach(portfolio => {
    mutualFundsValue += portfolio.currentValue;
    mutualFundsInvested += portfolio.totalInvested;
    mutualFundsUnrealizedPL += portfolio.unrealizedPL;
    mutualFundsRealizedPL += portfolio.realizedPL;
  });

  const mutualFundsTotalPL = mutualFundsUnrealizedPL + mutualFundsRealizedPL;
  const mutualFundsPercentPL = mutualFundsInvested > 0 ? (mutualFundsTotalPL / mutualFundsInvested) * 100 : 0;

  // Get member's other investments
  const otherInvestments = getMemberOtherInvestments(memberId);
  let otherInvestmentsValue = 0;
  let otherInvestmentsInvested = 0;

  otherInvestments.forEach(inv => {
    otherInvestmentsValue += inv.currentValue;
    otherInvestmentsInvested += inv.investedAmount;
  });

  const otherInvestmentsPL = otherInvestmentsValue - otherInvestmentsInvested;

  // Get member's liabilities
  const liabilitiesValue = getMemberLiabilitiesValue(memberId);

  // Calculate totals
  const totalAssets = bankAccountsValue + mutualFundsValue + otherInvestmentsValue;
  const netWorth = totalAssets - liabilitiesValue;

  // Calculate asset allocation for this member
  const assetAllocation = {
    bankAccounts: { value: bankAccountsValue, percentage: totalAssets > 0 ? (bankAccountsValue / totalAssets) * 100 : 0 },
    mutualFunds: { value: mutualFundsValue, percentage: totalAssets > 0 ? (mutualFundsValue / totalAssets) * 100 : 0 },
    otherInvestments: { value: otherInvestmentsValue, percentage: totalAssets > 0 ? (otherInvestmentsValue / totalAssets) * 100 : 0 }
  };

  return {
    totalAssets: totalAssets,
    netWorth: netWorth,
    liabilitiesValue: liabilitiesValue,
    bankAccountsValue: bankAccountsValue,
    mutualFundsValue: mutualFundsValue,
    mutualFundsInvested: mutualFundsInvested,
    mutualFundsUnrealizedPL: mutualFundsUnrealizedPL,
    mutualFundsRealizedPL: mutualFundsRealizedPL,
    mutualFundsTotalPL: mutualFundsTotalPL,
    mutualFundsPercentPL: mutualFundsPercentPL,
    otherInvestmentsValue: otherInvestmentsValue,
    otherInvestmentsInvested: otherInvestmentsInvested,
    otherInvestmentsPL: otherInvestmentsPL,
    portfolios: portfolios,
    otherInvestments: otherInvestments,
    mutualFunds: {
      currentValue: mutualFundsValue,
      totalInvested: mutualFundsInvested,
      unrealizedPL: mutualFundsUnrealizedPL,
      realizedPL: mutualFundsRealizedPL,
      totalPL: mutualFundsTotalPL,
      percentPL: mutualFundsPercentPL
    },
    assetAllocation: assetAllocation
  };
}

/**
 * Helper function to parse numbers that may contain commas and currency symbols
 * Handles both number and string formats with commas, rupee symbols, spaces
 */
function parseNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove currency symbols (₹, Rs, Rs.), commas, and spaces
    // Keep the decimal point for proper parsing
    const cleaned = value.replace(/[₹\s]/g, '')  // Remove rupee symbol and spaces
                         .replace(/Rs\.?/gi, '') // Remove Rs or Rs.
                         .replace(/,/g, '');      // Remove commas
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Get portfolio summary from AllPortfolios sheet
 * Returns: { currentValue, totalInvested, unrealizedGainLoss, realizedGainLoss }
 */
function getPortfolioSummary(portfolioId) {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.portfolioMetadataSheet);

    if (!sheet) {
      Logger.log('AllPortfolios sheet not found');
      return {
        currentValue: 0,
        totalInvested: 0,
        unrealizedGainLoss: 0,
        realizedGainLoss: 0
      };
    }

    const data = sheet.getDataRange().getValues();

    // Start from row 4 (index 3) - Row 1=Developer credit, Row 2=Group headers, Row 3=Column headers
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      const rowPortfolioId = row[0]; // Column A: Portfolio ID

      if (rowPortfolioId === portfolioId) {
        return {
          currentValue: parseNumber(row[8]),           // Column I: Current Value
          totalInvested: parseNumber(row[4]),          // Column E: Total Investment
          unrealizedGainLoss: parseNumber(row[9]),     // Column J: Unrealized P&L Amount
          realizedGainLoss: parseNumber(row[11])       // Column L: Realized P&L Amount
        };
      }
    }

    Logger.log(`Portfolio ${portfolioId} not found in AllPortfolios sheet`);
    return {
      currentValue: 0,
      totalInvested: 0,
      unrealizedGainLoss: 0,
      realizedGainLoss: 0
    };

  } catch (error) {
    logError('getPortfolioSummary', error);
    return {
      currentValue: 0,
      totalInvested: 0,
      unrealizedGainLoss: 0,
      realizedGainLoss: 0
    };
  }
}

/**
 * Get member's portfolios with detailed P&L (CACHED)
 */
function getMemberPortfolios(memberId) {
  // Use cached portfolios if available, otherwise fetch and cache
  if (!allPortfoliosCache) {
    allPortfoliosCache = getAllPortfolios();
  }

  const portfolios = allPortfoliosCache;
  const memberPortfolios = [];

  portfolios.forEach(portfolio => {
    // Check if this portfolio belongs to this member
    const accountId = portfolio.investmentAccountId;
    const account = getInvestmentAccountById(accountId);

    // DEBUG: Log account details
    console.log('DEBUG getMemberPortfolios - Portfolio:', portfolio.portfolioName);
    console.log('DEBUG getMemberPortfolios - Account ID:', accountId);
    console.log('DEBUG getMemberPortfolios - Account found:', account);
    if (account) {
      console.log('DEBUG - platformBroker:', account.platformBroker);
      console.log('DEBUG - accountClientId:', account.accountClientId);
      console.log('DEBUG - registeredEmail:', account.registeredEmail);
      console.log('DEBUG - registeredPhone:', account.registeredPhone);
    }

    if (account && account.memberId === memberId) {
      const summary = getPortfolioSummary(portfolio.portfolioId);

      memberPortfolios.push({
        portfolioId: portfolio.portfolioId,
        portfolioName: portfolio.portfolioName,
        investmentAccountId: portfolio.investmentAccountId,
        accountName: account.accountName,
        platformBroker: account.platformBroker || '',
        accountClientId: account.accountClientId || '',
        dematDpId: account.dematDpId || '',
        registeredEmail: account.registeredEmail || '',
        registeredPhone: account.registeredPhone || '',
        currentValue: summary.currentValue || 0,
        totalInvested: summary.totalInvested || 0,
        unrealizedPL: summary.unrealizedGainLoss || 0,
        realizedPL: summary.realizedGainLoss || 0,
        totalPL: (summary.unrealizedGainLoss || 0) + (summary.realizedGainLoss || 0),
        percentPL: summary.totalInvested > 0 ?
          (((summary.unrealizedGainLoss || 0) + (summary.realizedGainLoss || 0)) / summary.totalInvested) * 100 : 0
      });
    }
  });

  return memberPortfolios;
}

/**
 * Get member's other investments
 */
function getMemberOtherInvestments(memberId) {
  const sheet = getSheet(CONFIG.otherInvestmentsSheet);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[1]; // Row 2 is headers
  const investments = [];

  for (let i = 3; i <= sheet.getLastRow(); i++) { // Data starts from row 3
    const row = data[i - 1];
    const rowMemberId = row[4]; // Column E: Family Member ID
    const status = row[13]; // Column N: Status

    if (rowMemberId === memberId && status === 'Active') {
      investments.push({
        investmentId: row[0],
        investmentType: row[1],
        investmentCategory: row[2],
        investmentName: row[3],
        investedAmount: row[7] || 0,
        currentValue: row[8] || 0,
        gainLoss: (row[8] || 0) - (row[7] || 0)
      });
    }
  }

  return investments;
}

/**
 * Get member's bank accounts total value
 */
function getMemberBankAccountsValue(memberId) {
  // Bank accounts don't store balance in the current schema
  // This would need to be added if you want to track bank balances
  // For now, return 0 or implement if you add a balance column
  return 0;
}

/**
 * Get member's total liabilities
 */
function getMemberLiabilitiesValue(memberId) {
  const sheet = getSheet(CONFIG.liabilitiesSheet);
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  let total = 0;

  for (let i = 3; i <= sheet.getLastRow(); i++) {
    const row = data[i - 1];
    const rowMemberId = row[3]; // Column D: Family Member ID
    const outstandingBalance = row[5]; // Column F: Outstanding Balance
    const status = row[9]; // Column J: Status

    if (rowMemberId === memberId && status === 'Active') {
      total += parseFloat(outstandingBalance) || 0;
    }
  }

  return total;
}

/**
 * Get investment account by ID
 */
function getInvestmentAccountById(accountId) {
  const sheet = getSheet(CONFIG.investmentAccountsSheet);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  for (let i = 3; i <= sheet.getLastRow(); i++) {
    const row = data[i - 1];
    if (row[0] === accountId) {
      return {
        accountId: row[0],           // Column A
        accountName: row[1],         // Column B
        memberId: row[2],            // Column C
        memberName: row[3],          // Column D
        bankAccountId: row[4],       // Column E
        bankAccountName: row[5],     // Column F
        accountType: row[6],         // Column G
        platformBroker: row[7],      // Column H
        accountClientId: row[8],     // Column I - ADDED!
        dematDpId: row[9],           // Column J - ADDED!
        registeredEmail: row[10],    // Column K - ADDED!
        registeredPhone: row[11],    // Column L - ADDED!
        status: row[12],             // Column M
        createdDate: row[13] ? row[13].toString() : '',  // Column N
        lastUpdated: row[14] ? row[14].toString() : ''   // Column O
      };
    }
  }

  return null;
}

/**
 * Refresh dashboard with new family-centric layout
 */
function refreshDashboard() {
  try {
    const dashboardSheet = getSheet('Dashboard');
    if (!dashboardSheet) {
      return { success: false, error: 'Dashboard sheet not found' };
    }

    // Clear existing content (except row 1 title)
    const lastRow = dashboardSheet.getMaxRows();
    if (lastRow > 1) {
      dashboardSheet.getRange(2, 1, lastRow - 1, 7).clear();
    }

    // Get family wealth data
    const familyData = getFamilyWealthData();
    if (!familyData.success) {
      return { success: false, error: familyData.error };
    }

    // Render dashboard
    renderDashboard(dashboardSheet, familyData.data);

    return { success: true, message: 'Dashboard refreshed successfully!' };

  } catch (error) {
    logError('refreshDashboard', error);
    return { success: false, error: error.message };
  }
}

/**
 * Render complete dashboard
 */
function renderDashboard(sheet, familyData) {
  let currentRow = 2;

  // TITLE ROW
  sheet.getRange(currentRow, 1, 1, 7).merge();
  sheet.getRange(currentRow, 1).setValue('💰 CAPITAL FRIENDS - FAMILY WEALTH DASHBOARD');
  sheet.getRange(currentRow, 1).setBackground('#10b981').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  currentRow += 2;

  // FAMILY-WIDE SUMMARY
  currentRow = renderFamilySummary(sheet, currentRow, familyData);
  currentRow += 2;

  // OVERALL ASSET ALLOCATION
  currentRow = renderOverallAssetAllocation(sheet, currentRow, familyData);
  currentRow += 2;

  // FAMILY MEMBER BREAKDOWN
  familyData.members.forEach(member => {
    currentRow = renderMemberSection(sheet, currentRow, member);
    currentRow += 1;
  });

  // REBALANCING ALERTS
  currentRow = renderRebalancingAlerts(sheet, currentRow);

  // Apply formatting
  formatDashboardSheetV2(sheet);
}

/**
 * Render family-wide summary section
 */
function renderFamilySummary(sheet, startRow, familyData) {
  // Section header
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue('📊 FAMILY WEALTH SUMMARY');
  sheet.getRange(startRow, 1).setBackground('#1f2937').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14);
  startRow++;

  // Metric cards (4 columns)
  const metrics = [
    { label: 'Total Wealth (Net Worth)', value: familyData.totalWealth },
    { label: 'Total Assets', value: familyData.totalAssets },
    { label: 'Total Liabilities', value: familyData.totalLiabilities },
    { label: 'Total Mutual Funds', value: familyData.totalMutualFunds }
  ];

  metrics.forEach((metric, index) => {
    const col = index + 1;
    sheet.getRange(startRow, col).setValue(metric.label);
    sheet.getRange(startRow + 1, col).setValue(metric.value);

    // Styling
    sheet.getRange(startRow, col).setBackground('#111827').setFontColor('#9ca3af').setFontSize(9);
    sheet.getRange(startRow + 1, col).setBackground('#1f2937').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(13).setNumberFormat('₹#,##0.00');
  });

  return startRow + 2;
}

/**
 * Render overall asset allocation
 */
function renderOverallAssetAllocation(sheet, startRow, familyData) {
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue('📈 OVERALL ASSET ALLOCATION');
  sheet.getRange(startRow, 1).setBackground('#1f2937').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14);
  startRow++;

  // Table headers
  sheet.getRange(startRow, 1).setValue('Asset Type');
  sheet.getRange(startRow, 2).setValue('Value (₹)');
  sheet.getRange(startRow, 3).setValue('Percentage');
  sheet.getRange(startRow, 1, 1, 3).setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(11);
  startRow++;

  // Data rows
  const assetTypes = [
    { name: '🏦 Bank Accounts', value: familyData.totalBankAccounts },
    { name: '📊 Mutual Funds', value: familyData.totalMutualFunds },
    { name: '💎 Other Investments', value: familyData.totalOtherInvestments }
  ];

  assetTypes.forEach(asset => {
    const percentage = familyData.totalAssets > 0 ? (asset.value / familyData.totalAssets) * 100 : 0;

    sheet.getRange(startRow, 1).setValue(asset.name);
    sheet.getRange(startRow, 2).setValue(asset.value);
    sheet.getRange(startRow, 3).setValue(percentage / 100);

    sheet.getRange(startRow, 1).setBackground('#1f2937').setFontColor('#e5e7eb');
    sheet.getRange(startRow, 2).setBackground('#1f2937').setFontColor('#e5e7eb')
      .setNumberFormat('₹#,##0.00');
    sheet.getRange(startRow, 3).setBackground('#1f2937').setFontColor('#e5e7eb')
      .setNumberFormat('0.00%');

    startRow++;
  });

  return startRow;
}

/**
 * Render member section (portfolios + other investments)
 */
function renderMemberSection(sheet, startRow, member) {
  // Member header
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue(`👤 ${member.memberName} - Net Worth: ₹${member.netWorth.toFixed(2)}`);
  sheet.getRange(startRow, 1).setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(13);
  startRow++;

  // Member summary cards
  const memberMetrics = [
    { label: 'Total Assets', value: member.totalAssets },
    { label: 'Mutual Funds', value: member.mutualFunds.currentValue },
    { label: 'Other Investments', value: member.assetAllocation.otherInvestments.value },
    { label: 'Liabilities', value: member.totalLiabilities }
  ];

  memberMetrics.forEach((metric, index) => {
    const col = index + 1;
    sheet.getRange(startRow, col).setValue(metric.label);
    sheet.getRange(startRow + 1, col).setValue(metric.value);

    sheet.getRange(startRow, col).setBackground('#1e3a8a').setFontColor('#93c5fd').setFontSize(8);
    sheet.getRange(startRow + 1, col).setBackground('#064e3b').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(11).setNumberFormat('₹#,##0.00');
  });
  startRow += 2;

  // Member's Portfolios
  if (member.portfolios && member.portfolios.length > 0) {
    member.portfolios.forEach(portfolio => {
      startRow = renderPortfolio(sheet, startRow, portfolio);
    });
  }

  // Member's Other Investments
  if (member.otherInvestments && member.otherInvestments.length > 0) {
    startRow = renderOtherInvestments(sheet, startRow, member.otherInvestments);
  }

  return startRow;
}

/**
 * Render portfolio section
 */
function renderPortfolio(sheet, startRow, portfolio) {
  // Portfolio header
  sheet.getRange(startRow, 1, 1, 5).merge();
  sheet.getRange(startRow, 1).setValue(`📱 ${portfolio.portfolioName} → ${portfolio.platformBroker}`);
  sheet.getRange(startRow, 1).setBackground('#374151').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(11);
  startRow++;

  // Portfolio metrics
  const portfolioMetrics = [
    { label: 'Invested', value: portfolio.totalInvested },
    { label: 'Current Value', value: portfolio.currentValue },
    { label: 'Unrealized P&L', value: portfolio.unrealizedPL },
    { label: 'Realized P&L', value: portfolio.realizedPL },
    { label: 'Total P&L', value: portfolio.totalPL }
  ];

  portfolioMetrics.forEach((metric, index) => {
    const col = index + 1;
    sheet.getRange(startRow, col).setValue(metric.label);
    sheet.getRange(startRow + 1, col).setValue(metric.value);

    sheet.getRange(startRow, col).setBackground('#1e3a8a').setFontColor('#93c5fd').setFontSize(8);

    const cellColor = metric.value >= 0 ? '#064e3b' : '#7f1d1d';
    const fontColor = metric.value >= 0 ? '#10b981' : '#ef4444';

    sheet.getRange(startRow + 1, col).setBackground(cellColor).setFontColor(fontColor)
      .setFontWeight('bold').setFontSize(10).setNumberFormat('₹#,##0.00');
  });
  startRow += 2;

  return startRow;
}

/**
 * Render other investments section
 */
function renderOtherInvestments(sheet, startRow, investments) {
  sheet.getRange(startRow, 1, 1, 5).merge();
  sheet.getRange(startRow, 1).setValue('💎 Other Investments');
  sheet.getRange(startRow, 1).setBackground('#374151').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(11);
  startRow++;

  // Table headers
  const headers = ['Investment Type', 'Investment Name', 'Invested', 'Current Value', 'Gain/Loss'];
  headers.forEach((header, index) => {
    sheet.getRange(startRow, index + 1).setValue(header);
  });
  sheet.getRange(startRow, 1, 1, 5).setBackground('#111827').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(10);
  startRow++;

  // Data rows
  investments.forEach(inv => {
    sheet.getRange(startRow, 1).setValue(inv.investmentType);
    sheet.getRange(startRow, 2).setValue(inv.investmentName);
    sheet.getRange(startRow, 3).setValue(inv.investedAmount);
    sheet.getRange(startRow, 4).setValue(inv.currentValue);
    sheet.getRange(startRow, 5).setValue(inv.gainLoss);

    sheet.getRange(startRow, 1, 1, 5).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(9);
    sheet.getRange(startRow, 3, 1, 2).setNumberFormat('₹#,##0.00');

    const plColor = inv.gainLoss >= 0 ? '#10b981' : '#ef4444';
    sheet.getRange(startRow, 5).setFontColor(plColor).setNumberFormat('₹#,##0.00');

    startRow++;
  });

  return startRow + 1;
}

/**
 * Render rebalancing alerts
 */
function renderRebalancingAlerts(sheet, startRow) {
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue('⚖️ REBALANCING ALERTS');
  sheet.getRange(startRow, 1).setBackground('#1f2937').setFontColor('#e5e7eb')
    .setFontWeight('bold').setFontSize(14);
  startRow++;

  const alerts = getRebalancingAlerts();

  if (alerts.success && alerts.alerts && alerts.alerts.length > 0) {
    // Table headers
    const headers = ['Portfolio', 'Asset Class', 'Target %', 'Current %', 'Deviation', 'Action', 'Priority'];
    headers.forEach((header, index) => {
      sheet.getRange(startRow, index + 1).setValue(header);
    });
    sheet.getRange(startRow, 1, 1, 7).setBackground('#111827').setFontColor('#e5e7eb')
      .setFontWeight('bold').setFontSize(10);
    startRow++;

    // Alert rows
    alerts.alerts.forEach(alert => {
      sheet.getRange(startRow, 1).setValue(alert.portfolioName);
      sheet.getRange(startRow, 2).setValue(alert.assetClass);
      sheet.getRange(startRow, 3).setValue(alert.targetPercent / 100);
      sheet.getRange(startRow, 4).setValue(alert.currentPercent / 100);
      sheet.getRange(startRow, 5).setValue(alert.deviation / 100);
      sheet.getRange(startRow, 6).setValue(alert.action);
      sheet.getRange(startRow, 7).setValue(alert.priority);

      sheet.getRange(startRow, 1, 1, 5).setBackground('#1f2937').setFontColor('#e5e7eb').setFontSize(9);
      sheet.getRange(startRow, 3, 1, 3).setNumberFormat('0.00%');

      sheet.getRange(startRow, 6).setBackground(alert.actionColor).setFontColor('#ffffff').setFontWeight('bold');
      const priorityColor = alert.priority === 'HIGH' ? '#ef4444' : '#f59e0b';
      sheet.getRange(startRow, 7).setBackground(priorityColor).setFontColor('#ffffff').setFontWeight('bold');

      startRow++;
    });
  } else {
    sheet.getRange(startRow, 1, 1, 7).merge();
    sheet.getRange(startRow, 1).setValue('All portfolios are balanced ✅');
    sheet.getRange(startRow, 1).setBackground('#d1fae5').setFontColor('#065f46')
      .setHorizontalAlignment('center').setFontWeight('bold');
    startRow++;
  }

  return startRow;
}

/**
 * Format dashboard sheet v2
 */
function formatDashboardSheetV2(sheet) {
  // Set column widths
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidths(2, 6, 120);

  // Freeze title row
  sheet.setFrozenRows(1);

  // Apply borders to all cells
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  sheet.getRange(1, 1, lastRow, lastCol).setBorder(
    true, true, true, true, true, true,
    '#374151', SpreadsheetApp.BorderStyle.SOLID
  );
}

/**
 * Get rebalancing alerts for all portfolios
 */
function getRebalancingAlerts() {
  try {
    const portfolios = getAllPortfolios();
    if (!portfolios || portfolios.length === 0) {
      return {
        success: true,
        alerts: [],
        summary: 'No portfolios to analyze'
      };
    }

    const alerts = [];

    portfolios.forEach(portfolio => {
      const portfolioId = portfolio.portfolioId;
      const portfolioName = portfolio.portfolioName;
      const rebalanceThreshold = portfolio.rebalanceThreshold || 0.05; // Default 5%

      // Get asset allocation targets
      const allocations = getAssetAllocationsForPortfolio(portfolioId);
      if (!allocations || allocations.length === 0) {
        return; // Skip if no allocations defined
      }

      // Get current holdings
      const holdings = getCurrentHoldings(portfolioId);
      if (!holdings || holdings.totalValue === 0) {
        return; // Skip if no holdings
      }

      // Calculate current allocation percentages
      const currentAllocation = {};
      holdings.funds.forEach(fund => {
        const assetClass = fund.assetClass || 'Other';
        if (!currentAllocation[assetClass]) {
          currentAllocation[assetClass] = 0;
        }
        currentAllocation[assetClass] += fund.currentValue;
      });

      // Convert to percentages
      Object.keys(currentAllocation).forEach(assetClass => {
        currentAllocation[assetClass] = (currentAllocation[assetClass] / holdings.totalValue) * 100;
      });

      // Compare with targets and generate alerts
      allocations.forEach(allocation => {
        const assetClass = allocation.assetClass;
        const targetPercent = allocation.targetPercent || 0;
        const currentPercent = currentAllocation[assetClass] || 0;
        const deviation = currentPercent - targetPercent;
        const deviationAbs = Math.abs(deviation);

        // Alert if deviation exceeds threshold
        if (deviationAbs > (rebalanceThreshold * 100)) {
          const action = deviation > 0 ? 'REDUCE' : 'INCREASE';
          const actionColor = deviation > 0 ? '#ef4444' : '#10b981';
          const deviationAmount = (deviationAbs / 100) * holdings.totalValue;

          alerts.push({
            portfolioName: portfolioName,
            assetClass: assetClass,
            targetPercent: targetPercent,
            currentPercent: currentPercent,
            deviation: deviation,
            deviationAbs: deviationAbs,
            deviationAmount: deviationAmount,
            action: action,
            actionColor: actionColor,
            priority: deviationAbs > 10 ? 'HIGH' : 'MEDIUM'
          });
        }
      });
    });

    // Sort alerts by deviation (highest first)
    alerts.sort((a, b) => b.deviationAbs - a.deviationAbs);

    return {
      success: true,
      alerts: alerts,
      summary: alerts.length > 0 ? `${alerts.length} rebalancing action(s) needed` : 'All portfolios are balanced'
    };

  } catch (error) {
    logError('getRebalancingAlerts', error);
    return {
      success: false,
      alerts: [],
      error: error.message
    };
  }
}

/**
 * Create Dashboard sheet during ONE-CLICK SETUP
 */
function createDashboardSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.insertSheet('Dashboard');

  // Set tab color
  sheet.setTabColor('#10b981');

  // Add initial title
  sheet.getRange('A1').setValue('💰 CAPITAL FRIENDS - FAMILY WEALTH DASHBOARD');
  sheet.getRange('A1').setBackground('#10b981').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(16).setHorizontalAlignment('center');
  sheet.getRange('A1:G1').merge();

  // Set column widths
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidths(2, 6, 120);

  // Freeze title row
  sheet.setFrozenRows(1);

  // Add instruction
  sheet.getRange('A3').setValue('Click "Dashboard & Reports → Refresh Dashboard" to generate your family wealth report');
  sheet.getRange('A3').setFontColor('#6b7280').setFontStyle('italic').setFontSize(12);
  sheet.getRange('A3:G3').merge();

  log('Dashboard sheet created');
  return sheet;
}

// ============================================================================
// END OF DASHBOARDDATA.GS
// ============================================================================

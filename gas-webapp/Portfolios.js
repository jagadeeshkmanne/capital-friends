/**
 * ============================================================================
 * PORTFOLIOS.GS - Portfolio Management for Capital Friends V2
 * ============================================================================
 */

/**
 * Add new portfolio
 * @param {Object} formData - Portfolio form data
 * @returns {Object} - Success/error response
 */
function processAddPortfolio(formData) {
  try {
    log('processAddPortfolio called with: ' + JSON.stringify(formData));

    let portfolioName = formData.portfolioName.trim();

    // Add PFL- prefix if not present
    if (!portfolioName.startsWith('PFL-')) {
      portfolioName = 'PFL-' + portfolioName;
    }

    const investmentAccount = (formData.investmentAccount || formData.investmentAccountId || '').toString().trim();
    const initialInvestment = parseFloat(formData.initialInvestment) || 0;
    const sipTarget = parseFloat(formData.sipTarget) || 0;
    const lumpsumTarget = parseFloat(formData.lumpsumTarget) || 0;
    const rebalanceThreshold = (parseFloat(formData.rebalanceThreshold) || 5) / 100;  // Convert percentage to decimal

    log('Parsed values - Portfolio: ' + portfolioName + ', Initial Investment: ' + initialInvestment);

    // Validate
    if (!portfolioName || portfolioName === 'PFL-') {
      return { success: false, message: 'Portfolio name is required' };
    }
    if (!investmentAccount) {
      return { success: false, message: 'Investment account is required' };
    }

    const spreadsheet = getSpreadsheet();
    log('Got spreadsheet');

    // Check if portfolio sheet already exists (by ID — sheet tabs use portfolioId)
    // Note: duplicate display names are allowed (e.g., two kids can have "Long Term Core")

    // Add to metadata sheet
    const metadataSheet = spreadsheet.getSheetByName(CONFIG.portfolioMetadataSheet);
    if (!metadataSheet) {
      return { success: false, message: 'AllPortfolios sheet not found. Please run ONE-CLICK SETUP first.' };
    }

    // Generate Portfolio ID
    const lastRow = metadataSheet.getLastRow();
    const existingIds = lastRow > 2 ? metadataSheet.getRange(3, 1, lastRow - 2, 1).getValues().map(row => row[0]) : [];
    const portfolioId = generateId('PFL', existingIds);
    log('Generated Portfolio ID: ' + portfolioId);

    log('Creating portfolio sheet');
    // Create portfolio sheet FIRST so formulas can reference it
    createPortfolioSheet(portfolioName, portfolioId);

    log('Adding to metadata sheet');

    // Formulas for calculated columns
    // New structure: A=Portfolio ID, B=Portfolio Name, C=Investment Account, D=Initial Investment, E=Total Investment,
    // F=SIP Target, G=Lumpsum Target, H=Rebalance Threshold, I=Current Value,
    // J=Unrealized P&L ₹, K=Unrealized P&L %, L=Realized P&L ₹, M=Realized P&L %, N=Total P&L ₹, O=Total P&L %, P=Status
    // Current Value = sum from portfolio sheet (sheet tab = portfolioId)
    const currentValueFormula = `=SUM('${portfolioId}'!$H$4:$H$1000)`;

    // Get row number for this portfolio (for formulas)
    const rowNum = metadataSheet.getLastRow() + 1;

    // Total Investment — matches on TransactionHistory column B (portfolioId) using A{row} cell reference
    // IF D > 0: user-entered original investment + SIP + LUMPSUM - WITHDRAWAL
    // IF D = 0: auto-calculate from INITIAL + SIP + LUMPSUM - WITHDRAWAL
    // EXCLUDES SWITCH transactions: internal movements, not new money
    const totalInvestmentFormula = `=IF(D${rowNum}>0,D${rowNum},SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,A${rowNum},TransactionHistory!$F:$F,"BUY",TransactionHistory!$G:$G,"INITIAL"))+SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,A${rowNum},TransactionHistory!$F:$F,"BUY",TransactionHistory!$G:$G,"SIP")+SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,A${rowNum},TransactionHistory!$F:$F,"BUY",TransactionHistory!$G:$G,"LUMPSUM")-SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,A${rowNum},TransactionHistory!$F:$F,"SELL",TransactionHistory!$G:$G,"WITHDRAWAL")`;

    const totalPLAmountFormula = `=I${rowNum}-E${rowNum}`;
    const totalPLPercentFormula = `=IF(E${rowNum}=0,0,N${rowNum}/E${rowNum})`;

    // Realized P&L — matches on TransactionHistory column B (portfolioId)
    const realizedPLAmountFormula = `=SUMIFS(TransactionHistory!$M:$M,TransactionHistory!$B:$B,A${rowNum},TransactionHistory!$F:$F,"SELL",TransactionHistory!$G:$G,"WITHDRAWAL")`;

    // Realized P&L % = Realized P&L / Total Investment
    const realizedPLPercentFormula = `=IF(E${rowNum}=0,0,L${rowNum}/E${rowNum})`;

    // Unrealized P&L ₹ = Total P&L - Realized P&L
    // This gives us the P&L from current holdings + any SWITCH gains
    const unrealizedPLAmountFormula = `=N${rowNum}-L${rowNum}`;

    // Unrealized P&L % = Unrealized P&L / Total Investment
    const unrealizedPLPercentFormula = `=IF(E${rowNum}=0,0,J${rowNum}/E${rowNum})`;

    metadataSheet.appendRow([
      portfolioId,                // A: Portfolio ID
      portfolioName,              // B: Portfolio Name
      investmentAccount,          // C: Investment Account
      initialInvestment,          // D: Initial Investment (user input)
      totalInvestmentFormula,     // E: Total Investment (formula: Initial + BUY - SELL, excluding INITIAL/SWITCH)
      sipTarget,                  // F: SIP Target
      lumpsumTarget,              // G: Lumpsum Target
      rebalanceThreshold,         // H: Rebalance Threshold
      currentValueFormula,        // I: Current Value (formula)
      unrealizedPLAmountFormula,  // J: Unrealized P&L (₹)
      unrealizedPLPercentFormula, // K: Unrealized P&L (%)
      realizedPLAmountFormula,    // L: Realized P&L (₹)
      realizedPLPercentFormula,   // M: Realized P&L (%)
      totalPLAmountFormula,       // N: Total P&L (₹)
      totalPLPercentFormula,      // O: Total P&L (%)
      "Active"                    // P: Status
    ]);

    // Apply formatting to the new row
    const newRow = metadataSheet.getLastRow();
    applyDataRowFormatting(metadataSheet, newRow, newRow, 16);

    // Apply alternating row background colors for better readability
    // Light background for basic info columns
    metadataSheet.getRange(newRow, 1, 1, 9).setBackground("#f9fafb");  // A-I: Light Gray

    // Colored backgrounds for P&L columns (matching group headers)
    metadataSheet.getRange(newRow, 10, 1, 2).setBackground("#d1fae5");  // J-K: Unrealized P&L - Light Green
    metadataSheet.getRange(newRow, 12, 1, 2).setBackground("#dbeafe");  // L-M: Realized P&L - Light Blue
    metadataSheet.getRange(newRow, 14, 1, 2).setBackground("#ffffff");  // N-O: Total P&L - White (for conditional formatting)
    metadataSheet.getRange(newRow, 16, 1, 1).setBackground("#f9fafb");  // P: Status - Light Gray

    // Apply conditional formatting to Total P&L columns (green for positive, red for negative)
    applyPLConditionalFormatting(metadataSheet, newRow);

    log('Portfolio created successfully');
    return { success: true, message: `Portfolio "${portfolioName}" created successfully!` };

  } catch (error) {
    log('Error in processAddPortfolio: ' + error.message);
    log('Stack trace: ' + error.stack);
    return { success: false, message: 'Error: ' + error.message };
  }
}

/**
 * Create portfolio sheet with template
 * @param {string} portfolioName - Portfolio name
 * @param {string} portfolioId - Portfolio ID
 */
function createPortfolioSheet(portfolioName, portfolioId) {
  const spreadsheet = getSpreadsheet();

  // Find the "AllPortfolios" sheet to insert the new portfolio sheet after it
  const portfoliosSheet = spreadsheet.getSheetByName(CONFIG.portfolioMetadataSheet);
  let portfolioSheet;

  if (portfoliosSheet) {
    // Insert after AllPortfolios sheet — use portfolioId as sheet tab name (unique, never changes)
    const portfoliosIndex = portfoliosSheet.getIndex();
    portfolioSheet = spreadsheet.insertSheet(portfolioId, portfoliosIndex);
  } else {
    portfolioSheet = spreadsheet.insertSheet(portfolioId);
  }

  const metadataSheetName = CONFIG.portfolioMetadataSheet;

  // Helper formulas — all use $Q$1 (portfolioId) to lookup in AllPortfolios by column A (ID)
  const sipFormula = `IFERROR(VLOOKUP($Q$1, ${metadataSheetName}!$A:$F, 6, FALSE), 0)`;
  const lumpsumFormula = `IFERROR(VLOOKUP($Q$1, ${metadataSheetName}!$A:$G, 7, FALSE), 0)`;
  const thresholdFormula = `IFERROR(VLOOKUP($Q$1,${metadataSheetName}!$A:$H,8,FALSE),0.05)*100`;
  const totalInvestmentFormula = `SUMIF($A:$A,"*",$E:$E)`;  // Sum all fund investments in portfolio

  // Insert watermark row FIRST (span all columns)
  portfolioSheet.insertRowBefore(1);
  const watermarkCell = portfolioSheet.getRange(1, 1, 1, 16);  // Span all 16 columns (A-P)
  watermarkCell.merge();
  watermarkCell.setValue('Developed by Jagadeesh Manne | 📧 jagadeesh.k.manne@gmail.com | 💰 UPI: jagadeeshmanne.hdfc@kphdfc');
  watermarkCell.setFontSize(9);
  watermarkCell.setFontColor('#6b7280');
  watermarkCell.setFontWeight('bold');
  watermarkCell.setHorizontalAlignment('center');
  watermarkCell.setBackground('#f5f5f5');

  // Protect watermark row
  const protection = watermarkCell.protect().setDescription('Watermark - Do not delete');
  protection.setWarningOnly(true);

  // HIDDEN: Store Portfolio ID in cell Q1 (column 17) for formula reference
  // This allows formulas to dynamically reference the portfolio ID without hardcoding
  portfolioSheet.getRange(1, 17).setValue(portfolioId);
  portfolioSheet.hideColumns(17);  // Hide column Q

  // Row 2: Merged group headers (Fund Info, Current, Target, SIP, Lumpsum, Rebalance, Performance)
  const groupHeaders = [
    "", "", "", "", "", "",  // Code (hidden), Fund, Units, Avg NAV, Current NAV, Investment (6 columns)
    "Current", "",  // Merged: Current Allocation %, Current Value (2 columns)
    "Target", "",  // Merged: Target Allocation %, Target Value (2 columns)
    "SIP", "",  // Merged: Ongoing SIP, Rebalance SIP (2 columns)
    "Lumpsum", "",  // Merged: Target Lumpsum, Rebalance Lumpsum (2 columns)
    "Rebalance",  // Buy/Sell (1 column)
    ""  // P&L (last column - no group header)
  ];
  portfolioSheet.getRange(2, 1, 1, 16).setValues([groupHeaders]);

  // Merge group headers
  portfolioSheet.getRange(2, 7, 1, 2).merge();  // Current (2 columns: Allocation %, Value)
  portfolioSheet.getRange(2, 9, 1, 2).merge();  // Target (2 columns: Allocation %, Value)
  portfolioSheet.getRange(2, 11, 1, 2).merge();  // SIP (2 columns: Ongoing, Rebalance)
  portfolioSheet.getRange(2, 13, 1, 2).merge();  // Lumpsum (2 columns: Target, Rebalance)

  // Format group headers with proper colors
  portfolioSheet.getRange(2, 7, 1, 2).setBackground("#3b82f6").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Current - Blue
  portfolioSheet.getRange(2, 9, 1, 2).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Target - Green
  portfolioSheet.getRange(2, 11, 1, 2).setBackground("#34d399").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // SIP - Light Green
  portfolioSheet.getRange(2, 13, 1, 2).setBackground("#a78bfa").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Lumpsum - Light Purple
  portfolioSheet.getRange(2, 15, 1, 1).setBackground("#f59e0b").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // Rebalance - Orange

  // ATH group header (R-S, columns 18-19, skipping hidden Q=17)
  portfolioSheet.getRange(2, 18, 1, 2).setValues([["ATH", ""]]);
  portfolioSheet.getRange(2, 18, 1, 2).merge();
  portfolioSheet.getRange(2, 18, 1, 2).setBackground("#ff6f00").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center").setFontSize(10);  // ATH - Deep Orange

  // Row 3: Column headers (16 columns total)
  // Structure: Scheme Code (hidden) | Fund Info (5) | Current (2) | Target (2) | SIP (2) | Lumpsum (2) | Rebalance (1) | Performance (1)
  const headers = [
    "Scheme Code", "Fund", "Units", "Avg NAV ₹", "Current NAV ₹", "Investment ₹",  // Scheme Code (hidden) + Fund Info (5)
    "Current Allocation %", "Current Value ₹",  // Current (2)
    "Target Allocation %", "Target Value ₹",  // Target (2)
    "Ongoing SIP ₹\n(Target %)", "Rebalance SIP ₹\n(Smart)",  // SIP (2)
    "Target Lumpsum ₹\n(Target %)", "Rebalance Lumpsum ₹\n(Smart)",  // Lumpsum (2)
    "Buy/Sell ₹",  // Rebalance (1)
    "P&L ₹"  // Performance (1)
  ];

  portfolioSheet.getRange(3, 1, 1, headers.length).setValues([headers]);

  // ATH column headers (R-S, columns 18-19)
  portfolioSheet.getRange(3, 18).setValue("ATH NAV ₹");
  portfolioSheet.getRange(3, 19).setValue("% Below ATH");

  // Format header row with better styling (including ATH columns)
  const headerRange = portfolioSheet.getRange(3, 1, 1, 19);  // Extended to column S
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4a5568");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontSize(10);
  headerRange.setWrap(true);
  headerRange.setVerticalAlignment("middle");
  headerRange.setBorder(true, true, true, true, true, true, "#2d3748", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Set header row height for better visibility of multiline headers
  portfolioSheet.setRowHeight(3, 50);

  // Hide Fund Code column (A) - used for lookups but hidden from view
  portfolioSheet.hideColumns(1);  // Hide Scheme Code (A)

  // Set optimal column widths for better readability
  // Column widths are set to prevent text wrapping and ensure rupee/percentage symbols display properly

  // B: Fund (250px - wide for long fund names)
  portfolioSheet.setColumnWidth(2, 250);

  // C: Units (100px - 3 decimal places)
  portfolioSheet.setColumnWidth(3, 100);

  // D: Avg NAV ₹ (120px - currency with symbol)
  portfolioSheet.setColumnWidth(4, 120);

  // E: Current NAV ₹ (130px - currency with symbol, slightly wider for "Current NAV ₹")
  portfolioSheet.setColumnWidth(5, 130);

  // F: Investment ₹ (120px - currency with symbol)
  portfolioSheet.setColumnWidth(6, 120);

  // G: Current Allocation % (140px - percentage with multiline header)
  portfolioSheet.setColumnWidth(7, 140);

  // H: Current Value ₹ (130px - currency with symbol)
  portfolioSheet.setColumnWidth(8, 130);

  // I: Target Allocation % (135px - percentage with multiline header)
  portfolioSheet.setColumnWidth(9, 135);

  // J: Target Value ₹ (120px - currency with symbol)
  portfolioSheet.setColumnWidth(10, 120);

  // K: Ongoing SIP ₹ (130px - currency with multiline header)
  portfolioSheet.setColumnWidth(11, 130);

  // L: Rebalance SIP ₹ (140px - currency with multiline header)
  portfolioSheet.setColumnWidth(12, 140);

  // M: Target Lumpsum ₹ (140px - currency with multiline header)
  portfolioSheet.setColumnWidth(13, 140);

  // N: Rebalance Lumpsum ₹ (160px - currency with multiline header, longest header)
  portfolioSheet.setColumnWidth(14, 160);

  // O: Buy/Sell ₹ (110px - currency with symbol)
  portfolioSheet.setColumnWidth(15, 110);

  // P: P&L ₹ (110px - currency with symbol)
  portfolioSheet.setColumnWidth(16, 110);

  // R: ATH NAV ₹ (120px - currency)
  portfolioSheet.setColumnWidth(18, 120);

  // S: % Below ATH (110px - percentage)
  portfolioSheet.setColumnWidth(19, 110);

  // Sample row 4 with formulas (row 1 = watermark, row 2 = group headers, row 3 = column headers)
  // New column order (16 columns total):
  // A=Code (hidden), B=Fund, C=Units, D=Avg NAV ₹, E=Current NAV ₹, F=Investment ₹,
  // G=Current Allocation %, H=Current Value ₹, I=Target Allocation %, J=Target Value ₹,
  // K=Ongoing SIP ₹, L=Rebalance SIP ₹, M=Target Lumpsum ₹, N=Rebalance Lumpsum ₹, O=Buy/Sell ₹, P=P&L ₹

  // Template row - formulas that show empty when no data
  // Fund Code (A) is filled by user/dialog
  // Fund Name (B) - Get directly from MutualFundData using scheme code
  // This works for all funds (whether you own them or not)
  portfolioSheet.getRange("B4").setFormula("=IF(A4=\"\",\"\",IFERROR(VLOOKUP(A4,MutualFundData!$A:$B,2,FALSE),\"Fund not found\"))");

  // C: Units - calculated from transaction history (sum BUY - SELL)
  // TransactionHistory: B=Portfolio ID, D=Fund Code, F=Type (BUY/SELL), H=Units
  // CRITICAL: Must filter by BOTH Portfolio ID AND Fund Code (same fund can be in multiple portfolios)
  // Portfolio ID is stored in hidden cell $Q$1 (column 17)
  portfolioSheet.getRange("C4").setFormula("=IF(A4=\"\",\"\",SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A4,TransactionHistory!$F:$F,\"BUY\")-SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A4,TransactionHistory!$F:$F,\"SELL\"))");

  // D: Avg NAV ₹ - weighted average from BUY transactions
  // TransactionHistory: B=Portfolio ID, D=Fund Code, F=Type, H=Units, J=Total Amount
  // Avg NAV = Total BUY Amount / Total BUY Units
  // CRITICAL: Must filter by BOTH Portfolio ID AND Fund Code
  portfolioSheet.getRange("D4").setFormula("=IF(A4=\"\",\"\",IFERROR(SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A4,TransactionHistory!$F:$F,\"BUY\")/SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A4,TransactionHistory!$F:$F,\"BUY\"),0))");

  // E: Current NAV ₹ - Lookup current NAV from MutualFundData
  // MutualFundData: A=Code, B=Name, C=Category, D=NAV (column 4), E=Date, F=Fund House, G=Type, H=Status
  // Convert A4 to TEXT to match string codes in MutualFundData (avoid number/string mismatch)
  portfolioSheet.getRange("E4").setFormula("=IF(A4=\"\",\"\",IFERROR(VLOOKUP(TEXT(A4,\"0\"),MutualFundData!$A:$H,4,FALSE),0))");

  // F: Investment ₹ - Units × Avg NAV
  portfolioSheet.getRange("F4").setFormula("=IF(OR(A4=\"\",C4=0),\"\",C4*D4)");

  // G: Current Allocation % - (Current Value / Total Portfolio Value) × 100
  portfolioSheet.getRange("G4").setFormula("=IF(A4=\"\",\"\",ROUND(IFERROR(H4/SUM($H$4:$H$1000)*100,0),2))");

  // H: Current Value ₹ - Units × Current NAV
  portfolioSheet.getRange("H4").setFormula("=IF(A4=\"\",\"\",C4*E4)");

  // I: Target Allocation % (user will fill in)
  portfolioSheet.getRange("I4").setValue("");

  // J: Target Value ₹ (calculated: Target % × Total Portfolio Value)
  // Shows what the fund's value should be at target allocation
  portfolioSheet.getRange("J4").setFormula("=IF(OR(A4=\"\",I4=\"\"),\"\",I4/100*SUM($H$4:$H$1000))");

  // K: Ongoing SIP ₹ - Normal SIP based on target allocation
  portfolioSheet.getRange("K4").setFormula(`=IF(OR(A4=\"\",I4=\"\"),\"\",I4/100*${sipFormula})`);

  // L: Rebalance SIP ₹ - Gap-based rebalancing (matches React logic)
  // Overweight funds get ₹0. All SIP goes to underweight funds proportional to their gap.
  // If all funds balanced (no gap), falls back to normal SIP allocation.
  const totalGapFormula = `SUMPRODUCT(IF(A$4:A$1000<>"",IF(J$4:J$1000-H$4:H$1000>0,J$4:J$1000-H$4:H$1000,0),0))`;
  portfolioSheet.getRange("L4").setFormula(`=IF(OR(A4=\"\",I4=\"\"),\"\",IF(${totalGapFormula}=0,I4/100*${sipFormula},IF(J4-H4>0,(J4-H4)/${totalGapFormula}*${sipFormula},0)))`);

  // M: Target Lumpsum ₹ - Simple distribution by target allocation
  portfolioSheet.getRange("M4").setFormula(`=IF(OR(A4=\"\",I4=\"\"),\"\",I4/100*${lumpsumFormula})`);

  // N: Rebalance Lumpsum ₹ - Smart lumpsum distribution to fix imbalance (only when deviation exceeds threshold)
  // When within threshold: shows same as Target Lumpsum (no rebalance adjustment)
  // When outside threshold: allocates more to underweight funds
  portfolioSheet.getRange("N4").setFormula(`=IF(OR(A4=\"\",I4=\"\",${lumpsumFormula}=0),\"\",IF(ABS(G4-I4)>${thresholdFormula},MAX(0,I4/100*(SUM($H$4:$H$1000)+${lumpsumFormula})-H4),I4/100*${lumpsumFormula}))`);

  // O: Buy/Sell ₹ (target value - current value, only when deviation exceeds rebalance threshold)
  // Positive = Underweight (need to buy more), Negative = Overweight (need to sell)
  // Shows 0 when within threshold — no action needed
  portfolioSheet.getRange("O4").setFormula(`=IF(OR(A4=\"\",I4=\"\"),\"\",IF(ABS(G4-I4)>${thresholdFormula},J4-H4,0))`);

  // P: P&L ₹ (Value - Investment)
  portfolioSheet.getRange("P4").setFormula("=IF(A4=\"\",\"\",H4-F4)");

  // R: ATH NAV ₹ - All-Time High NAV from MF_ATH_Data
  portfolioSheet.getRange("R4").setFormula('=IF(A4="","",IFERROR(VLOOKUP(A4*1,MF_ATH_Data!$A:$C,3,FALSE),""))');

  // S: % Below ATH - How far below ATH the fund currently is
  portfolioSheet.getRange("S4").setFormula('=IF(A4="","",IFERROR(VLOOKUP(A4*1,MF_ATH_Data!$A:$G,7,FALSE),""))');

  // Freeze rows (watermark + headers)
  portfolioSheet.setFrozenRows(3);

  // Apply font size 9 to entire sheet
  const maxRows = portfolioSheet.getMaxRows();
  const maxCols = portfolioSheet.getMaxColumns();
  portfolioSheet.getRange(1, 1, maxRows, maxCols).setFontSize(9);

  // Format ALL data rows (4-1000) with proper number formats
  const indianCurrencyFormat = '[>=10000000]₹#,##,##,##0.00;[>=100000]₹#,##,##0.00;₹#,##0.00';
  portfolioSheet.getRange("C4:C1000").setNumberFormat("0.000");  // C: Units (3 decimals)
  portfolioSheet.getRange("D4:D1000").setNumberFormat(indianCurrencyFormat);  // D: Avg NAV ₹
  portfolioSheet.getRange("E4:E1000").setNumberFormat(indianCurrencyFormat);  // E: Current NAV ₹
  portfolioSheet.getRange("F4:F1000").setNumberFormat(indianCurrencyFormat);  // F: Investment ₹
  portfolioSheet.getRange("G4:G1000").setNumberFormat("0.00");  // G: Current Allocation %
  portfolioSheet.getRange("H4:H1000").setNumberFormat(indianCurrencyFormat);  // H: Current Value ₹
  portfolioSheet.getRange("I4:I1000").setNumberFormat("0.00");  // I: Target Allocation %
  portfolioSheet.getRange("J4:J1000").setNumberFormat(indianCurrencyFormat);  // J: Target Value ₹
  portfolioSheet.getRange("K4:K1000").setNumberFormat(indianCurrencyFormat);  // K: Ongoing SIP ₹
  portfolioSheet.getRange("L4:L1000").setNumberFormat(indianCurrencyFormat);  // L: Rebalance SIP ₹
  portfolioSheet.getRange("M4:M1000").setNumberFormat(indianCurrencyFormat);  // M: Target Lumpsum ₹
  portfolioSheet.getRange("N4:N1000").setNumberFormat(indianCurrencyFormat);  // N: Rebalance Lumpsum ₹
  portfolioSheet.getRange("O4:O1000").setNumberFormat(indianCurrencyFormat);  // O: Buy/Sell ₹
  portfolioSheet.getRange("P4:P1000").setNumberFormat(indianCurrencyFormat);  // P: P&L ₹
  portfolioSheet.getRange("R4:R1000").setNumberFormat(indianCurrencyFormat);  // R: ATH NAV ₹
  portfolioSheet.getRange("S4:S1000").setNumberFormat("0.00");  // S: % Below ATH

  // NOTE: Background colors will be applied via conditional formatting below
  // This ensures colors only apply to rows with data (when column A has a Fund Code)

  // Add conditional formatting for background colors (only when column A has data)
  // and font colors for rebalancing columns

  // Background colors for sections (only apply when column A is not empty)
  const fundInfoBgRange = portfolioSheet.getRange("B4:F1000");
  const fundInfoBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#f9fafb")  // Light gray
    .setRanges([fundInfoBgRange])
    .build();

  const currentBgRange = portfolioSheet.getRange("G4:H1000");
  const currentBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#eff6ff")  // Light blue
    .setRanges([currentBgRange])
    .build();

  const targetBgRange = portfolioSheet.getRange("I4:J1000");
  const targetBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#f0fdf4")  // Light green
    .setRanges([targetBgRange])
    .build();

  const sipBgRange = portfolioSheet.getRange("K4:L1000");
  const sipBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#ecfdf5")  // Light emerald
    .setRanges([sipBgRange])
    .build();

  const lumpsumBgRange = portfolioSheet.getRange("M4:N1000");
  const lumpsumBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#f3e8ff")  // Light purple
    .setRanges([lumpsumBgRange])
    .build();

  const rebalanceBgRange = portfolioSheet.getRange("O4:O1000");
  const rebalanceBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#fffbeb")  // Light amber
    .setRanges([rebalanceBgRange])
    .build();

  const athBgRange = portfolioSheet.getRange("R4:S1000");
  const athBgRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#fff3e0")  // Light orange
    .setRanges([athBgRange])
    .build();

  const plBgRange = portfolioSheet.getRange("P4:P1000");
  const plBgRuleBackground = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A4<>""')
    .setBackground("#fef2f2")  // Light red
    .setRanges([plBgRange])
    .build();

  // P&L Column (P): Bold green for profit, Bold red for loss
  const plRange = portfolioSheet.getRange("P4:P1000");
  const plRuleProfit = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)
    .setFontColor('#059669')   // Bold green (emerald-600)
    .setBold(true)
    .setRanges([plRange])
    .build();

  const plRuleLoss = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)
    .setFontColor('#dc2626')   // Bold red (red-600)
    .setBold(true)
    .setRanges([plRange])
    .build();

  // Buy/Sell Column (O): Bold green for buy, Bold red for sell
  const buySellRange = portfolioSheet.getRange("O4:O1000");
  const buySellRuleBuy = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0)  // Buy needed
    .setFontColor('#059669')   // Bold green
    .setBold(true)
    .setRanges([buySellRange])
    .build();

  const buySellRuleSell = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0)  // Sell needed
    .setFontColor('#dc2626')   // Bold red
    .setBold(true)
    .setRanges([buySellRange])
    .build();

  // Apply all conditional format rules
  const rules = portfolioSheet.getConditionalFormatRules();
  rules.push(
    fundInfoBgRule, currentBgRule, targetBgRule, sipBgRule, lumpsumBgRule, rebalanceBgRule, athBgRule, plBgRuleBackground,
    plRuleProfit, plRuleLoss,
    buySellRuleBuy, buySellRuleSell
  );
  portfolioSheet.setConditionalFormatRules(rules);

  // Set tab color (Indigo for portfolio sheets)
  portfolioSheet.setTabColor('#6366f1');

  log(`Portfolio sheet "${portfolioName}" created successfully - clean structure with no summary section`);

  return portfolioSheet;
}

/**
 * Add Portfolio Summary Section with Realized/Unrealized P&L
 * @param {Sheet} sheet - Portfolio sheet
 * @param {string} portfolioId - Portfolio ID
 * @param {string} portfolioName - Portfolio name
 *
 * @deprecated This function is NO LONGER USED. Portfolio sheets should be clean with only fund data rows.
 * Summary/dashboard data should be in a separate sheet or report.
 */
function addPortfolioSummarySection(sheet, portfolioId, portfolioName) {
  const summaryStartRow = 52;  // Start summary after fund rows
  const indianCurrencyFormat = '[>=10000000]₹#,##,##,##0.00;[>=100000]₹#,##,##0.00;₹#,##0.00';

  // Row 52: Blank separator
  sheet.getRange(summaryStartRow, 1, 1, 16).setBackground('#FFFFFF');

  // Row 53: Section Header
  const headerRow = summaryStartRow + 1;
  sheet.getRange(headerRow, 1, 1, 16).merge();
  sheet.getRange(headerRow, 1).setValue('═══════════════ PORTFOLIO SUMMARY ═══════════════')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setBackground('#f3f4f6');

  // Row 54: Current Holdings Header
  const currentRow = summaryStartRow + 2;
  sheet.getRange(currentRow, 1).setValue('CURRENT HOLDINGS (Active Funds)')
    .setFontWeight('bold')
    .setFontSize(9)
    .setBackground('#eff6ff');

  // Row 55: Current Holdings Values
  const currentValuesRow = summaryStartRow + 3;
  sheet.getRange(currentValuesRow, 1).setValue('Total Investment:');
  sheet.getRange(currentValuesRow, 6).setFormula('=SUMIF($C$4:$C$1000,">0",$F$4:$F$1000)')  // Sum Investment where Units > 0
    .setNumberFormat(indianCurrencyFormat)
    .setFontWeight('bold');

  sheet.getRange(currentValuesRow, 8).setValue('Current Value:');
  sheet.getRange(currentValuesRow, 10).setFormula('=SUMIF($C$4:$C$1000,">0",$H$4:$H$1000)')  // Sum Current Value where Units > 0
    .setNumberFormat(indianCurrencyFormat)
    .setFontWeight('bold');

  sheet.getRange(currentValuesRow, 12).setValue('Unrealized P&L:');
  sheet.getRange(currentValuesRow, 14).setFormula('=SUMIF($C$4:$C$1000,">0",$P$4:$P$1000)')  // Sum P&L where Units > 0
    .setNumberFormat(indianCurrencyFormat)
    .setFontWeight('bold');

  // Row 56: Blank
  sheet.getRange(summaryStartRow + 4, 1, 1, 16).setBackground('#FFFFFF');

  // Row 57: Realized P&L Header
  const realizedRow = summaryStartRow + 5;
  sheet.getRange(realizedRow, 1).setValue('REALIZED P&L (From Sold/Switched Funds)')
    .setFontWeight('bold')
    .setFontSize(9)
    .setBackground('#fef3c7');

  // Row 58: Realized P&L Value
  const realizedValuesRow = summaryStartRow + 6;
  sheet.getRange(realizedValuesRow, 1).setValue('Total Realized Gain/Loss:');
  // Sum all Gain/Loss from TransactionHistory where Portfolio ID matches and Type = SELL
  sheet.getRange(realizedValuesRow, 6).setFormula(`=SUMIFS(TransactionHistory!$M:$M,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$F:$F,"SELL")`)
    .setNumberFormat(indianCurrencyFormat)
    .setFontWeight('bold');

  // Row 59: Blank
  sheet.getRange(summaryStartRow + 7, 1, 1, 16).setBackground('#FFFFFF');

  // Row 60: Total P&L Header
  const totalRow = summaryStartRow + 8;
  sheet.getRange(totalRow, 1).setValue('OVERALL PORTFOLIO PERFORMANCE')
    .setFontWeight('bold')
    .setFontSize(9)
    .setBackground('#dcfce7');

  // Row 61: Total P&L Values
  const totalValuesRow = summaryStartRow + 9;
  sheet.getRange(totalValuesRow, 1).setValue('Total P&L (Realized + Unrealized):');
  sheet.getRange(totalValuesRow, 6).setFormula(`=N${currentValuesRow}+F${realizedValuesRow}`)  // Unrealized (N55) + Realized (F58)
    .setNumberFormat(indianCurrencyFormat)
    .setFontWeight('bold')
    .setFontSize(11);

  // Apply borders to summary section
  sheet.getRange(headerRow, 1, 10, 16).setBorder(true, true, true, true, true, true, '#d1d5db', SpreadsheetApp.BorderStyle.SOLID);

  log(`Portfolio summary section added to ${portfolioName}`);
}

/**
 * Get all portfolios
 * @returns {Array} - Array of portfolio objects
 */
function getAllPortfolios() {
  try {
    log('getAllPortfolios() called');

    const sheet = getSheet(CONFIG.portfolioMetadataSheet);
    if (!sheet) {
      log('ERROR: AllPortfolios sheet not found');
      return [];
    }
    log('AllPortfolios sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    if (lastRow <= 3) {
      log('No portfolios data (lastRow <= 3), returning empty array');
      return []; // No portfolios yet (Row 1=Watermark, Row 2=Group Headers, Row 3=Column Headers)
    }

    const data = sheet.getRange(4, 1, lastRow - 3, 16).getValues();
    log('Data rows read: ' + data.length);

    const portfolios = [];

    data.forEach(row => {
      if (row[0]) { // If Portfolio ID exists (Column A)
        portfolios.push({
          portfolioId: row[0],                // Column A
          portfolioName: row[1],              // Column B
          investmentAccountId: row[2],         // Column C (stores account ID like IA-001)
          investmentAccountName: '',          // Not stored — resolved via investmentAccountId lookup
          ownerId: '',                        // Not stored — resolved via investment account
          ownerName: '',                      // Not stored — resolved via investment account
          initialInvestment: row[3],          // Column D
          totalInvestment: row[4],            // Column E
          sipTarget: row[5],                  // Column F
          lumpsumTarget: row[6],              // Column G
          rebalanceThreshold: row[7],         // Column H
          currentValue: row[8],               // Column I
          unrealizedPL: row[9],               // Column J (React: unrealizedPL)
          unrealizedPLPct: row[10],           // Column K (React: unrealizedPLPct)
          realizedPL: row[11],                // Column L (React: realizedPL)
          realizedPLPct: row[12],             // Column M (React: realizedPLPct)
          totalPL: row[13],                   // Column N (React: totalPL)
          totalPLPct: row[14],                // Column O (React: totalPLPct)
          status: row[15]                     // Column P
        });
      }
    });

    log('Returning ' + portfolios.length + ' portfolios');
    return portfolios;

  } catch (error) {
    log('ERROR in getAllPortfolios: ' + error.toString());
    log('Stack trace: ' + error.stack);
    // Return empty array instead of null to avoid issues in UI
    return [];
  }
}

/**
 * Get portfolio by ID
 * @param {string} portfolioId - Portfolio ID
 * @returns {Object|null} - Portfolio object or null
 */
function getPortfolioById(portfolioId) {
  try {
    const portfolios = getAllPortfolios();
    return portfolios.find(p => p.portfolioId === portfolioId) || null;
  } catch (error) {
    log('Error getting portfolio: ' + error.toString());
    return null;
  }
}

/**
 * Update portfolio
 * @param {Object} data - Updated portfolio data
 * @returns {Object} - Success/error response
 */
function updatePortfolio(data) {
  try {
    // Validate required fields
    isRequired(data.portfolioId, 'Portfolio ID');
    isRequired(data.portfolioName, 'Portfolio Name');
    isRequired(data.investmentAccount, 'Investment Account');

    // Normalize portfolio name — ensure PFL- prefix (same as processAddPortfolio)
    let portfolioName = data.portfolioName.trim();
    if (!portfolioName.startsWith('PFL-')) {
      portfolioName = 'PFL-' + portfolioName;
    }

    // Get sheet
    const sheet = getSheet(CONFIG.portfolioMetadataSheet);
    if (!sheet) {
      throw new Error('AllPortfolios sheet not found');
    }

    // Find portfolio row (Portfolio ID is in Column A)
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 2).getValues(); // Columns A-B
    let rowIndex = -1;
    let oldPortfolioName = '';

    for (let i = 0; i < dataRange.length; i++) {
      if (dataRange[i][0] === data.portfolioId) {
        rowIndex = i + 3; // +3 because of credit row + header row + 0-index
        oldPortfolioName = dataRange[i][1]; // Current name in Column B
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Portfolio not found');
    }

    // Sheet tab name = portfolioId (never changes), so no rename logic needed.
    // Just update the display name in column B and other editable fields.

    // Get existing formulas (columns E, I, J-O are formulas - don't overwrite them)
    const totalInvestmentFormula = sheet.getRange(rowIndex, 5).getFormula();   // E
    const currentValueFormula = sheet.getRange(rowIndex, 9).getFormula();      // I
    const unrealizedPLAmountFormula = sheet.getRange(rowIndex, 10).getFormula(); // J
    const unrealizedPLPercentFormula = sheet.getRange(rowIndex, 11).getFormula(); // K
    const realizedPLAmountFormula = sheet.getRange(rowIndex, 12).getFormula();  // L
    const realizedPLPercentFormula = sheet.getRange(rowIndex, 13).getFormula(); // M
    const totalPLAmountFormula = sheet.getRange(rowIndex, 14).getFormula();     // N
    const totalPLPercentFormula = sheet.getRange(rowIndex, 15).getFormula();    // O

    // Convert rebalance threshold to decimal
    const rebalanceThreshold = parseFloat(data.rebalanceThreshold) / 100;

    // Update portfolio — all 16 columns A-P, preserving formula columns
    sheet.getRange(rowIndex, 1, 1, 16).setValues([[
      data.portfolioId,                   // Column A: Portfolio ID
      portfolioName,                      // Column B: Portfolio Name (with PFL- prefix)
      data.investmentAccount,             // Column C: Investment Account
      parseFloat(data.initialInvestment), // Column D: Initial Investment
      totalInvestmentFormula,             // Column E: Total Investment (formula)
      parseFloat(data.sipTarget),         // Column F: SIP Target
      parseFloat(data.lumpsumTarget || 0), // Column G: Lumpsum Target
      rebalanceThreshold,                 // Column H: Rebalance Threshold
      currentValueFormula,                // Column I: Current Value (formula)
      unrealizedPLAmountFormula,          // Column J: Unrealized P&L ₹ (formula)
      unrealizedPLPercentFormula,         // Column K: Unrealized P&L % (formula)
      realizedPLAmountFormula,            // Column L: Realized P&L ₹ (formula)
      realizedPLPercentFormula,           // Column M: Realized P&L % (formula)
      totalPLAmountFormula,              // Column N: Total P&L ₹ (formula)
      totalPLPercentFormula,             // Column O: Total P&L % (formula)
      data.status || 'Active'             // Column P: Status
    ]]);

    log(`Portfolio updated: ${data.portfolioId} - ${portfolioName}`);

    return {
      success: true,
      message: `Portfolio "${portfolioName}" updated successfully!`
    };

  } catch (error) {
    log('Error updating portfolio: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Delete portfolio (set status to Inactive)
 * @param {string} portfolioId - Portfolio ID
 * @returns {Object} - Success/error response
 */
function deletePortfolio(portfolioId) {
  try {
    isRequired(portfolioId, 'Portfolio ID');

    const sheet = getSheet(CONFIG.portfolioMetadataSheet);
    if (!sheet) {
      throw new Error('AllPortfolios sheet not found');
    }

    // Find portfolio row
    const lastRow = sheet.getLastRow();
    const portfolioIds = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    let rowIndex = -1;
    let portfolioName = '';

    for (let i = 0; i < portfolioIds.length; i++) {
      if (portfolioIds[i][0] === portfolioId) {
        rowIndex = i + 3;
        portfolioName = sheet.getRange(rowIndex, 2).getValue();
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Portfolio not found');
    }

    // Set status to Inactive (Column P = 16)
    sheet.getRange(rowIndex, 16).setValue('Inactive');  // Column P: Status

    log(`Portfolio deleted (status=Inactive): ${portfolioId} - ${portfolioName}`);

    return {
      success: true,
      message: `Portfolio "${portfolioName}" deleted successfully!`
    };

  } catch (error) {
    log('Error deleting portfolio: ' + error.toString());
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get portfolio dropdown options for other forms
 * @returns {Array} - Array of {id, name} objects
 */
function getPortfolioOptions() {
  const portfolios = getAllPortfolios();
  return portfolios
    .filter(p => p.status === 'Active')
    .map(p => ({
      id: p.portfolioId,
      name: p.portfolioName
    }));
}

/**
 * Apply conditional formatting to Total P&L columns
 * Green background for positive values, red background for negative values
 * @param {Sheet} sheet - The AllPortfolios sheet
 * @param {number} row - Row number to apply formatting
 */
function applyPLConditionalFormatting(sheet, row) {
  try {
    // Column N: Total P&L (₹) - Green if positive, Red if negative
    const amountRange = sheet.getRange(row, 14);  // Column N
    const amountRule1 = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground("#d1fae5")  // Light green for positive
      .setFontColor("#059669")   // Dark green text
      .setRanges([amountRange])
      .build();

    const amountRule2 = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setBackground("#fee2e2")  // Light red for negative
      .setFontColor("#dc2626")   // Dark red text
      .setRanges([amountRange])
      .build();

    // Column O: Total P&L (%) - Green if positive, Red if negative
    const percentRange = sheet.getRange(row, 15);  // Column O
    const percentRule1 = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground("#d1fae5")  // Light green for positive
      .setFontColor("#059669")   // Dark green text
      .setRanges([percentRange])
      .build();

    const percentRule2 = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setBackground("#fee2e2")  // Light red for negative
      .setFontColor("#dc2626")   // Dark red text
      .setRanges([percentRange])
      .build();

    // Apply all rules
    const rules = sheet.getConditionalFormatRules();
    rules.push(amountRule1, amountRule2, percentRule1, percentRule2);
    sheet.setConditionalFormatRules(rules);

    log(`Applied conditional formatting to Total P&L columns for row ${row}`);

  } catch (error) {
    log(`Error applying conditional formatting: ${error.toString()}`);
    // Don't throw - formatting is not critical
  }
}

/**
 * Get portfolio rebalance plan data
 * @param {string} portfolioId - Portfolio ID
 * @returns {Object} - Portfolio data with funds and allocations
 */
function getPortfolioRebalancePlanData(portfolioId) {
  try {
    log(`Getting rebalance plan data for portfolio: ${portfolioId}`);

    const spreadsheet = getSpreadsheet();
    const portfolioSheet = spreadsheet.getSheetByName(portfolioId);

    if (!portfolioSheet) {
      throw new Error(`Portfolio sheet "${portfolioId}" not found`);
    }

    // Get portfolio data (rows 4 onwards, hidden row 1 = watermark, row 2 = group headers, row 3 = column headers)
    const lastRow = portfolioSheet.getLastRow();
    if (lastRow < 4) {
      return {
        portfolioId: portfolioId,
        funds: []
      };
    }

    // Column structure: A=Scheme Code (hidden), B=Fund Name, C=Units, D=Avg NAV, E=Current NAV, F=Investment,
    // G=Current Allocation %, H=Current Value, I=Target Allocation %, J=Target Value, ... P=P&L
    const data = portfolioSheet.getRange(4, 1, lastRow - 3, 16).getValues();

    const funds = [];
    data.forEach(row => {
      const schemeCode = row[0]; // Column A
      if (!schemeCode) return; // Skip empty rows

      const fundName = row[1];         // Column B
      const units = row[2] || 0;       // Column C
      const currentValue = row[7] || 0; // Column H
      const currentPercent = row[6] || 0; // Column G
      const targetPercent = row[8] || 0;  // Column I (user input)

      funds.push({
        schemeCode: schemeCode,
        fundName: fundName,
        units: units,
        currentValue: currentValue,
        currentPercent: currentPercent,
        targetPercent: targetPercent
      });
    });

    log(`Retrieved ${funds.length} funds for portfolio ${portfolioId}`);

    return {
      portfolioId: portfolioId,
      funds: funds
    };

  } catch (error) {
    log('Error getting portfolio rebalance plan data: ' + error.toString());
    throw error;
  }
}

/**
 * Get fund name by scheme code from MutualFundData
 * @param {string} schemeCode - Mutual fund scheme code
 * @returns {string|null} - Fund name or null if not found
 */
function getFundNameByCode(schemeCode) {
  try {
    const sheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!sheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return null;
    }

    // MutualFundData structure: A=Code, B=Name, C=Category, D=NAV, E=Date, F=Fund House, G=Type, H=Status
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // Get Code (A) and Name (B)

    for (let i = 0; i < data.length; i++) {
      // Convert both to string for comparison (handles number vs string mismatch)
      if (String(data[i][0]).trim() === String(schemeCode).trim()) {
        return data[i][1]; // Return fund name
      }
    }

    log(`Fund with code ${schemeCode} not found in MutualFundData`);
    return null;

  } catch (error) {
    log('Error getting fund name by code: ' + error.toString());
    return null;
  }
}

/**
 * Get all mutual funds from MutualFundData for search
 * @returns {Array} - Array of {code, name} objects
 */
function getAllMutualFunds() {
  try {
    const sheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!sheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }

    // MutualFundData structure: A=Code, B=Name, C=Category, D=NAV, E=Date, F=Fund House, G=Type, H=Status
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // Get Code (A) and Name (B)

    const funds = data
      .filter(row => row[0] && row[1]) // Filter out empty rows
      .map(row => ({
        code: String(row[0]).trim(),
        name: row[1].trim()
      }));

    log(`Retrieved ${funds.length} mutual funds for search`);
    return funds;

  } catch (error) {
    log('Error getting all mutual funds: ' + error.toString());
    return [];
  }
}

/**
 * Show Portfolio Rebalance Plan dialog
 */
function showPortfolioRebalancePlanDialog() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('PortfolioRebalancePlan')
      .setWidth(1200)
      .setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(html, '📊 Portfolio Rebalance Plan');
  } catch (error) {
    log('Error showing rebalance plan dialog: ' + error.toString());
    showError('Error: ' + error.message);
  }
}

/**
 * Save portfolio allocation changes from Manage Portfolio Allocation dialog
 * @param {Object} allocationData - Data from dialog with fundsToUpdate and fundsToAdd
 * @returns {Object} - Success/error result with summary
 */
function savePortfolioAllocation(allocationData) {
  try {
    const portfolioId = allocationData.portfolioId;
    const portfolioName = allocationData.portfolioName;
    const spreadsheet = getSpreadsheet();
    // Find sheet by portfolioId (sheet tab name = portfolioId)
    const portfolioSheet = spreadsheet.getSheetByName(portfolioId);

    if (!portfolioSheet) {
      throw new Error(`Portfolio sheet "${portfolioId}" not found`);
    }

    log(`Saving allocation for portfolio: ${portfolioId} (${portfolioName})`);

    let updateCount = 0;
    let addCount = 0;
    let deleteCount = 0;

    // Build map of existing funds: schemeCode → row number
    const data = portfolioSheet.getDataRange().getValues();
    const existingFundsMap = new Map();

    for (let i = 3; i < data.length; i++) { // Start from row 4 (index 3)
      const schemeCode = data[i][0]; // Column A
      if (schemeCode) {
        existingFundsMap.set(schemeCode.toString(), {
          row: i + 1, // +1 for 1-indexed
          units: data[i][2] || 0 // Column C
        });
      }
    }

    // 1. Process existing funds - UPDATE target % or DELETE if 0 units
    const fundCodesToKeep = new Set();

    allocationData.fundsToUpdate.forEach(fund => {
      const existing = existingFundsMap.get(fund.schemeCode.toString());

      if (existing) {
        // Fund exists in portfolio
        if (existing.units > 0) {
          // Has units - UPDATE target %
          portfolioSheet.getRange(existing.row, 9).setValue(fund.targetPercent); // Column I
          log(`Updated ${fund.fundName}: target ${fund.targetPercent}%`);
          updateCount++;
          fundCodesToKeep.add(fund.schemeCode.toString());
        } else {
          // Has 0 units - keep if still in fundsToUpdate (user didn't remove)
          portfolioSheet.getRange(existing.row, 9).setValue(fund.targetPercent); // Column I
          log(`Updated ${fund.fundName} (0 units): target ${fund.targetPercent}%`);
          updateCount++;
          fundCodesToKeep.add(fund.schemeCode.toString());
        }
      }
    });

    // Delete funds that were removed (existed before but not in fundsToUpdate)
    const rowsToDelete = [];
    existingFundsMap.forEach((existing, schemeCode) => {
      if (!fundCodesToKeep.has(schemeCode) && existing.units === 0) {
        rowsToDelete.push({ row: existing.row, code: schemeCode });
      }
    });

    // Delete in reverse order to avoid row shifting issues
    rowsToDelete.sort((a, b) => b.row - a.row);
    rowsToDelete.forEach(item => {
      portfolioSheet.deleteRow(item.row);
      log(`Deleted 0-unit fund: ${item.code}`);
      deleteCount++;
    });

    // 2. Process new funds - ADD to portfolio
    allocationData.fundsToAdd.forEach(fund => {
      const existing = existingFundsMap.get(fund.schemeCode.toString());

      if (!existing) {
        // Fund is NEW - find first empty row in column A (scheme code) starting from row 4
        const colA = portfolioSheet.getRange('A4:A1000').getValues();
        let newRow = 4;
        for (let r = 0; r < colA.length; r++) {
          if (!colA[r][0]) { newRow = r + 4; break; }
          newRow = r + 5; // After last occupied row
        }
        addFundRowToPortfolio(portfolioSheet, newRow, portfolioId, fund.schemeCode, fund.targetPercent);
        log(`Added new fund: ${fund.fundName} with target ${fund.targetPercent}%`);
        addCount++;
      } else {
        // Fund already exists - just update target % (already done above)
        log(`Fund ${fund.fundName} already exists, target % updated`);
      }
    });

    // 3. Build summary message
    const parts = [];
    if (updateCount > 0) parts.push(`${updateCount} fund(s) updated`);
    if (addCount > 0) parts.push(`${addCount} fund(s) added`);
    if (deleteCount > 0) parts.push(`${deleteCount} fund(s) removed`);

    const message = parts.length > 0
      ? `Allocation saved! ${parts.join(', ')}.`
      : 'Allocation saved!';

    const summary = `Portfolio: ${portfolioName}\n` +
      `Updated: ${updateCount} | Added: ${addCount} | Removed: ${deleteCount}`;

    // Calculate planning data
    const planningData = calculatePlanningData(portfolioSheet, portfolioName, allocationData);

    return {
      success: true,
      message: message,
      summary: summary,
      stats: {
        updated: updateCount,
        added: addCount,
        deleted: deleteCount
      },
      planning: planningData
    };

  } catch (error) {
    log('Error saving portfolio allocation: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Add fund row to portfolio sheet with all formulas
 * @param {Sheet} sheet - Portfolio sheet
 * @param {number} row - Row number to add
 * @param {string} portfolioId - Portfolio ID (from cell Q1)
 * @param {string} schemeCode - Fund scheme code
 * @param {number} targetPercent - Target allocation %
 */
function addFundRowToPortfolio(sheet, row, portfolioId, schemeCode, targetPercent) {
  // Column A: Scheme Code
  sheet.getRange(row, 1).setValue(schemeCode);

  // Column B: Fund Name (formula - pulls from MutualFundData)
  sheet.getRange(row, 2).setFormula(
    `=IF(A${row}="","",IFERROR(VLOOKUP(A${row},MutualFundData!$A:$B,2,FALSE),"Fund not found"))`
  );

  // Column C: Units (formula - BUY - SELL)
  sheet.getRange(row, 3).setFormula(
    `=IF(A${row}="","",SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${row},TransactionHistory!$F:$F,"BUY")-SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${row},TransactionHistory!$F:$F,"SELL"))`
  );

  // Column D: Avg NAV ₹ (formula - weighted average from BUY transactions)
  sheet.getRange(row, 4).setFormula(
    `=IF(C${row}=0,"",SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${row},TransactionHistory!$F:$F,"BUY")/SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${row},TransactionHistory!$F:$F,"BUY"))`
  );

  // Column E: Current NAV ₹ (formula - VLOOKUP from MutualFundData)
  sheet.getRange(row, 5).setFormula(
    `=IF(A${row}="","",IFERROR(VLOOKUP(A${row},MutualFundData!$A:$D,4,FALSE),""))`
  );

  // Column F: Investment ₹ (formula - Units × Avg NAV)
  sheet.getRange(row, 6).setFormula(
    `=IF(C${row}=0,"",C${row}*D${row})`
  );

  // Column G: Current Allocation % (formula - Current Value / Portfolio Total × 100)
  sheet.getRange(row, 7).setFormula(
    `=IF(A${row}="","",ROUND(IFERROR(H${row}/SUM($H$4:$H$1000)*100,0),2))`
  );

  // Column H: Current Value ₹ (formula - Units × Current NAV)
  sheet.getRange(row, 8).setFormula(
    `=IF(C${row}=0,"",C${row}*E${row})`
  );

  // Column I: Target Allocation % (USER INPUT - not formula)
  sheet.getRange(row, 9).setValue(targetPercent);

  // Column J: Target Value ₹ (formula - Target % × Portfolio Total)
  sheet.getRange(row, 10).setFormula(
    `=IF(I${row}=0,"",I${row}/100*SUM($H$4:$H$1000))`
  );

  // Columns K-P: SIP, Lumpsum, Rebalance formulas
  // Column K: Ongoing SIP ₹ (formula - from portfolio metadata)
  sheet.getRange(row, 11).setFormula(
    `=IF(I${row}=0,"",I${row}/100*IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$G,6,FALSE),0))`
  );

  // Column L: Rebalance SIP ₹ (gap-based — matches React logic)
  // Overweight funds get ₹0. Underweight funds share SIP proportional to gap.
  const totalGapSP = `SUMPRODUCT(IF(A$4:A$1000<>"",IF(J$4:J$1000-H$4:H$1000>0,J$4:J$1000-H$4:H$1000,0),0))`;
  const sipLookup = `IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$G,6,FALSE),0)`;
  sheet.getRange(row, 12).setFormula(
    `=IF(I${row}=0,"",IF(${totalGapSP}=0,I${row}/100*${sipLookup},IF(J${row}-H${row}>0,(J${row}-H${row})/${totalGapSP}*${sipLookup},0)))`
  );

  // Column M: Target Lumpsum ₹ (formula - from portfolio metadata)
  sheet.getRange(row, 13).setFormula(
    `=IF(I${row}=0,"",I${row}/100*IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$G,7,FALSE),0))`
  );

  // Column N: Rebalance Lumpsum ₹ (formula - smart lumpsum, only when deviation exceeds threshold)
  sheet.getRange(row, 14).setFormula(
    `=IF(I${row}=0,"",IF(ABS(G${row}-I${row})>IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$H,8,FALSE),0.05)*100,MAX(0,I${row}/100*(SUM($H$4:$H$1000)+IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$G,7,FALSE),0))-H${row}),I${row}/100*IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$G,7,FALSE),0)))`
  );

  // Column O: Buy/Sell ₹ (formula - Target Value - Current Value, only when deviation exceeds threshold)
  sheet.getRange(row, 15).setFormula(
    `=IF(I${row}=0,"",IF(ABS(G${row}-I${row})>IFERROR(VLOOKUP($Q$1,AllPortfolios!$A:$H,8,FALSE),0.05)*100,J${row}-H${row},0))`
  );

  // Column P: P&L ₹ (formula - Current Value - Investment)
  sheet.getRange(row, 16).setFormula(
    `=IF(C${row}=0,"",H${row}-F${row})`
  );

  // Column R (18): ATH NAV ₹ - All-Time High NAV from MF_ATH_Data
  sheet.getRange(row, 18).setFormula(
    `=IF(A${row}="","",IFERROR(VLOOKUP(A${row}*1,MF_ATH_Data!$A:$C,3,FALSE),""))`
  );

  // Column S (19): % Below ATH - How far below ATH the fund currently is
  sheet.getRange(row, 19).setFormula(
    `=IF(A${row}="","",IFERROR(VLOOKUP(A${row}*1,MF_ATH_Data!$A:$G,7,FALSE),""))`
  );

  // Apply formatting
  sheet.getRange(row, 1, 1, 16).setBorder(true, true, true, true, false, false);

  // Number formatting
  sheet.getRange(row, 3).setNumberFormat('#,##0.0000'); // Units
  sheet.getRange(row, 4, 1, 2).setNumberFormat('₹#,##0.00'); // Avg NAV, Current NAV
  sheet.getRange(row, 6, 1, 1).setNumberFormat('₹#,##0'); // Investment
  sheet.getRange(row, 7).setNumberFormat('0.00'); // Current % (plain number, not percentage format)
  sheet.getRange(row, 8, 1, 1).setNumberFormat('₹#,##0'); // Current Value
  sheet.getRange(row, 9).setNumberFormat('0.00'); // Target % (plain number, not percentage format)
  sheet.getRange(row, 10, 1, 7).setNumberFormat('₹#,##0'); // Target Value through P&L
  sheet.getRange(row, 18).setNumberFormat('₹#,##0.00'); // ATH NAV ₹
  sheet.getRange(row, 19).setNumberFormat('0.00'); // % Below ATH
}

/**
 * Calculate planning data (gap analysis, SIP plan, lumpsum plan) for saved allocation
 * @param {Sheet} portfolioSheet - Portfolio sheet
 * @param {string} portfolioName - Portfolio name
 * @param {Object} allocationData - Allocation data
 * @returns {Object} - Planning data with gap analysis, SIP plan, lumpsum plan
 */
function calculatePlanningData(portfolioSheet, portfolioName, allocationData) {
  try {
    // Get portfolio metadata for SIP and Lumpsum targets
    const metadataSheet = getSheet(CONFIG.portfolioMetadataSheet);
    let monthlySIPTarget = 0;
    let lumpsumTarget = 0;

    if (metadataSheet) {
      const metaData = metadataSheet.getDataRange().getValues();
      for (let i = 1; i < metaData.length; i++) {
        if (metaData[i][1] === portfolioName) { // Column B = Portfolio Name
          monthlySIPTarget = metaData[i][5] || 0; // Column F = SIP Target
          lumpsumTarget = metaData[i][6] || 0;    // Column G = Lumpsum Target
          break;
        }
      }
    }

    // Get current portfolio data
    const data = portfolioSheet.getDataRange().getValues();
    const funds = [];
    let totalCurrentValue = 0;

    for (let i = 3; i < data.length; i++) { // Start from row 4
      const schemeCode = data[i][0];
      if (!schemeCode) continue;

      const fundName = data[i][1];
      const currentValue = data[i][7] || 0; // Column H
      const targetPercent = data[i][8] || 0; // Column I

      totalCurrentValue += currentValue;

      funds.push({
        schemeCode: schemeCode,
        fundName: fundName,
        currentValue: currentValue,
        targetPercent: targetPercent
      });
    }

    // Calculate target values
    funds.forEach(fund => {
      fund.targetValue = (fund.targetPercent / 100) * totalCurrentValue;
    });

    // Build gap analysis
    const gapAnalysis = {
      funds: funds.map(f => ({
        fundName: f.fundName,
        currentValue: f.currentValue,
        targetValue: f.targetValue,
        targetPercent: f.targetPercent
      }))
    };

    // Build SIP plan
    const sipPlan = monthlySIPTarget > 0 ? {
      funds: funds.map(f => ({
        fundName: f.fundName,
        targetPercent: f.targetPercent,
        sipAmount: (f.targetPercent / 100) * monthlySIPTarget
      })),
      totalSIP: monthlySIPTarget
    } : null;

    // Build lumpsum plan
    const lumpsumPlan = lumpsumTarget > 0 ? {
      funds: funds.map(f => ({
        fundName: f.fundName,
        targetPercent: f.targetPercent,
        lumpsumAmount: (f.targetPercent / 100) * lumpsumTarget
      })),
      totalLumpsum: lumpsumTarget
    } : null;

    return {
      gapAnalysis: gapAnalysis,
      sipPlan: sipPlan,
      lumpsumPlan: lumpsumPlan
    };

  } catch (error) {
    log('Error calculating planning data: ' + error.toString());
    return {
      gapAnalysis: { funds: [] },
      sipPlan: null,
      lumpsumPlan: null
    };
  }
}

/**
 * Activate portfolio sheet (helper for View Portfolio Sheet button)
 */
function activatePortfolioSheet(portfolioId) {
  try {
    const sheet = getPortfolioSheet(portfolioId);
    if (sheet) {
      sheet.activate();
    }
  } catch (error) {
    log('Error activating portfolio sheet: ' + error.toString());
  }
}

// ============================================================================
// END OF PORTFOLIOS.GS
// ============================================================================

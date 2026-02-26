/**
 * ============================================================================
 * MUTUALFUNDS.GS - Mutual Fund Transaction Management for Capital Friends V2
 * ============================================================================
 * Handles all mutual fund transactions: Add Existing Holdings, Invest (SIP/Lumpsum), Redeem, Switch
 */

/** Get portfolio sheet by portfolioId (sheet tab name = portfolioId) */
function getPortfolioSheet(portfolioId) {
  return getSheet(portfolioId);
}

/**
 * Process Add Existing Holdings transaction (BUY + INITIAL)
 * This is used to track existing investments that were made before using this system
 */
function processAddExistingHoldings(formData) {
  return processInvestment(formData, 'INITIAL');
}

/**
 * Process Invest via SIP transaction (BUY + SIP)
 */
function processInvestViaSIP(formData) {
  return processInvestment(formData, 'SIP');
}

/**
 * Process Invest Lumpsum transaction (BUY + LUMPSUM)
 */
function processInvestLumpsum(formData) {
  return processInvestment(formData, 'LUMPSUM');
}

/**
 * Common investment processing function for BUY transactions
 * @param {Object} formData - Form data containing transaction details
 * @param {string} transactionType - INITIAL, SIP, or LUMPSUM
 */
function processInvestment(formData, transactionType) {
  try {
    log(`processInvestment called with transactionType: ${transactionType}`);
    log(`Form data: ${JSON.stringify(formData)}`);

    // Validate required fields
    isRequired(formData.portfolioId, 'Portfolio');
    isRequired(formData.fundCode, 'Fund');
    isRequired(formData.purchaseDate, 'Purchase Date');
    isRequired(formData.units, 'Units');
    isRequired(formData.avgPrice, 'Price per Unit');

    const portfolioId = formData.portfolioId;
    const fundCode = formData.fundCode;
    const purchaseDate = formData.purchaseDate;
    const units = parseFloat(formData.units);
    const avgPrice = parseFloat(formData.avgPrice);
    const totalAmount = units * avgPrice;
    const targetAllocation = parseFloat(formData.targetAllocation || 0);
    const notes = formData.notes || '';

    if (units <= 0) throw new Error('Units must be greater than 0');
    if (avgPrice <= 0) throw new Error('Price per unit must be greater than 0');
    if (targetAllocation < 0 || targetAllocation > 100) {
      throw new Error('Target allocation must be between 0 and 100');
    }

    // Get portfolio details
    const metadataSheet = getSheet(CONFIG.portfolioMetadataSheet);
    if (!metadataSheet) {
      throw new Error('AllPortfolios sheet not found');
    }

    const portfolios = getAllPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const portfolioName = portfolio.portfolioName;

    // Get portfolio sheet (with PFL- prefix fallback)
    const portfolioSheet = getPortfolioSheet(portfolioId);
    if (!portfolioSheet) {
      throw new Error(`Portfolio sheet "${portfolioId}" not found`);
    }

    // Get fund name from MutualFundData
    const mfDataSheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!mfDataSheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const mfData = mfDataSheet.getDataRange().getValues();
    let fundName = '';
    // MutualFundData structure: Row 1 = Headers, Row 2+ = Data
    // Skip header (row 0 in array), start from row 1 (data row 2 in sheet)
    for (let i = 1; i < mfData.length; i++) {
      if (mfData[i][0] && mfData[i][0].toString() === fundCode.toString()) {
        fundName = mfData[i][1];
        break;
      }
    }

    if (!fundName) {
      throw new Error(`Fund code ${fundCode} not found in MutualFundData`);
    }

    const baseFundName = getBaseFundName(fundName);

    // Record transaction in TransactionHistory
    recordTransactionInHistory({
      date: purchaseDate,
      portfolioId: portfolioId,
      portfolio: portfolioName,
      fundCode: fundCode,
      fund: baseFundName,
      type: 'BUY',
      transactionType: transactionType,
      units: units,
      price: avgPrice,
      totalAmount: totalAmount,
      notes: notes
    });

    // Check if fund already exists in portfolio
    const portfolioData = portfolioSheet.getDataRange().getValues();
    let fundExists = false;
    let fundRow = -1;

    // Portfolio structure: Row 1=Watermark, Row 2=Group Headers, Row 3=Column Headers, Row 4+=Data
    // Array index 0=Row1, index 1=Row2, index 2=Row3, index 3=Row4 (first data row)
    for (let i = 3; i < portfolioData.length; i++) {
      const rowFundCode = portfolioData[i][0];
      if (rowFundCode && rowFundCode.toString() === fundCode.toString()) {
        fundExists = true;
        fundRow = i + 1;
        break;
      }
    }

    log(`Fund ${fundCode} exists in portfolio? ${fundExists}`);

    if (!fundExists) {
      log(`Adding NEW fund ${fundCode} to portfolio sheet "${portfolioName}"`);

      // Validate total allocation before adding new fund
      if (targetAllocation > 0) {
        const currentTotalAllocation = calculateTotalAllocation(portfolioSheet);
        const newTotalAllocation = currentTotalAllocation + targetAllocation;

        if (newTotalAllocation > 100) {
          throw new Error(
            `Total allocation would exceed 100%!\n\n` +
            `Current total: ${currentTotalAllocation.toFixed(2)}%\n` +
            `Adding: ${targetAllocation.toFixed(2)}%\n` +
            `New total: ${newTotalAllocation.toFixed(2)}%\n\n` +
            `Please adjust the target allocation to keep total at or below 100%.`
          );
        }
      }

      // Add fund to portfolio sheet with formulas
      addFundToPortfolioSheet(portfolioSheet, portfolioId, portfolioName, fundCode, targetAllocation);

      log(`Fund ${fundCode} added successfully to portfolio sheet`);
    } else {
      log(`Fund ${fundCode} already exists at row ${fundRow} - transaction recorded in history, formulas will auto-update`);
    }

    log(`${transactionType} transaction processed successfully for ${portfolioId}`);

    return {
      success: true,
      message: `${transactionType === 'INITIAL' ? 'Existing holdings added' : 'Investment recorded'} successfully! ${units.toFixed(4)} units of ${baseFundName} added to ${portfolioName}.`
    };

  } catch (error) {
    log(`Error in processInvestment: ${error.toString()}`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Process Redeem/Withdraw transaction (SELL + WITHDRAWAL)
 */
function processRedeem(formData) {
  try {
    log(`processRedeem called`);
    log(`Form data: ${JSON.stringify(formData)}`);

    // Validate required fields
    isRequired(formData.portfolioId, 'Portfolio');
    isRequired(formData.fundCode, 'Fund');
    isRequired(formData.saleDate, 'Sale Date');
    isRequired(formData.units, 'Units');
    isRequired(formData.salePrice, 'Sale Price per Unit');

    const portfolioId = formData.portfolioId;
    const fundCode = formData.fundCode;
    const saleDate = formData.saleDate;
    const units = parseFloat(formData.units);
    const salePrice = parseFloat(formData.salePrice);
    const totalAmount = units * salePrice;
    const notes = formData.notes || '';

    if (units <= 0) throw new Error('Units must be greater than 0');
    if (salePrice <= 0) throw new Error('Sale price per unit must be greater than 0');

    // Get portfolio details
    const portfolios = getAllPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const portfolioName = portfolio.portfolioName;

    // Get portfolio sheet (with PFL- prefix fallback)
    const portfolioSheet = getPortfolioSheet(portfolioId);
    if (!portfolioSheet) {
      throw new Error(`Portfolio sheet "${portfolioId}" not found`);
    }

    // Get fund name from MutualFundData
    const mfDataSheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!mfDataSheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const mfData = mfDataSheet.getDataRange().getValues();
    let fundName = '';
    // MutualFundData structure: Row 1 = Headers, Row 2+ = Data
    // Skip header (row 0 in array), start from row 1 (data row 2 in sheet)
    for (let i = 1; i < mfData.length; i++) {
      if (mfData[i][0] && mfData[i][0].toString() === fundCode.toString()) {
        fundName = mfData[i][1];
        break;
      }
    }

    if (!fundName) {
      throw new Error(`Fund code ${fundCode} not found in MutualFundData`);
    }

    const baseFundName = getBaseFundName(fundName);

    // Check if fund exists in portfolio and get average buy price
    const portfolioData = portfolioSheet.getDataRange().getValues();
    let fundExists = false;
    let avgBuyPrice = 0;

    // Portfolio structure: Row 1=Watermark, Row 2=Group Headers, Row 3=Column Headers, Row 4+=Data
    // Columns: A=Code, B=Name, C=Units, D=Avg NAV ₹, E=Current NAV, F=Investment...
    // Array index 0=Row1, index 1=Row2, index 2=Row3, index 3=Row4 (first data row)
    for (let i = 3; i < portfolioData.length; i++) {
      const rowFundCode = portfolioData[i][0];
      if (rowFundCode && rowFundCode.toString() === fundCode.toString()) {
        fundExists = true;
        avgBuyPrice = parseFloat(portfolioData[i][3]) || 0;  // Column D (index 3) = Avg NAV ₹
        log(`Found fund ${baseFundName} in portfolio. Avg Buy Price: ₹${avgBuyPrice}`);
        break;
      }
    }

    if (!fundExists) {
      // Debug logging to help troubleshoot
      log(`ERROR: Fund code ${fundCode} not found in portfolio ${portfolioName}`);
      log(`Portfolio data rows checked: ${portfolioData.length - 3}`);
      log(`First 5 fund codes in portfolio: ${portfolioData.slice(3, 8).map(row => row[0]).join(', ')}`);
      throw new Error(`Fund ${baseFundName} (Code: ${fundCode}) not found in portfolio ${portfolioName}`);
    }

    // Record transaction in TransactionHistory with P&L calculation
    recordTransactionInHistory({
      date: saleDate,
      portfolioId: portfolioId,
      portfolio: portfolioName,
      fundCode: fundCode,
      fund: baseFundName,
      type: 'SELL',
      transactionType: 'WITHDRAWAL',
      units: units,
      price: salePrice,
      totalAmount: totalAmount,
      avgBuyPrice: avgBuyPrice,  // For P&L calculation
      notes: notes
    });

    log(`WITHDRAWAL transaction processed successfully for ${portfolioId}`);

    // Check if fund now has 0 units and delete row if so
    deleteZeroUnitFunds(portfolioSheet, portfolioName);

    return {
      success: true,
      message: `Redemption recorded successfully! ${units.toFixed(4)} units of ${baseFundName} redeemed from ${portfolioName} for �${totalAmount.toFixed(2)}.`
    };

  } catch (error) {
    log(`Error in processRedeem: ${error.toString()}`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Process Switch Funds transaction (SELL + SWITCH from one fund, BUY + SWITCH to another)
 */
function processSwitchFunds(formData) {
  try {
    log(`processSwitchFunds called`);
    log(`Form data: ${JSON.stringify(formData)}`);

    // Validate required fields
    isRequired(formData.portfolioId, 'Portfolio');
    isRequired(formData.fromFundCode, 'From Fund');
    isRequired(formData.toFundCode, 'To Fund');
    isRequired(formData.switchDate, 'Switch Date');
    isRequired(formData.units, 'Units');
    isRequired(formData.fromFundPrice, 'From Fund Price');
    isRequired(formData.toFundPrice, 'To Fund Price');

    const portfolioId = formData.portfolioId;
    const fromFundCode = formData.fromFundCode;
    const toFundCode = formData.toFundCode;
    const switchDate = formData.switchDate;
    const units = parseFloat(formData.units);
    const fromFundPrice = parseFloat(formData.fromFundPrice);
    const toFundPrice = parseFloat(formData.toFundPrice);
    const switchAmount = units * fromFundPrice;
    const toFundUnits = switchAmount / toFundPrice;
    const targetAllocation = parseFloat(formData.targetAllocation || 0);
    const notes = formData.notes || '';

    if (fromFundCode === toFundCode) {
      throw new Error('Cannot switch to the same fund');
    }
    if (units <= 0) throw new Error('Units must be greater than 0');
    if (fromFundPrice <= 0) throw new Error('From fund price must be greater than 0');
    if (toFundPrice <= 0) throw new Error('To fund price must be greater than 0');
    if (targetAllocation < 0 || targetAllocation > 100) {
      throw new Error('Target allocation must be between 0 and 100');
    }

    // Get portfolio details
    const portfolios = getAllPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const portfolioName = portfolio.portfolioName;

    // Get portfolio sheet (with PFL- prefix fallback)
    const portfolioSheet = getPortfolioSheet(portfolioId);
    if (!portfolioSheet) {
      throw new Error(`Portfolio sheet "${portfolioId}" not found`);
    }

    // Get fund names from MutualFundData
    const mfDataSheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!mfDataSheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const mfData = mfDataSheet.getDataRange().getValues();
    let fromFundName = '';
    let toFundName = '';

    // MutualFundData structure: Row 1 = Headers, Row 2+ = Data
    // Skip header (row 0 in array), start from row 1 (data row 2 in sheet)
    for (let i = 1; i < mfData.length; i++) {
      if (mfData[i][0] && mfData[i][0].toString() === fromFundCode.toString()) {
        fromFundName = mfData[i][1];
      }
      if (mfData[i][0] && mfData[i][0].toString() === toFundCode.toString()) {
        toFundName = mfData[i][1];
      }
    }

    if (!fromFundName) {
      throw new Error(`From fund code ${fromFundCode} not found in MutualFundData`);
    }
    if (!toFundName) {
      throw new Error(`To fund code ${toFundCode} not found in MutualFundData`);
    }

    const baseFromFundName = getBaseFundName(fromFundName);
    const baseToFundName = getBaseFundName(toFundName);

    // Check if from fund exists in portfolio and get average buy price
    const portfolioData = portfolioSheet.getDataRange().getValues();
    let fromFundExists = false;
    let toFundExists = false;
    let avgBuyPrice = 0;

    // Portfolio structure: Row 1=Watermark, Row 2=Group Headers, Row 3=Column Headers, Row 4+=Data
    // Columns: A=Code, B=Name, C=Units, D=Avg NAV ₹, E=Current NAV, F=Investment...
    // Array index 0=Row1, index 1=Row2, index 2=Row3, index 3=Row4 (first data row)
    for (let i = 3; i < portfolioData.length; i++) {
      const rowFundCode = portfolioData[i][0];
      if (rowFundCode && rowFundCode.toString() === fromFundCode.toString()) {
        fromFundExists = true;
        avgBuyPrice = parseFloat(portfolioData[i][3]) || 0;  // Column D (index 3) = Avg NAV ₹
        log(`Found from fund ${baseFromFundName} in portfolio. Avg Buy Price: ₹${avgBuyPrice}`);
      }
      if (rowFundCode && rowFundCode.toString() === toFundCode.toString()) {
        toFundExists = true;
      }
    }

    if (!fromFundExists) {
      throw new Error(`From fund ${baseFromFundName} (Code: ${fromFundCode}) not found in portfolio ${portfolioName}`);
    }

    // Record SELL transaction for from fund with P&L calculation
    recordTransactionInHistory({
      date: switchDate,
      portfolioId: portfolioId,
      portfolio: portfolioName,
      fundCode: fromFundCode,
      fund: baseFromFundName,
      type: 'SELL',
      transactionType: 'SWITCH',
      units: units,
      price: fromFundPrice,
      totalAmount: switchAmount,
      avgBuyPrice: avgBuyPrice,  // For P&L calculation
      notes: notes
    });

    // Record BUY transaction for to fund
    recordTransactionInHistory({
      date: switchDate,
      portfolioId: portfolioId,
      portfolio: portfolioName,
      fundCode: toFundCode,
      fund: baseToFundName,
      type: 'BUY',
      transactionType: 'SWITCH',
      units: toFundUnits,
      price: toFundPrice,
      totalAmount: switchAmount,
      notes: notes
    });

    // Add to fund to portfolio sheet if it doesn't exist
    if (!toFundExists) {
      // Validate total allocation before adding new fund
      if (targetAllocation > 0) {
        const currentTotalAllocation = calculateTotalAllocation(portfolioSheet);
        const newTotalAllocation = currentTotalAllocation + targetAllocation;

        if (newTotalAllocation > 100) {
          throw new Error(
            `Total allocation would exceed 100%!\n\n` +
            `Current total: ${currentTotalAllocation.toFixed(2)}%\n` +
            `Adding: ${targetAllocation.toFixed(2)}%\n` +
            `New total: ${newTotalAllocation.toFixed(2)}%\n\n` +
            `Please adjust the target allocation to keep total at or below 100%.`
          );
        }
      }

      addFundToPortfolioSheet(portfolioSheet, portfolioId, portfolioName, toFundCode, targetAllocation);
    }

    log(`SWITCH transaction processed successfully for ${portfolioId}`);

    // Check if from fund now has 0 units and delete row if so
    deleteZeroUnitFunds(portfolioSheet, portfolioName);

    return {
      success: true,
      message: `Switch recorded successfully! ${units.toFixed(4)} units of ${baseFromFundName} switched to ${toFundUnits.toFixed(4)} units of ${baseToFundName}.`
    };

  } catch (error) {
    log(`Error in processSwitchFunds: ${error.toString()}`);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Record transaction in TransactionHistory sheet
 * Structure (13 columns):
 * A=Date, B=Portfolio ID, C=Portfolio, D=Fund Code, E=Fund, F=Type, G=Transaction Type,
 * H=Units, I=Price, J=Total Amount, K=Notes, L=Timestamp, M=Gain/Loss ₹
 */
function recordTransactionInHistory(transaction) {
  try {
    const sheet = getSheet(CONFIG.transactionHistorySheet);
    if (!sheet) {
      throw new Error('TransactionHistory sheet not found');
    }

    const now = new Date();
    let gainLoss = 0;

    // Calculate Gain/Loss for SELL transactions
    if (transaction.type === 'SELL' && transaction.avgBuyPrice) {
      // Gain/Loss = (Sell Price - Avg Buy Price) × Units
      gainLoss = (transaction.price - transaction.avgBuyPrice) * transaction.units;
      log(`Calculated Gain/Loss: (${transaction.price} - ${transaction.avgBuyPrice}) × ${transaction.units} = ${gainLoss}`);
    }

    // Generate Transaction ID
    var lastRow = sheet.getLastRow();
    var existingIds = lastRow > 2
      ? sheet.getRange(3, 14, lastRow - 2, 1).getValues().map(function(r) { return r[0]; })
      : [];
    var transactionId = generateId('TXN', existingIds);

    sheet.appendRow([
      new Date(transaction.date),       // A: Date
      transaction.portfolioId || '',    // B: Portfolio ID
      transaction.portfolio,            // C: Portfolio Name
      transaction.fundCode || '',       // D: Fund Code
      transaction.fund,                 // E: Fund Name
      transaction.type,                 // F: Type (BUY/SELL)
      transaction.transactionType || '',// G: Transaction Type (INITIAL/SIP/LUMPSUM/WITHDRAWAL/SWITCH)
      transaction.units,                // H: Units
      transaction.price,                // I: Price per Unit
      transaction.totalAmount,          // J: Total Amount
      transaction.notes || '',          // K: Notes
      now,                              // L: Timestamp
      gainLoss,                         // M: Gain/Loss ₹ (calculated for SELL, 0 for BUY)
      transactionId                     // N: Transaction ID
    ]);

    // Apply formatting to the new row
    const newRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, newRow, newRow, 14);

    // Apply number formats
    const indianCurrencyFormat = '₹#,##,##0.00';
    sheet.getRange(newRow, 8).setNumberFormat('#,##0.0000');  // H: Units (4 decimals)
    sheet.getRange(newRow, 9).setNumberFormat(indianCurrencyFormat);  // I: Price
    sheet.getRange(newRow, 10).setNumberFormat(indianCurrencyFormat);  // J: Total Amount
    sheet.getRange(newRow, 13).setNumberFormat(indianCurrencyFormat);  // M: Gain/Loss

    log(`Transaction ${transactionId} recorded: ${transaction.type}-${transaction.transactionType} - ${transaction.fund}${gainLoss !== 0 ? ' | Gain/Loss: ₹' + gainLoss.toFixed(2) : ''}`);

    return transactionId;

  } catch (error) {
    log(`Error recording transaction in history: ${error.toString()}`);
    throw error;
  }
}

/**
 * Delete rows with 0 units from portfolio sheet
 * Keeps portfolio clean by removing fully exited positions
 * @param {Sheet} portfolioSheet - The portfolio sheet
 * @param {string} portfolioName - Portfolio name for logging
 */
function deleteZeroUnitFunds(portfolioSheet, portfolioName) {
  try {
    const portfolioData = portfolioSheet.getDataRange().getValues();
    const rowsToDelete = [];

    // Portfolio structure: Row 1=Watermark, Row 2=Group Headers, Row 3=Column Headers, Row 4+=Data
    // Columns: A=Code, B=Name, C=Units (index 2)
    // Array index 0=Row1, index 1=Row2, index 2=Row3, index 3=Row4 (first data row)

    for (let i = 3; i < portfolioData.length; i++) {
      const fundCode = portfolioData[i][0];
      const units = parseFloat(portfolioData[i][2]) || 0;  // Column C (index 2) = Units

      // If fund code exists and units are 0 or empty, mark for deletion
      if (fundCode && units === 0) {
        const fundName = portfolioData[i][1] || fundCode;
        rowsToDelete.push({ row: i + 1, fundName: fundName });  // +1 because sheet rows are 1-indexed
        log(`Marking row ${i + 1} for deletion: ${fundName} has 0 units`);
      }
    }

    // Delete rows in reverse order to avoid shifting issues
    if (rowsToDelete.length > 0) {
      rowsToDelete.reverse();
      rowsToDelete.forEach(item => {
        log(`Deleting row ${item.row}: ${item.fundName} (0 units)`);
        portfolioSheet.deleteRow(item.row);
      });
      log(`Deleted ${rowsToDelete.length} fund(s) with 0 units from ${portfolioName}`);
    } else {
      log(`No funds with 0 units to delete from ${portfolioName}`);
    }

  } catch (error) {
    log(`Error deleting zero-unit funds: ${error.toString()}`);
    // Don't throw - this is a cleanup operation, shouldn't fail the main transaction
  }
}

/**
 * Add fund to portfolio sheet with formulas
 */
function addFundToPortfolioSheet(portfolioSheet, portfolioId, portfolioName, fundCode, targetAllocation) {
  try {
    log(`Adding fund ${fundCode} to portfolio sheet ${portfolioId}`);
    log(`DEBUG: portfolioSheet = ${portfolioSheet ? portfolioSheet.getName() : 'NULL'}`);
    log(`DEBUG: portfolioName = "${portfolioName}", targetAllocation = ${targetAllocation}`);

    // Get fund details from MutualFundData
    const mfDataSheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!mfDataSheet) {
      throw new Error('MutualFundData sheet not found');
    }

    const mfData = mfDataSheet.getDataRange().getValues();
    let fundName = '';
    let category = '';
    let subCategory = '';
    let riskLevel = '';

    // MutualFundData structure: Row 1 = Headers, Row 2+ = Data
    // Skip header (row 0 in array), start from row 1 (data row 2 in sheet)
    for (let i = 1; i < mfData.length; i++) {
      if (mfData[i][0] && mfData[i][0].toString() === fundCode.toString()) {
        fundName = mfData[i][1];
        // Auto-detect category from fund name since MutualFundData only has 2 columns
        const nameLower = fundName.toLowerCase();
        if (nameLower.includes('equity')) category = 'Equity';
        else if (nameLower.includes('debt') || nameLower.includes('bond')) category = 'Debt';
        else if (nameLower.includes('hybrid') || nameLower.includes('balanced')) category = 'Hybrid';
        else if (nameLower.includes('liquid') || nameLower.includes('money market')) category = 'Liquid';
        else category = 'Other';
        break;
      }
    }

    if (!fundName) {
      throw new Error(`Fund code ${fundCode} not found in MutualFundData`);
    }

    const baseFundName = getBaseFundName(fundName);

    // NOTE: Duplicate check is already done in processInvestment() before calling this function
    // So we can safely add the fund here without checking again

    // Find next empty row in portfolio sheet
    // Portfolio sheet structure: Row 1=Watermark, Row 2=Group headers, Row 3=Column headers, Row 4+=Data
    let newRow;
    const lastRow = portfolioSheet.getLastRow();
    log(`DEBUG addFundToPortfolioSheet: lastRow = ${lastRow}`);

    if (lastRow <= 3) {
      // No data rows yet, start at row 4
      newRow = 4;
      log(`DEBUG: lastRow <= 3, setting newRow = 4`);
    } else {
      // Check if row 4 has actual fund code (not just template formulas)
      const row4FundCode = portfolioSheet.getRange(4, 1).getValue();
      log(`DEBUG: row4FundCode = "${row4FundCode}"`);
      if (!row4FundCode || row4FundCode === '') {
        // Row 4 is empty (only template), use row 4
        newRow = 4;
        log(`DEBUG: row4 is empty, setting newRow = 4`);
      } else {
        // Row 4 has data, find the next empty row
        newRow = lastRow + 1;
        log(`DEBUG: row4 has data, setting newRow = ${newRow}`);
      }
    }

    log(`DEBUG: About to insert fund ${fundCode} at row ${newRow}`);

    // CRITICAL FIX: Ensure sheet has enough rows before insertion
    const maxRows = portfolioSheet.getMaxRows();
    log(`DEBUG: maxRows = ${maxRows}, newRow = ${newRow}`);

    if (newRow > maxRows) {
      const rowsNeeded = newRow - maxRows + 10;  // Add 10 extra rows for future
      log(`DEBUG: Sheet needs more rows! Adding ${rowsNeeded} rows...`);
      portfolioSheet.insertRowsAfter(maxRows, rowsNeeded);
      log(`DEBUG: Successfully added ${rowsNeeded} rows. New maxRows = ${portfolioSheet.getMaxRows()}`);
    } else {
      log(`DEBUG: Enough rows available (${maxRows - newRow + 1} rows left)`);
    }

    // Get metadata sheet name and formulas for SIP and Lumpsum columns
    // AllPortfolios metadata: F=SIP Target (col 6), G=Lumpsum Target (col 7)
    const metadataSheetName = CONFIG.portfolioMetadataSheet;
    // All VLOOKUPs use $Q$1 (portfolioId) to lookup in AllPortfolios by column A (ID)
    const sipFormula = `IFERROR(VLOOKUP($Q$1,${metadataSheetName}!$A:$F,6,FALSE),0)`;
    const lumpsumFormula = `IFERROR(VLOOKUP($Q$1,${metadataSheetName}!$A:$G,7,FALSE),0)`;
    const thresholdFormula = `IFERROR(VLOOKUP($Q$1,${metadataSheetName}!$A:$H,8,FALSE),0.05)*100`;

    // NEW 16-column structure:
    // A=Scheme Code (hidden), B=Fund, C=Units, D=Avg NAV ₹, E=Current NAV ₹, F=Investment ₹,
    // G=Current Allocation %, H=Current Value ₹, I=Target Allocation %, J=Target Value ₹,
    // K=Ongoing SIP ₹, L=Rebalance SIP ₹, M=Target Lumpsum ₹, N=Rebalance Lumpsum ₹, O=Buy/Sell ₹, P=P&L ₹
    // Portfolio ID stored in hidden cell $Q$1 (column 17)

    // A: Scheme Code (value)
    log(`DEBUG: Setting fundCode "${fundCode}" at row ${newRow}, column 1`);
    portfolioSheet.getRange(newRow, 1).setValue(fundCode);
    log(`DEBUG: fundCode set successfully`);

    // B: Fund Name (formula - get directly from MutualFundData using scheme code)
    // This works for all funds, whether you own them or not
    portfolioSheet.getRange(newRow, 2).setFormula(
      `=IF(A${newRow}="","",IFERROR(VLOOKUP(A${newRow},MutualFundData!$A:$B,2,FALSE),"Fund not found"))`
    );

    // C: Units (formula - sum BUY - SELL from TransactionHistory)
    // TransactionHistory: B=Portfolio ID, D=Fund Code, F=Type (BUY/SELL), H=Units
    // CRITICAL: Portfolio ID is in $Q$1 (column 17), not $P$1
    portfolioSheet.getRange(newRow, 3).setFormula(
      `=IF(A${newRow}="","",SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${newRow},TransactionHistory!$F:$F,"BUY")-SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${newRow},TransactionHistory!$F:$F,"SELL"))`
    );

    // D: Avg NAV ₹ (formula - weighted average from BUY transactions)
    // TransactionHistory: B=Portfolio ID, D=Fund Code, F=Type, H=Units, J=Total Amount
    portfolioSheet.getRange(newRow, 4).setFormula(
      `=IF(A${newRow}="","",IFERROR(SUMIFS(TransactionHistory!$J:$J,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${newRow},TransactionHistory!$F:$F,"BUY")/SUMIFS(TransactionHistory!$H:$H,TransactionHistory!$B:$B,$Q$1,TransactionHistory!$D:$D,A${newRow},TransactionHistory!$F:$F,"BUY"),0))`
    );

    // E: Current NAV ₹ (formula - lookup from MutualFundData)
    // MutualFundData: A=Code, D=NAV (column 4)
    portfolioSheet.getRange(newRow, 5).setFormula(
      `=IF(A${newRow}="","",IFERROR(VLOOKUP(A${newRow},MutualFundData!$A:$H,4,FALSE),0))`
    );

    // F: Investment ₹ (formula - Units × Avg NAV)
    portfolioSheet.getRange(newRow, 6).setFormula(
      `=IF(OR(A${newRow}="",C${newRow}=0),"",C${newRow}*D${newRow})`
    );

    // G: Current Allocation % (formula - Current Value / Total Portfolio Value × 100)
    portfolioSheet.getRange(newRow, 7).setFormula(
      `=IF(A${newRow}="","",ROUND(IFERROR(H${newRow}/SUM($H$4:$H$1000)*100,0),2))`
    );

    // H: Current Value ₹ (formula - Units × Current NAV)
    portfolioSheet.getRange(newRow, 8).setFormula(
      `=IF(A${newRow}="","",C${newRow}*E${newRow})`
    );

    // I: Target Allocation % (value - user input)
    portfolioSheet.getRange(newRow, 9).setValue(targetAllocation);

    // J: Target Value ₹ (formula - Target % × Total Portfolio Value)
    portfolioSheet.getRange(newRow, 10).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}=""),"",I${newRow}/100*SUM($H$4:$H$1000))`
    );

    // K: Ongoing SIP ₹ (formula - normal SIP based on target allocation)
    portfolioSheet.getRange(newRow, 11).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}=""),"",I${newRow}/100*${sipFormula})`
    );

    // L: Rebalance SIP ₹ (gap-based — matches React logic)
    // Overweight funds get ₹0. Underweight funds share SIP proportional to gap.
    const totalGapFormula = `SUMPRODUCT(IF(A$4:A$1000<>"",IF(J$4:J$1000-H$4:H$1000>0,J$4:J$1000-H$4:H$1000,0),0))`;
    portfolioSheet.getRange(newRow, 12).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}=""),"",IF(${totalGapFormula}=0,I${newRow}/100*${sipFormula},IF(J${newRow}-H${newRow}>0,(J${newRow}-H${newRow})/${totalGapFormula}*${sipFormula},0)))`
    );

    // M: Target Lumpsum ₹ (formula - simple distribution by target allocation)
    portfolioSheet.getRange(newRow, 13).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}=""),"",I${newRow}/100*${lumpsumFormula})`
    );

    // N: Rebalance Lumpsum ₹ (formula - smart lumpsum, only when deviation exceeds threshold)
    // When within threshold: same as Target Lumpsum. When outside: smart distribution.
    portfolioSheet.getRange(newRow, 14).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}="",${lumpsumFormula}=0),"",IF(ABS(G${newRow}-I${newRow})>${thresholdFormula},MAX(0,I${newRow}/100*(SUM($H$4:$H$1000)+${lumpsumFormula})-H${newRow}),I${newRow}/100*${lumpsumFormula}))`
    );

    // O: Buy/Sell ₹ (formula - target value - current value, only when deviation exceeds threshold)
    // Shows 0 when within threshold — no action needed
    portfolioSheet.getRange(newRow, 15).setFormula(
      `=IF(OR(A${newRow}="",I${newRow}=""),"",IF(ABS(G${newRow}-I${newRow})>${thresholdFormula},J${newRow}-H${newRow},0))`
    );

    // P: P&L ₹ (formula - Current Value - Investment)
    portfolioSheet.getRange(newRow, 16).setFormula(
      `=IF(A${newRow}="","",H${newRow}-F${newRow})`
    );

    // R (18): ATH NAV ₹ - All-Time High NAV from MF_ATH_Data
    portfolioSheet.getRange(newRow, 18).setFormula(
      `=IF(A${newRow}="","",IFERROR(VLOOKUP(A${newRow}*1,MF_ATH_Data!$A:$C,3,FALSE),""))`
    );

    // S (19): % Below ATH - How far below ATH the fund currently is
    portfolioSheet.getRange(newRow, 19).setFormula(
      `=IF(A${newRow}="","",IFERROR(VLOOKUP(A${newRow}*1,MF_ATH_Data!$A:$G,7,FALSE),""))`
    );

    log(`DEBUG: All formulas set, applying formatting...`);

    // Apply formatting
    applyDataRowFormatting(portfolioSheet, newRow, newRow, 16);

    log(`DEBUG: Data row formatting applied`);

    // Apply specific number formats
    const indianCurrencyFormat = '[>=10000000]₹#,##,##,##0.00;[>=100000]₹#,##,##0.00;₹#,##0.00';
    portfolioSheet.getRange(newRow, 3).setNumberFormat('0.000');  // C: Units (3 decimals)
    portfolioSheet.getRange(newRow, 4).setNumberFormat(indianCurrencyFormat);  // D: Avg NAV ₹
    portfolioSheet.getRange(newRow, 5).setNumberFormat(indianCurrencyFormat);  // E: Current NAV ₹
    portfolioSheet.getRange(newRow, 6).setNumberFormat(indianCurrencyFormat);  // F: Investment ₹
    portfolioSheet.getRange(newRow, 7).setNumberFormat('0.00');  // G: Current Allocation %
    portfolioSheet.getRange(newRow, 8).setNumberFormat(indianCurrencyFormat);  // H: Current Value ₹
    portfolioSheet.getRange(newRow, 9).setNumberFormat('0.00');  // I: Target Allocation %
    portfolioSheet.getRange(newRow, 10).setNumberFormat(indianCurrencyFormat);  // J: Target Value ₹
    portfolioSheet.getRange(newRow, 11).setNumberFormat(indianCurrencyFormat);  // K: Ongoing SIP ₹
    portfolioSheet.getRange(newRow, 12).setNumberFormat(indianCurrencyFormat);  // L: Rebalance SIP ₹
    portfolioSheet.getRange(newRow, 13).setNumberFormat(indianCurrencyFormat);  // M: Target Lumpsum ₹
    portfolioSheet.getRange(newRow, 14).setNumberFormat(indianCurrencyFormat);  // N: Rebalance Lumpsum ₹
    portfolioSheet.getRange(newRow, 15).setNumberFormat(indianCurrencyFormat);  // O: Buy/Sell ₹
    portfolioSheet.getRange(newRow, 16).setNumberFormat(indianCurrencyFormat);  // P: P&L ₹
    portfolioSheet.getRange(newRow, 18).setNumberFormat(indianCurrencyFormat);  // R: ATH NAV ₹
    portfolioSheet.getRange(newRow, 19).setNumberFormat('0.00');  // S: % Below ATH

    log(`DEBUG: Number formatting complete`);
    log(`Fund ${fundCode} added to portfolio sheet ${portfolioId} at row ${newRow}`);
    log(`DEBUG: addFundToPortfolioSheet completed successfully`);

    return {
      success: true,
      message: `Fund ${fundCode} added successfully to portfolio ${portfolioName} at row ${newRow}`
    };

  } catch (error) {
    log(`ERROR in addFundToPortfolioSheet: ${error.toString()}`);
    log(`ERROR Stack: ${error.stack || 'No stack trace'}`);
    throw error;
  }
}

/**
 * Get portfolio row number in AllPortfolios sheet
 */
function getPortfolioRowInMetadata(portfolioId) {
  try {
    const sheet = getSheet(CONFIG.portfolioMetadataSheet);
    if (!sheet) {
      throw new Error('AllPortfolios sheet not found');
    }

    const data = sheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === portfolioId) {
        return i + 1;
      }
    }

    return 3; // Default to row 3 if not found

  } catch (error) {
    log(`Error getting portfolio row: ${error.toString()}`);
    return 3;
  }
}

/**
 * Get base fund name (remove - Direct/Regular Plan/Growth/IDCW suffix and everything after)
 * Examples:
 *   "Nippon India Small Cap Fund - Direct Plan - Growth" => "Nippon India Small Cap Fund"
 *   "Nippon India Small Cap Fund - Direct Plan - IDCW Option" => "Nippon India Small Cap Fund"
 *   "Parag Parikh Flexi Cap Fund - Regular Plan - Growth" => "Parag Parikh Flexi Cap Fund"
 *   "HDFC Equity Fund - Direct - Growth" => "HDFC Equity Fund"
 */
function getBaseFundName(fullName) {
  if (!fullName) return '';

  // Remove everything from " - Direct" or " - Regular" onwards
  // This handles: "- Direct Plan - Growth", "- Direct Plan - IDCW Option", "- Direct - Growth", etc.
  return fullName.replace(/\s*-\s*(Direct|Regular).*$/i, '').trim();
}

/**
 * Get all funds in a portfolio.
 * Reads ONLY the portfolio sheet — no external lookups.
 * ATH data comes from sheet columns R/S (VLOOKUP formulas).
 *
 * @param {string} portfolioId - Portfolio ID
 * @param {Array} [portfoliosList] - Optional pre-fetched portfolios (avoids re-read)
 */
function getPortfolioFunds(portfolioId, portfoliosList) {
  try {
    log('Getting funds for portfolio: ' + portfolioId);

    var portfolios = portfoliosList || getAllPortfolios();
    var portfolio = null;
    for (var p = 0; p < portfolios.length; p++) {
      if (portfolios[p].portfolioId === portfolioId) { portfolio = portfolios[p]; break; }
    }
    if (!portfolio) {
      log('Portfolio ID not found in metadata: ' + portfolioId);
      return [];
    }

    var portfolioName = portfolio.portfolioName;
    log('Portfolio name: ' + portfolioName);

    var portfolioSheet = getPortfolioSheet(portfolioId);
    if (!portfolioSheet) {
      log('Portfolio sheet not found: ' + portfolioName);
      return [];
    }

    var lastRow = portfolioSheet.getLastRow();
    log('Portfolio sheet last row: ' + lastRow);

    if (lastRow <= 3) {
      log('No funds in portfolio yet (lastRow <= 3)');
      return [];
    }

    // Portfolio sheet: Row 1=Watermark, Row 2=Group headers, Row 3=Column headers, Row 4+=Data
    // A-P (16 cols) + Q=Portfolio ID (hidden) + R=ATH NAV + S=% Below ATH = 19 cols max
    var maxCol = Math.min(portfolioSheet.getLastColumn(), 19);
    var data = portfolioSheet.getRange(4, 1, lastRow - 3, maxCol).getValues();

    var funds = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[0]) {
        funds.push({
          fundCode: row[0],
          fundName: row[1],
          units: parseFloat(row[2]) || 0,
          avgNav: parseFloat(row[3]) || 0,
          currentNav: parseFloat(row[4]) || 0,
          investment: parseFloat(row[5]) || 0,
          currentAllocationPct: parseFloat(row[6]) || 0,
          currentValue: parseFloat(row[7]) || 0,
          targetAllocationPct: parseFloat(row[8]) || 0,
          targetValue: parseFloat(row[9]) || 0,
          ongoingSIP: parseFloat(row[10]) || 0,
          rebalanceSIP: parseFloat(row[11]) || 0,
          targetLumpsum: parseFloat(row[12]) || 0,
          rebalanceLumpsum: parseFloat(row[13]) || 0,
          buySell: parseFloat(row[14]) || 0,
          pl: parseFloat(row[15]) || 0,
          athNav: maxCol >= 18 ? (parseFloat(row[17]) || 0) : 0,
          belowATHPct: maxCol >= 19 ? (parseFloat(row[18]) || 0) : 0,
          navDate: '',
          portfolioId: portfolioId
        });
      }
    }

    log('Found ' + funds.length + ' funds in portfolio');
    return funds;

  } catch (error) {
    log('Error getting portfolio funds: ' + error.toString());
    return [];
  }
}

/**
 * Search funds in MutualFundData with flexible matching
 * Handles spaces, hyphens, and partial matches
 * Example: "multi asset" will match "Multi-Asset", "Multi - Asset", "MultiAsset"
 *
 * NOTE: This function now uses cache for performance (see searchFundsWithCache in FundCache.gs)
 * This original version is kept for fallback compatibility
 */
function searchFunds(searchTerm) {
  // OPTIMIZED: Uses CacheService to cache fund data for 6 hours
  try {
    log(`Searching for: "${searchTerm}"`);

    // Get funds from cache or load from sheet
    const allFunds = getAllFundsWithCache();

    if (allFunds.length === 0) {
      log('No funds available');
      return [];
    }

    const results = [];
    const searchLower = searchTerm.toLowerCase().trim();

    log(`Searching ${allFunds.length} funds from cache...`);

    // Fast search through cached funds
    for (let i = 0; i < allFunds.length; i++) {
      const fund = allFunds[i];

      // Search only by fund name
      if (fund.fundName.toLowerCase().indexOf(searchLower) !== -1) {
        results.push({
          fundCode: fund.fundCode,
          fundName: fund.fundName,
          category: 'N/A'
        });

        // Limit to 50 results for performance
        if (results.length >= 50) {
          break;
        }
      }
    }

    log(`Search returned ${results.length} results`);
    return results;

  } catch (error) {
    log(`Error searching funds: ${error.toString()}`);
    return [];
  }
}

/**
 * Get all funds with CacheService caching
 * Cache expires after 6 hours or when manually cleared
 */
function getAllFundsWithCache() {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'allFunds';

    // Try to get from cache first (data is stored in chunks due to 100KB limit per key)
    const chunkCount = cache.get(cacheKey + '_count');
    if (chunkCount) {
      log('Loading funds from CacheService (chunked)');

      // Reassemble chunks
      let jsonString = '';
      for (let i = 0; i < parseInt(chunkCount); i++) {
        const chunk = cache.get(cacheKey + '_' + i);
        if (!chunk) {
          log('Cache chunk missing, reloading from sheet');
          break;
        }
        jsonString += chunk;
      }

      if (jsonString.length > 0) {
        try {
          const funds = JSON.parse(jsonString);
          log(`Loaded ${funds.length} funds from cache`);
          return funds;
        } catch (parseError) {
          log('Cache parse error, reloading from sheet: ' + parseError.toString());
        }
      }
    }

    log('Cache miss - loading funds from sheet');

    // Load from sheet
    const sheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!sheet) {
      log('MutualFundData sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      log('No data in MutualFundData sheet');
      return [];
    }

    // Get only Code and Name columns (columns A and B)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    const funds = [];

    for (let i = 0; i < data.length; i++) {
      const code = data[i][0] ? data[i][0].toString().trim() : '';
      const name = data[i][1] ? data[i][1].toString().trim() : '';

      if (code && name) {
        funds.push({
          fundCode: code,
          fundName: name
        });
      }
    }

    log(`Loaded ${funds.length} funds from sheet`);

    // Store in cache for 6 hours (21600 seconds)
    // NOTE: CacheService has 100KB limit per key, so we need to chunk the data
    const jsonString = JSON.stringify(funds);
    const chunkSize = 90000; // 90KB chunks to stay under 100KB limit
    const chunks = [];

    for (let i = 0; i < jsonString.length; i += chunkSize) {
      chunks.push(jsonString.substring(i, i + chunkSize));
    }

    // Store metadata and chunks
    cache.put(cacheKey + '_count', String(chunks.length), 21600);
    for (let j = 0; j < chunks.length; j++) {
      cache.put(cacheKey + '_' + j, chunks[j], 21600);
    }

    log(`Funds cached in ${chunks.length} chunks in CacheService for 6 hours`);

    return funds;

  } catch (error) {
    log(`Error in getAllFundsWithCache: ${error.toString()}`);
    return [];
  }
}

/**
 * Pre-warm the fund cache
 * Call this when dialogs open to ensure cache is ready before user searches
 * This makes the first search instant!
 */
function prewarmFundCache() {
  try {
    log('Pre-warming fund cache...');
    getAllFundsWithCache(); // This will load and cache if not already cached
    log('Fund cache pre-warmed');
    return { success: true };
  } catch (error) {
    log(`Error pre-warming cache: ${error.toString()}`);
    return { success: false };
  }
}

/**
 * Get all funds for client-side searching
 * Returns the complete fund list to the client for instant local search
 * No network calls needed after initial load!
 */
function getAllFundsForClientSearch() {
  try {
    log('Loading all funds with NAV for client-side search');
    const sheet = getSheet(CONFIG.mutualFundDataSheet);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    // Columns: A=Code, B=Name, C=Category, D=NAV, E=Date
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const funds = [];

    for (let i = 0; i < data.length; i++) {
      const code = data[i][0] ? data[i][0].toString().trim() : '';
      const name = data[i][1] ? data[i][1].toString().trim() : '';
      if (!code || !name) continue;

      const nav = parseFloat(data[i][3]) || 0;
      const navDate = data[i][4] ? formatDate(data[i][4]) : '';

      funds.push({ fundCode: code, fundName: name, nav: nav, navDate: navDate });
    }

    log(`Returning ${funds.length} funds with NAV to client`);
    return funds;
  } catch (error) {
    log(`Error in getAllFundsForClientSearch: ${error.toString()}`);
    return [];
  }
}

/**
 * Clear the fund cache manually
 * Call this when MutualFundData is updated
 */
function clearFundCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('allFunds');
    log('Fund cache cleared');
    return { success: true, message: 'Fund cache cleared successfully!' };
  } catch (error) {
    log(`Error clearing cache: ${error.toString()}`);
    return { success: false, message: error.message };
  }
}

/**
 * Menu function to refresh fund cache
 * Clears old cache and rebuilds it
 */
function menuRefreshFundCache() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Clear old cache
    clearFundCache();

    // Pre-warm with new data
    prewarmFundCache();

    ui.alert(
      '✅ Fund Cache Refreshed',
      'The fund cache has been refreshed successfully!\n\n' +
      'All fund searches will now use the latest data from MutualFundData sheet.',
      ui.ButtonSet.OK
    );

  } catch (error) {
    log(`Error in menuRefreshFundCache: ${error.toString()}`);
    SpreadsheetApp.getUi().alert(
      '❌ Error',
      'Failed to refresh fund cache: ' + error.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Get active portfolios for dropdown
 */
function getActivePortfolios() {
  try {
    const portfolios = getAllPortfolios();
    return portfolios.filter(p => p.status === 'Active');
  } catch (error) {
    log(`Error getting active portfolios: ${error.toString()}`);
    return [];
  }
}

/**
 * Calculate total target allocation percentage in a portfolio
 * @param {Sheet} portfolioSheet - The portfolio sheet
 * @returns {number} - Total allocation percentage
 */
function calculateTotalAllocation(portfolioSheet) {
  try {
    const data = portfolioSheet.getDataRange().getValues();
    let totalAllocation = 0;

    // New 16-column structure: Column I (index 8) = Target Allocation %
    // Row 1=Watermark, Row 2=Group headers, Row 3=Column headers, Row 4+=Data
    // Start from row 4 (index 3) - skip header rows
    for (let i = 3; i < data.length; i++) {
      const schemeCode = data[i][0]; // Column A (Scheme Code)
      const targetAlloc = parseFloat(data[i][8]) || 0; // Column I (index 8) = Target Allocation %

      // Only count rows with scheme code (active funds)
      if (schemeCode && schemeCode.toString().trim() !== '') {
        totalAllocation += targetAlloc;
      }
    }

    return totalAllocation;

  } catch (error) {
    log(`Error calculating total allocation: ${error.toString()}`);
    return 0;
  }
}

/**
 * Delete a transaction from TransactionHistory by transactionId.
 * @param {string} transactionId - e.g. "TXN-042"
 */
function deleteTransaction(transactionId) {
  try {
    if (!transactionId) throw new Error('Transaction ID is required');

    var sheet = getSheet(CONFIG.transactionHistorySheet);
    if (!sheet) throw new Error('TransactionHistory sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) throw new Error('No transactions found');

    // Column N (14) = Transaction ID.  Row 1=Watermark, Row 2=Headers, Row 3+=Data
    var ids = sheet.getRange(3, 14, lastRow - 2, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === transactionId) {
        rowIndex = i + 3; // sheet row (1-indexed, offset by header rows)
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Transaction not found: ' + transactionId);

    sheet.deleteRow(rowIndex);
    log('Deleted transaction ' + transactionId + ' at row ' + rowIndex);

    return { success: true, message: 'Transaction deleted' };

  } catch (error) {
    log('Error in deleteTransaction: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Edit a transaction in TransactionHistory by transactionId.
 * Only allows editing: date, units, price (recalculates totalAmount), notes.
 * @param {Object} params - { transactionId, date, units, price, notes }
 */
function editTransaction(params) {
  try {
    if (!params.transactionId) throw new Error('Transaction ID is required');

    var sheet = getSheet(CONFIG.transactionHistorySheet);
    if (!sheet) throw new Error('TransactionHistory sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) throw new Error('No transactions found');

    // Find the row
    var ids = sheet.getRange(3, 14, lastRow - 2, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === params.transactionId) {
        rowIndex = i + 3;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Transaction not found: ' + params.transactionId);

    // Read current row data for fields we won't change
    var rowData = sheet.getRange(rowIndex, 1, 1, 14).getValues()[0];
    // Columns: A=Date(0), B=PortfolioId(1), C=Portfolio(2), D=FundCode(3), E=Fund(4),
    //          F=Type(5), G=TxnType(6), H=Units(7), I=Price(8), J=Amount(9),
    //          K=Notes(10), L=Timestamp(11), M=GainLoss(12), N=TxnId(13)

    var newDate = params.date ? new Date(params.date) : rowData[0];
    var newUnits = params.units !== undefined ? parseFloat(params.units) : parseFloat(rowData[7]) || 0;
    var newPrice = params.price !== undefined ? parseFloat(params.price) : parseFloat(rowData[8]) || 0;
    var newNotes = params.notes !== undefined ? params.notes : (rowData[10] || '');
    var newAmount = newUnits * newPrice;

    if (newUnits <= 0) throw new Error('Units must be greater than 0');
    if (newPrice <= 0) throw new Error('Price must be greater than 0');

    // Recalculate gain/loss for SELL transactions
    var gainLoss = parseFloat(rowData[12]) || 0;
    if (rowData[5] === 'SELL') {
      // We need the avg buy price — recalculate from portfolio
      // For simplicity, we just scale the gain/loss proportionally
      // Original: gainLoss = (sellPrice - avgBuy) * units
      // We only know the change in price/units
      var origUnits = parseFloat(rowData[7]) || 0;
      var origPrice = parseFloat(rowData[8]) || 0;
      if (origUnits > 0 && origPrice > 0) {
        var avgBuyPrice = origPrice - (gainLoss / origUnits);
        gainLoss = (newPrice - avgBuyPrice) * newUnits;
      }
    }

    // Update the row
    sheet.getRange(rowIndex, 1).setValue(newDate);     // A: Date
    sheet.getRange(rowIndex, 8).setValue(newUnits);     // H: Units
    sheet.getRange(rowIndex, 9).setValue(newPrice);     // I: Price
    sheet.getRange(rowIndex, 10).setValue(newAmount);   // J: Total Amount
    sheet.getRange(rowIndex, 11).setValue(newNotes);    // K: Notes
    sheet.getRange(rowIndex, 13).setValue(gainLoss);    // M: Gain/Loss

    // Re-apply number formats
    var indianCurrencyFormat = '₹#,##,##0.00';
    sheet.getRange(rowIndex, 8).setNumberFormat('#,##0.0000');
    sheet.getRange(rowIndex, 9).setNumberFormat(indianCurrencyFormat);
    sheet.getRange(rowIndex, 10).setNumberFormat(indianCurrencyFormat);
    sheet.getRange(rowIndex, 13).setNumberFormat(indianCurrencyFormat);

    log('Edited transaction ' + params.transactionId + ' at row ' + rowIndex);

    return { success: true, message: 'Transaction updated' };

  } catch (error) {
    log('Error in editTransaction: ' + error.toString());
    return { success: false, message: error.message };
  }
}

// ============================================================================
// END OF MUTUALFUNDS.GS
// ============================================================================

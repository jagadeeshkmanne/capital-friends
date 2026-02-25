/**
 * ============================================================================
 * STOCKS.GS - Stock Portfolio Management
 * ============================================================================
 * Handles stock portfolios, transactions, holdings, and master data management
 * Last Updated: 2025-10-25 - Fixed portfolio loading and added Fuse.js search
 */

/**
 * SIMPLE TEST FUNCTION - Returns hardcoded data to verify client-server communication
 */
function testGetActiveStockPortfolios() {
  Logger.log('testGetActiveStockPortfolios called');
  return [
    {
      portfolioId: 'TEST-001',
      portfolioName: 'Test Portfolio',
      status: 'Active'
    }
  ];
}

/**
 * SIMPLIFIED VERSION - Read sheet directly without helper functions
 */
function getActiveStockPortfolios_Simple() {
  try {
    Logger.log('=== getActiveStockPortfolios_Simple START ===');

    const ss = getSpreadsheet();
    Logger.log('Spreadsheet: ' + ss.getName());

    const sheet = ss.getSheetByName('StockPortfolios');
    if (!sheet) {
      Logger.log('ERROR: StockPortfolios sheet not found');
      return [];
    }

    Logger.log('StockPortfolios sheet found');
    const lastRow = sheet.getLastRow();
    Logger.log('Last row: ' + lastRow);

    if (lastRow < 3) {
      Logger.log('No data rows (lastRow < 3)');
      return [];
    }

    // Read from row 3 onwards (row 1 = credit, row 2 = headers)
    const numRows = lastRow - 2;
    Logger.log('Reading ' + numRows + ' rows starting from row 3');

    const data = sheet.getRange(3, 1, numRows, 14).getValues();
    Logger.log('Data read successfully. Rows: ' + data.length);

    const portfolios = [];
    data.forEach((row, idx) => {
      Logger.log('Processing row ' + (idx + 3) + ': Portfolio ID = ' + row[0] + ', Name = ' + row[1] + ', Status = ' + row[12]);

      if (row[0]) { // Has Portfolio ID
        const portfolio = {
          portfolioId: row[0],
          portfolioName: row[1],
          investmentAccountId: row[2],
          ownerId: row[3],
          status: row[12]
        };

        if (row[12] === 'Active') {
          portfolios.push(portfolio);
          Logger.log('Added active portfolio: ' + row[0]);
        } else {
          Logger.log('Skipped inactive portfolio: ' + row[0] + ' (status: ' + row[12] + ')');
        }
      }
    });

    Logger.log('Returning ' + portfolios.length + ' active portfolios');
    Logger.log('Portfolios: ' + JSON.stringify(portfolios));
    return portfolios;

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

// ============================================================================
// STOCK MASTER DATA
// ============================================================================
// Note: Stock data is copied from Master Database during setup
// and refreshed daily via dailyUserSync trigger

// ============================================================================
// STOCK SEARCH
// ============================================================================

/**
 * Search stocks by company name or symbol
 * Returns array of matching stocks
 */
function searchStocks(query) {
  try {
    if (!query || query.trim() === '') {
      return [];
    }

    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) {
      throw new Error('StockMasterData sheet not found');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      return [];
    }

    // Get all stock data (columns A-J)
    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    const searchTerm = query.toLowerCase().trim();
    const results = [];

    data.forEach(row => {
      const symbol = row[0] ? row[0].toString().toLowerCase() : '';
      const companyName = row[2] ? row[2].toString().toLowerCase() : '';
      const status = row[8] ? row[8].toString() : '';

      // Skip inactive/delisted stocks
      if (status !== 'Active') return;

      // Match on symbol or company name
      if (symbol.includes(searchTerm) || companyName.includes(searchTerm)) {
        results.push({
          symbol: row[0],              // A: Symbol
          bseCode: row[1],             // B: BSE Code
          companyName: row[2],         // C: Company Name
          exchange: row[3],            // D: Exchange
          gfNSE: row[4],               // E: Google Finance NSE
          gfBSE: row[5],               // F: Google Finance BSE
          sector: row[6],              // G: Sector
          industry: row[7],            // H: Industry
          status: row[8],              // I: Status
          isin: row[9]                 // J: ISIN
        });
      }
    });

    // Sort by relevance (exact symbol match first, then alphabetically)
    results.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();

      // Exact match first
      if (aSymbol === searchTerm && bSymbol !== searchTerm) return -1;
      if (bSymbol === searchTerm && aSymbol !== searchTerm) return 1;

      // Starts with search term
      if (aSymbol.startsWith(searchTerm) && !bSymbol.startsWith(searchTerm)) return -1;
      if (bSymbol.startsWith(searchTerm) && !aSymbol.startsWith(searchTerm)) return 1;

      // Alphabetical
      return a.companyName.localeCompare(b.companyName);
    });

    // Return top 50 results
    return results.slice(0, 50);

  } catch (error) {
    log('Error searching stocks: ' + error.toString());
    return [];
  }
}

/**
 * Get ALL stocks for client-side search (Fuse.js)
 * Returns all active NSE stocks for local fuzzy search
 */
function getAllStocksForClientSearch() {
  try {
    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) {
      log('StockMasterData sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      log('No stock data available');
      return [];
    }

    // Get all stock data (columns A-J)
    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    const stocks = [];

    data.forEach(row => {
      const status = row[8] ? row[8].toString() : '';

      // Skip inactive/delisted stocks
      if (status !== 'Active') return;

      stocks.push({
        symbol: row[0],              // A: Symbol
        bseCode: row[1],             // B: BSE Code
        companyName: row[2],         // C: Company Name
        exchange: row[3],            // D: Exchange
        gfNSE: row[4],               // E: Google Finance NSE
        gfBSE: row[5],               // F: Google Finance BSE
        sector: row[6],              // G: Sector
        industry: row[7],            // H: Industry
        status: row[8],              // I: Status
        isin: row[9]                 // J: ISIN
      });
    });

    log(`Returning ${stocks.length} active stocks for client search`);
    return stocks;

  } catch (error) {
    log('Error getting all stocks for client search: ' + error.toString());
    return [];
  }
}

/**
 * Get stock details by symbol
 */
function getStockBySymbol(symbol) {
  try {
    if (!symbol) return null;

    const sheet = getSheet(CONFIG.stockMasterDataSheet);
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) return null;

    const data = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase() === symbol.toUpperCase()) {
        return {
          symbol: data[i][0],
          bseCode: data[i][1],
          companyName: data[i][2],
          exchange: data[i][3],
          gfNSE: data[i][4],
          gfBSE: data[i][5],
          sector: data[i][6],
          industry: data[i][7],
          status: data[i][8],
          isin: data[i][9]
        };
      }
    }

    return null;

  } catch (error) {
    log('Error getting stock by symbol: ' + error.toString());
    return null;
  }
}

// ============================================================================
// STOCK PORTFOLIOS
// ============================================================================

/**
 * Get all stock portfolios
 */
function getAllStockPortfolios() {
  try {
    log('getAllStockPortfolios() called');

    const sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) {
      log('ERROR: StockPortfolios sheet not found');
      return [];
    }

    log('StockPortfolios sheet found');

    const lastRow = sheet.getLastRow();
    log('Last row: ' + lastRow);

    // StockPortfolios has only 1 header row (row 2), so data starts at row 3
    if (lastRow < 3) {
      log('No portfolios data (lastRow < 3), returning empty array');
      return [];
    }

    const data = sheet.getRange(3, 1, lastRow - 2, 14).getValues();
    log('Data rows read: ' + data.length);
    log('First row data: ' + JSON.stringify(data[0]));

    const portfolios = [];

    data.forEach((row, index) => {
      log(`Row ${index}: Portfolio ID = ${row[0]}, Name = ${row[1]}, Status = ${row[12]}`);
      if (row[0]) { // Has Portfolio ID
        portfolios.push({
          portfolioId: row[0],              // A
          portfolioName: row[1],            // B
          investmentAccountId: row[2],       // C (stores account ID like IA-001)
          investmentAccountName: '',        // Not stored — resolved via investmentAccountId lookup
          ownerId: row[3],                  // D (stores member ID like FM-001)
          ownerName: '',                    // Not stored — resolved via ownerId lookup
          totalInvestment: row[4],          // E
          currentValue: row[5],             // F
          unrealizedPL: row[6],             // G
          unrealizedPLPct: row[7],          // H
          realizedPL: row[8],               // I
          realizedPLPct: row[9],            // J
          totalPL: row[10],                 // K
          totalPLPct: row[11],              // L
          status: row[12],                  // M
          createdDate: row[13] ? row[13].toString() : ''  // N - Convert Date to String
        });
        log(`Portfolio added: ${row[0]} - ${row[1]}`);
      } else {
        log(`Row ${index} skipped - no Portfolio ID`);
      }
    });

    log('Returning ' + portfolios.length + ' stock portfolios');
    return portfolios;

  } catch (error) {
    log('Error getting stock portfolios: ' + error.toString());
    return [];
  }
}

/**
 * Get active stock portfolios only (for dropdowns)
 * Returns only essential fields to avoid serialization issues
 */
function getActiveStockPortfolios() {
  try {
    Logger.log('getActiveStockPortfolios called');

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('StockPortfolios');

    if (!sheet) {
      Logger.log('StockPortfolios sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    Logger.log('Last row: ' + lastRow);

    if (lastRow < 3) {
      Logger.log('No data rows (lastRow < 3)');
      return [];
    }

    // Read only first 5 columns to avoid formula issues
    const data = sheet.getRange(3, 1, lastRow - 2, 5).getValues();
    Logger.log('Read ' + data.length + ' rows');

    // Get status from column M (13th column)
    const statusData = sheet.getRange(3, 13, lastRow - 2, 1).getValues();

    const activePortfolios = [];

    data.forEach((row, idx) => {
      const status = statusData[idx][0];
      Logger.log('Row ' + (idx + 3) + ': ID=' + row[0] + ', Name=' + row[1] + ', Status=' + status);

      if (row[0] && status === 'Active') {
        const portfolio = {
          portfolioId: String(row[0]),           // A - Convert to string
          portfolioName: String(row[1]),         // B - Convert to string
          investmentAccount: String(row[2]),     // C - Convert to string
          owner: String(row[3]),                 // D - Convert to string
          status: 'Active'
        };
        activePortfolios.push(portfolio);
        Logger.log('Added: ' + JSON.stringify(portfolio));
      }
    });

    Logger.log('Returning ' + activePortfolios.length + ' portfolios');
    Logger.log('Result: ' + JSON.stringify(activePortfolios));
    return activePortfolios;

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

/**
 * Generate next stock portfolio ID
 */
function generateStockPortfolioId() {
  const portfolios = getAllStockPortfolios();
  const existingIds = portfolios.map(p => p.portfolioId);
  return generateId('PFL-STK', existingIds);
}

/**
 * Create a new stock portfolio
 */
function createStockPortfolio(portfolioName, investmentAccount, owner) {
  try {
    if (!portfolioName || portfolioName.trim() === '') {
      throw new Error('Portfolio name is required');
    }

    if (!investmentAccount || investmentAccount.trim() === '') {
      throw new Error('Investment account is required');
    }

    if (!owner || owner.trim() === '') {
      throw new Error('Owner is required');
    }

    const sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) {
      throw new Error('StockPortfolios sheet not found');
    }

    const portfolioId = generateStockPortfolioId();
    const createdDate = new Date();

    // Formulas for P&L calculations (will calculate after transactions are added)
    const totalInvestmentFormula = `=SUMIFS(StockTransactions!$N:$N, StockTransactions!$B:$B, A${sheet.getLastRow() + 1}, StockTransactions!$H:$H, "BUY") - SUMIFS(StockTransactions!$N:$N, StockTransactions!$B:$B, A${sheet.getLastRow() + 1}, StockTransactions!$H:$H, "SELL")`;
    const currentValueFormula = `=SUMIFS(StockHoldings!$K:$K, StockHoldings!$A:$A, A${sheet.getLastRow() + 1})`;
    const unrealizedPLFormula = `=F${sheet.getLastRow() + 1} - E${sheet.getLastRow() + 1}`;
    const unrealizedPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, G${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;
    const realizedPLFormula = `=SUMIFS(StockTransactions!$P:$P, StockTransactions!$B:$B, A${sheet.getLastRow() + 1})`;
    const realizedPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, I${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;
    const totalPLFormula = `=G${sheet.getLastRow() + 1} + I${sheet.getLastRow() + 1}`;
    const totalPLPctFormula = `=IF(E${sheet.getLastRow() + 1}>0, K${sheet.getLastRow() + 1}/E${sheet.getLastRow() + 1}, 0)`;

    sheet.appendRow([
      portfolioId,                  // A: Portfolio ID
      portfolioName,                // B: Portfolio Name
      investmentAccount,            // C: Investment Account
      owner,                        // D: Owner
      totalInvestmentFormula,       // E: Total Investment ₹ (formula)
      currentValueFormula,          // F: Current Value ₹ (formula)
      unrealizedPLFormula,          // G: Unrealized P&L ₹ (formula)
      unrealizedPLPctFormula,       // H: Unrealized P&L % (formula)
      realizedPLFormula,            // I: Realized P&L ₹ (formula)
      realizedPLPctFormula,         // J: Realized P&L % (formula)
      totalPLFormula,               // K: Total P&L ₹ (formula)
      totalPLPctFormula,            // L: Total P&L % (formula)
      'Active',                     // M: Status
      createdDate                   // N: Created Date
    ]);

    log(`Stock portfolio created: ${portfolioId} - ${portfolioName}`);

    return {
      success: true,
      portfolioId: portfolioId,
      portfolioName: portfolioName
    };

  } catch (error) {
    log('Error creating stock portfolio: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// STOCK TRANSACTIONS
// ============================================================================

/**
 * Buy stocks - adds transaction and updates holdings
 */
function buyStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes) {
  try {
    // Validate inputs
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!stockSymbol) throw new Error('Stock symbol is required');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');
    if (!pricePerShare || pricePerShare <= 0) throw new Error('Price must be greater than 0');
    if (!transactionDate) throw new Error('Transaction date is required');

    // Convert date string to Date object if needed
    if (typeof transactionDate === 'string') {
      transactionDate = new Date(transactionDate);
    }

    // Get stock details
    const stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      throw new Error(`Stock not found: ${stockSymbol}`);
    }

    // Get portfolio details
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!transactionsSheet) {
      throw new Error('StockTransactions sheet not found');
    }

    // Generate transaction ID
    const lastRow = transactionsSheet.getLastRow();
    const existingIds = lastRow > 2
      ? transactionsSheet.getRange(3, 1, lastRow - 2, 1).getValues().flat()
      : [];
    const transactionId = generateId('TXN-STK', existingIds);

    // Calculate amounts
    const totalAmount = quantity * pricePerShare;
    const brokerageAmount = brokerage || 0;
    const netAmount = totalAmount + brokerageAmount;

    // Determine which Google Finance symbol to use (prefer NSE)
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Add transaction
    transactionsSheet.appendRow([
      transactionId,                // A: Transaction ID
      portfolioId,                  // B: Portfolio ID
      portfolio.portfolioName,      // C: Portfolio Name
      stock.symbol,                 // D: Stock Symbol
      stock.companyName,            // E: Company Name
      stock.exchange,               // F: Exchange
      gfSymbol,                     // G: Google Finance Symbol
      'BUY',                        // H: Transaction Type
      transactionDate,              // I: Date
      quantity,                     // J: Quantity
      pricePerShare,                // K: Price per Share ₹
      totalAmount,                  // L: Total Amount ₹
      brokerageAmount,              // M: Brokerage ₹
      netAmount,                    // N: Net Amount ₹
      notes || '',                  // O: Notes
      ''                            // P: Realized P&L ₹ (blank for BUY)
    ]);

    log(`Stock purchased: ${transactionId} - ${quantity} shares of ${stockSymbol} @ ₹${pricePerShare}`);

    // Update holdings
    recalculateStockHoldings(portfolioId, stockSymbol);

    return {
      success: true,
      transactionId: transactionId,
      message: `Successfully purchased ${quantity} shares of ${stock.companyName} (${stockSymbol})`
    };

  } catch (error) {
    log('Error buying stock: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sell stocks - adds transaction with FIFO P&L calculation and updates holdings
 */
function sellStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes) {
  try {
    // Validate inputs
    if (!portfolioId) throw new Error('Portfolio ID is required');
    if (!stockSymbol) throw new Error('Stock symbol is required');
    if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than 0');
    if (!pricePerShare || pricePerShare <= 0) throw new Error('Price must be greater than 0');
    if (!transactionDate) throw new Error('Transaction date is required');

    // Convert date string to Date object if needed
    if (typeof transactionDate === 'string') {
      transactionDate = new Date(transactionDate);
    }

    // Get stock details
    const stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      throw new Error(`Stock not found: ${stockSymbol}`);
    }

    // Get portfolio details
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    // Check current holdings
    const holdingsSheet = getSheet(CONFIG.stockHoldingsSheet);
    if (!holdingsSheet) {
      throw new Error('StockHoldings sheet not found');
    }

    const holdingsLastRow = holdingsSheet.getLastRow();
    let currentHolding = null;

    if (holdingsLastRow > 2) {
      const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();
      currentHolding = holdingsData.find(row =>
        row[0] === portfolioId && row[2] === stockSymbol
      );
    }

    if (!currentHolding) {
      throw new Error(`You don't own any shares of ${stockSymbol} in this portfolio`);
    }

    const availableQuantity = currentHolding[6]; // Column G: Total Quantity
    if (quantity > availableQuantity) {
      throw new Error(`Insufficient shares. Available: ${availableQuantity}, Requested: ${quantity}`);
    }

    // Calculate FIFO-based realized P&L
    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!transactionsSheet) {
      throw new Error('StockTransactions sheet not found');
    }

    const transLastRow = transactionsSheet.getLastRow();
    const transactions = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 16).getValues()
      : [];

    // Get all BUY transactions for this stock in this portfolio (sorted by date)
    const buyTransactions = transactions
      .filter(row =>
        row[1] === portfolioId &&
        row[3] === stockSymbol &&
        row[7] === 'BUY'
      )
      .map(row => ({
        date: row[8],
        quantity: row[9],
        pricePerShare: row[10]
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate FIFO cost basis
    let remainingToSell = quantity;
    let totalCostBasis = 0;

    for (const buy of buyTransactions) {
      if (remainingToSell <= 0) break;

      const qtyFromThisBuy = Math.min(remainingToSell, buy.quantity);
      totalCostBasis += qtyFromThisBuy * buy.pricePerShare;
      remainingToSell -= qtyFromThisBuy;
    }

    const avgCostBasis = totalCostBasis / quantity;
    const saleAmount = quantity * pricePerShare;
    const brokerageAmount = brokerage || 0;
    const netSaleAmount = saleAmount - brokerageAmount;
    const realizedPL = netSaleAmount - totalCostBasis;

    // Generate transaction ID
    const existingIds = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 1).getValues().flat()
      : [];
    const transactionId = generateId('TXN-STK', existingIds);

    // Determine which Google Finance symbol to use
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Add SELL transaction
    transactionsSheet.appendRow([
      transactionId,                // A: Transaction ID
      portfolioId,                  // B: Portfolio ID
      portfolio.portfolioName,      // C: Portfolio Name
      stock.symbol,                 // D: Stock Symbol
      stock.companyName,            // E: Company Name
      stock.exchange,               // F: Exchange
      gfSymbol,                     // G: Google Finance Symbol
      'SELL',                       // H: Transaction Type
      transactionDate,              // I: Date
      quantity,                     // J: Quantity
      pricePerShare,                // K: Price per Share ₹
      saleAmount,                   // L: Total Amount ₹
      brokerageAmount,              // M: Brokerage ₹
      netSaleAmount,                // N: Net Amount ₹
      notes || '',                  // O: Notes
      realizedPL                    // P: Realized P&L ₹ (FIFO calculation)
    ]);

    log(`Stock sold: ${transactionId} - ${quantity} shares of ${stockSymbol} @ ₹${pricePerShare}, Realized P&L: ₹${realizedPL.toFixed(2)}`);

    // Update holdings
    recalculateStockHoldings(portfolioId, stockSymbol);

    return {
      success: true,
      transactionId: transactionId,
      realizedPL: realizedPL,
      message: `Successfully sold ${quantity} shares of ${stock.companyName} (${stockSymbol}). Realized P&L: ₹${realizedPL.toFixed(2)}`
    };

  } catch (error) {
    log('Error selling stock: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// STOCK HOLDINGS
// ============================================================================

/**
 * Recalculate stock holdings for a specific portfolio and stock
 * Called after each BUY or SELL transaction
 */
function recalculateStockHoldings(portfolioId, stockSymbol) {
  try {
    const transactionsSheet = getSheet(CONFIG.stockTransactionsSheet);
    const holdingsSheet = getSheet(CONFIG.stockHoldingsSheet);

    if (!transactionsSheet || !holdingsSheet) {
      throw new Error('Required sheets not found');
    }

    // Get all transactions for this portfolio and stock
    const transLastRow = transactionsSheet.getLastRow();
    const transactions = transLastRow > 2
      ? transactionsSheet.getRange(3, 1, transLastRow - 2, 16).getValues()
      : [];

    const relevantTransactions = transactions.filter(row =>
      row[1] === portfolioId && row[3] === stockSymbol
    );

    if (relevantTransactions.length === 0) {
      return; // No transactions, nothing to do
    }

    // Calculate total quantity and weighted average price
    let totalQuantity = 0;
    let totalInvestment = 0;
    let buyQuantity = 0;

    relevantTransactions.forEach(row => {
      const type = row[7];           // H: Transaction Type
      const quantity = row[9];       // J: Quantity
      const pricePerShare = row[10]; // K: Price per Share

      if (type === 'BUY') {
        buyQuantity += quantity;
        totalQuantity += quantity;
        totalInvestment += (quantity * pricePerShare);
      } else if (type === 'SELL') {
        totalQuantity -= quantity;
      }
    });

    // If all sold, remove from holdings
    if (totalQuantity <= 0) {
      const holdingsLastRow = holdingsSheet.getLastRow();
      if (holdingsLastRow > 2) {
        const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();

        for (let i = 0; i < holdingsData.length; i++) {
          if (holdingsData[i][0] === portfolioId && holdingsData[i][2] === stockSymbol) {
            holdingsSheet.deleteRow(i + 3); // +3 because row 1 is header, row 2 is column headers, data starts at row 3
            log(`Removed holding: ${stockSymbol} (fully sold)`);
            return;
          }
        }
      }
      return;
    }

    // Calculate weighted average buy price
    const avgBuyPrice = buyQuantity > 0 ? totalInvestment / buyQuantity : 0;
    const currentInvestment = totalQuantity * avgBuyPrice;

    // Get stock details
    const stock = getStockBySymbol(stockSymbol);
    if (!stock) {
      log(`Warning: Stock not found in master data: ${stockSymbol}`);
      return;
    }

    // Get portfolio name
    const portfolios = getAllStockPortfolios();
    const portfolio = portfolios.find(p => p.portfolioId === portfolioId);
    const portfolioName = portfolio ? portfolio.portfolioName : '';

    // Determine which Google Finance symbol to use
    const gfSymbol = stock.gfNSE || stock.gfBSE || '';

    // Check if holding already exists
    const holdingsLastRow = holdingsSheet.getLastRow();
    let existingRowIndex = -1;

    if (holdingsLastRow > 2) {
      const holdingsData = holdingsSheet.getRange(3, 1, holdingsLastRow - 2, 15).getValues();

      for (let i = 0; i < holdingsData.length; i++) {
        if (holdingsData[i][0] === portfolioId && holdingsData[i][2] === stockSymbol) {
          existingRowIndex = i + 3; // +3 for header rows
          break;
        }
      }
    }

    const rowNum = existingRowIndex > 0 ? existingRowIndex : holdingsLastRow + 1;

    // Formulas for live price and P&L calculations
    const currentPriceFormula = gfSymbol ? `=IFERROR(GOOGLEFINANCE("${gfSymbol}", "price"), 0)` : 0;
    const currentValueFormula = `=G${rowNum}*J${rowNum}`;
    const unrealizedPLFormula = `=K${rowNum}-I${rowNum}`;
    const unrealizedPLPctFormula = `=IF(I${rowNum}>0, L${rowNum}/I${rowNum}, 0)`;

    const rowData = [
      portfolioId,                  // A: Portfolio ID
      portfolioName,                // B: Portfolio Name
      stock.symbol,                 // C: Stock Symbol
      stock.companyName,            // D: Company Name
      stock.exchange,               // E: Exchange
      gfSymbol,                     // F: Google Finance Symbol
      totalQuantity,                // G: Total Quantity
      avgBuyPrice,                  // H: Average Buy Price ₹
      currentInvestment,            // I: Total Investment ₹
      currentPriceFormula,          // J: Current Price ₹ (GOOGLEFINANCE formula)
      currentValueFormula,          // K: Current Value ₹ (formula)
      unrealizedPLFormula,          // L: Unrealized P&L ₹ (formula)
      unrealizedPLPctFormula,       // M: Unrealized P&L % (formula)
      stock.sector || '',           // N: Sector
      new Date()                    // O: Last Updated
    ];

    if (existingRowIndex > 0) {
      // Update existing holding
      holdingsSheet.getRange(rowNum, 1, 1, 15).setValues([rowData]);
      log(`Updated holding: ${stockSymbol} in ${portfolioId} - Qty: ${totalQuantity}`);
    } else {
      // Add new holding
      holdingsSheet.appendRow(rowData);
      log(`Added holding: ${stockSymbol} in ${portfolioId} - Qty: ${totalQuantity}`);
    }

  } catch (error) {
    log('Error recalculating holdings: ' + error.toString());
    throw error;
  }
}

/**
 * Get stock holdings for a specific portfolio (for Sell dialog)
 */
function getStockHoldingsByPortfolio(portfolioId) {
  try {
    const sheet = getSheet(CONFIG.stockHoldingsSheet);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) return [];

    const data = sheet.getRange(3, 1, lastRow - 2, 15).getValues();
    const holdings = [];

    data.forEach(row => {
      if (row[0] === portfolioId && row[6] > 0) { // Portfolio ID matches and has quantity
        holdings.push({
          portfolioId: row[0],          // A
          portfolioName: row[1],        // B
          symbol: row[2],               // C
          companyName: row[3],          // D
          exchange: row[4],             // E
          gfSymbol: row[5],             // F
          quantity: row[6],             // G
          avgBuyPrice: row[7],          // H
          totalInvestment: row[8],      // I
          currentPrice: row[9],         // J
          currentValue: row[10],        // K
          unrealizedPL: row[11],        // L
          unrealizedPLPct: row[12],     // M
          sector: row[13],              // N
          lastUpdated: row[14]          // O
        });
      }
    });

    return holdings;

  } catch (error) {
    log('Error getting stock holdings by portfolio: ' + error.toString());
    return [];
  }
}

// ============================================================================
// END OF STOCKS.GS
// ============================================================================

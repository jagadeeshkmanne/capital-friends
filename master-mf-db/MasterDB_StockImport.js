/**
 * ============================================================================
 * MASTER DATABASE - STOCK IMPORT SCRIPT
 * ============================================================================
 *
 * INSTRUCTIONS:
 * 1. Copy this entire file
 * 2. Open Master Database: https://docs.google.com/spreadsheets/d/1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s/edit
 * 3. Go to Extensions → Apps Script
 * 4. Create new file: "StockImport.gs"
 * 5. Paste this code
 * 6. Save
 * 7. Run initialStockImport() ONCE to import all stocks
 * 8. Run installDailyStockUpdateTrigger() to enable daily auto-updates
 */

const STOCK_SHEET_NAME = 'Stock_Data';

// ============================================================================
// INITIAL IMPORT (RUN ONCE)
// ============================================================================

/**
 * Initial import of all stocks from Tickertape API
 * RUN THIS ONCE to populate Stock_Data sheet with 5,292 NSE stocks
 */
function initialStockImport() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Confirm before running
    const response = ui.alert(
      'Initial Stock Import',
      'This will import ~5,292 NSE stocks from Tickertape API.\n\n' +
      'This should only be run ONCE for initial setup.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }

    Logger.log('Starting initial stock import...');

    // Fetch from Tickertape API
    const url = 'https://api.tickertape.in/stocks/list';
    const apiResponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (apiResponse.getResponseCode() !== 200) {
      throw new Error('Failed to fetch data from Tickertape API');
    }

    const json = JSON.parse(apiResponse.getContentText());

    if (!json.success || !json.data) {
      throw new Error('Invalid response from Tickertape API');
    }

    const allData = json.data;
    const stocks = allData.filter(item => item.type === 'stock'); // Skip ETFs

    Logger.log(`Found ${stocks.length} stocks in Tickertape API`);

    // Get or create Stock_Data sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(STOCK_SHEET_NAME);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(STOCK_SHEET_NAME);

      // Add headers
      sheet.appendRow([
        'Symbol',                  // A: NSE Symbol (RELIANCE, TCS, INFY)
        'BSE Code',                // B: BSE Code (blank for now)
        'Company Name',            // C: Full company name
        'Exchange',                // D: NSE
        'Google Finance NSE',      // E: NSE:RELIANCE
        'Google Finance BSE',      // F: BOM:500325 (blank for now)
        'Sector',                  // G: Blank for now
        'Industry',                // H: Blank for now
        'Status',                  // I: Active
        'ISIN'                     // J: INE002A01018
      ]);

      // Format header
      const headerRange = sheet.getRange('A1:J1');
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a5568');
      headerRange.setFontColor('#ffffff');

      sheet.setFrozenRows(1);
    }

    // Clear existing data (keep headers)
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).clearContent();
    }

    // Build rows
    const rows = [];

    stocks.forEach(stock => {
      const nseSymbol = stock.ticker;      // RELIANCE, TCS, etc.
      const companyName = stock.name;      // Full company name
      const isin = stock.isin;             // INE002A01018
      const gfNSE = `NSE:${nseSymbol}`;    // NSE:RELIANCE

      rows.push([
        nseSymbol,         // A: Symbol
        '',                // B: BSE Code (blank)
        companyName,       // C: Company Name
        'NSE',             // D: Exchange
        gfNSE,             // E: Google Finance NSE
        '',                // F: Google Finance BSE (blank)
        '',                // G: Sector (blank)
        '',                // H: Industry (blank)
        'Active',          // I: Status
        isin               // J: ISIN
      ]);
    });

    // Write all rows at once
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 10).setValues(rows);
    }

    Logger.log(`Successfully imported ${rows.length} stocks`);

    ui.alert(
      '✅ Import Complete',
      `Successfully imported ${rows.length} NSE stocks!\n\n` +
      `Sheet: ${STOCK_SHEET_NAME}\n\n` +
      `Next step: Run installDailyStockUpdateTrigger() to enable daily auto-updates.`,
      ui.ButtonSet.OK
    );

    return { success: true, count: rows.length };

  } catch (error) {
    Logger.log('Error in initial stock import: ' + error.toString());
    SpreadsheetApp.getUi().alert('❌ Import Failed', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// INCREMENTAL UPDATE (RUNS DAILY VIA TRIGGER)
// ============================================================================

/**
 * Add new stocks from Tickertape API (incremental update)
 * This runs daily via trigger
 * - Adds NEW stocks only
 * - NEVER deletes existing stocks
 * - Safe if API is blocked (existing data untouched)
 */
function addNewStocksDaily() {
  try {
    Logger.log('Starting daily stock update...');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(STOCK_SHEET_NAME);

    if (!sheet) {
      Logger.log('Stock_Data sheet not found. Run initialStockImport() first.');
      return { success: false, error: 'Sheet not found' };
    }

    // Get existing ISINs
    const lastRow = sheet.getLastRow();
    const existingISINs = [];

    if (lastRow > 1) {
      const existingData = sheet.getRange(2, 10, lastRow - 1, 1).getValues(); // Column J: ISIN
      existingData.forEach(row => {
        if (row[0]) existingISINs.push(row[0]);
      });
    }

    Logger.log(`Found ${existingISINs.length} existing stocks`);

    // Fetch latest from Tickertape API
    const url = 'https://api.tickertape.in/stocks/list';
    const apiResponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (apiResponse.getResponseCode() !== 200) {
      Logger.log('Failed to fetch from Tickertape API (API may be blocked)');
      return { success: false, error: 'API unavailable', existingCount: existingISINs.length };
    }

    const json = JSON.parse(apiResponse.getContentText());

    if (!json.success || !json.data) {
      Logger.log('Invalid API response');
      return { success: false, error: 'Invalid response' };
    }

    const allData = json.data;
    const stocks = allData.filter(item => item.type === 'stock');

    Logger.log(`Found ${stocks.length} stocks in API`);

    // Find NEW stocks only (not in existing ISINs)
    const newRows = [];
    let newCount = 0;

    stocks.forEach(stock => {
      // Skip if already exists
      if (existingISINs.includes(stock.isin)) {
        return;
      }

      const nseSymbol = stock.ticker;
      const companyName = stock.name;
      const isin = stock.isin;
      const gfNSE = `NSE:${nseSymbol}`;

      newRows.push([
        nseSymbol,         // A: Symbol
        '',                // B: BSE Code
        companyName,       // C: Company Name
        'NSE',             // D: Exchange
        gfNSE,             // E: Google Finance NSE
        '',                // F: Google Finance BSE
        '',                // G: Sector
        '',                // H: Industry
        'Active',          // I: Status
        isin               // J: ISIN
      ]);

      newCount++;
    });

    // Append new stocks (NEVER delete existing)
    if (newRows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRows.length, 10).setValues(newRows);
      Logger.log(`Added ${newCount} new stocks`);
    } else {
      Logger.log('No new stocks to add');
    }

    const totalCount = existingISINs.length + newCount;
    Logger.log(`Total stocks in database: ${totalCount}`);

    return {
      success: true,
      newCount: newCount,
      existingCount: existingISINs.length,
      totalCount: totalCount
    };

  } catch (error) {
    Logger.log('Error in daily stock update: ' + error.toString());
    return { success: false, error: error.message };
  }
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Install daily trigger for stock updates
 * Runs addNewStocksDaily() every day at 2 AM IST
 */
function installDailyStockUpdateTrigger() {
  try {
    const ui = SpreadsheetApp.getUi();

    // Remove existing triggers first
    removeDailyStockUpdateTrigger();

    // Create new trigger
    ScriptApp.newTrigger('addNewStocksDaily')
      .timeBased()
      .atHour(2)  // 2 AM IST
      .everyDays(1)
      .create();

    Logger.log('Daily stock update trigger installed (runs at 2 AM IST daily)');

    ui.alert(
      '✅ Trigger Installed',
      'Daily stock update trigger installed successfully!\n\n' +
      'Schedule: Every day at 2:00 AM IST\n' +
      'Function: addNewStocksDaily()\n\n' +
      'This will automatically add new stocks from Tickertape API daily.\n' +
      'Existing stocks are NEVER deleted.',
      ui.ButtonSet.OK
    );

    return { success: true };

  } catch (error) {
    Logger.log('Error installing trigger: ' + error.toString());
    SpreadsheetApp.getUi().alert('❌ Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, error: error.message };
  }
}

/**
 * Remove daily stock update trigger
 */
function removeDailyStockUpdateTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'addNewStocksDaily') {
        ScriptApp.deleteTrigger(trigger);
        Logger.log('Removed existing addNewStocksDaily trigger');
      }
    });

    return { success: true };

  } catch (error) {
    Logger.log('Error removing trigger: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Create custom menu for Master DB
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📊 Stock Management')
    .addItem('📥 Initial Import (Run Once)', 'initialStockImport')
    .addSeparator()
    .addItem('🔄 Update Stocks Now', 'addNewStocksDaily')
    .addSeparator()
    .addItem('⏰ Install Daily Auto-Update', 'installDailyStockUpdateTrigger')
    .addItem('❌ Remove Auto-Update', 'removeDailyStockUpdateTrigger')
    .addToUi();

  ui.createMenu('📈 ATH Tracking')
    .addItem('🔧 Setup ATH (Run Once)', 'setupATH')
    .addItem('🚀 Initialize ATH for All Funds', 'startATHInitialization')
    .addItem('⏹️ Stop Initialization', 'stopATHInitialization')
    .addSeparator()
    .addItem('➕ Add Funds Manually', 'promptAddFundToATH')
    .addItem('🔁 Retry Failed Funds', 'retryFailedATH')
    .addSeparator()
    .addItem('🔄 Update ATH Now', 'dailyATHUpdate')
    .addItem('🗑️ Reset ATH Sheet (Start Fresh)', 'resetATHSheet')
    .addToUi();
}

// ============================================================================
// END OF MASTER DB STOCK IMPORT SCRIPT
// ============================================================================

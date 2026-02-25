/**
 * ============================================================================
 * ATH (ALL-TIME HIGH) NAV TRACKING
 * ============================================================================
 *
 * Tracks All-Time High NAV for mutual funds.
 * Used by user templates for Pyramid/Martingale buy strategy.
 *
 * How it works:
 * 1. Admin adds fund scheme codes to MF_ATH sheet (or uses menu to add)
 * 2. Run "Fetch ATH for New Funds" to pull historical ATH from mfapi.in
 * 3. Daily trigger compares current NAV (from MF_Data) vs stored ATH
 * 4. If current NAV > ATH → updates ATH (new all-time high!)
 * 5. User templates IMPORTRANGE from MF_ATH sheet
 *
 * API: https://api.mfapi.in/mf/{schemeCode} (free, no auth needed)
 * ============================================================================
 */

const ATH_CONFIG = {
  athSheet: 'MF_ATH',
  mfApiBaseUrl: 'https://api.mfapi.in/mf/',
  // Columns in MF_ATH sheet
  columns: {
    schemeCode: 1,   // A
    fundName: 2,     // B
    athNav: 3,       // C
    athDate: 4,      // D
    lastChecked: 5,  // E
    currentNav: 6,   // F
    belowATH: 7      // G - % below ATH
  }
};

/**
 * Create MF_ATH sheet with proper structure
 * Run this once during setup
 */
function createATHSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ATH_CONFIG.athSheet);

  if (sheet) {
    Logger.log('MF_ATH sheet already exists');
    return sheet;
  }

  sheet = ss.insertSheet(ATH_CONFIG.athSheet);

  // Set headers
  const headers = [
    ['Scheme Code', 'Fund Name', 'ATH NAV', 'ATH Date', 'Last Checked', 'Current NAV', '% Below ATH']
  ];

  sheet.getRange(1, 1, 1, 7).setValues(headers);

  // Format headers
  sheet.getRange(1, 1, 1, 7)
    .setFontWeight('bold')
    .setBackground('#1a202c')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Set column widths
  sheet.setColumnWidth(1, 120);  // Scheme Code
  sheet.setColumnWidth(2, 400);  // Fund Name
  sheet.setColumnWidth(3, 120);  // ATH NAV
  sheet.setColumnWidth(4, 120);  // ATH Date
  sheet.setColumnWidth(5, 120);  // Last Checked
  sheet.setColumnWidth(6, 120);  // Current NAV
  sheet.setColumnWidth(7, 120);  // % Below ATH

  // Format columns
  sheet.getRange(2, 3, 1000, 1).setNumberFormat('#,##0.0000');  // ATH NAV
  sheet.getRange(2, 6, 1000, 1).setNumberFormat('#,##0.0000');  // Current NAV
  sheet.getRange(2, 7, 1000, 1).setNumberFormat('0.00"%"');     // % Below ATH

  // ARRAYFORMULA for Current NAV - auto VLOOKUP from MF_Data (no script needed!)
  sheet.getRange('F2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",IFERROR(VLOOKUP(A2:A,MF_Data!A:D,4,FALSE),"")))'
  );

  // ARRAYFORMULA for % Below ATH - auto-calculated from ATH and Current NAV
  // NOTE: Use ()*() multiplication instead of AND() for element-wise evaluation in ARRAYFORMULA
  sheet.getRange('G2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",IF((C2:C>0)*(F2:F>0),(C2:C-F2:F)/C2:C*100,0)))'
  );

  sheet.setFrozenRows(1);

  Logger.log('MF_ATH sheet created successfully');
  return sheet;
}

/**
 * Fetch ATH NAV for a single fund from mfapi.in
 * Returns { athNav, athDate, fundName } or null on failure
 */
function fetchATHForFund(schemeCode) {
  try {
    const url = ATH_CONFIG.mfApiBaseUrl + schemeCode;
    Logger.log('Fetching ATH for scheme: ' + schemeCode + ' from ' + url);

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log('API returned HTTP ' + response.getResponseCode() + ' for scheme ' + schemeCode);
      return null;
    }

    const json = JSON.parse(response.getContentText());

    if (json.status !== 'SUCCESS' || !json.data || json.data.length === 0) {
      Logger.log('No data found for scheme ' + schemeCode);
      return null;
    }

    const fundName = json.meta ? json.meta.scheme_name : '';

    // Find ATH - max NAV across all historical data
    let athNav = 0;
    let athDate = '';

    for (let i = 0; i < json.data.length; i++) {
      const nav = parseFloat(json.data[i].nav);
      if (nav > athNav) {
        athNav = nav;
        athDate = json.data[i].date; // dd-mm-yyyy format from API
      }
    }

    Logger.log('ATH for ' + schemeCode + ': NAV=' + athNav + ' on ' + athDate);

    return {
      athNav: athNav,
      athDate: athDate,
      fundName: fundName
    };

  } catch (error) {
    Logger.log('Error fetching ATH for ' + schemeCode + ': ' + error.message);
    return null;
  }
}

/**
 * Fetch ATH for all funds in MF_ATH that don't have ATH yet
 * Admin adds scheme codes to column A, then runs this to fill in ATH data
 */
function fetchMissingATH() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ATH_CONFIG.athSheet);

  if (!sheet) {
    Logger.log('MF_ATH sheet not found. Run createATHSheet() first.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No funds in MF_ATH sheet. Add scheme codes to column A first.');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < data.length; i++) {
    const schemeCode = String(data[i][0]).trim();
    const existingATH = data[i][2]; // Column C: ATH NAV

    if (!schemeCode) continue;

    // Skip if ATH already exists
    if (existingATH && existingATH > 0) {
      skipped++;
      continue;
    }

    // Fetch ATH from API
    const result = fetchATHForFund(schemeCode);

    if (result) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 2).setValue(result.fundName);          // Fund Name
      sheet.getRange(rowNum, 3).setValue(result.athNav);            // ATH NAV
      sheet.getRange(rowNum, 4).setValue(result.athDate);           // ATH Date
      sheet.getRange(rowNum, 5).setValue(new Date());               // Last Checked
      fetched++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting (500ms between API calls)
    Utilities.sleep(500);
  }

  Logger.log('ATH fetch complete: ' + fetched + ' fetched, ' + skipped + ' skipped, ' + failed + ' failed');
}

/**
 * Add fund to ATH tracking via prompt
 * Admin enters scheme code(s), function fetches ATH and adds to sheet
 */
function promptAddFundToATH() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'Add Fund to ATH Tracking',
    'Enter scheme code(s) separated by commas:\n\nExample: 119551, 120503, 118989',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const input = response.getResponseText().trim();
  if (!input) return;

  const schemeCodes = input.split(',').map(function(code) { return code.trim(); }).filter(function(code) { return code; });

  if (schemeCodes.length === 0) {
    ui.alert('No valid scheme codes entered.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ATH_CONFIG.athSheet);

  if (!sheet) {
    sheet = createATHSheet();
  }

  // Get existing scheme codes to avoid duplicates
  const lastRow = sheet.getLastRow();
  const existingCodes = [];
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    existing.forEach(function(row) { if (row[0]) existingCodes.push(String(row[0]).trim()); });
  }

  let added = 0;
  let duplicates = 0;
  let failed = 0;

  for (let i = 0; i < schemeCodes.length; i++) {
    const code = schemeCodes[i];

    if (existingCodes.indexOf(code) !== -1) {
      duplicates++;
      continue;
    }

    // Fetch ATH from API
    const result = fetchATHForFund(code);

    if (result) {
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, 5).setValues([[
        code,
        result.fundName,
        result.athNav,
        result.athDate,
        new Date()
      ]]);
      existingCodes.push(code);
      added++;
    } else {
      failed++;
    }

    // Small delay between API calls
    if (i < schemeCodes.length - 1) Utilities.sleep(500);
  }

  // Current NAV and % below ATH auto-update via ARRAYFORMULA in columns F & G

  ui.alert(
    'ATH Tracking Updated',
    'Added: ' + added + '\nDuplicates skipped: ' + duplicates + '\nFailed: ' + failed,
    ui.ButtonSet.OK
  );
}

/**
 * DAILY UPDATE: Compare current NAV (from MF_Data) vs stored ATH
 * Updates ATH if current NAV exceeds it
 * Also updates Current NAV and % Below ATH columns
 *
 * This function requires NO API calls - just compares two sheets!
 * Schedule this to run AFTER refreshMutualFundData() (e.g., 7 AM)
 */
function dailyATHUpdate() {
  Logger.log('Starting daily ATH update...');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const athSheet = ss.getSheetByName(ATH_CONFIG.athSheet);
  const mfSheet = ss.getSheetByName(CONFIG.dataSheet);

  if (!athSheet || !mfSheet) {
    Logger.log('Required sheets not found. ATH: ' + !!athSheet + ', MF_Data: ' + !!mfSheet);
    return;
  }

  const athLastRow = athSheet.getLastRow();
  if (athLastRow < 2) {
    Logger.log('No funds in MF_ATH sheet');
    return;
  }

  // Build NAV lookup map from MF_Data
  const mfLastRow = mfSheet.getLastRow();
  if (mfLastRow < 2) {
    Logger.log('MF_Data is empty');
    return;
  }

  const mfData = mfSheet.getRange(2, 1, mfLastRow - 1, 4).getValues(); // Code, Name, Category, NAV
  const navMap = {};
  for (let i = 0; i < mfData.length; i++) {
    var fundCode = String(mfData[i][0]).trim();
    if (fundCode) {
      navMap[fundCode] = parseFloat(mfData[i][3]) || 0;
    }
  }

  // Read ATH data (only need columns A-E, F & G are formulas)
  const athData = athSheet.getRange(2, 1, athLastRow - 1, 5).getValues();

  let updated = 0;
  let checked = 0;
  const today = new Date();

  for (let i = 0; i < athData.length; i++) {
    const schemeCode = String(athData[i][0]).trim();
    if (!schemeCode) continue;

    const storedATH = parseFloat(athData[i][2]) || 0;
    const currentNav = navMap[schemeCode] || 0;

    if (currentNav <= 0) continue;

    checked++;

    // Only update if current NAV exceeds stored ATH (new all-time high!)
    if (currentNav > storedATH) {
      const rowNum = i + 2;
      athSheet.getRange(rowNum, ATH_CONFIG.columns.athNav).setValue(currentNav);
      athSheet.getRange(rowNum, ATH_CONFIG.columns.athDate).setValue(
        Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd-MM-yyyy')
      );
      athSheet.getRange(rowNum, ATH_CONFIG.columns.lastChecked).setValue(today);
      updated++;
      Logger.log('New ATH for ' + schemeCode + ': ' + storedATH + ' → ' + currentNav);
    }
  }

  // Current NAV (col F) and % Below ATH (col G) auto-update via ARRAYFORMULA
  Logger.log('Daily ATH update complete: ' + checked + ' checked, ' + updated + ' new ATH found');

  // --- NEW FUND DETECTION ---
  // Check if MF_Data has funds not yet in MF_ATH and add them
  const existingATHCodes = {};
  for (let i = 0; i < athData.length; i++) {
    const code = String(athData[i][0]).trim();
    if (code) existingATHCodes[code] = true;
  }

  const newCodes = [];
  for (let i = 0; i < mfData.length; i++) {
    const code = String(mfData[i][0]).trim();
    if (code && !existingATHCodes[code]) {
      newCodes.push(code);
    }
  }

  if (newCodes.length > 0) {
    Logger.log('Found ' + newCodes.length + ' new funds in MF_Data not in MF_ATH. Fetching ATH...');

    const newRows = [];
    let fetchSuccess = 0;
    let fetchFailed = 0;

    // Limit to 50 new funds per daily run to stay within time limits
    const batchLimit = Math.min(newCodes.length, 50);

    for (let i = 0; i < batchLimit; i++) {
      const result = fetchATHForFund(newCodes[i]);

      if (result && result.athNav > 0) {
        newRows.push([newCodes[i], result.fundName, result.athNav, result.athDate, new Date()]);
        fetchSuccess++;
      } else {
        // Don't write FETCH_FAILED for daily detection — just skip.
        // Failed funds will be retried in the next daily run since they're still not in MF_ATH.
        fetchFailed++;
        Logger.log('Failed to fetch ATH for new fund ' + newCodes[i] + ' — will retry next run');
      }

      // Delay between API calls
      if (i < batchLimit - 1) Utilities.sleep(300);
    }

    // Write new rows to MF_ATH
    if (newRows.length > 0) {
      const colAValues = athSheet.getRange(2, 1, Math.max(1, athSheet.getLastRow() - 1), 1).getValues();
      let lastDataRow = 1;
      for (let r = colAValues.length - 1; r >= 0; r--) {
        if (String(colAValues[r][0]).trim()) {
          lastDataRow = r + 2;
          break;
        }
      }
      const startRow = lastDataRow + 1;
      athSheet.getRange(startRow, 1, newRows.length, 5).setValues(newRows);
      SpreadsheetApp.flush();
      Logger.log('Added ' + newRows.length + ' new funds to MF_ATH (' + fetchSuccess + ' OK, ' + fetchFailed + ' failed)');

      if (newCodes.length > batchLimit) {
        Logger.log('NOTE: ' + (newCodes.length - batchLimit) + ' more new funds remain. They will be added in the next daily run.');
      }
    }
  } else {
    Logger.log('No new funds to add to MF_ATH');
  }
}

/**
 * Set up daily ATH update trigger
 * Runs at 7 AM (1 hour after MF_Data refresh at 6 AM)
 */
function setupATHTrigger() {
  // Remove existing ATH triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dailyATHUpdate') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger at 7 AM
  ScriptApp.newTrigger('dailyATHUpdate')
    .timeBased()
    .atHour(7)
    .everyDays(1)
    .create();

  Logger.log('ATH daily trigger set to run at 7:00 AM');
}

/**
 * Full ATH setup - run once
 * Creates sheet + installs trigger
 */
function setupATH() {
  createATHSheet();
  setupATHTrigger();

  SpreadsheetApp.getUi().alert(
    'ATH Tracking Setup Complete',
    'MF_ATH sheet created and daily trigger installed (7 AM).\n\n' +
    'Next steps:\n' +
    '1. Run "Initialize ATH for All Funds" to populate ATH for all funds in MF_Data\n' +
    '2. This runs in batches (~200 funds per run, auto-continues every 10 min)\n' +
    '3. ATH will auto-update daily after NAV refresh',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Reset MF_ATH sheet - deletes and recreates with fixed formulas
 * Use this if the sheet has issues (empty rows, broken formulas)
 */
function resetATHSheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset MF_ATH Sheet',
    'This will DELETE the existing MF_ATH sheet and create a fresh one.\n\n' +
    'All existing ATH data will be lost.\n' +
    'You will need to run "Initialize ATH for All Funds" again.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const existingSheet = ss.getSheetByName(ATH_CONFIG.athSheet);
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
    Logger.log('Deleted existing MF_ATH sheet');
  }

  // Also stop any running initialization
  removeATHInitTrigger();

  createATHSheet();
  ui.alert('MF_ATH sheet has been reset.\n\nRun "Initialize ATH for All Funds" to populate data.');
}

// ============================================================================
// BATCH INITIALIZATION - Populate ATH for ALL funds from MF_Data
// ============================================================================

/**
 * Initialize ATH for ALL funds in MF_Data (batch processing)
 *
 * Since MF_Data has 8500+ funds and each needs an API call to mfapi.in,
 * this processes ~200 funds per run (within Apps Script 6-min limit).
 *
 * Progress is saved in Script Properties so it can resume where it left off.
 * A temporary trigger auto-runs this every 10 minutes until all funds are done.
 *
 * Flow:
 * 1. Read all scheme codes from MF_Data
 * 2. Check which are already in MF_ATH (skip those)
 * 3. Process next batch of ~200 funds
 * 4. If more remain, auto-trigger runs again in 10 min
 * 5. When all done, removes the trigger
 */
function initializeATHForAllFunds() {
  const startTime = new Date();
  const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes (safe margin under 6-min limit)
  const DELAY_BETWEEN_CALLS = 300; // 300ms between API calls

  Logger.log('=== ATH Batch Initialization Started ===');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mfSheet = ss.getSheetByName(CONFIG.dataSheet);
  let athSheet = ss.getSheetByName(ATH_CONFIG.athSheet);

  if (!mfSheet) {
    Logger.log('MF_Data sheet not found!');
    return;
  }

  if (!athSheet) {
    athSheet = createATHSheet();
  }

  // Get ALL scheme codes from MF_Data
  const mfLastRow = mfSheet.getLastRow();
  if (mfLastRow < 2) {
    Logger.log('MF_Data is empty');
    return;
  }

  const mfData = mfSheet.getRange(2, 1, mfLastRow - 1, 2).getValues(); // Code + Name
  const allCodes = [];
  for (let i = 0; i < mfData.length; i++) {
    const code = String(mfData[i][0]).trim();
    if (code) allCodes.push(code);
  }

  Logger.log('Total funds in MF_Data: ' + allCodes.length);

  // Get existing codes in MF_ATH (to skip)
  const athLastRow = athSheet.getLastRow();
  const existingCodes = {};
  if (athLastRow > 1) {
    const athData = athSheet.getRange(2, 1, athLastRow - 1, 1).getValues();
    for (let i = 0; i < athData.length; i++) {
      var code = String(athData[i][0]).trim();
      if (code) existingCodes[code] = true;
    }
  }

  Logger.log('Already in MF_ATH: ' + Object.keys(existingCodes).length);

  // Find codes that need ATH
  const pendingCodes = allCodes.filter(function(code) { return !existingCodes[code]; });
  Logger.log('Pending ATH fetch: ' + pendingCodes.length);

  if (pendingCodes.length === 0) {
    Logger.log('All funds already have ATH! Removing initialization trigger.');
    removeATHInitTrigger();
    updateATHInitProgress(allCodes.length, allCodes.length, 'Complete');
    return;
  }

  // Process batch
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const batchRows = [];

  for (let i = 0; i < pendingCodes.length; i++) {
    // Check time limit
    if (new Date() - startTime > MAX_RUNTIME_MS) {
      Logger.log('Time limit reached. Processed ' + processed + ' in this batch.');
      break;
    }

    const schemeCode = pendingCodes[i];
    const result = fetchATHForFund(schemeCode);

    if (result) {
      batchRows.push([
        schemeCode,
        result.fundName,
        result.athNav,
        result.athDate,
        new Date()
      ]);
      succeeded++;
    } else {
      // Still add the row with scheme code so we don't retry failed ones endlessly
      batchRows.push([
        schemeCode,
        '',
        0,
        'FETCH_FAILED',
        new Date()
      ]);
      failed++;
    }

    processed++;

    // Delay between API calls
    if (i < pendingCodes.length - 1) {
      Utilities.sleep(DELAY_BETWEEN_CALLS);
    }
  }

  // Write batch to MF_ATH sheet
  if (batchRows.length > 0) {
    // Use column A data count for startRow (getLastRow() is inflated by ARRAYFORMULA in F/G)
    const colAValues = athSheet.getRange(2, 1, Math.max(1, athSheet.getLastRow() - 1), 1).getValues();
    let lastDataRow = 1; // default: just header
    for (let r = colAValues.length - 1; r >= 0; r--) {
      if (String(colAValues[r][0]).trim()) {
        lastDataRow = r + 2; // +2 because colAValues[0] = row 2
        break;
      }
    }
    const startRow = lastDataRow + 1;
    athSheet.getRange(startRow, 1, batchRows.length, 5).setValues(batchRows);
    SpreadsheetApp.flush(); // Force-commit writes so data is immediately visible
    Logger.log('Wrote ' + batchRows.length + ' rows to MF_ATH (starting at row ' + startRow + ')');
  }

  const totalDone = Object.keys(existingCodes).length + processed;
  const remaining = allCodes.length - totalDone;

  Logger.log('Batch complete: ' + succeeded + ' succeeded, ' + failed + ' failed');
  Logger.log('Progress: ' + totalDone + '/' + allCodes.length + ' (' + remaining + ' remaining)');

  // Update progress in metadata
  updateATHInitProgress(totalDone, allCodes.length, remaining > 0 ? 'In Progress' : 'Complete');

  if (remaining > 0) {
    Logger.log('More funds remaining. Trigger will run again in ~10 minutes.');
    ensureATHInitTrigger();
  } else {
    Logger.log('All funds processed! Removing initialization trigger.');
    removeATHInitTrigger();
  }
}

/**
 * Start ATH initialization with user confirmation
 * Sets up auto-continuing trigger
 */
function startATHInitialization() {
  const ui = SpreadsheetApp.getUi();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mfSheet = ss.getSheetByName(CONFIG.dataSheet);
  const mfLastRow = mfSheet ? mfSheet.getLastRow() - 1 : 0;

  const response = ui.alert(
    'Initialize ATH for All Funds',
    'This will fetch ATH (All-Time High) NAV for all ' + mfLastRow + ' funds in MF_Data.\n\n' +
    'How it works:\n' +
    '• Processes ~200 funds per batch (within 5-min limit)\n' +
    '• Auto-continues every 10 minutes\n' +
    '• For ' + mfLastRow + ' funds, it will take roughly ' + Math.ceil(mfLastRow / 200) + ' batches\n' +
    '• Estimated total time: ~' + Math.ceil(mfLastRow / 200 * 10) + ' minutes\n\n' +
    'You can close the sheet - it runs in the background.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  // Ensure MF_ATH sheet exists
  if (!ss.getSheetByName(ATH_CONFIG.athSheet)) {
    createATHSheet();
  }

  // Set up auto-continue trigger
  ensureATHInitTrigger();

  // Run first batch immediately
  initializeATHForAllFunds();

  ui.alert(
    'ATH Initialization Started',
    'First batch is processing.\n\n' +
    'Progress will auto-continue every 10 minutes in the background.\n' +
    'Check MF_Metadata sheet for progress updates.\n\n' +
    'You can close this sheet - it will continue running.',
    ui.ButtonSet.OK
  );
}

/**
 * Stop ATH initialization (if running)
 */
function stopATHInitialization() {
  removeATHInitTrigger();
  SpreadsheetApp.getUi().alert(
    'ATH Initialization Stopped',
    'Background initialization has been stopped.\n\n' +
    'You can resume later by running "Initialize ATH for All Funds" again.\n' +
    'Already fetched ATH data is preserved.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Ensure the auto-continue trigger exists for ATH initialization
 */
function ensureATHInitTrigger() {
  // Check if trigger already exists
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'initializeATHForAllFunds') {
      return; // Already exists
    }
  }

  // Create trigger to run every 10 minutes
  ScriptApp.newTrigger('initializeATHForAllFunds')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('ATH initialization trigger installed (every 10 min)');
}

/**
 * Remove the ATH initialization trigger
 */
function removeATHInitTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'initializeATHForAllFunds') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Removed ATH initialization trigger');
    }
  });
}

/**
 * Update ATH initialization progress in MF_Metadata sheet
 */
function updateATHInitProgress(done, total, status) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.metadataSheet);
    if (!sheet) return;

    // Find or create ATH progress rows
    const lastRow = sheet.getLastRow();
    let athProgressRow = -1;
    let athStatusRow = -1;

    if (lastRow > 1) {
      const labels = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < labels.length; i++) {
        if (labels[i][0] === 'ATH Progress') athProgressRow = i + 2;
        if (labels[i][0] === 'ATH Status') athStatusRow = i + 2;
      }
    }

    // Add rows if they don't exist
    if (athProgressRow === -1) {
      athProgressRow = lastRow + 1;
      sheet.getRange(athProgressRow, 1).setValue('ATH Progress');
    }
    if (athStatusRow === -1) {
      athStatusRow = athProgressRow + 1;
      sheet.getRange(athStatusRow, 1).setValue('ATH Status');
    }

    sheet.getRange(athProgressRow, 2).setValue(done + ' / ' + total + ' funds');
    sheet.getRange(athStatusRow, 2).setValue(status + ' (Last: ' + new Date().toLocaleString() + ')');

  } catch (e) {
    Logger.log('Error updating progress: ' + e.message);
  }
}

/**
 * Retry fetching ATH for funds that failed (marked as FETCH_FAILED)
 */
function retryFailedATH() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ATH_CONFIG.athSheet);

  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  let retried = 0;
  let fixed = 0;

  for (let i = 0; i < data.length; i++) {
    const schemeCode = String(data[i][0]).trim();
    const existingATHNav = parseFloat(data[i][2]) || 0;
    const athDate = String(data[i][3]).trim();

    if (!schemeCode || athDate !== 'FETCH_FAILED') continue;

    // Skip if ATH NAV already has a valid value (e.g., manually corrected by user)
    if (existingATHNav > 0) {
      Logger.log('Skipping ' + schemeCode + ' — already has valid ATH NAV: ' + existingATHNav);
      continue;
    }

    retried++;
    const result = fetchATHForFund(schemeCode);

    if (result && result.athNav > 0) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, 2).setValue(result.fundName);
      sheet.getRange(rowNum, 3).setValue(result.athNav);
      sheet.getRange(rowNum, 4).setValue(result.athDate);
      sheet.getRange(rowNum, 5).setValue(new Date());
      fixed++;
    }

    Utilities.sleep(500);
  }

  Logger.log('Retry complete: ' + retried + ' retried, ' + fixed + ' fixed');
}

// ============================================================================
// END OF ATH.JS
// ============================================================================

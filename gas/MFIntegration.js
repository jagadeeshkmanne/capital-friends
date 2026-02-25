/**
 * Mutual Fund Integration for User Templates
 * This file goes in the USER TEMPLATE (not the master database)
 * It uses IMPORTRANGE to fetch data from the master MF database
 */

/**
 * Configuration for MF Integration
 */
const MF_INTEGRATION_CONFIG = {
  // URL of the Master MF Database sheet
  masterDatabaseUrl: 'https://docs.google.com/spreadsheets/d/1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s/edit',

  // Master DB sheet ID
  masterDatabaseId: '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s',

  // Sheet name in master DB where MF data is stored
  masterDataSheet: 'MF_Data',

  // Local sheet name where imported MF data will be cached
  localMFSheet: 'MutualFundData',

  // Cache duration (refresh every 24 hours)
  cacheHours: 24
};

/**
 * Set up MF database import in user template
 * This creates a local sheet with IMPORTRANGE formula
 * Run this function ONCE when user runs ONE-CLICK SETUP
 */
function setupMFDatabaseImport() {
  try {
    Logger.log('Setting up MF database import...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let mfSheet = ss.getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    // Delete existing sheet if it exists
    if (mfSheet) {
      ss.deleteSheet(mfSheet);
    }

    // Create new sheet
    mfSheet = ss.insertSheet(MF_INTEGRATION_CONFIG.localMFSheet);

    // Add IMPORTRANGE formula to import all data from master database
    // Columns: Fund Code, Fund Name, Category, NAV, Date, Fund House, Type, Status
    const importFormula = `=IMPORTRANGE("${MF_INTEGRATION_CONFIG.masterDatabaseId}", "${MF_INTEGRATION_CONFIG.masterDataSheet}!A:H")`;

    mfSheet.getRange('A1').setFormula(importFormula);

    // Add instructions
    mfSheet.getRange('L1').setValue('📊 MF Database');
    mfSheet.getRange('L2').setValue('This data is imported from the master database.');
    mfSheet.getRange('L3').setValue('Updates automatically - do not edit manually!');
    mfSheet.getRange('L4').setValue('Last synced: ' + new Date());

    // Format instructions
    mfSheet.getRange('L1:L4').setFontWeight('bold').setBackground('#fff3cd');

    // Hide the sheet (optional - users don't need to see it)
    mfSheet.hideSheet();

    Logger.log('MF database import set up successfully');

    // First time - user needs to grant IMPORTRANGE permission
    SpreadsheetApp.getUi().alert(
      '📊 MF Database Setup',
      'Click "Allow access" when prompted to connect to the master mutual fund database.\n\n' +
      'This is a one-time setup. The database will update automatically.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return { success: true };

  } catch (error) {
    Logger.log('Error setting up MF database import: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get mutual fund data from local imported sheet
 *
 * @param {string} searchTerm - Search by scheme name or code
 * @returns {Array<Object>} Array of matching MF schemes
 */
function searchMutualFundsLocal(searchTerm) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    if (!sheet) {
      Logger.log('MF Database sheet not found. Run setupMFDatabaseImport() first.');
      return [];
    }

    // Get data (skip header row)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    // Filter based on search term
    const searchLower = searchTerm.toLowerCase();
    const results = data.filter(row => {
      const schemeCode = (row[0] || '').toString().toLowerCase();
      const schemeName = (row[1] || '').toString().toLowerCase();
      const amc = (row[2] || '').toString().toLowerCase();

      return schemeCode.includes(searchLower) ||
             schemeName.includes(searchLower) ||
             amc.includes(searchLower);
    });

    // Convert to objects
    return results.map(row => ({
      schemeCode: row[0],
      schemeName: row[1],
      amc: row[2],
      schemeType: row[3],
      category: row[4],
      latestNav: row[5],
      navDate: row[6],
      expenseRatio: row[7],
      aum: row[8],
      isin: row[9]
    }));

  } catch (error) {
    Logger.log('Error searching mutual funds: ' + error.message);
    return [];
  }
}

/**
 * Get MF details by scheme code
 *
 * @param {string} schemeCode - Scheme code
 * @returns {Object|null} MF details or null if not found
 */
function getMFDetailsByCode(schemeCode) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    if (!sheet) {
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return null;
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    const row = data.find(r => r[0].toString() === schemeCode.toString());

    if (!row) {
      return null;
    }

    return {
      schemeCode: row[0],
      schemeName: row[1],
      amc: row[2],
      schemeType: row[3],
      category: row[4],
      latestNav: row[5],
      navDate: row[6],
      expenseRatio: row[7],
      aum: row[8],
      isin: row[9]
    };

  } catch (error) {
    Logger.log('Error getting MF details: ' + error.message);
    return null;
  }
}

/**
 * Get current NAV for a scheme
 *
 * @param {string} schemeCode - Scheme code
 * @returns {number|null} Current NAV or null if not found
 */
function getCurrentNAV(schemeCode) {
  const details = getMFDetailsByCode(schemeCode);
  return details ? parseFloat(details.latestNav) : null;
}

/**
 * Get list of AMCs for dropdown
 *
 * @returns {Array<string>} Unique list of AMCs
 */
function getAMCList() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const data = sheet.getRange(2, 3, lastRow - 1, 1).getValues(); // Column C: AMC

    // Get unique AMCs and sort
    const amcs = [...new Set(data.map(row => row[0]).filter(amc => amc))];
    return amcs.sort();

  } catch (error) {
    Logger.log('Error getting AMC list: ' + error.message);
    return [];
  }
}

/**
 * Get schemes by AMC
 *
 * @param {string} amcName - AMC/Fund house name
 * @returns {Array<Object>} List of schemes from that AMC
 */
function getSchemesByAMC(amcName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    if (!sheet) {
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    const results = data.filter(row => row[2] === amcName); // Column C: AMC

    return results.map(row => ({
      schemeCode: row[0],
      schemeName: row[1],
      amc: row[2],
      schemeType: row[3],
      category: row[4],
      latestNav: row[5],
      navDate: row[6]
    }));

  } catch (error) {
    Logger.log('Error getting schemes by AMC: ' + error.message);
    return [];
  }
}

/**
 * Calculate investment value based on units and current NAV
 *
 * @param {string} schemeCode - Scheme code
 * @param {number} units - Number of units held
 * @returns {Object} Calculated values
 */
function calculateMFInvestmentValue(schemeCode, units) {
  try {
    const nav = getCurrentNAV(schemeCode);

    if (!nav || !units) {
      return null;
    }

    const currentValue = nav * units;

    return {
      nav: nav,
      units: units,
      currentValue: currentValue
    };

  } catch (error) {
    Logger.log('Error calculating investment value: ' + error.message);
    return null;
  }
}

/**
 * Update MF investment with latest NAV
 * Call this from a button or time-driven trigger to update all MF investments
 *
 * @param {string} investmentId - Investment ID
 * @returns {Object} Update result
 */
function updateMFInvestmentNAV(investmentId) {
  try {
    // Get investment details
    const investment = getInvestmentById(investmentId);

    if (!investment) {
      return { success: false, error: 'Investment not found' };
    }

    // Extract scheme code from dynamic fields
    const dynamicFields = investment.dynamicFields ? JSON.parse(investment.dynamicFields) : {};
    const schemeCode = dynamicFields['Scheme Code'];

    if (!schemeCode) {
      return { success: false, error: 'Scheme code not found in investment' };
    }

    // Get current NAV
    const mfDetails = getMFDetailsByCode(schemeCode);

    if (!mfDetails) {
      return { success: false, error: 'Scheme not found in database' };
    }

    // Calculate current value if units are available
    const units = parseFloat(dynamicFields['Units'] || 0);
    const currentValue = units * parseFloat(mfDetails.latestNav);

    // Update the investment's current value
    const sheet = getSheet(CONFIG.otherInvestmentsSheet);
    const investments = getAllInvestments();
    const inv = investments.find(i => i.investmentId === investmentId);

    if (inv) {
      sheet.getRange(inv.rowIndex, 8).setValue(currentValue); // Column H: Current Value

      Logger.log(`Updated investment ${investmentId}: NAV=${mfDetails.latestNav}, Value=${currentValue}`);

      return {
        success: true,
        nav: mfDetails.latestNav,
        navDate: mfDetails.navDate,
        units: units,
        currentValue: currentValue
      };
    }

    return { success: false, error: 'Failed to update investment' };

  } catch (error) {
    Logger.log('Error updating MF investment NAV: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk update all MF investments with latest NAVs
 * Run this daily via time-driven trigger
 */
function updateAllMFInvestmentsNAV() {
  try {
    Logger.log('Updating all MF investments...');

    const investments = getAllInvestments();
    let updated = 0;
    let failed = 0;

    investments.forEach(inv => {
      // Only update Mutual Fund investments
      if (inv.investmentType && inv.investmentType.includes('Mutual Fund')) {
        const result = updateMFInvestmentNAV(inv.investmentId);
        if (result.success) {
          updated++;
        } else {
          failed++;
        }
      }
    });

    Logger.log(`MF NAV update complete: ${updated} updated, ${failed} failed`);

    return { updated: updated, failed: failed };

  } catch (error) {
    Logger.log('Error in bulk MF update: ' + error.message);
    return { updated: 0, failed: 0, error: error.message };
  }
}

/**
 * Set up MF ATH (All-Time High) data import in user template
 * Creates hidden MF_ATH_Data sheet with IMPORTRANGE from master DB
 * Run this during ONE-CLICK SETUP
 */
function setupATHDataImport() {
  try {
    Logger.log('Setting up MF ATH data import...');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let athSheet = ss.getSheetByName(CONFIG.mfATHDataSheet);

    // Delete existing sheet if it exists
    if (athSheet) {
      ss.deleteSheet(athSheet);
    }

    // Create new sheet
    athSheet = ss.insertSheet(CONFIG.mfATHDataSheet);

    // Import ATH data from Master Database
    // MF_ATH columns: A=Scheme Code, B=Fund Name, C=ATH NAV, D=ATH Date, E=Last Checked, F=Current NAV, G=% Below ATH
    const masterDbId = MF_INTEGRATION_CONFIG.masterDatabaseId;
    const importFormula = `=IMPORTRANGE("${masterDbId}", "MF_ATH!A:G")`;

    athSheet.getRange('A1').setFormula(importFormula);

    // Add instructions
    athSheet.getRange('I1').setValue('📊 MF ATH Data imported from Master Database');
    athSheet.getRange('I2').setValue('Shows All-Time High NAV and % below ATH for each fund');
    athSheet.getRange('I3').setValue('Do NOT edit this sheet manually!');
    athSheet.getRange('I1:I3').setFontWeight('bold').setBackground('#fff3cd');

    // Hide the sheet
    athSheet.hideSheet();

    Logger.log('MF ATH data import set up successfully');

    return { success: true };

  } catch (error) {
    Logger.log('Error setting up ATH data import: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Set up daily trigger to update MF NAVs
 * Run this ONCE to enable automatic NAV updates
 */
function setupMFNAVUpdateTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateAllMFInvestmentsNAV') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new daily trigger (runs at 6 PM every day - after market close)
  ScriptApp.newTrigger('updateAllMFInvestmentsNAV')
    .timeBased()
    .atHour(18) // 6 PM
    .everyDays(1)
    .create();

  Logger.log('MF NAV update trigger set up successfully');
}

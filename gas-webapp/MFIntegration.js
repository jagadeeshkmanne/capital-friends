/**
 * Mutual Fund Integration for User Templates
 * This file goes in the WEB APP project (not the master database).
 * Data is copied from the master DB (no IMPORTRANGE) and refreshed daily.
 */

/**
 * Configuration for MF Integration
 */
const MF_INTEGRATION_CONFIG = {
  // Master DB ID is now in CONFIG.masterDbId (Code.js)
  // Local sheet name where MF data is stored
  localMFSheet: 'MutualFundData'
};

/**
 * Set up MF database import in user template.
 * NOTE: This is the MFIntegration.js version. The Setup.js version
 * (setupMutualFundDataSheet) is the one called by createAllSheets().
 * Both create the MutualFundData sheet and copy data from master DB.
 */
function setupMFDatabaseImport() {
  try {
    Logger.log('Setting up MF database import...');

    const ss = getSpreadsheet();
    let mfSheet = ss.getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

    // Delete existing sheet if it exists
    if (mfSheet) {
      ss.deleteSheet(mfSheet);
    }

    // Create new sheet with headers
    mfSheet = ss.insertSheet(MF_INTEGRATION_CONFIG.localMFSheet);
    mfSheet.getRange('A1:H1').setValues([[
      'Scheme Code', 'Fund Name', 'Category', 'NAV', 'Date', 'Fund House', 'Type', 'Status'
    ]]);
    mfSheet.getRange('A1:H1').setFontWeight('bold').setBackground('#e8eaf6');

    // Copy data from master DB (no IMPORTRANGE needed)
    try {
      copyMFDataFromMasterDB(mfSheet);
    } catch (e) {
      Logger.log('Warning: Could not copy MF data from master DB: ' + e.message);
    }

    // Hide the sheet
    mfSheet.hideSheet();

    Logger.log('MF database import set up successfully');
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
    const sheet = getSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

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
    const sheet = getSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

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
    const sheet = getSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

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
    const sheet = getSpreadsheet().getSheetByName(MF_INTEGRATION_CONFIG.localMFSheet);

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
 * Creates hidden MF_ATH_Data sheet and copies ATH data from master DB.
 * No IMPORTRANGE — data is a snapshot, refreshed via refreshATHData().
 * Run this during ONE-CLICK SETUP.
 */
function setupATHDataImport() {
  try {
    Logger.log('Setting up MF ATH data sheet...');

    const ss = getSpreadsheet();
    let athSheet = ss.getSheetByName(CONFIG.mfATHDataSheet);

    // Delete existing sheet if it exists
    if (athSheet) {
      ss.deleteSheet(athSheet);
    }

    // Create new sheet
    athSheet = ss.insertSheet(CONFIG.mfATHDataSheet);

    // Set up headers (same structure as master DB MF_ATH sheet)
    // A=Scheme Code, B=Fund Name, C=ATH NAV, D=ATH Date, E=Last Checked, F=Current NAV, G=% Below ATH
    athSheet.getRange('A1:G1').setValues([[
      'Scheme Code', 'Fund Name', 'ATH NAV', 'ATH Date', 'Last Checked', 'Current NAV', '% Below ATH'
    ]]);
    athSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#e8eaf6');

    // Copy ATH data from master DB
    try {
      copyATHDataFromMasterDB(athSheet);
    } catch (e) {
      Logger.log('Warning: Could not copy ATH data from master DB: ' + e.message);
    }

    // Hide the sheet
    athSheet.hideSheet();

    Logger.log('MF ATH data sheet set up successfully');

    return { success: true };

  } catch (error) {
    Logger.log('Error setting up ATH data sheet: ' + error.message);
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

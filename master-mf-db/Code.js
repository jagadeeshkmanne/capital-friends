/**
 * ============================================================================
 * MASTER MUTUAL FUND DATABASE - STANDALONE SCRIPT
 * ============================================================================
 *
 * This script goes in a SEPARATE Google Sheet (Master Database)
 * NOT in the user template!
 *
 * Purpose:
 * - Fetch mutual fund data from external APIs
 * - Maintain single source of truth for all MF data
 * - Auto-refresh daily with latest NAVs
 * - User templates connect via IMPORTRANGE
 *
 * Setup:
 * 1. Create new Google Sheet
 * 2. Extensions → Apps Script
 * 3. Paste this code
 * 4. Run setupMasterMFDatabase() once
 * 5. Share sheet as "Anyone with link - Viewer"
 *
 * ============================================================================
 */

/**
 * Configuration
 */
const CONFIG = {
  // Sheet names
  dataSheet: 'MF_Data',
  metadataSheet: 'MF_Metadata',

  // API configuration
  apiSource: 'amfi', // Use 'amfi' for ALL schemes (40,000+) - much faster and complete
  amfiNavUrl: 'https://www.amfiindia.com/api/nav-history?query_type=all_for_date&from_date=', // Official AMFI JSON API (8500+ active schemes)

  // Trigger settings (IST), 3 runs a day. AMFI publishes most NAVs by ~11 PM the same day and
  // fund-of-funds by ~10 AM next day: 11 PM catches today's NAVs, 7 AM has everything ready before
  // morning emails, 11 AM picks up FoFs. (Was 9, 12, 15 - a 9 AM email could go out before the first refresh.)
  // After changing, run setupDailyTrigger() once (it replaces only the refreshMutualFundData triggers).
  refreshHours: [7, 11, 23],

  // Data columns (matching your structure)
  columns: {
    fundCode: 1,        // A - Fund Code
    fundName: 2,        // B - Fund Name
    category: 3,        // C - Category
    nav: 4,             // D - NAV
    date: 5,            // E - Date
    fundHouse: 6,       // F - Fund House
    type: 7,            // G - Type
    status: 8           // H - Status
  }
};

/**
 * ONE-TIME SETUP - Run this function once to set up everything
 */
function setupMasterMFDatabase() {
  Logger.log('========================================');
  Logger.log('Setting up Master MF Database...');
  Logger.log('========================================');

  try {
    // Step 1: Create data sheet
    Logger.log('Step 1: Creating MF_Data sheet...');
    createDataSheet();
    Logger.log('✓ MF_Data sheet created');

    // Step 2: Create metadata sheet
    Logger.log('Step 2: Creating MF_Metadata sheet...');
    createMetadataSheet();
    Logger.log('✓ MF_Metadata sheet created');

    // Step 3: Fetch initial data
    Logger.log('Step 3: Fetching initial MF data (this may take 2-5 minutes)...');
    refreshMutualFundData();
    Logger.log('✓ Initial data fetched');

    // Step 4: Set up daily trigger
    Logger.log('Step 4: Setting up daily refresh trigger...');
    setupDailyTrigger();
    Logger.log('✓ Daily trigger installed');

    Logger.log('========================================');
    Logger.log('✅ SETUP COMPLETE!');
    Logger.log('========================================');
    Logger.log('Next steps:');
    Logger.log('1. Check MF_Data sheet for mutual fund data');
    Logger.log('2. Share this sheet as "Anyone with link - Viewer"');
    Logger.log('3. Copy the Sheet ID from URL');
    Logger.log('4. Use that ID in user template configuration');
    Logger.log('========================================');

  } catch (error) {
    Logger.log('❌ Error during setup: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
    throw error;
  }
}

/**
 * Create MF Data sheet with proper structure
 */
function createDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.dataSheet);

  // Delete if exists (for fresh setup)
  if (sheet) {
    Logger.log('Sheet already exists, recreating...');
    ss.deleteSheet(sheet);
  }

  // Create new sheet
  sheet = ss.insertSheet(CONFIG.dataSheet);

  // Set headers (matching your column structure)
  const headers = [
    ['Fund Code', 'Fund Name', 'Category', 'NAV', 'Date', 'Fund House', 'Type', 'Status']
  ];

  sheet.getRange(1, 1, 1, 8).setValues(headers);

  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, 8);
  headerRange.setFontWeight('bold')
    .setBackground('#1a202c')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Set column widths
  sheet.setColumnWidth(1, 100);   // Fund Code
  sheet.setColumnWidth(2, 450);   // Fund Name
  sheet.setColumnWidth(3, 150);   // Category
  sheet.setColumnWidth(4, 100);   // NAV
  sheet.setColumnWidth(5, 100);   // Date
  sheet.setColumnWidth(6, 200);   // Fund House
  sheet.setColumnWidth(7, 120);   // Type
  sheet.setColumnWidth(8, 100);   // Status

  // Freeze header row
  sheet.setFrozenRows(1);

  // Add filter
  sheet.getRange(1, 1, 1, 8).createFilter();

  return sheet;
}

/**
 * Create Metadata sheet for tracking
 */
function createMetadataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.metadataSheet);

  if (sheet) {
    ss.deleteSheet(sheet);
  }

  sheet = ss.insertSheet(CONFIG.metadataSheet);

  // Set up metadata structure
  sheet.getRange('A1:B1').setValues([['Property', 'Value']]);
  sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#4a5568').setFontColor('#ffffff');

  const metadata = [
    ['Last Updated', ''],
    ['Total Schemes', ''],
    ['API Source', 'AMFI India (Official)'],
    ['Status', 'Active'],
    ['Refresh Schedule', CONFIG.refreshHours.length + 'x daily at ' + CONFIG.refreshHours.join(', ') + ' hrs'],
    ['Last Error', '']
  ];

  sheet.getRange(2, 1, metadata.length, 2).setValues(metadata);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);

  return sheet;
}

/**
 * Main function - Refresh mutual fund data
 * Called by daily trigger
 */
function refreshMutualFundData() {
  const startTime = new Date();
  Logger.log('Starting MF data refresh at ' + startTime);

  try {
    // Fetch all MF data from AMFI India
    const mfData = fetchFromAMFI();

    if (mfData.length === 0) {
      Logger.log('⚠️ No data fetched, keeping existing data intact.');
      updateMetadata(0, 'No data fetched, existing data retained');
      return;
    }

    // Upsert: update funds that have new data, insert new ones, never delete
    // If the API returns only 1 fund house, only those funds get updated — the rest keep their old NAVs
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.dataSheet);
    const existingRows = sheet.getLastRow() - 1; // exclude header

    // Build a map of existing data keyed by Fund Code
    const existingMap = {};
    if (existingRows > 0) {
      const existingData = sheet.getRange(2, 1, existingRows, 8).getValues();
      for (let i = 0; i < existingData.length; i++) {
        const fundCode = String(existingData[i][0]);
        if (fundCode) {
          existingMap[fundCode] = existingData[i];
        }
      }
    }

    // Apply new data: update existing, track new
    let updated = 0;
    let inserted = 0;
    for (let i = 0; i < mfData.length; i++) {
      const fundCode = String(mfData[i][0]);
      if (existingMap[fundCode]) {
        updated++;
      } else {
        inserted++;
      }
      existingMap[fundCode] = mfData[i]; // update or insert
    }

    // Convert map back to array and write
    let mergedData = Object.values(existingMap);

    // ISIN columns I-J (for CAMS/NSDL/CDSL statement import). They are written in the SAME row
    // array as A-H, so they can never drift onto another fund. If anything goes wrong here, the
    // refresh falls back to exactly the old 8-column write.
    let width = 8;
    try {
      const withIsin = addIsinColumns_(sheet, existingRows, mergedData);
      if (withIsin) { mergedData = withIsin; width = 10; }
    } catch (e) {
      Logger.log('ISIN columns skipped (A-H refresh continues as before): ' + e.message);
      // An empty ISIN is safe; a stale one next to a re-ordered row would not be
      try { if (existingRows > 0 && sheet.getMaxColumns() >= 10) sheet.getRange(2, 9, existingRows, 2).clearContent(); } catch (e2) {}
    }

    // Clear old data and write merged data
    if (existingRows > 0) {
      sheet.getRange(2, 1, existingRows, Math.min(width, sheet.getMaxColumns())).clearContent();
    }
    sheet.getRange(2, 1, mergedData.length, width).setValues(mergedData);

    // Update metadata
    updateMetadata(mergedData.length, null);

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    Logger.log(`✅ Refreshed: ${updated} updated, ${inserted} new, ${mergedData.length} total schemes in ${duration} seconds`);

  } catch (error) {
    Logger.log('❌ Error refreshing data: ' + error.message);
    updateMetadata(0, error.message);
    sendErrorEmail(error);
    throw error;
  }
}

/**
 * ISIN for every scheme, from AMFI's official NAVAll.txt (Scheme Code;ISIN Div Payout/ISIN Growth;
 * ISIN Div Reinvestment;Scheme Name;NAV;Date). Returns rows with columns I (ISIN payout/growth) and
 * J (ISIN reinvestment) appended, or null to keep the old 8-column write.
 * If AMFI's file can't be downloaded, the ISINs already in the sheet are carried forward by fund code.
 */
function addIsinColumns_(sheet, existingRows, rows) {
  // ISINs already in the sheet (carried forward if today's download fails)
  const oldIsin = {};
  if (existingRows > 0 && sheet.getLastColumn() >= 10) {
    const codes = sheet.getRange(2, 1, existingRows, 1).getValues();
    const isins = sheet.getRange(2, 9, existingRows, 2).getValues();
    for (let i = 0; i < codes.length; i++) {
      if (codes[i][0] && (isins[i][0] || isins[i][1])) oldIsin[String(codes[i][0])] = [isins[i][0], isins[i][1]];
    }
  }

  const fresh = {};
  let freshCount = 0;
  try {
    const res = UrlFetchApp.fetch('https://www.amfiindia.com/spages/NAVAll.txt', { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      res.getContentText().split('\n').forEach(function (line) {
        const p = line.split(';');
        if (p.length < 6) return;
        const code = p[0].trim();
        if (!/^\d+$/.test(code)) return;
        const a = (p[1] || '').trim(), b = (p[2] || '').trim();
        const i1 = /^INF[A-Z0-9]{9}$/.test(a) ? a : '', i2 = /^INF[A-Z0-9]{9}$/.test(b) ? b : '';
        if (i1 || i2) { fresh[code] = [i1, i2]; freshCount++; }
      });
    } else {
      Logger.log('NAVAll.txt HTTP ' + res.getResponseCode() + ' - keeping existing ISINs');
    }
  } catch (e) {
    Logger.log('NAVAll.txt download failed - keeping existing ISINs: ' + e.message);
  }
  // A partial/garbled download must not wipe good ISINs: trust it only if it looks complete
  const useFresh = freshCount >= 5000;
  if (!useFresh && !Object.keys(oldIsin).length) return null; // nothing to add yet: old behaviour

  if (sheet.getMaxColumns() < 10) sheet.insertColumnsAfter(sheet.getMaxColumns(), 10 - sheet.getMaxColumns());
  if (!sheet.getRange(1, 9).getValue()) {
    sheet.getRange(1, 9, 1, 2).setValues([['ISIN (Payout/Growth)', 'ISIN (Reinvestment)']])
      .setFontWeight('bold').setBackground('#1a202c').setFontColor('#ffffff');
  }

  let filled = 0;
  const out = rows.map(function (r) {
    const code = String(r[0]);
    const isin = (useFresh && fresh[code]) || oldIsin[code] || ['', ''];
    if (isin[0] || isin[1]) filled++;
    return r.slice(0, 8).concat(isin);
  });
  Logger.log('ISIN columns: ' + filled + ' of ' + out.length + ' schemes have an ISIN (' + (useFresh ? 'fresh from AMFI' : 'carried forward') + ')');
  return out;
}

/**
 * Build the AMFI JSON API URL for a given date
 */
function getAmfiApiUrlForDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return CONFIG.amfiNavUrl + yyyy + '-' + mm + '-' + dd;
}

/**
 * Format ISO date string to DD-Mon-YYYY for display
 */
function formatNavDate(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return String(d.getDate()).padStart(2, '0') + '-' + months[d.getMonth()] + '-' + d.getFullYear();
  } catch (e) {
    return isoDate;
  }
}

/**
 * Fetch data from AMFI India JSON API (official source)
 * Tries multiple recent weekdays and MERGES all results.
 * Newer dates take priority — if a fund has data from Monday AND Thursday,
 * Monday's NAV wins. Funds only available on older dates still get included.
 * This handles partial API responses (e.g., only 1 fund house on a given day).
 */
function fetchFromAMFI() {
  Logger.log('Fetching from AMFI India JSON API...');

  try {
    // Collect dates to try (up to 5 recent weekdays)
    var datesToTry = [];
    var d = new Date();
    while (datesToTry.length < 5) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        datesToTry.push(new Date(d));
      }
      d.setDate(d.getDate() - 1);
    }

    // Fetch all dates — newest first. Merge into a map keyed by fund code.
    // Newest date wins (first write), older dates only fill gaps.
    var mergedMap = {}; // fundCode → [row]
    var totalFetched = 0;

    for (var i = 0; i < datesToTry.length; i++) {
      var fetchDate = datesToTry[i];
      var url = getAmfiApiUrlForDate(fetchDate);
      Logger.log('Trying URL: ' + url);

      try {
        var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (response.getResponseCode() !== 200) {
          Logger.log('HTTP ' + response.getResponseCode() + ' for ' + fetchDate.toDateString());
          continue;
        }

        var json = JSON.parse(response.getContentText());
        var fundHouses = json.data || [];

        if (fundHouses.length === 0) {
          Logger.log('Empty data for ' + fetchDate.toDateString());
          continue;
        }

        var dateSchemes = 0;
        for (var f = 0; f < fundHouses.length; f++) {
          var fundHouse = fundHouses[f];
          var fundHouseName = fundHouse.mfName || '';
          var schemes = fundHouse.schemes || [];

          for (var s = 0; s < schemes.length; s++) {
            var scheme = schemes[s];
            var navs = scheme.navs || [];

            for (var n = 0; n < navs.length; n++) {
              var navEntry = navs[n];
              var schemeCode = navEntry.SD_ID || '';
              var schemeName = navEntry.NAV_Name || '';
              var nav = navEntry.hNAV_Amt || '';
              var date = formatNavDate(navEntry.hNAV_Date);

              if (!schemeCode || !schemeName || !nav) continue;

              // Only add if we don't already have this fund from a newer date
              if (mergedMap[schemeCode]) continue;

              var category = categorizeScheme(schemeName);
              var type = getSchemeType(schemeName);

              mergedMap[schemeCode] = [
                schemeCode, schemeName, category,
                parseFloat(nav) || nav, date,
                fundHouseName, type, 'Active'
              ];
              dateSchemes++;
            }
          }
        }

        totalFetched += dateSchemes;
        Logger.log('Got ' + dateSchemes + ' new schemes for ' + fetchDate.toDateString() + ' (' + fundHouses.length + ' fund houses). Running total: ' + Object.keys(mergedMap).length);

        // If we already have 8000+ schemes, no need to check older dates
        if (Object.keys(mergedMap).length >= 8000) {
          Logger.log('Have ' + Object.keys(mergedMap).length + ' schemes — skipping older dates');
          break;
        }

      } catch (fetchError) {
        Logger.log('Fetch error for ' + fetchDate.toDateString() + ': ' + fetchError.message);
      }
    }

    var mfData = Object.values(mergedMap);
    Logger.log('Successfully fetched ' + mfData.length + ' schemes from AMFI JSON API (merged from up to ' + datesToTry.length + ' dates)');
    return mfData;

  } catch (error) {
    Logger.log('Error in fetchFromAMFI: ' + error.message);
    throw error;
  }
}

/**
 * Determine fund category from scheme name
 */
function categorizeScheme(schemeName) {
  var name = schemeName.toLowerCase();

  // Commodity: Gold, Silver, Precious Metal (check early — many are also ETFs)
  if (name.includes('gold') || name.includes('silver') || name.includes('precious metal') ||
      name.includes('commodity') || name.includes('commodit')) return 'Commodity';

  // ELSS
  if (name.includes('elss') || name.includes('tax saver')) return 'ELSS';

  // Liquid / Money Market / Overnight
  if (name.includes('liquid') || name.includes('money market') || name.includes('overnight')) return 'Liquid';

  // Gilt / Government Securities
  if (name.includes('gilt') || name.includes('government securities') || name.includes('govt securities') ||
      name.includes('g-sec') || name.includes('gsec') || name.includes('constant maturity')) return 'Gilt';

  // Debt (check before Equity — "banking & psu" is debt, not equity via 'banking')
  if (name.includes('debt') || name.includes('bond') || name.includes('income fund') ||
      name.includes('credit risk') || name.includes('corporate bond') || name.includes('banking & psu') ||
      name.includes('short duration') || name.includes('medium duration') || name.includes('long duration') ||
      name.includes('ultra short') || name.includes('low duration') || name.includes('dynamic bond') ||
      name.includes('floater') || name.includes('floating rate') || name.includes('fixed maturity') ||
      name.includes('short term') || name.includes('medium term') || name.includes('long term bond') ||
      name.includes('corporate debt') || name.includes('credit') || name.includes('accrual') ||
      name.includes('savings fund') || name.includes('ultra short duration')) return 'Debt';

  // Multi-Asset (separate from Hybrid — has equity+debt+commodity)
  if (name.includes('multi asset')) return 'Multi-Asset';

  // Hybrid / Balanced / Arbitrage
  if (name.includes('hybrid') || name.includes('balanced') || name.includes('dynamic asset') ||
      name.includes('arbitrage') ||
      name.includes('retirement') || name.includes('children') || name.includes('solution') ||
      name.includes('child care') || name.includes('pension')) return 'Hybrid';

  // Equity (broad — includes sectoral, thematic)
  if (name.includes('equity') || name.includes('stock') || name.includes('flexi cap') ||
      name.includes('large cap') || name.includes('mid cap') || name.includes('small cap') ||
      name.includes('multi cap') || name.includes('focused') || name.includes('contra') ||
      name.includes('value fund') || name.includes('dividend yield') || name.includes('thematic') ||
      name.includes('sectoral') || name.includes('consumption') || name.includes('infrastructure') ||
      name.includes('pharma') || name.includes('healthcare') || name.includes('technology') ||
      name.includes('fmcg') || name.includes('banking fund') || name.includes('mnc') ||
      name.includes('opportunities fund') || name.includes('growth fund') ||
      name.includes('midcap') || name.includes('smallcap') || name.includes('largecap') ||
      name.includes('flexicap') || name.includes('multicap') ||
      name.includes('large & mid') || name.includes('large and mid')) return 'Equity';

  // Index / ETF
  if (name.includes('index') || name.includes('etf') || name.includes('nifty') ||
      name.includes('sensex') || name.includes('bse') || name.includes('s&p')) return 'Index';

  // FoF — try to sub-classify based on underlying fund name
  if (name.includes('fof') || name.includes('fund of funds') || name.includes('fund of fund')) {
    if (name.includes('equity') || name.includes('aggressive')) return 'Equity';
    if (name.includes('debt') || name.includes('bond') || name.includes('income')) return 'Debt';
    if (name.includes('gold') || name.includes('silver')) return 'Commodity';
    return 'Hybrid'; // default FoF to Hybrid (most are multi-asset / balanced)
  }

  // Aggressive/Conservative without explicit hybrid/equity — likely hybrid
  if (name.includes('aggressive') || name.includes('conservative')) return 'Hybrid';

  return 'Other';
}

/**
 * Determine fund type (Direct/Regular) from scheme name
 */
function getSchemeType(schemeName) {
  var name = schemeName.toLowerCase();
  if (name.includes('direct')) return 'Direct';
  if (name.includes('regular')) return 'Regular';
  return 'Growth';
}

/**
 * Update metadata sheet
 */
function updateMetadata(schemeCount, errorMessage) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.metadataSheet);

  sheet.getRange('B2').setValue(new Date()); // Last Updated
  sheet.getRange('B3').setValue(schemeCount); // Total Schemes

  if (errorMessage) {
    sheet.getRange('B6').setValue(errorMessage); // Last Error
  } else {
    sheet.getRange('B6').setValue('None');
  }
}

/**
 * Set up daily trigger
 */
function setupDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshMutualFundData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create 3 daily triggers: 9 AM, 12 PM, 3 PM
  CONFIG.refreshHours.forEach(hour => {
    ScriptApp.newTrigger('refreshMutualFundData')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .create();
  });

  Logger.log('Triggers set to run ' + CONFIG.refreshHours.length + 'x daily at ' + CONFIG.refreshHours.join(', ') + ' hrs');
}

/**
 * Send error notification email
 */
function sendErrorEmail(error) {
  try {
    const email = Session.getEffectiveUser().getEmail();
    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: '[MF Master DB] Data Refresh Failed',
        body: `Error occurred while refreshing mutual fund data:\n\n` +
              `Error: ${error.message}\n\n` +
              `Time: ${new Date()}\n\n` +
              `Please check the Apps Script execution log for details.`
      });
    }
  } catch (e) {
    Logger.log('Failed to send error email: ' + e.message);
  }
}

/**
 * Test function - Search for schemes
 */
function testSearch() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.dataSheet);
  const data = sheet.getRange(2, 1, Math.min(10, sheet.getLastRow() - 1), 8).getValues();

  Logger.log('Sample schemes:');
  data.forEach((row, index) => {
    Logger.log(`${index + 1}. ${row[1]} (${row[0]}) - NAV: ${row[3]} | Fund House: ${row[5]}`);
  });
}

/**
 * Get sheet URL and ID for documentation
 */
function getSheetInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('========================================');
  Logger.log('MASTER DATABASE INFO:');
  Logger.log('========================================');
  Logger.log('Sheet Name: ' + ss.getName());
  Logger.log('Sheet ID: ' + ss.getId());
  Logger.log('Sheet URL: ' + ss.getUrl());
  Logger.log('========================================');
  Logger.log('Copy the Sheet ID above and use it in user template configuration:');
  Logger.log('MF_INTEGRATION_CONFIG.masterDatabaseId = "' + ss.getId() + '"');
  Logger.log('========================================');
}

/**
 * ============================================================================
 * ASSETALLOCATION.GS - Fund Asset Allocation Management
 * ============================================================================
 * Manages fund-level asset allocation and market cap classification data
 */

/**
 * Get all unique funds from all portfolios
 * Used to populate fund selection dropdown in ManageAssetAllocation dialog
 */
function getAllFundsFromPortfolios() {
  try {
    const spreadsheet = getSpreadsheet();
    const portfolios = getAllPortfolios();
    const fundsMap = new Map();

    log(`getAllFundsFromPortfolios: Found ${portfolios.length} portfolios`);

    portfolios.forEach(portfolio => {
      const sheet = spreadsheet.getSheetByName(portfolio.portfolioId);
      if (!sheet) {
        log(`Portfolio sheet not found: ${portfolio.portfolioId}`);
        return;
      }

      const data = sheet.getDataRange().getValues();
      log(`Processing portfolio: ${portfolio.portfolioId} (${data.length} rows)`);

      // Find header row (should be row 3)
      let headerRowIndex = 2; // Row 3 (0-indexed)

      const headerRow = data[headerRowIndex];

      // Find Scheme Code and Fund Name columns
      let codeIndex = -1;
      let fundNameIndex = -1;

      for (let col = 0; col < headerRow.length; col++) {
        const header = headerRow[col] ? headerRow[col].toString().toLowerCase().trim() : '';
        if (header.includes('scheme') && header.includes('code')) {
          codeIndex = col;
          log(`  Found Scheme Code column at index ${col} (${headerRow[col]})`);
        } else if (header === 'fund' || header.includes('fund')) {
          fundNameIndex = col;
          log(`  Found Fund column at index ${col} (${headerRow[col]})`);
        }
      }

      if (codeIndex === -1 || fundNameIndex === -1) {
        log(`Could not find Scheme Code or Fund columns in ${portfolio.portfolioId}`);
        log(`  Headers in row 3: ${headerRow.join(', ')}`);
        return;
      }

      // Start from row 4 (data rows)
      let fundCount = 0;
      for (let i = 3; i < data.length; i++) {
        const code = data[i][codeIndex];
        const name = data[i][fundNameIndex];

        if (code && name) {
          fundsMap.set(code.toString(), {
            code: code.toString(),
            name: name.toString()
          });
          fundCount++;
        }
      }
      log(`  Added ${fundCount} funds from ${portfolio.portfolioId}`);
    });

    const funds = Array.from(fundsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    log(`Found ${funds.length} unique funds across all portfolios`);
    return funds;

  } catch (error) {
    log(`Error in getAllFundsFromPortfolios: ${error.toString()}`);
    return [];
  }
}

/**
 * Get existing allocation data for a specific fund
 */
function getExistingAllocation(fundCode) {
  try {
    const spreadsheet = getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.assetAllocationsSheet);

    if (!sheet) {
      log('AssetAllocations sheet not found');
      return null;
    }

    const data = sheet.getDataRange().getValues();

    // Row 1 = Watermark, Row 2 = Headers, Row 3+ = Data
    // Column A = Fund Code, B = Fund Name, C = Asset Allocation JSON, D = Equity Allocation JSON, E = Geography JSON
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === fundCode.toString()) {
        // Found - parse JSON from columns C, D, E
        try {
          const assetAllocationJSON = data[i][2];
          const equityAllocationJSON = data[i][3];
          const geoAllocationJSON = data[i][4] || '';

          log(`Found existing allocation for fund ${fundCode}`);

          const result = {
            equity: 0,
            debt: 0,
            cash: 0,
            realEstate: 0,
            commodities: 0,
            giantCap: 0,
            largeCap: 0,
            midCap: 0,
            smallCap: 0,
            microCap: 0,
            geoIndia: 0,
            geoGlobal: 0
          };

          // Parse asset allocation JSON
          if (assetAllocationJSON) {
            const assetAlloc = JSON.parse(assetAllocationJSON);
            result.equity = assetAlloc.Equity || 0;
            result.debt = assetAlloc.Debt || 0;
            result.cash = assetAlloc.Cash || 0;
            result.realEstate = assetAlloc['Real Estate'] || 0;
            result.commodities = assetAlloc.Commodities || 0;
          }

          // Parse equity allocation JSON
          if (equityAllocationJSON) {
            const equityAlloc = JSON.parse(equityAllocationJSON);
            result.giantCap = equityAlloc.Giant || 0;
            result.largeCap = equityAlloc.Large || 0;
            result.midCap = equityAlloc.Mid || 0;
            result.smallCap = equityAlloc.Small || 0;
            result.microCap = equityAlloc.Micro || 0;
          }

          // Parse geography allocation JSON
          if (geoAllocationJSON) {
            const geoAlloc = JSON.parse(geoAllocationJSON);
            result.geoIndia = geoAlloc.India || 0;
            result.geoGlobal = geoAlloc.Global || 0;
          }

          return result;
        } catch (e) {
          log(`Error parsing allocation JSON for fund ${fundCode}: ${e.message}`);
        }
      }
    }

    log(`No existing allocation found for fund ${fundCode}`);
    return null;

  } catch (error) {
    log(`Error in getExistingAllocation: ${error.toString()}`);
    return null;
  }
}

/**
 * Process asset allocation form submission
 */
function processAssetAllocation(allocation) {
  try {
    const spreadsheet = getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(CONFIG.assetAllocationsSheet);

    // Create sheet if it doesn't exist
    if (!sheet) {
      setupAssetAllocationsSheet();
      sheet = spreadsheet.getSheetByName(CONFIG.assetAllocationsSheet);
    }

    // Create separate JSON objects for asset allocation, equity allocation, and geography
    const assetAllocationJSON = {};
    const equityAllocationJSON = {};
    const geoAllocationJSON = {};

    // Asset allocation (only include non-zero values)
    if (allocation.equity) assetAllocationJSON.Equity = allocation.equity;
    if (allocation.debt) assetAllocationJSON.Debt = allocation.debt;
    if (allocation.cash) assetAllocationJSON.Cash = allocation.cash;
    if (allocation.realEstate) assetAllocationJSON['Real Estate'] = allocation.realEstate;
    if (allocation.commodities) assetAllocationJSON.Commodities = allocation.commodities;
    // Custom asset fields
    if (allocation.customAsset) {
      Object.entries(allocation.customAsset).forEach(([k, v]) => { if (v > 0) assetAllocationJSON[k] = v; });
    }

    // Equity market cap breakdown (only include non-zero values)
    if (allocation.giantCap) equityAllocationJSON.Giant = allocation.giantCap;
    if (allocation.largeCap) equityAllocationJSON.Large = allocation.largeCap;
    if (allocation.midCap) equityAllocationJSON.Mid = allocation.midCap;
    if (allocation.smallCap) equityAllocationJSON.Small = allocation.smallCap;
    if (allocation.microCap) equityAllocationJSON.Micro = allocation.microCap;
    if (allocation.customCap) {
      Object.entries(allocation.customCap).forEach(([k, v]) => { if (v > 0) equityAllocationJSON[k] = v; });
    }

    // Geography allocation
    if (allocation.geoIndia) geoAllocationJSON.India = allocation.geoIndia;
    if (allocation.geoGlobal) geoAllocationJSON.Global = allocation.geoGlobal;
    if (allocation.customGeo) {
      Object.entries(allocation.customGeo).forEach(([k, v]) => { if (v > 0) geoAllocationJSON[k] = v; });
    }

    const assetAllocationString = JSON.stringify(assetAllocationJSON);
    const equityAllocationString = JSON.stringify(equityAllocationJSON);
    const geoAllocationString = JSON.stringify(geoAllocationJSON);

    const data = sheet.getDataRange().getValues();
    let foundRow = -1;

    // Check if fund already exists (Row 1 = Watermark, Row 2 = Headers, Row 3+ = Data)
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString() === allocation.fundCode.toString()) {
        foundRow = i + 1; // Convert to 1-based index
        break;
      }
    }

    if (foundRow > 0) {
      // Update existing row
      // Column A = Fund Code, B = Fund Name, C = Asset JSON, D = Equity JSON, E = Geography JSON
      sheet.getRange(foundRow, 2).setValue(allocation.fundName);
      sheet.getRange(foundRow, 3).setValue(assetAllocationString);
      sheet.getRange(foundRow, 4).setValue(equityAllocationString);
      sheet.getRange(foundRow, 5).setValue(geoAllocationString);

      log(`Updated asset allocation for ${allocation.fundName} (${allocation.fundCode})`);

      return {
        success: true,
        message: `Asset allocation updated for ${allocation.fundName}`
      };
    } else {
      // Add new row
      sheet.appendRow([
        allocation.fundCode,
        allocation.fundName,
        assetAllocationString,
        equityAllocationString,
        geoAllocationString
      ]);

      // Apply formatting to the new row
      const newRow = sheet.getLastRow();
      applyDataRowFormatting(sheet, newRow, newRow, 5);

      log(`Added asset allocation for ${allocation.fundName} (${allocation.fundCode})`);

      return {
        success: true,
        message: `Asset allocation added for ${allocation.fundName}`
      };
    }

  } catch (error) {
    log(`Error in processAssetAllocation: ${error.toString()}`);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

// ============================================================================
// END OF ASSETALLOCATION.GS
// ============================================================================

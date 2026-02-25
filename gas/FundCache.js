/**
 * ============================================================================
 * FUNDCACHE.GS - Smart Fund Caching for Fast Search
 * ============================================================================
 * Implements User Properties caching for MutualFundData to speed up fund search
 * Cache is loaded once per day on sheet open and stored in User Properties
 */

/**
 * Cache funds from MutualFundData into User Properties
 * Called automatically on sheet open (once per day)
 * Stores compressed fund data for fast retrieval
 */
function cacheFundsForUser() {
  try {
    var userProps = PropertiesService.getUserProperties();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var lastCacheDate = userProps.getProperty('fundCacheDate');

    // Already cached today?
    if (lastCacheDate === today) {
      log('✅ Fund cache already fresh for today (' + today + ')');
      return;
    }

    log('📥 Caching funds for ' + today + '...');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName(CONFIG.mutualFundDataSheet);

    if (!masterSheet) {
      log('⚠️ MutualFundData sheet not found');
      return;
    }

    var totalRows = masterSheet.getLastRow();
    if (totalRows < 2) {
      log('⚠️ MutualFundData is empty');
      return;
    }

    var data = masterSheet.getRange(2, 1, totalRows - 1, 2).getValues(); // Get Code, Name only (no category needed)

    // Convert to fund objects - only store what we need for search
    var funds = data.map(function(row) {
      return {
        fundCode: String(row[0] || '').trim(),
        fundName: String(row[1] || '').trim()
      };
    });

    // Convert to JSON string
    var jsonString = JSON.stringify(funds);

    // Split into 8KB chunks (User Properties limit: 9KB per property)
    var chunkSize = 8000;
    var chunks = [];

    for (var i = 0; i < jsonString.length; i += chunkSize) {
      chunks.push(jsonString.substring(i, i + chunkSize));
    }

    // Clear old cache chunks (in case fund count decreased)
    var oldChunkCount = parseInt(userProps.getProperty('fundCacheChunks') || '0');
    for (var k = chunks.length; k < oldChunkCount; k++) {
      userProps.deleteProperty('fundCache_' + k);
    }

    // Store metadata
    userProps.setProperty('fundCacheDate', today);
    userProps.setProperty('fundCacheChunks', String(chunks.length));
    userProps.setProperty('fundCacheCount', String(data.length));

    // Store chunks
    for (var j = 0; j < chunks.length; j++) {
      userProps.setProperty('fundCache_' + j, chunks[j]);
    }

    log('✅ Cached ' + data.length + ' funds in ' + chunks.length + ' chunks for ' + today);

  } catch (error) {
    log('Error caching funds: ' + error.toString());
    // Don't throw - this is background caching, shouldn't break sheet open
  }
}

/**
 * Get all funds from User Properties cache
 * Falls back to loading from sheet if cache doesn't exist
 * Returns array of {fundCode, fundName, category} objects
 */
function getAllFundsFromCache() {
  try {
    var userProps = PropertiesService.getUserProperties();

    var chunkCount = parseInt(userProps.getProperty('fundCacheChunks') || '0');

    // No cache - build it now
    if (chunkCount === 0) {
      log('⚠️ No cache found, building now...');
      cacheFundsForUser();
      chunkCount = parseInt(userProps.getProperty('fundCacheChunks') || '0');

      if (chunkCount === 0) {
        log('ERROR: Failed to build cache, loading directly from sheet');
        return loadFundsDirectlyFromSheet();
      }
    }

    // Reconstruct JSON string from chunks
    var jsonString = '';
    for (var i = 0; i < chunkCount; i++) {
      jsonString += userProps.getProperty('fundCache_' + i);
    }

    // Parse JSON to get fund objects
    var funds = JSON.parse(jsonString);

    var cacheDate = userProps.getProperty('fundCacheDate');

    log('📤 Returning ' + funds.length + ' funds from cache (date: ' + cacheDate + ')');

    return funds;

  } catch (error) {
    log('Error loading funds from cache: ' + error.toString());
    log('Falling back to direct sheet read');
    return loadFundsDirectlyFromSheet();
  }
}

/**
 * Fallback function to load funds directly from sheet if cache fails
 * @returns {Array} Array of fund objects
 */
function loadFundsDirectlyFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.mutualFundDataSheet);

    if (!sheet) {
      log('ERROR: MutualFundData sheet not found');
      return [];
    }

    var totalRows = sheet.getLastRow();
    if (totalRows < 2) return [];

    var data = sheet.getRange(2, 1, totalRows - 1, 2).getValues(); // Only Code and Name

    var funds = data.map(function(row) {
      return {
        fundCode: String(row[0] || '').trim(),
        fundName: String(row[1] || '').trim()
      };
    }).filter(function(fund) {
      return fund.fundCode && fund.fundName;
    });

    log('Loaded ' + funds.length + ' funds directly from sheet');
    return funds;

  } catch (error) {
    log('Error loading funds from sheet: ' + error.toString());
    return [];
  }
}

/**
 * Force refresh fund cache
 * Use when MutualFundData is updated during the day
 */
function refreshFundCache() {
  try {
    var userProps = PropertiesService.getUserProperties();

    // Clear cache date to force reload
    userProps.deleteProperty('fundCacheDate');

    cacheFundsForUser();

    SpreadsheetApp.getUi().alert('✅ Fund cache refreshed successfully!\n\nThe latest fund data is now available for search.');

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error refreshing cache:\n\n' + error.message);
  }
}

/**
 * OPTIMIZED: Search funds using cache (much faster than searching sheet)
 * This is a drop-in replacement for the old searchFunds() function
 * Maintains backward compatibility while using cached data
 */
function searchFundsWithCache(searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    log('Searching for: "' + searchTerm + '" (using cache)');

    // Get funds from cache (fast!)
    var allFunds = getAllFundsFromCache();

    if (allFunds.length === 0) {
      log('No funds in cache, returning empty array');
      return [];
    }

    var searchLower = searchTerm.toLowerCase().trim();
    var results = [];

    // OPTIMIZED: Simple and fast search
    // Just check if search term is in fund name or code
    for (var i = 0; i < allFunds.length; i++) {
      var fund = allFunds[i];

      // Quick indexOf check (much faster than regex or multiple conditions)
      if (fund.fundName.toLowerCase().indexOf(searchLower) !== -1 ||
          fund.fundCode.toLowerCase().indexOf(searchLower) !== -1) {

        results.push({
          fundCode: fund.fundCode,
          fundName: fund.fundName,
          category: 'N/A'  // We don't cache category to save space
        });

        // Limit to 50 results for performance
        if (results.length >= 50) {
          break;
        }
      }
    }

    log('Search returned ' + results.length + ' results from cache');
    return results;

  } catch (error) {
    log('Error in searchFundsWithCache: ' + error.toString());
    // Don't call searchFunds() - that would create circular dependency!
    // Instead, throw the error so searchFunds() can handle the fallback
    throw error;
  }
}

// ============================================================================
// END OF FUNDCACHE.GS
// ============================================================================

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
  // Fund list is public and the same for everyone, so it lives in the shared
  // script cache (CacheService, 100KB per entry, max 6 hours) - not in User
  // Properties: ~15,000 funds (~1 MB) never fit the 500 KB User Properties quota,
  // so the old cache always failed and every search read the whole sheet.
  try {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var cache = CacheService.getScriptCache();
    if (cache.get(FUND_CACHE_PREFIX_ + today + ':n')) return;

    var rows;
    try { rows = masterRows_(CONFIG.masterMFDataSheet, 2); }       // public download, no Sheets API quota
    catch (e) { log('Fund list download failed, reading sheet: ' + e.message); rows = null; }
    var funds = rows ? rows.map(function (row) {
      return { fundCode: String(row[0] || '').trim(), fundName: String(row[1] || '').trim() };
    }).filter(function (f) { return f.fundCode && f.fundName; }) : loadFundsDirectlyFromSheet();
    if (!funds.length) return;

    var json = JSON.stringify(funds), size = 90000, put = {}, n = 0;
    for (var i = 0; i < json.length; i += size) put[FUND_CACHE_PREFIX_ + today + ':' + (n++)] = json.substring(i, i + size);
    put[FUND_CACHE_PREFIX_ + today + ':n'] = String(n);
    cache.putAll(put, 21600);
    log('Cached ' + funds.length + ' funds in ' + n + ' chunks for ' + today);
    cleanupOldUserFundCache_();
  } catch (error) {
    log('Error caching funds: ' + error.toString());
  }
}

var FUND_CACHE_PREFIX_ = 'funds_v2:';

/** Remove the old (always incomplete) fund cache from User Properties, once. */
function cleanupOldUserFundCache_() {
  try {
    var up = PropertiesService.getUserProperties();
    if (!up.getProperty('fundCacheChunks') && !up.getProperty('fundCache_0')) return;
    Object.keys(up.getProperties()).forEach(function (k) {
      if (k.indexOf('fundCache') === 0) up.deleteProperty(k);
    });
    log('Removed old fund cache from User Properties');
  } catch (e) { log('cleanupOldUserFundCache_: ' + e); }
}

/**
 * Get all funds (cached for the day). Returns [{fundCode, fundName}].
 */
function getAllFundsFromCache() {
  try {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var cache = CacheService.getScriptCache();
    var n = +cache.get(FUND_CACHE_PREFIX_ + today + ':n');
    if (!n) { cacheFundsForUser(); n = +cache.get(FUND_CACHE_PREFIX_ + today + ':n'); }
    if (!n) return loadFundsDirectlyFromSheet();
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(FUND_CACHE_PREFIX_ + today + ':' + i);
    var got = cache.getAll(keys), json = '';
    for (var j = 0; j < keys.length; j++) {
      if (got[keys[j]] === undefined) { log('Fund cache chunk missing, reading sheet'); return loadFundsDirectlyFromSheet(); }
      json += got[keys[j]];
    }
    return JSON.parse(json);
  } catch (error) {
    log('Error loading funds from cache: ' + error.toString());
    return loadFundsDirectlyFromSheet();
  }
}

/**
 * Fallback function to load funds directly from sheet if cache fails
 * @returns {Array} Array of fund objects
 */
function loadFundsDirectlyFromSheet() {
  try {
    var ss = getSpreadsheet();
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
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    CacheService.getScriptCache().remove(FUND_CACHE_PREFIX_ + today + ':n');
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

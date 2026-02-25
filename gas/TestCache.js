/**
 * Test function to check if fund cache exists and is working
 * Run this from Script Editor to verify cache
 */
function testFundCache() {
  var userProps = PropertiesService.getUserProperties();

  Logger.log('========== FUND CACHE TEST ==========');

  // Check cache metadata
  var cacheDate = userProps.getProperty('fundCacheDate');
  var chunkCount = userProps.getProperty('fundCacheChunks');
  var fundCount = userProps.getProperty('fundCacheCount');

  Logger.log('Cache Date: ' + (cacheDate || 'NOT SET'));
  Logger.log('Cache Chunks: ' + (chunkCount || 'NOT SET'));
  Logger.log('Fund Count: ' + (fundCount || 'NOT SET'));

  if (!cacheDate || !chunkCount) {
    Logger.log('❌ CACHE DOES NOT EXIST!');
    Logger.log('Building cache now...');
    cacheFundsForUser();

    // Check again after building
    cacheDate = userProps.getProperty('fundCacheDate');
    chunkCount = userProps.getProperty('fundCacheChunks');
    fundCount = userProps.getProperty('fundCacheCount');

    Logger.log('After building:');
    Logger.log('Cache Date: ' + cacheDate);
    Logger.log('Cache Chunks: ' + chunkCount);
    Logger.log('Fund Count: ' + fundCount);
  } else {
    Logger.log('✅ CACHE EXISTS!');
  }

  // Test search
  Logger.log('\n========== TESTING SEARCH ==========');
  Logger.log('Searching for "HDFC"...');

  var startTime = new Date().getTime();
  var results = searchFundsWithCache('HDFC');
  var endTime = new Date().getTime();

  Logger.log('Search completed in: ' + (endTime - startTime) + 'ms');
  Logger.log('Results found: ' + results.length);

  if (results.length > 0) {
    Logger.log('First 3 results:');
    for (var i = 0; i < Math.min(3, results.length); i++) {
      Logger.log((i+1) + '. ' + results[i].fundName + ' (' + results[i].fundCode + ')');
    }
  }

  Logger.log('\n========== TEST COMPLETE ==========');
}

/**
 * Force rebuild cache (for testing)
 */
function forceRebuildCache() {
  var userProps = PropertiesService.getUserProperties();

  Logger.log('Clearing existing cache...');
  userProps.deleteProperty('fundCacheDate');

  Logger.log('Building new cache...');
  cacheFundsForUser();

  Logger.log('Cache rebuilt! Run testFundCache() to verify.');
}

/**
 * Show what's in User Properties for debugging
 */
function showUserProperties() {
  var userProps = PropertiesService.getUserProperties();
  var allProps = userProps.getProperties();

  Logger.log('=== USER PROPERTIES ===');
  Logger.log('Total properties: ' + Object.keys(allProps).length);
  Logger.log('');

  // Show fund cache related properties
  var fundProps = {};
  for (var key in allProps) {
    if (key.indexOf('fundCache') === 0) {
      fundProps[key] = allProps[key];
    }
  }

  Logger.log('Fund Cache Properties:');
  for (var k in fundProps) {
    var value = fundProps[k];
    if (k.indexOf('fundCache_') === 0) {
      Logger.log(k + ': [' + value.length + ' chars]');
    } else {
      Logger.log(k + ': ' + value);
    }
  }

  if (Object.keys(fundProps).length === 0) {
    Logger.log('  NO FUND CACHE PROPERTIES FOUND!');
  }

  Logger.log('');
  Logger.log('=== END ===');
}

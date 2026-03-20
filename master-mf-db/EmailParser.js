/**
 * ============================================================================
 * EMAIL PARSER — Parse Trendlyne screener alert emails from Gmail
 * ============================================================================
 *
 * Requires: gmail.readonly scope in appsscript.json
 *
 * 3-screener architecture:
 *   CF-Compounder  (num 1) — Quality compounders
 *   CF-Momentum    (num 2) — Breakout confirmation
 *   CF-Growth      (num 3) — Emerging small-cap leaders
 *
 * Trendlyne email format (actual):
 *   From: no-reply@trendlyne.com
 *   Subject: "1 Trendlyne screener has new entries and exits" (generic)
 *   Body may contain multiple screener blocks:
 *
 *     CF-Compounder (edit alert)
 *     Last run, 09:17 PM, 18 Mar 2026
 *     Active Stocks (32)
 *      Expleo Solutions ,  Esab ,  Rolex Rings , ... and 24 more
 *     Entries (3)
 *      Stock A ,  Stock B ,  Stock C
 *     Exits (1)
 *      Stock D
 *     View complete list
 *
 *     CF-Momentum (edit alert)
 *     Last run, 09:17 PM, 18 Mar 2026
 *     ...
 *
 * Each "(edit alert)" line starts a new screener block.
 * Stocks in "Active" show current watchlist, "Entries" are new additions.
 * Company names (not symbols) — resolved via Stock_Data sheet.
 *
 * Stocks appearing in multiple screeners get overlap tagging in column E
 * (e.g., "1,2" means CF-Compounder + CF-Momentum).
 */

/**
 * Parse Trendlyne alert emails from the last 24 hours.
 * Returns array of { symbol, name, screenerName, screenerNum, emailDate, section }
 */
function parseTrendlyneAlerts() {
  try {
    var PROCESSED_LABEL = 'CF-Screener-Processed';

    // Ensure the label exists
    var label = GmailApp.getUserLabelByName(PROCESSED_LABEL);
    if (!label) {
      label = GmailApp.createLabel(PROCESSED_LABEL);
    }

    // Search for Trendlyne screener alert emails
    var query = 'from:trendlyne.com subject:"Trendlyne screener" newer_than:1d -label:' + PROCESSED_LABEL;
    var threads = GmailApp.search(query, 0, 30);

    // Also try direct screener name matches (in case subject format varies)
    if (threads.length === 0) {
      var screenerNames = _getAllScreenerNames();
      var subjectParts = screenerNames.map(function(name) { return 'subject:"' + name + '"'; });
      query = 'from:trendlyne.com (' + subjectParts.join(' OR ') + ') newer_than:1d -label:' + PROCESSED_LABEL;
      threads = GmailApp.search(query, 0, 30);
    }

    if (threads.length === 0) {
      Logger.log('No new Trendlyne alert emails found');
      return [];
    }

    Logger.log('Found ' + threads.length + ' Trendlyne alert email threads');

    return _processThreads(threads, label, false);

  } catch (e) {
    Logger.log('Error parsing Trendlyne emails: ' + e.message);
    return [];
  }
}

/**
 * Full refresh: Parse ACTIVE stocks from all screener emails (not just entries).
 * Use this for initial seeding or periodic full sync.
 */
function parseTrendlyneAlertsFullRefresh() {
  try {
    // Look back 7 days for full refresh, no label filter
    var query = 'from:trendlyne.com subject:"Trendlyne screener" newer_than:7d';
    var threads = GmailApp.search(query, 0, 30);

    if (threads.length === 0) {
      var screenerNames = _getAllScreenerNames();
      var subjectParts = screenerNames.map(function(name) { return 'subject:"' + name + '"'; });
      query = 'from:trendlyne.com (' + subjectParts.join(' OR ') + ') newer_than:7d';
      threads = GmailApp.search(query, 0, 30);
    }

    if (threads.length === 0) {
      Logger.log('No Trendlyne alert emails found for full refresh');
      return [];
    }

    return _processThreads(threads, null, true);
  } catch (e) {
    Logger.log('Error in full refresh: ' + e.message);
    return [];
  }
}

/**
 * Process email threads and extract stocks.
 * @param {GmailThread[]} threads
 * @param {GmailLabel|null} label - label to apply after processing (null = skip)
 * @param {boolean} useActive - if true, use Active section; if false, prefer Entries
 */
function _processThreads(threads, label, useActive) {
  // Build screener name → config lookup
  var screenerLookup = _buildScreenerLookup();

  // Load company name → symbol mapping
  var nameToSymbol = _getCompanyNameToSymbolMap();

  var allStocks = [];

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var body = msg.getPlainBody();
      var date = msg.getDate();

      // Parse body into screener blocks (one email may have multiple screeners)
      var blocks = _parseScreenerBlocks(body);

      if (blocks.length === 0) {
        Logger.log('No screener blocks found in email: ' + msg.getSubject());
        continue;
      }

      for (var b = 0; b < blocks.length; b++) {
        var block = blocks[b];

        // Match block to our screener config
        var matchedScreener = screenerLookup[block.screenerName];
        if (!matchedScreener) {
          Logger.log('Skipping unrecognized screener: ' + block.screenerName);
          continue;
        }

        // Resolve company names to symbols
        var entryStocks = _resolveStockNames(block.entries, nameToSymbol);
        var activeStocks = _resolveStockNames(block.active, nameToSymbol);

        // Use entries by default, active for full refresh or when no entries
        var stocksToAdd;
        if (useActive) {
          stocksToAdd = activeStocks;
        } else {
          stocksToAdd = entryStocks.length > 0 ? entryStocks : [];
        }

        for (var i = 0; i < stocksToAdd.length; i++) {
          allStocks.push({
            symbol: stocksToAdd[i].symbol,
            name: stocksToAdd[i].name || '',
            screenerName: matchedScreener.name,
            screenerNum: matchedScreener.num,
            emailDate: date,
            section: useActive ? 'ACTIVE' : 'ENTRY'
          });
        }

        // Log exits for awareness
        if (block.exits.length > 0) {
          var exitStocks = _resolveStockNames(block.exits, nameToSymbol);
          Logger.log(matchedScreener.name + ' exits: ' + exitStocks.map(function(s) { return s.symbol; }).join(', '));
        }

        Logger.log(matchedScreener.name + ' (num ' + matchedScreener.num + '): ' +
          entryStocks.length + ' entries, ' + activeStocks.length + ' active, ' +
          block.exits.length + ' exits');
      }
    }

    // Mark thread as processed
    if (label) {
      threads[t].addLabel(label);
    }
  }

  // Deduplicate by symbol+screener
  var seen = {};
  var unique = [];
  for (var i = 0; i < allStocks.length; i++) {
    var key = allStocks[i].symbol + '|' + allStocks[i].screenerNum;
    if (!seen[key]) {
      seen[key] = allStocks[i];
      unique.push(seen[key]);
    }
  }

  Logger.log('Total unique stock-screener pairs: ' + unique.length);
  return unique;
}

/**
 * Parse email body into screener blocks.
 * Each block starts with "ScreenerName (edit alert)" line.
 *
 * Returns array of:
 *   { screenerName: "CF-Compounder", active: [names], entries: [names], exits: [names] }
 */
function _parseScreenerBlocks(body) {
  var blocks = [];
  var lines = body.split('\n');

  var currentBlock = null;
  var currentSection = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    // Detect screener block start: "CF-Compounder (edit alert)" or "CF-Multibagger-DNA (edit alert)"
    var blockMatch = line.match(/^(.+?)\s*\(edit alert\)/i);
    if (blockMatch) {
      // Save previous block
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        screenerName: blockMatch[1].trim(),
        active: [],
        entries: [],
        exits: []
      };
      currentSection = null;
      continue;
    }

    if (!currentBlock) continue;

    // Detect section headers
    var activeMatch = line.match(/^Active Stocks?\s*\((\d+)\)/i);
    var entriesMatch = line.match(/^Entr(?:ies|y)\s*\((\d+)\)/i);
    var exitsMatch = line.match(/^Exits?\s*\((\d+)\)/i);

    if (activeMatch) {
      currentSection = parseInt(activeMatch[1]) > 0 ? 'active' : null;
      continue;
    }
    if (entriesMatch) {
      currentSection = parseInt(entriesMatch[1]) > 0 ? 'entries' : null;
      continue;
    }
    if (exitsMatch) {
      currentSection = parseInt(exitsMatch[1]) > 0 ? 'exits' : null;
      continue;
    }

    // Stop section at "View complete list"
    if (/^View complete list/i.test(line)) {
      currentSection = null;
      continue;
    }

    // Skip non-data lines
    if (!currentSection) continue;
    if (/^Last run/i.test(line)) continue;
    if (/^No stock/i.test(line)) continue;

    // Parse comma-separated company names
    var names = line.split(',');
    for (var n = 0; n < names.length; n++) {
      var name = names[n].trim();
      // Remove "and X more" suffix
      name = name.replace(/^and\s+\d+\s+more$/i, '').trim();
      if (name && name.length > 1 && !/^\d+$/.test(name)) {
        currentBlock[currentSection].push(name);
      }
    }
  }

  // Save last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Build screener name → config lookup including legacy names.
 */
function _buildScreenerLookup() {
  var lookup = {};
  var screeners = SCREENER_CONFIG.screeners || [];
  for (var s = 0; s < screeners.length; s++) {
    lookup[screeners[s].name] = screeners[s];
  }
  // Legacy names → map to first screener
  lookup['CF-Stock-Screener'] = screeners[0];
  lookup['CF-Multibagger-DNA'] = screeners[0];
  return lookup;
}

/**
 * Get all screener names (including legacy) for Gmail query.
 */
function _getAllScreenerNames() {
  var names = [];
  var screeners = SCREENER_CONFIG.screeners || [];
  for (var s = 0; s < screeners.length; s++) {
    names.push(screeners[s].name);
  }
  names.push('CF-Stock-Screener');
  names.push('CF-Multibagger-DNA');
  return names;
}

/**
 * Resolve company names to NSE symbols using Stock_Data sheet.
 * Returns array of { symbol, name }
 */
function _resolveStockNames(names, nameToSymbol) {
  var stocks = [];
  if (!names || names.length === 0) return stocks;

  for (var i = 0; i < names.length; i++) {
    var name = names[i].trim();
    if (!name) continue;

    var nameLower = name.toLowerCase();

    // Direct match first
    if (nameToSymbol.byNameExact[nameLower]) {
      stocks.push({
        symbol: nameToSymbol.byNameExact[nameLower],
        name: name
      });
      continue;
    }

    // Fuzzy match: check if any known name contains or is contained by search name
    var found = false;
    for (var fullName in nameToSymbol.byNameExact) {
      if (fullName.indexOf(nameLower) !== -1 || nameLower.indexOf(fullName) !== -1) {
        stocks.push({
          symbol: nameToSymbol.byNameExact[fullName],
          name: name
        });
        found = true;
        break;
      }
    }

    if (!found) {
      Logger.log('Could not resolve stock name to symbol: "' + name + '"');
    }
  }

  return stocks;
}

/**
 * Build company name → symbol mapping from Stock_Data sheet.
 * Returns: { byNameExact: { "company name lowercase": "SYMBOL" } }
 */
function _getCompanyNameToSymbolMap() {
  var result = { byNameExact: {} };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.stockData);
    if (!sheet) return result;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return result;

    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // Symbol, BSE Code, Company Name
    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      var companyName = String(data[i][2]).trim().toLowerCase();
      if (sym && companyName) {
        result.byNameExact[companyName] = sym;
      }
    }

    Logger.log('Loaded ' + Object.keys(result.byNameExact).length + ' company name → symbol mappings');
  } catch (e) {
    Logger.log('Error loading company names: ' + e.message);
  }

  return result;
}

/**
 * Add discovered stocks to the watchlist.
 * UPSERT: If stock already exists, merge screener numbers (e.g., "1" → "1,2").
 * New stocks get their screener number in column E.
 *
 * @param {Array} stocks - from parseTrendlyneAlerts()
 *   Each: { symbol, name, screenerName, screenerNum, emailDate }
 */
function addToWatchlist(stocks) {
  if (!stocks || stocks.length === 0) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) {
    Logger.log('Screener_Watchlist sheet not found');
    return;
  }

  // Read existing watchlist
  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 28).getValues();
    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      if (sym) {
        existing[sym] = { row: i + 2, data: data[i] };
      }
    }
  }

  var added = 0;
  var updated = 0;
  var today = new Date();

  for (var i = 0; i < stocks.length; i++) {
    var stock = stocks[i];
    var sym = stock.symbol;
    var screenerNum = stock.screenerNum || 1;

    if (existing[sym]) {
      var existingStatus = String(existing[sym].data[7]); // col H

      // Don't update if already BOUGHT or manually managed
      if (existingStatus === 'BOUGHT') continue;

      // Merge screener number into column E (e.g., "1" → "1,2")
      var existingScreeners = String(existing[sym].data[4]).trim(); // col E
      var mergedScreeners = _mergeScreenerNums(existingScreeners, screenerNum);
      if (mergedScreeners !== existingScreeners) {
        sheet.getRange(existing[sym].row, 5).setValue(mergedScreeners); // col E
        Logger.log(sym + ' screeners updated: ' + existingScreeners + ' → ' + mergedScreeners);
      }

      // Always update Last Updated when stock appears in screener email
      sheet.getRange(existing[sym].row, 22).setValue(today); // col V: Last Updated
      updated++;

      // Re-activate STALE stocks that re-appear in screener
      if (existingStatus === 'STALE') {
        sheet.getRange(existing[sym].row, 8).setValue('ELIGIBLE'); // col H
        sheet.getRange(existing[sym].row, 21).setValue('Re-appeared in ' + (stock.screenerName || 'screener')); // col U
        Logger.log(sym + ' re-activated from STALE → ELIGIBLE');
      }
    } else {
      // New stock — add to watchlist
      var screenerConfig = _getScreenerByNum(screenerNum);
      var coolingDays = screenerConfig ? screenerConfig.coolingDays : 30;
      var coolingEndDate = new Date(today.getTime() + coolingDays * 24 * 60 * 60 * 1000);

      // Fetch market cap + sector
      var mcapData = { marketCapCr: null, capClass: null, sector: null };
      try {
        mcapData = fetchMarketCapOnly(sym);
      } catch (e) {
        Logger.log('Market cap fetch failed for ' + sym + ': ' + e.message);
      }

      var newRow = [
        sym,                                    // A: Symbol
        stock.name || '',                       // B: Stock Name
        today,                                  // C: Date Found
        '',                                     // D: Found Price (filled by market data update)
        String(screenerNum),                    // E: Screeners Passing (e.g., "1", "2", "1,2")
        'BASE',                                 // F: Conviction (updated by MF enrichment)
        coolingEndDate,                         // G: Cooling End Date
        'NEW',                                  // H: Status
        '', '', '',                             // I-K: Price, Change%, RSI
        '', '', '', '', '', '',                 // L-Q: DMA, GC, returns
        mcapData.sector || '',                  // R: Sector
        '',                                     // S: Nifty >200DMA
        'NO',                                   // T: All BUY Met
        '',                                     // U: Failed Conditions
        today,                                  // V: Last Updated
        '',                                     // W: Notes
        mcapData.marketCapCr || '',             // X: Market Cap (Cr)
        mcapData.capClass || ''                 // Y: Cap Class
      ];

      sheet.appendRow(newRow);
      existing[sym] = { row: sheet.getLastRow(), data: newRow };
      added++;
    }
  }

  Logger.log('Watchlist update: ' + added + ' added, ' + updated + ' updated');
}

/**
 * Merge a new screener number into existing screener string.
 * "1" + 2 → "1,2"
 * "1,2" + 3 → "1,2,3"
 * "1,2" + 1 → "1,2" (no change)
 * "CF-Stock-Screener" + 1 → "1" (migrates legacy format)
 */
function _mergeScreenerNums(existingStr, newNum) {
  // Migrate legacy formats
  if (existingStr === 'CF-Stock-Screener' || existingStr === 'CF-Multibagger-DNA' || existingStr === '') {
    existingStr = '1';
  }

  var parts = existingStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; });
  var numStr = String(newNum);

  if (parts.indexOf(numStr) === -1) {
    parts.push(numStr);
  }

  parts.sort(function(a, b) { return parseInt(a) - parseInt(b); });
  return parts.join(',');
}

/**
 * Get screener config by number
 */
function _getScreenerByNum(num) {
  var screeners = SCREENER_CONFIG.screeners || [];
  for (var i = 0; i < screeners.length; i++) {
    if (screeners[i].num === num) return screeners[i];
  }
  return null;
}

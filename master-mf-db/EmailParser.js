/**
 * ============================================================================
 * EMAIL PARSER — Parse Trendlyne screener alert emails from Gmail
 * ============================================================================
 *
 * Requires: gmail.readonly scope in appsscript.json
 *
 * Trendlyne sends emails with subject like:
 *   "Screener Alert: CF-Multibagger-DNA - 3 new stocks"
 *   "Screener Alert: CF-Insider-Buying - 5 stocks match"
 *
 * Email body contains stock names/symbols. We parse and add to watchlist.
 */

/**
 * Parse Trendlyne alert emails from the last 24 hours
 * Returns array of { symbol, screenerName, screenerNum, emailDate }
 */
function parseTrendlyneAlerts() {
  try {
    // Search Gmail for Trendlyne screener alert emails from last 24 hours
    const query = 'from:alerts@trendlyne.com subject:"Screener Alert" newer_than:1d';
    const threads = GmailApp.search(query, 0, 20);

    if (threads.length === 0) {
      Logger.log('No new Trendlyne alert emails found');
      return [];
    }

    Logger.log('Found ' + threads.length + ' Trendlyne alert email threads');

    const allStocks = [];
    const screenerNameToNum = {
      'CF-Multibagger-DNA': 1,
      'CF-SmartMoney-Flow': 2,
      'CF-Insider-Buying': 3,
      'CF-Compounder': 4
    };

    for (let t = 0; t < threads.length; t++) {
      const messages = threads[t].getMessages();

      for (let m = 0; m < messages.length; m++) {
        const msg = messages[m];
        const subject = msg.getSubject();
        const body = msg.getPlainBody();
        const date = msg.getDate();

        // Determine which screener this alert is for
        let screenerName = null;
        let screenerNum = null;

        for (const name in screenerNameToNum) {
          if (subject.includes(name) || body.includes(name)) {
            screenerName = name;
            screenerNum = screenerNameToNum[name];
            break;
          }
        }

        if (!screenerNum) {
          Logger.log('Could not determine screener for email: ' + subject);
          continue;
        }

        // Extract stock symbols from email body
        // Trendlyne typically lists stocks as "SYMBOL - Company Name" or in a table
        const stocks = _extractStocksFromEmail(body);

        for (let s = 0; s < stocks.length; s++) {
          allStocks.push({
            symbol: stocks[s].symbol,
            name: stocks[s].name || '',
            screenerName: screenerName,
            screenerNum: screenerNum,
            emailDate: date
          });
        }

        Logger.log('Screener ' + screenerNum + ' (' + screenerName + '): found ' + stocks.length + ' stocks');
      }
    }

    // Deduplicate by symbol (same stock from multiple emails)
    const seen = {};
    const unique = [];
    for (let i = 0; i < allStocks.length; i++) {
      const key = allStocks[i].symbol;
      if (!seen[key]) {
        seen[key] = allStocks[i];
        // Collect all screener numbers for this stock
        seen[key].screeners = [allStocks[i].screenerNum];
        unique.push(seen[key]);
      } else {
        // Same stock found by another screener — add screener number
        if (seen[key].screeners.indexOf(allStocks[i].screenerNum) === -1) {
          seen[key].screeners.push(allStocks[i].screenerNum);
        }
      }
    }

    Logger.log('Total unique stocks from email alerts: ' + unique.length);
    return unique;

  } catch (e) {
    Logger.log('Error parsing Trendlyne emails: ' + e.message);
    // If gmail scope not available, return empty (manual watchlist mode)
    return [];
  }
}

/**
 * Extract stock symbols from Trendlyne email body text
 * Handles multiple formats that Trendlyne uses
 */
function _extractStocksFromEmail(body) {
  const stocks = [];
  const lines = body.split('\n');

  // Get all known NSE symbols from Stock_Data sheet for validation
  const knownSymbols = _getKnownNSESymbols();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: "SYMBOL - Company Name" or "SYMBOL | Company Name"
    const match1 = line.match(/^([A-Z][A-Z0-9&_]+(?:\.NS)?)\s*[-|]\s*(.+)/);
    if (match1) {
      const sym = match1[1].replace('.NS', '').trim();
      if (knownSymbols[sym]) {
        stocks.push({ symbol: sym, name: match1[2].trim() });
        continue;
      }
    }

    // Pattern 2: Just a stock symbol on its own line (all caps, 2-20 chars)
    const match2 = line.match(/^([A-Z][A-Z0-9&_]{1,19})$/);
    if (match2 && knownSymbols[match2[1]]) {
      stocks.push({ symbol: match2[1], name: knownSymbols[match2[1]] || '' });
      continue;
    }

    // Pattern 3: Symbol appears anywhere in the line — check against known symbols
    const words = line.split(/[\s,;|]+/);
    for (let w = 0; w < words.length; w++) {
      const word = words[w].replace('.NS', '').replace(/[()]/g, '').trim();
      if (word.length >= 2 && word.length <= 20 && /^[A-Z][A-Z0-9&_]+$/.test(word) && knownSymbols[word]) {
        // Avoid duplicates within same email
        if (!stocks.some(function(s) { return s.symbol === word; })) {
          stocks.push({ symbol: word, name: knownSymbols[word] || '' });
        }
      }
    }
  }

  return stocks;
}

/**
 * Build a lookup map of known NSE symbols from Stock_Data sheet
 * Returns: { symbol: companyName }
 */
function _getKnownNSESymbols() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.stockData);
    if (!sheet) return {};

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return {};

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // Symbol, BSE Code, Company Name
    const map = {};
    for (let i = 0; i < data.length; i++) {
      const sym = String(data[i][0]).trim();
      if (sym) map[sym] = String(data[i][2]).trim();
    }
    return map;
  } catch (e) {
    Logger.log('Error loading NSE symbols: ' + e.message);
    return {};
  }
}

/**
 * Add discovered stocks to the watchlist
 * UPSERT: If stock already exists, update screeners passing. Never delete.
 *
 * @param {Array} stocks - from parseTrendlyneAlerts()
 */
function addToWatchlist(stocks) {
  if (!stocks || stocks.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) {
    Logger.log('Screener_Watchlist sheet not found');
    return;
  }

  // Read existing watchlist
  const lastRow = sheet.getLastRow();
  const existing = {};
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 23).getValues();
    for (let i = 0; i < data.length; i++) {
      const sym = String(data[i][0]).trim();
      if (sym) {
        existing[sym] = { row: i + 2, data: data[i] };
      }
    }
  }

  let added = 0;
  let updated = 0;
  const today = new Date();

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    const sym = stock.symbol;

    if (existing[sym]) {
      // Update screeners passing if different
      const existingScreeners = String(existing[sym].data[4]); // col E
      const existingStatus = String(existing[sym].data[7]); // col H

      // Don't update if already BOUGHT or manually managed
      if (existingStatus === 'BOUGHT') continue;

      const newScreeners = (stock.screeners || [stock.screenerNum]).sort().join(',');
      if (existingScreeners !== newScreeners) {
        sheet.getRange(existing[sym].row, 5).setValue(newScreeners); // col E
        sheet.getRange(existing[sym].row, 22).setValue(today); // col V: Last Updated
        updated++;
      }
    } else {
      // New stock — add to watchlist
      const screeners = (stock.screeners || [stock.screenerNum]).sort();
      const screenerStr = screeners.join(',');
      const conviction = SCREENER_CONFIG.getConviction(screeners);

      // Cooling period = shortest of the screeners this stock passes
      const minCooling = Math.min.apply(null, screeners.map(function(s) {
        return SCREENER_CONFIG.screeners[s] ? SCREENER_CONFIG.screeners[s].coolingDays : 30;
      }));
      const coolingEndDate = new Date(today.getTime() + minCooling * 24 * 60 * 60 * 1000);

      const newRow = [
        sym,                                    // A: Symbol
        stock.name || '',                       // B: Stock Name
        today,                                  // C: Date Found
        '',                                     // D: Found Price (filled by market data update)
        screenerStr,                            // E: Screeners Passing
        conviction,                             // F: Conviction
        coolingEndDate,                         // G: Cooling End Date
        'NEW',                                  // H: Status
        '', '', '',                             // I-K: Price, Change%, RSI (filled by market data)
        '', '', '', '', '', '',                 // L-Q: DMA, GC, returns (filled by market data)
        '',                                     // R: Sector
        '',                                     // S: Nifty >200DMA
        'NO',                                   // T: All BUY Met
        '',                                     // U: Failed Conditions
        today,                                  // V: Last Updated
        ''                                      // W: Notes
      ];

      sheet.appendRow(newRow);
      added++;
    }
  }

  Logger.log('Watchlist update: ' + added + ' added, ' + updated + ' updated');
}

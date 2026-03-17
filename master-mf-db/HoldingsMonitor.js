/**
 * ============================================================================
 * HOLDINGS MONITOR — Daily holdings check, peak price update, market data
 * ============================================================================
 */

/**
 * Update all holdings with latest market data + peak prices + trailing stops
 * Called daily before signal checks
 */
function updateHoldingsMarketData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.holdings);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const config = getAllScreenerConfig();

  // Update market data columns: I=Price, V=RSI, W=50DMA, X=200DMA
  updateMarketDataForSheet(SCREENER_CONFIG.sheets.holdings, {
    symbolCol: 1,   // A
    priceCol: 9,     // I: Current Price
    rsiCol: 22,      // V: RSI(14)
    dma50Col: 23,    // W: 50DMA
    dma200Col: 24    // X: 200DMA
  });

  // Now update computed columns for each holding
  const data = sheet.getRange(2, 1, lastRow - 1, 29).getValues();

  for (let i = 0; i < data.length; i++) {
    const row = i + 2;
    const status = String(data[i][25]).trim(); // col Z
    if (status === 'SOLD') continue;

    const entryPrice = parseFloat(data[i][4]) || 0;
    const totalShares = parseFloat(data[i][5]) || 0;
    const totalInvested = parseFloat(data[i][6]) || 0;
    const currentPrice = parseFloat(data[i][8]) || 0;
    const oldPeak = parseFloat(data[i][11]) || 0;
    const isCompounder = String(data[i][18]).trim() === 'YES';

    if (!currentPrice || !entryPrice) continue;

    // Avg price
    const avgPrice = totalShares > 0 ? totalInvested / totalShares : entryPrice;
    sheet.getRange(row, 8).setValue(Math.round(avgPrice * 100) / 100); // H

    // P&L %
    const pnlPct = ((currentPrice - avgPrice) / avgPrice) * 100;
    sheet.getRange(row, 10).setValue(Math.round(pnlPct * 100) / 100); // J

    // P&L ₹
    const pnlRs = (currentPrice - avgPrice) * totalShares;
    sheet.getRange(row, 11).setValue(Math.round(pnlRs)); // K

    // Peak price — NEVER goes down
    const newPeak = updatePeakPrice(oldPeak, currentPrice);
    if (newPeak !== oldPeak) {
      sheet.getRange(row, 12).setValue(newPeak); // L
    }

    // Trailing stop
    const stop = calculateTrailingStopForHolding({
      entryPrice: entryPrice,
      currentPrice: currentPrice,
      peakPrice: newPeak,
      pnlPct: pnlPct,
      isCompounder: isCompounder
    }, config);

    sheet.getRange(row, 13).setValue(stop.stopPrice || ''); // M: Trailing Stop
    sheet.getRange(row, 14).setValue(stop.tier); // N: Stop Tier

    // LTCG date + days to LTCG
    const entryDate = data[i][3];
    if (entryDate) {
      const ltcgDate = new Date(entryDate);
      ltcgDate.setDate(ltcgDate.getDate() + 365);
      sheet.getRange(row, 20).setValue(ltcgDate); // T
      const daysToLTCG = Math.floor((ltcgDate - new Date()) / (1000 * 60 * 60 * 24));
      sheet.getRange(row, 21).setValue(daysToLTCG > 0 ? daysToLTCG : 0); // U
    }

    // Allocation % of budget
    const budget = config.STOCK_BUDGET || 300000;
    const allocPct = (totalInvested / budget) * 100;
    sheet.getRange(row, 27).setValue(Math.round(allocPct * 100) / 100); // AA
  }

  Logger.log('Holdings market data updated for ' + (lastRow - 1) + ' rows');
}

/**
 * Update watchlist with latest market data
 * Columns: I=Price, K=RSI, L=50DMA, M=200DMA, O=6M Return
 */
function updateWatchlistMarketData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  updateMarketDataForSheet(SCREENER_CONFIG.sheets.watchlist, {
    symbolCol: 1,     // A
    priceCol: 9,       // I: Current Price
    rsiCol: 11,        // K: RSI(14)
    dma50Col: 12,      // L: 50DMA
    dma200Col: 13,     // M: 200DMA
    return6mCol: 15    // O: 6M Return %
  });

  // Update Found Price for new entries that don't have it yet
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  for (let i = 0; i < data.length; i++) {
    const foundPrice = parseFloat(data[i][3]);
    const currentPrice = parseFloat(data[i][8]);
    if ((!foundPrice || foundPrice === 0) && currentPrice > 0) {
      sheet.getRange(i + 2, 4).setValue(currentPrice); // D: Found Price
    }
  }

  Logger.log('Watchlist market data updated');
}

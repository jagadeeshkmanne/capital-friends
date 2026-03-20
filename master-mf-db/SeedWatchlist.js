/**
 * ============================================================================
 * SEED WATCHLIST — One-time bulk import from Trendlyne screener data
 * ============================================================================
 *
 * Usage:
 *   1. Run setupScreenerSheets() first if sheets are deleted
 *   2. Go to Trendlyne → each screener → copy stock symbols/names
 *   3. Paste into SEED_DATA arrays below
 *   4. Run seedWatchlistFromScreeners() from Script Editor
 *   5. Then run manualUpdateMarketData() to fetch prices/RSI/fundamentals
 *
 * After seeding is confirmed working, DELETE this file — it's a one-time tool.
 */

// ============================================================================
// PASTE YOUR TRENDLYNE DATA HERE
// ============================================================================
// Format: { symbol: 'NSE_SYMBOL', name: 'Company Name' }
// Symbol must match Stock_Data sheet column A (NSE symbol without exchange prefix)

var SEED_DATA = {
  // CF-Compounder (#1) — Quality compounders — 70 stocks
  screener1: [
    { symbol: 'TRITURBINE', name: 'Triveni Turbine' },
    { symbol: 'IGIL', name: 'International Gemmological' },
    { symbol: 'CAPLIPOINT', name: 'Caplin Point Labs' },
    { symbol: 'KIRLOSBROS', name: 'Kirloskar Brothers' },
    { symbol: 'INDIAMART', name: 'IndiaMART InterMESH' },
    { symbol: 'INGERRAND', name: 'Ingersoll-Rand' },
    { symbol: 'ACE', name: 'ACE' },
    { symbol: 'CEMPRO', name: 'Cemindia Projects' },
    { symbol: 'PRUDENT', name: 'Prudent Corporate' },
    { symbol: 'WAAREERTL', name: 'Waaree Renewable' },
    { symbol: 'ELECON', name: 'Elecon Engineering' },
    { symbol: 'ATLANTAELE', name: 'Atlanta Electricals' },
    { symbol: 'BATAINDIA', name: 'Bata' },
    { symbol: 'ESABINDIA', name: 'Esab' },
    { symbol: 'BANCOINDIA', name: 'Banco Products' },
    { symbol: 'SKFINDIA', name: 'SKF' },
    { symbol: 'TCI', name: 'Transport Corp' },
    { symbol: 'V2RETAIL', name: 'V2 Retail' },
    { symbol: 'PGIL', name: 'Pearl Global' },
    { symbol: 'TIPSMUSIC', name: 'Tips Industries' },
    { symbol: 'BLUEJET', name: 'Blue Jet Healthcare' },
    { symbol: 'CERA', name: 'Cera Sanitaryware' },
    { symbol: 'DODLA', name: 'Dodla Dairy' },
    { symbol: 'SMLMAH', name: 'SML Mahindra' },
    { symbol: 'KINGFA', name: 'Kingfa Science' },
    { symbol: 'SYMPHONY', name: 'Symphony' },
    { symbol: 'FIEMIND', name: 'FIEM Industries' },
    { symbol: 'LUMAXIND', name: 'Lumax Industries' },
    { symbol: 'DHANUKA', name: 'Dhanuka Agritech' },
    { symbol: 'SWARAJENG', name: 'Swaraj Engines' },
    { symbol: '506854', name: 'Tanfac Industries' },
    { symbol: 'EPIGRAL', name: 'Epigral' },
    { symbol: 'ITDC', name: 'India Tourism Development' },
    { symbol: 'INDRAMEDCO', name: 'Indraprastha Medical' },
    { symbol: 'SHANTIGEAR', name: 'Shanthi Gears' },
    { symbol: 'ASHOKA', name: 'Ashoka Buildcon' },
    { symbol: 'RPGLIFE', name: 'RPG Life Sciences' },
    { symbol: 'RPEL', name: 'Raghav Productivity Enhancers' },
    { symbol: 'NAVNETEDUL', name: 'Navneet Education' },
    { symbol: '500414', name: 'Timex Group' },
    { symbol: 'POKARNA', name: 'Pokarna' },
    { symbol: 'MPSLTD', name: 'MPS' },
    { symbol: 'CANTABIL', name: 'Cantabil Retail' },
    { symbol: '523606', name: 'Sika Interplant' },
    { symbol: 'PIXTRANS', name: 'Pix Transmissions' },
    { symbol: '513119', name: 'ABC Gas Intl' },
    { symbol: 'WEL', name: 'Wonder Electricals' },
    { symbol: 'ACCELYA', name: 'Accelya Solutions' },
    { symbol: '543953', name: 'Khazanchi Jewellers' },
    { symbol: '500068', name: 'Disa' },
    { symbol: '522195', name: 'Frontier Springs' },
    { symbol: 'RANEHOLDIN', name: 'Rane Holdings' },
    { symbol: 'DLINKINDIA', name: 'D-Link' },
    { symbol: 'ALLDIGI', name: 'Allsec Technologies' },
    { symbol: 'RAJOOENG', name: 'Rajoo Engineers' },
    { symbol: 'CONTROLPR', name: 'Control Print' },
    { symbol: 'GANDHITUBE', name: 'Gandhi Special Tubes' },
    { symbol: 'SRM', name: 'SRM Contractors' },
    { symbol: 'MAMATA', name: 'Mamata Machinery' },
    { symbol: 'VHLTD', name: 'Viceroy Hotels' },
    { symbol: '543709', name: 'PNGS Gargi Jewellery' },
    { symbol: '539956', name: 'TAAL Tech' },
    { symbol: '530245', name: 'Aryaman Financial' },
    { symbol: 'RADHIKAJWE', name: 'Radhika Jeweltech' },
    { symbol: 'CCCL', name: 'Consolidated Construction' },
    { symbol: '513532', name: 'Pradeep Metals' },
    { symbol: '506597', name: 'Amal' },
    { symbol: '530643', name: 'Eco Recycling' },
    { symbol: 'ARROWGREEN', name: 'Arrow Greentech' },
    { symbol: '504605', name: 'Uni Abex Alloy' }
  ],

  // CF-Momentum (#2) — Breakouts — 36 stocks
  screener2: [
    { symbol: 'CCL', name: 'CCL Products' },
    { symbol: 'J&KBANK', name: 'Jammu & Kashmir Bank' },
    { symbol: 'HAPPYFORGE', name: 'Happy Forgings' },
    { symbol: 'PRIVISCL', name: 'Privi Speciality' },
    { symbol: 'LUMAXTECH', name: 'Lumax Auto Tech' },
    { symbol: 'ATLANTAELE', name: 'Atlanta Electricals' },
    { symbol: 'PRECWIRE', name: 'Precision Wires' },
    { symbol: 'SKYGOLD', name: 'Sky Gold and Diamonds' },
    { symbol: 'LUMAXIND', name: 'Lumax Industries' },
    { symbol: 'STYLAMIND', name: 'Stylam Industries' },
    { symbol: 'AGIIL', name: 'AGI Infra' },
    { symbol: 'KMEW', name: 'Knowledge Marine Engg' },
    { symbol: 'AEROFLEX', name: 'Aeroflex Industries' },
    { symbol: 'GVPIL', name: 'GE Power' },
    { symbol: 'WHEELS', name: 'Wheels' },
    { symbol: 'GMBREW', name: 'G M Breweries' },
    { symbol: 'MMFL', name: 'M M Forgings' },
    { symbol: '513119', name: 'ABC Gas Intl' },
    { symbol: '543953', name: 'Khazanchi Jewellers' },
    { symbol: '524632', name: 'Shukra Pharma' },
    { symbol: 'VMARCIND', name: 'V-Marc' },
    { symbol: 'SILVERTUC', name: 'Silver Touch Tech' },
    { symbol: 'INDSWFTLAB', name: 'Ind-Swift Laboratories' },
    { symbol: '526775', name: 'Valiant Comms' },
    { symbol: '530929', name: 'RRP Defense' },
    { symbol: '514330', name: 'One Global Service' },
    { symbol: 'BORANA', name: 'Borana Weaves' },
    { symbol: 'ACCENTMIC', name: 'Accent Microcell' },
    { symbol: '506166', name: 'Apis' },
    { symbol: '539730', name: 'Fredun Pharma' },
    { symbol: 'SWARAJ', name: 'Swaraj Suiting' },
    { symbol: 'SACHEEROME', name: 'Sacheerome' },
    { symbol: '513532', name: 'Pradeep Metals' },
    { symbol: 'PREMIERPOL', name: 'Premier Polyfilm' },
    { symbol: 'GLOBAL', name: 'Global Education' },
    { symbol: 'AMCL', name: 'ANB Metal Cast' }
  ],

  // CF-Growth (#3) — Small-cap leaders — 83 stocks
  screener3: [
    { symbol: 'MAPMYINDIA', name: 'C.E. Info Systems' },
    { symbol: 'LUMAXIND', name: 'Lumax Industries' },
    { symbol: 'GULFOILLUB', name: 'Gulf Oil Lubricants' },
    { symbol: 'SWARAJENG', name: 'Swaraj Engines' },
    { symbol: 'DATAMATICS', name: 'Datamatics Global' },
    { symbol: '506854', name: 'Tanfac Industries' },
    { symbol: 'AGIIL', name: 'AGI Infra' },
    { symbol: 'EPIGRAL', name: 'Epigral' },
    { symbol: 'ITDC', name: 'India Tourism Development' },
    { symbol: 'INDRAMEDCO', name: 'Indraprastha Medical' },
    { symbol: 'SHANTIGEAR', name: 'Shanthi Gears' },
    { symbol: 'VADILALIND', name: 'Vadilal Industries' },
    { symbol: 'ASHOKA', name: 'Ashoka Buildcon' },
    { symbol: 'AEROFLEX', name: 'Aeroflex Industries' },
    { symbol: 'RPGLIFE', name: 'RPG Life Sciences' },
    { symbol: 'KRISHANA', name: 'Krishana Phoschem' },
    { symbol: 'ARSSBL', name: 'Anand Rathi Share Stock' },
    { symbol: 'CIGNITITEC', name: 'Cigniti Technologies' },
    { symbol: 'RPEL', name: 'Raghav Productivity Enhancers' },
    { symbol: 'NAVNETEDUL', name: 'Navneet Education' },
    { symbol: '500414', name: 'Timex Group' },
    { symbol: '526433', name: 'ASM Technologies' },
    { symbol: 'POKARNA', name: 'Pokarna' },
    { symbol: 'EIEL', name: 'Enviro Infra Engineers' },
    { symbol: 'MPSLTD', name: 'MPS' },
    { symbol: 'AUTOAXLES', name: 'Automotive Axles' },
    { symbol: 'DPABHUSHAN', name: 'D P Abhushan' },
    { symbol: 'TCPLPACK', name: 'TCPL Packaging' },
    { symbol: 'NUCLEUS', name: 'Nucleus Software Exp' },
    { symbol: 'MONARCH', name: 'Monarch Networth Cap' },
    { symbol: 'CANTABIL', name: 'Cantabil Retail' },
    { symbol: '523606', name: 'Sika Interplant' },
    { symbol: 'ANTELOPUS', name: 'Antelopus Selan Energy' },
    { symbol: 'EIHAHOTELS', name: 'EIH Asso Hotels' },
    { symbol: '513119', name: 'ABC Gas Intl' },
    { symbol: 'WEL', name: 'Wonder Electricals' },
    { symbol: 'ACCELYA', name: 'Accelya Solutions' },
    { symbol: '543953', name: 'Khazanchi Jewellers' },
    { symbol: '500068', name: 'Disa' },
    { symbol: 'NDRAUTO', name: 'NDR Auto Components' },
    { symbol: '538734', name: 'Ceinsys Tech' },
    { symbol: '522195', name: 'Frontier Springs' },
    { symbol: 'DLINKINDIA', name: 'D-Link' },
    { symbol: '544037', name: 'AMIC Forging' },
    { symbol: 'DYCL', name: 'Dynamic Cables' },
    { symbol: 'PNBGILTS', name: 'PNB Gilts' },
    { symbol: '509438', name: 'Benares Hotels' },
    { symbol: 'CLSEL', name: 'Chaman Lal Setia Exp' },
    { symbol: 'ALLDIGI', name: 'Allsec Technologies' },
    { symbol: 'EXPLEOSOL', name: 'Expleo Solutions' },
    { symbol: 'DSSL', name: 'Dynacons Systems' },
    { symbol: '514330', name: 'One Global Service' },
    { symbol: 'BHARATSE', name: 'Bharat Seats' },
    { symbol: 'CONTROLPR', name: 'Control Print' },
    { symbol: 'BORANA', name: 'Borana Weaves' },
    { symbol: 'WEALTH', name: 'Wealth First' },
    { symbol: '514448', name: 'Jyoti Resins & Adhesives' },
    { symbol: 'SRM', name: 'SRM Contractors' },
    { symbol: 'VHLTD', name: 'Viceroy Hotels' },
    { symbol: '543709', name: 'PNGS Gargi Jewellery' },
    { symbol: '539956', name: 'TAAL Tech' },
    { symbol: 'MASTERTR', name: 'Master Trust' },
    { symbol: 'BSHSL', name: 'Bombay Super Hybrid Seeds' },
    { symbol: '509960', name: 'U P Hotels' },
    { symbol: 'SCODATUBES', name: 'Scoda Tubes' },
    { symbol: 'PROSTARM', name: 'Prostarm Info Systems' },
    { symbol: 'SACHEEROME', name: 'Sacheerome' },
    { symbol: 'GANESHCP', name: 'Ganesh Consumer Products' },
    { symbol: 'RADHIKAJWE', name: 'Radhika Jeweltech' },
    { symbol: 'KARNIKA', name: 'Karnika Industries' },
    { symbol: 'CCCL', name: 'Consolidated Construction' },
    { symbol: 'MALLCOM', name: 'Mallcom' },
    { symbol: '513532', name: 'Pradeep Metals' },
    { symbol: 'KOTHARIPET', name: 'Kothari petchems' },
    { symbol: '544406', name: 'Unified Data Tech Solutions' },
    { symbol: '506597', name: 'Amal' },
    { symbol: '530643', name: 'Eco Recycling' },
    { symbol: 'ARROWGREEN', name: 'Arrow Greentech' },
    { symbol: '504605', name: 'Uni Abex Alloy' },
    { symbol: 'LIKHITHA', name: 'Likhitha Infra' },
    { symbol: 'KAMATHOTEL', name: 'Kamat Hotels' },
    { symbol: 'GLOBAL', name: 'Global Education' },
    { symbol: 'AMCL', name: 'ANB Metal Cast' }
  ]
};

// ============================================================================
// SEED FUNCTION — Run this from Script Editor
// ============================================================================

/**
 * Bulk insert all stocks from SEED_DATA into Screener_Watchlist.
 * Uses addToWatchlist() for proper cooling dates, dedup, and screener merge.
 *
 * NOTE: This is SLOW if there are many stocks because addToWatchlist() fetches
 * market cap per stock from Screener.in. For 30+ stocks, expect ~2-3 minutes.
 */
function seedWatchlistFromScreeners() {
  // Step 0: Ensure sheets exist
  setupScreenerSheets();

  var totalStocks = [];

  // Process each screener
  for (var num = 1; num <= 3; num++) {
    var key = 'screener' + num;
    var stocks = SEED_DATA[key] || [];
    if (stocks.length === 0) {
      Logger.log('Screener #' + num + ': no stocks to seed');
      continue;
    }

    var screenerNames = { 1: 'CF-Compounder', 2: 'CF-Momentum', 3: 'CF-Growth' };

    for (var i = 0; i < stocks.length; i++) {
      totalStocks.push({
        symbol: stocks[i].symbol.trim().toUpperCase(),
        name: stocks[i].name || '',
        screenerNum: num,
        screenerName: screenerNames[num]
      });
    }

    Logger.log('Screener #' + num + ' (' + screenerNames[num] + '): ' + stocks.length + ' stocks queued');
  }

  if (totalStocks.length === 0) {
    Logger.log('No stocks to seed. Paste data into SEED_DATA first.');
    SpreadsheetApp.getUi().alert('No stocks found in SEED_DATA. Paste your Trendlyne data first.');
    return;
  }

  Logger.log('Seeding ' + totalStocks.length + ' stock entries (some may overlap across screeners)...');
  addToWatchlist(totalStocks);

  // Count unique symbols
  var uniqueSymbols = {};
  for (var j = 0; j < totalStocks.length; j++) {
    uniqueSymbols[totalStocks[j].symbol] = true;
  }

  Logger.log('=== Seed complete: ' + Object.keys(uniqueSymbols).length + ' unique stocks added ===');
  Logger.log('Next step: Run manualUpdateMarketData() to fetch prices, RSI, fundamentals, and factor scores.');

  SpreadsheetApp.getUi().alert(
    'Watchlist Seeded',
    Object.keys(uniqueSymbols).length + ' unique stocks added to Screener_Watchlist.\n\n' +
    'Next: Run "Manual Update Market Data" to fetch prices and score all stocks.\n' +
    'This will take several minutes for ' + Object.keys(uniqueSymbols).length + ' stocks.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================================
// FAST SEED — Skips Screener.in fetch (much faster, fills market cap later)
// ============================================================================

/**
 * Fast bulk insert — skips per-stock market cap fetch.
 * Market cap, sector, and cap class will be filled when you run
 * manualUpdateMarketData() afterwards.
 *
 * Use this if you have 30+ stocks and don't want to wait.
 */
function seedWatchlistFast() {
  // Ensure sheets exist
  setupScreenerSheets();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.watchlist);
  if (!sheet) {
    Logger.log('Screener_Watchlist not found');
    return;
  }

  // Read existing to avoid duplicates
  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = 0; i < data.length; i++) {
      var sym = String(data[i][0]).trim();
      if (sym) {
        existing[sym] = { row: i + 2, screeners: String(data[i][4]).trim() };
      }
    }
  }

  var today = new Date();
  var screenerNames = { 1: 'CF-Compounder', 2: 'CF-Momentum', 3: 'CF-Growth' };
  var coolingDaysMap = { 1: 30, 2: 14, 3: 21 };
  var added = 0;
  var merged = 0;

  for (var num = 1; num <= 3; num++) {
    var key = 'screener' + num;
    var stocks = SEED_DATA[key] || [];

    for (var i = 0; i < stocks.length; i++) {
      var sym = stocks[i].symbol.trim().toUpperCase();
      var name = stocks[i].name || '';

      if (existing[sym]) {
        // Merge screener number
        var mergedScreeners = _mergeScreenerNums(existing[sym].screeners, num);
        if (mergedScreeners !== existing[sym].screeners) {
          sheet.getRange(existing[sym].row, 5).setValue(mergedScreeners); // col E
          existing[sym].screeners = mergedScreeners;
          merged++;
        }
        // Update last seen date
        sheet.getRange(existing[sym].row, 22).setValue(today); // col V
        continue;
      }

      // New stock — fast insert (no Screener.in fetch)
      var coolingDays = coolingDaysMap[num] || 30;
      var coolingEndDate = new Date(today.getTime() + coolingDays * 24 * 60 * 60 * 1000);

      var newRow = new Array(40); // 40 columns A-AN
      for (var c = 0; c < 40; c++) newRow[c] = '';

      newRow[0] = sym;                    // A: Symbol
      newRow[1] = name;                   // B: Stock Name
      newRow[2] = today;                  // C: Date Found
      // D: Found Price — filled by market data update
      newRow[4] = String(num);            // E: Screeners Passing
      newRow[5] = 'BASE';                 // F: Conviction
      newRow[6] = coolingEndDate;         // G: Cooling End Date
      newRow[7] = 'NEW';                  // H: Status
      newRow[19] = 'NO';                  // T: All BUY Met
      newRow[21] = today;                 // V: Last Updated

      sheet.appendRow(newRow);
      existing[sym] = { row: sheet.getLastRow(), screeners: String(num) };
      added++;
    }
  }

  Logger.log('=== Fast seed complete: ' + added + ' added, ' + merged + ' screener merges ===');
  Logger.log('Next: Run manualUpdateMarketData() to fetch all market data + scores.');

  SpreadsheetApp.getUi().alert(
    'Fast Seed Complete',
    added + ' stocks added, ' + merged + ' screener overlaps merged.\n\n' +
    'Market data (prices, RSI, fundamentals) NOT yet fetched.\n' +
    'Run "Manual Update Market Data" next.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

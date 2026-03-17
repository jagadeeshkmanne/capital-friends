# Stock Screener — Automation & React App Plan

> This documents the full implementation plan for the stock screener system.
> Rules: portfolio-rules.md | Screener params: screeners.md | Backtest: backtest-plan.md

---

## Architecture Overview

```
Trendlyne (4 screeners with saved alerts)
        ↓ email alerts (daily/weekly)
GAS — Master MF DB (daily trigger at 9 AM)
  ├── Parses Trendlyne alert emails (Gmail)
  ├── Manages Screener_Watchlist (cooling period, eligibility)
  ├── Monitors Screener_Holdings daily:
  │   ├── Price, RSI, 50DMA, 200DMA via GOOGLEFINANCE
  │   ├── Peak price tracking → trailing stop calculation
  │   ├── ADD #1 / ADD #2 / DIP BUY triggers
  │   ├── Hard exit triggers (#1-8, #12) — daily
  │   └── Soft exit triggers (#1-6) — weekly
  ├── Quarterly fundamental check (Screener.in scrape):
  │   ├── Promoter holding, pledge %, D/E, Piotroski
  │   ├── Inventory spike, receivables spike, receivable days
  │   ├── Interest coverage, related party transactions
  │   └── Re-runs all 4 screener filters per holding
  ├── Portfolio-level checks:
  │   ├── Single stock > 20% → rebalance signal
  │   ├── Sector > 35% → monthly alert / > 30% → quarterly trim
  │   ├── Portfolio -25% from peak → FREEZE
  │   ├── Nifty -20% in 1 month → CRASH ALERT
  │   └── 3+ hard exits same time → SYSTEMIC EXIT
  ├── BSE announcement parsing (best-effort):
  │   └── Keyword search: auditor, SEBI, KMP, credit rating
  ├── Writes signals → Screener_Signals sheet
  └── Sends email notifications (backup push alerts)
        ↓ WebApp API
React App — Stock Signals page (/investments/stocks)
  ├── Tab: Signals (pending actions — BUY/ADD/EXIT/REBALANCE)
  ├── Tab: Holdings (current stocks with live data + trailing stops)
  ├── Tab: Watchlist (cooling period stocks)
  ├── Tab: History (completed trades with P&L)
  └── Tab: Near Misses (stocks that almost passed screeners)
```

---

## Why Master MF DB (not user sheets)?

1. **Screener data is the same for everyone** — no per-user customization needed
2. **Master DB already exists** — ATH data, fund database are already there
3. **No extra permissions** — user sheets already IMPORTRANGE from master DB
4. **Single source of truth** — one GAS script fetches, all users see the same data
5. **WebApp API already exists** — just add `/screener` endpoints
6. **Holdings are per-user** — but still stored in master DB keyed by user/portfolio

---

## Google Sheets Structure (Master DB)

### Sheet: Screener_Watchlist
Stocks found by screeners, waiting for cooling period.

| Col | Data | Source |
|---|---|---|
| A | Stock Symbol (NSE) | Email parser |
| B | Stock Name | Screener.in |
| C | Date Found | Auto |
| D | Found Price | GOOGLEFINANCE at discovery |
| E | Screeners Passing (e.g., "1,3") | Filters.js |
| F | Conviction (HIGH/MEDIUM/COMPOUNDER) | Calculated |
| G | Cooling Period End Date | Calculated (shortest screener) |
| H | Status (NEW/COOLING/ELIGIBLE/BOUGHT/EXPIRED) | Logic |
| I | Current Price | GOOGLEFINANCE |
| J | Price Change Since Found (%) | Formula |
| K | RSI(14) | RSICalculator.js |
| L | 50DMA | GOOGLEFINANCE |
| M | 200DMA | GOOGLEFINANCE |
| N | Golden Cross (YES/NO) | L > M |
| O | 6M Return (%) | GOOGLEFINANCE |
| P | Nifty 6M Return (%) | GOOGLEFINANCE |
| Q | Relative Strength (PASS/FAIL) | O > P |
| R | Sector (BSE classification) | Screener.in |
| S | Nifty Above 200DMA (YES/NO) | GOOGLEFINANCE |
| T | All 10 BUY Conditions Met (YES/NO) | Calculated |
| U | Failed Conditions (list) | Calculated |
| V | Last Updated | Auto |
| W | Notes | Manual |

### Sheet: Screener_Holdings
Stocks currently owned — GAS monitors daily.

| Col | Data | Source |
|---|---|---|
| A | Stock Symbol (NSE) | User input (via React) |
| B | Stock Name | Auto |
| C | Sector | Screener.in |
| D | Entry Date (first buy) | User input |
| E | Entry Price (first buy) | User input |
| F | Total Shares | Calculated from transactions |
| G | Total Invested (₹) | Calculated |
| H | Avg Price | G / F |
| I | Current Price | GOOGLEFINANCE |
| J | P&L (%) | (I - H) / H × 100 |
| K | P&L (₹) | (I - H) × F |
| L | Peak Price (never goes down) | Max(L, I) daily |
| M | Trailing Stop Price | Calculated from tier |
| N | Trailing Stop Tier | Based on J% |
| O | Pyramid Stage (STARTER/ADD1/ADD2/FULL) | Updated on ADD |
| P | Dip Buy Used (YES/NO) | Updated on DIP_BUY |
| Q | Screeners Currently Passing | Weekly re-check |
| R | Conviction When Bought | From watchlist |
| S | Is Compounder (YES/NO) | Screener 4 |
| T | LTCG Date (entry + 365) | D + 365 |
| U | Days to LTCG | T - TODAY() |
| V | RSI(14) | RSICalculator.js |
| W | 50DMA | GOOGLEFINANCE |
| X | 200DMA | GOOGLEFINANCE |
| Y | Last Fundamental Check | Auto |
| Z | Status (ACTIVE/PENDING_EXIT/SOLD) | Logic |
| AA | Allocation % of Budget | G / STOCK_BUDGET × 100 |
| AB | Sector Allocation % | Sum of sector / budget |
| AC | Notes | Manual |

### Sheet: Screener_Signals
Pending action items — React app reads this to show action cards.

| Col | Data |
|---|---|
| A | Signal ID (auto: SIG-001) |
| B | Date Generated |
| C | Signal Type (BUY_STARTER / ADD1 / ADD2 / DIP_BUY / TRAILING_STOP / HARD_EXIT / SOFT_EXIT / REBALANCE / LTCG_ALERT / SECTOR_ALERT / FREEZE / CRASH_ALERT) |
| D | Priority (1=HARD_EXIT, 2=TRAILING_STOP, 3=SOFT_EXIT, 4=ADD, 5=BUY, 6=INFO) |
| E | Stock Symbol |
| F | Stock Name |
| G | Action (human-readable: "Buy 45 shares of KPIT @ ~₹500 on Zerodha") |
| H | Amount (₹) |
| I | Shares |
| J | Trigger Detail ("RSI: 32, Screeners: 1+2+3, Golden Cross: YES") |
| K | Fundamentals JSON |
| L | Status (PENDING / EXECUTED / SKIPPED / EXPIRED) |
| M | Executed Date |
| N | Executed Price |
| O | Email Sent (YES/NO) |
| P | Notes |

### Sheet: Screener_History
Completed trades — P&L tracking.

| Col | Data |
|---|---|
| A | Stock Symbol |
| B | Stock Name |
| C | Entry Date |
| D | Exit Date |
| E | Avg Entry Price |
| F | Exit Price |
| G | Shares |
| H | Invested (₹) |
| I | Exit Value (₹) |
| J | P&L (₹) |
| K | P&L (%) |
| L | Holding Days |
| M | Tax Type (STCG/LTCG) |
| N | Exit Reason |
| O | Screeners At Entry |
| P | Screeners At Exit |
| Q | Max Gain During Hold (%) |
| R | Notes |

### Sheet: Screener_NearMiss
Stocks that passed all but 1 filter — for funnel monitoring.

| Col | Data |
|---|---|
| A | Date |
| B | Stock Symbol |
| C | Stock Name |
| D | Screener (1/2/3/4) |
| E | Failed Filter Name |
| F | Actual Value |
| G | Required Value |
| H | How Close (%) |

### Sheet: Screener_Config
System configuration — editable via React Settings.

| Key | Default | Description |
|---|---|---|
| STOCK_BUDGET | 300000 | Total stock budget (₹) |
| CASH_RESERVE_PCT | 15 | Cash reserve target (%) |
| MAX_STOCKS | 8 | Max individual stocks |
| MAX_PER_SECTOR | 2 | Max stocks per sector |
| SECTOR_PCT_CAP | 30 | Max sector allocation (%) |
| SECTOR_ALERT_PCT | 35 | Monthly sector alert threshold (%) |
| HIGH_CONVICTION_PCT | 15 | Max allocation for 3+ screener stocks |
| MEDIUM_CONVICTION_PCT | 10 | Max allocation for 2 screener stocks |
| COMPOUNDER_PCT | 12 | Max allocation for Screener 4 stocks |
| TRAILING_STOP_0_20 | 25 | Trailing stop % for 0-20% gain |
| TRAILING_STOP_20_50 | 20 | Trailing stop % for 20-50% gain |
| TRAILING_STOP_50_100 | 15 | Trailing stop % for 50-100% gain |
| TRAILING_STOP_100_PLUS | 12 | Trailing stop % for 100%+ gain |
| HARD_STOP_LOSS | 30 | Hard stop loss from entry (%) |
| PAPER_TRADING | TRUE | Paper trading mode (no real signals) |

---

## GAS Daily Trigger Logic

```javascript
function dailyScreenerCheck() {
  // 1. DISCOVERY — Parse Trendlyne alert emails
  const newStocks = parseTrendlyneAlerts();
  addToWatchlist(newStocks);

  // 2. WATCHLIST — Update all stocks in cooling/eligible status
  const watchlist = getWatchlistStocks();
  for (const stock of watchlist) {
    updateMarketData(stock);  // price, RSI, 50DMA, 200DMA, 6M return
    checkCoolingPeriod(stock);
    checkPriceRunup(stock);   // expired if >20% since found
    if (stock.status === 'ELIGIBLE') {
      checkAllBuyConditions(stock);  // all 10 conditions
      if (allConditionsMet(stock)) {
        createSignal('BUY_STARTER', stock);
      }
    }
  }

  // 3. HOLDINGS — Monitor owned stocks
  const holdings = getActiveHoldings();
  for (const holding of holdings) {
    updateMarketData(holding);
    updatePeakPrice(holding);           // never goes down
    calculateTrailingStop(holding);

    // Check exit triggers (daily — price-based)
    if (checkTrailingStopHit(holding))    createSignal('TRAILING_STOP', holding);
    if (checkHardStopLoss(holding))       createSignal('HARD_EXIT', holding);
    if (checkDelistedSuspended(holding))  createSignal('HARD_EXIT', holding);

    // Check add triggers
    if (checkAdd1Eligible(holding))  createSignal('ADD1', holding);
    if (checkAdd2Eligible(holding))  createSignal('ADD2', holding);
    if (checkDipBuyEligible(holding)) createSignal('DIP_BUY', holding);

    // Check LTCG approaching
    if (holding.daysToLTCG > 0 && holding.daysToLTCG <= 60 && hasSoftExit(holding)) {
      createSignal('LTCG_ALERT', holding);
    }
  }

  // 4. PORTFOLIO-LEVEL checks
  checkPortfolioFreeze(holdings);     // -25% from peak
  checkSystemicRisk(holdings);        // 3+ hard exits
  checkNiftyCrash();                  // -20% in 1 month
  checkSectorConcentration(holdings); // monthly: >35% alert

  // 5. BSE ANNOUNCEMENTS (best-effort keyword search)
  for (const holding of holdings) {
    const flags = parseBSEAnnouncements(holding.symbol);
    if (flags.length > 0) createSignal('MANUAL_REVIEW', holding, flags);
  }

  // 6. SEND EMAILS for new pending signals
  sendSignalEmails();
}
```

### Weekly Trigger (Sunday)
```javascript
function weeklyScreenerRecheck() {
  // Re-check which screeners each holding still passes
  // Check soft exits #1-6 (screener deterioration, promoter decrease, etc.)
  // Update Screener_Holdings column Q (screeners passing)
}
```

### Quarterly Trigger
```javascript
function quarterlyFundamentalCheck() {
  // Scrape Screener.in for each holding's latest quarterly data
  // Check hard exits: promoter <35%, pledge >30%, pledge trend >2%, D/E >1.5,
  //   interest coverage <1.5, Piotroski ≤2, related party >25%
  // Check soft exits: inventory spike, receivables spike, receivable days,
  //   revenue negative 2 consecutive Qs
  // Generate quarterly rebalance email (stock >20%, sector >30%)
}
```

### Monthly Trigger (1st of month)
```javascript
function monthlySectorCheck() {
  // Check if any sector >35% of portfolio → send alert email + signal
}
```

---

## Data Sources (all free)

| Data | Source | Method | Frequency |
|---|---|---|---|
| Screener alerts | Trendlyne email | GmailApp.search() | Daily |
| Current price | GOOGLEFINANCE | Spreadsheet formula / UrlFetchApp | Daily |
| RSI(14) | GOOGLEFINANCE 30-day close | Calculated | Daily |
| 50DMA, 200DMA | GOOGLEFINANCE | Calculated | Daily |
| 6M return | GOOGLEFINANCE | Calculated | Daily |
| Nifty 50 data | GOOGLEFINANCE("INDEXNSE:NIFTY_50") | Formula | Daily |
| Fundamentals | Screener.in scraping | UrlFetchApp + HTML parse | Quarterly |
| Promoter/pledge | Screener.in or BSE filings | UrlFetchApp | Quarterly |
| BSE announcements | BSE corporate filings | UrlFetchApp + keyword search | Daily |
| Avg daily traded value | Price × Volume from GOOGLEFINANCE | Calculated | Daily |

---

## React App — Stock Signals Page

### Route: /investments/stocks

### Tab 1: Signals (default — action items)
- Pending signals sorted by priority (hard exit → trailing stop → soft exit → add → buy)
- Each signal = action card: type icon, stock name, action text, amount, shares
- Buttons: "Mark as Bought/Sold" → records transaction + clears signal
- "Skip" → marks as SKIPPED with reason
- "Details ▾" → expands full fundamentals
- Empty state: "No pending actions. System is watching."
- Badge count on sidebar nav

### Tab 2: Holdings (current portfolio)
- Card per stock: name, shares, avg price, current price, P&L %/₹
- Trailing stop level shown as a line/indicator
- Pyramid stage: STARTER → ADD1 → ADD2 → FULL (progress bar)
- Screener badges (which ones currently pass)
- LTCG countdown (if < 60 days away)
- Sector tags
- Summary bar: total invested, current value, total P&L, cash remaining

### Tab 3: Watchlist (cooling period)
- Stocks waiting for cooling period
- Days remaining countdown
- Which screeners pass, current price vs found price
- No action buttons — awareness only
- Status: COOLING (grey) / ELIGIBLE (green) / EXPIRED (red)

### Tab 4: History (completed trades)
- Table with entry/exit dates, prices, P&L, holding period, exit reason
- Filter by: win/loss, exit type, date range
- Summary: total realized P&L, win rate, avg holding period, best/worst trade

### Tab 5: Near Misses
- Stocks that passed all but 1 screener filter
- Shows: which filter failed, by how much
- If funnel empty 3+ months, this helps decide what to relax

---

## WebApp API Endpoints (add to gas-webapp router)

| Endpoint | Method | Description |
|---|---|---|
| `/screener/signals` | GET | Pending signals (status=PENDING) |
| `/screener/signals` | POST | Update signal (EXECUTED/SKIPPED) |
| `/screener/holdings` | GET | Current holdings |
| `/screener/holdings` | POST | Record purchase (from BUY/ADD signal) |
| `/screener/holdings` | PUT | Record sale (from EXIT signal) |
| `/screener/watchlist` | GET | Watchlist stocks |
| `/screener/history` | GET | Trade history |
| `/screener/nearmiss` | GET | Near misses |
| `/screener/config` | GET | System config |
| `/screener/config` | POST | Update config |
| `/screener/dashboard` | GET | Summary stats |

---

## GAS Files to Create (in master-mf-db)

| File | Est. Lines | Purpose |
|---|---|---|
| `ScreenerConfig.js` | 60 | Config reader, screener definitions, thresholds |
| `EmailParser.js` | 100 | Parse Trendlyne Gmail alerts, extract stocks |
| `ScreenerFetch.js` | 150 | Scrape Screener.in for fundamentals |
| `MarketData.js` | 120 | GOOGLEFINANCE: price, RSI, DMA, returns |
| `Filters.js` | 120 | Apply 4 screener criteria, find overlaps, near misses |
| `SignalEngine.js` | 200 | All signal logic: BUY, ADD, EXIT, REBALANCE |
| `TrailingStop.js` | 80 | Peak tracking, stop calculation, tier logic |
| `HoldingsMonitor.js` | 150 | Daily holdings check, hard/soft exits |
| `BSEParser.js` | 100 | BSE announcement keyword search |
| `SheetWriter.js` | 100 | Read/write all screener sheets, dedup |
| `SignalEmail.js` | 120 | Format + send signal emails |
| `ScreenerTriggers.js` | 40 | Setup daily/weekly/monthly/quarterly triggers |

**Total: ~1,340 lines of Apps Script**

### WebApp Addition (gas-webapp)
- Add screener routes to existing router: ~100 lines

### React Components (react-app)
| Component | Purpose |
|---|---|
| `StockSignals.jsx` | Main page with 5 tabs |
| `SignalCard.jsx` | Action card (BUY/ADD/EXIT) |
| `HoldingCard.jsx` | Stock holding with trailing stop |
| `WatchlistRow.jsx` | Cooling period stock |
| `HistoryTable.jsx` | Completed trades |
| `NearMissTable.jsx` | Almost-passed stocks |
| `StockDetail.jsx` | Expanded fundamentals panel |

~500 lines of React code.

---

## Build Order

| Phase | What | Depends On |
|---|---|---|
| **0** | Create 4 Trendlyne screeners (YOU — manual) | screeners.md |
| **1** | GAS: Create sheet structure + Screener_Config | Phase 0 |
| **2** | GAS: EmailParser + watchlist management | Phase 1 |
| **3** | GAS: MarketData (GOOGLEFINANCE: price, RSI, DMA, returns) | Phase 1 |
| **4** | GAS: Filters (apply screener criteria, overlaps, near misses) | Phase 3 |
| **5** | GAS: SignalEngine — BUY signal (all 10 conditions) | Phase 4 |
| **6** | GAS: TrailingStop + HoldingsMonitor (daily checks) | Phase 3 |
| **7** | GAS: SignalEngine — ADD/DIP/EXIT signals | Phase 6 |
| **8** | GAS: SignalEmail (formatted action emails) | Phase 7 |
| **9** | GAS: Quarterly fundamental check (Screener.in scrape) | Phase 6 |
| **10** | GAS: BSEParser (announcement keywords) | Phase 6 |
| **11** | GAS: Monthly sector alert + quarterly rebalance | Phase 6 |
| **12** | GAS: WebApp API endpoints | Phase 7 |
| **13** | React: Signals page + all tabs | Phase 12 |
| **14** | **PAPER TRADING** — run 3 months, no real money | Phase 8 |
| **15** | Go live with real money | Phase 14 |

---

## Paper Trading Mode

Screener_Config has `PAPER_TRADING = TRUE` by default.

In paper mode:
- GAS generates all signals normally
- Emails say "📝 PAPER TRADE" prefix
- React app shows signals with "Paper" badge
- You can "execute" paper trades (recorded but no real money)
- After 3 months, review: signals generated, simulated P&L, false alarms
- Flip to `PAPER_TRADING = FALSE` to go live

---

## Implementation Status

- [x] Screener definitions finalized (screeners.md v3)
- [x] Portfolio rules finalized (portfolio-rules.md v3.1)
- [x] Validation complete (4 rounds, rated up to 9.6/10)
- [ ] Trendlyne screeners created (1/4 — needs redo with v2 params)
- [ ] Trendlyne alerts enabled
- [ ] GAS: Sheet structure + config
- [ ] GAS: Email parser + watchlist
- [ ] GAS: Market data (price, RSI, DMA)
- [ ] GAS: Filters + screener logic
- [ ] GAS: Signal engine (BUY/ADD/EXIT)
- [ ] GAS: Holdings monitor + trailing stops
- [ ] GAS: Signal emails
- [ ] GAS: Quarterly fundamentals
- [ ] GAS: BSE parser
- [ ] GAS: WebApp endpoints
- [ ] React: Stock Signals page
- [ ] Paper trading (3 months)
- [ ] Go live

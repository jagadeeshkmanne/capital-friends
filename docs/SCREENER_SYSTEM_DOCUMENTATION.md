# Capital Friends - Stock Screener & Signals System Documentation

> **Status**: Temporarily disabled in frontend (April 2026). Backend code intact.
> This document covers the complete architecture for future re-implementation.

## System Overview

Automated stock discovery and signal generation platform using 3 Trendlyne screeners, 5-factor scoring engine, and paper trading simulation.

**Architecture**: Master DB (data aggregation) + Per-User Sheets (signal generation + position tracking)

---

## Three-Screener Framework

| Screener | Focus | Cooling | Key Filters |
|---|---|---|---|
| CF-Compounder | Quality | 30 days | Sales/Profit 3Y >15%, ROE >15%, D/E <0.5, Piotroski >5 |
| CF-Momentum | Breakouts | 14 days | 6M return >10%, within 25% of 52W high, ROE >10% |
| CF-Growth | Small-Cap | 21 days | Sales 3Y >20%, Profit 3Y >15%, ROE >12% |

**Overlap Boost**: 2 screeners = score x1.10, alloc 1.0x | 3 screeners = score x1.20, alloc 1.2x

---

## Five-Factor Scoring Model (0-100)

| Factor | Bull | Caution | Correction | Bear |
|---|---|---|---|---|
| Momentum | 40% | 35% | 25% | 15% |
| Quality | 15% | 20% | 25% | 30% |
| Trend | 20% | 20% | 25% | 15% |
| Value | 5% | 10% | 15% | 25% |
| Low Vol | 20% | 15% | 10% | 15% |

Market regime determined by Nifty 50 vs 200DMA + 6M return.

---

## Signal Types

| Type | Priority | Trigger |
|---|---|---|
| HARD_EXIT | 1 | Loss >= 30% from avg price |
| SYSTEMIC_EXIT | 1 | 3+ stocks hit hard stop simultaneously |
| FREEZE | 1 | Portfolio down >= 25% from invested |
| TRAILING_STOP | 2 | Pullback from peak (tier-based: 25/20/15/12%) |
| SOFT_EXIT | 2 | Stock removed from watchlist |
| ADD1 | 3 | Gain 12-25%, held >= 2 weeks |
| ADD2 | 3 | Gain >= 30%, held >= 2 weeks after ADD1 |
| DIP_BUY | 3 | Drop 10-20%, RSI <= 30, one-time |
| BUY_STARTER | 4 | Factor score >= 50, all gates pass |
| REBALANCE | 5 | Sector > 35% of portfolio |
| LTCG_ALERT | 5 | Within 60 days of 1-year holding |
| SECTOR_ALERT | 5 | Sector concentration warning |
| CRASH_ALERT | 5 | Nifty down >= 20% in 1 month |

---

## Daily Pipeline

### Phase 1: Market Data Update (9:00 AM IST)
- Trendlyne API fetch for 3 screeners (~37 columns per stock)
- New stock discovery + stale stock marking
- GOOGLEFINANCE price/RSI/DMA updates
- Nifty index data persistence
- Factor scoring + ranking

### Phase 2: Signal Generation (9:45 AM IST)
- Per-user: read watchlist + holdings + config
- BUY gates: factor score, RSI, portfolio limits, sector, budget, market cap, liquidity
- Position sizing: rank-based allocation x overlap x regime multiplier
- ADD/DIP checks for held stocks
- EXIT checks (hard stop, trailing, soft)
- Portfolio-level checks (freeze, systemic)
- Write to Screener_Signals sheet

### Phase 3: Hourly Price Check (10:00 AM - 3:30 PM)
- Lightweight exit-only check
- GOOGLEFINANCE live prices
- Auto-marks exit signals

---

## Files Involved

### Backend (gas-webapp/)
| File | Lines | Purpose |
|---|---|---|
| Screener.js | ~2490 | Signal engine, paper trading, all screener logic |
| Triggers.js | ~901 | Screener triggers (daily, hourly, email) |
| WebApp.js | ~1007 | 18 screener API routes (screener:*) |
| MarketData.js | - | Market data used by screener for Nifty prices |

### Master DB (master-mf-db/)
| File | Lines | Purpose |
|---|---|---|
| ScreenerConfig.js | ~295 | Factor weights, regime config, all defaults |
| ScreenerSheets.js | ~195 | Watchlist/config sheet creation |
| ScreenerTriggers.js | ~450 | Daily pipeline orchestrator (chunked execution) |
| TrendlyneData.js | ~720 | Trendlyne API fetch, enrichment, stale marking |
| ScreenerFetch.js | ~1159 | Screener.in scraping (legacy) |
| AdminWebApp.js | ~334 | Remote admin endpoint |

### Frontend (react-app/src/)
| File | Lines | Purpose |
|---|---|---|
| ScreenerPage.jsx | ~1705 | Full UI (signals, watchlist, paper trading, settings) |
| StocksPage.jsx | - | Signal tab (removed) |
| Header.jsx | - | Signal count badge (removed) |
| api.js | - | 18 screener API exports |

---

## Google Sheets

### Master DB
- **Screener_Config**: Key-value config + Nifty regime data
- **Screener_Watchlist**: 55 columns (A-BC) - all discovered stocks with fundamentals + factor scores

### User Sheet (4 sheets)
- **Screener_Signals**: 16 columns - BUY/ADD/EXIT signals with status tracking
- **Screener_StockMeta**: 19 columns - entry data, peak price, pyramid stage, locked allocation
- **Screener_UserConfig**: 3 columns - user config overrides
- **Screener_PaperTrades**: 17 columns - paper trade execution log

---

## Configuration Defaults

```
STOCK_BUDGET: 300000, MAX_STOCKS: 8, MAX_BONUS_SLOTS: 5, MAX_PER_SECTOR: 2
ALLOC_TOP5: 10%, ALLOC_NEXT5: 7%, ALLOC_REST: 5%, FACTOR_BUY_MIN: 50
RSI_OVERBOUGHT: 70, MIN_MARKET_CAP_CR: 500, MIN_AVG_TRADED_VALUE_CR: 3
HARD_STOP_LOSS: 30%, TRAILING_STOP: 25/20/15/12%
ADD1_GAIN_PCT: 12%, ADD2_GAIN_PCT: 30%, ADD_MIN_WEEKS: 2
DIP_BUY: 10-20% drop, RSI <= 30
NIFTY_CRASH_PCT: 20%, SYSTEMIC_EXIT_COUNT: 3, PORTFOLIO_FREEZE_PCT: 25%
```

---

## Removal Checklist

1. Export Screener_* sheet data (CSV backup)
2. Cancel screener triggers (hourlyPriceCheck, dailyScreenerRun, screenerEmail)
3. Remove `case 'screener:*'` routes from WebApp.js
4. Remove screener trigger installation from Triggers.js
5. Remove ScreenerPage.jsx, screener API exports from api.js
6. Keep Screener.js and master-mf-db files for reference (or archive)
7. Remove screener sheet creation from Setup.js createAllSheets()

# Stock Screener System — Capital Friends

Fundamental stock screening system with 4 screeners for finding quality stocks.
Data centralized in **master-mf-db**, displayed via **React webapp Stock Screener page**.

## Strategy Overview

```
Trendlyne Alerts (email)
        │
        ▼
GAS (master-mf-db) reads Gmail ──► Fetches fundamentals from Screener.in + BSE
        │
        ▼
Applies 4 screener filters programmatically
        │
        ▼
Passing stocks stored in Master DB Sheet (centralized)
        │
        ▼
GOOGLEFINANCE() tracks live prices + RSI calculated from 14-day history
        │
        ▼
GAS WebApp API serves data to React frontend
        │
        ▼
React "Stock Screener" page displays results with overlap indicators
```

## Architecture

```
┌─────────────────────────────────────────┐
│          MASTER MF DB (GAS)             │
│  ├── ScreenerData.js  (fetch + store)   │
│  ├── RSICalculator.js (entry timing)    │
│  └── Master DB Sheet                    │
│       ├── Screener_Watchlist tab         │
│       ├── Screener_History tab           │
│       └── Screener_Config tab            │
├─────────────────────────────────────────┤
│          GAS WEBAPP (API)               │
│  └── /screener endpoint                 │
│       ├── GET watchlist                  │
│       ├── GET history                    │
│       └── GET overlaps                   │
├─────────────────────────────────────────┤
│          REACT APP                      │
│  └── Stock Screener page                │
│       ├── Watchlist view                 │
│       ├── Overlap highlights             │
│       ├── RSI entry signals              │
│       └── Screener filter badges         │
└─────────────────────────────────────────┘
```

**Key decision**: Data lives in master-mf-db (NOT in user sheets).
No extra permissions needed — master DB is already connected.

## Files

| File | Purpose |
|---|---|
| `README.md` | This file — overview + architecture |
| `screeners.md` | All 4 screener definitions with Trendlyne queries |
| `setup-guide.md` | Step-by-step Trendlyne + Screener.in setup |
| `investors.md` | Reference: superinvestor profiles (not actively tracked) |
| `portfolio-rules.md` | Allocation, buy/sell rules, risk management |
| `automation-plan.md` | GAS automation architecture + sheet structure |

## Tools Used

| Tool | Purpose | Cost |
|---|---|---|
| Trendlyne | Screener creation + email alerts | Paid (cancel after setup) |
| Screener.in | Fundamentals data (HTML scraping) | Free |
| BSE India API | Promoter holdings, SAST filings | Free |
| GOOGLEFINANCE() | Live prices + 30-day historical (for RSI) | Free |
| Google Apps Script | Automation engine (master-mf-db) | Free |
| Master DB Sheet | Centralized screener data storage | Free |
| GAS WebApp API | Serves data to React frontend | Free |

## Stock Budget Allocation

**Separate dedicated budget for stocks (independent from MF SIP).**

| % of Stock Budget | Type | Source |
|---|---|---|
| 60% | Stock picks | Screener 1+2+3 overlap (3-5 stocks) |
| 25% | Compounders | Screener 4 (2-3 stocks, hold 5+ years) |
| 15% | Cash reserve | Overnight Fund (for adds + new buys) |

**Max 5-8 stocks. Max 15% per stock. Pyramid buy strategy (50% starter → add on winners).**

## Buy/Sell Strategy: Pyramid Up + Trailing Stop

```
BUY:  Starter 50% → Add 25% at +8% → Add 25% at +20% (only if screeners hold)
SELL: Trailing stop (moves up with price, never down) OR hard exit on broken fundamentals
```

- Add to WINNERS (stock going up = thesis working → invest more)
- Cut LOSERS at -30% (only starter amount at risk = small loss)
- ONE dip buy allowed if fundamentals intact + RSI < 30
- Compounders: no trailing stop, hold forever unless hard exit

## RSI for Entry Timing

RSI is NOT a screener filter — it's used AFTER a stock passes screeners, for timing the buy.

```
RSI = 100 - (100 / (1 + RS))
RS  = Average Gain (14 days) / Average Loss (14 days)
```

- **RSI < 30**: Oversold → good entry point
- **RSI 30-70**: Neutral → watch
- **RSI > 70**: Overbought → wait for pullback

Data source: `GOOGLEFINANCE(symbol, "close", TODAY()-30, TODAY())` → 30 days of closing prices.

## Implementation Status

- [x] 4 screener definitions finalized
- [x] Documentation complete
- [ ] Trendlyne screeners created (1/4 done: CF-Multibagger-DNA)
- [ ] Trendlyne alerts enabled
- [ ] GAS scripts built in master-mf-db
- [ ] WebApp API endpoint added
- [ ] React Stock Screener page built

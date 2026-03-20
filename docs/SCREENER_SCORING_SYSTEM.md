# Capital Friends Stock Screener — Factor Scoring Model v2

## Architecture Overview

```
Trendlyne Screeners              Master DB                    Gas WebApp              React App
(Nifty Total Market 750)         (shared, daily pipeline)     (per-user signals)      (UI)
┌───────────────────┐           ┌──────────────────────┐     ┌──────────────────┐    ┌──────────┐
│ CF-Compounder: 71 │           │ 1. Import watchlist  │     │ Read watchlist   │    │ Signals  │
│ CF-Momentum:   15 │──email──► │ 2. Enrich (Trendlyne)│──►  │ Read Nifty data  │◄──►│ Watchlist│
│ CF-Growth:     70 │           │ 3. Fetch market data │     │ Generate signals │    │ Settings │
│                   │           │ 4. Score (5-factor)  │     │ Execute trades   │    │ Admin    │
└───────────────────┘           │ 5. Rank all stocks   │     └──────────────────┘    └──────────┘
                                └──────────────────────┘
```

---

## 1. Universe & Screening

**Universe:** Nifty Total Market (750 stocks — large + mid + small + micro cap)

**3 Trendlyne Screeners** (wide net — scoring does the ranking):

| Screener | Focus | Stocks | Key Filters |
|---|---|---|---|
| **CF-Compounder** | Quality compounders | ~71 | MCap 500-20K Cr, ROE>15%, D/E<0.5, Piotroski≥5, Revenue+Profit Growth>15% |
| **CF-Momentum** | Breakouts & trends | ~15 | MCap 500-20K Cr, HY Change>10%, Month Change<20%, Discount to 52W High<25% |
| **CF-Growth** | Emerging leaders | ~70 | MCap 500-10K Cr, Revenue Growth>20%, Profit Growth>15%, D/E<0.7 |

**~100-120 unique stocks** after deduplication. Overlap between screeners = higher conviction.

### Trendlyne Screener Queries

**CF-Compounder:**
```
( Market Capitalization > 500 AND Market Capitalization < 20000 ) AND
( Revenue Annual 3Yr Growth % > 15 ) AND
( Net Profit 3Yr Growth % > 15 ) AND
( ROE Annual % > 15 ) AND
( Long Term Debt To Equity Annual < 0.5 ) AND
( Promoter holding latest % > 40 ) AND
( Promoter holding pledge percentage % Qtr < 15 ) AND
( Piotroski Score >= 5 )
```

**CF-Momentum:**
```
( Market Capitalization > 500 AND Market Capitalization < 20000 ) AND
( Half Yr Change % > 10 ) AND
( Month Change % < 20 ) AND
( Discount to 52Week High % < 25 ) AND
( ROE Annual % > 10 ) AND
( Net Profit 3Yr Growth % > 10 ) AND
( Piotroski Score >= 4 ) AND
( Promoter holding latest % > 30 )
```

**CF-Growth:**
```
( Market Capitalization > 500 AND Market Capitalization < 10000 ) AND
( Revenue Annual 3Yr Growth % > 20 ) AND
( Net Profit 3Yr Growth % > 15 ) AND
( ROE Annual % > 12 ) AND
( Long Term Debt To Equity Annual < 0.7 ) AND
( Piotroski Score >= 4 ) AND
( Promoter holding latest % > 40 ) AND
( Promoter holding pledge percentage % Qtr < 25 )
```

---

## 2. Market Regime Detection

Reads Nifty data from Screener_Config (updated daily by trigger):

```
Nifty ABOVE 200DMA?
  ├── Yes + 6M return ≥ 0%   →  BULL       (strong uptrend)
  ├── Yes + 6M return < 0%   →  CAUTION    (uptrend weakening)
  └── No (below 200DMA):
      ├── < 5% below          →  CORRECTION (pullback)
      └── ≥ 5% below          →  BEAR       (downtrend)
```

---

## 3. Five-Factor Scoring Model

Each factor scores 0-100. Factors are **orthogonal** — each measures a distinct dimension with no overlap.

| Factor | Role | Weight Range | Description |
|---|---|---|---|
| **Momentum** | Return strength | 15-40% | How much has the stock returned? |
| **Quality** | Business health | 15-30% | Is it a well-run, profitable company? |
| **Trend** | Entry timing | 15-25% | Is now a good time to enter? |
| **Value** | Price fairness | 5-25% | Is the stock cheap vs sector peers? |
| **LowVol** | Risk/stability | 10-20% | How stable has the price been? |

### Regime-Aware Factor Weights

| Regime | Momentum | Quality | Trend | Value | LowVol | Strategy |
|---|---|---|---|---|---|---|
| **Bull** | **40** | 15 | 20 | 5 | **20** | Ride winners, protect from blow-offs |
| **Caution** | **35** | 20 | 20 | 10 | 15 | Balanced, quality gains importance |
| **Correction** | 25 | **25** | **25** | 15 | 10 | Find survivors, value opportunities |
| **Bear** | 15 | **30** | 15 | **25** | 15 | Quality + value, protect capital |

---

## 4. Factor Details

### MOMENTUM (0-100) — Pure Return (with Euphoria Guard)

```
blendedReturn = 50% × 6M return + 50% × 1Y return
score = percentile rank among all watchlist stocks

Guardrail: if 1M return > 25% → cap momentum score to 80
```

- 6M captures recent trend
- 1Y captures sustained compounders
- No drawdown penalty here (LowVol owns volatility)
- **Euphoria cap:** If a stock has run up >25% in the last month, momentum is capped at 80 regardless of percentile. Prevents chasing late-stage vertical spikes and buying at tops.

**Example:**
- Stock A: 6M=+30%, 1Y=+60%, 1M=+8% → blend=45% → high percentile (no cap)
- Stock B: 6M=+40%, 1Y=+10%, 1M=+35% → blend=25% → capped at 80 (euphoric move)

### QUALITY (0-100) — Business Strength

6 sub-factors measuring different aspects of business health:

| Sub-factor | Weight | Range | What it measures |
|---|---|---|---|
| Piotroski Score | 25% | 0-9 → 0-100 | Financial health (9 checks) |
| ROE | 20% | 0-30% → 0-100 | Profitability (capped at 30%) |
| Profit Growth | 15% | -20 to 100% → 20-100 | Earnings power |
| Debt/Equity | 15% | 0-1 → 100-0 | Leverage safety (lower = better) |
| Promoter Holding | 15% | 0-75% → 0-100 | Skin in the game (capped at 75%) |
| **OPM (Operating Margin)** | 10% | 0-40% → 0-100 | Efficiency (robust in bear markets) |

**Why OPM instead of Revenue Growth:** Revenue Growth + Profit Growth would double-count growth. OPM measures operational efficiency — how much of each rupee of revenue becomes operating profit. Strong in bear markets when margins compress.

### TREND (0-100) — Entry Timing

3 sub-signals with **regime-aware RSI** scoring:

| Sub-signal | Weight | Logic |
|---|---|---|
| RSI (14) | 40% | Regime-dependent (see below) |
| Golden Cross | 35% | 50DMA > 200DMA = 100, else 0 |
| Price > 200DMA | 25% | Above = 100, below = 0 |

**RSI scoring by regime** (smooth curves, no cliff effects):

| RSI Zone | Bull/Caution Score | Correction/Bear Score | Interpretation |
|---|---|---|---|
| < 30 | 10 | **95** | Bull: broken stock / Bear: deeply oversold reversal |
| 30-40 | 25 | 85 | Bull: weak / Bear: oversold |
| 40-50 | 55 | 65 | Neutral zone |
| 50-55 | 85 | 45 | Bull: healthy trend / Bear: neutral |
| **55-65** | **95** | 25 | Bull: ideal momentum zone / Bear: extended |
| 65-70 | 75 | 25 | Bull: strong but watch / Bear: extended |
| > 70 | 30 | 10 | Overbought — risky in all regimes |

**Why regime-aware:** In a bull market, RSI < 30 means the stock is weak/dying. In a bear market, RSI < 30 is a reversal opportunity. Same indicator, different meaning.

### VALUE (0-100) — Sector-Relative Price

**PE × 0.6 + P/B × 0.4**, computed as **inverted percentile within sector**:

```
For each stock:
  1. Find all stocks in same sector with valid PE/PB
  2. If sector has ≥ 3 stocks → use sector pool
  3. If < 3 stocks → fall back to global pool
  4. peScore = 100 - percentile(stock PE within pool)
  5. pbScore = 100 - percentile(stock PB within pool)
  6. valueScore = peScore × 0.6 + pbScore × 0.4
```

**Why sector-relative:** Banks naturally have PE 8-15, IT has PE 25-40. Comparing across sectors unfairly rewards banks. Within-sector comparison ensures a bank at PE=12 is compared to other banks, not to IT stocks.

**Why PE + PB:** PE alone misleads in cyclical sectors (low PE at peak earnings). PB catches asset-heavy companies (banks, infra) where book value matters.

### LOW VOLATILITY (0-100) — Risk/Stability (Drawdown + Choppiness)

```
drawdownScore = 100 - percentile(abs(drawdown from 52W high))
volatilityScore = 100 - percentile(return std dev across 1M/6M/1Y)
lowVolScore = 70% × drawdownScore + 30% × volatilityScore
```

- **Drawdown (70%):** Small drawdown from 52W high = stable, large = falling
- **Return volatility (30%):** Std dev of monthly-normalized returns (1M, 6M/6, 1Y/12). Catches stocks that swing wildly but recover — drawdown alone misses this choppiness.
- **Sole owner of volatility** — removed from momentum to avoid double-counting

---

## 5. Overlays (Applied After Factor Scoring)

### DII (Institutional) Flow (with Score Guard)

Domestic Institutional Investor QoQ holding change as confidence signal:

| DII Change | Condition | Multiplier | Meaning |
|---|---|---|---|
| ≥ +2% | rawScore ≥ 60 | × 1.10 (+10%) | Strong DII buying + strong stock |
| ≥ +1% | rawScore ≥ 60 | × 1.05 (+5%) | Moderate DII buying + strong stock |
| ≥ +1% | rawScore < 60 | × 1.00 (no boost) | DII buying but weak stock — skip boost |
| < -2% | always | × 0.95 (-5%) | Significant DII selling (always penalize) |
| Between -2% and +1% | — | × 1.00 | No signal |

**Score guard:** DII boost only applies if the stock's raw factor score is ≥ 60. Prevents weak stocks from getting an artificial boost just because institutions are accumulating. DII *selling* penalty always applies regardless of score — institutional exits are a warning signal for any stock.

Thresholds set at ±1/2% to reduce quarterly noise.

### Multi-Screener Overlap Boost

Stocks appearing in multiple screeners get conviction boost:

| Screeners Passing | Multiplier | Logic |
|---|---|---|
| 3 screeners | × 1.20 | Quality + Momentum + Growth = very strong |
| 2 screeners | × 1.10 | Two different lenses confirm |
| 1 screener | × 1.00 | No boost |

### Final Score

```
finalScore = min(rawScore × DII multiplier × overlap boost, 100)
```

---

## 6. Ranking & Allocation

Stocks ranked by finalScore descending. Allocation by rank:

| Rank | Allocation | Budget Example (₹3L) |
|---|---|---|
| 1-5 | 8% each | ₹24,000 |
| 6-10 | 5% each | ₹15,000 |
| 11+ | 3% each | ₹9,000 |

**Market regime multiplier** further adjusts:

| Regime | Allocation % | Meaning |
|---|---|---|
| Bull (above 200DMA, 6M ≥ 0) | 100% | Full allocation |
| Caution (above 200DMA, 6M < 0) | 75% | Reduced exposure |
| Correction (< 5% below 200DMA) | 50% | Half allocation |
| Bear (≥ 5% below 200DMA) | 25% | Capital preservation |

**Minimum score filter:** Only stocks with factor score ≥ 50 generate BUY signals.

---

## 7. Signal Types

| Signal | Priority | Trigger |
|---|---|---|
| HARD_EXIT | 1 (highest) | Stock drops > 30% from entry |
| SYSTEMIC_EXIT | 1 | ≥3 stocks hit trailing stops |
| FREEZE | 1 | Portfolio down > 25% |
| TRAILING_STOP | 2 | Price drops below trailing stop tier |
| CRASH_ALERT | 2 | Nifty down > 20% |
| SOFT_EXIT | 3 | Factor score drops, weak fundamentals |
| ADD1 / ADD2 / DIP_BUY | 4 | Existing holding shows add opportunity |
| BUY_STARTER | 5 | New stock passes all conditions |
| REBALANCE / LTCG / SECTOR | 6 | Portfolio-level alerts |

---

## 8. Risk Controls

| Control | Setting | Description |
|---|---|---|
| Max stocks | 10 | Portfolio concentration |
| Max per sector | 3 | Sector diversification |
| Sector cap | 30% | No sector > 30% of portfolio |
| Trailing stops | 4 tiers | 25% (0-20% gain), 20% (20-50%), 15% (50-100%), 12% (100%+) |
| Hard stop loss | 30% | Unconditional exit |
| Momentum-only cap | 2 | Max 2 stocks from momentum screener only |
| RSI overbought block | RSI > 70 | No new buys when overbought |
| Min liquidity | ₹3 Cr/day | Safety net (primary filter on Trendlyne) |
| Min market cap | ₹500 Cr | No micro-caps |
| Paper trading | Default ON | Auto-executes in sandbox (separate sheet, no real trades) |
| Holding period | 30 days (real), 1 day (paper) | Min hold before selling (configurable per user) |
| Hourly exit check | 9 AM - 4 PM | Checks trailing stops every hour during market |

---

## 9. Daily Pipeline (Automated)

**Master DB (shared):**

| Time | Trigger | What runs |
|---|---|---|
| 7:00 AM | Daily | Trendlyne API fetch → watchlist update + enrichment |
| 9:30 AM | Daily | Market data fetch (prices, RSI, DMA, returns) |
| 10:00 AM | Daily | Nifty + benchmark data → regime detection |
| 10:15 AM | Daily | Factor scoring (v2.1) → ranking |

**Gas WebApp (per-user):**

| Time | Trigger | What runs |
|---|---|---|
| 9:30 AM | Daily | `dailyScreenerRun()` → generate signals → auto-execute paper trades → track outcomes |
| Every hour | Hourly (9-16) | `hourlyPriceCheck()` → check trailing stops + hard exits → auto-execute paper sells |
| 3:00 PM | Daily (if enabled) | `sendScheduledScreenerEmail()` → 2 emails: signals + paper trading report |

**Paper Trading Auto-Execution:**
- BUY signals → auto-create paper position in `Screener_PaperTrades` (separate from `StockHoldings`)
- EXIT signals → auto-close paper position (respects `PAPER_HOLDING_PERIOD_DAYS`)
- Paper positions are merged into signal generation to prevent duplicate BUY signals
- Performance tracked: CAGR, realized/unrealized P&L, win rate, signal accuracy (7D/14D/30D)

---

## 10. Deployment

| Component | Deploy Command | Purpose |
|---|---|---|
| Master MF DB | `./deploy-all.sh master` | Screener engine, scoring, triggers |
| Gas WebApp | `./deploy-all.sh webapp` | API router for React app |
| React App | `./deploy-all.sh react` | Frontend UI |
| All | `./deploy-all.sh all` | Everything |

---

## 11. What Makes This System Different

| Feature | Traditional Screeners | Our System |
|---|---|---|
| Factor model | Single-factor or static | **5-factor, regime-aware weights** |
| Momentum | Raw price return | **Blended 6M+1Y with euphoria cap** |
| RSI interpretation | Same in all markets | **Contextual: bull=strength, bear=reversal** |
| Valuation | PE across all stocks | **Sector-relative PE+PB** |
| Quality | ROE + growth only | **6 sub-factors including OPM + promoter** |
| Rebalancing | Semi-annual (NSE indices) | **Daily scoring + on-demand signals** |
| Institutional flow | Not used | **DII QoQ with score-gated boost** |
| Multi-screener | Single lens | **3 screeners with overlap boost** |
| Risk | Not integrated | **Trailing stops, sector caps, regime allocation** |

---

## 12. Watchlist Column Map (Screener_Watchlist Sheet)

### A-AB: Core columns (28)
| Col | Letter | Header | Used in Scoring |
|---|---|---|---|
| 1 | A | Symbol | Key |
| 2 | B | Stock Name | Display |
| 3 | C | Date Found | - |
| 4 | D | Found Price | - |
| 5 | E | Screeners Passing | Overlap boost |
| 6 | F | Conviction | Legacy |
| 7 | G | Cooling End Date | - |
| 8 | H | Status | Filter (skip EXPIRED) |
| 9 | I | Current Price | Trend (DMA comparison) |
| 10 | J | Price Change % | - |
| 11 | K | RSI(14) | **Trend factor** |
| 12 | L | 50DMA | Trend (golden cross) |
| 13 | M | 200DMA | **Trend factor** |
| 14 | N | Golden Cross | **Trend factor** |
| 15 | O | 6M Return % | **Momentum factor** |
| 16 | P | Nifty 6M Return % | - |
| 17 | Q | Relative Strength | Legacy (removed from scoring) |
| 18 | R | Sector | **Value factor** (sector grouping) |
| 19 | S | Nifty >200DMA | - |
| 20 | T | All BUY Met | - |
| 21 | U | Failed Conditions | - |
| 22 | V | Last Updated | - |
| 23 | W | Notes | - |
| 24 | X | Market Cap (Cr) | - |
| 25 | Y | Cap Class | - |
| 26 | Z | 1W Return % | - |
| 27 | AA | 1M Return % | **Momentum cap** (>25% = euphoria) |
| 28 | AB | 1Y Return % | **Momentum factor** |

### AC-AN: Factor scoring + liquidity (12)
| Col | Letter | Header | Used in Scoring |
|---|---|---|---|
| 29 | AC | PE | **Value factor** |
| 30 | AD | ROE % | **Quality factor** |
| 31 | AE | Piotroski | **Quality factor** |
| 32 | AF | Profit Growth % | **Quality factor** |
| 33 | AG | Debt/Equity | **Quality factor** |
| 34 | AH | DII Holding % | - |
| 35 | AI | DII Change QoQ | **DII overlay** |
| 36 | AJ | 52W High | - |
| 37 | AK | Drawdown % | **LowVol factor** |
| 38 | AL | Factor Score | Output |
| 39 | AM | Factor Rank | Output |
| 40 | AN | Avg Traded Val (Cr) | Liquidity filter |

### AO-AX: Trendlyne enrichment (10)
| Col | Letter | Header | Used in Scoring |
|---|---|---|---|
| 41 | AO | Promoter Pledge % | - |
| 42 | AP | FII Holding % | - |
| 43 | AQ | FII Change QoQ | - |
| 44 | AR | Interest Coverage | - |
| 45 | AS | EPS Growth TTM % | - |
| 46 | AT | Price to Book | **Value factor** |
| 47 | AU | OPM Qtr % | **Quality factor** |
| 48 | AV | Revenue Growth 3Y % | - (removed from scoring) |
| 49 | AW | Promoter Holding % | **Quality factor** |
| 50 | AX | MCAP Class | - |

---

*Last updated: 2026-03-20*
*Version: v2.2 (paper trading, holding lock, hourly checks, signal tracking)*
*Deployed: Master DB @6, Gas WebApp @154, React gh-pages*

# Capital Friends Stock Screener — Full System Validation Prompt

Use this prompt with any AI agent to validate the screener system: watchlist data, signal generation logic, trailing stops, momentum buying, and portfolio-level alerts.

---

## Instructions

I have an automated stock screener system for Indian NSE stocks. It discovers stocks via fundamental screeners, tracks them in a watchlist, generates BUY/ADD/SELL signals, and manages positions with trailing stops and momentum pyramiding. Please validate my data against all the rules below and report any inconsistencies.

---

## PART 1: STOCK DISCOVERY (4 Screeners on Screener.in)

Stocks are discovered via Trendlyne email alerts that monitor 4 custom screeners on Screener.in. Each screener has different fundamental criteria and a cooling period before the stock becomes eligible for buying.

### Screener 1: CF-Multibagger-DNA
Cooling period: **30 days**

```
Market Cap: 500–15,000 Cr
Sales Growth 3Y: > 15%
Profit Growth 3Y: > 15%
ROE: > 15%
Debt to Equity: < 0.5
Promoter Holding: > 45%
OPM (Operating Profit Margin): > 12%
PE (TTM): < 45
Piotroski Score: > 5
Promoter Pledge: < 10%
Cash from Operations > Net Profit
```

### Screener 2: CF-SmartMoney-Flow
Cooling period: **20 days**

```
Market Cap: > 500 Cr
MF Holding Change QoQ: > 0.5%
Promoter Holding: > 45%
ROE: > 15%
Debt to Equity: < 0.5
Sales Growth 3Y: > 15%
Profit Growth 3Y: > 15%
Piotroski Score: > 5
Promoter Pledge: < 15%
Cash from Operations > Net Profit
```

### Screener 3: CF-Insider-Buying
Cooling period: **14 days**

```
Market Cap: 500–20,000 Cr
Promoter Holding Change QoQ: > 0.25%
Sales Growth (TTM): > 15%
ROE: > 12%
Debt to Equity: < 0.7
Promoter Pledge: < 5%
Interest Coverage: > 3
```

### Screener 4: CF-Compounder
Cooling period: **30 days**

```
Market Cap: > 5,000 Cr
Sales Growth 5Y: > 12%
Sales Growth 3Y: > 12%
Sales Growth TTM: > 10%
Profit Growth 5Y: > 12%
ROE 5Y Avg: > 18%
Debt to Equity: < 0.3
Promoter Holding: > 55%
Piotroski Score: > 7
ROCE 5Y Avg: > 18%
Interest Coverage: > 5
Promoter Pledge: = 0% (zero tolerance)
Cash from Operations > Net Profit
```

---

## PART 2: WATCHLIST SHEET STRUCTURE (28 columns A–AB)

| Col | Header | Description |
|-----|--------|-------------|
| A | Symbol | NSE stock symbol |
| B | Stock Name | Company name |
| C | Date Found | When stock was first added to watchlist |
| D | Found Price | Price at time of discovery (set on first market data update) |
| E | Screeners Passing | Comma-separated screener numbers: "1", "1,2", "1,3", "4" etc. |
| F | Conviction | Derived from screener count (see Conviction rules) |
| G | Cooling End Date | Date Found + min(cooling days of screeners passing) |
| H | Status | NEW → COOLING → ELIGIBLE → EXPIRED or BOUGHT |
| I | Current Price | Latest NSE price via GOOGLEFINANCE |
| J | Price Change % | ((Current Price − Found Price) / Found Price) × 100 |
| K | RSI(14) | 14-period Relative Strength Index (0–100) |
| L | 50DMA | 50-day simple moving average |
| M | 200DMA | 200-day simple moving average |
| N | Golden Cross | "YES" if 50DMA > 200DMA, else "NO" |
| O | 6M Return % | Price return over ~130 trading days |
| P | Nifty 6M Return % | Same calculation for Nifty 50 index |
| Q | Relative Strength | "PASS" if 6M Return > Nifty 6M Return, else "FAIL" |
| R | Sector | Industry sector (may be empty for newly added stocks) |
| S | Nifty >200DMA | "YES" if Nifty 50 current price > Nifty 200DMA, else "NO" |
| T | All BUY Met | "YES" if all 11 buy conditions pass, else "NO" |
| U | Failed Conditions | Pipe-separated list of which buy conditions failed |
| V | Last Updated | Timestamp of last market data refresh |
| W | Notes | Free text |
| X | Market Cap (Cr) | Market capitalization in Indian Crores |
| Y | Cap Class | LARGE / MID / SMALL / MICRO |
| Z | 1W Return % | ~5 trading days return |
| AA | 1M Return % | ~22 trading days return |
| AB | 1Y Return % | ~250 trading days return (empty if listed < 1 year) |

---

## PART 3: DERIVED FIELD RULES

### Conviction Mapping

| Condition | Conviction |
|-----------|-----------|
| Screener 4 present (any combination) | COMPOUNDER |
| 3+ screeners (without 4) | HIGH |
| 2 screeners (without 4) | MEDIUM |
| 1 screener | LOW |

### Cooling Period

- Cooling End = Date Found + **minimum** cooling days across all screeners the stock passes
- Example: screener 1 (30d) + screener 3 (14d) → cooling = **14 days**
- Status: NEW → COOLING (while today < cooling end) → ELIGIBLE (after cooling)

### Cap Class

| Cap Class | Market Cap Range |
|-----------|-----------------|
| LARGE | > 20,000 Cr |
| MID | 5,000–20,000 Cr |
| SMALL | 500–5,000 Cr |
| MICRO | < 500 Cr |

### Golden Cross

- "YES" if 50DMA > 200DMA (both must be > 0)
- "NO" otherwise

### Relative Strength

- "PASS" if stock's 6M Return % > Nifty 6M Return %
- "FAIL" otherwise

### Price Expiry

- If Price Change % (since found) exceeds **20%**, status → EXPIRED (stock ran up too much, missed entry)

---

## PART 4: 11 BUY CONDITIONS

A watchlist stock generates a **BUY_STARTER** signal only when ALL 11 conditions pass simultaneously. "All BUY Met" = YES/NO. Failed conditions are listed pipe-separated in column U.

| # | Condition | Default | Failed Message |
|---|-----------|---------|----------------|
| 1 | Cooling period passed | Status = ELIGIBLE | *(stays in COOLING, never checked)* |
| 2 | Passes 2+ screeners (Screener 4 bypasses) | ≥ 2, or Screener 4 | `Only N screener — need 2+` |
| 3 | RSI below threshold | < 45 | `RSI too high (X, max 45)` |
| 4 | Price hasn't run up since found | < 20% | *(marked EXPIRED, skipped)* |
| 5 | Portfolio has room | < 8 stocks held | `Portfolio full (N/8)` |
| 6 | Sector not full | < 2 in same sector | `SECTOR sector full` |
| 7 | Budget has room | Cash > starter amount | `Low cash (need ₹XK)` |
| 8 | Nifty above 200DMA | Price > 200DMA | `Nifty below 200DMA` |
| 9 | Golden Cross | 50DMA > 200DMA | `No golden cross` |
| 10 | Beats Nifty 6M return | 6M > Nifty 6M | `Weak vs Nifty (X% vs Y%)` |
| 11 | Market cap above minimum | ≥ 500 Cr | `Small cap (₹X Cr)` or `Micro cap` |

### Golden Cross Exception (Condition 9)

If the stock passes **both screener 1 AND screener 3** AND has **RSI < 30**, the golden cross requirement is **waived**. Rationale: screeners 1+3 = strong fundamentals + insider buying, and RSI < 30 = oversold — golden cross may form soon.

### BUY_STARTER Position Sizing

When all 11 conditions pass:

```
Max Allocation % = based on conviction:
  HIGH (3+ screeners) = 15%
  MEDIUM (2 screeners) = 10%
  COMPOUNDER (screener 4) = 12%
  LOW (1 screener) = 10%

Starter Amount = STOCK_BUDGET × (Max Allocation % / 100) × 0.5  (50% of max allocation)

If Nifty < 200DMA:
  Adjusted Amount = Starter Amount × (NIFTY_BELOW_200DMA_ALLOCATION / 100)  (default: 50%)

Shares = floor(Adjusted Amount / Current Price)
```

---

## PART 5: MOMENTUM PYRAMIDING (ADD Signals)

After buying a starter position, the system adds to winners using a pyramid strategy. Each add is 25% of max allocation.

### ADD #1 — First Addition to Winner

| Condition | Default |
|-----------|---------|
| Current pyramid stage | Must be STARTER |
| Dip Buy not used | Must be NO |
| Gain from avg price | ≥ 12% and ≤ 25% |
| Time since entry | ≥ 2 weeks (14 days) |
| Still passes 2+ screeners | YES |
| Price above 200DMA | YES |

```
Add Amount = STOCK_BUDGET × (Max Allocation % / 100) × 0.25
Shares = floor(Add Amount / Current Price)
After execution: Pyramid Stage → ADD1
```

### ADD #2 — Second Addition (Bigger Winner)

| Condition | Default |
|-----------|---------|
| Current pyramid stage | Must be ADD1 |
| Gain from avg price | ≥ 30% |
| Time since last add | ≥ 2 weeks |
| Still passes 2+ screeners | YES |
| Price above 200DMA | YES |

```
Add Amount = STOCK_BUDGET × (Max Allocation % / 100) × 0.25
After execution: Pyramid Stage → ADD2
```

### DIP BUY — Buy the Dip (One-Time Only)

| Condition | Default |
|-----------|---------|
| Current pyramid stage | Must be STARTER |
| Dip Buy not already used | Must be NO |
| Drop from avg price | ≥ 10% and ≤ 20% |
| Must pass Screener 1 AND 3 | Both required |
| RSI | ≤ 30 |
| Price above 200DMA | YES |

```
Dip Amount = STOCK_BUDGET × (Max Allocation % / 100) × 0.25
After execution: Dip Buy Used → YES (cannot dip buy again)
```

**Why momentum buying (adding to winners)?** The strategy adds to positions that are proving the thesis right (+12%, +30% gains). Trailing stops protect the downside, so if a winner reverses, you exit with profit. You never add to losers — that's what DIP BUY is for, but only under strict conditions (screener 1+3 + RSI < 30).

---

## PART 6: EXIT SIGNALS (Trailing Stops + Hard Exits)

### Hard Stop Loss

- Triggers when gain from avg price ≤ **-30%** (HARD_STOP_LOSS config)
- Action: **SELL ALL shares immediately**
- Priority: 1 (highest)
- No exceptions — this is the maximum acceptable loss

### Trailing Stop — Normal Stocks

The trailing stop % gets **tighter** as gains increase (lock in more profit on bigger winners):

| Gain Range | Stop % | Stop Calculated From |
|------------|--------|---------------------|
| 0–20% | 25% | **Entry Price** (not peak) |
| 20–50% | 20% | **Peak Price** (highest since entry) |
| 50–100% | 15% | **Peak Price** |
| 100%+ | 12% | **Peak Price** |

**Key rules**:
- At 0–20% gain, the stop is from ENTRY price (protecting capital). Above 20%, it switches to PEAK price (protecting profit).
- **Tier is based on MAX GAIN (from peak price), NOT current gain. Tiers NEVER downgrade.** If a stock reached +50% but currently at +15%, it stays in the 50–100% tier (15% from peak), not the 0–20% tier. This prevents loosening risk control after profits.

```
Example: Entry ₹100, Peak ₹150, Current ₹140 (gain = 40%, max gain = 50%)
  Tier: 50-100% (based on max gain) → Stop = 15% below peak
  Stop Price = ₹150 × (1 - 0.15) = ₹127.50
  Current ₹140 > ₹127.50 → NOT triggered

Example: Entry ₹100, Peak ₹150, Current ₹115 (gain = 15%, max gain = 50%)
  Tier: STILL 50-100% (max gain = 50%, tier never downgrades)
  Stop Price = ₹150 × (1 - 0.15) = ₹127.50
  Current ₹115 < ₹127.50 → TRIGGERED! Sell.

Example: Entry ₹100, Peak ₹118, Current ₹110 (gain = 10%, max gain = 18%)
  Tier: 0-20% → Stop = 25% below ENTRY
  Stop Price = ₹100 × (1 - 0.25) = ₹75
  Current ₹110 > ₹75 → NOT triggered
```

### Trailing Stop — Compounder Stocks (Screener 4)

Compounders get **wider stops** because they're long-term holdings with higher conviction:

| Gain Range | Stop % | From |
|------------|--------|------|
| Below +40% | **No trailing stop** | Only hard exit applies |
| 40–100% | 25% | Peak Price |
| 100–200% | 20% | Peak Price |
| 200%+ | 15% | Peak Price |

**Why no stop below +40%?** Compounders are multi-year holdings. Short-term volatility below +40% is expected. Only the hard stop (-30% from entry) protects against total thesis failure.

### Trailing Stop Trigger

Signal fires when: `Current Price ≤ Stop Price`

Action: **SELL ALL shares** at market price.

### LTCG Tax Alert

- Triggers when: holding period is between **305–365 days** (within 60 days of 1 year) AND position is at a loss
- Purpose: warn before selling — if you wait for 365 days, gains become Long Term Capital Gains (lower tax rate in India)
- Priority: 6 (informational only, not an exit signal)

---

## PART 7: PORTFOLIO-LEVEL SIGNALS

These signals are not stock-specific — they apply to the entire portfolio.

### PORTFOLIO FREEZE

- Triggers when: total portfolio value is down ≥ **25%** from total invested
- Action: **Stop all new buys and adds** until recovery
- Priority: 1 (highest)

### NIFTY CRASH ALERT

- Triggers when: Nifty 50 1-month return ≤ **-20%**
- Action: Review all positions, market is in distress
- Priority: 2

### SECTOR CONCENTRATION ALERT

- Triggers when: any single sector > **35%** of total portfolio value
- Action: Consider trimming overweight sector
- Priority: 6

### SINGLE STOCK REBALANCE

- Triggers when: any single stock > **20%** of total portfolio value
- Action: Trim position to 15% of portfolio
- Priority: 6

### SYSTEMIC EXIT

- Triggers when: **3 or more** hard exits trigger simultaneously
- Action: Consider exiting ALL positions — something systemic is happening
- Priority: 1 (highest)

---

## PART 8: SIGNAL PRIORITIES

Lower number = higher urgency. Signals are sorted by priority in the UI.

| Priority | Signal Types |
|----------|-------------|
| 1 | HARD_EXIT, FREEZE, SYSTEMIC_EXIT |
| 2 | TRAILING_STOP, CRASH_ALERT |
| 3 | SOFT_EXIT |
| 4 | ADD1, ADD2, DIP_BUY |
| 5 | BUY_STARTER |
| 6 | REBALANCE, LTCG_ALERT, SECTOR_ALERT, MANUAL_REVIEW |

---

## PART 9: SIGNAL DEDUPLICATION

- Same symbol + same signal type + same date = **duplicate, skipped**
- This prevents the daily trigger from creating duplicate signals for the same condition

---

## PART 10: SIGNAL STATUSES

| Status | Meaning |
|--------|---------|
| PENDING | Signal generated, awaiting user action |
| EXECUTED | User acted on the signal (bought/sold) |
| SKIPPED | User chose to ignore the signal |

---

## PART 11: CONFIGURABLE THRESHOLDS

All thresholds have defaults but can be overridden per user:

| Key | Default | Description |
|-----|---------|-------------|
| STOCK_BUDGET | 300,000 | Total stock portfolio budget (₹) |
| CASH_RESERVE_PCT | 15 | Cash reserve target (%) |
| MAX_STOCKS | 8 | Max individual stocks in portfolio |
| MAX_PER_SECTOR | 2 | Max stocks per sector |
| SECTOR_PCT_CAP | 30 | Max sector allocation (%) |
| SECTOR_ALERT_PCT | 35 | Sector alert threshold (%) |
| HIGH_CONVICTION_PCT | 15 | Max allocation for 3+ screener stocks (%) |
| MEDIUM_CONVICTION_PCT | 10 | Max allocation for 2 screener stocks (%) |
| COMPOUNDER_PCT | 12 | Max allocation for Screener 4 stocks (%) |
| TRAILING_STOP_0_20 | 25 | Trailing stop % for 0–20% gain |
| TRAILING_STOP_20_50 | 20 | Trailing stop % for 20–50% gain |
| TRAILING_STOP_50_100 | 15 | Trailing stop % for 50–100% gain |
| TRAILING_STOP_100_PLUS | 12 | Trailing stop % for 100%+ gain |
| HARD_STOP_LOSS | 30 | Hard stop loss from entry (%) |
| PAPER_TRADING | TRUE | Paper trading mode (no real signals) |
| COMPOUNDER_STOP_40_100 | 25 | Compounder trailing stop 40–100% gain |
| COMPOUNDER_STOP_100_200 | 20 | Compounder trailing stop 100–200% gain |
| COMPOUNDER_STOP_200_PLUS | 15 | Compounder trailing stop 200%+ gain |
| NIFTY_BELOW_200DMA_ALLOCATION | 50 | Reduce allocation by this % when Nifty < 200DMA |
| ADD1_GAIN_PCT | 12 | Min gain % to trigger Add #1 |
| ADD1_MAX_GAIN_PCT | 25 | Max gain % for Add #1 |
| ADD2_GAIN_PCT | 30 | Min gain % to trigger Add #2 |
| ADD_MIN_WEEKS | 2 | Min weeks between adds |
| DIP_BUY_MIN_DROP | 10 | Min drop % for dip buy |
| DIP_BUY_MAX_DROP | 20 | Max drop % for dip buy |
| DIP_BUY_RSI_MAX | 30 | Max RSI for dip buy |
| PRICE_RUNUP_EXPIRE_PCT | 20 | Expire from watchlist if price up this much |
| RSI_BUY_MAX | 45 | Max RSI for BUY signal |
| PORTFOLIO_FREEZE_PCT | 25 | Freeze buys when portfolio down this % |
| NIFTY_CRASH_PCT | 20 | Crash alert if Nifty drops this % in 1 month |
| SYSTEMIC_EXIT_COUNT | 3 | Exit all if this many hard exits simultaneously |
| MIN_MARKET_CAP_CR | 500 | Min market cap (Cr) — skip micro caps |

---

## PART 12: COMPLETE SYSTEM FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY TRIGGER (9:30 AM IST)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. DISCOVER: Parse Trendlyne emails → add new stocks to watchlist│
│  2. UPDATE: Fetch prices, RSI, DMA, returns for all watchlist    │
│  3. UPDATE: Fetch prices, RSI, DMA for all holdings              │
│  4. NIFTY: Fetch Nifty 50 price, 200DMA, 1M/6M returns          │
│  5. BUY CHECK: Evaluate 11 conditions for each ELIGIBLE stock    │
│  6. ADD CHECK: Evaluate ADD1/ADD2/DIP_BUY for owned stocks       │
│  7. EXIT CHECK: Evaluate hard stop + trailing stop for holdings   │
│  8. PORTFOLIO CHECK: Freeze, crash, sector, rebalance alerts     │
│  9. EMAIL: Send digest of new PENDING signals                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

Stock Lifecycle:
  DISCOVERED → WATCHLIST (NEW) → COOLING → ELIGIBLE → BUY_STARTER
  → STARTER position → ADD1 (if +12-25%) → ADD2 (if +30%)
  → Eventually: TRAILING_STOP / HARD_EXIT / MANUAL_REVIEW → SOLD

Position Sizing Pyramid:
  STARTER = 50% of max allocation
  ADD1    = 25% of max allocation  (total: 75%)
  ADD2    = 25% of max allocation  (total: 100%)
  DIP BUY = 25% of max allocation  (one-time, instead of ADD1)
```

---

## PART 13: WHAT TO VALIDATE

### Watchlist Validation (for each row):

1. **Conviction vs Screeners**: Does conviction match the screener count and rules?
2. **Golden Cross vs DMA**: Does column N match (50DMA > 200DMA)?
3. **Relative Strength vs Returns**: Does column Q match (6M Return > Nifty 6M)?
4. **Cap Class vs Market Cap**: Does column Y match the brackets?
5. **Failed Conditions completeness**: Are ALL applicable failed conditions listed? None missing, none extra?
6. **Golden Cross exception**: For stocks with screeners 1+3 and RSI < 30, "No golden cross" should NOT be in failed conditions.
7. **All BUY Met consistency**: T="NO" when failed conditions exist, T="YES" when none.
8. **Cooling End Date**: Date Found + min cooling days for the stock's screeners.
9. **Price Change %**: ((Current Price − Found Price) / Found Price) × 100.
10. **Missing data**: Flag empty Sector, Market Cap, or return columns.
11. **Duplicate symbols**: No stock should appear twice.

### Signal Validation (if signals data provided):

12. **BUY signals only for ELIGIBLE stocks** that pass all 11 conditions.
13. **ADD1 conditions**: gain 12–25%, ≥2 weeks, 2+ screeners, above 200DMA, pyramid stage = STARTER.
14. **ADD2 conditions**: gain ≥30%, ≥2 weeks since ADD1, 2+ screeners, above 200DMA, stage = ADD1.
15. **DIP BUY conditions**: drop 10–20%, screener 1+3, RSI ≤30, above 200DMA, not used before.
16. **Trailing stop calculation**: correct tier, correct stop %, from correct reference (entry vs peak).
17. **Hard exit**: triggers at ≤ -30% from avg price.
18. **Signal deduplication**: no duplicate symbol + type + date.
19. **Priority ordering**: signals sorted by priority (1 = highest).
20. **Position sizing**: starter = 50%, each add = 25% of max allocation.

### Portfolio-Level Validation:

21. **Freeze check**: portfolio down ≥25% from invested → FREEZE signal.
22. **Crash check**: Nifty 1M return ≤ -20% → CRASH_ALERT.
23. **Sector check**: any sector > 35% of portfolio value → SECTOR_ALERT.
24. **Rebalance check**: any stock > 20% of portfolio value → REBALANCE.
25. **Systemic check**: 3+ hard exits at once → SYSTEMIC_EXIT.

---

## Output Format

Please provide:
1. **Summary**: Total items validated, pass count, issue count
2. **Issues Table**: Symbol | Field | Expected | Actual | Explanation
3. **Signal Logic Audit**: For any signals, verify the trigger conditions were correctly met
4. **Observations**: Patterns, concerns, strategy risks, or edge cases worth noting

---

## PART 14: SCREENER.IN RESULTS (Raw Fundamental Data — March 17, 2026)

These are the actual stocks returned by each screener on Screener.in. Use this to:
- Verify which stocks should be in the watchlist
- Cross-check screener overlap (stocks passing multiple screeners)
- Validate conviction mapping
- Identify stocks missing from the watchlist (some are BSE-only with no NSE code — these are excluded since our system uses NSE:SYMBOL for GOOGLEFINANCE)

### Screener 1: CF-Multibagger-DNA (33 stocks)

| # | Stock | Market Cap (Cr) | Sales 3Y Growth | Profit 3Y Growth | ROE % | D/E | Promoter % | OPM % | PE | Piotroski | Pledge % | CFO > Profit | NSE Code |
|---|-------|----------------|-----------------|-------------------|-------|-----|------------|-------|-----|-----------|----------|-------------|----------|
| 1 | eClerx Services | 13,870 | 58.0% | 29.6% | 23.46 | 0 | 54.52 | 23.41 | 20.32 | 6 | 0 | YES (655>541) | ECLERX |
| 2 | Jammu & Kashmir Bank | 13,335 | 55.5% | 320.7% | 16.05 | 0.18 | 59.40 | 21.44 | 6.22 | 7 | 0 | YES (2723>2082) | J&KBANK |
| 3 | Jindal Saw | 12,800 | 55.7% | 362.3% | 15.23 | 0.14 | 63.25 | 16.37 | 11.38 | 7 | 0 | YES (2335>1738) | JINDALSAW |
| 4 | IndiaMART InterMESH | 12,412 | 91.8% | 85.1% | 25.20 | 0 | 49.12 | 31.48 | 20.51 | 7 | 0 | YES (623>551) | INDIAMART |
| 5 | Privi Speciality | 11,461 | 47.7% | 92.0% | 16.94 | 0.46 | 60.60 | 21.37 | 38.16 | 8 | 0 | YES (281>187) | PRIVISCL |
| 6 | Rainbow Childrens | 11,451 | 57.8% | 76.1% | 16.57 | 0 | 49.84 | 31.27 | 44.45 | 7 | 0 | YES (396>243) | RAINBOW |
| 7 | Lumax Auto Tech | 10,647 | 142.6% | 156.1% | 19.01 | 0.37 | 55.98 | 12.60 | 42.74 | 8 | 0 | YES (290>178) | LUMAXTECH |
| 8 | BBTC | 10,544 | 24.5% | 1670.3% | 19.93 | 0.13 | 74.05 | 16.89 | 9.52 | 8 | 0 | YES (2278>1123) | BBTC |
| 9 | ACE | 9,776 | 108.4% | 289.7% | 25.34 | 0 | 65.42 | 14.76 | 23.12 | 6 | 0 | YES (412>409) | ACE |
| 10 | Waaree Renewable | 8,622 | 849.4% | 2564.7% | 50.31 | 0.05 | 74.32 | 19.28 | 20.69 | 6 | 0 | YES (303>229) | WAAREERTL |
| 11 | Elecon Engineering | 8,590 | 88.7% | 195.4% | 20.76 | 0 | 59.27 | 23.72 | 17.84 | 6 | 0 | YES (432>415) | ELECON |
| 12 | Esab | 8,361 | 53.3% | 108.1% | 48.55 | 0 | 73.72 | 17.70 | 39.71 | 6 | 0 | YES (200>175) | ESABINDIA |
| 13 | Symphony | 5,388 | 50.4% | 76.6% | 27.94 | 0 | 73.43 | 19.14 | 33.68 | 7 | 0 | YES (259>213) | SYMPHONY |
| 14 | FIEM Industries | 5,272 | 54.9% | 117.6% | 19.73 | 0 | 54.52 | 13.21 | 21.66 | 9 | 0 | YES (233>205) | FIEMIND |
| 15 | Swaraj Engines | 4,334 | 47.9% | 51.6% | 39.59 | 0 | 52.12 | 13.38 | 23.15 | 7 | 0 | YES (177>166) | SWARAJENG |
| 16 | Epigral | 3,681 | 64.9% | 41.5% | 18.78 | 0.24 | 68.83 | 27.70 | 10.89 | 8 | 0 | YES (441>358) | EPIGRAL |
| 17 | Rolex Rings | 3,178 | 15.1% | 31.9% | 16.22 | 0 | 53.37 | 20.34 | 16.22 | 6 | 5.02 | YES (227>174) | ROLEXRINGS |
| 18 | Krishana Phoschem | 2,933 | 326.6% | 193.8% | 22.54 | 0.35 | 72.26 | 13.45 | 22.58 | 8 | 0 | YES (154>87) | KRISHANA |
| 19 | Pokarna | 2,664 | 45.7% | 139.5% | 24.10 | 0.28 | 56.66 | 34.25 | 23.39 | 8 | 0 | YES (191>188) | POKARNA |
| 20 | Mayur Uniquoters | 2,190 | 36.1% | 58.2% | 15.62 | 0 | 58.59 | 20.75 | 12.60 | 7 | 0 | YES (157>149) | MAYURUNIQ |
| 21 | Cantabil Retail | 2,076 | 83.0% | 96.8% | 19.04 | 0 | 74.21 | 28.11 | 23.32 | 7 | 0 | YES (150>75) | CANTABIL |
| 22 | Antelopus Selan Energy | 1,900 | 221.7% | 645.6% | 15.74 | 0 | 69.94 | 49.63 | 28.17 | 8 | 0 | YES (126>74) | ANTELOPUS |
| 23 | EIH Asso Hotels | 1,834 | 115.9% | 613.2% | 17.11 | 0 | 75.00 | 29.60 | 19.14 | 7 | 0 | YES (109>92) | EIHAHOTELS |
| 24 | Accelya Solutions | 1,763 | 43.6% | 69.4% | 46.46 | 0 | 74.66 | 35.97 | 16.36 | 6 | 0 | YES (145>129) | ACCELYA |
| 25 | Expleo Solutions | 1,115 | 155.1% | 91.5% | 16.23 | 0 | 71.05 | 15.91 | 10.48 | 7 | 0 | YES (179>103) | EXPLEOSOL |
| 26 | Allsec Technologies | 1,104 | 72.1% | 133.7% | 32.10 | 0 | 73.39 | 23.27 | 15.20 | 8 | 0 | YES (118>83) | ALLDIGI |
| 27 | Rajoo Engineers | 1,014 | 34.7% | 152.5% | 23.35 | 0 | 60.70 | 17.98 | 16.52 | 6 | 0 | YES (71>38) | RAJOOENG |
| 28 | Mamata Machinery | 946 | 32.0% | 87.8% | 23.81 | 0.01 | 62.45 | 21.06 | 22.43 | 8 | 0 | YES (73>41) | MAMATA |
| 29 | U P Hotels | 809 | 113.1% | 341.6% | 16.38 | 0 | 88.39 | 26.48 | 26.88 | 6 | 0 | YES (36>30) | *(no NSE)* |
| 30 | Aryaman Financial | 755 | 39.3% | 577.3% | 24.51 | 0 | 63.92 | 44.61 | 22.64 | 7 | 0 | YES (46>32) | *(no NSE)* |
| 31 | Amal | 590 | 210.2% | 2538.7% | 29.53 | 0 | 71.35 | 31.88 | 21.66 | 8 | 0 | YES (50>29) | *(no NSE)* |
| 32 | Pradeep Metals | 568 | 40.7% | 36.0% | 19.80 | 0.12 | 73.48 | 14.87 | 20.96 | 7 | 0 | YES (33>27) | *(no NSE)* |
| 33 | Uni Abex Alloy | 567 | 45.5% | 173.0% | 23.70 | 0 | 63.63 | 21.99 | 16.25 | 7 | 0 | YES (35>34) | *(no NSE)* |

**Note**: Stocks 29–33 have no NSE code (BSE-only) and are excluded from the watchlist. Growth % calculated as ((Rev Annual / Rev 3Y ago) - 1) × 100.

### Screener 2: CF-SmartMoney-Flow (12 stocks)

| # | Stock | Market Cap (Cr) | MF Change QoQ % | Promoter % | ROE % | D/E | Sales 3Y Growth | Profit 3Y Growth | Piotroski | Pledge % | CFO > Profit | NSE Code |
|---|-------|----------------|-----------------|------------|-------|-----|-----------------|-------------------|-----------|----------|-------------|----------|
| 1 | Hindustan Aeronautics | 265,042 | 0.91 | 71.64 | 23.91 | 0 | 31.0% | 64.7% | 6 | 0 | YES (13643>8364) | HAL |
| 2 | Britannia Industries | 141,089 | 0.76 | 50.55 | 50.01 | 0.16 | 26.5% | 42.9% | 8 | 0 | YES (2481>2179) | BRITANNIA |
| 3 | Varun Beverages | 137,431 | 1.24 | 59.44 | 15.50 | 0.05 | 66.8% | 102.8% | 6 | 0.04 | YES (3509>3036) | VBL |
| 4 | Petronet LNG | 43,155 | 2.09 | 50.00 | 19.98 | 0 | 19.1% | 15.6% | 8 | 0 | YES (4398>3973) | PETRONET |
| 5 | NBCC | 22,445 | 1.40 | 61.75 | 21.82 | 0 | 55.7% | 141.3% | 8 | 0 | YES (657>541) | NBCC |
| 6 | Dr. Lal Pathlabs | 22,313 | 0.94 | 53.21 | 22.42 | 0 | 19.4% | 41.3% | 8 | 0 | YES (569>487) | LALPATHLAB |
| 7 | IndiaMART InterMESH | 12,412 | 3.03 | 49.12 | 25.20 | 0 | 91.8% | 85.1% | 7 | 0 | YES (623>551) | INDIAMART |
| 8 | Privi Speciality | 11,461 | 5.73 | 60.60 | 16.94 | 0.46 | 47.7% | 92.0% | 8 | 0 | YES (281>187) | PRIVISCL |
| 9 | Rainbow Childrens | 11,451 | 2.50 | 49.84 | 16.57 | 0 | 57.8% | 76.1% | 7 | 0 | YES (396>243) | RAINBOW |
| 10 | Vijaya Diagnostic | 9,692 | 3.18 | 52.60 | 17.98 | 0 | 47.2% | 30.4% | 6 | 1.48 | YES (224>143) | VIJAYA |
| 11 | Dodla Dairy | 6,030 | 2.52 | 58.92 | 18.48 | 0.02 | 67.1% | 95.7% | 8 | 0 | YES (520>260) | DODLA |
| 12 | FIEM Industries | 5,272 | 0.86 | 54.52 | 19.73 | 0 | 54.9% | 117.6% | 9 | 0 | YES (233>205) | FIEMIND |

### Screener 3: CF-Insider-Buying (7 stocks)

| # | Stock | Market Cap (Cr) | Promoter Change QoQ % | Sales Growth TTM % | ROE % | D/E | Pledge % | Interest Coverage | NSE Code |
|---|-------|----------------|----------------------|-------------------|-------|-----|----------|------------------|----------|
| 1 | eClerx Services | 13,870 | 0.71 | 20.84 | 23.46 | 0 | 0 | 25.64 | ECLERX |
| 2 | RateGain Travel | 5,700 | 0.38 | 27.70 | 12.41 | 0 | 0 | 242.86 | RATEGAIN |
| 3 | Krishana Phoschem | 2,933 | 0.30 | 85.89 | 22.54 | 0.35 | 0 | 4.91 | KRISHANA |
| 4 | Gateway Distriparks | 2,622 | 0.70 | 45.54 | 16.83 | 0.12 | 0 | 8.73 | GATEWAY |
| 5 | Jindal Drilling | 1,347 | 2.04 | 25.34 | 13.59 | 0.04 | 0 | 18.06 | JINDRILL |
| 6 | Ind-Swift Laboratories | 1,265 | 3.56 | 32.95 | 21.32 | 0.01 | 0 | 21.24 | INDSWFTLAB |
| 7 | Sunshield Chemicals | 669 | 1.57 | 29.48 | 15.24 | 0.20 | 0 | 4.06 | *(no NSE)* |

**Note**: Sunshield Chemicals has no NSE code (BSE-only) and is excluded from the watchlist.

### Screener 4: CF-Compounder (1 stock)

| # | Stock | Market Cap (Cr) | Sales 5Y Growth | Sales 3Y Growth | Sales TTM Growth | Profit 5Y Growth | ROE 5Y Avg % | D/E | Promoter % | Piotroski | ROCE 5Y Avg % | Interest Coverage | Pledge % | CFO > Profit | NSE Code |
|---|-------|----------------|-----------------|-----------------|-----------------|-------------------|-------------|-----|------------|-----------|--------------|------------------|----------|-------------|----------|
| 1 | Torrent Pharma | 145,718 | 43.2% | 32.6% | 12.74% | 86.5% | 20.78 | 0.16 | 68.31 | 9 | 24.35 | 14.84 | 0 | YES (2585>1911) | TORNTPHARM |

### Cross-Screener Overlap Summary

These stocks appear in multiple screeners (expected to have higher conviction):

| Stock | Screener 1 | Screener 2 | Screener 3 | Expected Screeners | Expected Conviction |
|-------|-----------|-----------|-----------|-------------------|-------------------|
| eClerx Services | YES | — | YES | 1,3 | MEDIUM |
| IndiaMART InterMESH | YES | YES | — | 1,2 | MEDIUM |
| Privi Speciality | YES | YES | — | 1,2 | MEDIUM |
| Rainbow Childrens | YES | YES | — | 1,2 | MEDIUM |
| FIEM Industries | YES | YES | — | 1,2 | MEDIUM |
| Krishana Phoschem | YES | — | YES | 1,3 | MEDIUM |

### Stocks Excluded from Watchlist (No NSE Code)

| Stock | Screener | Market Cap | Reason |
|-------|----------|-----------|--------|
| U P Hotels | 1 | 809 Cr | BSE-only (BSE:509960) |
| Aryaman Financial | 1 | 755 Cr | BSE-only (BSE:530245) |
| Amal | 1 | 590 Cr | BSE-only (BSE:506597) |
| Pradeep Metals | 1 | 568 Cr | BSE-only (BSE:513532) |
| Uni Abex Alloy | 1 | 567 Cr | BSE-only (BSE:504605) |
| Sunshield Chemicals | 3 | 669 Cr | BSE-only (BSE:530845) |

**Total from screeners**: 33 + 12 + 7 + 1 = 53 results → 47 unique NSE stocks (after dedup overlaps) → 40 in watchlist (6 BSE-only excluded, AMAL also excluded as BSE-only)

---

## PART 15: ACTUAL WATCHLIST DATA (March 18, 2026)

This is the current watchlist data after running `bulkImportToWatchlist()` + `manualDailyCheck()`. All 40 stocks are in COOLING status (added today, cooling periods active). BUY evaluation is skipped during COOLING — so Golden Cross, Relative Strength, Failed Conditions, and All BUY Met are not yet calculated.

**Nifty context**: Nifty below 200DMA (all rows show Nifty >200DMA = NO via the daily check).

| # | Symbol | Name | Found Price | Screeners | Conviction | Cooling End | Status | Current Price | RSI | 50DMA | 200DMA | 6M Ret% | MCap (Cr) | Cap | 1W% | 1M% | 1Y% |
|---|--------|------|------------|-----------|-----------|------------|--------|--------------|-----|-------|--------|---------|----------|-----|-----|-----|-----|
| 1 | ECLERX | eClerx Services | 1469 | 1,3 | MEDIUM | 01/04/2026 | COOLING | 1469 | 16.4 | 1993 | 2040 | -31.26 | 13870 | MID | -5.3 | -20.9 | 9.37 |
| 2 | J&KBANK | Jammu & Kashmir Bank | 121 | 1 | LOW | 17/04/2026 | COOLING | 121 | 57.68 | 108 | 106 | 20.95 | 13335 | MID | -3.44 | 19.03 | 28.5 |
| 3 | JINDALSAW | Jindal Saw | 198.9 | 1 | LOW | 17/04/2026 | COOLING | 198.9 | 60.57 | 180 | 195 | -1.18 | 12800 | MID | 1.07 | 5.25 | -22.01 |
| 4 | INDIAMART | IndiaMART InterMESH | 2065.3 | 1,2 | MEDIUM | 07/04/2026 | COOLING | 2065.3 | 32.85 | 2181 | 2389 | -19.77 | 12412 | MID | -3.04 | -6.1 | 6.15 |
| 5 | PRIVISCL | Privi Speciality | 2934.9 | 1,2 | MEDIUM | 07/04/2026 | COOLING | 2934.9 | 54.34 | 2813 | 2686 | 27.82 | 11461 | MID | 1.17 | 7.15 | 96.85 |
| 6 | RAINBOW | Rainbow Childrens | 1130 | 1,2 | MEDIUM | 07/04/2026 | COOLING | 1130 | 42.85 | 1203 | 1372 | -23.89 | 11451 | MID | -6.35 | -4.94 | -9.74 |
| 7 | LUMAXTECH | Lumax Auto Tech | 1570 | 1 | LOW | 17/04/2026 | COOLING | 1570 | 54.57 | 1549 | 1292 | 46.17 | 10647 | MID | 6.24 | -12.45 | 195.94 |
| 8 | BBTC | BBTC | 1521 | 1 | LOW | 17/04/2026 | COOLING | 1521 | 30.46 | 1738 | 1867 | -18.94 | 10544 | MID | -3.77 | -15.66 | -11.01 |
| 9 | ACE | ACE | 820 | 1 | LOW | 17/04/2026 | COOLING | 820 | 39.61 | 875 | 1032 | -22.64 | 9776 | MID | -3.81 | -8.5 | -29.8 |
| 10 | WAAREERTL | Waaree Renewable | 825.5 | 1 | LOW | 17/04/2026 | COOLING | 825.5 | 41.49 | 887 | 1018 | -18.47 | 8616 | MID | 0.57 | -7.09 | — |
| 11 | ELECON | Elecon Engineering | 383.5 | 1 | LOW | 17/04/2026 | COOLING | 383.5 | 41.95 | 423 | 536 | -30.88 | 8590 | MID | -4.61 | -13.92 | -7.86 |
| 12 | ESABINDIA | Esab | 5425 | 1 | LOW | 17/04/2026 | COOLING | 5425 | 44.82 | 5590 | 5381 | 6.55 | 8361 | MID | 1.8 | -1.8 | 22.5 |
| 13 | SYMPHONY | Symphony | 786 | 1 | LOW | 17/04/2026 | COOLING | 786 | 36.08 | 866 | 953 | -16.98 | 5388 | MID | -4.44 | -10.57 | -33.71 |
| 14 | FIEMIND | FIEM Industries | 2007 | 1,2 | MEDIUM | 07/04/2026 | COOLING | 2007 | 38.48 | 2219 | 2091 | -7.67 | 5272 | MID | -5.11 | -12.86 | 49.59 |
| 15 | SWARAJENG | Swaraj Engines | 3552.5 | 1 | LOW | 17/04/2026 | COOLING | 3552.5 | 53.77 | 3559 | 3913 | -19.09 | 4333 | SMALL | 2.77 | -0.7 | 16.37 |
| 16 | EPIGRAL | Epigral | 850 | 1 | LOW | 17/04/2026 | COOLING | 850 | 30.06 | 1010 | 1521 | -51.62 | 3681 | SMALL | -2.57 | -12.68 | -52.79 |
| 17 | ROLEXRINGS | Rolex Rings | 116 | 1 | LOW | 17/04/2026 | COOLING | 116 | 38.74 | 128 | 134 | -16.07 | 3178 | SMALL | -5.05 | -15.64 | -15.86 |
| 18 | KRISHANA | Krishana Phoschem | 474.95 | 1,3 | MEDIUM | 01/04/2026 | COOLING | 474.95 | 45.95 | 496 | 511 | -16.18 | 2873 | SMALL | -4.33 | -10.12 | 128.86 |
| 19 | POKARNA | Pokarna | 858.5 | 1 | LOW | 17/04/2026 | COOLING | 858.5 | 46.64 | 885 | 908 | 10.96 | 2664 | SMALL | -4.78 | -20.64 | -27.4 |
| 20 | MAYURUNIQ | Mayur Uniquoters | 507 | 1 | LOW | 17/04/2026 | COOLING | 507 | 37.68 | 527 | 532 | -5.25 | 2190 | SMALL | -1.36 | -10.35 | 7.95 |
| 21 | CANTABIL | Cantabil Retail | 247.5 | 1 | LOW | 17/04/2026 | COOLING | 247.5 | 33.8 | 281 | 264 | -2.26 | 2076 | SMALL | -3.54 | -18.65 | -5.01 |
| 22 | ANTELOPUS | Antelopus Selan Energy | 544 | 1 | LOW | 17/04/2026 | COOLING | 544 | 47.68 | 523 | 546 | -4.29 | 1900 | SMALL | -5.06 | -5.63 | 3.86 |
| 23 | EIHAHOTELS | EIH Asso Hotels | 301.8 | 1 | LOW | 17/04/2026 | COOLING | 301.8 | 33.6 | 333 | 368 | -27.52 | 1834 | SMALL | -3.9 | -10.92 | -7.32 |
| 24 | ACCELYA | Accelya Solutions | 1171.5 | 1 | LOW | 17/04/2026 | COOLING | 1171.5 | 39.13 | 1257 | 1361 | -15.65 | 1763 | SMALL | -3.71 | -0.87 | -8.83 |
| 25 | EXPLEOSOL | Expleo Solutions | 725 | 1 | LOW | 17/04/2026 | COOLING | 725 | 25.85 | 862 | 1033 | -29.55 | 1115 | SMALL | -5.16 | -14.93 | -16.44 |
| 26 | ALLDIGI | Allsec Technologies | 725 | 1 | LOW | 17/04/2026 | COOLING | 725 | 24.67 | 825 | 894 | -22.39 | 1104 | SMALL | -9.18 | -12.74 | -20.58 |
| 27 | RAJOOENG | Rajoo Engineers | 57.1 | 1 | LOW | 17/04/2026 | COOLING | 57.1 | 35.24 | 64 | 89 | -41.04 | 1014 | SMALL | -5.73 | -11.12 | — |
| 28 | MAMATA | Mamata Machinery | 383.1 | 1 | LOW | 17/04/2026 | COOLING | 383.1 | 36.81 | 409 | 432 | -4.18 | 946 | SMALL | -0.29 | -9.87 | 10.59 |
| 29 | HAL | Hindustan Aeronautics | 3950 | 2 | LOW | 07/04/2026 | COOLING | 3950 | 39.64 | 4223 | 4565 | -10.81 | 265042 | LARGE | -1.05 | -5.92 | 16.04 |
| 30 | BRITANNIA | Britannia Industries | 5856 | 2 | LOW | 07/04/2026 | COOLING | 5856 | 45.96 | 5959 | 5861 | -4.22 | 141089 | LARGE | -1.08 | -2.06 | 23.0 |
| 31 | VBL | Varun Beverages | 406.95 | 2 | LOW | 07/04/2026 | COOLING | 406.95 | 32.48 | 461 | 471 | -14.28 | 137431 | LARGE | -5.77 | -9.56 | -15.05 |
| 32 | PETRONET | Petronet LNG | 287.05 | 2 | LOW | 07/04/2026 | COOLING | 287.05 | 45.62 | 293 | 287 | 4.98 | 43155 | LARGE | -0.67 | -0.93 | 0.86 |
| 33 | NBCC | NBCC | 83.22 | 2 | LOW | 07/04/2026 | COOLING | 83.22 | 29.97 | 98 | 109 | -18.93 | 22445 | LARGE | -3.52 | -15.24 | 5.08 |
| 34 | LALPATHLAB | Dr. Lal Pathlabs | 1331.8 | 2 | LOW | 07/04/2026 | COOLING | 1331.8 | 38.55 | 1407 | 1502 | -16.64 | 22313 | LARGE | -5.2 | -4.79 | 5.34 |
| 35 | VIJAYA | Vijaya Diagnostic | 934.5 | 2 | LOW | 07/04/2026 | COOLING | 934.5 | 44.39 | 985 | 1009 | -14.88 | 9692 | MID | -2.1 | -4.67 | -7.33 |
| 36 | DODLA | Dodla Dairy | 1004.1 | 2 | LOW | 07/04/2026 | COOLING | 1004.1 | 29.59 | 1163 | 1280 | -31.65 | 6030 | MID | -1.83 | -18.25 | -0.58 |
| 37 | RATEGAIN | RateGain Travel | 482.1 | 3 | LOW | 01/04/2026 | COOLING | 482.1 | 32.08 | 582 | 576 | -22.62 | 5700 | MID | -5.55 | -11.92 | 0.69 |
| 38 | GATEWAY | Gateway Distriparks | 52.4 | 3 | LOW | 01/04/2026 | COOLING | 52.4 | 30.79 | 58 | 62 | -18.74 | 2622 | SMALL | -6.2 | -10.83 | -12.36 |
| 39 | JINDRILL | Jindal Drilling | 464.95 | 3 | LOW | 01/04/2026 | COOLING | 464.95 | 43.87 | 503 | 573 | -23.28 | 1347 | SMALL | -12.49 | -1.8 | -50.79 |
| 40 | INDSWFTLAB | Ind-Swift Labs | 146 | 3 | LOW | 01/04/2026 | COOLING | 146 | 62.62 | 123 | 107 | 37.08 | 1190 | SMALL | 2.14 | 7.21 | 65.01 |
| 41 | TORNTPHARM | Torrent Pharma | 4302.9 | 4 | COMPOUNDER | 17/04/2026 | COOLING | 4302.9 | 53.25 | 4137 | 3706 | 19.17 | 145718 | LARGE | -2.84 | 5.58 | 39.04 |

### Data Notes

- **Date Found**: All stocks added 18/03/2026 via `bulkImportToWatchlist()`
- **Found Price = Current Price**: No price change yet (just added)
- **Price Change %**: Empty (0% since found price = current price)
- **Golden Cross**: Not yet calculated (BUY evaluation skipped during COOLING)
- **Nifty 6M Return %**: Not yet populated in watchlist (available in Screener_Config)
- **Relative Strength**: Not yet calculated (depends on Nifty 6M Return)
- **Sector**: Empty (not populated by market data update — to be added)
- **Nifty >200DMA**: Set to NO by daily check (Nifty currently below 200DMA)
- **All BUY Met**: Default "NO" — BUY evaluation skipped during COOLING
- **Failed Conditions**: Empty — BUY evaluation skipped during COOLING
- **1Y Return**: Empty for WAAREERTL and RAJOOENG (listed < 1 year)

### Expected Cooling End Dates

| Screener | Cooling Days | Cooling End |
|----------|-------------|-------------|
| Screener 1 only | 30 days | 17/04/2026 |
| Screener 2 only | 20 days | 07/04/2026 |
| Screener 3 only | 14 days | 01/04/2026 |
| Screener 4 only | 30 days | 17/04/2026 |
| Screener 1+2 | min(30,20) = 20 days | 07/04/2026 |
| Screener 1+3 | min(30,14) = 14 days | 01/04/2026 |

---

## PART 16: ADDITIONAL VALIDATION CHECKS (with Screener.in data + Watchlist data)

With the raw fundamental data above, also validate:

26. **Screener criteria compliance**: Does each stock actually meet the criteria of the screener(s) it's listed under? Check every filter value against the threshold.
27. **Overlap accuracy**: Do the "Screeners Passing" in the watchlist match which screeners the stock actually appears in?
28. **BSE-only exclusion**: Are all 6 BSE-only stocks correctly absent from the watchlist?
29. **Missing NSE stocks**: Are all NSE-listed stocks from the screener results present in the watchlist? Flag any missing.
30. **Market cap consistency**: Does the market cap in the watchlist (column X) approximately match the Screener.in market cap? (Small differences expected due to price changes.)
31. **Rolex Rings pledge**: ROLEXRINGS has 5.02% promoter pledge — Screener 1 requires < 10%, so it passes. But flag it as the only stock with non-zero pledge in Screener 1.
32. **Cooling End Date accuracy**: Verify each stock's cooling end = Date Found (18/03/2026) + min cooling days for its screeners. See expected dates table in Part 15.
33. **Status consistency**: All stocks should be COOLING (today 18/03/2026 is before all cooling end dates).
34. **Conviction vs screener data**: Cross-check conviction against Part 14 screener overlap — e.g., ECLERX in Screener 1+3 = MEDIUM, TORNTPHARM in Screener 4 = COMPOUNDER.
35. **Golden Cross derivable**: Even though not calculated yet, check if 50DMA > 200DMA from the data — which stocks WOULD have golden cross?
36. **RSI readiness**: Which stocks have RSI < 45 (buy threshold) and would pass that condition when they become ELIGIBLE?
37. **Price Change % validation**: Found Price should equal Current Price (all just added). Price Change should be 0%.

---



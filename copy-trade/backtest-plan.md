# Backtesting Plan — Stock Screener System v3.1

> How to validate the screener + portfolio rules against historical data before risking real money.

---

## Three Levels of Backtesting

| Level | What | Effort | Confidence |
|---|---|---|---|
| **Level 1: Spot-Check** | Test 15 known stocks against screeners | 1-2 hours | Low (cherry-picked) |
| **Level 2: Paper Trading** | Run live system, no real money, 3 months | 3 months | Medium (real-time, small sample) |
| **Level 3: Full Backtest** | Programmatic backtest, 2018-2025, all NSE stocks | 1-2 weeks to build | High (statistically valid) |

**Recommendation**: Do Level 1 now → Build system → Level 2 for 3 months → Level 3 if you want more confidence.

---

## Level 1: Historical Spot-Check (Do This First)

### What
Pick 15 well-known Indian stocks — mix of winners, losers, and frauds. For each, check: would our screeners have caught it at the right time? Would our exits have protected us?

### Test Stocks

**Winners (should have been caught by screeners):**
| Stock | Period | What happened | Test against |
|---|---|---|---|
| Astral Ltd | 2018-2023 | 10x — pipes to building materials | Screener 1 + 4 |
| Dixon Technologies | 2020-2024 | 8x — electronics manufacturing | Screener 1 + 3 (golden cross exception test) |
| Deepak Nitrite | 2019-2022 | 5x — specialty chemicals | Screener 1 + 2 |
| Tata Elxsi | 2020-2024 | 6x — IT services | Screener 1 (golden cross exception) |
| APL Apollo Tubes | 2019-2023 | 4x — steel tubes | Screener 1 + 3 |

**Compounders (should be caught by Screener 4):**
| Stock | Period | What happened | Test against |
|---|---|---|---|
| PI Industries | 2018-2024 | Steady 25% CAGR | Screener 4 |
| Aarti Industries | 2018-2022 | Steady compounder then fell | Screener 4 + soft exit test |
| SRF Ltd | 2019-2024 | Chemicals compounder | Screener 4 |

**Losers/Frauds (should have been filtered out or exited):**
| Stock | Period | What happened | Test against |
|---|---|---|---|
| Vakrangee | 2018 crash | Fake revenue — CFO << Net Profit | CFO > NP filter |
| PC Jeweller | 2018 crash | Inventory manipulation | Inventory spike soft exit |
| Yes Bank | 2019-2020 | Pledge crisis + NPA | Pledge exit + D/E exit |
| DHFL | 2019 | Fraud + default | Interest coverage exit |
| Manpasand Beverages | 2019 | Auditor resigned + fake revenue | CFO > NP + auditor exit |
| Zee Entertainment | 2019-2022 | Pledge crisis, slow burn | Pledge trend exit (>2%/quarter) |
| Brightcom Group | 2023 | SEBI investigation | SEBI exit trigger |

### How To Do This

For each stock, go to **Screener.in** → look at historical data (they show 5-10 years):

1. **At the "right time" (before the big move)**, check all screener parameters:
   - Did it pass Screener 1? (PE, ROE, D/E, sales growth, profit growth, OPM, promoter, Piotroski, CFO > NP)
   - Did it pass Screener 3? (promoter buying, SAST filings)
   - Was there a golden cross? Or would the exception have caught it?
   - Was 6M return > Nifty?

2. **For losers**, check: would the exit trigger have fired before the crash?
   - Vakrangee: Was CFO < Net Profit before the crash? (Yes — for multiple years)
   - Yes Bank: When did pledge cross 30%? When did D/E cross 1.5?
   - DHFL: When did interest coverage drop below 1.5?

3. **Score the system**:
   - Winners caught: X out of 5
   - Compounders caught: X out of 3
   - Losers avoided/exited early: X out of 7

### Expected Results
- **Winners**: System should catch 3-4 out of 5 (some may fail PEG or relative strength at the exact right time)
- **Compounders**: Should catch 2-3 out of 3
- **Losers**: Should avoid or exit early on 6-7 out of 7 (CFO > NP alone catches most Indian frauds)

### Where To Get Historical Data
- **Screener.in**: Free, shows 10 years of annual data + quarterly data. Go to company page → "Profit & Loss", "Balance Sheet", "Shareholding"
- **Trendlyne**: Historical screener values (limited on free tier)
- **BSE India**: Historical shareholding patterns (quarterly)
- **GOOGLEFINANCE**: Historical prices (for DMA, RSI, relative strength calculations)

---

## Level 2: Paper Trading (3 Months)

### What
Run the full GAS automation live but with `PAPER_TRADING = TRUE`. No real money.

### How
1. Set up 4 Trendlyne screeners with v2 params
2. Build GAS automation (all phases)
3. GAS generates real signals based on real market data
4. You "execute" paper trades in the React app
5. Track paper portfolio for 3 months

### What To Measure
| Metric | Target | Why |
|---|---|---|
| Signals generated per month | 2-5 | Too many = filters too loose, zero = too strict |
| BUY signals that would have been profitable after 1 month | > 60% | Basic directional accuracy |
| Hard exits triggered | < 2 in 3 months | Too many = system is buying bad stocks |
| Soft exits triggered | 0-3 in 3 months | Some deterioration is normal |
| Near misses per month | 5-15 | If zero, screeners might be too loose (catching everything) |
| Win rate (paper trades closed) | > 50% | Combined with position sizing, this should be profitable |
| False alarms (signals you'd disagree with) | < 10% | System should mostly make sense |

### Paper Trading Timeline
```
Month 1: System is finding stocks, building watchlist
         → Expect: mostly watchlist activity, 0-2 BUY signals
         → Watch for: too many/too few stocks entering watchlist

Month 2: First stocks complete cooling period
         → Expect: 1-3 BUY signals, maybe 1 ADD signal
         → Watch for: are the BUY conditions too strict? Any signals at all?

Month 3: Full cycle visible
         → Expect: 5-8 stocks in paper portfolio, trailing stops tracking
         → Watch for: trailing stop levels (too tight = stopped out on noise?)
         → Decision: is the system generating sensible signals?
```

### Go/No-Go Criteria After Paper Trading
| Criteria | Go | No-Go |
|---|---|---|
| System generated ≥ 3 BUY signals in 3 months | ✅ | ❌ Screeners too strict |
| No false hard exits on fundamentally sound stocks | ✅ | ❌ Exit triggers miscalibrated |
| Paper P&L is positive OR losses are small (starter-only) | ✅ | ❌ System has a structural flaw |
| You didn't disagree with > 20% of signals | ✅ | ❌ Rules don't match your judgment |
| GAS ran without errors for 3 months | ✅ | ❌ Automation needs fixing |

---

## Level 3: Full Programmatic Backtest (Optional, Advanced)

### What
Build a Python script that simulates the entire system from 2018-2025.

### Data Needed
| Data | Source | Format |
|---|---|---|
| Daily prices (all NSE stocks) | NSE bhav copies / Yahoo Finance | CSV |
| Quarterly fundamentals | Screener.in export (paid) or manual | CSV |
| Promoter holding quarterly | BSE corporate filings | CSV |
| Nifty 50 daily prices | NSE / Yahoo Finance | CSV |

### Architecture
```python
# backtest.py — simplified structure

for each quarter from 2018-Q1 to 2025-Q1:
    # 1. Run screeners on all NSE stocks with that quarter's fundamentals
    passing_stocks = run_screeners(quarterly_data[quarter])

    # 2. Find overlaps (2+ screeners)
    overlaps = find_overlaps(passing_stocks)

    # 3. Add to watchlist with cooling period
    watchlist.add(overlaps, cooling_period)

    for each trading day in quarter:
        # 4. Check watchlist → BUY signals
        for stock in watchlist.eligible():
            if check_all_buy_conditions(stock, daily_prices, nifty):
                portfolio.buy_starter(stock)

        # 5. Monitor holdings
        for holding in portfolio.active():
            update_trailing_stop(holding, daily_prices)

            if trailing_stop_hit(holding):
                portfolio.sell(holding, 'TRAILING_STOP')

            if check_add1(holding, daily_prices):
                portfolio.add(holding, 'ADD1')

            if check_hard_exits(holding, quarterly_data):
                portfolio.sell(holding, 'HARD_EXIT')

# Output
print(f"Total Return: {portfolio.total_return()}%")
print(f"Nifty Return: {nifty_return()}%")
print(f"Max Drawdown: {portfolio.max_drawdown()}%")
print(f"Win Rate: {portfolio.win_rate()}%")
print(f"Avg Holding Period: {portfolio.avg_holding_days()} days")
```

### Key Metrics To Measure
| Metric | Benchmark | Why |
|---|---|---|
| **CAGR** | vs Nifty Smallcap 250 | Must beat the index to justify active stock picking |
| **Max Drawdown** | < 35% | System should limit losses better than buy-and-hold |
| **Win Rate** | > 50% | With pyramid sizing, even 50% win rate is very profitable |
| **Avg Winner / Avg Loser** | > 2:1 | Winners should be bigger than losers (pyramid + trailing stop) |
| **Signals per year** | 5-15 | Verify the system isn't too strict or too loose |
| **Hard exits that saved money** | > 80% correct | Verify exit triggers aren't false-alarming |
| **Sharpe Ratio** | > 1.0 | Risk-adjusted return should be good |

### Known Limitations
- **Survivorship bias**: Only testing stocks that still exist today. Delisted stocks (the ones you MOST need to avoid) are missing from free data sources.
- **Look-ahead bias**: Hard to perfectly time when fundamental data was actually available to investors.
- **Screener.in data**: Free tier shows current data. Historical fundamental data requires paid export or manual collection.
- **Transaction costs**: Zerodha charges are small (₹20/trade) but should be included.
- **Slippage**: Small/midcaps can have spread. Assume 0.5% slippage per trade.

### Realistic Alternative: Screener.in Stock Screen History
Trendlyne and Screener.in let you see historical screener results (limited). You can:
1. Set up the screener with your params
2. Check which stocks it would have caught at various historical dates
3. Manually trace what happened to those stocks afterward

Not a full backtest, but much faster than building a Python script.

---

## Recommendation

```
NOW:        Level 1 spot-check (1-2 hours)
            → Validates: do the screeners catch the right stocks?
            → Validates: do the exits protect against known frauds?

THIS MONTH: Build GAS automation + start Level 2 paper trading
            → 3 months of real-time validation
            → No money at risk

MONTH 4:   Review paper trading results
            → Go live with small starter positions if results are good
            → Adjust screener params or rules if needed

OPTIONAL:   Level 3 full backtest (if you want statistical confidence)
            → Build after going live — use paper trading data as baseline
            → Compare paper vs real performance
```

---

## Spot-Check Template

Use this for each stock in Level 1:

```
Stock: [NAME]
Period tested: [YEAR]
Current price at test date: ₹XXX

Screener 1 (Multibagger DNA):
  Sales growth 3Y: XX% (need >20%) → PASS/FAIL
  Profit growth 3Y: XX% (need >20%) → PASS/FAIL
  ROE: XX% (need >18%) → PASS/FAIL
  D/E: X.X (need <0.5) → PASS/FAIL
  Promoter: XX% (need >50%) → PASS/FAIL
  Market Cap: ₹XXX Cr (need <15,000) → PASS/FAIL
  OPM: XX% (need >12%) → PASS/FAIL
  PE: XX (need <35) → PASS/FAIL
  PEG: X.X (need <1.5) → PASS/FAIL
  Piotroski: X (need >6) → PASS/FAIL
  Pledge: X% (need <10%) → PASS/FAIL
  OCF 3Y Growth: XX% (need >10%) → PASS/FAIL
  CFO > Net Profit: YES/NO → PASS/FAIL
  RESULT: PASS / FAIL (failed: [filter])

Screener 3 (Insider Buying):
  Promoter QoQ change: +X.XX% (need >0.25%) → PASS/FAIL
  ...
  RESULT: PASS / FAIL

Entry conditions:
  Golden cross: YES/NO
  6M return vs Nifty: XX% vs XX% → PASS/FAIL
  RSI(14): XX

What happened after:
  1 month: +XX%
  3 months: +XX%
  6 months: +XX%
  12 months: +XX%

Would system have caught it? YES/NO
Would trailing stop have protected gains? YES/NO (stopped out at +XX%)
Any exit triggers? [list]

VERDICT: ✅ System would have worked / ❌ System missed this
```

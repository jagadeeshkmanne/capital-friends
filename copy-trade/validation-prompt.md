# Validation Prompt v3 — Paste this into ChatGPT / Gemini / Claude

Copy everything below the line and paste it as a single message.

---

I've designed a complete stock screening and portfolio management system for the Indian stock market. This is **v3 — validated three times already**. Three rounds of validation by AI advisors:
- v1: rated 7.5-8.5/10
- v2: rated 8.6-9.2/10
- v2.1/v3: rated 9.1/10

I incorporated feedback selectively — **I rejected 3 recommendations** from the last round with reasoning (see end). I want you to do a final validation and tell me if the system is production-ready.

Act as an experienced SEBI-registered investment advisor. Be brutally honest — tell me what's good, what's still flawed, what could blow up, and what's missing.

## CONTEXT

- I'm a retail investor in India
- I have a separate dedicated budget for stocks (independent from my MF SIP portfolio)
- I want to find quality small/midcap stocks using fundamental screening
- The system will be automated via Google Apps Script (daily email alerts for buy/sell signals)
- I buy/sell manually on Zerodha/Groww based on the automated signals
- Market: NSE/BSE listed Indian stocks

---

## GLOBAL FILTERS (applied to ALL 4 screeners)

| Parameter | Condition | Value | Why |
|---|---|---|---|
| 6Month Volume Avg | > | 50,000 | Liquidity — avoid illiquid operator stocks |
| Price above 200D SMA | = | true | Only buy in uptrend — avoid falling knives |

GAS also checks: avg daily traded value > ₹5 Cr (price × volume).

---

## THE 4 SCREENERS

### Screener 1: "CF-Multibagger-DNA" (Growth + Quality)
Find small/midcap stocks with high growth, low debt, strong promoter, real cash flows.

| Parameter | Condition | Value |
|---|---|---|
| Sales growth 3Years | > | 20% |
| Profit growth 3Years | > | 20% |
| Return on equity | > | 18% |
| Debt to equity | < | 0.5 |
| Promoter holding | > | 50% |
| Market Capitalization (Cr) | < | 15,000 |
| Operating profit margin | > | 12% |
| Price to Earning | < | 35 |
| PEG TTM | < | 1.5 |
| Piotroski Score | > | 6 |
| Promoter holding pledge % | < | 10 |
| Operating Cash Flow 3Yr Growth % | > | 10 |
| Cash from Operating Activity Annual | > | Net Profit Annual |

### Screener 2: "CF-SmartMoney-Flow" (Institutional Conviction)
Find stocks where institutions are building positions with solid fundamentals.

| Parameter | Condition | Value |
|---|---|---|
| Institutional holding current Qtr % | > | 10 |
| MF holding change QoQ (%) | > | 0.5% |
| Promoter holding (%) | > | 45% |
| Return on equity (%) | > | 15% |
| Debt to equity | < | 0.5 |
| Sales growth 3Years (%) | > | 15% |
| Profit growth 3Years (%) | > | 15% |
| Institutional holding change 4Qtr % | > | 1 |
| Promoter holding pledge % | < | 15 |
| Piotroski Score | > | 5 |
| Cash from Operating Activity Annual | > | Net Profit Annual |

### Screener 3: "CF-Insider-Buying" (Promoter Conviction + Timing)
Find stocks where promoters are actively buying — strongest legal insider signal.

| Parameter | Condition | Value |
|---|---|---|
| Promoter holding quarterly change (%) | > | 0.25% |
| Sales growth (%) | > | 15% |
| Return on equity (%) | > | 12% |
| Debt to equity | < | 0.7 |
| Market Capitalization (Cr) | < | 20,000 |
| Promoter holding pledge % | < | 5 |
| Interest Coverage Ratio Annual | > | 3 |
| SAST Buys Last Week | > | 0 |

### Screener 4: "CF-Compounder" (Defensive, Hold 5+ Years)
Find consistent compounders — buy and sleep for 5+ years.

| Parameter | Condition | Value |
|---|---|---|
| Sales growth 5Years (%) | > | 12% |
| Sales growth 3Years (%) | > | 12% |
| Sales growth TTM (%) | > | 10% |
| Profit growth 5Years (%) | > | 12% |
| Return on equity 5Year avg (%) | > | 18% |
| Debt to equity | < | 0.3 |
| Promoter holding (%) | > | 55% |
| Market Capitalization (Cr) | > | 5,000 |
| Piotroski Score | > | 7 |
| ROCE Annual 5Yr Avg % | > | 18 |
| Operating Cash Flow 5Yr Growth % | > | 10 |
| Altman Zscore | > | 3 |
| Promoter holding pledge % | = | 0 |
| Interest Coverage Ratio Annual | > | 5 |
| Cash from Operating Activity Annual | > | Net Profit Annual |

### How screeners work together:
- Stock in Screener 1 + 3 = historically highest alpha (growth DNA + insider buying)
- Stock in Screener 1 + 2 + 3 = strongest possible buy signal
- Stock in Screener 4 = separate "hold forever" bucket
- Single screener pass = watchlist only, no buy

### Near-miss logging:
GAS logs stocks that pass all but 1 filter in a "Near Miss" list. If screener funnel is empty for 3+ months, review near misses to decide if any filter should be relaxed (candidate: profit growth 3Y from 20% → 18%). Safety filters (CFO > NP, 200DMA, liquidity, pledge) are never relaxed.

---

## BUDGET ALLOCATION

| % of Stock Budget | Type | Source |
|---|---|---|
| 60% | Stock picks | Screener 1+2+3 overlap, 3-5 stocks |
| 25% | Compounders | Screener 4, 2-3 stocks |
| 15% | Cash reserve | Overnight fund (~6% while waiting) |

- Max 5-8 individual stocks total
- Max 15% per stock (fully built position)
- **Max 2 stocks per sector** (prevent concentration)
- **Max 30% of portfolio in any single sector** (even if only 2 stocks — prevents price-appreciation concentration)

---

## BUY STRATEGY: Pyramid Up

### Entry conditions (ALL must be true):
1. Stock on watchlist ≥ cooling period (14 days for Screener 3, 20 for Screener 2, 30 for Screener 1/4)
2. Currently passes 2+ screeners
3. RSI(14) < 45
4. Price hasn't run up >20% since found
5. Portfolio < 8 stocks
6. < 2 stocks in same sector
7. Cash available
8. **Nifty 50 above its 200DMA** (if below → half-sized starters only)
9. **Stock's 50DMA > 200DMA** (golden cross — exception: Screener 1+3 + RSI<30 can bypass this)
10. **Stock's 6M return > Nifty 50's 6M return** (relative strength — must outperform market)

### Position building (3 stages):
```
Starter:  50% of allocation — when BUY signal fires
Add #1:   25% of allocation — stock up +12-25%, still in 2+ screeners, ≥2 weeks after starter, above 200DMA
Add #2:   25% of allocation — stock up +30%+, still in 2+ screeners, ≥2 weeks after Add #1, above 200DMA
```

Only add more if stock goes UP (proving thesis). Never average down blindly.

### One dip buy exception (strict conditions):
If stock drops -10% to -20% BUT still passes **Screener 1 + 3** (highest conviction overlap only) AND RSI < 30 AND **price still above 200DMA**:
- ONE dip buy allowed (25% of allocation)
- Max one dip buy per stock ever
- Hard stop at -30% from original entry
- If price is below 200DMA → NO dip buy (trend reversal, not temporary dip)
- Dip buy restricted to Screener 1+3 overlap only (not any 2+ screener overlap)

### Per-stock sizing:
| Conviction | Max Allocation | Starter | Add #1 | Add #2 |
|---|---|---|---|---|
| High (3+ screeners) | 15% of budget | 7.5% | 3.75% | 3.75% |
| Medium (2 screeners) | 10% of budget | 5% | 2.5% | 2.5% |
| Compounder (Screener 4) | 12% of budget | 6% | 3% | 3% |

---

## SELL STRATEGY: Trailing Stop + Fundamentals

### Trailing stop-loss (moves up with price, never down):
| Stock gain | Trailing stop |
|---|---|
| 0-20% | -25% from entry price |
| 20-50% | -20% from highest price |
| 50-100% | -15% from highest price |
| 100%+ | -12% from highest price |

### Compounder trailing stop (3-tier — v3):
| Compounder gain | Trailing stop |
|---|---|
| Below +40% | No trailing stop — hold through volatility |
| +40% to +99% | -25% from peak |
| +100% to +199% | -20% from peak |
| +200%+ | -15% from peak |

### Hard exits (sell within 1 week, overrides everything):
| # | Trigger | Detection | Why |
|---|---|---|---|
| 1 | Promoter holding < 35% | Automated | Lost skin in the game |
| 2 | Promoter pledge > 30% | Automated | Pledge crisis risk |
| 3 | Promoter pledge increased >2% in single quarter | Automated | Smoke before fire — liquidity crisis building |
| 4 | Debt/Equity > 1.5 | Automated | Overleveraged |
| 5 | Interest Coverage < 1.5 | Automated | Can't service debt — default risk |
| 6 | Piotroski Score ≤ 2 | Automated | Fundamentally broken |
| 7 | Stock delisted/suspended | Automated | Obvious |
| 8 | P&L < -30% from entry | Automated | Hard stop, cut losses |
| 9 | Auditor resigned mid-term | Manual (weekly check) | #1 fraud predictor in India (Satyam, IL&FS, DHFL) |
| 10 | SEBI investigation announced | Manual (weekly check) | Regulatory risk — exit before facts emerge |
| 11 | Credit rating downgrade (below A) | Manual (weekly check) | Debt default risk rising |
| 12 | Related party transactions spike >25% of revenue | Automated | Promoter siphoning money |

Note: Triggers 9-11 require weekly manual check of NSE/BSE announcements (~10 minutes for 5-8 stocks).

### Soft exits (review within 1 month):
| # | Trigger | Why |
|---|---|---|
| 1 | Fails ALL 4 screeners | No quality bar met |
| 2 | Was in 3+ screeners, now 1 | Major deterioration |
| 3 | Promoter decreased >3% QoQ | Losing confidence |
| 4 | FII + MF both reduced QoQ | Institutions exiting |
| 5 | Revenue negative 2 consecutive Qs | Business declining |
| 6 | Better stock found + portfolio full | Upgrade quality |
| 7 | Inventory jumped >40% YoY without matching revenue growth | Channel stuffing / demand issue |
| 8 | Receivables jumped >50% YoY without matching revenue growth | Revenue recognition manipulation |
| 9 | Receivable days > 120 | Cash not being collected — governance red flag |
| 10 | Promoter salary > 5% of net profits | Excessive self-compensation |

### Tax-aware selling:
- STCG (<1 year): 20% tax — avoid if possible
- LTCG (>1 year): 12.5% above ₹1.25L — preferred
- GAS calculates holding period and advises in exit emails

---

## EMERGENCY RULES

| Trigger | Action |
|---|---|
| Total portfolio -25% from peak | Freeze all new buys |
| Nifty -20% in 1 month | Review all positions |
| 3+ stocks hit hard exit simultaneously | Exit all stock picks (systemic risk) |

---

## SIGNAL PRIORITY

```
1. HARD EXIT (always wins)
2. TRAILING STOP (protect gains)
3. SOFT EXIT + near LTCG (wait for tax benefit)
4. ADD signal (pyramid up on winners)
5. BUY signal (new starter position)
```

---

## RSI FOR ENTRY TIMING

RSI(14) calculated from 30-day GOOGLEFINANCE closing prices.
- RSI < 30: Oversold → good entry
- RSI 30-45: Acceptable range for entry
- RSI > 45: Wait for pullback

RSI is NOT a screener filter — only used for timing after screener approval.

---

## EVOLUTION HISTORY

### v1 → v2 (first validation, rated 7.5-8.5/10):
1. Liquidity filter added (6M Volume > 50K + ₹5Cr daily value)
2. 200DMA filter added to all screeners
3. CFO > Net Profit added to Screeners 1, 2, 4 (Indian fraud detection)
4. PE tightened to 35 + PEG < 1.5 added
5. Trailing stops widened from -15%/-12%/-10% to -25%/-20%/-15%/-12%
6. Sector cap (max 2 per sector)
7. Market trend filter (Nifty 200DMA)
8. Compounder trailing stop (25% after +40%)
9. Screener 3 loosened (promoter change 0.25% from 1%)
10. 4 new hard exit triggers (auditor, SEBI, credit, related party)
11. 2 new soft exit triggers (inventory spike, receivables spike)
12. Cooling periods per screener (14/20/30 days)
13. Dip buy requires 200DMA

### v2 → v2.1 (second validation, rated 8.6-9.2/10):
1. **Golden cross filter** (50DMA > 200DMA) added as BUY entry condition
2. **Compounder stop tiered**: 25% at +40%, tightens to 20% at +100%
3. **Pledge trend exit**: increase >2%/quarter = hard exit
4. **Interest coverage < 1.5** = hard exit
5. **Dip buy restricted** to Screener 1+3 overlap only
6. **Near-miss logging**: GAS logs stocks passing all but 1 filter
7. **2 new soft exits**: receivable days > 120, promoter salary > 5%
8. **Event exits clarified**: auditor/SEBI/credit marked as manual weekly check

### v2.1 → v3 (third validation, rated 9.1/10):
1. **Golden cross exception**: Bypassed for Screener 1+3 + RSI<30 (catches early breakouts like Dixon, Tata Elxsi)
2. **Relative strength filter**: Stock's 6M return must beat Nifty 50's 6M return (simplified from "top 30% ranking")
3. **Compounder 3rd tier**: -15% trailing stop at +200% gain (protects mega-compounders)
4. **Sector % cap**: Max 30% of portfolio in any single sector (prevents price-appreciation concentration)

### v3 — Rejected recommendations (with reasoning):
| Recommendation | Source | Why rejected |
|---|---|---|
| Equity Curve Circuit Breaker (-10%/month → sell weakest 2, move to 40% cash) | V3 Validator 1 | 10% drops are normal noise for Indian smallcaps; contradicts "never sell just because" rule; existing -25% freeze already covers genuine crashes |
| Loosen pledge threshold from >2% to >3% per quarter | V3 Validator 2 | Quality companies rarely pledge >2% in one quarter legitimately; start conservative, loosen with real data later |
| Remove OPM > 12% from Screener 1 | V3 Validator 2 | OPM catches margin quality in leveraged companies that ROE+ROCE alone miss; keeps it as independent check |

---

## PLEASE VALIDATE v3:

1. **Golden cross exception for Screener 1+3 + RSI<30**: Does this exception make sense? Could it lead to buying too early in a declining stock where fundamentals look good but price trend hasn't confirmed?

2. **Relative strength (6M return > Nifty)**: Is 6 months the right lookback? Would 3 months or 12 months be better for Indian small/midcaps? Could this filter have rejected stocks like Dixon Technologies early in their run when they were still building momentum?

3. **3-tier compounder stop (+40%→25%, +100%→20%, +200%→15%)**: Is 15% tight enough at +200%? For a true compounder like Astral or PI Industries that goes +500%, should there be a 4th tier?

4. **Sector 30% cap via quarterly rebalance**: Is quarterly frequent enough? If both stocks in a hot sector rally 40% between rebalances, you could temporarily be at 35%+ in one sector. Should this be monthly?

5. **10 BUY conditions**: Is the system now too selective? In a typical Indian market year, how many stocks would realistically pass all 10 conditions? Could this result in the system never firing a BUY signal?

6. **Rejected: Equity curve breaker (-10%/month)**: Was I right to reject this? Or is there a modified version (say -15% or -20%/month) that would add value without over-triggering?

7. **Rejected: Loosening pledge to >3%**: Was I right to keep >2%? Can you think of real Indian companies where a legitimate >2% quarterly pledge increase happened for expansion (not distress)?

8. **12 hard exits + 10 soft exits**: Now that we have 3 rounds of validation, is the exit framework complete? What's the ONE exit trigger that's still missing?

9. **System as a whole — production readiness**: This system will be automated via Google Apps Script. The user only buys/sells manually and does a 10-min weekly check. Is this production-ready for a retail investor with ₹3-10L stock budget?

10. **Backtest thought experiment**: If you mentally backtest this system against Indian markets from 2020-2025 (COVID crash → recovery → 2024 bull run → 2025 correction), where would it have performed well and where would it have struggled?

11. **Final rating**: On a scale of 1-10, rate this v3 system. What ONE change would make it a 10?

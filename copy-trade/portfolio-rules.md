# Portfolio Rules & Automated Signals (v3.1 — FINAL after 4 validations)

> v1→v2→v2.1→v3→v3.1. Four rounds of validation by ChatGPT + Gemini.
> v3.1 changes: monthly sector alert, KMP soft exit, lower circuit execution tip.
> v3 changes: golden cross exception for 1+3, compounder 3rd tier, sector % cap, relative strength filter.

## Core Philosophy

**Add to winners. Cut losers. Let fundamentals decide, not emotions.**

```
❌ Averaging down (Martingale): Buy ₹500 → drops ₹400 → buy more → drops ₹300 → trapped
✅ Pyramid up: Buy ₹500 → rises ₹550 (thesis working) → add more → ₹600 → add more → wealth
✅ Cut losses: Buy ₹500 → drops ₹400 → fundamentals broke → EXIT → save capital for next winner
```

---

## Stock Lifecycle (fully automated by GAS)

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATED PIPELINE                        │
│                                                             │
│  DISCOVERY (Daily)                                          │
│  └── Stock appears in screener alert email                  │
│      └── GAS adds to Screener_Watchlist                     │
│          Status = "NEW"                                     │
│                                                             │
│  WATCHLIST (30-day cooling period)                          │
│  └── Daily: re-check screeners, RSI, price                 │
│                                                             │
│  🟢 BUY SIGNAL → Starter position (50% of allocation)      │
│  └── You buy manually on Zerodha/Groww                      │
│                                                             │
│  📈 ADD SIGNAL → Stock rising + fundamentals strong         │
│  └── Add 25% more (pyramid up on winners)                   │
│                                                             │
│  📈 ADD SIGNAL → Still rising + screeners intact            │
│  └── Add final 25% (full position)                          │
│                                                             │
│  🟡 TRAILING STOP triggered → price dropped from peak       │
│  └── Sell to protect gains                                  │
│                                                             │
│  🔴 HARD EXIT → fundamentals broke                          │
│  └── Sell everything immediately                            │
│                                                             │
│  HISTORY → full P&L record saved                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Allocation

**Stocks have a separate dedicated budget — independent from MF SIP.**

```
MF SIP Portfolio (separate, managed via Capital Friends app)
  └── Nifty 50 + Midcap 150 index funds — SIP as usual

Stock Budget (separate pot, you decide the amount)
  ├── 60% — Stock picks (Screener 1+2+3 overlap) — 3-5 stocks
  ├── 25% — Compounders (Screener 4) — 2-3 stocks
  └── 15% — Cash reserve (Overnight Fund)
              └── For adding to winners + new BUY signals
              └── Instant redemption (T+0) same day
```

| % of Stock Budget | Type | Source | Max Stocks |
|---|---|---|---|
| 60% | Stock picks | Screener 1+2+3 overlap | 3-5 |
| 25% | Compounders | Screener 4 | 2-3 |
| 15% | Cash reserve | Overnight Fund (instant redemption) | — |

**Total individual stocks: Max 5-8**
**Max per stock: 15% of stock budget (fully built position)**
**Max per sector: 2 stocks** (prevent concentration — chemicals, IT, pharma etc.)

### Sector Cap Rule (UPDATED v3)
- Maximum **2 stocks** from the same sector in portfolio at any time
- Maximum **30% of portfolio** in any single sector (even if only 2 stocks)
- If BUY signal fires for a 3rd stock in same sector → skip or replace weakest
- If sector grows beyond 30% due to price appreciation → trim in quarterly rebalance
- Sectors defined by BSE/NSE classification (not sub-industries)
- **Why**: Max 2 stocks alone doesn't prevent concentration — if both stocks grow to 15% each, that's 30% in one sector. V3 Validator 2 flagged this as the remaining blind spot. During 2023 chemicals crash, even 2 chemical stocks falling together would hurt badly at 30% exposure.

### Why 15% Cash Reserve (not 5%)
- You need cash to ADD to winners (pyramid up)
- You need cash for new BUY signals
- 5% was too tight — with 15% you can handle 2-3 add signals without selling anything
- Parked in overnight fund earning ~6% (HDFC/ICICI Pru/SBI Overnight Fund, 0.08-0.10% expense)

---

## Entry Rules — Pyramid Buy Strategy

### How it works

You don't invest the full amount on day 1. You build the position in 3 stages — **only adding more if the stock proves you right.**

```
Stage 1: STARTER — 50% of allocation (when BUY signal fires)
Stage 2: ADD #1  — 25% of allocation (stock up +12% + still in screeners)
Stage 3: ADD #2  — 25% of allocation (stock up +30%+ + still in screeners)

Total: 100% of allocation — but only if stock EARNED your full conviction
```

**Changes from v1**: Pyramid triggers widened from +8%/+20% to +12%/+30%. Both validators said +8% is within normal daily volatility for Indian smallcaps — too tight, triggers too early before trend is confirmed.

### Why this beats Martingale

| | Martingale (average down) | Pyramid (average up) |
|---|---|---|
| Where most money goes | Into losing positions | Into winning positions |
| If stock keeps falling | You're trapped with huge loss | You only lost starter (50%) |
| If stock keeps rising | You only have starter amount | You have full position riding up |
| Psychology | Stressful, hoping for recovery | Confident, stock proving thesis |
| What pros do | Never | Always |

### Per-Stock Allocation Limits

| Conviction | Max Allocation | Starter (50%) | Add #1 (25%) | Add #2 (25%) |
|---|---|---|---|---|
| **High** (3+ screeners) | 15% of budget | 7.5% | 3.75% | 3.75% |
| **Medium** (2 screeners) | 10% of budget | 5% | 2.5% | 2.5% |
| **Compounder** (Screener 4) | 12% of budget | 6% | 3% | 3% |

### Example: ₹3L Stock Budget, High Conviction Stock

```
BUY SIGNAL: KPIT @ ₹500

Starter: 7.5% of ₹3L = ₹22,500 → 45 shares @ ₹500
  └── Now wait. Let the stock prove itself.

3 weeks later, KPIT @ ₹565 (+13%), still in 3 screeners:
Add #1: ₹11,250 → 19 shares @ ₹565
  └── Total: 64 shares, avg ₹527

6 weeks later, KPIT @ ₹660 (+32%), still in 3 screeners:
Add #2: ₹11,250 → 17 shares @ ₹660
  └── Total: 81 shares, avg ₹556, invested ₹45,000

If KPIT goes to ₹850 → P&L = +53% on full ₹45K = ₹23,850 profit
```

### What if stock drops after Starter?

```
BUY SIGNAL: Stock X @ ₹500

Starter: ₹22,500 → 45 shares @ ₹500

1 week later, drops to ₹470 (-6%):
  → DO NOTHING. Don't add. Wait.

2 weeks later, drops to ₹440 (-12%):
  → Check: still in 2+ screeners?
    YES + RSI < 30 → ONE dip buy allowed: ₹11,250 @ ₹440 (25 shares)
    NO (fell out of screeners) → DO NOTHING. Hold starter only.

Drops to ₹350 (-30%):
  → HARD STOP: Sell everything. You were wrong. Save capital.
  → Loss: ₹6,750 on starter (manageable, not catastrophic)
```

### Key Rule: Only ONE Dip Buy Allowed (tightened further in v2.1)

If stock drops AND still passes **Screener 1 + 3** (highest conviction overlap) AND RSI < 30 AND price above 200DMA:
- You can do ONE add at the dip (25% of allocation)
- This is NOT averaging down blindly — it's buying a confirmed dip in a fundamentally strong stock with insider buying
- Max one dip buy per stock, ever
- If it drops further after dip buy → hard stop at -30% from original entry
- **200DMA requirement** (v2): If price is below 200DMA, the dip is likely a trend reversal, not a temporary dip. Do NOT buy.
- **Restricted to Screener 1+3 overlap only** (NEW v2.1): V2 Validator 2 recommended dip buys only for highest conviction signals. Growth DNA + promoter buying = strongest thesis.

**Validator notes**: V2 Validator 1 said remove dip buy entirely for a 9/10 rating. V2 Validator 2 said keep it but only for Screener 1+3 overlap. We kept it restricted to 1+3 only — if you're uncomfortable, skip dip buys entirely and only pyramid up.

---

## Stage 1: Discovery → Watchlist (automatic, no action needed)

Stock enters watchlist when it appears in ANY Trendlyne screener alert.
GAS records: date found, price, which screeners pass, conviction level.

## Stage 2: Watchlist → BUY Signal (automated check, daily)

**ALL conditions must be true** to trigger a BUY email:

| # | Condition | Why | Change |
|---|---|---|---|
| 1 | On watchlist **≥ cooling period** | Avoid FOMO (14/20/30 days per screener) | CHANGED v2 |
| 2 | Currently passes **2+ screeners** | Single screener = not enough | |
| 3 | RSI(14) **< 45** | Don't buy at overbought levels | |
| 4 | Price change since found **< 20%** | If up 20%+, missed the entry | |
| 5 | Portfolio **< 8 stocks** total | Hard cap | |
| 6 | **< 2 stocks** in same sector | Sector cap (NEW v2) | NEW v2 |
| 7 | Stock budget **has room** for new position | Cash available | |
| 8 | **Nifty above 200DMA** | Market trend filter (NEW v2) | NEW v2 |
| 9 | Stock **50DMA > 200DMA** | Golden cross — confirms momentum (exception: Screener 1+3 + RSI<30) | UPDATED v3 |
| 10 | Stock **6M return > Nifty 6M return** | Relative strength — must outperform market | NEW v3 |

### Cooling Period Per Screener (CHANGED v2)
| Screener | Cooling Period | Why |
|---|---|---|
| Screener 3 (Insider Buying) | 14 days | Promoter buying is time-sensitive |
| Screener 2 (Smart Money) | 20 days | Institutional flows lag by weeks |
| Screener 1 (Multibagger DNA) | 30 days | Fundamentals don't change fast |
| Screener 4 (Compounder) | 30 days | Long-term holds, no rush |

A stock's cooling period = the shortest cooling period of the screeners it passes. E.g., if a stock passes Screener 1 (30d) + Screener 3 (14d), cooling period = 14 days.

### Market Trend Filter (UPDATED v2.1)
- **Nifty 50 must be above its 200DMA** for full capital deployment
- If Nifty below 200DMA → only deploy 50% of normal allocation (half-sized starters)
- **Why**: Buying smallcaps when the broader market is in a downtrend is fighting the tide.
- **Validator split**: V2 Validator 1 said freeze ALL buys below 200DMA. V2 Validator 2 said half-sized is smart because best opportunities (Tata Elxsi, Dixon in 2020) appear during corrections. We keep half-sized as the default — catches early recoveries while limiting risk.

### Stock Trend Filter (UPDATED v3)
- Individual stock must have **50DMA > 200DMA** (golden cross) for BUY signal
- **Exception** (NEW v3): Golden cross NOT required if stock passes **Screener 1 + 3** AND **RSI < 30**. This catches early-stage turnaround stories (Dixon, Tata Elxsi type) where fundamentals are strong and promoter is buying, but the golden cross hasn't formed yet.
- **Why**: V2.1 Validator 2 correctly flagged that requiring golden cross misses early breakouts. The exception is restricted to highest-conviction signals only.
- GAS checks this via GOOGLEFINANCE — no Trendlyne param needed.

### Relative Strength Filter (NEW v3)
- Stock's **6-month return must beat Nifty 50's 6-month return**
- Simple binary check: is stock outperforming the market? If not, skip.
- **Why**: V3 Validator 2 recommended this as the "10/10 change". Most multibaggers show relative strength before big moves. If a stock passes all screeners but is underperforming Nifty, the market is telling you something.
- **Note**: We simplified from "top 30% ranking" (too complex for GAS) to a binary "beat Nifty" check. Same spirit, much easier to automate.

### BUY Signal Email (Starter Position)
```
🟢 BUY SIGNAL: KPIT Technologies — STARTER POSITION

✅ On watchlist 45 days (since 2026-02-01)
✅ Passes 3 screeners: Multibagger + SmartMoney + Insider
✅ RSI(14) = 32 (near oversold — good entry)
✅ Price: ₹500 (up 8% from ₹463 when found)
✅ Budget has room: 4/8 stocks, ₹1.2L cash available

Conviction: HIGH (3 screeners)
Max allocation: 15% = ₹45,000

📍 BUY STARTER: 50% = ₹22,500 (45 shares @ ~₹500)
   Remaining ₹22,500 reserved for Add #1 and Add #2

Fundamentals:
  PE: 32 | ROE: 22% | D/E: 0.1 | Piotroski: 7
  Sales 3Y: 28% | Profit 3Y: 35% | OCF 3Y: 24%
  Promoter: 62% (pledge: 0%)
  FII QoQ: +1.2% | MF QoQ: +0.8%

Action: Buy 45 shares on Zerodha/Groww
```

## Stage 3: ADD Signals (Pyramid Up)

GAS monitors daily and sends ADD emails when conditions are met:

### Add #1 Trigger (25% of allocation)
| Condition | Value |
|---|---|
| Price up from starter | **+12% to +25%** |
| Still passes | **2+ screeners** |
| Time since starter | **≥ 2 weeks** |
| Price above 200DMA | ✅ |
| No hard exit triggers | ✅ |

```
📈 ADD #1: KPIT Technologies — THESIS CONFIRMED

Price: ₹565 (+13% from ₹500 entry)
Still in: Multibagger ✅ SmartMoney ✅ Insider ✅

📍 ADD 25%: ₹11,250 (19 shares @ ~₹565)
   New total: 64 shares | Avg price: ₹527
   Remaining: ₹11,250 for Add #2
```

### Add #2 Trigger (final 25%)
| Condition | Value |
|---|---|
| Price up from starter | **+30% or more** |
| Still passes | **2+ screeners** |
| Time since Add #1 | **≥ 2 weeks** |
| Price above 200DMA | ✅ |
| No hard exit triggers | ✅ |

```
📈 ADD #2: KPIT Technologies — FULL POSITION

Price: ₹660 (+32% from ₹500 entry)
Still in: Multibagger ✅ SmartMoney ✅ Insider ✅

📍 ADD FINAL 25%: ₹11,250 (17 shares @ ~₹660)
   Full position: 81 shares | Avg price: ₹556 | Total invested: ₹45,000
   🎯 Position fully built. Now hold and let it compound.
```

### Dip Buy Trigger (only ONE allowed, 25% of allocation)
| Condition | Value |
|---|---|
| Price down from entry | **-10% to -20%** |
| Still passes | **Screener 1 + 3** (highest conviction only — v2.1) |
| RSI(14) | **< 30** (genuinely oversold) |
| Price above 200DMA | ✅ (v2 — no buying below trend) |
| No hard exit triggers | ✅ |
| Previous dip buys | **0** (first and only) |

```
📉 DIP BUY: KPIT Technologies — FUNDAMENTALS INTACT

Price: ₹440 (-12% from ₹500 entry)
Still in: Multibagger ✅ SmartMoney ✅ (fundamentals unchanged)
RSI: 24 (oversold)

📍 DIP BUY 25%: ₹11,250 (25 shares @ ~₹440)
   New total: 70 shares | Avg price: ₹482
   ⚠️ Hard stop if drops to ₹350 (-30% from entry). No more dip buys.
```

---

## Sell Rules — Trailing Stop + Fundamentals

### Trailing Stop-Loss (automated, protects gains)

Once a stock is up significantly, GAS sets a **trailing stop** that moves up with price but never down:

| Stock is up | Trailing stop | What it means | Change |
|---|---|---|---|
| 0-20% | -25% from entry | Wide buffer for Indian smallcap volatility | Loosened from -15% |
| 20-50% | -20% from highest price | Lock in some gains, still room to breathe | Loosened from -15% |
| 50-100% | -15% from highest price | Tighter — protect bigger gains | Loosened from -12% |
| 100%+ | -12% from highest price | Tightest — you've doubled, protect it | Loosened from -10% |

**Changes from v1**: Both validators said the original stops (-15%/-15%/-12%/-10%) were too tight for Indian smallcaps, which regularly swing 20-30% on quarterly results or market sentiment. Tight stops = getting stopped out during normal volatility, then watching the stock recover without you. Widened to -25%/-20%/-15%/-12%.

**Example:**
```
Buy @ ₹500
Rises to ₹750 (+50%) → trailing stop = ₹750 × 0.85 = ₹638
Rises to ₹900 (+80%) → trailing stop = ₹900 × 0.85 = ₹765
Drops to ₹800 → stop stays at ₹765 (never goes down)
Drops to ₹760 → 🟡 TRAILING STOP TRIGGERED → sell

Result: Bought at ₹500, sold at ₹760 = +52% profit (not the full +80%, but protected)
```

### Trailing Stop Email
```
🟡 TRAILING STOP: KPIT Technologies

Price hit ₹760 — trailing stop was ₹765

  Entry: ₹500 | Peak: ₹900 | Current: ₹760
  P&L: +52% (₹26,000 profit on ₹50,000 invested)
  Holding: 14 months (LTCG eligible ✅)

Recommendation: SELL — price dropping from peak, lock in +52% gains
If fundamentals still strong, you can re-enter after it stabilizes

Action: Sell on Zerodha/Groww
```

### Compounder Exception (UPDATED v3)
**Screener 4 (Compounder) stocks: tiered trailing stop after +40% gain.**

| Compounder gain | Trailing stop | Min locked-in gain | Change |
|---|---|---|---|
| Below +40% | No trailing stop | — (only hard exits) | |
| +40% to +99% | -25% from peak | +5% minimum | v2.1 |
| +100% to +199% | -20% from peak | +60% minimum | v2.1 |
| +200%+ | -15% from peak | +155% minimum | NEW v3 |

- Only sell on hard exit triggers OR if trailing stop hit after +40%
- **Why 3rd tier** (NEW v3): V3 Validator 2 recommended this. If a compounder triples (+200%), a 15% trailing stop still locks in +155% gain. Losing 15% of a 3x position is more painful than 20% of a 2x position — tighter stop is warranted for mega-compounders.

---

## 🔴 Hard Exits — Sell Everything Within 1 Week

**Immediate email** if ANY trigger. These override trailing stop and everything else.

| # | Trigger | Check | Why | Change |
|---|---|---|---|---|
| 1 | Promoter holding **< 35%** | Quarterly | Lost skin in the game | |
| 2 | Promoter pledge **> 30%** | Quarterly | Pledge crisis = forced selling | |
| 3 | Promoter pledge **increased >2%** in single quarter | Quarterly | Smoke before fire — liquidity crisis building | NEW v2.1 |
| 4 | Debt/Equity **> 1.5** | Quarterly | Overleveraged | |
| 5 | **Interest Coverage < 1.5** | Quarterly | Can't service debt — default risk | NEW v2.1 |
| 6 | Piotroski Score **≤ 2** | Quarterly | Fundamentally broken | |
| 7 | Stock **delisted/suspended** | Daily | Obvious | |
| 8 | P&L **< -30%** from entry | Daily | Hard stop — cut loss, save capital | |
| 9 | **Auditor resigned** mid-term | Event (manual) | #1 red flag in Indian markets (Satyam, IL&FS) | NEW v2 |
| 10 | **SEBI investigation** announced | Event (manual) | Regulatory risk — freeze before facts emerge | NEW v2 |
| 11 | **Credit rating downgrade** (below A) | Event (manual) | Debt default risk rising | NEW v2 |
| 12 | **Related party transactions** spike >25% of revenue | Quarterly | Promoter siphoning money (common fraud pattern) | NEW v2 |

### Automated vs Manual Hard Exit Checks

| Type | Triggers | How GAS detects |
|---|---|---|
| **Automated** (GAS checks daily/quarterly) | #1-8, #12 | Screener.in scraping, GOOGLEFINANCE, BSE API |
| **Manual** (you check weekly for 5-8 stocks) | #9-11 | NSE/BSE corporate announcements, Screener.in "Feed" section |

**V2.1 Validator reality check**: GAS cannot reliably detect auditor resignations, SEBI investigations, or credit downgrades automatically. These require news/filing parsing that's fragile. Instead: **check NSE/BSE announcements + Screener.in feed once per week** for your 5-8 holdings. Takes 10 minutes.

**New v2.1 triggers**:
- **Promoter pledge INCREASE >2%/quarter** (V2 Validator 1): Rising pledges are the "smoke before fire" of a liquidity crisis. Even if absolute pledge is below 30%, a sudden increase signals trouble. This is the single change V2 Validator 1 said would push the system to 9.5+.
  - V3 Validator 2 suggested loosening to >3% to reduce false signals from legitimate expansion pledges. **We kept >2%** — in Indian markets, quality companies rarely pledge >2% in one quarter for legitimate reasons. Start conservative; loosen later if real data shows too many false exits.
- **Interest Coverage < 1.5** (V2 Validator 2): This often precedes defaults and is fully automatable from Screener.in data. More reliable than waiting for a credit downgrade.
  - V3 Validator 2 confirmed this won't cause false exits for asset-light companies (IT/services) because they have almost no debt → interest coverage >> 10.

```
🔴 HARD EXIT: Zee Entertainment

Trigger: Promoter pledge jumped to 45% (was 8%)

  P&L: -12% (₹250 → ₹220) | Holding: 6 months
  Screeners: 0/4 (was 2/4)

⚠️ SELL EVERYTHING WITHIN 1 WEEK
Pledge crisis is #1 predictor of small/midcap crashes.

Action: Sell all shares on Zerodha/Groww
```

---

## 🟡 Soft Exits — Review Within 1 Month

**Review email** if ANY trigger:

| # | Trigger | Check | Why | Change |
|---|---|---|---|---|
| 1 | Fails **ALL 4 screeners** | Weekly | No quality bar met | |
| 2 | Was in **3+ screeners, now only 1** | Weekly | Significant deterioration | |
| 3 | Promoter holding **decreased >3%** QoQ | Quarterly | Promoter losing confidence | |
| 4 | FII + MF **both reduced** QoQ | Quarterly | Institutions exiting | |
| 5 | Revenue growth **negative 2 consecutive Qs** | Quarterly | Business declining | |
| 6 | **Better stock** found + portfolio full (8) | Weekly | Upgrade portfolio quality | |
| 7 | **Inventory** jumped **>40% YoY** without matching revenue growth | Quarterly | Channel stuffing / demand issue | NEW v2 |
| 8 | **Receivables** jumped **>50% YoY** without matching revenue growth | Quarterly | Revenue recognition manipulation | NEW v2 |
| 9 | **Receivable days > 120** | Quarterly | Cash not being collected — governance red flag | NEW v2.1 |
| 10 | **Promoter salary > 5%** of net profits | Annual | Excessive self-compensation — promoter milking company | NEW v2.1 |
| 11 | **Key person (Founder/CEO) exit** — resignation, death, or health issue | Event (manual) | Small/midcaps are often founder-driven — loss of key person can re-rate stock 30% overnight | NEW v3.1 |

**New soft triggers from v2/v2.1/v3.1**:
- **Inventory spike** (v2): If inventory grows 40%+ but revenue didn't grow proportionally, the company is either stuffing channels or demand is dying. Classic early warning (caught issues at PC Jeweller, KRBL before crashes).
- **Receivables spike** (v2): Revenue booked but cash not collected = possible fictitious revenue. CFO > Net Profit filter catches some of this, but receivables spike is an earlier signal.
- **Receivable days > 120** (v2.1): V2 Validator 2 flagged this as a governance filter. If a company takes >4 months to collect payment, either customers aren't real or the business has no pricing power. Automatable from Screener.in.
- **Promoter salary > 5%** (v2.1): V2 Validator 2 flagged this. Promoters taking excessive compensation = siphoning profits. Check annual report once per year for your 5-8 holdings.
- **Key person exit** (v3.1): V4 Validator 2 flagged this as the missing exit trigger. Indian small/midcaps (Page Industries, Astral, Divi's Labs) are often built around a single founder/promoter. If the founder dies, resigns, or has serious health issues, the stock can drop 30% before you react. Soft exit (not hard) because sometimes a competent successor is already in place (e.g., Infosys post-Murthy). Review within 1 month — don't panic-sell.

```
🟡 SOFT EXIT: Man Infraconstruction

Trigger: Passes 1/4 screeners (was 3/4 when bought)

  ❌ Multibagger: Sales growth fell to 12% (need >20%)
  ❌ SmartMoney: FII reduced by 2% QoQ
  ✅ Insider: Promoter still buying +0.5% QoQ
  ❌ Compounder: Never qualified

  P&L: +22% | Holding: 8 months

Options:
  A) Hold 4 more months for LTCG tax (>1yr saves 7.5%)
  B) Sell now, redeploy to higher-conviction stock
  C) Sell half, keep half

⏰ Decide within 1 month.
```

### Tax-Aware Exit Logic (automated in email)

| Holding | Tax | GAS says |
|---|---|---|
| < 10 months | STCG 20% | "Consider waiting for 1 year unless hard exit" |
| 10-12 months | STCG 20% | "Only X months to LTCG — hold if soft exit" |
| > 12 months | LTCG 12.5% (above ₹1.25L) | "LTCG eligible — sell if needed" |

---

## Portfolio Rebalancing

### Monthly Sector Alert (NEW v3.1)
- GAS sends a **monthly email** if any single sector exceeds **35%** of portfolio
- This is an early warning — no forced action, just awareness
- **Why**: V4 Validator 2 flagged that sectors (Defense, PSU in 2023-24) can go parabolic between quarterly checks. Monthly alerting catches this without forcing monthly selling (which has STCG tax implications).

### Quarterly Rebalance Email (full check)

| Check | Threshold | Action | Change |
|---|---|---|---|
| Any single stock > 20% of budget | Trim to 15% | "Stock X grew to 22% — trim" | |
| Any sector > 30% of budget | Trim to 30% | "Chemicals sector at 34% — trim weaker stock" | NEW v3 |
| Cash reserve < 5% | Flag | "Low cash — can't fund new buys or adds" | |
| Cash reserve > 30% | Flag | "Too much idle — look for opportunities" | |

---

## Emergency Rules (Automated)

| Trigger | Email | Action |
|---|---|---|
| Stock portfolio **-25%** from peak | 🔴 FREEZE | Stop all new buys + adds |
| Nifty **-20%** in 1 month | 🟡 CRASH ALERT | Review all positions |
| 3+ stocks hit hard exit same time | 🔴 SYSTEMIC | Exit all stock picks |

**Rejected: Equity Curve Circuit Breaker** (V3 Validator 1 suggested: -10%/month → sell weakest 2, move to 40% cash). We rejected this because:
- A 10% portfolio drop is *normal* for Indian smallcaps — quarterly results alone can swing 10-15%
- Selling weakest 2 positions during temporary volatility forces you to realize losses on potentially good stocks
- Contradicts our own "Never Sell Just Because" rule (price dropped 10-20% = normal)
- The existing -25% freeze rule already covers genuine crashes without over-reacting to noise

---

## Never Sell Just Because

- Price dropped 10-20% (normal volatility — trailing stop handles this)
- One bad quarter (wait for 2 consecutive)
- Market crash (if fundamentals unchanged → hold)
- Social media FUD (verify with data)
- Stock exits ONE screener (check if it still passes any)

---

## What You Do vs What GAS Does

| Action | GAS | You |
|---|---|---|
| Find stocks (screener) | ✅ | |
| Add to watchlist | ✅ | |
| Monitor daily | ✅ | |
| Send BUY/ADD/EXIT emails | ✅ | |
| Calculate trailing stops | ✅ | |
| Track pyramid levels | ✅ | |
| Buy the stock | | ✅ Zerodha/Groww |
| Record buy in sheet | | ✅ React app |
| Sell the stock | | ✅ Zerodha/Groww |
| Mark as sold | | ✅ React app |
| Quarterly review email | ✅ | |
| Tax timing advice | ✅ | |

**You only do 5 things manually:**
1. Buy when GAS says BUY/ADD
2. Sell when GAS says EXIT/TRAILING STOP
3. Record the transaction in React app
4. **Weekly 10-min check**: NSE/BSE announcements for your 5-8 stocks (auditor changes, SEBI orders, credit ratings, KMP changes) — GAS can't automate these reliably
5. Override if you have a strong reason (add notes)

### Execution Tip: Lower Circuit Stocks (NEW v3.1)
If a stock is hitting **lower circuits** (LC) and you need to exit:
- Place a **Pre-Market AMO** (After Market Order) at the lower circuit price on Zerodha/Groww
- Do this at night/early morning before 9:00 AM — to be first in the exit queue
- Check **delivery %** — if delivery % is dropping while price is falling + hitting LC, sellers are trapped and exit is urgent
- Your -30% hard stop will trigger the exit email, but *execution* depends on you placing the AMO quickly
- **This is an Indian small/midcap reality**: lower circuits can lock you in for days. Speed matters.

---

## Signal Priority

```
🔴 HARD EXIT always wins (sell regardless)
        ↓
🟡 TRAILING STOP hit → sell to protect gains
        ↓
🟡 SOFT EXIT + near LTCG = wait for tax benefit
        ↓
📈 ADD signal + cash available = add to winner
        ↓
🟢 BUY signal + portfolio has room = buy starter
        ↓
🟢 BUY + RSI > 45 = wait for better entry
```

---

## Summary: The Complete Strategy

```
1. FIND:    4 screeners running daily → stocks flow into watchlist
2. WAIT:    Cooling period (14-30 days per screener) → only buy after observation
3. CHECK:   Nifty above 200DMA? Golden cross? Relative strength? Sector cap OK?
4. BUY:     Starter position (50%) → let the stock prove itself
5. ADD:     Pyramid up on winners (+12%, +30%) → 25% each
6. PROTECT: Trailing stop moves up with price → locks in gains (-25%/-20%/-15%/-12%)
7. WATCH:   Weekly 10-min manual check (auditor, SEBI, credit, KMP for your 5-8 stocks)
8. EXIT:    Fundamentals break → hard exit | Trail stop hit → sell
9. REPEAT:  Freed capital goes to overnight fund → ready for next signal
```

**The key insight: You'll have some losers (cut at -30% with starter only = small loss) and some winners (rode up with full position + trailing stop = big gain). Over time, the winners overwhelm the losers. This is how every successful investor operates.**

---

## Key Changes in v2 (First Validation)

| Change | v1 | v2 | Why |
|---|---|---|---|
| Trailing stops | -15%/-15%/-12%/-10% | -25%/-20%/-15%/-12% | Indian smallcaps too volatile for tight stops |
| Pyramid triggers | +8%/+20% | +12%/+30% | +8% is within normal daily noise |
| Cooling period | 30 days (all) | 14/20/30 days (per screener) | Insider signals are time-sensitive |
| Sector cap | None | Max 2 per sector | Prevent concentration risk |
| Market trend | None | Nifty above 200DMA for full deployment | Don't fight the broader trend |
| Compounder stop | No stop at all | 25% trailing after +40% gain | Even compounders can crash 40% |
| Dip buy | No 200DMA check | Must be above 200DMA | Below 200DMA = trend reversal, not dip |
| Hard exits | 6 triggers | 10 triggers (+auditor, SEBI, credit, related party) | India-specific fraud/regulatory risks |
| Soft exits | 6 triggers | 8 triggers (+inventory spike, receivables spike) | Earlier warning signals for fraud |

## Key Changes in v2.1 (Second Validation)

| Change | v2 | v2.1 | Why |
|---|---|---|---|
| Stock trend filter | None | 50DMA > 200DMA (golden cross) | Confirms momentum, not just price above flat MA |
| Compounder stop | Flat 25% after +40% | Tiered: 25% at +40%, 20% at +100% | Protect bigger gains as they compound |
| Pledge trend exit | Only absolute >30% | Also: increase >2%/quarter | Rising pledges = smoke before fire |
| Interest coverage exit | None | < 1.5 = hard exit | Precedes defaults, fully automatable |
| Dip buy restriction | Any 2+ screener overlap | Only Screener 1+3 overlap | Highest conviction only for dip buys |
| Hard exits | 10 triggers | 12 triggers (+pledge trend, interest coverage) | More automatable fraud detection |
| Soft exits | 8 triggers | 10 triggers (+receivable days, promoter salary) | Governance quality checks |
| Event-based exits | Assumed GAS detects all | 3 exits marked as manual weekly check | GAS can't parse news/filings reliably |
| Near miss logging | None | GAS logs stocks that pass all but 1 filter | Avoid empty funnel in tight markets |

## Key Changes in v3 (Third/Final Validation)

| Change | v2.1 | v3 | Why |
|---|---|---|---|
| Golden cross exception | Required for all | Bypassed for Screener 1+3 + RSI<30 | Catches early breakouts (Dixon, Tata Elxsi type) |
| Relative strength | None | 6M return must beat Nifty | Confirms stock outperforming market |
| Compounder stop | 2 tiers (25%/20%) | 3 tiers (25%/20%/15% at +200%) | Protect mega-compounder gains |
| Sector exposure | Max 2 stocks only | Max 2 stocks AND max 30% of portfolio | Price appreciation can create sector concentration |
| Pledge threshold | >2%/quarter | Kept at >2% (V3 validator suggested >3%) | Conservative — quality companies rarely pledge >2% legitimately |
| Equity curve breaker | None | Rejected (V3 validator suggested -10%/month) | 10% drop is normal Indian smallcap volatility, would over-trigger |

## Key Changes in v3.1 (Fourth/Final Validation)

| Change | v3 | v3.1 | Why |
|---|---|---|---|
| Sector alerting | Quarterly rebalance only | Monthly 35% alert + quarterly full rebalance | Sectors can go parabolic between quarterly checks |
| KMP exit | Not tracked | Soft exit #11 — founder/CEO exit | Small/midcaps are founder-driven, loss re-rates stock 30% |
| Lower circuit | Not covered | Execution tip — AMO at LC price | Indian small/midcap reality, LC can trap you for days |
| Soft exits | 10 triggers | 11 triggers (+KMP change) | Key person risk was the missing governance trigger |

### Rejected Recommendations (with reasoning)

| Recommendation | Source | Why rejected |
|---|---|---|
| Equity Curve Circuit Breaker (-10%/month) | V3 Validator 1 | 10% drops are normal noise in Indian smallcaps, contradicts "never sell just because" |
| Loosen pledge threshold to >3% | V3 Validator 2 | >2% is already rare for quality companies — start conservative, loosen with data |
| Remove OPM > 12 from Screener 1 | V3 Validator 2 | OPM catches margin quality in leveraged companies that ROE alone misses |
| Volatility-adjusted position sizing (ATR) | V4 Validator 1 | Over-engineering for 5-8 stock portfolio — conviction-based sizing (15%/10%/12%) is sufficient |
| Lower circuit as formal rule | V4 Validator 2 | Execution detail, not strategy — kept as practical tip instead |

## Validator Ratings

| Version | Validator 1 | Validator 2 |
|---|---|---|
| v1 | 7.5-8/10 | 8-8.5/10 |
| v2 | 9.2/10 | 8.6/10 |
| v2.1 | — | 9.1/10 |
| v3 | — | 9.6/10 |

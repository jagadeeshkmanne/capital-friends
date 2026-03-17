# Screener Definitions (v3 — FINAL after 3 validations)

> Three rounds of validation by ChatGPT + Gemini. Screener params unchanged since v2.
> v2 changes: liquidity filter, cash flow quality, looser Screener 3, 200DMA filter.
> v2.1 changes: near-miss logging, golden cross entry filter (in portfolio-rules).
> v3 changes: golden cross exception for 1+3, relative strength filter, sector % cap (all in portfolio-rules).

## Global Filters (applied to ALL screeners)

These filters run on EVERY stock before screener-specific filters:

| # | Parameter | Condition | Value | Why |
|---|---|---|---|---|
| G1 | 6Month Volume Avg | > | 50,000 | Liquidity — avoid illiquid operator stocks |
| G2 | Price above 200D SMA | = | true | Only buy in uptrend — avoid falling knives |
| G3 | Mcap Classification | != | Micro Cap | Skip micro caps (< ₹500 Cr) — manipulation risk, low liquidity |

**Liquidity is the #1 missing filter flagged by both validators.** Without it, screeners can catch operator-manipulated penny stocks that you can't sell in a crash (lower circuit trap).

**200DMA ensures** you only buy stocks in an uptrend. Both validators recommended this — especially for dip buys.

> Note: GAS will also check avg daily traded value > ₹5 Cr (calculated from price × volume). This can't be a Trendlyne parameter directly, but GAS computes it.

---

## Screener 1: "CF-Multibagger-DNA" (Primary)

**Goal**: Find small/midcap stocks with high growth, low debt, strong promoter, quality fundamentals, real cash flows.

| # | Parameter | Condition | Value | Change |
|---|---|---|---|---|
| 1 | Sales growth 3Years | > | 20% | |
| 2 | Profit growth 3Years | > | 20% | |
| 3 | Return on equity | > | 18% | |
| 4 | Debt to equity | < | 0.5 | |
| 5 | Promoter holding | > | 50% | |
| 6 | Market Capitalization (Cr) | < | 15,000 | |
| 7 | Operating profit margin | > | 12% | |
| 8 | Price to Earning | < | 35 | Tightened from 40 |
| 9 | PEG TTM | < | 1.5 | NEW — catches overpriced growth |
| 10 | Piotroski Score | > | 6 | |
| 11 | Promoter holding pledge % | < | 10 | |
| 12 | Operating Cash Flow 3Yr Growth % | > | 10 | |
| 13 | Cash from Operating Activity Annual | > | Net Profit Annual | NEW — fraud detection |

**Trendlyne AI prompt**:
```
Find small and midcap stocks with market cap below 15000 crores AND market cap classification is not micro cap AND 3 year sales growth above 20% AND 3 year profit growth above 20% AND ROE above 18% AND debt to equity below 0.5 AND promoter holding above 50% AND operating profit margin above 12% AND PE ratio below 35 AND PEG TTM below 1.5 AND Piotroski score above 6 AND promoter pledge percentage below 10% AND operating cash flow 3 year growth above 10% AND cash from operating activity annual greater than net profit annual AND 6 month average volume above 50000 AND price above 200 day SMA
```

**Changes from v1**:
- **PE < 35** (was 40): Both validators said PE < 40 too loose for Indian smallcaps. Tightened.
- **PEG < 1.5**: Catches stocks that look cheap on PE but have no growth to justify it. PE alone misses this.
- **CFO > Net Profit**: THE most important fraud filter. In India, many midcaps show accounting profit but no cash (Vakrangee, Manpasand, DHFL). If operating cash flow < net profit, earnings are suspect.

---

## Screener 2: "CF-SmartMoney-Flow" (Institutional Conviction)

**Goal**: Find stocks where institutions are building positions with solid fundamentals.

| # | Parameter | Condition | Value | Change |
|---|---|---|---|---|
| 1 | Institutional holding current Qtr % | > | 10 | Changed from FII QoQ |
| 2 | MF holding change QoQ (%) | > | 0.5% | |
| 3 | Promoter holding (%) | > | 45% | |
| 4 | Return on equity (%) | > | 15% | |
| 5 | Debt to equity | < | 0.5 | |
| 6 | Sales growth 3Years (%) | > | 15% | |
| 7 | Profit growth 3Years (%) | > | 15% | |
| 8 | Institutional holding change 4Qtr % | > | 1 | |
| 9 | Promoter holding pledge % | < | 15 | |
| 10 | Piotroski Score | > | 5 | |
| 11 | Cash from Operating Activity Annual | > | Net Profit Annual | NEW |

**Trendlyne AI prompt**:
```
Find stocks where institutional holding current quarter is above 10% AND mutual fund holding increased by more than 0.5% QoQ AND institutional holding change over 4 quarters is above 1% AND promoter holding above 45% AND ROE above 15% AND debt to equity below 0.5 AND 3 year sales growth above 15% AND 3 year profit growth above 15% AND promoter pledge percentage below 15% AND Piotroski score above 5 AND cash from operating activity annual greater than net profit annual AND market cap classification is not micro cap AND 6 month average volume above 50000 AND price above 200 day SMA
```

**Changes from v1**:
- **Institutional holding > 10%** (was FII QoQ > 0.5%): Validator flagged that FII QoQ change is noisy. Total institutional holding > 10% is a better base signal.
- **Removed FII QoQ**: Replaced with institutional holding level. 4Qtr change still captures the trend.
- **Added CFO > Net Profit**: Cash flow quality check.

---

## Screener 3: "CF-Insider-Buying" (Timing)

**Goal**: Find stocks where promoters are actively buying — strongest legal insider signal.

| # | Parameter | Condition | Value | Change |
|---|---|---|---|---|
| 1 | Promoter holding quarterly change (%) | > | 0.25% | Loosened from 1% |
| 2 | Sales growth (%) | > | 15% | |
| 3 | Return on equity (%) | > | 12% | |
| 4 | Debt to equity | < | 0.7 | |
| 5 | Market Capitalization (Cr) | < | 20,000 | |
| 6 | Promoter holding pledge % | < | 5 | |
| 7 | Interest Coverage Ratio Annual | > | 3 | |
| 8 | SAST Buys Last Week | > | 0 | |

**Trendlyne AI prompt**:
```
Find stocks where promoter holding increased by more than 0.25% in the latest quarter AND sales growth above 15% AND ROE above 12% AND debt to equity below 0.7 AND market cap below 20000 crores AND market cap classification is not micro cap AND promoter pledge percentage below 5% AND interest coverage ratio above 3 AND SAST buys last week greater than 0 AND 6 month average volume above 50000 AND price above 200 day SMA
```

**Changes from v1**:
- **Promoter change > 0.25%** (was 1%): Validator correctly flagged that 1% increase is very rare in liquid companies. Most genuine promoter buying is 0.25-0.5% per quarter. 1% was filtering out almost everything.

---

## Screener 4: "CF-Compounder" (Defensive, Hold 5+ Years)

**Goal**: Find consistent compounders — buy and sleep for 5+ years. Highest quality bar.

| # | Parameter | Condition | Value | Change |
|---|---|---|---|---|
| 1 | Sales growth 5Years (%) | > | 12% | |
| 2 | Sales growth 3Years (%) | > | 12% | |
| 3 | Sales growth TTM (%) | > | 10% | |
| 4 | Profit growth 5Years (%) | > | 12% | |
| 5 | Return on equity 5Year avg (%) | > | 18% | |
| 6 | Debt to equity | < | 0.3 | |
| 7 | Promoter holding (%) | > | 55% | |
| 8 | Market Capitalization (Cr) | > | 5,000 | |
| 9 | Piotroski Score | > | 7 | |
| 10 | ROCE Annual 5Yr Avg % | > | 18 | |
| 11 | Operating Cash Flow 5Yr Growth % | > | 10 | |
| 12 | Altman Zscore | > | 3 | |
| 13 | Promoter holding pledge % | = | 0 | |
| 14 | Interest Coverage Ratio Annual | > | 5 | NEW |
| 15 | Cash from Operating Activity Annual | > | Net Profit Annual | NEW |

**Trendlyne AI prompt**:
```
Find stocks with 5 year sales growth above 12% AND 3 year sales growth above 12% AND TTM sales growth above 10% AND 5 year profit growth above 12% AND 5 year average ROE above 18% AND debt to equity below 0.3 AND promoter holding above 55% AND market cap above 5000 crores AND market cap classification is not micro cap AND Piotroski score above 7 AND 5 year average ROCE above 18% AND operating cash flow 5 year growth above 10% AND Altman Z-score above 3 AND promoter pledge percentage equals 0 AND interest coverage ratio above 5 AND cash from operating activity annual greater than net profit annual AND 6 month average volume above 50000 AND price above 200 day SMA
```

**Changes from v1**:
- **Interest Coverage > 5** (new): Compounders must have very comfortable debt servicing. Higher bar than Screener 3's >3.
- **CFO > Net Profit** (new): For a hold-forever stock, cash flow quality is non-negotiable.

---

## How Screeners Work Together

```
Screener 1 (Growth DNA)     Screener 2 (Institutional Flow)
         \                         /
          \                       /
           ▼                     ▼
         OVERLAP = HIGHEST CONVICTION
                    +
         Screener 3 (Promoter buying now?)
                    +
         RSI < 30 (good entry price?)
                    ▼
             *** BUY SIGNAL ***

Screener 4 = separate "safe" bucket (buy and hold forever)

⭐ STRONGEST SIGNAL: Screener 1 + 3 overlap
   (Growth DNA + Promoter buying = historically best alpha)
   Examples: Astral, PI Industries, APL Apollo, Deepak Nitrite
```

**A stock appearing in Screener 1 + 3 = highest alpha historically.**
**A stock in Screener 1 + 2 + 3 = strongest possible buy signal.**

## Trendlyne Screener Names (for saving)

| # | Save Name | Alert Frequency | Params | Cooling Period |
|---|---|---|---|---|
| 1 | CF-Multibagger-DNA | Weekly | 13 + 2 global | 30 days |
| 2 | CF-SmartMoney-Flow | Weekly | 11 + 2 global | 20 days |
| 3 | CF-Insider-Buying | Daily | 8 + 2 global | 14 days |
| 4 | CF-Compounder | Weekly | 15 + 2 global | 30 days |

**Screener 3 has shortest cooling period (14 days)** — promoter buying signals are time-sensitive per validator feedback.

## All Parameters Summary

### Global Filters (all screeners)
| Parameter | Subscription | Backtestable |
|---|---|---|
| 6Month Volume Avg | Free | Yes |
| Price above 200D SMA | Free | Yes |

### Screener-Specific (new/changed in v2)
| Parameter | Subscription | Backtestable | Used In | Status |
|---|---|---|---|---|
| PEG TTM | Free | Yes | 1 | NEW v2 |
| Cash from Operating Activity Annual | Free | Yes | 1, 2, 4 | NEW v2 — fraud filter |
| Institutional holding current Qtr % | Free | Yes | 2 | CHANGED v2 |
| Interest Coverage Ratio Annual | Free | Yes | 3, 4 | Was only in 3, now also in 4 |
| Piotroski Score | Free | Yes | 1, 2, 4 | v1 |
| Promoter holding pledge % | Free | Yes | 1, 2, 3, 4 | v1 |
| Operating Cash Flow 3Yr/5Yr Growth | Free | Yes | 1, 4 | v1 |
| Institutional holding change 4Qtr % | Free | Yes | 2 | v1 |
| SAST Buys Last Week | Free | Yes | 3 | v1 |
| ROCE Annual 5Yr Avg % | Free | Yes | 4 | v1 |
| Altman Zscore | Free | Yes | 4 | v1 |

## Near-Miss Logging (NEW v2.1)

V2 Validator 1 flagged that Screener 1 (13 params + 2 global) might be too strict — zero stocks could pass during some market phases.

**Solution**: GAS logs "Near Misses" — stocks that pass all but 1 filter.
- Stored in `Screener_NearMiss` tab in Master DB
- If your screener funnel is empty for 3+ months, review near misses to decide if any filter should be relaxed
- **Candidate for relaxation**: Profit growth 3Y from 20% → 18% (V2 Validator 2 recommendation — companies like PI Industries, Deepak Nitrite had temporary dips below 20% during strong long-term runs)
- **Never relax**: CFO > Net Profit, 200DMA, liquidity, promoter pledge — these are safety filters

---

## Key Decisions (updated v2.1)

**v2 changes:**
- **Liquidity filter**: Added 6M Volume Avg > 50K to ALL screeners. Both validators flagged this as #1 missing filter.
- **200DMA filter**: Added to ALL screeners. Only buy stocks in uptrend.
- **CFO > Net Profit**: Added to Screener 1, 2, 4. THE critical Indian fraud detection filter (catches Vakrangee, Manpasand-type manipulations).
- **PE tightened to 35**: Was 40, validators said too loose for Indian markets.
- **PEG added**: Catches overpriced growth stocks that PE alone misses.
- **Screener 2 simplified**: Replaced noisy FII QoQ with institutional holding level > 10%.
- **Screener 3 loosened**: Promoter change from 1% to 0.25%. 1% was too rare.
- **Cooling periods**: Now screener-specific (14/20/30 days). Insider signals are time-sensitive.
- **Screener 1+3 overlap**: Flagged as historically strongest alpha signal (growth + insider buying).

**v2.1 changes:**
- **Near-miss logging**: GAS logs stocks passing all but 1 filter → prevents empty funnel in tight markets.
- **Golden cross filter**: 50DMA > 200DMA required for BUY signal (in portfolio-rules, not Trendlyne screener). Confirms momentum.
- **OPM > 12 kept**: V2 Validator 2 suggested it's redundant with ROE+ROCE+Piotroski. Kept because OPM catches margin quality that ROE alone can miss in leveraged companies.

## Params Considered But Not Added

| Parameter | Why skipped |
|---|---|
| Debtor days | Not available on Trendlyne. GAS can check via Screener.in scraping. |
| Contingent liabilities | Available but hard to normalize across industries. Manual check better. |
| Auditor tenure | Not available as Trendlyne param. Added as hard exit trigger instead. |
| Working Capital Days | Available but varies wildly by industry. Not useful as blanket filter. |
| Inventory Turnover | Same — too industry-specific for a cross-sector screener. |
| Free Cash Flow | Only available on paid GuruQ plan. Using CFO > NP as proxy (free). |
| Sector filter | Not a screener param — handled as portfolio rule (max 2 per sector). |

# Setup Guide — Trendlyne + Screener.in

## Phase 1: Trendlyne Setup (paid, 1 month only)

### Step 1: Subscribe
1. Go to trendlyne.com → Subscribe
2. Pick cheapest monthly plan (India only)
3. Purpose: Backtesting + alerts setup

### Step 2: Create Screeners
1. Click **Screeners** in top nav
2. Click **Create Screener**
3. Add parameters one by one (see `screeners.md` for exact values)
4. Click **Run Screener** → See results
5. Click **Save** → Name it (1-Future Multibagger, 2-Smart Money, etc.)
6. Repeat for all 4 screeners

### Step 3: Backtest All 4
1. Open each saved screener
2. Click **Backtest**
3. Set period: **3 years** and **5 years**
4. Record these numbers in `screeners.md`:
   - CAGR (compound annual growth rate)
   - Max Drawdown (worst fall)
   - Win Rate (% stocks with positive returns)
   - Number of stocks found
5. If CAGR < 15% on 5Y backtest → tweak the parameters

### Step 4: Set Up Alerts
For each screener:
1. Open saved screener
2. Click **Create Alert**
3. Select **Email notification**
4. Frequency: **Daily** for Screener 3 (insider buying), **Weekly** for others

### Step 5: Follow Superinvestors
1. Go to **Superstars** tab
2. Search and follow (click bell icon):
   - Ashish Kacholia
   - Vijay Kedia
   - Dolly Khanna
   - Mukul Agrawal
   - Abakkus Fund (Sunil Singhania)
   - Radhakishan Damani
3. Enable **email alerts** for all

### Step 6: Bulk/Block Deal Alerts
1. Go to **Superstars** → **Track Market Deals**
2. Click **Create Daily Deals Alert**
3. Enable email notification

---

## Phase 2: After Backtesting (cancel Trendlyne)

Once backtest results are recorded:
1. Cancel Trendlyne subscription
2. GAS automation takes over (see `automation-plan.md`)
3. Keep Screener.in (free) for manual checks

---

## Phase 3: Screener.in Setup (free, permanent)

### Save These Screens
1. Go to screener.in → Sign up (free)
2. Click **Screens** → **Create New Screen**
3. Create same 4 filters using Screener.in query syntax:

**Screen 1 — Multi-bagger:**
```
Market Capitalization < 15000 AND
Sales growth 3Years > 20 AND
Profit growth 3Years > 20 AND
Return on equity > 18 AND
Debt to equity < 0.5 AND
Promoter holding > 50 AND
OPM > 12 AND
Price to Earning < 40
```

**Screen 2 — Insider Buying:**
```
Promoter holding quarterly change > 1 AND
Sales growth > 15 AND
Return on equity > 12 AND
Debt to equity < 0.7 AND
Market Capitalization < 20000
```

**Screen 3 — Compounding Machine:**
```
Sales growth 5Years > 12 AND
Sales growth 3Years > 12 AND
Sales growth > 10 AND
Profit growth 5Years > 12 AND
Average return on equity 5Years > 18 AND
Debt to equity < 0.3 AND
Promoter holding > 55 AND
Market Capitalization > 5000
```

4. Save each screen
5. Check every Sunday (5 minutes)

---

## Weekly Routine

| When | Action | Tool | Time |
|---|---|---|---|
| Daily | Check email alerts (auto from GAS later) | Gmail | 2 min |
| Sunday | Run saved screens on Screener.in | screener.in | 5 min |
| Sunday | Review watchlist stocks | Google Sheet | 10 min |
| Monthly | Check superinvestor quarterly changes | Trendlyne free / Moneycontrol | 10 min |

# Capital Friends

**Free, open-source family portfolio tracker — your data stays in your own Google Drive.**

🌐 Live app: **[capitalfriends.in](https://capitalfriends.in)**

Capital Friends lets an Indian family track everything they own and owe in one place — mutual funds, stocks, fixed deposits, gold, real estate, PPF/EPF/NPS, insurance policies, loans and financial goals — for every family member, with a combined family view. There is no server and no database: the app writes to a Google Spreadsheet that lives in **your** Google Drive, and the developer has no access to it.

> Sign in with Google → a private spreadsheet is created in your Drive → the app reads and writes only that sheet, as you.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Repository layout](#repository-layout)
  - [react-app — the frontend](#react-app--the-frontend)
  - [gas-webapp — the per-user API](#gas-webapp--the-per-user-api)
  - [master-mf-db — the shared market-data database](#master-mf-db--the-shared-market-data-database)
- [Data flow, step by step](#data-flow-step-by-step)
- [Privacy model](#privacy-model)
- [Running it yourself](#running-it-yourself)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Support the project](#support-the-project)
- [Author](#author)

---

## Features

**Track every asset and liability, per family member**

| Area | What you can record |
|---|---|
| Mutual funds | Holdings across AMCs and platforms; SIP and lumpsum purchases, redemptions and switches; units, NAV, current value, P&L and XIRR per fund, per portfolio and per member |
| Stocks | Holdings across brokers; buy/sell transactions, average cost, realised and unrealised P&L per scrip and per portfolio |
| Other investments | Fixed deposits, gold / SGB, real estate, PPF, EPF, NPS, crypto and anything else, with invested amount, current value, maturity date and expected return |
| Insurance | Term life, health, motor, home and travel policies with sum assured, premium and maturity for each member |
| Loans & liabilities | Home, car and personal loans, credit cards — outstanding balance, EMI, interest rate and tenure |
| Bank & investment accounts | Bank accounts, demat accounts, MF platforms, broker and direct-AMC accounts |
| Family | Add spouse, parents and children; view combined or individual net worth, goals, insurance and loans; invite family members to see the shared view |

**Decide what to do next**

- **ATH Buy Signals** — every fund is compared with its all-time-high NAV, refreshed daily from AMFI data. Funds are flagged *Strong Buy* (≥20 % below ATH), *Good Buy* (10–20 %) or *Watch* (5–10 %), so you know when a dip is worth topping up.
- **Smart rebalancing, three modes** — set a target allocation per fund and get the exact SIP adjustment, lumpsum top-up, or buy/sell units needed when the portfolio drifts past your threshold.
- **Goals with glide-path de-risking** — link portfolios to goals; the equity percentage is checked against the years left and a de-risk alert fires when you are above the recommended path.
- **Retirement bucket strategy** — split the corpus into B3 (equity), B2 (hybrid) and B1 (liquid), with B3→B1 direct routing that avoids unnecessary capital-gains tax on each refill cycle.
- **Financial health check** — a guided checklist covering health and term insurance adequacy, emergency fund, nominees, will, and whether the family knows where everything is.

**Stay on top of dates**

- **Reminders** — insurance renewals, FD maturities, SIP due dates and loan EMIs, sorted by urgency, with e-mail notifications inside the advance-notice window.
- **Reports** — an HTML family-wealth dashboard e-mailed on a schedule (or on demand, as PDF) to the whole family.

---

## How it works

```
┌──────────────────────────┐        OAuth 2.0 access token          ┌──────────────────────────────┐
│  react-app               │ ─────────────────────────────────────▶ │  gas-webapp                  │
│  React 19 + Vite         │   Apps Script Execution API            │  Google Apps Script          │
│  hosted on GitHub Pages  │ ◀───────────────────────────────────── │  runs AS THE SIGNED-IN USER  │
│  capitalfriends.in       │            JSON responses              │  (Execution API)             │
└──────────────────────────┘                                        └──────────────┬───────────────┘
                                                                                   │ SpreadsheetApp / DriveApp
                                                                                   ▼
                                                                    ┌──────────────────────────────┐
                                                                    │  Your Google Sheet           │
                                                                    │  (in YOUR Drive)             │
                                                                    │  members, portfolios, MF &   │
                                                                    │  stock txns, insurance,      │
                                                                    │  loans, goals, reminders,    │
                                                                    │  settings + a snapshot of    │
                                                                    │  MF_Data / MF_ATH / Stocks   │
                                                                    └──────────────▲───────────────┘
                                                                                   │ daily snapshot / refresh (read-only)
                                                                    ┌──────────────┴───────────────┐
                                                                    │  master-mf-db                │
                                                                    │  Developer-owned Google Sheet│
                                                                    │  + Apps Script               │
                                                                    │  ~8,500 MF NAVs (mfapi.in),  │
                                                                    │  ATH tracking, ~5,300 NSE    │
                                                                    │  stocks, market data         │
                                                                    │  shared "anyone can view"    │
                                                                    └──────────────────────────────┘
```

Three moving parts, one repository:

1. **react-app** is what you see in the browser. It never talks to a database of ours — it calls Apps Script functions with your Google OAuth token.
2. **gas-webapp** is a Google Apps Script project deployed as an *API executable*. Because it is called through the Execution API, every function runs under the caller's own Google account, reading and writing the caller's own spreadsheet.
3. **master-mf-db** is a second Apps Script project bound to a spreadsheet the developer owns. It collects *public* market data (NAVs, all-time highs, stock lists, prices) once, so that thousands of users don't each hammer the same public APIs. User sheets take a read-only snapshot from it.

---

## Repository layout

```
capital-friends/
├── react-app/       Frontend (React 19, Vite, Tailwind) → capitalfriends.in
├── gas-webapp/      Per-user API (Google Apps Script) — all user data operations
├── master-mf-db/    Shared market-data DB (Google Apps Script) — NAVs, ATH, stocks, signals
├── deploy.sh        Build react-app and publish it to the gh-pages branch
├── deploy-all.sh    Push and deploy both Apps Script projects (clasp) and/or the React app
└── CNAME            Custom domain for GitHub Pages
```

### react-app — the frontend

| | |
|---|---|
| Stack | React 19, React Router 7, Vite 7, Tailwind CSS 4, Recharts (charts), AG Grid (tables), Fuse.js (fuzzy fund/stock search), jsPDF + html2canvas (PDF export), lucide-react (icons) |
| Hosting | Static build on GitHub Pages (`gh-pages` branch) behind the `capitalfriends.in` custom domain |
| Auth | Google Identity Services → OAuth 2.0 access token, stored in `localStorage` and refreshed silently |
| API layer | `src/services/api.js` — one `callAPI('domain:action', payload)` helper that invokes `gas-webapp` through the Apps Script Execution API |
| State | `src/context/DataContext.jsx` loads everything once (`data:load-all`) and keeps it in memory; pages read from context and call the API for writes |

Main routes:

| Route | Page |
|---|---|
| `/dashboard` | Family-wide net worth, allocation and per-member breakdown |
| `/family` | Family members and sharing / invitations |
| `/accounts/bank`, `/accounts/investment` | Bank, demat, broker and MF-platform accounts |
| `/investments/mutual-funds` | Portfolios, transactions (invest / redeem / switch), allocations, rebalancing plans |
| `/investments/funds` | "All Funds" view across portfolios and members with ATH buy signals, XIRR and CAGR |
| `/investments/stocks` | Stock portfolios, buy/sell, holdings, live prices |
| `/investments/other` | FDs, gold, real estate, PPF/EPF/NPS, crypto |
| `/insurance` | Policies per member |
| `/liabilities` | Loans and credit cards |
| `/goals` | Goals, portfolio-to-goal mapping, glide path, retirement buckets |
| `/reports` | Scheduled and on-demand e-mail reports |
| `/reminders` | Date-driven reminders |
| `/health-check` | Financial health questionnaire |
| `/settings` | Email schedule, master-data refresh, preferences |

### gas-webapp — the per-user API

A standalone Google Apps Script project deployed as an API executable. `Code.js` is the router: it receives `domain:action` calls from the frontend and dispatches to the module for that domain. Every module reads and writes **the calling user's** spreadsheet.

| File | Role |
|---|---|
| `Code.js` | Entry point and action router for the Execution API |
| `WebApp.js`, `WebAppAdapters.js` | Request/response plumbing and adapters between sheet rows and JSON |
| `UserRegistry.js` | User registry and family sharing, stored in Script Properties (`user:{email}` → spreadsheet id, role, invitedBy…) — no shared sheet, invisible to users |
| `Setup.js` | One-click setup: creates the user's spreadsheet and all required sheets on first sign-in |
| `FamilyMembers.js`, `BankAccounts.js`, `InvestmentAccounts.js` | CRUD for members and accounts |
| `Portfolios.js`, `MutualFunds.js` | MF portfolios; add-existing, SIP/lumpsum invest, redeem, switch; holdings and P&L |
| `AssetAllocation.js` | Fund-level asset-allocation and market-cap classification, target allocations, rebalancing |
| `Stocks.js` | Stock portfolios, transactions, holdings and price lookups |
| `OtherInvestments.js`, `Insurance.js`, `Liabilities.js` | Dynamic-field modules for other assets, policies and loans |
| `Goals.js` | Goal planning, portfolio mapping, glide path, bucket plans and switch recording |
| `DashboardData.js` | Aggregates the family-wide and per-member dashboard numbers |
| `EmailReports.js`, `EmailTemplate.js` | Scheduled and on-demand dashboard e-mails (HTML / PDF) |
| `Reminders.js`, `ReminderNotifications.js` | Reminder CRUD and the daily notification trigger |
| `MFIntegration.js`, `MasterDataSync.js`, `FundCache.js` | Copy a snapshot of NAV / ATH / stock reference data from `master-mf-db` into the user sheet, refresh it when older than 24 h, and cache fund lists for fast search |
| `Triggers.js` | Time-driven triggers (daily sync, scheduled e-mails, reminder checks) |
| `DEPLOYMENT_GUIDE.md` | Step-by-step GCP / OAuth / Apps Script setup for self-hosting |

### master-mf-db — the shared market-data database

A second Apps Script project bound to a developer-owned Google Sheet that is shared as *anyone with the link can view*. It holds only public market data — never user data.

| File | Role |
|---|---|
| `Code.js` | Builds the `MF_Data` sheet: ~8,500 mutual-fund schemes with names, categories and daily NAVs from [mfapi.in](https://www.mfapi.in/); daily refresh trigger |
| `ATH.js` | Tracks each fund's all-time-high NAV in `MF_ATH`; pulls history for new funds, and every day raises the ATH when NAV makes a new high. This powers the ATH buy signals in the app |
| `MasterDB_StockImport.js` | Imports the NSE stock master list (~5,300 scrips) into `Stock_Data` |
| `MarketData.js` | Prices, RSI, DMA and returns via `GOOGLEFINANCE` formulas in a hidden helper sheet, processed in chunks to stay within Apps Script limits |
| `AdminWebApp.js` | A small admin endpoint (shared-secret POST) so `gas-webapp` can ask the master DB to refresh on demand |
| `ScreenerConfig.js`, `ScreenerFetch.js`, `ScreenerSheets.js`, `ScreenerTriggers.js`, `TrendlyneData.js`, `BSEParser.js` | **Experimental, admin-side** stock screener: fundamentals from Screener.in / Trendlyne, daily / weekly / quarterly checks, corporate-announcement scanning on BSE, and signal generation into a watchlist sheet. Not yet surfaced in the React app |

---

## Data flow, step by step

1. **Sign in.** The landing page uses Google Identity Services to obtain an OAuth access token with the Drive/Sheets scopes. No registration form, no bank linking.
2. **First-time setup.** `data:init` runs `Setup.js` *as you*: it creates a spreadsheet in your Drive with all the required tabs, records `user:{your-email} → spreadsheetId` in the app's Script Properties, and copies a snapshot of `MF_Data`, `MF_ATH` and `Stock_Data` from the master DB.
3. **Every app load.** `data:load-all` reads all tabs in one call and hydrates the React context. `data:check-freshness` compares the snapshot timestamp with the master DB; if it is older than 24 hours the reference data is refreshed automatically (you can also refresh manually from Settings).
4. **Every action** — adding a SIP, recording a redemption, editing a policy — is one `domain:action` call that writes a row (or updates one) in your sheet and returns the updated data.
5. **Family sharing.** `auth:invite` lets you add a family member's Google account; they sign in with their own account and see the shared family view through the registry.
6. **In the background.** Time-driven triggers in `gas-webapp` sync master data daily, send scheduled dashboard e-mails and check reminders. Triggers in `master-mf-db` refresh NAVs, ATHs and market data every day.

---

## Privacy model

- Your financial data lives in **one Google Spreadsheet in your own Drive**. You can open it, edit it, export it or delete it at any time — the app is just a nicer front end for it.
- API calls run through the Apps Script **Execution API as the signed-in user**, so `SpreadsheetApp` / `DriveApp` operate on *your* account. The developer cannot open your sheet.
- The only thing stored on the app side is the registry entry mapping your e-mail to your spreadsheet id (plus family-sharing links), kept in Script Properties.
- The master database contains public market data only.
- No analytics, no ads, no third-party servers.

---

## Running it yourself

You need a Google account, Node.js and [clasp](https://github.com/google/clasp) (`npm i -g @google/clasp`).

**1. Google Cloud project** — create one, enable the Sheets and Drive APIs, configure the OAuth consent screen and create a Web OAuth client. `gas-webapp/DEPLOYMENT_GUIDE.md` walks through every click.

**2. Master database**

```bash
cd master-mf-db
clasp login && clasp create --type sheets --title "Capital Friends Master DB"
clasp push
# In the Apps Script editor: run setupMasterMFDatabase() once, install the daily triggers,
# then share the sheet as "Anyone with the link – Viewer" and note its spreadsheet id.
```

**3. Per-user API**

```bash
cd gas-webapp
clasp create --type standalone --title "Capital Friends WebApp"
clasp push
# Set Script Properties: MASTER_DB_ADMIN_URL, MASTER_DB_ADMIN_SECRET (and the master sheet id).
# Deploy → New deployment → API executable. Note the Script ID (dev) and Deployment ID (prod).
```

**4. Frontend**

```bash
cd react-app
cp .env.example .env          # then fill in:
# VITE_GOOGLE_CLIENT_ID=<your OAuth client id>
# VITE_GAS_SCRIPT_ID=<gas-webapp script id>          (dev mode)
# VITE_GAS_DEPLOYMENT_ID=<gas-webapp deployment id>  (production)
npm install
npm run dev
```

---

## Deployment

Two scripts at the repository root do everything. Deployment IDs are pinned, so each deploy updates the existing deployment in place.

| Command | What it does |
|---|---|
| `./deploy-all.sh master` | `clasp push` + deploy `master-mf-db` |
| `./deploy-all.sh webapp` | `clasp push` + deploy `gas-webapp` |
| `./deploy-all.sh gas` | Both Apps Script projects |
| `./deploy-all.sh react` (or `./deploy.sh`) | `vite build`, then copy `dist/` (plus `CNAME`) onto the `gh-pages` branch and push |
| `./deploy-all.sh` | Everything |

Backend changes never require a React redeploy — the frontend calls the pinned deployment live. Redeploy `react-app` only when its source or `.env` changes.

---

## Known limitations

- **Triggers run as the deploying account.** Time-driven triggers in `gas-webapp` currently fire under the developer's identity, so scheduled jobs must iterate over registered users explicitly rather than relying on `Session.getEffectiveUser()`. See `gas-webapp/README-TRIGGERS.md` for the planned fix.
- **Apps Script quotas.** Long jobs (market-data updates, screener checks) are chunked and auto-continued to stay inside the 6-minute execution limit, but very large portfolios will feel it.
- **India-first.** Fund data comes from AMFI via mfapi.in and stock data from NSE; amounts are in ₹.
- The stock screener in `master-mf-db` is experimental and admin-only for now.

---

## Support the project

Capital Friends is free and has no ads. If it saves you time, you can buy the developer a coffee from the **Donate** page at [capitalfriends.in/donate](https://capitalfriends.in/donate). Bug reports and pull requests are welcome — please open an issue first for anything larger than a small fix.

---

## Author

**Jagadeesh Manne** — [LinkedIn](https://www.linkedin.com/in/jagadeesh-manne/) · jagadeesh.k.manne@gmail.com

Built as a side project by an investor who wanted his own family to know where everything is.

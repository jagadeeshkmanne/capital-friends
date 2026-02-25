# Capital Friends — Deployment Guide

Step-by-step instructions to deploy Capital Friends as a public web app.

**Architecture:** React app (GitHub Pages) + Google Apps Script (REST API) + Google Sheets (data store)

---

## Prerequisites

- A Google account
- Node.js installed
- Git installed
- GitHub account (for GitHub Pages)

---

## Step 1: Google Cloud Project Setup

### 1.1 Create GCP Project

1. Go to https://console.cloud.google.com
2. Click **Select a project** (top bar) → **New Project**
   - Name: `Capital Friends`
   - Click **Create**
3. Make sure the new project is selected in the top bar

### 1.2 Enable APIs

4. Go to **APIs & Services** → **Library**
5. Search for **Google Sheets API** → click it → click **Enable**
6. Search for **Google Drive API** → click it → click **Enable**

### 1.3 Configure OAuth Consent Screen

7. Go to **APIs & Services** → **OAuth consent screen**
8. Choose **External** → click **Create**
9. Fill in the required fields:
   - **App name:** `Capital Friends`
   - **User support email:** your email
   - **Developer contact email:** your email
10. Click **Save and Continue**
11. On the **Scopes** page, click **Save and Continue** (skip)
12. On the **Test Users** page:
    - If staying in Testing mode: click **+ Add Users** and add your email (and any test emails)
    - Click **Save and Continue**
13. Click **Back to Dashboard**

> **Note:** In Testing mode, only added test users can sign in (max 100).
> To allow anyone: click **Publish App** on the consent screen. Google may require verification for production apps.

### 1.4 Create OAuth Client ID

14. Go to **APIs & Services** → **Credentials**
15. Click **+ Create Credentials** → **OAuth client ID**
16. Application type: **Web application**
17. Name: `Capital Friends Web`
18. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
    - `http://localhost:5173` (for local development)
    - `https://YOUR_GITHUB_USERNAME.github.io` (for production — replace with your actual username)
19. Leave **Authorized redirect URIs** empty
20. Click **Create**
21. A popup shows your Client ID and Secret. **Copy the Client ID** (you only need the Client ID, not the Secret)
    - It looks like: `123456789-abcdefg.apps.googleusercontent.com`
22. Click **OK**

> **Save this value — you'll need it in Steps 5 and 7.**

---

## Step 2: Create Registry Spreadsheet

The Registry spreadsheet tracks all users (who signed up, their spreadsheet IDs, roles).

1. Go to https://sheets.google.com
2. Create a **new blank spreadsheet**
3. Rename it to: `Capital Friends - Registry`
4. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/COPY_THIS_PART/edit
   ```
5. You don't need to add any headers — the code creates them automatically on first use

> **Save this Spreadsheet ID — you'll need it in Step 5.**

---

## Step 3: Create Template Spreadsheet

The Template is a clean spreadsheet that gets copied for each new user who signs up.

### Option A: Copy from your existing spreadsheet (recommended)

1. Open your existing Capital Friends spreadsheet (the one with your data)
2. Go to **File** → **Make a copy**
3. Name it: `Capital Friends - Template`
4. Open the copy
5. Delete all data rows from every sheet:
   - Go through each sheet tab (FamilyMembers, BankAccounts, AllPortfolios, etc.)
   - Select all data rows (row 3 or 4 onwards, below the headers)
   - Right-click → **Delete rows**
   - Keep Row 1 (watermark) and Row 2 (headers) intact
6. Delete any portfolio-specific sheet tabs (like "Jags MF Portfolio" etc.) — keep only the system sheets
7. Copy the **Spreadsheet ID** from the URL (same as Step 2)

### Option B: Create from scratch

1. Create a new blank spreadsheet
2. Open your existing Capital Friends add-on script
3. Temporarily point it to the new spreadsheet
4. Run `createAllSheets()` to set up all sheets with proper headers and formatting
5. Copy the Spreadsheet ID

> **Save this Spreadsheet ID — you'll need it in Step 5.**

---

## Step 4: Set Up clasp & Create GAS Project

**clasp** is Google's command-line tool for managing Apps Script projects locally.

### 4.1 Install clasp

```bash
npm install -g @google/clasp
```

### 4.2 Login to Google

```bash
clasp login
```

This opens a browser window. Sign in with the same Google account you used for GCP.

### 4.3 Enable Apps Script API

1. Go to https://script.google.com/home/usersettings
2. Toggle **Google Apps Script API** to **ON**

### 4.4 Create the GAS project

```bash
cd ~/Desktop/capital-friends-webapp

clasp create --title "Capital Friends Web App" --type standalone
```

This creates two files:
- `.clasp.json` — links your local folder to the GAS project
- Updates `appsscript.json` if needed

> **Important:** If clasp overwrites your `appsscript.json`, restore it:
> ```bash
> git checkout appsscript.json
> ```
> Or re-copy it from the version we created (it has the required scopes).

### 4.5 Verify .clasp.json

Open `.clasp.json` — it should look like:
```json
{
  "scriptId": "some-long-script-id",
  "rootDir": "."
}
```

---

## Step 5: Configure WEBAPP_CONFIG

Open `~/Desktop/capital-friends-webapp/WebApp.js` in your editor.

Find the `WEBAPP_CONFIG` object at the top (around line 17) and fill in your values:

```javascript
var WEBAPP_CONFIG = {
  // Paste the Registry Spreadsheet ID from Step 2
  registrySpreadsheetId: 'YOUR_REGISTRY_SPREADSHEET_ID',

  // Paste the Template Spreadsheet ID from Step 3
  templateSpreadsheetId: 'YOUR_TEMPLATE_SPREADSHEET_ID',

  // Paste the Google OAuth Client ID from Step 1
  googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com'
};
```

**Replace the placeholder values with your actual IDs.**

---

## Step 6: Push & Deploy GAS Web App

### 6.1 Push files to Google Apps Script

```bash
cd ~/Desktop/capital-friends-webapp

clasp push
```

This uploads all `.js` files to your GAS project. You should see:
```
Pushed 25 files.
```

### 6.2 Verify in browser (optional)

```bash
clasp open
```

This opens the Apps Script editor. You should see all your files listed on the left.

### 6.3 Authorize the script (first time only)

In the Apps Script editor:
1. Select `doGet` from the function dropdown (top bar)
2. Click **Run**
3. Google will prompt you to authorize — click **Review Permissions**
4. Choose your Google account
5. You'll see a warning "Google hasn't verified this app" — click **Advanced** → **Go to Capital Friends Web App (unsafe)**
6. Click **Allow** to grant all permissions (Sheets, Drive, Gmail, External requests)

> This authorization is required once. It grants the script permission to create spreadsheets, read/write data, etc.

### 6.4 Deploy as Web App

**Option A: Via clasp (command line)**

```bash
clasp deploy --description "v1.0"
```

Output:
```
Created version 1.
- AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx @1.
```

Your API URL is:
```
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec
```

**Option B: Via browser**

1. In the Apps Script editor, click **Deploy** → **New deployment**
2. Click the gear icon → select **Web app**
3. Description: `v1.0`
4. Execute as: **Me** (your Google account)
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the **Web app URL**

> **Save this URL — you'll need it in Step 7.**

### 6.5 Test the API

Open the deployment URL in your browser. You should see:
```json
{"status":"ok","app":"Capital Friends","version":"2.0-webapp","timestamp":"2026-..."}
```

If you see this, the backend is working.

---

## Step 7: Configure React Environment

### 7.1 Create .env file

Create a file called `.env` in the React app root:

```bash
cd ~/Desktop/capital-friends-app
```

Create the file `~/Desktop/capital-friends-app/.env` with these contents:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_FROM_STEP_1
VITE_GAS_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_FROM_STEP_6/exec
```

**Replace with your actual values.**

### 7.2 Add .env to .gitignore

Make sure `.env` is in your `.gitignore` so it doesn't get committed:

```bash
echo ".env" >> ~/Desktop/capital-friends-app/.gitignore
```

> **Note:** Even though the Client ID and API URL aren't true secrets, it's good practice to keep `.env` out of git. The values get baked into the build output anyway, but this keeps your repo clean.

---

## Step 8: Test Locally

```bash
cd ~/Desktop/capital-friends-app

npm run dev
```

1. Open http://localhost:5173/app in your browser
2. You should see the **Login page** with a "Sign in with Google" button
3. Click the button and sign in with your Google account
4. First sign-in will:
   - Verify your token with the GAS backend
   - Create a new spreadsheet for you (copied from template)
   - Register you in the UserRegistry
   - Redirect to the Dashboard (empty state)
5. Try adding a family member to verify the full flow works

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Google Sign-In button doesn't appear | Check browser console. Verify `VITE_GOOGLE_CLIENT_ID` is set correctly. |
| "Not a valid origin" error | Add `http://localhost:5173` to Authorized JavaScript origins in GCP Credentials. |
| API call fails with 401 | Token expired. Sign out and sign in again. |
| API call fails with 500 | Open GAS editor → Executions tab to see server-side errors. |
| CORS error | Make sure you're using `redirect: 'follow'` and `Content-Type: text/plain` in fetch (already set in api.js). |
| "Account suspended" error | Check UserRegistry spreadsheet — user status might be 'Suspended'. |

---

## Step 9: Deploy React to GitHub Pages

### 9.1 Install gh-pages

```bash
cd ~/Desktop/capital-friends-app

npm install --save-dev gh-pages
```

### 9.2 Update package.json

Open `package.json` and add/update these fields:

```json
{
  "homepage": "https://YOUR_GITHUB_USERNAME.github.io/app",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

> Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 9.3 Create GitHub repository (if not already)

```bash
cd ~/Desktop/capital-friends-app

git init
git add .
git commit -m "Initial commit - Capital Friends web app"

# Create repo on GitHub (requires gh CLI)
gh repo create capital-friends-app --public --source=. --push
```

Or create the repo manually on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/capital-friends-app.git
git push -u origin main
```

### 9.4 Deploy

```bash
npm run deploy
```

This will:
1. Run `npm run build` (creates `dist/` folder)
2. Push `dist/` contents to the `gh-pages` branch
3. GitHub Pages serves the `gh-pages` branch automatically

### 9.5 Enable GitHub Pages (if not auto-enabled)

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `gh-pages` / `/ (root)`
4. Click **Save**

Your app will be live at:
```
https://YOUR_GITHUB_USERNAME.github.io/app
```

It may take 1-2 minutes for the first deployment to go live.

---

## Step 10: Add Production URL to GCP

Go back to GCP Console → **Credentials** → click your OAuth Client ID.

Under **Authorized JavaScript origins**, verify this is listed:
```
https://YOUR_GITHUB_USERNAME.github.io
```

(You should have added this in Step 1, but double-check.)

---

## Updating After Changes

### GAS Backend Changes

```bash
cd ~/Desktop/capital-friends-webapp

# Edit files locally, then push
clasp push

# For a new production version:
clasp deploy --description "v1.1"
```

> **Note:** After `clasp deploy`, you get a NEW deployment URL. Update your React `.env` file with the new URL, rebuild, and redeploy.
>
> Alternatively, update the existing deployment to avoid changing the URL:
> ```bash
> clasp deploy --deploymentId YOUR_EXISTING_DEPLOYMENT_ID --description "v1.1"
> ```

### React Frontend Changes

```bash
cd ~/Desktop/capital-friends-app

# Edit files, then deploy
npm run deploy
```

---

## Quick Reference

| Item | Where to find it |
|------|-----------------|
| Google Client ID | GCP Console → APIs & Services → Credentials |
| Registry Spreadsheet ID | URL of the Registry Google Sheet |
| Template Spreadsheet ID | URL of the Template Google Sheet |
| GAS Deployment ID | Output of `clasp deploy` |
| GAS Deployment URL | `https://script.google.com/macros/s/DEPLOYMENT_ID/exec` |
| React .env file | `~/Desktop/capital-friends-app/.env` |
| React app URL | `https://YOUR_GITHUB_USERNAME.github.io/app` |
| GAS Editor | `clasp open` or https://script.google.com |
| GAS Logs | GAS Editor → Executions tab |

---

## Architecture Diagram

```
User's Browser                          Google Cloud
┌──────────────────────┐               ┌──────────────────────────────┐
│  GitHub Pages        │               │  Google Apps Script          │
│  (React App)         │               │  (Web App - REST API)        │
│                      │   HTTPS POST  │                              │
│  1. Google Sign-In   │──────────────>│  2. Verify Google Token      │
│     (get ID token)   │               │  3. Lookup UserRegistry      │
│                      │               │  4. Set spreadsheet context  │
│  6. Display data     │<──────────────│  5. Run business logic       │
│                      │   JSON resp   │     (read/write Sheets)      │
└──────────────────────┘               └──────────────┬───────────────┘
                                                      │
                                       ┌──────────────┴───────────────┐
                                       │  Google Sheets               │
                                       │                              │
                                       │  ┌─────────────────────┐     │
                                       │  │ UserRegistry Sheet   │     │
                                       │  │ (email → ssId)       │     │
                                       │  └─────────────────────┘     │
                                       │                              │
                                       │  ┌─────────────────────┐     │
                                       │  │ User A Spreadsheet   │     │
                                       │  │ (all family data)    │     │
                                       │  └─────────────────────┘     │
                                       │                              │
                                       │  ┌─────────────────────┐     │
                                       │  │ User B Spreadsheet   │     │
                                       │  │ (separate family)    │     │
                                       │  └─────────────────────┘     │
                                       └──────────────────────────────┘
```

---

## Family Sharing Flow

1. **User A signs up** → new spreadsheet created → registered as `owner`
2. **User A invites User B** (by email) → UserRegistry adds row: B's email → A's spreadsheetId, role=`member`, status=`Pending`
3. **User B signs in** → UserRegistry finds B → status changes to `Active` → B sees A's family data
4. **User A removes User B** → status set to `Suspended` → B can no longer access

> Only owners can invite/remove members. Members can view and add data but cannot manage access.

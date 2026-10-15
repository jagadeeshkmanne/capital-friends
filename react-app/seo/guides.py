# The guides: one long, plain-English explainer per feature of Capital Friends, generated into public/<slug>/index.html
# by gen.py (which passes its add() and helpers in). Every guide: what it is, why a family needs it, how it works in the
# app step by step, what each number means, questions, related pages. Facts mirror the app (thresholds, tables, rules).
TIP = lambda t: f'<div class="tip">{t}</div>'
NOTE = lambda t: f'<div class="note-box">{t}</div>'
def table(head, rows):
    return '<div class="tbl"><table><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</table></div>'
def steps(items): return '<ol class="steps">' + ''.join(f'<li>{x}</li>' for x in items) + '</ol>'
def defs(items): return '<dl class="defs">' + ''.join(f'<dt>{k}</dt><dd>{v}</dd>' for k, v in items) + '</dl>'

ORDER = ['your-data-in-your-google-drive', 'family-members-and-accounts', 'financial-health-check', 'cams-cas-import', 'mutual-fund-portfolio-tracker',
         'portfolio-rebalancing', 'stock-portfolio-tracker', 'track-fd-ppf-epf-gold-property', 'insurance-tracker', 'goal-based-investing',
         'retirement-bucket-strategy', 'family-net-worth-tracker', 'family-financial-blueprint-email']

def register(add, feat):
    # ───────────────────────── 1. data & privacy ─────────────────────────
    add('your-data-in-your-google-drive', guide=True, nav='Your data in your own Google Drive', blurb='No server, no bank login: one Google Sheet in your Drive holds everything.',
     title='Portfolio Tracker With No Bank Login – Your Data Stays in Your Google Drive',
     desc='How Capital Friends keeps your family\'s financial data in one Google Sheet in your own Drive: no server, no bank login, no account to create. What the Google permissions mean, how daily updates run in your own account, how masking works, and how to delete everything.',
     h1='Your data stays in your own Google Drive', lead='Capital Friends has no database. When you sign in with Google it creates one Google Sheet in your Drive and saves everything there: family members, accounts, funds, goals. The app reads and writes that sheet; nobody else can. This guide explains exactly what happens to your data and why the app was built this way.',
     body="""<h2 id="why">Why a money app should not hold your money data</h2>
<p>Most portfolio apps ask you to link bank accounts or hand over broker logins, then keep your data on their servers. That is a lot of trust for a free app. Capital Friends takes the opposite route: it is open source, it never sees a bank login, and the only copy of your data is the Google Sheet in your own Drive. If you stop using the app, you delete one file and the app has nothing.</p>
""" + feat([('No account to create', 'You sign in with the Google account you already have. There is no Capital Friends password and no profile stored anywhere.'),
            ('One sheet, in your Drive', 'The first sign-in creates a Google Sheet named Capital Friends. Every member, account, fund and goal is a row in it. Open it any time, download it as Excel, or delete it.'),
            ('No bank or broker login, ever', 'Mutual funds come from a CAMS statement PDF you download yourself; stocks from your broker\'s Excel. The app never connects to a bank.'),
            ('Open source', 'The code is public on GitHub, so you can read what the app does with your data instead of taking our word for it.')]) + """
<h2 id="permissions">What the four Google permissions are for</h2>
<p>The Google consent screen is where most people get nervous, so here is each line in plain words.</p>
""" + table(['Permission', 'What the app does with it'], [
    ['See, edit, create and delete only the Google Drive files you use with this app', 'Create the Capital Friends sheet and read and write it. The app can only see files it created; it cannot browse the rest of your Drive.'],
    ['Send email on your behalf', 'The daily family summary goes out from your own Gmail to the family members you choose. Nothing is sent through our servers.'],
    ['Connect to an external service', 'Fetch the daily mutual fund NAVs, all-time-high prices and the gold rate from public sources.'],
    ['Run when you are not present', 'The daily update: refresh prices, check every fund against its high, send the family email, even when the app is closed.']]) + """
<p>Google reviews and verifies apps that ask for these scopes, and Capital Friends has gone through that verification.</p>
<h2 id="daily">Daily updates run inside your own Google account</h2>
<p>After sign-in, open <strong>Settings → Data &amp; Sync</strong> and turn on <strong>Daily updates</strong>. Google asks for permission once more, and then a small scheduled script is installed in your Google account (not on a server of ours). Every day it does three things:</p>
<ul><li>refreshes the NAV of every fund you hold and revalues gold at the live rate;</li>
<li>checks each fund against its own all-time high and prepares the below-high alerts;</li>
<li>sends the family email, if you have enabled it.</li></ul>
<p>Because the script runs in your account, it keeps working even if you never open the app that day, and you can switch it off from the same settings page at any time.</p>
<h2 id="masking">Masking on screen</h2>
<p>The eye icon in the header hides names, PAN, Aadhaar, account numbers and email addresses on every screen. Turn it on whenever you share your screen or sit in a cafe. PAN and Aadhaar are optional fields in the first place; if you add them they are saved only in your sheet and always masked in the family email.</p>
<h2 id="phone">On your phone</h2>
<p>There is no Android or iOS app and you do not need one. Open capitalfriends.in in your phone's browser; every screen is built for mobile. Add it to your home screen and it opens like an app.</p>
<h2 id="delete">How to delete everything</h2>
""" + steps(['Open Google Drive and delete the file named <strong>Capital Friends</strong>. That is the only copy of your data.',
            'In Settings, switch off Daily updates, so the scheduled script is removed from your Google account.',
            'Optionally, remove the app from your Google account\'s third-party access list. Nothing remains anywhere.']) + """
<h2 id="trust">What the app can never do</h2>
<ul><li>It cannot move money. There is no connection to a bank, broker or AMC; every number is read from statements you provide.</li>
<li>It cannot see your other Drive files, your contacts or your inbox.</li>
<li>It cannot sell your data. There is no server that holds it.</li></ul>""",
     preview=(['networth', 'mail'], 'What that sheet turns into', 'The dashboard and the daily email are built from the rows in your own sheet.'),
     faq=[('Where exactly is my data stored?', 'In one Google Sheet in your Google Drive, created on your first sign-in. The app reads and writes that sheet through Google\'s own APIs; there is no Capital Friends database.'),
          ('Does Capital Friends need my bank or Zerodha login?', 'No. Mutual funds come from a CAMS statement PDF, stocks from your broker\'s holdings Excel or a CDSL/NSDL statement. Bank accounts are just a list of which accounts exist.'),
          ('Why does it ask to send email on my behalf?', 'So the daily family summary can go out from your own Gmail to the family members you choose. You pick who receives it and how often, or leave it off.'),
          ('What does "run when you are not present" mean?', 'It lets the daily update (prices, below-high alerts, the family email) run from a schedule in your own Google account even when the app is closed. You turn it on in Settings and can turn it off there.'),
          ('Can I open the data in Excel?', 'Yes. The Google Sheet is yours; open it in Drive or download it as .xlsx any time.'),
          ('Is it really free?', 'Yes, free and open source for any family. There are no ads. A voluntary donation page keeps the lights on.')],
     related=['family-financial-blueprint-email', 'cams-cas-import', 'family-net-worth-tracker'])

    # ───────────────────────── 2. family members & accounts ─────────────────────────
    add('family-members-and-accounts', guide=True, nav='Family members, bank and investment accounts', blurb='Everything belongs to a person; every platform is mapped to its bank.',
     title='Family Financial Records – Members, Bank Accounts and Investment Accounts in One Place',
     desc='Keep one list of every family member, every bank account and every investment account (Zerodha, Groww, distributor) with the bank it is mapped to. No account numbers needed, no bank login. The list your family will search for one day.',
     h1='Family members, bank accounts and investment accounts', lead='In Capital Friends everything belongs to a person. Before any numbers you add the family: you, your spouse, parents, kids. Then the accounts: which banks, which investment platforms, and which bank each platform pays into. It takes ten minutes and it is the list your family would otherwise spend months rebuilding.',
     body="""<h2 id="why">Why start with people, not money</h2>
<p>A mutual fund is not just a fund; it is your mother's fund, in her Groww account, linked to her Axis bank account, with your father as nominee. When the app knows the people first, every later entry (a fund, a policy, a loan) is tied to the right person, the family net worth splits correctly, and the daily email can say <em>where everything is</em> for each member.</p>
<h2 id="members">Family members</h2>
""" + steps(['Open <strong>Family Members → Add Member</strong>. Name, relationship (Self, Spouse, Son, Daughter, Father, Mother…), date of birth and email are the main fields.',
            'PAN, Aadhaar and mobile are optional. If something happens to you, these are the first things a bank or AMC asks your family for, so adding them saves a search; they are stored only in your sheet and masked on screen.',
            'Tick <strong>Include in email reports</strong> for the members who should receive the daily family email.',
            'Repeat for everyone. Kids are added as members too; their minor mutual fund accounts become their own portfolios when you import your CAMS statement.']) + """
<p>Names on screen are hidden the moment you switch on the mask (the eye icon in the header), which is what you will see in our demo videos.</p>
<h2 id="bank">Bank accounts</h2>
<p>This is a list, not a connection. For each account you record the member, the bank and the type (savings, current, FD, NRE/NRO). Account number, IFSC and branch are optional; even the last four digits are enough for the family to identify it. No login, no balance fetching: the point is that the family knows the account exists and whose it is.</p>
<h2 id="invest">Investment accounts</h2>
<p>An investment account is where you actually invest from: a Zerodha or Groww account, a demat account, an AMC direct account, or a distributor (ARN). For each one you record the member, the platform, the account type (Demat + Trading, Mutual Fund, Direct AMC, Broker) and, the useful part, <strong>the bank account it is mapped to</strong>. Registered email and client ID are optional.</p>
""" + TIP('When your CAMS statement is imported, the app recognises the accounts in it and creates a portfolio per account, so the investment-account list and the fund portfolios line up by themselves.') + """
<h2 id="list">What the family sees</h2>
<p>Every account appears on its member's section of the daily email: bank name, type, the platform, the linked bank. Nothing a thief could use (no full account numbers unless you chose to add them), everything a spouse would need to make a call to the right bank or broker.</p>
<h2 id="after">What comes next</h2>
<p>With members and accounts in place, the rest of the app is just adding what each person holds: <a href="/cams-cas-import/">import mutual funds from a CAMS statement</a>, <a href="/stock-portfolio-tracker/">stocks from your broker</a>, <a href="/track-fd-ppf-epf-gold-property/">FDs, EPF, gold and property</a>, and <a href="/insurance-tracker/">insurance policies with nominees</a>.</p>""",
     preview=(['networth'], 'Where it leads', 'Every asset tied to a member, added up into one family net worth.'),
     faq=[('Do I have to enter account numbers?', 'No. The account number, IFSC and branch are optional. Many families enter only the last four digits so the account can be identified without exposing it.'),
          ('Why add PAN and Aadhaar?', 'When your family has to claim an investment or insurance, PAN and Aadhaar of the holder are the first things they are asked for. It is your call; the fields are optional, saved only in your own sheet, and masked on screen and in the email.'),
          ('Can I add my parents and in-laws?', 'Yes. Any relationship can be added, and each member can have their own bank accounts, investment accounts, funds, policies and goals.'),
          ('Does the app connect to my bank?', 'Never. Bank accounts are a list so that the family knows which accounts exist. Balances are not fetched.'),
          ('What is "mapped bank account" on an investment account?', 'The bank account your Zerodha, Groww or distributor account pays into and is funded from. Recording it tells the family where redemptions will land.')],
     related=['your-data-in-your-google-drive', 'cams-cas-import', 'insurance-tracker', 'family-financial-blueprint-email'])

    # ───────────────────────── 3. health check ─────────────────────────
    add('financial-health-check', guide=True, nav='Financial health check', blurb='Seven yes/no questions most families miss, turned into action items.',
     title='Family Financial Health Check – 7 Questions Before You Invest Another Rupee',
     desc='A free family financial health check: health insurance, term cover (10–15x income), emergency fund (6–12 months), Will, nominees, family awareness and goals. Each "no" becomes an action item on your dashboard until it is fixed.',
     h1='Financial health check', lead='The first screen after sign-in is not a portfolio. It is seven yes/no questions about the things that protect a family: insurance, an emergency fund, a Will, nominees. They matter more than which fund you pick, and most families have at least two gaps. Every "no" becomes an action item that stays on your dashboard until you fix it.',
     body="""<h2 id="questions">The seven questions and the benchmark behind each</h2>
""" + table(['Question', 'Benchmark the app uses', 'Why it comes first'], [
    ['Does your family have health insurance?', 'A ₹50 L to ₹1 Cr family floater, considering medical inflation', 'One hospital bill can undo ten years of SIPs.'],
    ['Do you have adequate term life insurance?', '10–15× your annual income', 'If the earner is gone, this is the family\'s income.'],
    ['Do you have an emergency fund?', '6–12 months of expenses in liquid assets', 'So a job loss never forces you to sell equity at a low.'],
    ['Is your family aware of all investments?', 'Nominees and family know every asset', 'Unclaimed money in India runs to tens of thousands of crores.'],
    ['Do you have a Will?', 'A registered Will', 'Without one, transfer of assets is slow and can divide families.'],
    ['Have you updated nominees on all accounts?', 'Bank, demat, MF, insurance, PF, PPF: all of them', 'At claim time this is the very first question.'],
    ['Do you have clearly defined financial goals?', 'Retirement, education, home, with amounts and dates', 'A goal turns "invest more" into a number and a date.']]) + """
<h2 id="how">How it works in the app</h2>
""" + steps(['Answer the seven questions with yes or no. It takes a minute. Insurance questions can also be answered automatically once you add your policies.',
            'The app shows a score (for example 4 of 7) and a list of recommendations: get health insurance, get term insurance, write a Will.',
            'Click <strong>Save &amp; continue</strong>. The recommendations become <strong>Action required</strong> cards at the top of your dashboard, with a link to the right screen (for example Add policy).',
            'They disappear only when the gap is closed: adding a health policy answers the health question, and so on. The same items appear as critical alerts in the daily family email.']) + """
<h2 id="insurance">How the insurance answers become real checks</h2>
<p>Once you add your policies on the <a href="/insurance-tracker/">Insurance</a> page, the app computes coverage adequacy on its own: total life cover against the 10–15× income guideline, and health cover against the family-floater guideline. The health check then reads from your actual policies instead of your memory.</p>
<h2 id="later">Revisit it</h2>
<p>The check is not a one-time quiz. Open it from the More menu whenever something changes: a new child, a new job, a loan paid off. The goal question links straight to the <a href="/goal-based-investing/">goal planner</a>, and the emergency fund question to the <a href="/emergency-fund-calculator/">emergency fund calculator</a>.</p>
""" + NOTE('The benchmarks are common planning rules of thumb, not advice. Your numbers depend on dependants, liabilities and lifestyle.'),
     preview=(['mail'], 'Where the gaps show up', 'Open items from the health check lead the daily family email as critical alerts.'),
     faq=[('Is the health check mandatory?', 'It is the first screen after sign-in because it matters most, but you can skip it and come back from the More menu.'),
          ('How much term insurance should I have?', 'The app uses the common guideline of 10–15 times your annual income, enough to replace your income for your dependants. Read the policy\'s terms; this is a planning benchmark, not advice.'),
          ('How big should my emergency fund be?', 'Six to twelve months of household expenses in liquid or safe assets (savings, liquid funds, short FDs). The emergency fund calculator works it out from your monthly expenses.'),
          ('Where do the action items go?', 'To the top of your dashboard as Action required cards, and into the daily family email as critical alerts, until each one is closed.'),
          ('Why does it ask about a Will?', 'Without a Will, assets pass by succession law, which is slow and can split families. A registered Will is the single cheapest piece of financial planning most people skip.')],
     related=['insurance-tracker', 'emergency-fund-calculator', 'goal-based-investing', 'family-financial-blueprint-email'])

    # ───────────────────────── 4. CAMS CAS import ─────────────────────────
    add('cams-cas-import', guide=True, nav='CAMS CAS import', blurb='Get your consolidated statement and import every transaction.',
     title='CAMS CAS Statement: How to Download It and Import Every Mutual Fund Transaction',
     desc='Step-by-step: download the detailed CAMS + KFintech consolidated account statement (CAS) PDF for free, then import it into Capital Friends so every fund, SIP, switch and redemption of every family member is tracked with real money-in, XIRR and CAGR.',
     h1='CAMS CAS import: every fund, every transaction, in one go', lead='You do not type mutual funds into Capital Friends. You download one consolidated statement from CAMS, the app reads every fund and every transaction from day one, creates a portfolio per account, and you confirm. Then you do the same for your spouse and parents. Five minutes per person, and the whole family\'s history is in.',
     body="""<h2 id="what">What a CAS is</h2>
<p>The Consolidated Account Statement (CAS) is a PDF that lists every mutual fund folio held against one PAN, across all AMCs, with every transaction: purchases, SIP instalments, switches, redemptions, dividends. CAMS and KFintech (the two registrars) produce it jointly, and it is free. There are two kinds: a <strong>summary</strong> statement with current holdings only, and a <strong>detailed</strong> statement with the full transaction history. Capital Friends needs the detailed one, because real money-in, XIRR and CAGR all depend on the dates and amounts of every transaction.</p>
<h2 id="download">How to download the detailed CAS (free)</h2>
""" + steps(['Open the CAMS website (<a href="https://www.camsonline.com" rel="noopener">camsonline.com</a>) → Investor Services → CAS – CAMS + KFintech.',
            'Choose <strong>Detailed</strong>, period <strong>Specific period</strong>, from a date before your first investment (1 Jan 2000 is safe) to today, and tick <strong>With zero balance folios</strong> so closed funds and their history come too.',
            'Enter the email registered with your funds and set a password for the PDF. Submit.',
            'The PDF arrives by email, usually within a few minutes (up to a day when the registrars are busy). One PDF covers every AMC; you need one per PAN, so one per family member.']) + """
<p>The app shows this guide with screenshots on the import page itself, with the four steps numbered on the CAMS form.</p>
<h2 id="import">Import it into Capital Friends</h2>
""" + steps(['Go to <strong>Mutual Funds → Import statement</strong>, click <strong>Choose PDF</strong>, pick the file and type the password you set.',
            'The app reads the statement in your browser and reports what it found, for example 74 funds and 839 transactions from 2000 to today.',
            'It lists every account in the statement and proposes a portfolio for each: your own, your distributor account, and minor accounts of your children as their own portfolios. Accounts that are fully sold can be imported for their history or skipped.',
            'A summary shows how many funds go into how many portfolios. Click <strong>Yes, import</strong>. Nothing is saved until this click, and every import can be undone with one click from <strong>Past imports</strong>.',
            'Repeat with your spouse\'s and parents\' statements. Each one adds portfolios; nothing is duplicated.']) + """
<h2 id="after">What you get</h2>
""" + feat([('Real money-in', 'The money that actually left your bank account, separate from holdings cost. A switch moves profit between funds; it is not new money.'),
            ('XIRR and CAGR for every fund', 'From the exact date and amount of every transaction, for each fund, each portfolio and the family total.'),
            ('Every SIP recognised', 'The app knows your running SIPs and their dates from the statement, so reminders and the rebalance-by-SIP feature work without typing.'),
            ('Switches, dividends, redemptions', 'All read from the statement, so realised profit and unrealised profit are shown separately.'),
            ('Kids\' minor accounts', 'A minor\'s folio under a parent becomes the child\'s own portfolio, so each child\'s education fund is visible on its own.'),
            ('Undo', 'Every import is listed under Past imports with an undo. Importing a fresh statement next quarter adds only the new transactions.')]) + """
<h2 id="refresh">Keeping it current</h2>
<p>New SIP instalments and purchases are added by importing a fresh statement every month or quarter; the app merges it, adding only what is new. Daily NAVs, all-time-high prices and the below-high alerts update on their own through the daily update in your Google account, so values are current every morning.</p>
<h2 id="privacy">Privacy</h2>
<p>The PDF is parsed in your browser. The transactions are saved to the Capital Friends sheet in your own Google Drive and nowhere else. Read <a href="/your-data-in-your-google-drive/">how your data is stored</a>.</p>""",
     preview=(['funds'], 'After the import', 'Money-in, current value, XIRR and CAGR for the whole family, every fund compared with its own high.'),
     faq=[('Is the CAMS CAS statement free?', 'Yes. The detailed consolidated statement from CAMS + KFintech is free and arrives by email, usually within minutes.'),
          ('Which CAS should I download, summary or detailed?', 'Detailed. The summary has only current holdings; the detailed statement has every transaction, which is what money-in, XIRR and CAGR need.'),
          ('Does it cover all AMCs?', 'Yes. The CAMS + KFintech CAS covers every mutual fund held against the PAN and email you enter, across all fund houses.'),
          ('What about my spouse\'s and kids\' funds?', 'One statement per PAN. Import your spouse\'s and parents\' statements the same way. Minor accounts held under your PAN appear in your statement and become the child\'s own portfolio.'),
          ('Can I undo an import?', 'Yes. Past imports lists every import with an undo button. Nothing is saved until you click Yes, import.'),
          ('Will importing again duplicate transactions?', 'No. A fresh statement is merged: transactions already in the sheet are recognised and only new ones are added.')],
     related=['mutual-fund-portfolio-tracker', 'portfolio-rebalancing', 'xirr-calculator', 'stock-portfolio-tracker'])

    # ───────────────────────── 5. mutual fund tracker ─────────────────────────
    add('mutual-fund-portfolio-tracker', guide=True, nav='Mutual fund portfolio tracker', blurb='All family funds from one CAS import, with real money-in, XIRR and CAGR.',
     title='Mutual Fund Portfolio Tracker for Indian Families – Free, CAS Import, Real XIRR',
     desc='Free mutual fund portfolio tracker: import your CAMS CAS statement and see real money-in (not holdings cost), XIRR and CAGR for every fund and family member, funds below their all-time high, allocation targets and the fund breakdown by market cap and geography. Data in your own Google Drive.',
     h1='Mutual fund portfolio tracker', lead='Every mutual fund of every family member, from one CAMS statement per person: money that really went in, current value, XIRR and CAGR, the investment journey since your first purchase, each fund against its own all-time high, and a breakdown by large, mid, small cap and geography. Kept in a Google Sheet in your own Drive.',
     body="""<h2 id="different">What makes it different from Groww, Kuvera or a spreadsheet</h2>
""" + feat([('Real money-in, not holdings cost', 'Other apps count a switch as fresh investment, so "invested" keeps growing with your profit. Capital Friends shows the cash that left your bank, the holdings cost, and the profit (realised and unrealised) separately.'),
            ('The whole family on one page', 'Your funds, your spouse\'s, your parents\' and the kids\' minor accounts, each as its own portfolio and together as one number.'),
            ('XIRR and CAGR for everything', 'For every fund, every portfolio and the family total, from the exact date of every purchase, SIP, switch and redemption.'),
            ('Each fund against its own high', 'Every fund is compared with its own all-time-high NAV every day. You see that your flexicap fund is 7% below its high, instead of reacting to a Nifty headline.'),
            ('Allocation targets and rebalancing', 'Set a target per fund; the app shows the drift and three ways to fix it. See the rebalancing guide.'),
            ('Fund breakdown', 'Classify each fund once and see how much of the family\'s money is large, mid or small cap, debt, gold, or outside India. Goals use this split.')]) + """
<h2 id="moneyin">Money-in vs holdings cost: the number other apps get wrong</h2>
<p>Say you invested ₹10 lakh in Fund A, it grew to ₹15 lakh, and you switched it to Fund B. Most apps now show ₹15 lakh invested. But only ₹10 lakh came from your bank; the other ₹5 lakh is profit you moved along. After a few years of switching, the "invested" number has drifted so far from reality that you cannot tell what you actually earned.</p>
""" + table(['', 'Other apps show', 'Capital Friends shows'], [
    ['Invested / money-in', '₹15 L (the switch counted as new money)', '₹10 L: the cash from your bank'],
    ['Holdings cost', '—', '₹15 L: the cost of the units you hold today'],
    ['Profit', 'Looks like ₹0 on Fund B', '₹5 L realised on the switch, plus whatever Fund B gains']]) + """
<p>On the Mutual Funds page the first tile is <strong>Your money in</strong>, with <strong>Holdings cost</strong> under it, then current value, unrealised and realised profit, total profit as a percentage of the money you really put in, XIRR and CAGR.</p>
<h2 id="xirr">XIRR and CAGR, and why you need both</h2>
""" + defs([('XIRR', 'Your real annual return, weighing every rupee by how long it was invested. A SIP running for ten years has instalments that are ten years old and ten days old; XIRR handles that. This is the number to compare with a fixed deposit.'),
            ('CAGR', 'The growth rate of the value as if it were one lump sum from the first purchase to today. Easier to read, but it treats a recent SIP instalment as if it had been invested from day one, so it can over- or understate what you earned.')]) + """
<p>Both are computed from the transactions in your CAS, per fund, per portfolio and for the whole family. Try the <a href="/xirr-calculator/">XIRR calculator</a> for the maths with your own dates.</p>
<h2 id="pages">What you see, screen by screen</h2>
""" + steps(['<strong>Mutual Funds page</strong>: the family total (money-in, holdings cost, current value, unrealised and realised P&amp;L, XIRR, CAGR, monthly SIP), the asset-class split, the investment journey chart from your first purchase, and every portfolio with its money-in, value and return.',
            '<strong>A portfolio</strong>: the same tiles for that member or account; holdings with units, today\'s NAV and your average NAV, distance below the all-time high, current versus target allocation; the Below high box; and Rebalance needed when targets drift.',
            '<strong>A fund</strong>: invested amount, units, NAV, below-high, its monthly SIP, its own journey chart, and every transaction with the profit or loss on each.',
            '<strong>Fund breakdown tab</strong>: the asset-class, market-cap and geography split of the portfolio, once the funds are classified.']) + """
<h2 id="high">Funds below their all-time high</h2>
<p>Every fund has the highest NAV it has ever reached. The daily update checks today\'s NAV against it. A fund 5% or more below its high appears in the <strong>Below high</strong> box; 10% or more is highlighted further, and both reach you in the daily email. Nifty might be 15% down while your fund is only 5% below its own high; here you see your own fund, not the headline. The app only shows the fact. What you do with it is your decision.</p>
<h2 id="breakdown">Fund breakdown: large, mid, small, global</h2>
<p>A fund is a mix: some equity, some debt; large, mid or small cap; India or global. The app cannot get this for free, so you copy it once per fund from Morningstar (asset class, market cap, geography; a minute per fund) and refresh it every few months. After that the Fund breakdown tab shows how much of the family\'s money is large cap, mid cap, small cap, debt, gold and outside India, and the goal planner uses the equity/debt split to decide which funds are safe money and which are growth money.</p>
<h2 id="import">How the funds get in</h2>
<p>From one CAMS consolidated statement per family member; the <a href="/cams-cas-import/">CAS import guide</a> has the steps. Fresh statements merge, so a monthly import keeps the history complete while NAVs update daily on their own.</p>""",
     cta='xirr', preview=(['funds', 'goal'], 'The whole family, one page', 'Real money-in, XIRR and CAGR, funds below their high, and goals funded from the same money.'),
     faq=[('Is the mutual fund tracker free?', 'Yes, free with no ads and open source. You can support the project with a voluntary donation.'),
          ('Which statements can I import?', 'The detailed CAMS + KFintech consolidated account statement (CAS) PDF, which covers all AMCs. One statement per PAN; import one for each family member.'),
          ('What is the difference between money-in and holdings cost?', 'Money-in is the cash that left your bank. Holdings cost is what the units you hold today cost, which includes profit moved in by switches. The gap between them is profit you already made and moved along.'),
          ('Does it track SIPs automatically?', 'Yes. Every SIP instalment is a transaction in the CAS, so the app knows your running SIPs, their amounts and dates, and reminds you before the next one.'),
          ('How are NAVs updated?', 'Daily from AMFI data through a scheduled script that runs in your own Google account, so values and the below-high alerts are current even when you do not open the app.'),
          ('Does it tell me when to buy?', 'No. It shows how far each fund is below its own high. That is information, not advice; the decision stays yours.'),
          ('Can I use it as a Google Sheets or Excel tracker?', 'Your data already lives in a Google Sheet in your Drive. Open it any time, or download it as Excel.')],
     related=['cams-cas-import', 'portfolio-rebalancing', 'xirr-calculator', 'family-net-worth-tracker', 'stock-portfolio-tracker', 'goal-based-investing'])

    # ───────────────────────── 6. rebalancing ─────────────────────────
    add('portfolio-rebalancing', guide=True, nav='Portfolio rebalancing: three ways', blurb='Target allocation, drift, and rebalancing by SIP, lump sum or buy-and-sell.',
     title='Mutual Fund Portfolio Rebalancing – Targets, Drift and Three Ways to Fix It',
     desc='How to rebalance a mutual fund portfolio without guesswork: set a target allocation per fund, see the drift, and fix it by adjusting SIP amounts, adding a lump sum to what is short, or buying and selling. Funds that no longer accept fresh money are skipped automatically.',
     h1='Portfolio rebalancing: everyone says once a year, nobody says how', lead='Rebalancing means bringing each fund back to the share of the portfolio you intended. Capital Friends makes it concrete: you set a target per fund, the app shows the drift every day, and when it crosses the threshold it gives you three worked-out ways to fix it, in rupees, for your actual funds.',
     body="""<h2 id="why">Why portfolios drift</h2>
<p>You decided 50% flexicap, 30% asset allocation, 20% global. Then the flexicap fund had a great year. Now it is 65% of the portfolio and your risk is higher than you chose, without a single decision on your part. Rebalancing is the discipline of trimming what grew and topping up what lagged, which quietly sells high and buys low.</p>
<h2 id="targets">Step 1: set targets</h2>
""" + steps(['Open a portfolio and click <strong>Allocations</strong>.',
            'Give each fund a target percentage; they must add up to 100. New funds you plan to buy can be added with a target and no units.',
            'Save. Every holding now shows current next to target, and you can see at a glance which fund is above or below.']) + """
<p>Targets are your decision. The app cannot know how much risk you want; it only measures the distance from what you chose.</p>
<h2 id="drift">Step 2: watch the drift</h2>
<p>Drift is current minus target. When any fund drifts more than the portfolio\'s threshold (5% by default, adjustable per portfolio) the portfolio shows <strong>Rebalance needed</strong> with each fund\'s current → target, the drift in points, a bar, the rupee amount and the action: reduce or add. The same portfolio appears under Rebalance needed on the dashboard and in the daily family email.</p>
<h2 id="ways">Step 3: fix it one of three ways</h2>
""" + table(['Method', 'What the app computes', 'When to use it'], [
    ['Adjust SIP', 'Next month\'s SIP split: the overweight fund gets ₹0, the funds that are short get more, the total stays your monthly SIP (for example ₹22,000 + ₹18,000 = ₹40,000).', 'The default for most families. Nothing is sold, no tax, no exit load; it takes a few months.'],
    ['Lump sum', 'How much new money, into which funds, brings everything to target without selling: for example ₹6.9 L split across the two funds that are short.', 'When a bonus or a maturing FD gives you new money.'],
    ['Buy and sell', 'Sell ₹3.5 L of the overweight fund, buy ₹1.9 L and ₹1.5 L of the others.', 'Only when there is no other way: it triggers capital gains tax and possibly exit load.']]) + """
<p>Click <strong>Rebalance</strong> on the portfolio to open the three tabs. For Adjust SIP the app needs your monthly SIP: set it once with <strong>Edit</strong> on the portfolio.</p>
<h2 id="blocked">Funds that no longer accept money</h2>
<p>Many international funds stopped accepting lump sums because of the overseas investment limit; some very large funds close for fresh money; and sometimes you simply decide not to add to a fund. Hover on the fund and use the icons to mark it <strong>SIP only</strong> (running SIP continues, no new lump sum suggested) or <strong>blocked</strong> (nothing new). The rebalance adjusts itself: targets are rescaled across the funds that still accept money (30% becomes 33%, 50% becomes 55%), the lump sum plan skips the blocked fund, and Adjust SIP moves its SIP amount to the others.</p>
<h2 id="high">Below its high is not a rebalance signal</h2>
<p>Next to Rebalance needed sits the <strong>Below high</strong> box: funds 5% or 10% below their own all-time-high NAV. It is a different thing. Drift is about your mix; below-high is about price. The app shows both as facts and recommends nothing; what you do with either is your decision.</p>
<h2 id="goals">Rebalancing and goals</h2>
<p>Portfolio targets are per fund. Goals add a second layer: each goal has an equity/debt target that falls as the date comes near (the glide path), and the <a href="/goal-based-investing/">goal planner</a> suggests which funds to move when a goal drifts from its path. Classify your funds in the <a href="/mutual-fund-portfolio-tracker/#breakdown">fund breakdown</a> so that layer knows what is equity and what is safe.</p>""",
     preview=(['funds'], 'What it looks like', 'Each fund against its target and its own high, on one portfolio page.'),
     faq=[('How often should I rebalance a mutual fund portfolio?', 'Most families check once or twice a year, or whenever a fund drifts more than about 5 points from its target. The app watches the drift daily so you only act when it matters.'),
          ('Is rebalancing by SIP really enough?', 'For a portfolio with a running SIP, usually yes: directing a few months of SIP to the funds that are short brings the mix back without selling or tax. Larger drifts need a lump sum or a switch.'),
          ('Does rebalancing have tax?', 'Adjusting SIPs or adding a lump sum has no tax. Selling or switching triggers capital gains tax (and exit load inside the exit period), which is why the app lists buy-and-sell last.'),
          ('What if a fund no longer accepts lump sums?', 'Mark it SIP only or blocked on the holdings table. The plans then rescale targets across the other funds and never suggest money into it.'),
          ('Can the app rebalance for me?', 'No. It has no connection to any broker or AMC. It shows the exact amounts; you place the orders where you invest.')],
     related=['mutual-fund-portfolio-tracker', 'goal-based-investing', 'sip-calculator', 'cams-cas-import'])

    # ───────────────────────── 7. stocks ─────────────────────────
    add('stock-portfolio-tracker', guide=True, nav='Stock portfolio tracker', blurb='Family stock holdings from a broker Excel or CDSL/NSDL statement.',
     title='Stock Portfolio Tracker for Families – Import Holdings From Your Broker or CDSL',
     desc='Track the family\'s direct stock holdings next to mutual funds: import a holdings Excel from Zerodha, Groww or any broker, or a CDSL/NSDL statement, see current value and profit per stock and per member, and count it in the family net worth and goals. No broker login.',
     h1='Stock portfolio tracker', lead='Direct stocks sit in the same family picture as mutual funds: import your holdings from your broker\'s Excel or a depository statement, see the value and profit of every stock for every member, and let the dashboard, net worth and goals count them. No broker login, nothing automated against your demat account.',
     body="""<h2 id="why">Why stocks belong next to the funds</h2>
<p>A family that holds ₹20 lakh of stocks in two demat accounts and ₹2 crore of mutual funds does not have two problems; it has one net worth and one set of goals. Keeping stocks in a separate app means the family email, the goal planner and the retirement buckets all miss them. Here the stock holdings are one more tab under the investment account they live in.</p>
<h2 id="import">How to import</h2>
""" + steps(['Download your holdings: in Zerodha Console, Groww, Upstox or any broker there is an export to Excel/CSV; or download the monthly CDSL or NSDL consolidated statement that covers every demat account.',
            'Open <strong>Stocks → Import</strong>, pick the member and the investment account, and upload the file. A sample Excel with the expected columns (symbol, quantity, average price) is linked on the page.',
            'Check the preview (symbol, quantity, average cost) and confirm. Holdings for the same account are updated, not duplicated.',
            'Add a few shares by hand with Add stock when you buy between imports.']) + """
<h2 id="see">What you see</h2>
""" + feat([('Per stock', 'Quantity, average price, current price, invested, current value, profit and percentage.'),
            ('Per member and per account', 'Which demat account holds what, mapped to the bank it pays into.'),
            ('In the family total', 'Stocks count in the dashboard\'s asset allocation, the net worth, and the daily family email.'),
            ('In goals', 'Stocks can be included in the money for goals like any other investment.')]) + """
<h2 id="prices">Prices</h2>
<p>Stock prices are refreshed with the daily update in your own Google account, alongside mutual fund NAVs and the gold rate, so the value on the dashboard and in the morning email is current.</p>
<h2 id="limits">What it is not</h2>
<p>It is a holdings tracker, not a trading app. There is no order placement, no intraday feed and no broker API. For traders that is a limitation; for a family record, it is the point: nothing in the app can move your money.</p>""",
     preview=(['networth'], 'In the family picture', 'Stocks, funds, gold, property and loans, added up for the whole family.'),
     faq=[('Which brokers are supported?', 'Any broker that exports holdings to Excel or CSV (Zerodha, Groww, Upstox, Angel One, ICICI Direct and others), plus CDSL and NSDL consolidated statements that cover every demat account.'),
          ('Does it connect to my demat account?', 'No. You upload a file; the app never logs in to a broker or depository.'),
          ('Are stock prices live?', 'They are refreshed daily by the update that runs in your Google account, which is enough for a family net worth. It is not an intraday terminal.'),
          ('Can I track ESOPs or unlisted shares?', 'Add them under Other Investments with a value you update yourself.'),
          ('Will the family email show my stocks?', 'Yes, each member\'s stock holdings and their value appear in that member\'s section of the daily email.')],
     related=['mutual-fund-portfolio-tracker', 'family-net-worth-tracker', 'cams-cas-import', 'family-members-and-accounts'])

    # ───────────────────────── 8. other investments & loans ─────────────────────────
    add('track-fd-ppf-epf-gold-property', guide=True, nav='FDs, PPF, EPF, gold, property and loans', blurb='Everything that is not a fund: gold by weight at today\'s rate, the house with its loan.',
     title='Track FD, PPF, EPF, NPS, Gold and Property in One Family Net Worth (Free)',
     desc='How to track fixed deposits, PPF, EPF, NPS, bonds, gold and silver by weight at today\'s rate, property with its home loan, and every other loan in one family net worth. What the family needs to know about each, and how EPF and PPF are used in retirement goals.',
     h1='FDs, PPF, EPF, gold, property and loans', lead='For most families the biggest numbers are not mutual funds: the house, the home loan, EPF after twenty years, the gold in the locker. Capital Friends tracks all of it under Other Investments and Liabilities, revalues gold every day, links a loan to the property it bought, and uses EPF and PPF correctly in the retirement plan.',
     body="""<h2 id="types">What goes under Other Investments</h2>
""" + table(['Type', 'What you enter', 'What the app does'], [
    ['Fixed deposit', 'Name, member, amount, bank, maturity date', 'Counts as safe money; reminds you before maturity; feeds near-term goals.'],
    ['PPF, EPF, NPS', 'Name, member, current value (update it when the statement comes)', 'Counted for the retirement goal only, never for a sell or switch step; marked Received when paid out.'],
    ['Bonds, debentures, SGB', 'Name, member, value, maturity', 'Safe money in the net worth and goals.'],
    ['Gold and silver', 'Weight in grams and purity (24K, 22K, 18K); or a value', 'Valued every day at the live rate; you never touch it again.'],
    ['Property', 'Name, member, what you paid, rough value today', 'Appears in net worth; link the home loan to it in the same form.'],
    ['Anything else', 'Name, member, value', 'ESOPs, chit funds, a loan you gave: the family should know it exists.']]) + """
<h2 id="gold">Gold by weight</h2>
<p>You do not need to know what your gold is worth. Enter the weight, say 250 grams, and the purity, 22 carat. The app looks up today\'s rate, shows the estimated value, and revalues it every day with the daily update. The live 24K and 22K gold and silver rates are shown at the top of the page.</p>
<h2 id="house">The house and its loan</h2>
""" + steps(['Add Investment → type <strong>Real Estate</strong>; a name and whose it is.',
            'What you paid (say ₹1.25 Cr) and roughly what it is worth today (₹1.6 Cr).',
            'Under <strong>Linked loans</strong>, click Create new loan and enter the lender, outstanding balance, EMI and interest rate, right in the same form.',
            'Add. The house appears in the assets with its loan linked, the loan appears under Liabilities with the EMI, rate and months left, and net worth is assets minus loans.']) + """
<h2 id="loans">Liabilities</h2>
<p>Home loan, car loan, personal loan, a loan from a relative: each with the lender, outstanding amount, EMI, interest rate and the number of months left, computed from the EMI. The dashboard shows total assets, total loans and net worth separately, and the daily email tells the family exactly what is owed and to whom; the loan nobody knew about is a common and expensive surprise.</p>
<h2 id="retirement">EPF, PPF and NPS in retirement</h2>
<p>These are retirement money with their own rules, so the goal planner treats them accordingly: they count towards the <a href="/goal-based-investing/">retirement goal</a> only, they are never part of a switch or sell step in the <a href="/retirement-bucket-strategy/">bucket plan</a>, and when one is paid out you press <strong>Received</strong> and tell the app which liquid or debt fund the money went to.</p>
<h2 id="dashboard">On the dashboard</h2>
<p>After adding an FD, EPF and gold the dashboard shows the split the first time most people see it: for example mutual funds 73% of the family\'s money, gold 12%, EPF 11%, FD 4%. Many families discover how much is in one place only here.</p>""",
     preview=(['networth'], 'Everything in one number', 'Gold at today\'s rate, the house with its loan, EPF and FDs, with the funds.'),
     faq=[('How is gold valued?', 'By weight and purity at the live market rate, refreshed daily. Enter 250 g of 22K and the app does the rest; you can override with a value if you prefer.'),
          ('Can I link a loan to the property it bought?', 'Yes. Create the loan inside the property form under Linked loans. The property shows its loan and the loan shows its asset.'),
          ('How does EPF count in retirement?', 'As retirement money only: it is included in the retirement goal and the stability bucket but never suggested for a sell or switch, since it has its own withdrawal rules.'),
          ('Do I have to update FD and PPF values?', 'FDs can be set with a maturity date and the app reminds you; PPF, EPF and NPS you update when the statement arrives. Gold and funds update themselves.'),
          ('Does the family email include loans?', 'Yes: lender, outstanding, EMI and months left, for every loan, in every email.')],
     related=['family-net-worth-tracker', 'net-worth-calculator', 'retirement-bucket-strategy', 'insurance-tracker'])

    # ───────────────────────── 9. insurance ─────────────────────────
    add('insurance-tracker', guide=True, nav='Insurance tracker with coverage check', blurb='Every policy with its nominee, and whether the cover is enough.',
     title='Family Insurance Tracker – Policies, Nominees and Whether the Cover Is Enough',
     desc='Keep every life and health policy of the family in one place with the nominee, premium and renewal date. Capital Friends checks coverage adequacy (term cover 10–15x income, ₹50 L–1 Cr health floater), reminds you before renewal, and puts policies and nominees in the daily family email.',
     h1='Insurance tracker', lead='At claim time the first question is "which policy, with whom, and who is the nominee?". The Insurance page answers it for every member: term and health policies, sum assured, premium and renewal date, the nominee on each, and a coverage check that tells you in red when the family is under-insured.',
     body="""<h2 id="add">Adding a policy</h2>
""" + steps(['Insurance → <strong>Add Policy</strong>. Type (term life, health, endowment, ULIP, vehicle, other), the insurer and a policy name the family will recognise.',
            'Whose life or health it covers (the insured member) and the <strong>nominee</strong>. The nominee field is on every policy on purpose.',
            'Sum assured, premium and frequency; the policy number is optional (even the last few digits make a claim faster).',
            'Add. Renewal reminders are created from the frequency; the premium date reaches you by email before it is due.']) + """
<h2 id="adequacy">Coverage adequacy</h2>
<p>The page adds up the family\'s cover and compares it with two common guidelines:</p>
""" + table(['Cover', 'Guideline', 'Shown as'], [
    ['Life (term) cover', '10–15× the earner\'s annual income', 'Covered, or the gap in rupees'],
    ['Health cover', '₹50 L to ₹1 Cr family floater, considering medical inflation', 'Covered, or Not covered in red']]) + """
<p>The same two checks drive the <a href="/financial-health-check/">financial health check</a> and the Action required cards on the dashboard: add a health policy and the "No health insurance" card goes away by itself.</p>
<h2 id="family">What the family sees</h2>
<p>In the daily email each member\'s section lists their policies with insurer, type, cover, premium and nominee. If something happens, the family opens one email and knows which company to call and who the nominee is, instead of searching cupboards for policy documents.</p>
<h2 id="tips">Three things worth checking today</h2>
<ul><li>Every policy has a nominee, and the nominee knows.</li>
<li>Term cover is in the 10–15× income range while there are dependants and loans.</li>
<li>The health floater covers the whole family and has kept up with medical inflation.</li></ul>
""" + NOTE('Guidelines are planning rules of thumb. Read each policy\'s terms and talk to a qualified adviser for your own case.'),
     preview=(['mail'], 'In the family email', 'Policies and nominees are part of every morning\'s summary.'),
     faq=[('Does the app sell insurance?', 'No. It records the policies you have and checks the cover against common guidelines. It earns nothing from any insurer.'),
          ('Why does it ask for a nominee on every policy?', 'Because at claim time that is the very first question, and a policy with the wrong or missing nominee is the most common reason claims stall.'),
          ('How much term cover does it recommend?', 'It uses the common guideline of 10–15 times annual income and shows the gap if the family is below it. It is a benchmark, not advice.'),
          ('Will it remind me before the premium is due?', 'Yes. Renewal reminders are created from the premium frequency and arrive by email before the date.'),
          ('Can I track my parents\' policies?', 'Yes, any member can be the insured on a policy, and each member\'s policies appear in their own section of the email.')],
     related=['financial-health-check', 'family-financial-blueprint-email', 'family-members-and-accounts', 'family-net-worth-tracker'])

    # ───────────────────────── 10. goals ─────────────────────────
    add('goal-based-investing', guide=True, nav='Goal-based investing with a glide path', blurb='Goals on a road, funded from the money you already have, moved to safety on time.',
     title='Goal-Based Investing: Retirement, Child Education and Any Goal With a Glide Path (Free)',
     desc='How goal planning works in Capital Friends: inflation-adjusted targets, a safe withdrawal rate for retirement, the SIP needed, which of your real funds count for each goal, and the glide path that moves money from equity to safe funds as the date comes near, only in good markets.',
     h1='Goal-based investing', lead='A goal is a date and an amount. Capital Friends puts your goals on a road, works out what each costs by its date, counts the money you already have against it, tells you the SIP still needed, and then, year by year, moves that goal\'s money from equity to safe funds as the date comes near. The money comes from the funds, FDs and EPF you already hold; nothing has to be bought specially.',
     body="""<h2 id="create">Creating a goal</h2>
""" + steps(['<strong>Goals → Add Goal</strong>. Type (Retirement, Child Education, House, Car, Travel, Wedding, Emergency fund, or Custom), a name, who it is for, and a priority.',
            'The numbers. For retirement: your age now, the age you want to retire, today\'s monthly expenses, inflation and expected return. For a child\'s education: the child\'s age and the course; the app sets the start date itself. For other goals: today\'s cost and the year.',
            'The app shows the future cost, the corpus needed, and the answer: the monthly SIP from today, or the lump sum needed today, with the suggested equity/debt split for that horizon.',
            'Review and create. The goal appears on the road with its year, have-today, need-today and status.']) + """
<h2 id="retirement">Retirement: inflation and the safe withdrawal rate</h2>
<p>Today\'s ₹50,000 a month at 7% inflation is ₹93,000 a month in nine years. The corpus has to pay that for the rest of your life, so the app sizes it with a <strong>safe withdrawal rate</strong> (SWR): the share you can take out in the first year, with the rest staying invested, so the money lasts until 85.</p>
""" + table(['Years the money must last', 'SWR', 'Corpus = yearly expenses ×'], [
    ['40 or more (retire before 45)', '3.0%', '33'], ['35–39', '3.3%', '30'], ['25–34 (around 55)', '4.0%', '25'], ['18–24', '5.0%', '20'], ['under 18 (retire after 68)', '6.0%', '17']]) + """
<p>Retire at 52 on ₹93,000 a month and the corpus is about ₹2.8 crore. The <a href="/retirement-corpus-calculator/">retirement corpus calculator</a> runs the same maths without sign-in, and the <a href="/retirement-bucket-strategy/">three-bucket guide</a> explains how the corpus is spent.</p>
<h2 id="money">Which money is for which goal</h2>
<p>You do not link funds to goals one by one. Click <strong>Money for goals</strong>, and you see every investment of the family. Tick the ones that are for goals in general: your funds, the FD, the EPF; leave out the kids\' own portfolios and the house. The app then shares that pool across all goals by itself: the near goal gets the safe money (the FD, the hybrid funds), the far goals get the equity, EPF and PPF go to retirement only. Open <strong>Investments</strong> on any goal to see exactly which funds and how much of each it uses.</p>
<h2 id="glide">The glide path</h2>
<p>A goal ten years away can sit in equity. The same goal one year away should not, because a bad year right before the date cuts the corpus with no time to recover. The glide path is the equity share the app targets for a goal by the years left:</p>
""" + table(['Years to the goal', 'Equity target'], [['more than 10', '85%'], ['7–10', '75%'], ['5–7', '65%'], ['3–5', '50%'], ['1–3', '30%'], ['under 1', '10%'], ['Emergency fund', '0% (all safe)']]) + """
<p>Retirement eases from 85% to 75% between ten and five years out, and in the last five years follows the <a href="/retirement-bucket-strategy/">bucket plan</a> instead. When a goal\'s equity is a few points above its path, the goal card shows the step: for example <em>2029: move ₹4.2 L from the flexicap fund to the FD</em>, with the fund names and units. Steps only trigger while the market is near its high, so you are never told to sell at a low. Goals paid over several years (four years of college fees) glide each year\'s part separately.</p>
<h2 id="status">On track or not</h2>
<p>Each goal shows <strong>Have today</strong> (its share of the pool), <strong>Need today</strong> (what, growing at the expected return, reaches the target by the date) and the gap. On track means nothing to add. If it drifts, the gap is shown as an extra SIP or lump sum, and the daily email carries it until it is closed.</p>
<h2 id="public">Try it without signing in</h2>
<p>The <a href="/goal-planner/">public goal planner</a> runs the same calculations for a retirement, education or custom goal and shows the year-by-year plan. Sign in to run it on your real investments with the glide path and alerts.</p>""",
     cta='goal', preview=(['goal', 'buckets'], 'A goal on the road', 'Funded from your own funds, with the next step on the glide path.'),
     faq=[('Do I need to assign each fund to a goal?', 'No. Tick which investments are for goals in general; the app shares them, giving near goals the safe money and far goals the equity. You can see and adjust the result on each goal.'),
          ('How is the retirement corpus calculated?', 'Today\'s monthly expenses are inflated to the retirement year, then a safe withdrawal rate that depends on how long the money must last (3% if you retire before 45, 4% around 55, up to 6% after 68) sizes the corpus. The gap after existing savings becomes the SIP needed.'),
          ('What is a glide path?', 'The equity share the app targets for a goal by the years left: 85% far out, down to 10% in the last year. As the date comes near it suggests moving a little each year from equity to safe funds, only in good markets.'),
          ('Does the app move the money?', 'No. It shows the step with fund names and amounts; you place the switch where you invest and record it.'),
          ('Can a goal be paid over several years?', 'Yes. College fees over four years are four parts, each with its own glide path, so the fourth year\'s money stays in growth longer than the first year\'s.'),
          ('Is this investment advice?', 'No. The plan is computed from your own numbers and standard rules; what you invest in and when is your decision.')],
     related=['retirement-bucket-strategy', 'retirement-corpus-calculator', 'goal-planner', 'portfolio-rebalancing', 'mutual-fund-portfolio-tracker'])

    # ───────────────────────── 11. retirement buckets ─────────────────────────
    add('retirement-bucket-strategy', guide=True, nav='Retirement bucket strategy', blurb='Three buckets, refilled in good years, so you never sell in a crash.',
     title='Three-Bucket Retirement Strategy in India – Income, Stability, Growth (With Your Own Funds)',
     desc='The three-bucket retirement withdrawal strategy explained with Indian examples: an income bucket of 2 years of expenses, a stability bucket of 5 years, growth for the rest. How the buckets are filled from your own funds and EPF, refilled in good years and left alone in bad years, and what happens in a long fall.',
     h1='The three-bucket retirement strategy', lead='Retirement is not one big withdrawal; it is thirty years of monthly expenses from a corpus that is still invested. The three-bucket strategy keeps two years of expenses in cash-like funds, the next five in stable funds, and the rest in equity, and refills the first two from the third only in good years. Capital Friends builds and runs it on your actual funds.',
     body="""<h2 id="problem">The problem it solves</h2>
<p>If all your retirement money is in equity and the market falls 30% in your first year of retirement, every withdrawal sells units at a low and the corpus may never recover: the sequence-of-returns risk. If it is all in fixed deposits, inflation eats it over thirty years. The buckets give you both: safety for the money you need soon, growth for the money you need later.</p>
<h2 id="buckets">The three jars</h2>
""" + table(['Bucket', 'Holds', 'Filled with', 'Pays'], [
    ['Income', '2 years of expenses', 'Liquid and short-duration debt funds', 'Your monthly expenses, from day one of retirement'],
    ['Stability', 'The next 5 years', 'Hybrid, conservative and debt funds, EPF/PPF when received', 'Refills Income in bad years'],
    ['Growth', 'Everything else', 'Equity funds', 'Refills both in good years']]) + """
<h2 id="build">Building the buckets: five years before retirement</h2>
<p>Until five years before your retirement date, everything grows together. Then, every quarter, the app moves a small amount from Growth to Stability, and in the last two years to Income too, so that on the retirement date the jars are full. It only moves money in a good market (the funds near their highs), so nothing is sold in one go or at a low. Each quarterly step is shown with the fund names and amounts; you make the switch and record it.</p>
<h2 id="rules">Running it: the yearly rules</h2>
""" + table(['The year was', 'What happens'], [
    ['Good (market near its high)', 'Growth sells a little to refill Income back to 2 years and tops up Stability.'],
    ['Bad (market down)', 'Growth is left alone. Stability refills Income instead.'],
    ['Recovery (back near its high after a fall)', 'Growth refills both Income and Stability.'],
    ['A long fall (years)', 'Stability keeps at least 2 years of expenses safe. If Income cannot be refilled, the app warns you so you can spend a little less for a while.']]) + """
<p>The idea in one line: you never have to sell equity in a crash, because the next seven years of expenses are already safe.</p>
<h2 id="app">What the app does</h2>
""" + steps(['Create a retirement goal; the corpus comes from today\'s expenses, inflation and a safe withdrawal rate (see <a href="/goal-based-investing/#retirement">goal-based investing</a>).',
            'Tick the money for goals. Your equity funds fill Growth, hybrid and debt funds fill Stability, EPF and PPF count in Stability but are never switched; when they are paid out you record where the money went.',
            'Open <strong>Buckets today</strong> on the goal: the three jars with their current amounts and the date filling starts, and <strong>How buckets work</strong> for the rules with pictures.',
            'From five years out, each quarterly step appears on the goal and in the daily email. After retirement, each month\'s income and each yearly refill appear the same way.']) + """
<h2 id="swp">Buckets and SWP</h2>
<p>A systematic withdrawal plan is the mechanism: the monthly expense is an SWP from the Income bucket\'s liquid fund. The <a href="/swp-calculator/">SWP calculator</a> shows how long a corpus lasts at a given withdrawal; the buckets decide which fund the withdrawal comes from so that equity is never the source in a bad year.</p>""",
     cta='retire', preview=(['buckets'], 'Your buckets, your funds', 'Growth, Stability and Income filled from the funds you hold, with the next quarterly step.'),
     faq=[('How many years should the income bucket hold?', 'Two years of expenses in liquid or short-term debt funds, so that no withdrawal depends on the market. The stability bucket holds the next five, so seven years of expenses are safe at any time.'),
          ('When does the app start filling the buckets?', 'Five years before your retirement date, every quarter, in small steps and only in good markets. Before that everything stays in the growth mix.'),
          ('What happens in a market crash after retirement?', 'Growth is left alone. Income pays your expenses; Stability refills Income. Only when the market is back near its high does Growth refill the other two.'),
          ('Where do EPF and PPF go?', 'They count towards Stability but are never part of a switch or sell step. When they are paid out, you press Received and tell the app which fund the money went to.'),
          ('Does the app execute the switches?', 'No. It shows each step with fund names, units and amounts; you place it with your AMC or broker and record it.')],
     related=['goal-based-investing', 'retirement-corpus-calculator', 'swp-calculator', 'track-fd-ppf-epf-gold-property'])

    # ───────────────────────── 12. family net worth ─────────────────────────
    add('family-net-worth-tracker', guide=True, nav='Family net worth tracker', blurb='Every member, every asset and loan, one dashboard, one number.',
     title='Family Net Worth Tracker – Every Member, Every Asset, One Dashboard (Free)',
     desc='Track your whole family\'s net worth for free: mutual funds, stocks, FDs, EPF, gold by weight, property and loans for every member, revalued daily, in a Google Sheet in your own Drive. The dashboard shows net worth, allocation, funds below their high, rebalances due and every goal\'s progress.',
     h1='Family net worth tracker', lead='One dashboard for the whole family: net worth, total assets, the loans, the split across every asset type, the funds below their high, the portfolios that need a rebalance, the best performers, and all goals with their progress. Every number belongs to a person and comes from the statements you imported.',
     body="""<h2 id="why">Why net worth, and why the family\'s</h2>
<p>Income says what you earn; net worth says what you keep. Tracking it for the family, not just yourself, is what makes the number honest: your spouse\'s funds, the parents\' FDs, the kids\' education portfolios and the home loan all belong in it. And it is the number your family will need on the worst day: where everything is, and what it is worth.</p>
<h2 id="what">What it adds up</h2>
""" + feat([('Mutual funds', 'Every family member\'s funds from CAMS statements, with money-in, XIRR and CAGR.'),
            ('Stocks', 'Holdings from broker Excel or CDSL/NSDL statements, per demat account.'),
            ('Other investments', 'FDs, PPF, EPF, NPS, bonds, gold and silver by weight at today\'s rate, property.'),
            ('Loans', 'Home, car and personal loans with EMI and months left; net worth is assets minus loans.'),
            ('Insurance', 'Not an asset, but listed with cover and nominees so the family knows.'),
            ('Bank and investment accounts', 'Which accounts exist and which platform is mapped to which bank.')]) + """
<h2 id="dashboard">The dashboard, section by section</h2>
""" + steps(['<strong>Net worth</strong>: assets, loans and the net figure, with a bar of the split (equity, debt, real estate, gold, commodities).',
            '<strong>Asset allocation</strong>: a donut with every asset type and its share; the first time most families see that 73% of their money is in one place.',
            '<strong>Action required</strong>: the open items from the financial health check, until each is fixed.',
            '<strong>Below high</strong>: funds 5% or 10% below their own all-time high, with the percentage.',
            '<strong>Rebalance needed</strong>: portfolios whose funds have drifted from their targets, with the amounts.',
            '<strong>Fund and portfolio performance</strong>: top gainers by rupee and percentage, best portfolios by return.',
            '<strong>Financial goals</strong>: every goal with have-today, the target, years left and on-track status.']) + """
<h2 id="daily">Kept current without you</h2>
<p>NAVs, stock prices and the gold rate refresh daily through the scheduled update that runs in your own Google account; the net worth on the dashboard and in the morning email is today\'s. Only things without a market price (an FD, EPF, the house) are updated when you choose.</p>
<h2 id="privacy">Private by design</h2>
<p>There is no bank login and no server database. All of this lives in one Google Sheet in your Drive; switch on the mask to hide names and numbers on screen when you share it. Read <a href="/your-data-in-your-google-drive/">how your data is stored</a>.</p>
<h2 id="email">And the family gets it every morning</h2>
<p>The same dashboard, as one email, to the members you choose: the <a href="/family-financial-blueprint-email/">family financial blueprint</a>.</p>""",
     preview=(['networth', 'mail'], 'The dashboard and the email', 'The same numbers, on screen for you and in the inbox for the family.'),
     faq=[('Is the family net worth tracker free?', 'Yes, free and open source for any family, with no ads. Donations are voluntary.'),
          ('Does it need bank logins?', 'No. Funds come from a CAMS statement, stocks from a broker file, and everything else you enter once. Bank accounts are a list.'),
          ('Can I track my parents\' money too?', 'Yes. Add them as members, import their CAMS statements, add their FDs and policies. Each has their own section in the email.'),
          ('How is gold valued?', 'By weight and purity at the live rate, refreshed daily.'),
          ('Does the net worth include the house and the loan?', 'Yes: the property at the value you enter, and the loan linked to it under liabilities. Net worth is assets minus loans.'),
          ('What is the net worth calculator?', 'A quick no-sign-in version for a rough number: the <a href="/net-worth-calculator/">net worth calculator</a>. The app does it with your real statements every day.')],
     related=['net-worth-calculator', 'mutual-fund-portfolio-tracker', 'track-fd-ppf-epf-gold-property', 'family-financial-blueprint-email', 'your-data-in-your-google-drive'])

    # ───────────────────────── 13. the family email ─────────────────────────
    add('family-financial-blueprint-email', guide=True, nav='The daily family email', blurb='One email every morning: where everything is, for the people who would need it.',
     title='Family Financial Blueprint – A Daily Email So Your Family Knows Where Everything Is',
     desc='If something happens to you, will your family know where the money is? Capital Friends sends one email every morning from your own Gmail to the family members you choose: net worth, every account, every fund, policies with nominees, loans, goals, reminders and alerts. No server in between.',
     h1='The family financial blueprint: one email every morning', lead='In most families all of the money sits in one person\'s head. This is the feature Capital Friends was built for: every morning, from your own Gmail, your family receives one email with every account, every fund, every policy and its nominee, every loan and every goal. If something happens to you, they open one email and know where everything is.',
     body="""<h2 id="why">Why an email, and why daily</h2>
<p>After losing someone, families search: where are the investments, which bank, who do we call. A PAN traces some of it, months later; much of it is never found. An email is the one thing everyone knows how to open, it is in their inbox even if the app is forgotten, and sending it daily means it is never out of date. Nobody has to remember to share anything.</p>
<h2 id="inside">What is in it</h2>
""" + table(['Section', 'What it says'], [
    ['Financial summary', 'Total assets, liabilities, net worth and total term cover for the family.'],
    ['Critical alerts', 'Open items from the health check (no term cover, no Will, nominees missing), with a score.'],
    ['Per member', 'Personal details (email, mobile; PAN and Aadhaar masked), bank accounts, investment accounts with the mapped bank, every mutual fund with units and value, stocks, other investments, insurance policies with nominee, loans.'],
    ['Funds below their high', 'Which funds are 5% or 10% below their own all-time high. Information, not advice.'],
    ['Rebalance required', 'Portfolios that have drifted from their targets.'],
    ['Financial goals', 'Each goal\'s have-today, target, years left and status; the next step on the glide path or in the buckets.'],
    ['Reminders', 'SIP dates, insurance premiums, FD maturities and loan EMIs coming up.'],
    ['Performance', 'Top funds and portfolios, so the family also sees what is going well.']]) + """
<h2 id="setup">Setting it up</h2>
""" + steps(['Add your family members and tick <strong>Include in email reports</strong> for those who should receive it. Each needs an email address.',
            'Switch on <strong>Daily updates</strong> in Settings → Data &amp; Sync, so the email can go out from a schedule in your own Google account.',
            'In Settings → <strong>Email reports</strong>, choose daily or monthly and the send time, pick the recipients and save. <strong>Send Report Now</strong> sends a test immediately.',
            'Check the inbox. The subject is <em>&lt;family&gt; Family – Financial Summary | net worth – date</em>; the email is self-contained, with every section above.']) + """
<h2 id="reminders">Reminders inside it</h2>
<p>The app creates reminders from what it already knows (SIP dates from your CAS, premium dates from policies, FD maturities) and lets you add your own: loan EMIs, an investment review, anything custom. They are listed in the email before they fall due, so a missed SIP or a lapsed policy stops being a surprise.</p>
<h2 id="privacy">Privacy of the email</h2>
<ul><li>It is sent from <strong>your</strong> Gmail account by a script running in <strong>your</strong> Google account; it never passes through a Capital Friends server.</li>
<li>PAN, Aadhaar and account numbers are masked. Members see the family picture, not identity documents.</li>
<li>You choose who receives it; a spouse and one adult child is a common choice.</li></ul>
<h2 id="ask">The task we give everyone</h2>
<p>Ask your spouse or your parents tonight: where do we invest, which insurance do we have, who is the nominee? If they cannot answer, this email is the fix, and it takes an hour to set up from an empty Drive. The <a href="/">demo video</a> shows the whole thing.</p>""",
     preview=(['mail', 'networth'], 'What they receive', 'The dashboard as one email, every morning.'),
     faq=[('Who sends the email?', 'Your own Gmail account, through a scheduled script in your Google account. Capital Friends has no server; nothing is sent through us.'),
          ('Can I choose who gets it?', 'Yes. Tick Include in email reports on each member, and pick the recipients again in Settings → Email reports. You can send it to yourself only.'),
          ('Daily or monthly?', 'Either, at a time you choose. Daily keeps it current; monthly keeps the inbox quiet. The alerts (funds below their high, rebalance, goal steps) also reach the recipients.'),
          ('Are PAN and account numbers in the email?', 'They are masked. The email tells the family which bank and which platform; it is not a document for identity theft.'),
          ('What if I stop using the app?', 'Switch off daily updates in Settings and delete the sheet from your Drive. The emails stop and no data remains.')],
     related=['your-data-in-your-google-drive', 'family-net-worth-tracker', 'insurance-tracker', 'financial-health-check'])

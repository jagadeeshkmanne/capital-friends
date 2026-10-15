#!/usr/bin/env python3
"""Generates the public SEO pages (calculators + feature pages) into react-app/public/<slug>/index.html,
plus public/sitemap.xml and public/seo/{site.css,calc.js}. Run: python3 seo/gen.py  (from react-app/).
Content lives in PAGES below; edit and re-run. The pages are plain HTML so Google indexes them fully."""
import os, json, re, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
SITE = 'https://capitalfriends.in'
TODAY = datetime.date.today().isoformat()
APP_CTA = '/'

# ─────────────────────────── shared chrome ───────────────────────────
CSS = r"""
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:#0891b2;text-decoration:none}a:hover{text-decoration:underline}
header.top{position:sticky;top:0;z-index:50;background:rgba(10,15,31,.98);border-bottom:1px solid rgba(255,255,255,.06)}
header.top .in{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:56px}
.brand{display:flex;align-items:center;gap:8px;font-family:'Poppins',sans-serif;font-size:17px;letter-spacing:-.3px}
.brand img{height:40px}.brand b{color:#fff;font-weight:700}.brand em{color:#34d399;font-weight:800;font-style:normal}
.nav a{color:#cbd5e1;font-size:13px;margin-left:16px}.nav a.go{background:#10b981;color:#06281b;font-weight:700;padding:7px 14px;border-radius:8px}
.nav a.go:hover{background:#34d399;text-decoration:none}
@media(max-width:640px){.nav a:not(.go){display:none}}
main{max-width:1100px;margin:0 auto;padding:28px 16px 56px}
.crumbs{font-size:12.5px;color:#64748b;margin-bottom:14px}.crumbs a{color:#64748b}
h1{font-family:'Poppins',sans-serif;font-size:clamp(26px,4vw,38px);line-height:1.15;letter-spacing:-.5px;margin-bottom:10px}
.lead{font-size:17px;color:#334155;max-width:760px;margin-bottom:22px}
h2{font-family:'Poppins',sans-serif;font-size:22px;margin:36px 0 12px;letter-spacing:-.3px}
h3{font-size:16px;font-weight:700;margin:18px 0 6px}
p{margin-bottom:12px;color:#334155}li{color:#334155;margin:4px 0 4px 18px}
.grid{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:22px;align-items:start}
@media(max-width:820px){.grid{grid-template-columns:1fr}}
.calc{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.calc label{display:block;font-size:12.5px;font-weight:600;color:#475569;margin:12px 0 5px}.calc label:first-child{margin-top:0}
.calc input,.calc select{width:100%;font:inherit;font-size:15px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#0f172a}
.calc input:focus{outline:2px solid #34d399;border-color:#10b981;background:#fff}
.calc .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.calc .hint{font-size:11.5px;color:#64748b;margin-top:4px}
.flow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:8px;align-items:center}.flow button{font:inherit;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:9px 10px;cursor:pointer;color:#64748b}
#add-flow{margin-top:10px;font:inherit;font-size:13px;font-weight:600;border:1px dashed #94a3b8;background:#fff;border-radius:8px;padding:9px 12px;cursor:pointer;width:100%;color:#0f172a}
.result{background:linear-gradient(135deg,#0b1220,#13233b);color:#fff;border-radius:14px;padding:20px}
.result .big{font-family:'Poppins',sans-serif;font-size:clamp(28px,5vw,40px);font-weight:800;line-height:1.1;color:#34d399}
.result .lbl{font-size:11.5px;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
.result .kv{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.result .kv div{background:rgba(255,255,255,.06);border-radius:10px;padding:10px 12px}
.result .kv b{display:block;font-size:19px;font-weight:700}.result .note{font-size:14px;color:#cbd5e1;line-height:1.55}
.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;margin-top:14px;background:rgba(255,255,255,.08)}.bar-a{background:#38bdf8}.bar-b{background:#34d399}
.bar-l{display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1;margin-top:6px}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.dot-a{background:#38bdf8}.dot-b{background:#34d399}
.tbl{margin-top:16px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;background:#fff}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{background:#f1f5f9;text-align:left;padding:9px 12px;font-weight:600;color:#475569}td{padding:8px 12px;border-top:1px solid #f1f5f9;white-space:nowrap}
.cta{margin:34px 0;background:#0b1220;color:#fff;border-radius:16px;padding:26px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}
@media(max-width:640px){.cta{grid-template-columns:1fr}}
.cta h2{margin:0 0 6px;color:#fff;font-size:21px}.cta p{color:#cbd5e1;margin:0}.cta a{display:inline-block;background:#10b981;color:#06281b;font-weight:700;padding:12px 20px;border-radius:10px;white-space:nowrap}.cta a:hover{background:#34d399;text-decoration:none}
.faq details{border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:12px 16px;margin:8px 0}.faq summary{cursor:pointer;font-weight:600;list-style:none}.faq summary::-webkit-details-marker{display:none}.faq p{margin:8px 0 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px}.card a{font-weight:700;color:#0f172a}.card p{font-size:13px;margin:4px 0 0;color:#64748b}
.feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:14px 0}.feat div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}.feat b{display:block;margin-bottom:4px}.feat p{font-size:13.5px;margin:0}
.steps{counter-reset:s}.steps li{list-style:none;margin:10px 0;padding-left:40px;position:relative}.steps li::before{counter-increment:s;content:counter(s);position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;background:#0b1220;color:#34d399;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px}
.disc{font-size:12.5px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:30px}
footer.bot{background:#080d1a;color:#64748b;font-size:12.5px}footer.bot .in{max-width:1100px;margin:0 auto;padding:26px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}
footer.bot b{color:#94a3b8;display:block;margin-bottom:8px;font-size:12px;letter-spacing:1px;text-transform:uppercase}footer.bot a{color:#94a3b8;display:block;margin:4px 0}footer.bot .legal{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.06);padding-top:14px;color:#475569}
"""

GA = """<script src="/ga.js" defer></script>"""

def head(p, url):
    ld = json.dumps(p['ld'], ensure_ascii=False)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{p['title']}</title>
<meta name="description" content="{p['desc']}" />
<link rel="canonical" href="{url}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0a0f1f" />
<link rel="icon" type="image/png" href="/favicon.png" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="Capital Friends" />
<meta property="og:url" content="{url}" /><meta property="og:title" content="{p['title']}" />
<meta property="og:description" content="{p['desc']}" /><meta property="og:image" content="{SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="{p['title']}" /><meta name="twitter:description" content="{p['desc']}" /><meta name="twitter:image" content="{SITE}/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/seo/site.css" />
<script type="application/ld+json">{ld}</script>
{GA}
</head>"""

def header():
    return """<header class="top"><div class="in">
<a class="brand" href="/"><img src="/logo-new.png" alt="Capital Friends logo" /><span><b>Capital</b> <em>Friends</em></span></a>
<nav class="nav"><a href="/goal-planner/">Goal planner</a><a href="/tools/">Calculators</a><a href="/mutual-fund-portfolio-tracker/">Portfolio tracker</a><a href="/family-net-worth-tracker/">Family net worth</a><a href="/retirement-bucket-strategy/">Retirement</a><a class="go" href="/">Open the free app</a></nav>
</div></header>"""

def footer(tools, feats):
    t = ''.join(f'<a href="/{s}/">{PAGES[s]["nav"]}</a>' for s in tools)
    f = ''.join(f'<a href="/{s}/">{PAGES[s]["nav"]}</a>' for s in feats)
    return f"""<footer class="bot"><div class="in">
<div><b>Free calculators</b>{t}</div>
<div><b>Capital Friends</b><a href="/goal-planner/">Goal planner (free)</a>{f}<a href="/">Open the app</a><a href="/donate">Support the project</a></div>
<div><b>Trust</b><a href="/privacy/">Privacy policy</a><a href="/terms/">Terms</a><a href="https://github.com/jagadeeshkmanne/capital-friends" rel="noopener">Open source on GitHub</a><a href="https://www.youtube.com/@capitalfriendsin" rel="noopener">YouTube channel</a></div>
<div class="legal">Capital Friends is a free, open-source family portfolio tracker. Your data stays in your own Google Drive. Calculators and content are for information only and are not investment advice. Mutual fund investments are subject to market risks; read all scheme related documents carefully. © {datetime.date.today().year} Jagadeesh Manne.</div>
</div></footer>"""

def faq_html(faq):
    return '<section class="faq"><h2>Frequently asked questions</h2>' + ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in faq) + '</section>'

def faq_ld(faq):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}} for q, a in faq]}

def crumbs_ld(name, url):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Capital Friends", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": url}]}

def related(slugs):
    return '<h2>More free tools</h2><div class="cards">' + ''.join(f'<div class="card"><a href="/{s}/">{PAGES[s]["nav"]}</a><p>{PAGES[s]["blurb"]}</p></div>' for s in slugs) + '</div>'

CTA = {
 'default': ("Track the real thing, not just the estimate", "Capital Friends is a free, open-source portfolio tracker for Indian families. Import your CAMS statement, see XIRR and CAGR for every fund, plan goals and retirement, and let your family get one summary email. Your data stays in your own Google Drive.", "Open the free app"),
 'retire': ("Plan retirement with your real portfolio", "Capital Friends turns this calculation into a plan: it counts your existing funds, EPF and FDs, shows the SIP still needed, and runs the three-bucket withdrawal strategy on your own money. Free, data in your Google Drive.", "Plan my retirement, free"),
 'goal': ("Put real money against this goal", "In Capital Friends every goal gets a road: which of your funds are counted for it, how much is still short, and when to move money from equity to safe as the date comes near. Free, no bank login.", "Plan my goals, free"),
 'xirr': ("Get XIRR for every fund, automatically", "Stop typing cashflows. Import your CAMS statement into Capital Friends and get XIRR, CAGR, real money-in and profit for every fund, every portfolio and the whole family. Free and open source.", "Import my CAS statement"),
}

def field(id, label, val, step=None, hint=None, typ='number', attrs=''):
    st = f' step="{step}"' if step else ''
    h = f'<div class="hint">{hint}</div>' if hint else ''
    return f'<label for="{id}">{label}</label><input id="{id}" type="{typ}" value="{val}" inputmode="decimal"{st} {attrs}/>{h}'

def calc_html(p):
    c = p['calc']
    form = ''.join(c['fields'])
    res = f"""<div class="result"><div class="lbl">{c['out'][0]}</div><div class="big" id="r-value">—</div>
<div class="kv"><div><div class="lbl">{c['out'][1]}</div><b id="r-invested">—</b></div><div><div class="lbl">{c['out'][2]}</div><b id="r-gain">—</b></div></div>
<div id="r-bar"></div><p class="note" id="r-note" style="margin-top:14px"></p></div>"""
    tbl = '<div class="tbl" id="r-table"></div>' if c.get('table', True) else ''
    return f'<div class="grid"><form class="calc" data-calc="{c["id"]}" onsubmit="return false">{form}</form><div>{res}{tbl}</div></div>'

def page(slug, p, tools, feats):
    url = f'{SITE}/{slug}/'
    ld = [crumbs_ld(p['h1'], url)]
    if p.get('calc'):
        ld.append({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": p['h1'], "applicationCategory": "FinanceApplication", "operatingSystem": "Web", "url": url, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "description": p['desc'], "publisher": {"@type": "Organization", "name": "Capital Friends", "url": SITE}})
    else:
        ld.append({"@context": "https://schema.org", "@type": "WebPage", "name": p['h1'], "url": url, "description": p['desc'], "isPartOf": {"@type": "WebSite", "name": "Capital Friends", "url": SITE}})
    ld.append(faq_ld(p['faq']))
    p = dict(p, ld=ld)
    t, d, b = CTA[p.get('cta', 'default')]
    body = p['body']
    html = head(p, url) + '<body>' + header() + '<main>' + \
        f'<div class="crumbs"><a href="/">Capital Friends</a> › {"<a href=/tools/>Calculators</a> › " if p.get("calc") else ""}{p["h1"]}</div>' + \
        f'<h1>{p["h1"]}</h1><p class="lead">{p["lead"]}</p>' + \
        (calc_html(p) if p.get('calc') else '') + body + \
        f'<div class="cta"><div><h2>{t}</h2><p>{d}</p></div><a href="{APP_CTA}">{b} →</a></div>' + \
        faq_html(p['faq']) + related(p['related']) + \
        '<p class="disc">Calculators use the inputs you enter and standard formulas; results are estimates, not guarantees. Returns from mutual funds, stocks and other investments are not fixed and can be lower than assumed. Capital Friends is a tracking tool and is not a SEBI-registered investment adviser; nothing here is a recommendation to buy or sell any security.</p>' + \
        '</main>' + footer(tools, feats) + ('<script src="/seo/calc.js" defer></script>' if p.get('calc') else '') + '</body></html>'
    return html

# ─────────────────────────── pages ───────────────────────────
PAGES = {}
def add(slug, **kw): PAGES[slug] = kw

# ---- calculators ----
add('sip-calculator', nav='SIP calculator', blurb='Monthly SIP → value after N years, with optional yearly step-up.',
 title='SIP Calculator – SIP, Step-up SIP and SIP + Lumpsum Returns (Free)',
 desc='Free SIP calculator for Indian mutual funds: monthly SIP value after 5–30 years, with optional yearly step-up and a starting lumpsum (SIP + lumpsum), and a year-by-year table. No sign-up.',
 h1='SIP Calculator', lead='Find out what your monthly SIP can grow to. Enter the amount, the expected return and the number of years. Add a yearly step-up to see how raising your SIP with your salary changes the result, or a starting lumpsum to combine both.',
 calc=dict(id='sip', out=['Estimated value', 'Total invested', 'Estimated returns'], fields=[
   field('f-amount', 'Monthly SIP (₹)', 10000, 500), field('f-rate', 'Expected return (% per year)', 12, 0.5, 'Equity funds have given 10–14% over long periods; use 7–8% for debt funds.'),
   field('f-years', 'Investment period (years)', 15, 1), '<div class="row">' + field('f-stepup', 'Yearly step-up (%)', 0, 1, 'Optional: raise the SIP every year, e.g. 10% with your salary.') + field('f-lump', 'Starting lumpsum (₹)', 0, 10000, 'Optional: money you invest today along with the SIP.') + '</div>']),
 body="""<h2>How the SIP calculator works</h2>
<p>A SIP (Systematic Investment Plan) invests a fixed amount every month. Each instalment then compounds for the months left in your period, so early instalments grow the most. The calculator uses the standard SIP formula with monthly compounding:</p>
<p><strong>Value = P × [((1 + r)<sup>n</sup> − 1) ÷ r] × (1 + r)</strong>, where P is the monthly SIP, r is the monthly rate (yearly return ÷ 12) and n is the number of months. With a step-up, the SIP amount is raised once a year and the same formula runs month by month.</p>
<h2>What the numbers mean</h2>
<ul><li><strong>Total invested</strong> is only the money that left your bank account. It never includes profit that moved between funds.</li>
<li><strong>Estimated returns</strong> is the growth on top of that, before tax and exit load.</li>
<li>The year-by-year table shows when compounding starts doing the heavy lifting: in a 20-year SIP, more than half of the final value usually comes from returns, not instalments.</li></ul>
<h2>Why a step-up SIP matters</h2>
<p>Most people start a SIP they can afford today and never raise it. A 10% yearly step-up on a ₹10,000 SIP at 12% for 20 years adds roughly ₹70 lakh to the final value compared with a flat SIP. Try it above: switch the step-up between 0 and 10 and watch the difference.</p>
<h2>SIP calculator vs your real portfolio</h2>
<p>A calculator assumes one steady return. Real funds rise and fall, SIPs get paused, and money is switched between funds. That is why the invested amount in most apps drifts away from what you actually put in. Capital Friends reads your CAMS statement and shows your real SIPs, real money-in and the XIRR you are actually earning, for every family member.</p>""",
 faq=[('Is a SIP calculator accurate?', 'It is accurate for the assumptions you enter. Real mutual fund returns vary year to year, so treat the result as a planning estimate, and review it against your actual XIRR once a year.'),
      ('What return should I assume for a SIP?', 'For diversified equity funds, 10–12% a year is a common long-term planning assumption. For hybrid funds 9–10%, and for debt funds 6–8%. Lower assumptions keep you safe.'),
      ('Is SIP better than lump sum?', 'A SIP spreads purchases over time, so you buy more units when prices are low. A lump sum works better when markets rise steadily. Most salaried investors use a SIP because income arrives monthly. Compare both with the <a href="/lumpsum-calculator/">lumpsum calculator</a>.'),
      ('How is SIP return calculated for an existing portfolio?', 'For money already invested, use XIRR, which accounts for the date of every instalment. The <a href="/xirr-calculator/">XIRR calculator</a> does this, and Capital Friends does it automatically from your CAMS statement.'),
      ('Does the calculator include tax?', 'No. Equity fund gains above ₹1.25 lakh a year are taxed at 12.5% (long term), so your take-home value will be a little lower.')],
 related=['lumpsum-calculator', 'xirr-calculator', 'retirement-corpus-calculator', 'cagr-calculator'])

add('lumpsum-calculator', nav='Lumpsum calculator', blurb='One-time investment → future value at a given return.',
 title='Lumpsum Calculator – Mutual Fund One-time Investment Returns (Free)',
 desc='Free lumpsum investment calculator for mutual funds. Enter an amount, expected return and years to see the future value, the multiple and a year-by-year table.',
 h1='Lumpsum Investment Calculator', lead='See what a one-time investment grows to with compounding. Useful for a bonus, a maturing FD, or money sitting in savings that you want to invest for a goal.',
 calc=dict(id='lumpsum', out=['Estimated value', 'Invested', 'Estimated returns'], fields=[
   field('f-amount', 'Investment amount (₹)', 500000, 10000), field('f-rate', 'Expected return (% per year)', 12, 0.5), field('f-years', 'Investment period (years)', 10, 1)]),
 body="""<h2>The lumpsum formula</h2>
<p><strong>Value = P × (1 + r)<sup>n</sup></strong>, where P is the amount invested, r the yearly return and n the number of years. Doubling time is roughly 72 ÷ return: at 12% money doubles every 6 years, so ₹5 lakh becomes about ₹10 lakh in 6 years and ₹20 lakh in 12.</p>
<h2>Lumpsum or SIP?</h2>
<p>A lump sum puts all the money to work on day one, which wins when the market goes up steadily. A SIP spreads the risk of a bad entry point. A common middle path is a lumpsum into a liquid or arbitrage fund with an STP (systematic transfer) into equity over 6–12 months. Compare the two with the <a href="/sip-calculator/">SIP calculator</a>.</p>
<h2>Is it a good time to invest a lump sum?</h2>
<p>Headlines talk about Nifty. Your funds are not Nifty. A large-cap fund may be 15% below its high while your small-cap fund is only 3% below. Capital Friends shows each of your funds against its own all-time high, so you look at your own money, not the news, before adding a lump sum. That is information, not advice.</p>""",
 faq=[('Which is better, lumpsum or SIP?', 'Historically a lump sum in a rising market beats a SIP, but a SIP protects you from a bad entry. If the amount is large relative to your portfolio, spreading it over 6–12 months is a reasonable compromise.'),
      ('What return should I use?', 'Use 10–12% for equity funds, 7–8% for debt, 9–10% for hybrid, and a lower number if you want a conservative plan.'),
      ('Does the calculator include exit load or tax?', 'No. Equity funds held over a year attract 12.5% long-term capital gains tax on gains above ₹1.25 lakh a year; exit loads usually apply only in the first year.'),
      ('Can some funds refuse a lumpsum?', 'Yes. Several international funds and some funds with very large AUM stop fresh lumpsum investments from time to time. Capital Friends lets you mark such funds so rebalancing suggestions skip them.')],
 related=['sip-calculator', 'cagr-calculator', 'swp-calculator', 'xirr-calculator', 'fire-calculator'])

add('swp-calculator', nav='SWP calculator', blurb='How long a corpus lasts with monthly withdrawals.',
 title='SWP Calculator – Systematic Withdrawal Plan, Monthly Income from a Corpus',
 desc='Free SWP calculator: enter your corpus, monthly withdrawal, expected return and inflation to see how long the money lasts and what is left. For retirees and FIRE planners in India.',
 h1='SWP Calculator (Systematic Withdrawal Plan)', lead='A Systematic Withdrawal Plan pays you a fixed amount every month from a mutual fund while the rest stays invested. This calculator shows whether your corpus survives the period, and what remains.',
 calc=dict(id='swp', out=['Corpus left at the end', 'Total withdrawn', 'Money lasts for'], fields=[
   field('f-corpus', 'Starting corpus (₹)', 10000000, 100000), field('f-withdraw', 'Monthly withdrawal (₹)', 50000, 1000),
   field('f-rate', 'Expected return on the corpus (% per year)', 8, 0.5, 'Use 6–8% for debt/hybrid, 10% if a part stays in equity.'), field('f-inflation', 'Raise the withdrawal every year by (%)', 6, 0.5, 'Set 0 for a fixed withdrawal.'),
   field('f-years', 'Withdrawal period (years)', 30, 1)]),
 body="""<h2>How the SWP calculator works</h2>
<p>Every month the corpus earns one month of return and then pays out the withdrawal. If you set an inflation rate, the withdrawal is raised once a year so your income keeps its purchasing power. The table shows the withdrawal in force each year, the total paid out and the corpus left. If the corpus reaches zero before the end, the result tells you how many years it lasted.</p>
<h2>The rule of thumb</h2>
<p>If the yearly withdrawal is under 4% of the corpus and the corpus earns more than inflation, the money typically lasts 30+ years. ₹1 crore paying ₹33,000 a month is 4%. At ₹50,000 a month (6%) with 6% inflation and an 8% return, the corpus is gone in about 21 years. Try both above.</p>
<h2>SWP vs dividend option vs FD interest</h2>
<ul><li>An SWP lets you decide the amount; a dividend (IDCW) payout is decided by the fund and is fully taxable.</li>
<li>Only the gain inside each withdrawal is taxed, which usually makes an SWP more tax-efficient than FD interest.</li>
<li>Withdrawing from equity in a crash locks in losses. A bucket approach, where 2–3 years of expenses sit in safe funds, avoids that. See the <a href="/retirement-bucket-strategy/">three-bucket retirement strategy</a>.</li></ul>""", cta='retire',
 faq=[('What is a safe SWP rate?', 'Around 3.5–4% of the corpus a year, rising with inflation, has historically lasted 30 years in most cases. Higher rates work only if returns stay high, which you cannot count on.'),
      ('Is SWP taxable?', 'Each withdrawal is part capital and part gain; only the gain portion is taxed, at the capital-gains rate for that fund type. That is why SWPs are usually better than taking dividends or FD interest in a high tax bracket.'),
      ('Which fund is good for SWP?', 'A low-volatility fund such as a conservative hybrid, balanced advantage or short-duration debt fund for the income part, with equity kept separate for growth. Capital Friends models this as three buckets.'),
      ('What happens to an SWP in a market fall?', 'More units are sold to pay the same amount, which hurts long-term value. Keeping two years of withdrawals in a safe bucket and pausing equity withdrawals during a fall solves this.')],
 related=['retirement-corpus-calculator', 'fire-calculator', 'lumpsum-calculator', 'cagr-calculator', 'emergency-fund-calculator', 'sip-calculator'])

add('cagr-calculator', nav='CAGR calculator', blurb='Annualised growth from a start value, end value and years.',
 title='CAGR Calculator – Annualised Return of an Investment (Free)',
 desc='Free CAGR calculator: enter the start value, end value and years to get the compound annual growth rate, absolute return and a year-wise projection. Works for mutual funds, stocks, FDs and property.',
 h1='CAGR Calculator', lead='CAGR (Compound Annual Growth Rate) turns a total return over several years into one yearly rate, so you can compare a fund, a stock, an FD and a flat you bought in different years.',
 calc=dict(id='cagr', out=['CAGR (per year)', 'Total gain', 'Absolute return'], fields=[
   field('f-start', 'Starting value (₹)', 100000, 1000), field('f-end', 'Ending value (₹)', 250000, 1000), field('f-years', 'Number of years', 7, 0.5)]),
 body="""<h2>The CAGR formula</h2>
<p><strong>CAGR = (End value ÷ Start value)<sup>1 ÷ years</sup> − 1</strong>. ₹1 lakh becoming ₹2.5 lakh in 7 years is an absolute return of 150% but a CAGR of about 14% a year. CAGR is the rate at which a single lump sum would have had to grow every year to reach the same result.</p>
<h2>CAGR vs XIRR: which one do I need?</h2>
<p>CAGR assumes one investment at the start and one value at the end. It is the right number for a one-time investment, an FD, gold or a house. If you invested in instalments (SIPs, top-ups, redemptions), the money went in on different dates and CAGR becomes misleading; use <a href="/xirr-calculator/">XIRR</a> instead. Capital Friends shows both, side by side, for every fund and portfolio, so you can see the difference on your own money.</p>
<h2>Typical CAGRs in India (for context, not a forecast)</h2>
<ul><li>Nifty 50 total return, long run: roughly 11–13% a year.</li><li>Bank FDs: 6–7.5%. PPF: 7.1%. EPF: 8.25%.</li><li>Gold over 20 years: about 11%. Inflation: 5–6%.</li></ul>""",
 faq=[('What is a good CAGR for mutual funds?', 'For equity funds, 12% or more over 10+ years is good; 15%+ is excellent. Compare a fund with its benchmark index over the same period, not with a fixed number.'),
      ('Why is my CAGR different from the fund\'s CAGR?', 'The fund\'s CAGR is for a lump sum held for the whole period. Your money went in on different dates, so your personal return is an XIRR, which can be higher or lower.'),
      ('How do I calculate CAGR for a house or gold?', 'Use the purchase price as the start value, today\'s market value as the end value, and the years since purchase. Remember to subtract stamp duty, brokerage and maintenance for a true figure.'),
      ('Can CAGR be negative?', 'Yes. If the end value is below the start value, CAGR is negative, meaning the investment lost value every year on average.')],
 related=['xirr-calculator', 'lumpsum-calculator', 'sip-calculator', 'swp-calculator', 'fire-calculator', 'net-worth-calculator'])

xirr_fields = ['<label>Purchases (date and amount)</label><div id="flows">' + ''.join(
  f'<div class="flow"><input class="fd" type="date" value="{d}" /><input class="fa" type="number" inputmode="decimal" placeholder="Amount ₹" value="{a}" /><button type="button" class="rm-flow" aria-label="Remove">×</button></div>'
  for d, a in [('2022-01-05', 50000), ('2023-01-05', 50000), ('2024-01-05', 50000), ('2025-01-05', 50000)]) + '</div><button type="button" id="add-flow">+ Add another purchase or SIP</button>',
  field('f-vdate', 'Valuation date', TODAY, typ='date'), field('f-value', 'Current value of all these purchases (₹)', 280000, 1000)]
add('xirr-calculator', nav='XIRR calculator', blurb='Your real annual return from dated purchases and today\'s value.',
 title='XIRR Calculator – Mutual Fund & SIP Returns with Dates (Free)',
 desc='Free XIRR calculator for mutual funds, SIPs and stocks. Enter each purchase with its date and today\'s value to get your real annualised return. No login, no spreadsheet needed.',
 h1='XIRR Calculator', lead='XIRR is the one honest return number for money invested on different dates: SIPs, top-ups, bonuses. Enter your purchases and today\'s value; the calculator finds the annual rate that makes them match.',
 calc=dict(id='xirr', out=['XIRR (per year)', 'Total invested', 'Gain'], fields=xirr_fields, table=False), cta='xirr',
 body="""<h2>What XIRR is</h2>
<p>XIRR (extended internal rate of return) finds the single yearly rate at which every purchase, compounded from its own date, adds up to today's value. It is what Excel's <code>=XIRR()</code> computes. A SIP of ₹50,000 a year for 4 years worth ₹2.8 lakh in late 2026 is an XIRR of about 11%, even though the absolute gain looks like 40%.</p>
<h2>XIRR vs CAGR vs absolute return</h2>
<ul><li><strong>Absolute return</strong> ignores time. 40% over 4 years and 40% over 10 years look the same.</li>
<li><strong><a href="/cagr-calculator/">CAGR</a></strong> fixes time but assumes one lump sum at the start.</li>
<li><strong>XIRR</strong> fixes both: every rupee is credited only for the time it was actually invested. Use it for anything with SIPs, top-ups or partial redemptions.</li></ul>
<h2>How to get XIRR for your whole mutual fund portfolio</h2>
<ol class="steps"><li>Download your detailed CAMS + KFintech consolidated statement (CAS) PDF. It lists every transaction since you started.</li>
<li>Import it into Capital Friends. The app reads every purchase, SIP, switch and redemption with its date.</li>
<li>You get XIRR and CAGR for every fund, every portfolio and the family as a whole, and the money-in figure is the real cash that left your bank, not the cost of switched units.</li></ol>""",
 faq=[('Why is my XIRR lower than the fund\'s 5-year return?', 'The fund\'s return is for a lump sum invested 5 years ago. Your SIP instalments were invested later, many of them at higher NAVs, so your XIRR is usually lower in a rising market and higher in a falling one.'),
      ('Does a switch count as a new investment in XIRR?', 'For your overall return, no: money switched between your own funds is not new cash. Many apps count it anyway and inflate the invested amount. Capital Friends tracks the real money-in separately.'),
      ('How much data do I need?', 'At least one purchase with a date, and the current value with its date. More purchases make it more accurate. Redemptions can be entered as negative amounts if you edit the code; the app handles them automatically.'),
      ('Is XIRR the same as IRR?', 'IRR assumes equal gaps between cashflows; XIRR uses actual dates. For SIPs with occasional top-ups or missed months, XIRR is the correct one.')],
 related=['cagr-calculator', 'sip-calculator', 'lumpsum-calculator', 'mutual-fund-portfolio-tracker', 'cams-cas-import', 'net-worth-calculator'])

add('retirement-corpus-calculator', nav='Retirement corpus calculator', blurb='Corpus you need at retirement and the SIP to reach it.',
 title='Retirement Corpus Calculator India – How Much to Retire & SIP Needed',
 desc='Free retirement calculator for India: enter today\'s expenses, your age, retirement age and inflation to get the corpus you need, what your current savings cover, and the monthly SIP to close the gap.',
 h1='Retirement Corpus Calculator', lead='How much money do you need to retire, and what should you invest every month to get there? This calculator inflates today\'s expenses to your retirement year, sizes a corpus that lasts till your planned age, and works out the SIP for the gap.',
 calc=dict(id='retirement', out=['Corpus needed at retirement', 'Monthly expenses at retirement', 'SIP needed per month'], fields=[
   '<div class="row">' + field('f-age', 'Your age today', 35, 1) + field('f-retire', 'Retirement age', 55, 1) + '</div>',
   field('f-life', 'Plan the money to last till age', 85, 1), field('f-expense', 'Monthly expenses today (₹)', 60000, 1000, 'Only what you will still spend after retiring: no EMIs that end, no school fees.'),
   '<div class="row">' + field('f-inflation', 'Inflation (%)', 6, 0.5) + field('f-rate', 'Return after retiring (%)', 8, 0.5) + '</div>',
   '<div class="row">' + field('f-prerate', 'Return till retirement (%)', 12, 0.5) + field('f-have', 'Already saved for retirement (₹)', 2000000, 50000) + '</div>']), cta='retire',
 body="""<h2>How the corpus is calculated</h2>
<ol class="steps"><li>Today's monthly expenses are inflated to the retirement year: ₹60,000 at 6% for 20 years becomes about ₹1.9 lakh a month.</li>
<li>The corpus is sized so that inflation-rising withdrawals last from retirement to the age you choose, while the remaining money earns the post-retirement return. This is more realistic than a flat "25× expenses" rule.</li>
<li>What you have already saved is grown at the pre-retirement return. The gap is converted into a monthly SIP for the years left.</li></ol>
<h2>What people get wrong</h2>
<ul><li><strong>Ignoring inflation.</strong> At 6%, prices double every 12 years. A 35-year-old retiring at 55 needs more than 3× today's expenses per month.</li>
<li><strong>Counting the house.</strong> You will live in it; it does not pay for groceries. Count EPF, PPF, NPS, mutual funds, FDs and stocks.</li>
<li><strong>One return for 50 years.</strong> Use a higher return while accumulating and a lower one after retiring, when most money should be in safer funds.</li></ul>
<h2>After the number: how to actually withdraw</h2>
<p>A corpus is only half the plan. The other half is how you draw it without selling equity in a crash. Capital Friends uses three buckets: income (2 years of expenses, safe), stability (next 5 years, hybrid/debt) and growth (the rest, equity). It refills the income bucket from growth in good years and from stability in bad years. Read how it works on the <a href="/retirement-bucket-strategy/">retirement bucket strategy</a> page, or try the <a href="/swp-calculator/">SWP calculator</a>.</p>""",
 faq=[('How much corpus do I need to retire in India?', 'A common rule is 25–30 times your yearly expenses at retirement (after inflation). For ₹1 lakh a month at retirement that is ₹3–3.6 crore. The calculator above gives a more exact number for your ages and returns.'),
      ('What withdrawal rate is safe in India?', 'Around 3.5–4% of the corpus in the first year, rising with inflation. Higher inflation in India argues for the lower end, or for keeping part of the corpus in equity after retiring.'),
      ('Should I count EPF and NPS?', 'Yes, they are retirement money. Capital Friends counts EPF, PPF and NPS for the retirement goal only and never includes them in a sell step, since they pay out on their own rules.'),
      ('What if I cannot invest the SIP the calculator shows?', 'Start with what you can and step it up every year, push the retirement age a little, or lower planned expenses. Re-run the calculation yearly; small corrections early are far cheaper than big ones late.')],
 related=['swp-calculator', 'fire-calculator', 'sip-calculator', 'retirement-bucket-strategy', 'emergency-fund-calculator'])

add('emergency-fund-calculator', nav='Emergency fund calculator', blurb='Months of expenses you should keep aside, and where.',
 title='Emergency Fund Calculator – How Much to Keep Aside (India)',
 desc='Free emergency fund calculator: enter monthly expenses and EMIs to see how much to keep for 6–12 months, how much you still need, and where to park it in India.',
 h1='Emergency Fund Calculator', lead='An emergency fund is money you can reach within a day, kept for a job loss, a medical bill or a family emergency. This calculator sizes it from your real monthly outgo, including EMIs.',
 calc=dict(id='emergency', out=['Emergency fund you need', 'You already have', 'Still to add'], fields=[
   field('f-expense', 'Monthly household expenses (₹)', 50000, 1000), field('f-emi', 'Monthly EMIs and insurance premiums (₹)', 25000, 1000, 'Loans do not pause when income does.'),
   field('f-months', 'Months to cover', 6, 1, '6 months if two earners, 9–12 if one earner or a variable income.'), field('f-have', 'Already set aside (₹)', 100000, 10000)], table=False),
 body="""<h2>How much is enough?</h2>
<ul><li><strong>3 months</strong>: two steady salaries, no dependants, good health cover.</li><li><strong>6 months</strong>: most salaried families.</li><li><strong>9–12 months</strong>: single earner, freelancers, business owners, or an industry with long job searches.</li></ul>
<p>Count EMIs and premiums as expenses: in an emergency the loan still has to be paid. Do not count school fees that can be deferred or discretionary spends you would stop.</p>
<h2>Where to keep an emergency fund in India</h2>
<ul><li><strong>Savings account with sweep-in FD</strong> for the first month of expenses: instant access.</li><li><strong>Liquid or overnight mutual fund</strong> for the rest: better than savings interest, redeemable in a day, and some offer instant redemption up to ₹50,000.</li><li>Never in equity, and not locked in a 5-year FD with a penalty.</li></ul>
<h2>Track it with the rest of your money</h2>
<p>Capital Friends has an emergency fund goal that always gets the safest money first, before any other goal is funded. When you tick which FDs and liquid funds are for your goals, the emergency fund is protected and never part of a rebalance.</p>""", cta='goal',
 faq=[('Is 6 months of expenses enough?', 'For a two-income household, usually yes. For a single earner or an uncertain job market, 9–12 months is safer. Health insurance reduces the medical part of the risk.'),
      ('Should the emergency fund be in a liquid fund or FD?', 'Both work. A liquid fund has no penalty for early withdrawal and is taxed only on gains; an FD is simpler and insured up to ₹5 lakh per bank. Many people split it.'),
      ('Should I build the emergency fund before starting SIPs?', 'Build at least 2–3 months first, then run both in parallel. A SIP you have to stop in an emergency costs more than a delayed start.'),
      ('Does the emergency fund count towards my goals?', 'Keep it separate. In Capital Friends it is its own goal, funded first from the safest assets, and excluded from rebalancing.')],
 related=['retirement-corpus-calculator', 'sip-calculator', 'net-worth-calculator', 'fire-calculator', 'swp-calculator'])

add('fire-calculator', nav='FIRE calculator', blurb='Your FIRE number and the age you can stop working.',
 title='FIRE Calculator India – Your FIRE Number and Retire-early Age',
 desc='Free FIRE calculator for India: find your financial independence number from yearly expenses and a safe withdrawal rate, and the age you reach it with your current savings and monthly investments.',
 h1='FIRE Calculator (Financial Independence, Retire Early)', lead='Your FIRE number is the corpus that can pay your expenses for life. This calculator finds it from today\'s expenses and a withdrawal rate, then works out how many years of saving it takes to get there in real (inflation-adjusted) terms.',
 calc=dict(id='fire', out=['Your FIRE number (today\'s money)', 'Years to reach it', 'Financially independent at'], fields=[
   '<div class="row">' + field('f-age', 'Your age', 32, 1) + field('f-expense', 'Monthly expenses (₹)', 75000, 1000) + '</div>',
   '<div class="row">' + field('f-have', 'Invested so far (₹)', 3000000, 50000) + field('f-save', 'Monthly investment (₹)', 60000, 1000) + '</div>',
   '<div class="row">' + field('f-rate', 'Expected return (%)', 11, 0.5) + field('f-inflation', 'Inflation (%)', 6, 0.5) + '</div>',
   field('f-swr', 'Safe withdrawal rate (%)', 3.5, 0.25, '4% is the US rule of thumb; 3–3.5% is more prudent for India\'s inflation and a 40-year retirement.')]), cta='retire',
 body="""<h2>How the FIRE number is calculated</h2>
<p><strong>FIRE number = yearly expenses ÷ withdrawal rate.</strong> At 3.5% that is about 29× yearly expenses; at 4% it is 25×. The calculator then grows your current investments and monthly contributions at the <em>real</em> return (return minus inflation) until they cross that number, so the answer is in today's rupees and the target does not drift.</p>
<h2>Lean, regular and fat FIRE</h2>
<ul><li><strong>Lean FIRE</strong>: expenses cut to the bone, smaller number, less margin.</li><li><strong>Regular FIRE</strong>: today's lifestyle continues.</li><li><strong>Coast FIRE</strong>: you have enough invested that it will grow to the number by normal retirement age without adding more, so you can take a lower-paying job you like.</li></ul>
<h2>Why India needs a lower withdrawal rate</h2>
<p>The 4% rule comes from US data with 3% inflation and 60+ years of market history. Indian inflation runs 5–6% and equity is more volatile, so most planners suggest 3–3.5% for an early retiree who may need the money for 40–50 years, plus a bucket structure so equity is never sold in a crash.</p>""",
 faq=[('What is a realistic FIRE number in India?', 'For ₹75,000 a month of expenses, 29× yearly expenses is about ₹2.6 crore in today\'s money. Add health insurance and a paid-off home, and keep the number updated for inflation every year.'),
      ('Is the 4% rule valid in India?', 'It is a starting point. Because of higher inflation and the long horizon of early retirement, 3–3.5% is safer. Each 0.5% lower adds roughly 4 years of expenses to the target.'),
      ('Should I include my house in FIRE?', 'No, unless you plan to sell it. A home you live in does not generate the cash you will spend.'),
      ('How do I draw down after FIRE?', 'Use a bucket strategy: 2 years of expenses in safe funds, 5 years in hybrid/debt, the rest in equity, refilled in good years. Capital Friends runs this on your actual portfolio.')],
 related=['retirement-corpus-calculator', 'swp-calculator', 'cagr-calculator', 'retirement-bucket-strategy', 'net-worth-calculator'])

add('net-worth-calculator', nav='Net worth calculator', blurb='Assets minus loans, the number that shows real progress.',
 title='Net Worth Calculator India – Assets Minus Loans (Free)',
 desc='Free net worth calculator: add mutual funds, stocks, FDs, EPF, gold and property, subtract home and other loans, and see your net worth and how much of it is liquid. Then track it for the whole family.',
 h1='Net Worth Calculator', lead='Net worth is everything you own minus everything you owe. It is the one number that tells you whether the family is actually getting ahead. Fill in what you know; estimates are fine.',
 calc=dict(id='networth', out=['Your net worth', 'Total assets', 'Total loans'], fields=[
   '<div class="row">' + field('f-mf', 'Mutual funds (₹)', 2000000, 10000) + field('f-stocks', 'Stocks (₹)', 500000, 10000) + '</div>',
   '<div class="row">' + field('f-fd', 'FDs, PPF, bonds (₹)', 800000, 10000) + field('f-epf', 'EPF, NPS (₹)', 1200000, 10000) + '</div>',
   '<div class="row">' + field('f-gold', 'Gold, silver (₹)', 600000, 10000) + field('f-cash', 'Bank balance (₹)', 300000, 10000) + '</div>',
   '<div class="row">' + field('f-property', 'Property (₹)', 9000000, 100000) + field('f-other', 'Other assets (₹)', 0, 10000) + '</div>',
   '<div class="row">' + field('f-home', 'Home loan outstanding (₹)', 4500000, 50000) + field('f-car', 'Car loan (₹)', 300000, 10000) + '</div>',
   '<div class="row">' + field('f-personal', 'Personal / education loan (₹)', 0, 10000) + field('f-cc', 'Credit card dues (₹)', 0, 1000) + '</div>'], table=False),
 body="""<h2>Why net worth, not just investments</h2>
<p>A ₹50 lakh portfolio with a ₹60 lakh loan is a negative number. Tracking only investments hides that. Net worth also shows how much is <em>liquid</em>: money in funds, FDs and gold can pay for an emergency; the house you live in cannot.</p>
<h2>What to include</h2>
<ul><li><strong>Assets:</strong> mutual funds and stocks at today's value; FDs, PPF, bonds; EPF and NPS balances; gold by weight at today's rate; property at a conservative market value; bank balances.</li>
<li><strong>Liabilities:</strong> outstanding principal of every loan, and any credit card balance you carry.</li>
<li><strong>Leave out:</strong> the car's resale value (optional), insurance cover (it is protection, not wealth), and money owed to you that you may not get back.</li></ul>
<h2>Net worth for the whole family, updated every day</h2>
<p>A calculator gives a snapshot. Capital Friends keeps it live: every family member's funds, stocks, FDs, EPF, gold (revalued daily by weight), property and loans in one dashboard, stored in a Google Sheet in your own Drive. The family gets a daily email with the net worth and where everything is. See the <a href="/family-net-worth-tracker/">family net worth tracker</a>.</p>""",
 faq=[('Should I include my house in net worth?', 'Yes, at a conservative value, but look at liquid net worth separately. Many people are house-rich and cash-poor.'),
      ('How often should I calculate net worth?', 'Once a quarter is enough if you do it by hand. A tracker that updates fund prices daily makes it effortless and lets you see the trend.'),
      ('What is a good net worth by age in India?', 'A rough guide is 1× yearly income by 30, 3× by 40, 6× by 50 and 10× by 60, excluding the home you live in. Your own trend matters more than the benchmark.'),
      ('How do I value gold?', 'Weight in grams × today\'s rate for its purity (24K, 22K or 18K). Capital Friends values physical gold this way every day.')],
 related=['family-net-worth-tracker', 'emergency-fund-calculator', 'fire-calculator', 'retirement-corpus-calculator', 'cagr-calculator', 'mutual-fund-portfolio-tracker'])

# ---- feature pages ----
def feat(items): return '<div class="feat">' + ''.join(f'<div><b>{t}</b><p>{d}</p></div>' for t, d in items) + '</div>'
STEPS_IMPORT = """<ol class="steps"><li>On the CAMS website choose a <strong>Detailed</strong> consolidated account statement, pick the start date (go back to when you first invested) and set a password. It arrives by email in a few minutes, free.</li>
<li>Open Capital Friends, go to Mutual Funds, click <strong>Import from CAMS statement</strong>, choose the PDF and type the password.</li>
<li>The app reads every fund and every transaction, creates one portfolio per account (including minor accounts for your kids), and asks you to confirm before importing. You can undo an import any time.</li></ol>"""

add('mutual-fund-portfolio-tracker', nav='Mutual fund portfolio tracker', blurb='All family funds from one CAS import, with XIRR and CAGR.',
 title='Mutual Fund Portfolio Tracker for Indian Families – Free, CAS Import',
 desc='Free mutual fund portfolio tracker: import your CAMS CAS statement, see real money-in, XIRR and CAGR for every fund and every family member, rebalancing and funds below their high. Data in your own Google Drive.',
 h1='Mutual Fund Portfolio Tracker', lead='Track every mutual fund of every family member in one place, from one CAMS statement. Real money-in, XIRR and CAGR, allocation targets, rebalancing suggestions and funds below their high, with the data kept in a Google Sheet in your own Drive.',
 body="""<h2>What makes it different from Groww, Kuvera or a spreadsheet</h2>""" + feat([
  ('Real money-in, not holdings cost', 'When you switch funds, most apps count the switch as new investment and inflate "invested". Capital Friends shows the money that actually left your bank, the holdings cost, and the profit, realised and unrealised, separately.'),
  ('The whole family', 'Your funds, your spouse\'s, your parents\' and the kids\' minor accounts, each as its own portfolio and together as one number. Import each person\'s CAS statement the same way.'),
  ('XIRR and CAGR for everything', 'For every fund, every portfolio and the family total, from the exact date of every purchase, SIP, switch and redemption.'),
  ('Below its high', 'Every fund is compared with its own all-time-high NAV every day. You see which of your funds is 5% or 10% below its peak, instead of reacting to a Nifty headline. Information, not advice.'),
  ('Rebalancing you can act on', 'Set a target allocation per fund. The app shows the drift and three ways to fix it: adjust SIP amounts, add a lump sum to what is short, or buy and sell. Funds that no longer accept fresh money can be marked and skipped.'),
  ('Your data, your Drive', 'No bank login, no server database. One Google Sheet in your Drive holds everything; delete it and the app has nothing.')]) + """
<h2>How to import your mutual funds</h2>""" + STEPS_IMPORT + """
<h2>What you see after the import</h2>
<p>A Mutual Funds page with money-in, current value, unrealised and realised profit, XIRR, CAGR and monthly SIP; the asset-class split; the investment journey since your first purchase; and every portfolio with its own return. Open a portfolio for the holdings table with units, NAV, average NAV, distance from the high, and current versus target allocation. Open a fund for its journey and every transaction with its own profit.</p>
<h2>Fund breakdown: large, mid, small, global</h2>
<p>Classify each fund once (asset class, market cap, geography, copied from Morningstar) and the app shows how much of the family's money is large cap, mid cap, small cap, debt, gold and outside India. Goals use this split to decide which funds are safe money and which are growth money.</p>""", cta='xirr',
 faq=[('Is the mutual fund tracker free?', 'Yes, free with no ads and open source. You can support the project with a voluntary donation.'),
      ('Which statements can I import?', 'The detailed CAMS + KFintech consolidated account statement (CAS) PDF, which covers all AMCs. One statement per PAN; import one for each family member.'),
      ('Does it track SIPs automatically?', 'Yes. Every SIP instalment is a transaction in the CAS, so the app knows your running SIPs, their amounts and dates, and sends reminders before the next date.'),
      ('How are NAVs updated?', 'Daily from AMFI data through a scheduled script that runs in your own Google account, so values and the below-high alerts are current even when you do not open the app.'),
      ('Can I use it as an Excel or Google Sheets portfolio tracker?', 'Your data already lives in a Google Sheet in your Drive. Open it any time, or download it as Excel.')],
 related=['cams-cas-import', 'xirr-calculator', 'family-net-worth-tracker', 'stock-portfolio-tracker', 'goal-based-investing', 'sip-calculator'])

add('family-net-worth-tracker', nav='Family net worth tracker', blurb='Every member, every asset and loan, one daily email.',
 title='Family Net Worth Tracker – Every Member, Every Asset, One Daily Email',
 desc='Track your whole family\'s net worth for free: mutual funds, stocks, FDs, EPF, gold by weight, property and loans for every member, in a Google Sheet in your own Drive, with a daily summary email your family can rely on.',
 h1='Family Net Worth Tracker', lead='One dashboard for the whole family: every bank account, investment account, mutual fund, stock, FD, EPF, gold, property, loan and insurance policy, tied to the person it belongs to. If something happens to you, your family knows where everything is.',
 body="""<h2>Why families need this, not just investors</h2>
<p>In most homes all of the money lives in one person's head. Families that lose that person spend months searching for documents: where are the investments, which bank, who is the nominee. Some of it can be traced with a PAN; much of it cannot. Capital Friends was built so that one email, sent every morning, answers those questions.</p>
<h2>What it tracks</h2>""" + feat([
  ('Family members', 'Self, spouse, parents, kids. Everything else belongs to one of them. PAN and Aadhaar are optional, saved only in your sheet and masked on screen.'),
  ('Bank and investment accounts', 'A list of which accounts exist and which platform (Zerodha, Groww, a distributor) is linked to which bank. No bank login, ever.'),
  ('Mutual funds and stocks', 'Funds from a CAMS statement, stocks from your broker\'s Excel or a CDSL/NSDL statement, with XIRR and CAGR.'),
  ('Other investments', 'FDs, PPF, EPF, NPS, bonds, gold and silver by weight at today\'s rate, property with its loan linked.'),
  ('Insurance', 'Term and health policies with insured member, nominee and sum assured; the app checks whether the cover is enough.'),
  ('Loans', 'Home, car and personal loans with EMI, interest and months left; net worth is assets minus loans.')]) + """
<h2>The family email</h2>
<p>Every day (or every month) at a time you choose, each member you select gets the Family Financial Blueprint: net worth, every account, every fund and its value, policies and nominees, loans, goals, and which bank account is linked to what. It goes from your own Gmail, to the addresses you enter. There is no Capital Friends server in between.</p>
<h2>Privacy by design</h2>
<p>Sign in with Google and the app creates one Google Sheet in your Drive; that is the entire database. The developer cannot see it. The mask button hides names and numbers on screen for screen-sharing. The code is open source.</p>""", cta='default',
 faq=[('Is the family net worth tracker free?', 'Yes, completely free and open source, with no ads.'),
      ('Does it connect to my bank?', 'No. Bank accounts are a list you type, so the family knows which account is linked to what. There is no login, OTP or account aggregator.'),
      ('Who can see my family\'s data?', 'Only your Google account. The data is a Google Sheet in your own Drive; share it only if you choose to.'),
      ('Can each family member see only their own money?', 'The app has a "viewing as" switch to look at one member or everyone. The daily email can go to any members you select.'),
      ('How is gold valued?', 'By weight and purity at the day\'s rate, so you never need to update it.')],
 related=['net-worth-calculator', 'mutual-fund-portfolio-tracker', 'retirement-bucket-strategy', 'goal-based-investing', 'emergency-fund-calculator', 'cams-cas-import'])

add('cams-cas-import', nav='CAMS CAS import', blurb='Get your consolidated statement and import every transaction.',
 title='How to Import a CAMS CAS Statement into a Portfolio Tracker (Free)',
 desc='Step-by-step: download your detailed CAMS + KFintech consolidated account statement (CAS) and import it into Capital Friends to get every fund, SIP, switch and redemption with real money-in, XIRR and CAGR.',
 h1='Import Your CAMS CAS Statement', lead='The consolidated account statement from CAMS lists every mutual fund transaction you have ever made, across all AMCs. Import it once and your whole mutual fund history is in the tracker, with no typing.',
 body="""<h2>Step 1: get the detailed CAS from CAMS</h2>
<ol class="steps"><li>Go to the CAMS statements page and choose the consolidated account statement, <strong>Detailed</strong> type (the summary version has no transactions).</li>
<li>Choose the period. Pick a start date before your first investment; many people simply choose the earliest year offered so nothing is missed.</li>
<li>Enter the email registered with your folios and set a password for the PDF. The statement arrives by email in a few minutes. It is free.</li></ol>
<h2>Step 2: import it</h2>""" + STEPS_IMPORT + """
<h2>What the import gives you</h2>
<ul><li>Every purchase, SIP, switch in/out, STP and redemption with its real date and NAV.</li><li>Real money-in (cash from your bank) separate from holdings cost, so switches do not inflate the invested amount.</li><li>XIRR and CAGR for each fund, each portfolio and the family.</li><li>Separate portfolios for each account in the statement, including kids' minor accounts; fully-sold accounts are skipped.</li><li>Past imports listed with an undo button.</li></ul>
<h2>Importing the whole family</h2>
<p>A CAS is per PAN. Request one for your spouse, your parents and anyone else you track, and import each the same way. Minor accounts come inside the guardian's statement and get their own portfolios.</p>""", cta='xirr',
 faq=[('CAMS or KFintech: which statement do I need?', 'The CAMS "CAS" covers both CAMS- and KFintech-serviced AMCs, so one statement is enough. Choose the detailed version with transactions.'),
      ('What is the password for the CAS PDF?', 'The one you set while requesting it on the CAMS site. The tracker needs it to open the PDF; it is used only on your device and never stored.'),
      ('Will importing twice duplicate transactions?', 'No. Import the same statement again or a newer one and existing transactions are matched, not doubled. You can also undo any import.'),
      ('Does it work with NSDL or CDSL CAS?', 'Depository statements are for demat holdings. For stocks, Capital Friends imports the broker\'s holdings Excel or a CDSL/NSDL statement; for mutual funds use the CAMS CAS.')],
 related=['mutual-fund-portfolio-tracker', 'xirr-calculator', 'stock-portfolio-tracker', 'family-net-worth-tracker', 'sip-calculator', 'cagr-calculator'])

add('stock-portfolio-tracker', nav='Stock portfolio tracker', blurb='Family stock holdings from a broker Excel or CDSL statement.',
 title='Stock Portfolio Tracker India – Free, Family Holdings from Broker Excel',
 desc='Free stock portfolio tracker for Indian families: import holdings from Zerodha, Groww or any broker Excel, or a CDSL/NSDL statement, see every member\'s stocks with daily prices, profit and allocation, beside mutual funds and FDs.',
 h1='Stock Portfolio Tracker', lead='Keep every family member\'s stocks beside their mutual funds, FDs and gold, so the dashboard shows the real total. Import holdings from your broker\'s Excel file or a CDSL/NSDL statement; prices update daily.',
 body="""<h2>How stocks come in</h2>
<ol class="steps"><li>Download the holdings file from your broker (Zerodha Console, Groww, Upstox, ICICI Direct and others export an Excel or CSV), or your CDSL/NSDL consolidated statement.</li>
<li>Create a stock portfolio for the family member and import the file. Each holding gets its quantity and average price.</li>
<li>Prices refresh daily. You see current value, profit, allocation across the family, and the stocks in your top and bottom performers.</li></ol>
<h2>Stocks and funds together</h2>
<p>Most trackers do one or the other. Capital Friends shows stocks and mutual funds in the same net worth, the same family email and the same goals, so a family with a Zerodha account, an SIP portfolio, an EPF and a house sees one honest number.</p>""",
 faq=[('Which brokers are supported?', 'Any broker that exports holdings as Excel or CSV with symbol, quantity and average price. CDSL and NSDL statements also work.'),
      ('Are stock prices live?', 'They update daily through a public price sheet; this is a tracker for long-term holdings, not a trading terminal.'),
      ('Can I track my spouse\'s and parents\' demat accounts?', 'Yes. Add each person as a family member, create their stock portfolio and import their holdings file.'),
      ('Is there buy/sell advice?', 'No. The app shows facts: value, profit, allocation and distance from the high. Decisions are yours.')],
 related=['mutual-fund-portfolio-tracker', 'family-net-worth-tracker', 'cagr-calculator', 'net-worth-calculator', 'xirr-calculator', 'goal-based-investing'])

add('retirement-bucket-strategy', nav='Retirement bucket strategy', blurb='Three buckets, refilled in good years, so you never sell in a crash.',
 title='Three-Bucket Retirement Strategy in India – Income, Stability, Growth',
 desc='How the three-bucket retirement withdrawal strategy works (income, stability and growth buckets), how the buckets are refilled in good, bad and recovery years, and how Capital Friends runs it on your own portfolio for free.',
 h1='The Three-Bucket Retirement Strategy', lead='A retirement corpus is only useful if you can draw from it for 30 years without selling equity at the bottom of a crash. The bucket strategy splits the corpus into three jars by when the money is needed, and refills them with rules instead of nerves.',
 body="""<h2>The three buckets</h2>""" + feat([
  ('Income bucket: next 2 years', 'Two years of expenses in the safest place: liquid fund, short-duration debt, sweep-in FD. Your monthly expenses come only from here.'),
  ('Stability bucket: years 3 to 7', 'Five years of expenses in hybrid and debt funds, plus EPF, PPF and NPS which are never sold but count here. Refills income when the market is down.'),
  ('Growth bucket: everything else', 'Equity funds. Left alone to grow; refills the other two only in good years, when the market is near its high.')]) + """
<h2>How the refills work</h2>
<ul><li><strong>Five years before retirement</strong>: every quarter a small amount moves from growth to stability, and in the last two years to income too, but only in a good market, so nothing is sold in one go or at a low.</li>
<li><strong>Every month after retiring</strong>: expenses are paid from the income bucket. The other two are not touched. Bucket sizes use this year's expenses, so they grow with inflation.</li>
<li><strong>Good year</strong> (market near its high): growth refills income and tops up stability.</li>
<li><strong>Bad year</strong> (growth funds more than 10% below their high): growth is left alone; stability refills income.</li>
<li><strong>Recovery year</strong>: once the market is back near its high, growth refills both.</li>
<li><strong>Long fall</strong>: stability never goes below two years of expenses; the app warns you to spend a little less for a while.</li></ul>
<h2>Running it on your real money</h2>
<p>In Capital Friends, add a retirement goal with your expenses, inflation and retirement age. Tick which investments are for goals. The app fills the three buckets from your actual funds, EPF and FDs, shows what each bucket holds today, and from five years before retirement shows the quarterly moves. Start with the <a href="/retirement-corpus-calculator/">retirement corpus calculator</a> or the <a href="/swp-calculator/">SWP calculator</a>.</p>""", cta='retire',
 faq=[('Why not just an SWP from a balanced fund?', 'An SWP sells units every month regardless of the market. Buckets make sure the units sold in a crash come from the safe jar, so equity gets time to recover.'),
      ('How big should the income bucket be?', 'Two years of expenses is the common choice; it covers most bear markets. Some retirees keep three.'),
      ('Where do EPF, PPF and NPS fit?', 'They count in the stability bucket but are never switched or sold by the app; they pay out on their own rules. When one matures, you press Received and the money joins the plan.'),
      ('Is this advice?', 'No. It is a rule-based way to organise withdrawals that you can read and change. Capital Friends is a tracker, not a SEBI-registered adviser.')],
 related=['retirement-corpus-calculator', 'swp-calculator', 'fire-calculator', 'goal-based-investing', 'family-net-worth-tracker', 'emergency-fund-calculator'])

add('goal-based-investing', nav='Goal-based investing', blurb='Goals on a road, funded from the money you already have.',
 title='Goal-based Investing Tracker – Child Education, Retirement, House (Free)',
 desc='Plan child education, retirement, a house or any goal with a free goal tracker: future cost with inflation, SIP needed, which of your existing funds count for each goal, and the yearly shift from equity to safe as the date nears.',
 h1='Goal-based Investing, With Your Real Portfolio', lead='Most goal calculators stop at a number. Capital Friends puts your goals on a timeline, counts the money you already have against them, shows the gap, and tells you each year how much to move from equity to safe so the money is there on the date.',
 body="""<h2>How goals work in the app</h2>
<ol class="steps"><li><strong>Add a goal.</strong> Retirement, child education, emergency fund, house, car, travel, wedding or custom. For child education the date is set from the child's age and the course; for retirement from your age and retirement age.</li>
<li><strong>See the number.</strong> Today's cost inflated to the goal year, the SIP required or the lumpsum today, and a suggested equity/debt split for that horizon.</li>
<li><strong>Money for goals.</strong> Tick which investments are for goals. You do not link funds to goals one by one: the app shares the pool, giving the emergency fund and near goals the safe money and far goals the equity. Kids' own portfolios and the house can be left out.</li>
<li><strong>Follow the road.</strong> Each goal shows have-today versus need-today, on track or not, the funds counted for it, and the year-by-year plan to shift from equity to safe.</li></ol>
<h2>Why a glide path matters</h2>
<p>A ₹47 lakh college fee due in 2033 should not be 100% in equity in 2032. The app starts shifting five years out, a little each year and only in good markets, so a bad year right before the date does not cut the corpus by a third.</p>
<h2>Start with the planner</h2>
<p>Try the <a href="/goal-planner/">goal planner</a> (the app's own planner, no sign-in to plan), the <a href="/retirement-corpus-calculator/">retirement corpus calculator</a>, or the <a href="/emergency-fund-calculator/">emergency fund calculator</a>. Then sign in to run the same numbers on your real funds.</p>""", cta='goal',
 faq=[('Can I have many goals at once?', 'Yes. Retirement, two children\'s education and an emergency fund on one road is the normal setup. The app prioritises the emergency fund first, then goals by date and priority.'),
      ('Do I have to assign each fund to a goal?', 'No. Tick which investments are for goals in general; the app divides them by what each goal needs and how far away it is.'),
      ('What if I am not on track?', 'The goal shows the gap and the extra SIP that would close it. You can also move the date, change the priority or lower the target.'),
      ('Does it include EPF and PPF?', 'For the retirement goal only. They are never part of a sell or switch step.')],
 related=['retirement-bucket-strategy', 'retirement-corpus-calculator', 'emergency-fund-calculator', 'mutual-fund-portfolio-tracker', 'family-net-worth-tracker'])

TOOLS = ['sip-calculator', 'lumpsum-calculator', 'swp-calculator', 'cagr-calculator', 'xirr-calculator', 'retirement-corpus-calculator', 'emergency-fund-calculator', 'fire-calculator', 'net-worth-calculator']
FEATS = ['mutual-fund-portfolio-tracker', 'family-net-worth-tracker', 'cams-cas-import', 'stock-portfolio-tracker', 'retirement-bucket-strategy', 'goal-based-investing']

# tools index
add('tools', nav='All calculators', blurb='',
 title='Free Financial Calculators India – SIP, SWP, XIRR, CAGR, Retirement, FIRE',
 desc='Free, no-login financial calculators for Indian investors: SIP and step-up SIP, lumpsum, SWP, CAGR, XIRR, retirement corpus, emergency fund, FIRE, goal SIP and net worth. By Capital Friends, the free family portfolio tracker.',
 h1='Free Financial Calculators', lead='Plain calculators with the formula explained, no sign-up and no ads. When you want the same numbers on your real portfolio, open the free Capital Friends app.',
 body='<div class="cards">' + ''.join(f'<div class="card"><a href="/{s}/">{PAGES[s]["nav"]}</a><p>{PAGES[s]["blurb"]}</p></div>' for s in TOOLS) + '</div>'
      '<h2>Plan a goal with the real planner</h2><div class="cards"><div class="card"><a href="/goal-planner/">Goal planner</a><p>Retirement, child education, a house or any goal: the app\'s own planner, free, no sign-in to plan.</p></div></div><h2>Then track the real thing</h2><div class="cards">' + ''.join(f'<div class="card"><a href="/{s}/">{PAGES[s]["nav"]}</a><p>{PAGES[s]["blurb"]}</p></div>' for s in FEATS) + '</div>',
 faq=[('Are these calculators free?', 'Yes, free with no login and no ads. They run in your browser; nothing you type is sent anywhere.'),
      ('How accurate are they?', 'They use standard formulas (monthly-compounded SIP, compound growth, XIRR by bisection). Results depend on the return and inflation you assume.'),
      ('Can I use the numbers for my own portfolio?', 'Yes: Capital Friends, the free app behind these pages, applies the same maths to your real mutual funds, stocks, EPF and FDs for the whole family.')],
 related=['mutual-fund-portfolio-tracker', 'family-net-worth-tracker', 'retirement-bucket-strategy'])

# ─────────────────────────── write ───────────────────────────
def main():
    os.makedirs(os.path.join(ROOT, 'seo'), exist_ok=True)
    open(os.path.join(ROOT, 'seo', 'site.css'), 'w').write(CSS.strip() + '\n')
    here = os.path.dirname(os.path.abspath(__file__))
    open(os.path.join(ROOT, 'seo', 'calc.js'), 'w').write(open(os.path.join(here, 'calc.js')).read())
    urls = [('', TODAY, '1.0')]
    for slug, p in PAGES.items():
        d = os.path.join(ROOT, slug); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w').write(page(slug, p, TOOLS, FEATS))
        urls.append((slug + '/', TODAY, '0.8' if slug in TOOLS or slug == 'tools' else '0.9'))
    urls += [('goal-planner/', TODAY, '0.9'), ('privacy/', TODAY, '0.3'), ('terms/', TODAY, '0.3'), ('donate', TODAY, '0.4')]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url><loc>{SITE}/{u}</loc><lastmod>{m}</lastmod><priority>{pr}</priority></url>\n' for u, m, pr in urls) + '</urlset>\n'
    open(os.path.join(ROOT, 'sitemap.xml'), 'w').write(sm)
    print(len(PAGES), 'pages written; sitemap has', len(urls), 'urls')

if __name__ == '__main__':
    main()

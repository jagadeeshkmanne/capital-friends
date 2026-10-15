#!/usr/bin/env python3
"""Generates the public SEO pages (calculators + feature pages) into react-app/public/<slug>/index.html,
plus public/sitemap.xml and public/seo/{site.css,calc.js}. Run: python3 seo/gen.py  (from react-app/).
Content lives in PAGES below; edit and re-run. The pages are plain HTML so Google indexes them fully."""
import os, sys, json, re, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from illus import art as _art, CSS as ART_CSS
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
.pv{margin-top:34px}.pv h2{margin-top:0}.pv .sub{color:#475569;font-size:14px;margin:-6px 0 14px}
.pv .wrap{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;background:#0b1220;border-radius:16px;padding:14px}
.pv .pc{background:#111c33;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;color:#e2e8f0;font-size:13px}
.pv .pc .hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.pv .pc .hd b{color:#fff;font-size:13.5px}.pv .tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
.pv .ok{background:rgba(52,211,153,.15);color:#6ee7b7}.pv .due{background:rgba(245,158,11,.15);color:#fcd34d}.pv .smp{font-size:10.5px;color:#64748b;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 7px}
.pv .tiles{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.pv .tiles div{background:#0b1220;border-radius:8px;padding:7px 10px}.pv .tiles small{display:block;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748b}.pv .tiles b{color:#fff;font-size:14px}
.pv ul{list-style:none;margin:10px 0 0;padding:0}.pv li{display:flex;justify-content:space-between;gap:8px;margin:5px 0;color:#cbd5e1}.pv li i{display:inline-block;width:20px;height:20px;border-radius:5px;margin-right:8px;vertical-align:middle}.pv li b{color:#fff}
.pv .chip{font-size:10.5px;padding:1px 7px;border-radius:999px;background:rgba(148,163,184,.15);color:#cbd5e1;white-space:nowrap}.pv .eq{background:rgba(167,139,250,.2)}.pv .sf{background:rgba(52,211,153,.2)}
.pv .bar{display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:8px;background:rgba(255,255,255,.08)}.pv .bar span{display:block}
.pv .note{font-size:11px;color:#64748b;margin:10px 0 0}.pv .step{background:#0b1220;border-radius:8px;padding:9px 10px;margin-top:10px}.pv .step b{color:#fff}.pv .amber{color:#fcd34d;font-weight:600;font-size:14px;margin-top:6px}
.pv .btn{display:inline-block;background:#7c3aed;color:#fff;font-weight:600;font-size:12px;padding:6px 12px;border-radius:8px;margin-top:10px}.pv .jar{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.pv .jar div{background:#0b1220;border-radius:8px;padding:8px}.pv .jar small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#64748b}.pv .jar b{display:block;color:#fff;font-size:14px;margin-top:2px}.pv .jar em{display:block;font-style:normal;font-size:10.5px;color:#94a3b8;margin-top:2px}
.pv .mail li{justify-content:flex-start}.pv .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:6px}
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

CSS += r"""
.toc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin:0 0 8px;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
.toc b{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-right:6px}.toc a{font-size:13.5px;font-weight:600;color:#0f172a}.toc a:hover{color:#059669}
.tip{background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 10px 10px 0;padding:12px 16px;margin:14px 0;color:#065f46;font-size:14.5px}
.note-box{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:12px 16px;margin:14px 0;color:#78350f;font-size:14px}
.defs dt{font-weight:700;margin-top:10px}.defs dd{margin:2px 0 0 0;color:#334155}
.upd{font-size:12.5px;color:#64748b;margin-top:26px}
.art-h{margin-top:34px}.art-h+.art{margin-top:12px}
h2[id]{scroll-margin-top:72px}
""" + ART_CSS

def header():
    return """<header class="top"><div class="in">
<a class="brand" href="/"><img src="/logo-new.png" alt="Capital Friends logo" /><span><b>Capital</b> <em>Friends</em></span></a>
<nav class="nav"><a href="/goal-planner/">Goal planner</a><a href="/tools/">Calculators</a><a href="/guides/">Guides</a><a class="go" href="/">Open the free app</a></nav>
</div></header>"""

def footer(tools, feats):
    t = ''.join(f'<a href="/{s}/">{PAGES[s]["nav"]}</a>' for s in tools)
    f = ''.join(f'<a href="/{s}/">{PAGES[s]["nav"]}</a>' for s in feats)
    return f"""<footer class="bot"><div class="in">
<div><b>Free calculators</b>{t}</div>
<div><b>Guides</b>{f}</div>
<div><b>Capital Friends</b><a href="/goal-planner/">Goal planner (free)</a><a href="/">Open the app</a><a href="/donate">Support the project</a></div>
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

EXTRA = {'goal-planner': ('Goal planner', 'Plan retirement, education or any goal with the app\'s own planner, no sign-in.')}
def related(slugs, title='More free tools'):
    def c(s):
        n, b = (PAGES[s]['nav'], PAGES[s]['blurb']) if s in PAGES else EXTRA[s]
        return f'<div class="card"><a href="/{s}/">{n}</a><p>{b}</p></div>'
    return f'<h2>{title}</h2><div class="cards">' + ''.join(c(s) for s in slugs) + '</div>'

CTA = {
 'default': ("Track the real thing, not just the estimate", "Capital Friends is a free, open-source portfolio tracker for Indian families. Import your CAMS statement, see XIRR and CAGR for every fund, plan goals and retirement, and let your family get one summary email. Your data stays in your own Google Drive.", "Open the free app"),
 'retire': ("Plan retirement with your real portfolio", "Capital Friends turns this calculation into a plan: it counts your existing funds, EPF and FDs, shows the SIP still needed, and runs the three-bucket withdrawal strategy on your own money. Free, data in your Google Drive.", "Plan my retirement, free"),
 'goal': ("Put real money against this goal", "In Capital Friends every goal gets a road: which of your funds are counted for it, how much is still short, and when to move money from equity to safe as the date comes near. Free, no bank login.", "Plan my goals, free"),
 'xirr': ("Get XIRR for every fund, automatically", "Stop typing cashflows. Import your CAMS statement into Capital Friends and get XIRR, CAGR, real money-in and profit for every fund, every portfolio and the whole family. Free and open source.", "Import my CAS statement"),
}

PV = {
 'funds': """<div class="pc"><div class="hd"><b>Mutual funds · the whole family</b><span class="smp">Sample numbers</span></div>
<div class="tiles"><div><small>Your money in</small><b>₹1.58 Cr</b></div><div><small>Current value</small><b>₹2.04 Cr</b></div><div><small>XIRR</small><b>11.5%</b></div><div><small>CAGR</small><b>16.4%</b></div></div>
<ul><li><span><i style="background:rgba(167,139,250,.25)"></i>Flexi cap fund <span class="chip">7% below high</span></span><b>₹28.4 L</b></li><li><span><i style="background:rgba(167,139,250,.25)"></i>Multi asset fund</span><b>₹13.3 L</b></li><li><span><i style="background:rgba(56,189,248,.25)"></i>Global index fund <span class="chip">SIP only</span></span><b>₹11.4 L</b></li><li><span><i style="background:rgba(52,211,153,.25)"></i>Bank FD · safe</span><b>₹12 L</b></li></ul>
<p class="note">Every fund, SIP, switch and sale from one CAMS statement. Money-in is real cash, not switched profit. Each fund is compared with its own high every day.</p></div>""",
 'buckets': """<div class="pc"><div class="hd"><b>Retirement · 3 buckets</b><span class="tag ok">On track</span></div>
<div class="jar"><div><small>Income</small><b>₹0</b><em>2 yrs of expenses · fills from 2031</em></div><div><small>Stability</small><b>₹30 L</b><em>next 5 yrs · EPF, hybrid, debt</em></div><div><small>Growth</small><b>₹68.5 L</b><em>the rest · equity</em></div></div>
<div class="step"><small style="font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748b">2034 · a quarterly step</small><div class="amber">Move ₹2.1 L from Growth to Income</div><div style="color:#94a3b8;font-size:11.5px;margin-top:3px">Only while the market is near its high. In a bad year Stability pays instead, so nothing is sold at a low.</div><span class="btn">Record the move</span></div>
<p class="note">Your actual funds, EPF and FDs fill the jars. Every year of the plan becomes a step like this.</p></div>""",
 'goal': """<div class="pc"><div class="hd"><b>Child education · 2033</b><span class="tag ok">On track</span></div>
<div class="tiles"><div><small>Have today</small><b>₹22.2 L</b></div><div><small>Should have</small><b>₹22.1 L</b></div></div>
<div class="bar"><span style="width:42%;background:#a78bfa"></span><span style="width:58%;background:#34d399"></span></div><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748b;margin-top:3px"><span>42% growth</span><span>58% safe</span></div>
<ul><li><span><i style="background:rgba(52,211,153,.25)"></i>Bank FD <span class="chip sf">65% of it</span></span><b>₹7.8 L</b></li><li><span><i style="background:rgba(167,139,250,.25)"></i>Multi asset fund <span class="chip eq">31% of it</span></span><b>₹6 L</b></li><li><span><i style="background:rgba(167,139,250,.25)"></i>Multi factor fund</span><b>₹5.9 L</b></li></ul>
<div class="step"><div class="amber">2029 · move ₹4.2 L to safe funds</div><div style="color:#94a3b8;font-size:11.5px;margin-top:3px">The glide path: equity 65% → 50% as the date comes near, only in good markets.</div></div>
<p class="note">You tick which investments are for goals; the app shares them: near goals get the safe money, far goals the equity.</p></div>""",
 'networth': """<div class="pc"><div class="hd"><b>Family net worth</b><span class="smp">Sample numbers</span></div>
<div class="tiles"><div><small>Net worth</small><b>₹3.51 Cr</b></div><div><small>Total assets</small><b>₹4.41 Cr</b></div><div><small>Loans</small><b>₹90 L</b></div><div><small>Money in</small><b>₹2.35 Cr</b></div></div>
<div class="bar"><span style="width:46%;background:#a78bfa"></span><span style="width:36%;background:#38bdf8"></span><span style="width:8%;background:#fbbf24"></span><span style="width:10%;background:#34d399"></span></div>
<ul><li><span><i style="background:rgba(167,139,250,.25)"></i>Mutual funds · 4 members</span><b>₹2.04 Cr</b></li><li><span><i style="background:rgba(56,189,248,.25)"></i>House · loan linked</span><b>₹1.6 Cr</b></li><li><span><i style="background:rgba(251,191,36,.25)"></i>Gold · 250 g, today's rate</span><b>₹35 L</b></li><li><span><i style="background:rgba(52,211,153,.25)"></i>EPF, FD</span><b>₹42 L</b></li></ul>
<p class="note">Every member, every account, revalued daily. Gold by weight, the house with its loan, insurance with nominees.</p></div>""",
 'mail': """<div class="pc mail"><div class="hd"><b>Family Financial Blueprint</b><span class="smp">Daily email</span></div>
<ul><li><span class="dot" style="background:#fbbf24"></span><span><b>Retirement</b> is 4% off its path · 1 step due</span></li><li><span class="dot" style="background:#38bdf8"></span><span><b>Flexi cap fund</b> is 7% below its high · information, not advice</span></li><li><span class="dot" style="background:#34d399"></span><span><b>SIP</b> ₹40,000 due on the 5th · term policy renews in 12 days</span></li><li><span class="dot" style="background:#a78bfa"></span><span><b>Net worth</b>, every account, every fund, nominees, loans: where everything is</span></li></ul>
<p class="note">Sent every morning from your own Gmail to the family members you choose. If something happens to you, they know where everything is.</p></div>""",
}
def preview(kinds, title, sub):
    return f'<section class="pv"><h2>{title}</h2><p class="sub">{sub}</p><div class="wrap">' + ''.join(PV[k] for k in kinds) + '</div></section>'

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
    elif p.get('guide'):
        ld.append({"@context": "https://schema.org", "@type": "Article", "headline": p['h1'], "description": p['desc'], "url": url, "datePublished": "2026-10-15", "dateModified": TODAY,
                   "author": {"@type": "Person", "name": "Jagadeesh Manne"}, "publisher": {"@type": "Organization", "name": "Capital Friends", "url": SITE, "logo": {"@type": "ImageObject", "url": SITE + "/logo-new.png"}},
                   "image": SITE + "/og-image.png", "mainEntityOfPage": url, "isPartOf": {"@type": "WebSite", "name": "Capital Friends", "url": SITE}})
    else:
        ld.append({"@context": "https://schema.org", "@type": "WebPage", "name": p['h1'], "url": url, "description": p['desc'], "isPartOf": {"@type": "WebSite", "name": "Capital Friends", "url": SITE}})
    ld.append(faq_ld(p['faq']))
    p = dict(p, ld=ld)
    t, d, b = CTA[p.get('cta', 'default')]
    pvk = p.get('preview')
    body = p['body'] + (preview(*pvk) if pvk else '')
    if p.get('guide'):
        heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
        toc = '<nav class="toc" aria-label="In this guide"><b>In this guide</b>' + ''.join(f'<a href="#{i}">{re.sub("<[^>]+>", "", t)}</a>' for i, t in heads) + '</nav>'
        body = _art(slug) + toc + body
        body += f'<p class="upd">Last updated {datetime.date.today().strftime("%d %b %Y")} · by Jagadeesh Manne, who built Capital Friends for his own family.</p>'
    html = head(p, url) + '<body>' + header() + '<main>' + \
        f'<div class="crumbs"><a href="/">Capital Friends</a> › {"<a href=/tools/>Calculators</a> › " if p.get("calc") else ("<a href=/guides/>Guides</a> › " if slug in FEATS else "")}{p["h1"]}</div>' + \
        f'<h1>{p["h1"]}</h1><p class="lead">{p["lead"]}</p>' + \
        (calc_html(p) + '<h2 class="art-h">How it works, in one picture</h2>' + _art(slug) if p.get('calc') else ('' if p.get('guide') else _art(slug))) + body + \
        f'<div class="cta"><div><h2>{t}</h2><p>{d}</p></div><a href="{APP_CTA}">{b} →</a></div>' + \
        faq_html(p['faq']) + related(p['related'], 'Read next' if p.get('guide') else 'More free tools') + \
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
 preview=(['funds','mail'], 'What this looks like with your real funds', 'A calculator assumes one steady return. In Capital Friends the same numbers come from your actual SIPs, with the real money-in, XIRR and CAGR for every fund and every family member.'),
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
 preview=(['funds','mail'], 'Before you add a lump sum, see your own funds', 'Which of your funds is below its own high, which no longer accepts fresh money, and what the family holds in total.'),
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
   field('f-corpus', 'Starting corpus (₹)', 15000000, 100000), field('f-withdraw', 'Monthly withdrawal (₹)', 50000, 1000),
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
 preview=(['buckets','mail'], 'Withdrawals that never sell equity in a crash', 'The app runs the three-bucket plan on your real retirement money and tells you each quarter what to move.'),
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
 preview=(['funds','mail'], 'CAGR and XIRR side by side, for your own funds', 'The difference between a fund\'s return and your return, for every fund, every portfolio and the family.'),
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
 preview=(['funds','mail'], 'XIRR for every fund, without typing a single cashflow', 'One CAMS statement gives every purchase, SIP, switch and redemption with its date.'),
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
 preview=(['buckets','mail'], 'From a number to a plan on your real money', 'Your EPF, funds and FDs fill the three buckets; the glide path and the alerts do the rest.'),
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
 preview=(['goal','mail'], 'Your emergency fund as a goal the app protects', 'It gets the safest money first, is never part of a rebalance, and the family email shows where it is.'),
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
 preview=(['buckets','goal'], 'After the FIRE number: the withdrawal plan', 'Three buckets for retirement and a glide path for every other goal, on the money you actually hold.'),
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
 preview=(['networth','mail'], 'The same number, live, for the whole family', 'Every member\'s funds, stocks, FDs, EPF, gold and property with its loan, updated every day and emailed to the family.'),
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

from guides import register as _register_guides, ORDER as GUIDE_ORDER
_register_guides(add, feat)

TOOLS = ['sip-calculator', 'lumpsum-calculator', 'swp-calculator', 'cagr-calculator', 'xirr-calculator', 'retirement-corpus-calculator', 'emergency-fund-calculator', 'fire-calculator', 'net-worth-calculator']
FEATS = GUIDE_ORDER

# tools index (calculators only) and guides index
add('tools', nav='All calculators', blurb='',
 title='Free Financial Calculators India – SIP, SWP, XIRR, CAGR, Retirement, FIRE',
 desc='Free, no-login financial calculators for Indian investors: SIP and step-up SIP, lumpsum, SWP, CAGR, XIRR, retirement corpus, emergency fund, FIRE and net worth. By Capital Friends, the free family portfolio tracker.',
 h1='Free Financial Calculators', lead='Plain calculators with the formula explained, no sign-up and no ads. When you want the same numbers on your real portfolio, open the free Capital Friends app.',
 body='<div class="cards">' + ''.join(f'<div class="card"><a href="/{s}/">{PAGES[s]["nav"]}</a><p>{PAGES[s]["blurb"]}</p></div>' for s in TOOLS) + '</div>'
      '<h2>Plan a goal with the real planner</h2><div class="cards"><div class="card"><a href="/goal-planner/">Goal planner</a><p>Retirement, child education, a house or any goal: the app\'s own planner, free, no sign-in to plan.</p></div></div>',
 faq=[('Are these calculators free?', 'Yes, free with no login and no ads. They run in your browser; nothing you type is sent anywhere.'),
      ('How accurate are they?', 'They use standard formulas (monthly-compounded SIP, compound growth, XIRR by bisection). Results depend on the return and inflation you assume.'),
      ('Can I use the numbers for my own portfolio?', 'Yes: Capital Friends, the free app behind these pages, applies the same maths to your real mutual funds, stocks, EPF and FDs for the whole family.')],
 related=['mutual-fund-portfolio-tracker', 'family-net-worth-tracker', 'retirement-bucket-strategy'])
add('guides', nav='All guides', blurb='',
 title='Guides – Track Mutual Funds, Stocks, Family Net Worth, Goals and Retirement (Free)',
 desc='Plain-English guides from Capital Friends: how to track mutual funds and stocks for the whole family, import a CAMS statement, plan goals, and run retirement with the three-bucket strategy. Free, open source, your data in your own Google Drive.',
 h1='Guides', lead='How each part of Capital Friends works and why, in plain English. Every guide ends with the free app doing it on your real numbers.',
 body='<div class="cards">' + ''.join(f'<div class="card"><a href="/{s}/">{PAGES[s]["nav"]}</a><p>{PAGES[s]["blurb"]}</p></div>' for s in FEATS) + '</div>'
      '<h2>Try the numbers first</h2><div class="cards"><div class="card"><a href="/goal-planner/">Goal planner</a><p>Plan retirement, child education or any goal with the app\'s own planner, no sign-in.</p></div><div class="card"><a href="/tools/">Free calculators</a><p>SIP, lumpsum, SWP, XIRR, CAGR, retirement corpus, FIRE, emergency fund and net worth.</p></div></div>',
 faq=[('Is Capital Friends free?', 'Yes. It is open source and free for any family. You sign in with Google and your data is saved in one Google Sheet in your own Drive.'),
      ('Do I need to type in every fund?', 'No. Import one CAMS statement per family member and every fund and transaction comes in; the guide on CAMS import shows the steps.'),
      ('Is this investment advice?', 'No. The app and these guides show facts about your own money; what you do with them is your decision.')],
 related=['mutual-fund-portfolio-tracker', 'retirement-bucket-strategy', 'goal-based-investing'])

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
        urls.append((slug + '/', TODAY, '0.8' if slug in TOOLS or slug in ('tools', 'guides') else '0.9'))
    urls += [('goal-planner/', TODAY, '0.9'), ('privacy/', TODAY, '0.3'), ('terms/', TODAY, '0.3'), ('donate', TODAY, '0.4')]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url><loc>{SITE}/{u}</loc><lastmod>{m}</lastmod><priority>{pr}</priority></url>\n' for u, m, pr in urls) + '</urlset>\n'
    open(os.path.join(ROOT, 'sitemap.xml'), 'w').write(sm)
    print(len(PAGES), 'pages written; sitemap has', len(urls), 'urls')

if __name__ == '__main__':
    main()

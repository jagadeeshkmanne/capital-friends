# Hero illustrations for the guides, in the home page's visual language (flat busts, icon discs, cards, dashed
# connectors, light CSS animations). Pure inline SVG so the static pages need no JavaScript.
NAVY, INK, SLATE, LINE, MIST = '#0f172a', '#1e293b', '#64748b', '#e2e8f0', '#f1f5f9'
TEAL, EMERALD, VIOLET, LILAC, AMBER, SKY, ROSE = '#14b8a6', '#10b981', '#7c3aed', '#a78bfa', '#f59e0b', '#0ea5e9', '#f43f5e'
SKIN = {'you': '#d9a27a', 'spouse': '#f1c7a1', 'mother': '#d9a27a', 'father': '#b97e57', 'son': '#f1c7a1', 'daughter': '#f1c7a1'}
SHIRT = {'you': VIOLET, 'spouse': ROSE, 'mother': AMBER, 'father': SKY, 'son': EMERALD, 'daughter': TEAL}
HAIR = {'you': '#2b2131', 'spouse': '#2b2131', 'mother': '#94a3b8', 'father': '#cbd5e1', 'son': '#4b2e1e', 'daughter': '#2b2131'}
F = "font-family:Inter,system-ui,sans-serif"

CSS = r"""
.art{margin:18px 0 26px;background:linear-gradient(180deg,#fff,#f8fafc);border:1px solid #e2e8f0;border-radius:18px;padding:10px 14px;overflow:hidden}
.art svg{width:100%;height:auto;display:block}
.art .t{font-family:Inter,system-ui,sans-serif;font-weight:600}
.a-rise{animation:aRise .9s cubic-bezier(.2,.8,.2,1) both}.a-d1{animation-delay:.15s}.a-d2{animation-delay:.3s}.a-d3{animation-delay:.45s}.a-d4{animation-delay:.6s}.a-d5{animation-delay:.75s}.a-d6{animation-delay:.9s}
.a-float{animation:aFloat 5.5s ease-in-out infinite}
.a-dash{stroke-dasharray:6 8;animation:aDash 1.2s linear infinite}
.a-draw{stroke-dasharray:1200;stroke-dashoffset:1200;animation:aDraw 2.2s cubic-bezier(.4,0,.2,1) .4s forwards}
.a-donut{animation:aDonut 1.4s cubic-bezier(.4,0,.2,1) both}.a-donut.d2{animation-delay:.25s}.a-donut.d3{animation-delay:.5s}.a-donut.d4{animation-delay:.7s}
.a-grow{transform-box:fill-box;transform-origin:left;animation:aGrowX 1s cubic-bezier(.2,.8,.2,1) both .5s}
.a-fill{transform-box:fill-box;animation:aFill 2.4s ease-out both .4s}.a-fill.f2{animation-delay:.9s}.a-fill.f3{animation-delay:1.4s}
.a-pulse{transform-box:fill-box;transform-origin:center;animation:aPulse 2.2s ease-in-out infinite}
.a-coin{animation:aCoin 2.8s cubic-bezier(.5,0,.75,0) infinite}.a-coin.c2{animation-delay:.9s}.a-coin.c3{animation-delay:1.8s}
.a-mail{offset-path:path('M250 150 C 400 90, 560 90, 720 150');offset-rotate:0deg;animation:aMail 4s ease-in-out infinite 1s;opacity:0}
.a-car{offset-path:path('M60 250 C 220 250, 300 120, 470 150 S 760 230, 940 120');offset-rotate:auto;animation:aCar 9s linear infinite}
.a-tick{transform-box:fill-box;transform-origin:center;animation:aPop .6s cubic-bezier(.3,1.6,.5,1) both}
@keyframes aRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes aFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes aDash{to{stroke-dashoffset:-28}}
@keyframes aDraw{to{stroke-dashoffset:0}}
@keyframes aDonut{from{stroke-dasharray:0 400}}
@keyframes aGrowX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes aFill{from{transform:translateY(60%)}to{transform:none}}
@keyframes aPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes aCoin{0%{transform:translateY(-12px);opacity:0}12%{opacity:1}75%{transform:translateY(70px);opacity:1}82%,100%{transform:translateY(74px);opacity:0}}
@keyframes aMail{0%{offset-distance:0%;opacity:0;transform:scale(.6)}10%{opacity:1;transform:scale(1)}80%{offset-distance:100%;opacity:1}92%,100%{offset-distance:100%;opacity:0;transform:scale(.4)}}
@keyframes aCar{to{offset-distance:100%}}
@keyframes aPop{from{transform:scale(0)}to{transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.art *{animation:none!important;stroke-dashoffset:0!important;opacity:1!important}}
"""

def svg(body, h=320, w=1000):
    return f'<figure class="art" aria-hidden="true"><svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">{body}</svg></figure>'

def bust(x, y, who='you', r=28, cls=''):
    sk, sh, hr = SKIN[who], SHIRT[who], HAIR[who]
    long = who in ('spouse', 'daughter'); bun = who == 'mother'; s = r / 28
    return (f'<g class="{cls}"><g transform="translate({x} {y})"><circle r="{r}" fill="{sh}" opacity=".16"/><clipPath id="c{x}{y}{who}"><circle r="{r}"/></clipPath>'
            f'<g clip-path="url(#c{x}{y}{who})" transform="scale({s:.3f})">' + (f'<path d="M-15 -14 Q-17 14 -10 20 H10 Q17 14 15 -14 Z" fill="{hr}"/>' if long else '') +
            f'<path d="M-24 34 Q-24 12 0 12 Q24 12 24 34 Z" fill="{sh}"/><rect x="-4.5" y="4" width="9" height="10" rx="4" fill="{sk}"/><circle cy="-6" r="12" fill="{sk}"/>' +
            (f'<circle cy="-21" r="5.5" fill="{hr}"/>' if bun else '') +
            (f'<path d="M-13 -6 Q-13 -20 0 -20 Q13 -20 13 -6 Q6 -14 -4 -12 Q-10 -10 -13 -6 Z" fill="{hr}"/>' if long else f'<path d="M-12.5 -7 Q-13 -20 0 -19.5 Q13 -20 12.5 -7 Q9 -13 0 -13 Q-8 -13 -12.5 -7 Z" fill="{hr}"/>') +
            f'<circle cx="-4" cy="-5" r="1.3" fill="{NAVY}"/><circle cx="4" cy="-5" r="1.3" fill="{NAVY}"/><path d="M-3.5 0 Q0 2.6 3.5 0" fill="none" stroke="{NAVY}" stroke-width="1.3" stroke-linecap="round"/></g></g></g>')

ICON = {
 'lock': 'M-7 -1h14v10h-14z M-4 -1v-4a4 4 0 0 1 8 0v4', 'sheet': 'M-7 -9h14v18h-14z M-7 -3h14 M-7 3h14 M-2 -9v18', 'chart': 'M-8 6l5-6 4 4 7-8 M4 -4h4v4',
 'bank': 'M-8 -3l8-5 8 5 M-6 -3v8 M-2 -3v8 M2 -3v8 M6 -3v8 M-8 7h16', 'shield': 'M0 -9l7 3v5c0 5-3.5 7.5-7 9c-3.5-1.5-7-4-7-9v-5z M-3 0l2 2 4-4', 'card': 'M-8 -5h16v10h-16z M-8 -1h16 M-5 3h4',
 'home': 'M-8 0l8-7 7 7 M-6 -1v8h12v-8 M-1 7v-4h2v4', 'gold': 'M-7 4h14l-2-6h-10z M-4 -2l1.5-4h5L4 -2', 'jar': 'M-5 -8h10 M-4 -8v2c-2 1-3 3-3 5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6c0-2-1-4-3-5v-2',
 'mail': 'M-8 -5h16v10h-16z M-8 -4l8 5 8-5', 'bell': 'M-5 3v-4a5 5 0 0 1 10 0v4l2 2h-14z M-2 6a2 2 0 0 0 4 0', 'pdf': 'M-6 -9h8l4 4v14h-12z M2 -9v4h4', 'flag': 'M-5 9v-18 M-5 -9h10l-3 4 3 4h-10',
 'check': 'M-6 0l4 4 8-8', 'rupee': 'M-5 -8h10 M-5 -3h10 M-5 -8c6 0 8 2 8 5s-2 5-8 5l8 7', 'swap': 'M-7 -3h12l-3-3 M7 3h-12l3 3', 'users': 'M-3 -2a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z M-9 7c0-4 2.5-6 6-6s6 2 6 6 M5 -8a3.5 3.5 0 0 1 0 6.5 M7 0c2.5 1 4 3 4 7',
}
def disc(x, y, icon, color, r=22, cls=''):
    return f'<g class="{cls}"><g transform="translate({x} {y})"><circle r="{r}" fill="{color}"/><circle r="{r}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="{max(2, r/7):.0f}"/><g transform="scale({r/22:.3f})"><path d="{ICON[icon]}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></g></g>'
def card(x, y, w, h, cls='', fill='#fff'):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="{LINE}" class="{cls}"/>'
def text(x, y, s, size=13, color=INK, w=600, anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{color}" text-anchor="{anchor}" style="{F}">{s}</text>'
def line(x1, y1, x2, y2, color=TEAL, cls='a-dash'):
    return f'<path d="M{x1} {y1} C {(x1+x2)/2} {y1}, {(x1+x2)/2} {y2}, {x2} {y2}" fill="none" stroke="{color}" stroke-width="2.5" class="{cls}"/>'
def chip(x, y, s, color, w=None, size=12):
    w = w or (len(s) * 7 + 22)
    return f'<g><rect x="{x}" y="{y}" width="{w}" height="26" rx="13" fill="{color}" opacity=".14"/>' + text(x + w / 2, y + 17, s, size, color, 700, 'middle') + '</g>'
def rows(x, y, items, w=300, gap=30):
    out = ''
    for i, (lab, val, col) in enumerate(items):
        yy = y + i * gap
        out += f'<circle cx="{x+10}" cy="{yy-5}" r="5" fill="{col}"/>' + text(x + 24, yy, lab, 13, INK, 500) + text(x + w, yy, val, 13, NAVY, 700, 'end')
    return out

# ────────────────────────── the scenes ──────────────────────────
def drive():
    b = card(60, 70, 230, 190, 'a-rise') + bust(175, 130, 'you', 34) + f'<rect x="100" y="185" width="150" height="34" rx="17" fill="{NAVY}"/>' + text(175, 207, 'Sign in with Google', 13, '#fff', 600, 'middle')
    b += line(290, 165, 390, 165)
    b += card(390, 70, 230, 190, 'a-rise a-d2') + f'<g transform="translate(430 110)"><path d="M0 0l16 -28h32l16 28z" fill="#fbbf24"/><path d="M0 0h64l-16 28h-32z" fill="#34a853"/><path d="M16 -28l16 28l-16 28l-16-28z" fill="#4285f4"/></g>' + text(560, 108, 'Your Drive', 16, NAVY, 700, 'middle') + f'<rect x="410" y="160" width="190" height="14" rx="7" fill="{MIST}"/><rect x="410" y="184" width="150" height="14" rx="7" fill="{MIST}"/>' + f'<rect x="410" y="214" width="190" height="30" rx="8" fill="#ecfdf5" stroke="{EMERALD}" stroke-width="1.5"/>' + disc(430, 229, 'sheet', EMERALD, 10) + text(448, 234, 'Capital Friends', 13, '#065f46', 700)
    b += line(620, 165, 720, 165)
    b += card(720, 70, 220, 190, 'a-rise a-d4') + f'<rect x="720" y="70" width="220" height="40" rx="14" fill="{EMERALD}"/><rect x="720" y="96" width="220" height="14" fill="{EMERALD}"/>' + text(740, 96, 'Your sheet', 14, '#fff', 700) + disc(915, 90, 'lock', '#065f46', 13)
    for i in range(4):
        y = 124 + i * 30
        b += f'<rect x="740" y="{y}" width="60" height="14" rx="7" fill="{[LILAC, SKY, AMBER, EMERALD][i]}" opacity=".7"/><rect x="810" y="{y}" width="110" height="14" rx="7" fill="{MIST}"/>'
    b += text(500, 300, 'No server. No bank login. One file, in your own Drive.', 14, SLATE, 600, 'middle')
    return svg(b)

def members():
    b = ''
    who = [('you', 'You'), ('spouse', 'Spouse'), ('father', 'Father'), ('mother', 'Mother'), ('son', 'Son')]
    for i, (k, lab) in enumerate(who):
        x = 110 + i * 195
        b += bust(x, 70, k, 34, f'a-rise a-d{i+1}') + text(x, 122, lab, 13, NAVY, 700, 'middle')
        b += line(x, 104, x, 150, LILAC)
        b += card(x - 85, 150, 170, 60, f'a-rise a-d{i+2}') + disc(x - 60, 180, 'bank', SKY, 14) + text(x - 40, 176, ['HDFC · savings', 'Axis · savings', 'SBI · savings', 'HDFC · FD', 'HDFC · minor'][i], 12, INK, 600) + text(x - 40, 194, 'mapped bank', 11, SLATE, 500)
        b += card(x - 85, 222, 170, 60, f'a-rise a-d{i+3}') + disc(x - 60, 252, 'chart', VIOLET, 14) + text(x - 40, 248, ['Zerodha · demat', 'Groww · MF', 'Direct · AMC', 'Distributor · ARN', 'Zerodha · minor'][i], 12, INK, 600) + text(x - 40, 266, 'investment account', 11, SLATE, 500)
    return svg(b, 300)

def health():
    qs = [('Health insurance', 1), ('Term life cover', 0), ('Emergency fund', 1), ('Family aware of investments', 1), ('A Will', 0), ('Nominees updated', 1), ('Clear goals', 1)]
    b = card(70, 30, 440, 260, 'a-rise') + text(90, 60, 'Financial health check', 15, NAVY, 700)
    for i, (q, ok) in enumerate(qs):
        y = 90 + i * 29
        col = EMERALD if ok else ROSE
        b += f'<g class="a-tick" style="animation-delay:{.3+i*.12:.2f}s"><circle cx="100" cy="{y-5}" r="9" fill="{col}"/><path d="{"M95 " + str(y-5) + "l3 3 6-6" if ok else "M96 " + str(y-9) + "l8 8 M104 " + str(y-9) + "l-8 8"}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>' + text(120, y, q, 13, INK, 500) + text(490, y, 'Yes' if ok else 'No', 12, col, 700, 'end')
    b += f'<g class="a-rise a-d2"><g transform="translate(680 150)"><circle r="70" fill="none" stroke="{MIST}" stroke-width="16"/><circle r="70" fill="none" stroke="{EMERALD}" stroke-width="16" stroke-linecap="round" stroke-dasharray="314 440" transform="rotate(-90)" class="a-donut"/>' + text(0, -2, '5 / 7', 30, NAVY, 800, 'middle') + text(0, 22, 'answered yes', 12, SLATE, 600, 'middle') + '</g></g>'
    b += card(790, 70, 180, 56, 'a-rise a-d3', '#fff1f2') + disc(815, 98, 'shield', ROSE, 14) + text(835, 94, 'Get term cover', 13, '#9f1239', 700) + text(835, 112, '10–15× income', 11, SLATE, 500)
    b += card(790, 140, 180, 56, 'a-rise a-d4', '#fffbeb') + disc(815, 168, 'sheet', AMBER, 14) + text(835, 164, 'Write a Will', 13, '#92400e', 700) + text(835, 182, 'action required', 11, SLATE, 500)
    b += text(880, 250, 'stays on the dashboard', 12, SLATE, 600, 'middle') + text(880, 268, 'until fixed', 12, SLATE, 600, 'middle')
    return svg(b)

def cams():
    b = card(60, 60, 200, 220, 'a-rise') + f'<rect x="90" y="85" width="80" height="26" rx="6" fill="#fee2e2"/>' + text(130, 103, 'PDF', 13, '#b91c1c', 800, 'middle') + text(180, 103, 'CAS', 13, INK, 700)
    for i in range(5): b += f'<rect x="90" y="{125+i*22}" width="{140 if i%2 else 110}" height="10" rx="5" fill="{MIST}"/>'
    b += text(160, 262, 'CAMS + KFintech · detailed', 11, SLATE, 600, 'middle')
    b += line(260, 170, 360, 170)
    b += card(360, 50, 330, 240, 'a-rise a-d2') + text(380, 80, 'Mutual funds · 74 funds, 839 transactions', 13, NAVY, 700)
    b += rows(380, 115, [('Flexi cap fund', '₹28.4 L', LILAC), ('Multi asset fund', '₹13.3 L', LILAC), ('Global index fund', '₹11.4 L', SKY), ('Balanced advantage', '₹6.0 L', EMERALD), ('Every SIP, switch and sale', 'since 2000', SLATE)], 290, 32)
    b += line(690, 170, 770, 170)
    for i, (k, lab) in enumerate([('you', 'Your CAS'), ('spouse', "Spouse's CAS"), ('mother', "Mother's CAS")]):
        y = 90 + i * 70
        b += card(770, y - 28, 180, 56, f'a-rise a-d{i+3}') + bust(800, y, k, 20) + text(828, y - 2, lab, 13, INK, 700) + text(828, y + 15, 'imported ✓', 11, EMERALD, 700)
    return svg(b)

def funds():
    tiles = [('Your money in', '₹1.58 Cr', LILAC), ('Current value', '₹2.04 Cr', EMERALD), ('XIRR', '11.5%', SKY), ('CAGR', '16.4%', AMBER)]
    b = ''
    for i, (l, v, c) in enumerate(tiles):
        x = 60 + i * 150
        b += card(x, 30, 140, 70, f'a-rise a-d{i+1}') + f'<rect x="{x}" y="30" width="6" height="70" rx="3" fill="{c}"/>' + text(x + 18, 54, l, 11, SLATE, 600) + text(x + 18, 82, v, 19, NAVY, 800)
    b += card(60, 120, 560, 180, 'a-rise a-d3') + text(80, 146, 'Investment journey', 12, SLATE, 700)
    b += f'<path d="M80 270 C 150 262, 180 240, 240 236 S 330 210, 380 206 S 470 180, 520 172 S 580 150, 600 148" fill="none" stroke="{EMERALD}" stroke-width="3" class="a-draw"/>'
    b += f'<path d="M80 275 C 150 272, 200 262, 260 258 S 360 246, 420 240 S 540 226, 600 224" fill="none" stroke="{LILAC}" stroke-width="2.5" stroke-dasharray="4 4"/>'
    b += text(600, 140, 'value', 11, EMERALD, 700, 'end') + text(600, 218, 'money in', 11, '#6d28d9', 700, 'end')
    b += card(650, 30, 300, 270, 'a-rise a-d4') + text(670, 56, 'Each fund vs its own high', 12, SLATE, 700)
    for i, (n, pct, c) in enumerate([('Flexi cap fund', '7% below', AMBER), ('Multi asset fund', '2% below', EMERALD), ('Global index', 'at high', EMERALD), ('Small cap fund', '12% below', ROSE)]):
        y = 90 + i * 52
        b += text(670, y, n, 13, INK, 600) + f'<rect x="670" y="{y+8}" width="260" height="10" rx="5" fill="{MIST}"/><rect x="670" y="{y+8}" width="{[240,255,260,225][i]}" height="10" rx="5" fill="{c}" class="a-grow"/>' + text(930, y, pct, 12, c, 700, 'end')
    return svg(b)

def rebalance():
    b = card(60, 30, 480, 270, 'a-rise') + text(80, 58, 'Current → target', 13, NAVY, 700)
    for i, (n, cur, tgt, c) in enumerate([('Flexi cap fund', 65, 50, ROSE), ('Asset allocation fund', 23, 30, SKY), ('Global index fund', 12, 20, EMERALD)]):
        y = 95 + i * 65
        b += text(80, y, n, 13, INK, 600) + text(520, y, f'{cur}% → {tgt}%', 12, c, 700, 'end')
        b += f'<rect x="80" y="{y+8}" width="440" height="12" rx="6" fill="{MIST}"/><rect x="80" y="{y+8}" width="{cur*4.4:.0f}" height="12" rx="6" fill="{c}" opacity=".8" class="a-grow"/><rect x="{80+tgt*4.4:.0f}" y="{y+3}" width="3" height="22" fill="{NAVY}"/>'
        b += text(80, y + 38, 'reduce' if cur > tgt else 'add', 11, c, 700)
    for i, (lab, sub, c, ic) in enumerate([('Adjust SIP', 'next month: ₹0 · ₹22k · ₹18k', EMERALD, 'swap'), ('Lump sum', '₹6.9 L into the two short funds', SKY, 'rupee'), ('Buy & sell', 'sell ₹3.5 L, buy ₹1.9 L + ₹1.5 L', AMBER, 'chart')]):
        y = 40 + i * 90
        b += card(580, y, 370, 74, f'a-rise a-d{i+2}') + disc(615, y + 37, ic, c, 20) + text(648, y + 32, lab, 15, NAVY, 700) + text(648, y + 54, sub, 12, SLATE, 500)
    return svg(b)

def stocks():
    b = card(60, 60, 220, 200, 'a-rise') + f'<rect x="85" y="85" width="80" height="26" rx="6" fill="#dcfce7"/>' + text(125, 103, 'XLSX', 13, '#166534', 800, 'middle') + text(175, 103, 'holdings', 13, INK, 700)
    for i in range(4): b += f'<rect x="85" y="{125+i*24}" width="60" height="10" rx="5" fill="{MIST}"/><rect x="155" y="{125+i*24}" width="40" height="10" rx="5" fill="{MIST}"/><rect x="205" y="{125+i*24}" width="50" height="10" rx="5" fill="{MIST}"/>'
    b += text(170, 240, 'Zerodha · Groww · CDSL · NSDL', 11, SLATE, 600, 'middle')
    b += line(280, 160, 370, 160)
    b += card(370, 40, 340, 240, 'a-rise a-d2') + text(390, 68, 'Stocks · 2 demat accounts', 13, NAVY, 700)
    b += rows(390, 104, [('HDFC Bank', '+18%', EMERALD), ('Infosys', '+9%', EMERALD), ('Tata Motors', '−4%', ROSE), ('ITC', '+22%', EMERALD), ('Current value', '₹21.6 L', SLATE)], 300, 34)
    b += line(710, 160, 790, 160)
    b += f'<g class="a-rise a-d4"><g transform="translate(860 160)"><circle r="68" fill="none" stroke="{MIST}" stroke-width="18"/>'
    for i, (c, d, o) in enumerate([(LILAC, 196, 0), (SKY, 70, 196), (AMBER, 50, 266), (EMERALD, 111, 316)]):
        b += f'<circle r="68" fill="none" stroke="{c}" stroke-width="18" stroke-dasharray="{d} 427" stroke-dashoffset="-{o}" transform="rotate(-90)" class="a-donut d{i+1}"/>'
    b += text(0, -4, 'net worth', 11, SLATE, 600, 'middle') + text(0, 16, '₹3.5 Cr', 18, NAVY, 800, 'middle') + '</g></g>' + text(860, 262, 'stocks count in the family total', 11, SLATE, 600, 'middle')
    return svg(b)

def others():
    items = [('bank', SKY, 'Fixed deposit', '₹12 L', 'matures Mar 2027'), ('jar', VIOLET, 'EPF', '₹30 L', 'retirement only'), ('gold', AMBER, 'Gold · 250 g · 22K', '₹35 L', "at today's rate"), ('home', EMERALD, 'House', '₹1.6 Cr', 'loan ₹90 L linked')]
    b = ''
    for i, (ic, c, l, v, s) in enumerate(items):
        x = 60 + i * 230
        b += card(x, 60, 205, 150, f'a-rise a-d{i+1}') + disc(x + 36, 100, ic, c, 24) + text(x + 70, 96, l, 13, INK, 700) + text(x + 70, 124, v, 20, NAVY, 800) + text(x + 70, 146, s, 11, SLATE, 500)
        if ic == 'gold':
            b += f'<g class="a-coin"><circle cx="{x+36}" cy="150" r="7" fill="{AMBER}"/><circle cx="{x+36}" cy="150" r="4" fill="none" stroke="#fff" stroke-opacity=".6"/></g>'
    b += f'<rect x="250" y="236" width="500" height="26" rx="13" fill="{MIST}"/><rect x="250" y="236" width="400" height="26" rx="13" fill="{EMERALD}" opacity=".9"/><rect x="650" y="236" width="100" height="26" rx="13" fill="{ROSE}" opacity=".8"/>' + text(450, 254, 'assets ₹4.41 Cr', 12, '#fff', 700, 'middle') + text(700, 254, 'loans ₹90 L', 11, '#fff', 700, 'middle') + text(500, 282, 'net worth ₹3.51 Cr', 13, NAVY, 800, 'middle')
    b += text(500, 304, 'everything that is not a mutual fund, in the same family number', 12, SLATE, 600, 'middle')
    return svg(b)

def insurance():
    b = f'<g class="a-rise"><g transform="translate(220 160)"><path d="M0 -120l95 38v62c0 62-45 95-95 115c-50-20-95-53-95-115v-62z" fill="#ecfdf5" stroke="{EMERALD}" stroke-width="3"/></g></g>'
    b += bust(190, 130, 'you', 30) + bust(250, 130, 'spouse', 30) + bust(200, 200, 'son', 24) + bust(245, 200, 'daughter', 24)
    b += text(220, 268, 'the family, covered', 12, '#065f46', 700, 'middle')
    for i, (t, ins, cov, nom, c) in enumerate([('Term life', 'ICICI Pru · ₹2 Cr', '10–15× income ✓', 'nominee: spouse', EMERALD), ('Health floater', 'HDFC Ergo · ₹1 Cr', 'family floater ✓', 'nominee: spouse', SKY)]):
        y = 50 + i * 120
        b += card(400, y, 330, 100, f'a-rise a-d{i+2}') + disc(435, y + 50, 'shield', c, 22) + text(470, y + 34, t, 14, NAVY, 700) + text(470, y + 54, ins, 12, INK, 500) + text(470, y + 74, nom, 12, SLATE, 500) + chip(600, y + 20, cov, c, 120, 11)
    b += card(760, 50, 190, 220, 'a-rise a-d4') + text(780, 78, 'Coverage check', 13, NAVY, 700)
    for i, (l, p, c) in enumerate([('Life cover', 100, EMERALD), ('Health cover', 100, EMERALD), ('Nominees', 100, EMERALD)]):
        y = 110 + i * 48
        b += text(780, y, l, 12, INK, 600) + f'<rect x="780" y="{y+8}" width="150" height="10" rx="5" fill="{MIST}"/><rect x="780" y="{y+8}" width="{p*1.5:.0f}" height="10" rx="5" fill="{c}" class="a-grow"/>'
    b += text(855, 258, 'reminded before renewal', 11, SLATE, 600, 'middle')
    return svg(b)

def goals():
    road = 'M60 250 C 220 250, 300 120, 470 150 S 760 230, 940 120'
    b = f'<path d="{road}" fill="none" stroke="{INK}" stroke-width="26" stroke-linecap="round" opacity=".9"/><path d="{road}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 14"/>'
    for i, (x, y, yr, lab, c, k) in enumerate([(300, 160, '2033', "Son's education · on track", SKY, 'son'), (560, 180, '2036', 'Retirement · on track', VIOLET, 'you'), (860, 130, '2039', "Daughter's education", AMBER, 'daughter')]):
        b += f'<g class="a-rise a-d{i+1}"><rect x="{x-1.5}" y="{y-60}" width="3" height="60" fill="{c}"/><path d="M{x} {y-60}h34l-10 10 10 10h-34z" fill="{c}"/>' + text(x + 17, y - 44, yr, 10, '#fff', 800, 'middle') + '</g>'
        b += card(x - 80, y - 125, 170, 50, f'a-rise a-d{i+2}') + bust(x - 55, y - 100, k, 18) + text(x - 30, y - 104, lab.split(' · ')[0], 12, NAVY, 700) + text(x - 30, y - 88, lab.split(' · ')[1] if ' · ' in lab else 'on track', 11, EMERALD, 700)
    b += f'<g class="a-car"><rect x="-16" y="-9" width="32" height="18" rx="5" fill="{EMERALD}"/><rect x="-8" y="-15" width="16" height="8" rx="3" fill="{EMERALD}"/><circle cx="-9" cy="9" r="4" fill="{NAVY}"/><circle cx="9" cy="9" r="4" fill="{NAVY}"/></g>'
    b += text(100, 290, 'today', 12, SLATE, 700) + text(500, 300, 'equity → safe as each date comes near, only in good markets', 12, SLATE, 600, 'middle')
    return svg(b)

def buckets():
    b = ''
    for i, (lab, amt, sub, c, fill, delay) in enumerate([('Income', '2 years', 'liquid funds · pays expenses', SKY, 0.85, ''), ('Stability', '5 years', 'hybrid, debt, EPF', AMBER, 0.65, 'f2'), ('Growth', 'the rest', 'equity funds', EMERALD, 0.5, 'f3')]):
        x = 120 + i * 300
        b += f'<g class="a-rise a-d{i+1}"><rect x="{x-60}" y="80" width="120" height="150" rx="18" fill="#fff" stroke="{LINE}" stroke-width="2"/><clipPath id="jar{i}"><rect x="{x-58}" y="82" width="116" height="146" rx="16"/></clipPath>'
        b += f'<g clip-path="url(#jar{i})"><rect x="{x-60}" y="{80+150*(1-fill):.0f}" width="120" height="{150*fill:.0f}" fill="{c}" opacity=".85" class="a-fill {fill}"/></g>'
        b += f'<rect x="{x-50}" y="66" width="100" height="18" rx="6" fill="{NAVY}"/>' + text(x, 79, lab, 11, '#fff', 800, 'middle') + text(x, 160, amt, 18, '#fff' if fill > 0.6 else NAVY, 800, 'middle') + text(x, 256, sub, 12, SLATE, 600, 'middle') + '</g>'
    b += f'<path d="M700 90 C 660 50, 500 50, 480 90" fill="none" stroke="{EMERALD}" stroke-width="2.5" class="a-dash" marker-end="url(#ah)"/><path d="M400 90 C 360 50, 200 50, 180 90" fill="none" stroke="{EMERALD}" stroke-width="2.5" class="a-dash" marker-end="url(#ah)"/>'
    b += f'<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="{EMERALD}"/></marker></defs>'
    b += text(500, 32, 'refilled from Growth in good years · left alone in bad years', 12, '#065f46', 700, 'middle')
    b += text(500, 300, 'the next 7 years of expenses are always safe, so equity is never sold in a crash', 12, SLATE, 600, 'middle')
    return svg(b)

def networth():
    b = f'<g class="a-rise"><g transform="translate(500 165)"><circle r="86" fill="none" stroke="{MIST}" stroke-width="22"/>'
    for i, (c, d, o) in enumerate([(LILAC, 248, 0), (SKY, 194, 248), (AMBER, 43, 442), (EMERALD, 55, 485)]):
        b += f'<circle r="86" fill="none" stroke="{c}" stroke-width="22" stroke-dasharray="{d} 540" stroke-dashoffset="-{o}" transform="rotate(-90)" class="a-donut d{i+1}"/>'
    b += text(0, -6, 'family net worth', 11, SLATE, 600, 'middle') + text(0, 20, '₹3.51 Cr', 24, NAVY, 800, 'middle') + '</g></g>'
    for i, (k, x, y, lab, v) in enumerate([('you', 150, 90, 'You', '₹1.3 Cr'), ('spouse', 150, 240, 'Spouse', '₹1.4 Cr'), ('father', 850, 90, 'Father', '₹28 L'), ('mother', 850, 240, 'Mother', '₹21 L')]):
        b += bust(x, y, k, 30, f'a-rise a-d{i+1}') + text(x, y + 48, lab, 12, NAVY, 700, 'middle') + text(x, y + 64, v, 12, SLATE, 600, 'middle')
        b += line(x + (40 if x < 500 else -40), y, 500 + (-96 if x < 500 else 96), 165 + (y - 165) * 0.35, LILAC)
    for i, (c, l) in enumerate([(LILAC, 'Mutual funds 46%'), (SKY, 'Real estate 36%'), (AMBER, 'Gold 8%'), (EMERALD, 'EPF, FD 10%')]):
        b += f'<circle cx="{335+i*110}" cy="296" r="5" fill="{c}"/>' + text(345 + i * 110, 300, l, 11, INK, 600)
    return svg(b)

def mail():
    b = card(60, 60, 210, 200, 'a-rise') + f'<path d="M85 95h160v110h-160z" fill="#ecfdf5" stroke="{EMERALD}" stroke-width="2"/><path d="M85 95l80 55 80-55" fill="none" stroke="{EMERALD}" stroke-width="2"/>' + text(165, 232, 'from your own Gmail', 11, SLATE, 600, 'middle') + text(165, 248, 'every morning', 11, SLATE, 600, 'middle')
    b += f'<g class="a-mail"><rect x="-26" y="-18" width="52" height="36" rx="6" fill="{EMERALD}"/><path d="M-26 -18l26 18 26-18" fill="none" stroke="#fff" stroke-width="2"/></g>'
    b += card(370, 30, 320, 270, 'a-rise a-d2') + f'<rect x="370" y="30" width="320" height="36" rx="14" fill="{NAVY}"/><rect x="370" y="52" width="320" height="14" fill="{NAVY}"/>' + text(390, 54, 'Family Financial Blueprint', 13, '#fff', 700)
    b += rows(390, 96, [('Net worth · every account', '₹3.51 Cr', LILAC), ('Every fund and its value', '32 funds', SKY), ('Policies with nominees', '4', EMERALD), ('Loans · EMI · months left', '1', AMBER), ('Goals and the next step', '3', VIOLET), ('SIPs and premiums due', '5', ROSE)], 280, 32)
    for i, (k, lab) in enumerate([('spouse', 'Spouse'), ('son', 'Son'), ('father', 'Father')]):
        y = 80 + i * 75
        b += bust(790, y, k, 26, f'a-rise a-d{i+3}') + text(826, y - 2, lab, 13, NAVY, 700) + text(826, y + 16, 'knows where everything is', 11, EMERALD, 700)
    b += line(690, 165, 760, 165)
    return svg(b)

ART = {'your-data-in-your-google-drive': drive, 'family-members-and-accounts': members, 'financial-health-check': health, 'cams-cas-import': cams,
       'mutual-fund-portfolio-tracker': funds, 'portfolio-rebalancing': rebalance, 'stock-portfolio-tracker': stocks, 'track-fd-ppf-epf-gold-property': others,
       'insurance-tracker': insurance, 'goal-based-investing': goals, 'retirement-bucket-strategy': buckets, 'family-net-worth-tracker': networth, 'family-financial-blueprint-email': mail}
def art(slug):
    f = ART.get(slug)
    return f() if f else ''

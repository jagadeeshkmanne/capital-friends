import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Search, Youtube, Users, MessageCircle, Instagram, Linkedin, Newspaper, MoreHorizontal, Bug, Lightbulb, Paperclip, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../services/api'

// "How did you hear about Capital Friends?" — asked once per family, after setup is finished.
// The answer is saved in the family's Settings tab (FoundUsVia), so nobody else in the family is asked again.
// The little friend at the top reacts: waves, is happy when you pick, sad for a bug, thinks for a feature, cheers at the end.

const DEV_EMAIL = 'capital.friends.dev@gmail.com'
export const FOUND_US_OPTIONS = [
  { k: 'google', label: 'Google search', Icon: Search, line: 'Google sent you? Nice!' },
  { k: 'youtube', label: 'YouTube', Icon: Youtube, ask: 'Which channel or video? (optional)', line: 'Yay! Thanks for watching.' },
  { k: 'friend', label: 'Friend or family', Icon: Users, ask: 'Who told you? (optional)', line: 'Best way! Thank them for us.' },
  { k: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, line: 'A good forward, finally!' },
  { k: 'social', label: 'Instagram / Facebook', Icon: Instagram, line: 'Hello from the feed!' },
  { k: 'linkedin', label: 'LinkedIn / X', Icon: Linkedin, line: 'Networking works!' },
  { k: 'article', label: 'Blog or news', Icon: Newspaper, line: 'Ooh, we made the news?' },
  { k: 'other', label: 'Other', Icon: MoreHorizontal, ask: 'Where did you hear about us?', line: 'Tell us where, we are curious!' },
]
const HELLO = 'Hi! One quick question.'
const CONFETTI = ['#8b5cf6', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#f87171']
// pages where someone is in the middle of a task: ask on the next page instead
const BUSY = /^\/(health-check|import|investments\/stocks\/import-trades)/
const LATER_KEY = 'cf_foundus_later'
let answered = false   // answered in this page load: never ask again, even before the settings come back

export default function FoundUsDialog() {
  const { loading, healthCheckCompleted, settings, settingsAt, settling } = useData()
  const { pathname } = useLocation()
  const [show, setShow] = useState(false)
  const ready = !loading && healthCheckCompleted === true && settingsAt > 0 && settings && !settings.FoundUsVia && !settling && !BUSY.test(pathname)

  // ask only when the screen has been calm for 2.5 s: no pop-up or sheet open (an import form, a confirm, the menu)
  useEffect(() => {
    if (show || !ready || answered) return
    let calm = 0
    const t = setInterval(() => {
      try { if (sessionStorage.getItem(LATER_KEY) === '1') { clearInterval(t); return } } catch { /* ignore */ }
      if (popupOpen()) { calm = 0; return }
      calm += 500
      if (calm >= 2500) { clearInterval(t); setShow(true) }
    }, 500)
    return () => clearInterval(t)
  }, [ready, show])

  if (!show) return null
  return createPortal(<Dialog onDone={() => setShow(false)} />, document.body)
}

// Is any dialog, sheet or menu open right now? App pop-ups are full-screen fixed layers (z-40 and up) or Ionic overlays on phones.
function popupOpen() {
  if (document.querySelector('ion-modal:not(.overlay-hidden), ion-alert:not(.overlay-hidden), ion-loading:not(.overlay-hidden), ion-action-sheet:not(.overlay-hidden), ion-popover:not(.overlay-hidden)')) return true
  for (const el of document.querySelectorAll('.fixed.inset-0, [role="dialog"], [aria-modal="true"]')) {
    if (el.closest('.cfq-ov') || !el.getClientRects().length) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0' || cs.pointerEvents === 'none') continue   // closed menus stay in the page, faded out
    if (el.matches('[role="dialog"], [aria-modal="true"]') || (parseInt(cs.zIndex, 10) || 0) >= 40) return true
  }
  return false
}

function Dialog({ onDone }) {
  const { updateSettings } = useData()
  const [pick, setPick] = useState('')
  const [detail, setDetail] = useState('')
  const [mood, setMood] = useState('idle')
  const [line, setLine] = useState(HELLO)
  const [lineKey, setLineKey] = useState(0)
  const [help, setHelp] = useState('')
  const [done, setDone] = useState(false)
  const [confetti, setConfetti] = useState([])
  const m = useRef(null)
  const base = useRef('idle')

  const say = (t) => { setLine(t); setLineKey((x) => x + 1) }
  const replay = (cls) => { const el = m.current; if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls) }
  useEffect(() => { const t = setTimeout(() => m.current?.classList.remove('wave'), 1600); return () => clearTimeout(t) }, [])

  // mandatory: keep the page behind from scrolling
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])

  const opt = FOUND_US_OPTIONS.find((o) => o.k === pick)
  const canGo = !!pick && !(pick === 'other' && !detail.trim()) && !done

  function choose(o) {
    setPick(o.k); setDetail(''); setHelp('')
    base.current = o.k === 'other' ? 'curious' : 'happy'
    setMood(base.current); replay('hop'); say(o.line)
  }
  function typeDetail(v) {
    setDetail(v)
    if (pick === 'other' && v.trim() && base.current !== 'happy') { base.current = 'happy'; setMood('happy'); replay('hop') }
  }
  function toggleHelp(k) {
    if (help === k) { setHelp(''); setMood(base.current); say(base.current === 'idle' ? HELLO : 'Okay! Back to it.'); return }
    setHelp(k)
    if (k === 'bug') { setMood('sad'); say('Oh no! Sorry about that.') } else { setMood('think'); replay('hop'); say('Ooh, an idea! Tell us.') }
  }
  function look(e) {
    const el = m.current; if (!el) return
    const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const n = Math.max(60, Math.hypot(dx, dy))
    el.style.setProperty('--lx', (dx / n * 3).toFixed(2) + 'px'); el.style.setProperty('--ly', (dy / n * 3).toFixed(2) + 'px')
  }

  async function submit() {
    if (!canGo) return
    const data = { via: pick, detail: detail.trim().slice(0, 120) }
    setDone(true); setMood('cheer'); replay('leap'); say('Woohoo! Thank you!')
    setConfetti(Array.from({ length: 26 }, (_, i) => ({
      i, c: CONFETTI[i % CONFETTI.length], x: Math.round((Math.random() * 2 - 1) * 200), y: -Math.round(40 + Math.random() * 80),
      r: Math.round((Math.random() * 2 - 1) * 540), d: (Math.random() * 0.12).toFixed(2),
    })))
    const closeAt = Date.now() + 2400
    answered = true
    try {
      try { await api.saveFoundUs(data) }
      catch { await updateSettings({ FoundUsVia: data.via, FoundUsDetail: data.detail, FoundUsAt: new Date().toISOString() }) }   // server not updated yet
    } catch {
      try { sessionStorage.setItem(LATER_KEY, '1') } catch { /* ignore */ }   // couldn't save: ask again next time, not on every page now
    }
    setTimeout(onDone, Math.max(0, closeAt - Date.now()))
  }

  return (
    <div className="cfq-ov" role="dialog" aria-modal="true" aria-labelledby="cfq-title">
      <style>{CSS}</style>
      <div className="cfq-d" onPointerMove={look}>
        <div className="cfq-hero">
          <Mascot refEl={m} mood={mood} />
          <div key={lineKey} className="cfq-bub">{line}</div>
          {confetti.map((p) => <i key={p.i} className="cfq-cf" style={{ background: p.c, '--x': p.x + 'px', '--y': p.y + 'px', '--r': p.r + 'deg', animationDelay: p.d + 's' }} />)}
        </div>

        {done ? (
          <div className="cfq-done"><h3>Thank you!</h3><p>Your family is all set. Enjoy Capital Friends.</p></div>
        ) : (<>
          <div className="cfq-in">
            <h2 id="cfq-title">How did you hear about Capital Friends?</h2>
            <p className="cfq-sub">Asked once for your family.</p>
            <div className="cfq-opts">
              {FOUND_US_OPTIONS.map((o) => (
                <button key={o.k} type="button" className={`cfq-o${pick === o.k ? ' on' : ''}`} onClick={() => choose(o)}>
                  <o.Icon size={16} /><span>{o.label}</span><span className="cfq-rd" />
                </button>
              ))}
            </div>
            {opt?.ask && <input className="cfq-more" value={detail} maxLength={120} placeholder={opt.ask} onChange={(e) => typeDetail(e.target.value)} autoFocus={pick === 'other'} />}
            <button type="button" className="cfq-go" disabled={!canGo} onClick={submit}>Continue</button>
          </div>
          <div className="cfq-help">
            <p>Something not working, or something missing?</p>
            <div className="cfq-hb">
              <button type="button" className={help === 'bug' ? 'on' : ''} onClick={() => toggleHelp('bug')}><Bug size={15} />Report a bug</button>
              <button type="button" className={help === 'feature' ? 'on' : ''} onClick={() => toggleHelp('feature')}><Lightbulb size={15} />Request a feature</button>
            </div>
            {help && <Feedback key={help} kind={help} onSent={() => { setMood('happy'); replay('hop'); say('Got it! We will reply by email.') }} />}
          </div>
        </>)}
      </div>
    </div>
  )
}

// Write the message here and it is sent to the developer (backend: sendFeedback_ in gas-webapp/FoundUs.js).
// Subject is filled in for them; the email address stays as a fallback.
export function Feedback({ kind, onSent }) {
  const { pathname } = useLocation()
  const [text, setText] = useState('')
  const [shot, setShot] = useState(null)   // { name, type, data(base64), size }
  const [state, setState] = useState('')   // '' | sending | sent
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const bug = kind === 'bug'

  function pickShot(f) {
    setErr('')
    if (!f) { setShot(null); return }
    if (!/^image\//.test(f.type)) { setErr('Please attach an image (PNG or JPG).'); return }
    if (f.size > 3 * 1024 * 1024) { setErr('That image is over 3 MB. Please attach a smaller one.'); return }
    const r = new FileReader()
    r.onload = () => setShot({ name: f.name, type: f.type, size: f.size, data: String(r.result).split(',')[1] })
    r.readAsDataURL(f)
  }
  async function send() {
    if (text.trim().length < 5 || state === 'sending') return
    setState('sending'); setErr('')
    try {
      const entry = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src')?.split('/').pop() || ''
      await api.sendFeedback({ kind, message: text.trim(), page: pathname, device: navigator.userAgent, version: entry,
        screenshot: shot ? { name: shot.name, type: shot.type, data: shot.data } : null })
      setState('sent'); onSent?.()
    } catch (e) {
      setState(''); setErr((e && e.message) || 'Could not send. Please email us instead.')
    }
  }
  function copy() {
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    try { navigator.clipboard.writeText(DEV_EMAIL).then(ok, ok) } catch { ok() }
  }

  if (state === 'sent') return (
    <div className="cfq-mail cfq-sent">Sent. Thank you! We will reply to your email.</div>
  )
  return (
    <div className="cfq-mail">
      <textarea value={text} maxLength={4000} rows={3} autoFocus onChange={(e) => setText(e.target.value)}
        placeholder={bug ? 'What went wrong? What did you click, and what did you expect?' : 'What would you like Capital Friends to do?'} />
      <div className="cfq-row">
        {bug && (
          <label className="cfq-att">
            <input type="file" accept="image/*" onChange={(e) => pickShot(e.target.files?.[0])} />
            <Paperclip size={13} />{shot ? (shot.name.length > 22 ? shot.name.slice(0, 20) + '…' : shot.name) : 'Attach screenshot'}
          </label>
        )}
        {shot && <button type="button" className="cfq-x" onClick={() => setShot(null)} aria-label="Remove screenshot"><X size={13} /></button>}
        <button type="button" className="cfq-send" disabled={text.trim().length < 5 || state === 'sending'} onClick={send}>
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
      {err && <p className="cfq-err">{err}</p>}
      <p className="cfq-alt">Sent from your Gmail, so we can reply to you. Or write to <code className="select-all">{DEV_EMAIL}</code> <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button></p>
    </div>
  )
}

function Mascot({ refEl, mood }) {
  return (
    <svg ref={refEl} className="cfq-m wave" data-mood={mood} viewBox="-62 -64 124 124" aria-hidden="true">
      <defs><linearGradient id="cfq-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8a0ff" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
      <ellipse className="shadow" cx="0" cy="52" rx="26" ry="4.5" />
      <g className="bob"><g className="jump">
        <g transform="translate(-32 12)"><path className="arm arm-l" d="M0 0 Q-12 4 -14 15" /></g>
        <g transform="translate(32 12)"><path className="arm arm-r" d="M0 0 Q12 4 14 15" /></g>
        <g className="sprout"><path className="stem" d="M0 -33 Q-1 -41 1 -47" /><path className="leaf" d="M1 -45 Q11 -56 20 -50 Q12 -41 1 -45Z" /><path className="leaf l2" d="M0 -42 Q-9 -51 -16 -45 Q-9 -37 0 -42Z" /></g>
        <circle className="bd" cx="0" cy="4" r="38" fill="url(#cfq-g)" />
        <ellipse className="shine" cx="-15" cy="-17" rx="9" ry="5" transform="rotate(-32 -15 -17)" />
        <ellipse className="ck" cx="-23" cy="13" rx="5.5" ry="3.4" /><ellipse className="ck" cx="23" cy="13" rx="5.5" ry="3.4" />
        <g className="look"><g className="eyes-n">
          <ellipse cx="-13" cy="-1" rx="4.6" ry="6.2" /><ellipse cx="13" cy="-1" rx="4.6" ry="6.2" />
          <circle className="hl" cx="-11.4" cy="-3.6" r="1.6" /><circle className="hl" cx="14.6" cy="-3.6" r="1.6" />
        </g></g>
        <path className="eye-h" d="M-18 0 Q-13 -7 -8 0 M8 0 Q13 -7 18 0" />
        <path className="brow" d="M-20 -11 L-8 -14.5 M20 -11 L8 -14.5" />
        <path className="mo mo-n" d="M-7 13 Q0 19 7 13" />
        <g className="mo-h"><path d="M-10 11 Q0 26 10 11Z" /><path className="tongue" d="M-4.5 18.5 Q0 15 4.5 18.5 Q0 21 -4.5 18.5Z" /></g>
        <path className="mo mo-s" d="M-7 18 Q0 12 7 18" />
        <ellipse className="mo-o" cx="0" cy="15" rx="3.2" ry="3.8" />
        <path className="tear" d="M-15 5 q-3.2 5 0 7.5 q3.2 -2.5 0 -7.5Z" />
      </g></g>
      <g className="bulb"><path d="M41 -58 v-4 M29 -54 l-3 -3 M53 -54 l3 -3" /><circle cx="41" cy="-44" r="8" /><rect x="38" y="-37" width="6" height="5" rx="1.2" /></g>
    </svg>
  )
}

const CSS = `
.cfq-ov { position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(4,7,18,.62); backdrop-filter:blur(3px); animation:cfq-fade .25s ease-out }
.cfq-ov *, .cfq-ov *::before, .cfq-ov *::after { box-sizing:border-box }
.cfq-d { width:100%; max-width:460px; max-height:calc(100dvh - 32px); overflow:auto; background:var(--bg-card); border:1px solid var(--border); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.35); color:var(--text-primary); animation:cfq-rise .45s cubic-bezier(.2,.8,.2,1) both }
@media (max-width:1023.98px) {
  .cfq-ov { align-items:flex-end; padding:0 }
  .cfq-d { max-width:none; border-radius:24px 24px 0 0; max-height:94dvh; padding-bottom:env(safe-area-inset-bottom) }
}
@keyframes cfq-fade { from { opacity:0 } }
@keyframes cfq-rise { from { transform:translateY(24px) scale(.98); opacity:0 } }
.cfq-hero { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; gap:4px; padding:18px 18px 8px; min-height:146px; background:linear-gradient(180deg,rgba(139,92,246,.16),rgba(139,92,246,.03)) }
.cfq-bub { position:relative; max-width:190px; padding:9px 12px; border-radius:12px; background:var(--bg-inset); border:1px solid var(--border); font-size:12.5px; font-weight:500; animation:cfq-pop .35s cubic-bezier(.3,1.6,.5,1); transform-origin:left center }
.cfq-bub::before { content:""; position:absolute; left:-6px; top:50%; width:10px; height:10px; background:var(--bg-inset); border-left:1px solid var(--border); border-bottom:1px solid var(--border); transform:translateY(-50%) rotate(45deg) }
@keyframes cfq-pop { from { transform:scale(.6); opacity:0 } }
.cfq-cf { position:absolute; left:50%; top:52%; width:7px; height:10px; border-radius:2px; pointer-events:none; animation:cfq-cf 1.4s cubic-bezier(.2,.7,.3,1) forwards }
@keyframes cfq-cf { 40% { transform:translate(calc(var(--x)*.7),var(--y)) rotate(calc(var(--r)*.5)); opacity:1 } 100% { transform:translate(var(--x),calc(var(--y) + 120px)) rotate(var(--r)); opacity:0 } }

.cfq-m { width:108px; height:112px; flex:none; overflow:visible }
.cfq-m .shadow { fill:rgba(0,0,0,.18); transform-box:fill-box; transform-origin:center; animation:cfq-shadow 3s ease-in-out infinite }
.cfq-m .bob { animation:cfq-bob 3s ease-in-out infinite }
.cfq-m .jump { transition:transform .3s }
.cfq-m .bd { stroke:rgba(0,0,0,.06) }
.cfq-m .shine { fill:rgba(255,255,255,.28) }
.cfq-m .ck { fill:rgba(244,114,182,.55); transition:opacity .25s }
.cfq-m .arm { fill:none; stroke:#6d28d9; stroke-width:6; stroke-linecap:round; transition:transform .35s cubic-bezier(.3,1.4,.5,1) }
.cfq-m .stem { fill:none; stroke:#10b981; stroke-width:3; stroke-linecap:round }
.cfq-m .leaf { fill:#34d399 } .cfq-m .leaf.l2 { fill:#10b981 }
.cfq-m .sprout { transform-box:fill-box; transform-origin:bottom center; animation:cfq-sway 4s ease-in-out infinite; transition:transform .3s }
.cfq-m .eyes-n ellipse { fill:#1e1b4b; transform-box:fill-box; transform-origin:center; animation:cfq-blink 4.6s infinite }
.cfq-m .eyes-n .hl { fill:#fff }
.cfq-m .look { transform:translate(var(--lx,0px),var(--ly,0px)); transition:transform .18s }
.cfq-m .eyes-n { transition:transform .25s, opacity .2s; transform-box:fill-box; transform-origin:center }
.cfq-m .eye-h, .cfq-m .brow, .cfq-m .mo { fill:none; stroke:#1e1b4b; stroke-width:3; stroke-linecap:round; stroke-linejoin:round }
.cfq-m .brow { stroke-width:2.6 }
.cfq-m .mo-h path, .cfq-m .mo-o { fill:#1e1b4b } .cfq-m .mo-h .tongue { fill:#f472b6 }
.cfq-m .tear { fill:#60a5fa }
.cfq-m .bulb circle { fill:#fde047 } .cfq-m .bulb rect { fill:#a3a3a3 } .cfq-m .bulb path { fill:none; stroke:#fde047; stroke-width:2.4; stroke-linecap:round }
.cfq-m .bulb { transform-box:fill-box; transform-origin:center bottom }
.cfq-m .eye-h, .cfq-m .brow, .cfq-m .tear, .cfq-m .bulb, .cfq-m .mo-h, .cfq-m .mo-s, .cfq-m .mo-o { opacity:0; transition:opacity .2s }
.cfq-m .mo-n { transition:opacity .2s }
.cfq-m[data-mood="happy"] .eyes-n, .cfq-m[data-mood="cheer"] .eyes-n, .cfq-m[data-mood="happy"] .mo-n, .cfq-m[data-mood="cheer"] .mo-n { opacity:0 }
.cfq-m[data-mood="happy"] .eye-h, .cfq-m[data-mood="cheer"] .eye-h, .cfq-m[data-mood="happy"] .mo-h, .cfq-m[data-mood="cheer"] .mo-h { opacity:1 }
.cfq-m[data-mood="curious"] .eyes-n { transform:scale(1.18) }
.cfq-m[data-mood="curious"] .mo-n, .cfq-m[data-mood="think"] .mo-n { opacity:0 }
.cfq-m[data-mood="curious"] .mo-o, .cfq-m[data-mood="think"] .mo-o { opacity:1 }
.cfq-m[data-mood="think"] .eyes-n { transform:translate(2px,-3px) }
.cfq-m[data-mood="think"] .bulb { opacity:1; animation:cfq-glow 1.2s ease-in-out infinite }
.cfq-m[data-mood="think"] .arm-r { transform:rotate(-95deg) }
.cfq-m[data-mood="sad"] .brow, .cfq-m[data-mood="sad"] .mo-s { opacity:1 }
.cfq-m[data-mood="sad"] .mo-n { opacity:0 }
.cfq-m[data-mood="sad"] .tear { opacity:1; animation:cfq-tear 1.6s ease-in infinite }
.cfq-m[data-mood="sad"] .jump { transform:translateY(4px) }
.cfq-m[data-mood="sad"] .ck { opacity:.15 }
.cfq-m[data-mood="sad"] .sprout { animation:none; transform:rotate(-24deg) }
.cfq-m[data-mood="sad"] .arm-l { transform:rotate(12deg) } .cfq-m[data-mood="sad"] .arm-r { transform:rotate(-12deg) }
.cfq-m[data-mood="cheer"] .arm-l { transform:rotate(130deg) } .cfq-m[data-mood="cheer"] .arm-r { transform:rotate(-130deg) }
.cfq-m.wave .arm-r { animation:cfq-wave .5s ease-in-out 3 alternate }
.cfq-m.hop .jump { animation:cfq-hop .55s cubic-bezier(.3,1.5,.5,1) }
.cfq-m.leap .jump { animation:cfq-leap .9s cubic-bezier(.3,1.4,.5,1) 2 }
@keyframes cfq-bob { 50% { transform:translateY(-4px) } }
@keyframes cfq-shadow { 50% { transform:scaleX(.86); opacity:.7 } }
@keyframes cfq-blink { 0%,45%,49%,100% { transform:scaleY(1) } 47% { transform:scaleY(.1) } }
@keyframes cfq-sway { 0%,100% { transform:rotate(-6deg) } 50% { transform:rotate(7deg) } }
@keyframes cfq-wave { from { transform:rotate(-105deg) } to { transform:rotate(-145deg) } }
@keyframes cfq-hop { 40% { transform:translateY(-12px) } }
@keyframes cfq-leap { 35% { transform:translateY(-20px) rotate(-6deg) } 70% { transform:translateY(0) rotate(4deg) } }
@keyframes cfq-tear { 0% { transform:translateY(0); opacity:0 } 20% { opacity:1 } 100% { transform:translateY(16px); opacity:0 } }
@keyframes cfq-glow { 50% { transform:translateY(-2px) scale(1.08) } }
@media (prefers-reduced-motion: reduce) { .cfq-m, .cfq-m * { animation:none !important } }

.cfq-in { padding:16px 26px 22px }
.cfq-in h2 { margin:0 0 4px; font-size:20px; font-weight:700; letter-spacing:-.015em; text-align:center; text-wrap:balance; color:var(--text-primary) }
.cfq-sub { margin:0; font-size:13px; color:var(--text-dim); text-align:center }
.cfq-opts { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px }
.cfq-o { display:flex; align-items:center; gap:10px; padding:11px 12px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--text-primary); font-size:13px; font-weight:500; text-align:left; cursor:pointer; transition:border-color .12s, background .12s, transform .12s }
.cfq-o:hover { border-color:var(--text-dim) } .cfq-o:active { transform:scale(.97) }
.cfq-o svg { color:var(--text-dim); flex:none }
.cfq-rd { margin-left:auto; width:16px; height:16px; border-radius:50%; border:1.5px solid var(--border); flex:none; display:grid; place-items:center }
.cfq-o.on { border-color:#8b5cf6; background:rgba(139,92,246,.12) } .cfq-o.on svg { color:#a78bfa }
.cfq-o.on .cfq-rd { border-color:#8b5cf6; background:#8b5cf6 } .cfq-o.on .cfq-rd::after { content:""; width:6px; height:6px; border-radius:50%; background:#fff }
.cfq-more { display:block; width:100%; margin-top:10px; padding:11px 12px; border-radius:10px; border:1px solid var(--border); background:var(--bg-inset); color:var(--text-primary); font-size:13px; outline:none; animation:cfq-pop .25s ease-out }
.cfq-more:focus { border-color:#8b5cf6 }
.cfq-go { margin-top:16px; width:100%; padding:12px; border:0; border-radius:10px; background:#7c3aed; color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:opacity .15s, transform .12s }
.cfq-go:hover:not(:disabled) { background:#8b5cf6 } .cfq-go:active { transform:scale(.98) } .cfq-go:disabled { opacity:.4; cursor:not-allowed }
.cfq-help { border-top:1px solid var(--border); padding:14px 26px 18px }
.cfq-help > p { margin:0 0 10px; font-size:12px; color:var(--text-dim) }
.cfq-hb { display:flex; gap:8px }
.cfq-hb button { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:9px 10px; border-radius:9px; border:1px solid var(--border); background:transparent; color:var(--text-muted); font-size:12.5px; font-weight:500; cursor:pointer }
.cfq-hb button:hover, .cfq-hb button.on { border-color:var(--text-dim); color:var(--text-primary) }
.cfq-mail { margin-top:10px; padding:10px 12px; border-radius:10px; background:var(--bg-inset); font-size:12px; color:var(--text-muted); animation:cfq-pop .25s ease-out }
.cfq-mail textarea { display:block; width:100%; resize:vertical; min-height:72px; padding:10px 11px; border-radius:9px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font:inherit; font-size:13px; line-height:1.45; outline:none }
.cfq-mail textarea:focus { border-color:#8b5cf6 }
.cfq-row { display:flex; align-items:center; gap:8px; margin-top:8px }
.cfq-att { display:inline-flex; align-items:center; gap:6px; min-width:0; padding:7px 10px; border-radius:8px; border:1px dashed var(--border); color:var(--text-muted); font-size:12px; font-weight:500; cursor:pointer; white-space:nowrap; overflow:hidden }
.cfq-att input { display:none }
.cfq-x { display:grid; place-items:center; width:26px; height:26px; border-radius:7px; border:1px solid var(--border); background:transparent; color:var(--text-dim); cursor:pointer }
.cfq-send { margin-left:auto; padding:8px 16px; border:0; border-radius:8px; background:#7c3aed; color:#fff; font-size:12.5px; font-weight:600; cursor:pointer } .cfq-send:disabled { opacity:.4; cursor:not-allowed }
.cfq-err { margin:8px 0 0; font-size:12px; color:#f87171 }
.cfq-alt { margin:8px 0 0; font-size:11.5px; color:var(--text-dim); line-height:1.6 }
.cfq-alt code { font-family:inherit; font-weight:600; color:var(--text-muted) }
.cfq-alt button { margin-left:4px; padding:2px 8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-muted); font-size:11px; font-weight:600; cursor:pointer }
.cfq-sent { color:#34d399; font-weight:600; text-align:center; padding:14px 12px }
.cfq-done { padding:6px 26px 34px; text-align:center; animation:cfq-pop .35s ease-out }
.cfq-done h3 { margin:0 0 4px; font-size:19px; font-weight:700; color:var(--text-primary) } .cfq-done p { margin:0; font-size:13px; color:var(--text-dim) }
@media (max-width:1023.98px) { .cfq-in { padding:14px 18px 20px } .cfq-help { padding:14px 18px 20px } .cfq-m { width:100px; height:104px } }
`

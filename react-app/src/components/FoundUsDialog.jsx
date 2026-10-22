import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Search, Youtube, Users, MessageCircle, Instagram, Linkedin, Newspaper, MoreHorizontal, CircleAlert, Lightbulb } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../services/api'
import Mascot from './Mascot'
import { openFeedback } from './FeedbackForm'

// "How did you hear about Capital Friends?" — asked once per family, after setup is finished.
// The answer is saved in the family's Settings tab (FoundUsVia), so nobody else in the family is asked again.
// The little friend at the top reacts: waves, is happy when you pick, sad for an issue, thinks for a feature, cheers at the end.

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
    setPick(o.k); setDetail('')
    base.current = o.k === 'other' ? 'curious' : 'happy'
    setMood(base.current); replay('hop'); say(o.line)
  }
  function typeDetail(v) {
    setDetail(v)
    if (pick === 'other' && v.trim() && base.current !== 'happy') { base.current = 'happy'; setMood('happy'); replay('hop') }
  }
  // Report an issue / Request a feature: the shared form opens on top; the friend reacts while it is open
  function openHelp(k) {
    setMood(k === 'issue' ? 'sad' : 'think'); if (k !== 'issue') replay('hop')
    say(k === 'issue' ? 'Oh no! Sorry about that.' : 'Ooh, an idea! Tell us.')
    openFeedback(k, {
      onSent: () => { setMood('happy'); replay('hop'); say('Got it! We will reply by email.') },
      onClose: (sent) => { if (!sent) { setMood(base.current); say(base.current === 'idle' ? HELLO : 'Okay! Back to it.') } },
    })
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
              <button type="button" onClick={() => openHelp('issue')}><CircleAlert size={15} />Report an issue</button>
              <button type="button" onClick={() => openHelp('feature')}><Lightbulb size={15} />Request a feature</button>
            </div>
          </div>
        </>)}
      </div>
    </div>
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
.cfq-done { padding:6px 26px 34px; text-align:center; animation:cfq-pop .35s ease-out }
.cfq-done h3 { margin:0 0 4px; font-size:19px; font-weight:700; color:var(--text-primary) } .cfq-done p { margin:0; font-size:13px; color:var(--text-dim) }
@media (max-width:1023.98px) { .cfq-in { padding:14px 18px 20px } .cfq-help { padding:14px 18px 20px } .cfq-m { width:100px; height:104px } }
`

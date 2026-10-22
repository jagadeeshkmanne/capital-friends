import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { CircleAlert, Lightbulb, Paperclip, X, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'
import Mascot from './Mascot'

// Report an issue / Request a feature, from anywhere in the app: openFeedback('issue' | 'feature').
// One <FeedbackHost /> (in Layout) shows the form: a bottom sheet on phones, a dialog on the web.
// Sent to the developer with the user's own Gmail (backend: sendFeedback_ in gas-webapp/FoundUs.js), with attachments.

export const DEV_EMAIL = 'capital.friends.dev@gmail.com'
const MAX_FILES = 5
const MAX_BYTES = 7 * 1024 * 1024   // all files together; they travel inside one request to Apps Script
const ACCEPT = 'image/*,video/*,.pdf,.csv,.xls,.xlsx,.txt'
const OK_TYPE = /^(image\/|video\/|application\/pdf|text\/(csv|plain)|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)/
const EXT_TYPE = { pdf: 'application/pdf', csv: 'text/csv', txt: 'text/plain', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }

export function openFeedback(kind = 'issue', opts = {}) {
  window.dispatchEvent(new CustomEvent('cf:feedback', { detail: { kind: kind === 'feature' ? 'feature' : 'issue', ...opts } }))
}

export default function FeedbackHost() {
  const [req, setReq] = useState(null)   // { kind, onSent, onClose, n }
  useEffect(() => {
    const on = (e) => setReq((r) => ({ ...e.detail, n: (r?.n || 0) + 1 }))
    window.addEventListener('cf:feedback', on)
    return () => window.removeEventListener('cf:feedback', on)
  }, [])
  if (!req) return null
  return createPortal(<FeedbackSheet key={req.n} req={req} onClose={(sent) => { req.onClose?.(sent); setReq(null) }} />, document.body)
}

const kb = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const extOf = (n) => (String(n).split('.').pop() || '').toLowerCase()
const pageName = (p) => {
  if (!p || p === '/' || p === '/dashboard') return 'Dashboard'
  const last = p.split('/').filter(Boolean).pop() || ''
  const t = last.replace(/-/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const deviceName = () => {
  const ua = navigator.userAgent
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Mac OS X/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : 'Device'
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${os} · ${br}`
}
const appVersion = () => document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src')?.split('/').pop()?.replace(/\.js$/, '') || ''

function FeedbackSheet({ req, onClose }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [kind, setKind] = useState(req.kind)
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])   // { id, name, type, size, data, url }
  const [err, setErr] = useState('')
  const [state, setState] = useState('')   // '' | reading | sending | sent
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(false)
  const m = useRef(null), mOk = useRef(null), sentRef = useRef(false), drop = useRef(null)
  const issue = kind === 'issue'
  const total = files.reduce((s, f) => s + f.size, 0)

  const replay = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls) }
  useEffect(() => { requestAnimationFrame(() => setShown(true)) }, [])
  useEffect(() => { const t = setTimeout(() => m.current?.classList.remove('wave'), 1600); return () => clearTimeout(t) }, [])
  useEffect(() => { replay(m.current, 'hop') }, [kind])
  useEffect(() => () => files.forEach((f) => f.url && URL.revokeObjectURL(f.url)), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && state !== 'sending') close() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })

  function close() { if (state === 'sending') return; setShown(false); setTimeout(() => onClose(sentRef.current), 220) }

  function addFiles(list) {
    setErr('')
    const picked = Array.from(list || [])
    let n = files.length, bytes = total
    const keep = []
    for (const f of picked) {
      const type = f.type || EXT_TYPE[extOf(f.name)] || ''
      if (n >= MAX_FILES) { setErr(`You can attach up to ${MAX_FILES} files.`); break }
      if (!OK_TYPE.test(type)) { setErr(`${f.name}: please attach images, videos, PDF, CSV or Excel files.`); continue }
      if (bytes + f.size > MAX_BYTES) { setErr(`${f.name} is too big. All files together must be under ${kb(MAX_BYTES)}.`); continue }
      n++; bytes += f.size; keep.push({ f, type })
    }
    if (!keep.length) return
    setState('reading')
    Promise.all(keep.map(({ f, type }) => new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res({ id: Math.random().toString(36).slice(2), name: f.name, type, size: f.size, data: String(r.result).split(',')[1] || '', url: /^image\//.test(type) ? URL.createObjectURL(f) : '' })
      r.onerror = () => res(null)
      r.readAsDataURL(f)
    }))).then((out) => { setFiles((cur) => [...cur, ...out.filter(Boolean)]); setState('') })
  }
  function removeFile(id) {
    setFiles((cur) => { const x = cur.find((f) => f.id === id); if (x?.url) URL.revokeObjectURL(x.url); return cur.filter((f) => f.id !== id) })
  }

  async function send() {
    if (text.trim().length < 5 || state) return
    setState('sending'); setErr('')
    try {
      await api.sendFeedback({
        kind, message: text.trim(), page: pathname, device: navigator.userAgent, version: appVersion(),
        attachments: files.map((f) => ({ name: f.name, type: f.type, data: f.data })),
      })
      sentRef.current = true
      setState('sent'); req.onSent?.()
      setTimeout(() => replay(mOk.current, 'leap'), 30)
    } catch (e) {
      setState('')
      setErr((e && e.message) || `Could not send. Please email ${DEV_EMAIL}.`)
    }
  }
  function copy() {
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 1500) }
    try { navigator.clipboard.writeText(DEV_EMAIL).then(ok, ok) } catch { ok() }
  }

  return (
    <div className={`cff-ov${shown ? ' show' : ''}`} role="dialog" aria-modal="true" aria-labelledby="cff-title" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <style>{CSS}</style>
      <div className="cff-f">
        <div className="cff-grab" />
        {state === 'sent' ? (
          <div className="cff-ok">
            <Mascot refEl={mOk} mood="cheer" wave={false} className="cff-m-big" />
            <h3>Sent. Thank you!</h3>
            <p>{issue ? "We'll look into it and reply to you by email." : "We'll think about it and reply to you by email."}{user?.email ? <><br /><span className="cff-dim">Replies go to {user.email}</span></> : null}</p>
            <button type="button" className="cff-send" onClick={close}>Done</button>
          </div>
        ) : (<>
          <div className="cff-h">
            <Mascot refEl={m} mood={issue ? 'sad' : 'think'} className="cff-m" />
            <div className="cff-ht">
              <h3 id="cff-title">{issue ? 'Report an issue' : 'Request a feature'}</h3>
              <p>We read every message and reply by email.</p>
            </div>
            <button type="button" className="cff-x" onClick={close} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="cff-b">
            <div className="cff-seg">
              <button type="button" className={issue ? 'on' : ''} onClick={() => setKind('issue')}><CircleAlert size={15} />Issue</button>
              <button type="button" className={!issue ? 'on' : ''} onClick={() => setKind('feature')}><Lightbulb size={15} />Feature</button>
            </div>
            <div>
              <label className="cff-l" htmlFor="cff-text"><span>{issue ? 'What went wrong?' : 'What would you like?'}</span><span className="cff-cnt">{text.length} / 4000</span></label>
              <textarea id="cff-text" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)}
                placeholder={issue ? 'What did you do, what happened, and what did you expect?' : 'Describe the idea. How would it help your family?'} />
            </div>
            {files.length < MAX_FILES && (
              <label ref={drop} className="cff-drop"
                onDragOver={(e) => { e.preventDefault(); drop.current?.classList.add('drag') }}
                onDragLeave={() => drop.current?.classList.remove('drag')}
                onDrop={(e) => { e.preventDefault(); drop.current?.classList.remove('drag'); addFiles(e.dataTransfer.files) }}>
                <span className="cff-di"><Paperclip size={18} /></span>
                <span><b>{state === 'reading' ? 'Adding…' : issue ? 'Add screenshots or files' : 'Add a picture or file (optional)'}</b>
                  <span>Images, video, PDF, CSV, Excel · up to {MAX_FILES} files, {kb(MAX_BYTES)}</span></span>
                <input type="file" multiple accept={ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              </label>
            )}
            {files.length > 0 && (
              <div className="cff-files">
                {files.map((f) => (
                  <div key={f.id} className="cff-file">
                    <span className="cff-th">{f.url ? <img src={f.url} alt="" /> : <><FileText size={14} /><small>{extOf(f.name).toUpperCase().slice(0, 4)}</small></>}</span>
                    <span className="cff-nm"><span>{f.name}</span><small>{kb(f.size)}</small></span>
                    <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`}><X size={15} /></button>
                  </div>
                ))}
                <div className="cff-meter"><span>{files.length} of {MAX_FILES} files</span><span>{kb(total)} of {kb(MAX_BYTES)}</span></div>
              </div>
            )}
            {err && <p className="cff-err">{err}</p>}
            <div className="cff-ctx" title="Added to your message so we can find the problem faster">
              <span>Page: {pageName(pathname)}</span><span>{deviceName()}</span>{appVersion() && <span>App {appVersion().replace(/^index-/, '')}</span>}
            </div>
            <button type="button" className="cff-send" disabled={text.trim().length < 5 || !!state} onClick={send}>
              {state === 'sending' ? <><span className="cff-spin" />Sending…</> : 'Send'}
            </button>
            <p className="cff-foot">
              Sent from your Gmail, so we can reply to you. Files go only to the Capital Friends developer.<br />
              Or write to <span className="select-all">{DEV_EMAIL}</span> <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </p>
          </div>
        </>)}
      </div>
    </div>
  )
}

const CSS = `
.cff-ov { --cff-line:rgba(148,163,184,.24); position:fixed; inset:0; z-index:100001; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(4,7,18,.62); backdrop-filter:blur(3px); opacity:0; transition:opacity .2s }
.cff-ov.show { opacity:1 }
.cff-ov *, .cff-ov *::before, .cff-ov *::after { box-sizing:border-box }
.cff-f { width:100%; max-width:480px; max-height:calc(100dvh - 32px); overflow:auto; background:var(--bg-card); border:1px solid var(--cff-line); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.35); color:var(--text-primary); transform:translateY(20px); transition:transform .3s cubic-bezier(.2,.8,.2,1) }
.cff-ov.show .cff-f { transform:none }
.cff-grab { display:none }
@media (max-width:1023.98px) {
  .cff-ov { align-items:flex-end; padding:0 }
  .cff-f { max-width:none; border-radius:24px 24px 0 0; max-height:94dvh; transform:translateY(100%); padding-bottom:env(safe-area-inset-bottom) }
  .cff-grab { display:block; width:36px; height:4px; border-radius:4px; background:var(--cff-line); margin:8px auto 0 }
}
.cff-h { position:relative; display:flex; align-items:center; gap:10px; padding:14px 18px 12px; background:linear-gradient(180deg,rgba(139,92,246,.16),rgba(139,92,246,.02)) }
.cff-h .cfq-m.cff-m { width:70px; height:72px }
.cff-ht { min-width:0; padding-right:30px }
.cff-ht h3 { margin:0; font-size:18px; font-weight:700; letter-spacing:-.01em; color:var(--text-primary) }
.cff-ht p { margin:2px 0 0; font-size:12.5px; color:var(--text-dim) }
.cff-x { position:absolute; top:12px; right:12px; width:30px; height:30px; border-radius:50%; border:0; background:var(--bg-inset); color:var(--text-dim); display:grid; place-items:center; cursor:pointer }
.cff-b { padding:14px 18px 18px; display:flex; flex-direction:column; gap:12px }
.cff-seg { display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:4px; border-radius:11px; background:var(--bg-inset) }
.cff-seg button { display:flex; align-items:center; justify-content:center; gap:7px; padding:8px; border:0; border-radius:8px; background:transparent; color:var(--text-dim); font-size:13px; font-weight:600; cursor:pointer }
.cff-seg button.on { background:var(--bg-card); color:var(--text-primary); box-shadow:0 1px 3px rgba(0,0,0,.18) }
.cff-l { display:flex; justify-content:space-between; font-size:12.5px; font-weight:600; color:var(--text-muted) }
.cff-cnt { font-weight:400; color:var(--text-dim) }
.cff-b textarea { display:block; width:100%; min-height:104px; resize:vertical; margin-top:6px; padding:11px 12px; border-radius:10px; border:1px solid var(--cff-line); background:var(--bg-inset); color:var(--text-primary); font:inherit; font-size:14px; line-height:1.45; outline:none }
.cff-b textarea:focus { border-color:#8b5cf6 }
.cff-drop { display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; border:1.5px dashed var(--cff-line); cursor:pointer; transition:border-color .15s, background .15s }
.cff-drop:hover, .cff-drop.drag { border-color:#8b5cf6; background:rgba(139,92,246,.08) }
.cff-drop input { display:none }
.cff-di { width:38px; height:38px; border-radius:10px; background:rgba(139,92,246,.14); color:#a78bfa; display:grid; place-items:center; flex:none }
.cff-drop b { display:block; font-size:13.5px; color:var(--text-primary) }
.cff-drop span span { font-size:12px; color:var(--text-dim) }
.cff-files { display:flex; flex-direction:column; gap:6px }
.cff-file { display:flex; align-items:center; gap:10px; padding:7px 8px; border-radius:10px; background:var(--bg-inset); animation:cff-pop .25s ease-out }
.cff-th { width:36px; height:36px; border-radius:7px; flex:none; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; background:var(--bg-card); color:var(--text-dim) }
.cff-th small { font-size:8.5px; font-weight:700 }
.cff-th img { width:100%; height:100%; object-fit:cover }
.cff-nm { min-width:0; flex:1; display:flex; flex-direction:column }
.cff-nm span { font-size:13px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-primary) }
.cff-nm small { font-size:11.5px; color:var(--text-dim) }
.cff-file button { width:30px; height:30px; flex:none; border:0; border-radius:8px; background:transparent; color:var(--text-dim); display:grid; place-items:center; cursor:pointer }
.cff-file button:hover { color:#f87171 }
.cff-meter { display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-dim) }
.cff-err { margin:0; font-size:12.5px; color:#f87171 }
.cff-ctx { display:flex; flex-wrap:wrap; gap:6px; font-size:11.5px; color:var(--text-dim) }
.cff-ctx span { padding:3px 8px; border-radius:20px; background:var(--bg-inset) }
.cff-send { width:100%; padding:13px; border:0; border-radius:11px; background:#7c3aed; color:#fff; font-size:14.5px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px }
.cff-send:hover:not(:disabled) { background:#8b5cf6 } .cff-send:disabled { opacity:.4; cursor:not-allowed }
.cff-spin { width:15px; height:15px; border-radius:50%; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; animation:cff-spin .7s linear infinite }
.cff-foot { margin:-2px 0 0; text-align:center; font-size:11.5px; color:var(--text-dim); line-height:1.6 }
.cff-foot .select-all { font-weight:600; color:var(--text-muted) }
.cff-foot button { margin-left:4px; padding:1px 8px; border-radius:6px; border:1px solid var(--cff-line); background:transparent; color:var(--text-muted); font-size:11px; font-weight:600; cursor:pointer }
.cff-ok { padding:26px 22px 24px; text-align:center; animation:cff-pop .35s ease-out }
.cff-ok .cfq-m.cff-m-big { width:96px; height:100px; margin:0 auto; display:block }
.cff-ok h3 { margin:6px 0 4px; font-size:19px; font-weight:700; color:var(--text-primary) }
.cff-ok p { margin:0 0 18px; font-size:13px; color:var(--text-dim); line-height:1.5 }
.cff-dim { font-size:12px; opacity:.85 }
@keyframes cff-pop { from { transform:scale(.94); opacity:0 } }
@keyframes cff-spin { to { transform:rotate(360deg) } }
`

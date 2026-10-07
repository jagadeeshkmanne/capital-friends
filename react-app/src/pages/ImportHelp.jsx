import { useEffect, useState } from 'react'
import { ExternalLink, Mail, FileDown, Upload, ShieldCheck, X, ZoomIn, FileText } from 'lucide-react'

export const CAMS_CAS_URL = 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement'
const img = (name) => `${import.meta.env.BASE_URL}help/${name}`

function Num({ n }) {
  return <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">{n}</span>
}
// Screenshot: tap to see it big in a dialog (stays on this page)
function Shot({ src, alt }) {
  const [big, setBig] = useState(false)
  useEffect(() => {
    if (!big) return
    const k = (e) => { if (e.key === 'Escape') setBig(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [big])
  return (
    <>
      <button type="button" onClick={() => setBig(true)} className="group relative block w-full rounded-lg overflow-hidden border border-[var(--border-light)] bg-white cursor-zoom-in" title="Tap to enlarge">
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-[11px] opacity-90 group-hover:opacity-100"><ZoomIn size={12} /> Enlarge</span>
      </button>
      {big && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-3 sm:p-8" onClick={() => setBig(false)}>
          <button onClick={() => setBig(false)} aria-label="Close" className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"><X size={18} /></button>
          <img src={src} alt={alt} className="max-w-full max-h-full rounded-lg shadow-2xl bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}

// Small animated "how to get it" strip: the 4 steps light up one after another.
const STEPS = [
  { icon: ExternalLink, title: 'Open CAMS', text: 'Statements → CAS', shot: 'cams-cas-1.jpg',
    picks: ['Open the CAMS website (button below)', 'CAS - CAMS+KFintech is selected (box 1)'] },
  { icon: FileText, title: 'Choose options', text: 'Detailed · 2000 · zero balance', shot: 'cams-cas-1.jpg',
    picks: ['2  Detailed', '3  Specific Period', '4  From date 01-Jan-2000', '5  With zero balance folios'] },
  { icon: Mail, title: 'Email & password', text: 'then Submit', shot: 'cams-cas-2.jpg',
    picks: ['6  Your email (used in your funds)', '7  Make a password – remember it', '8  Submit'] },
  { icon: Upload, title: 'Import here', text: 'PDF from your email', shot: null,
    picks: ['CAMS emails the PDF in a few minutes', 'Press Choose PDF below', 'Type the password you made'] },
]
export function HowToStrip({ onOpenGuide }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 4500)
    return () => clearInterval(t)
  }, [paused])
  const st = STEPS[i]
  return (
    <div className="rounded-xl border border-[var(--border-light)] p-3 space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="grid grid-cols-4 gap-1.5">
        {STEPS.map((x, k) => {
          const on = k === i, done = k < i
          const Icon = x.icon
          return (
            <button type="button" key={x.title} onClick={() => { setI(k); setPaused(true) }}
              className={`relative rounded-lg p-2 text-center transition-all duration-500 ${on ? 'bg-violet-600/20 ring-1 ring-violet-500/60' : 'bg-[var(--bg-hover)] hover:bg-violet-600/10'}`}>
              <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-500 ${on ? 'bg-violet-600 text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-card)] text-[var(--text-dim)]'}`}>
                <Icon size={15} />
              </div>
              <p className={`mt-1 text-[11px] font-semibold ${on ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{k + 1}. {x.title}</p>
              <p className="text-[10px] text-[var(--text-dim)] leading-tight hidden sm:block">{x.text}</p>
            </button>
          )
        })}
      </div>
      <div className="h-1 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* what to do in this step: the real CAMS screen with the boxes to pick, and the choices in words */}
      <div key={i} className="grid sm:grid-cols-[1fr_200px] gap-3 items-start animate-fade-in">
        {st.shot ? (
          <Shot src={img(st.shot)} alt={`CAMS website – ${st.title}`} />
        ) : (
          <div className="rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[160px]">
            <Mail size={28} className="text-violet-400" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Check your email</p>
            <p className="text-[11px] text-[var(--text-dim)]">Subject: “Consolidated Account Statement”. Save the PDF, then choose it below.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[var(--text-primary)]">Step {i + 1}: {st.title}</p>
          {st.picks.map((pk) => {
            const m = /^(\d)\s+(.*)$/.exec(pk)
            return (
              <p key={pk} className="flex items-start gap-2 text-[11.5px] text-[var(--text-primary)]">
                {m ? <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{m[1]}</span>
                  : <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-violet-400" />}
                <span>{m ? m[2] : pk}</span>
              </p>
            )
          })}
          <p className="text-[10.5px] text-[var(--text-dim)] pt-1">Numbers match the boxes in the picture. Tap the picture to enlarge.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a href={CAMS_CAS_URL} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white no-underline inline-flex items-center gap-1">Open CAMS website <ExternalLink size={12} /></a>
        <button onClick={onOpenGuide} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-light)] text-[var(--text-primary)]">Full guide & questions</button>
        <span className="text-[10.5px] text-[var(--text-dim)] ml-auto hidden sm:inline">{paused ? 'Paused – tap a step' : 'Playing – hover to pause'}</span>
      </div>
    </div>
  )
}
function Item({ n, children }) {
  return <li className="flex gap-2 items-start"><Num n={n} /><span className="pt-0.5">{children}</span></li>
}

/** Step-by-step: how to get the CAMS statement PDF, with screenshots, plus common questions. */
export default function ImportHelp() {
  return (
    <div className="space-y-4 text-xs text-[var(--text-primary)]">
      {/* A. request */}
      <div className="space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2"><Mail size={15} className="text-violet-400" /> A. Ask CAMS to email your statement (free)</p>
        <a href={CAMS_CAS_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold no-underline">
          Open CAMS website <ExternalLink size={13} />
        </a>
        <p className="text-[var(--text-dim)]">It opens <b>Statements → CAS - CAMS+KFintech</b>. One statement covers all your mutual funds, from every fund house.</p>
        <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
        <Shot src={img('cams-cas-1.jpg')} alt="CAMS statement form: CAS - CAMS+KFintech, Detailed, Specific Period, From date, With zero balance folios" />
        <ol className="space-y-2 text-[13px]">
          <Item n={1}><b>CAS - CAMS+KFintech</b> is selected.</Item>
          <Item n={2}>Statement type: <b>Detailed</b> (this has every transaction).</Item>
          <Item n={3}>Period: <b>Specific Period</b>.</Item>
          <Item n={4}>From date: <b>01-Jan-2000</b> (tap the calendar, then the year at the top to jump back). Keep To date as today.</Item>
          <Item n={5}>Folio listing: <b>With zero balance folios</b> – so funds you already sold come too (needed for correct profit and XIRR).</Item>
        </ol>
        </div>
        <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
        <Shot src={img('cams-cas-2.jpg')} alt="CAMS statement form: email, password, submit" />
        <ol className="space-y-2 text-[13px]" start={6}>
          <Item n={6}>Email: the email used in your mutual funds.</Item>
          <Item n={7}>Make up a password and type it twice. <b>Remember it</b> – you need it to open the PDF.</Item>
          <Item n={8}>Press <b>Submit</b>.</Item>
        </ol>
        </div>
      </div>

      {/* B. email */}
      <div className="space-y-1">
        <p className="text-sm font-semibold flex items-center gap-2"><FileDown size={15} className="text-violet-400" /> B. Download the PDF from your email</p>
        <p className="text-[var(--text-dim)]">In a few minutes you get an email from CAMS with the statement PDF attached. Save it to your phone or computer.</p>
      </div>

      {/* C. import */}
      <div className="space-y-1">
        <p className="text-sm font-semibold flex items-center gap-2"><Upload size={15} className="text-violet-400" /> C. Import it here</p>
        <p className="text-[var(--text-dim)]">Press <b>Choose PDF</b> below and type the password you made. Check the portfolios we pick, then press <b>Import</b>.</p>
      </div>

      {/* Questions */}
      <div className="rounded-lg border border-[var(--border-light)] divide-y divide-[var(--border-light)]">
        {[
          ['Family members', 'Each email gets its own statement. Funds of children (minors) usually come in the parent\'s statement. Add every person in Family first, with the same name as in the statement.'],
          ['Is my data safe?', 'The PDF is read on this device and never uploaded. Only the fund transactions are saved, in your own Google Sheet. The password is not saved anywhere.'],
          ['What happens to funds I typed in?', 'For each fund in the statement, the old entries in that portfolio are replaced by the full history, so nothing is counted twice. Funds not in the statement stay as they are.'],
          ['Switches and STPs', 'Saved as switches: units move between your funds, but they are not counted as new money invested.'],
          ['Sold funds', 'Their history is added so your total profit and XIRR are right. They don\'t show as holdings.'],
          ['Can I undo?', 'Yes. Every import keeps a backup. Press Undo under "Past imports" and everything goes back to how it was.'],
          ['Stocks / demat (NSDL, CDSL)', 'Not yet – this imports mutual funds from the CAMS statement.'],
        ].map(([q, a]) => (
          <details key={q} className="group px-3 py-2">
            <summary className="cursor-pointer font-medium list-none flex items-center justify-between">
              {q} <span className="text-[var(--text-dim)] group-open:rotate-90 transition-transform">›</span>
            </summary>
            <p className="text-[var(--text-dim)] mt-1">{a}</p>
          </details>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-dim)] flex items-center gap-1.5"><ShieldCheck size={12} /> Screenshots are from the CAMS website and may look slightly different over time.</p>
    </div>
  )
}

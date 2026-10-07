import { ExternalLink, Mail, FileDown, Upload, ShieldCheck } from 'lucide-react'

export const CAMS_CAS_URL = 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement'
const img = (name) => `${import.meta.env.BASE_URL}help/${name}`

function Num({ n }) {
  return <span className="w-5 h-5 shrink-0 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center">{n}</span>
}
function Shot({ src, alt }) {
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[var(--border-light)] bg-white" title="Open full size">
      <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
    </a>
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
        <Shot src={img('cams-cas-1.jpg')} alt="CAMS statement form: CAS - CAMS+KFintech, Detailed, Specific Period, From date, With zero balance folios" />
        <ol className="space-y-1.5">
          <Item n={1}><b>CAS - CAMS+KFintech</b> is selected.</Item>
          <Item n={2}>Statement type: <b>Detailed</b> (this has every transaction).</Item>
          <Item n={3}>Period: <b>Specific Period</b>.</Item>
          <Item n={4}>From date: <b>01-Jan-2000</b> (tap the calendar, then the year at the top to jump back). Keep To date as today.</Item>
          <Item n={5}>Folio listing: <b>With zero balance folios</b> – so funds you already sold come too (needed for correct profit and XIRR).</Item>
        </ol>
        <Shot src={img('cams-cas-2.jpg')} alt="CAMS statement form: email, password, submit" />
        <ol className="space-y-1.5" start={6}>
          <Item n={6}>Email: the email used in your mutual funds.</Item>
          <Item n={7}>Make up a password and type it twice. <b>Remember it</b> – you need it to open the PDF.</Item>
          <Item n={8}>Press <b>Submit</b>.</Item>
        </ol>
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

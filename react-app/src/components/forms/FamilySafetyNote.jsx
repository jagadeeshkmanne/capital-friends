import { ShieldCheck, HeartHandshake, Lock } from 'lucide-react'

// Focused note shown above the optional personal fields (PAN, Aadhaar, account / policy numbers).
// Helps people decide: add them so the family can act if something happens, or leave them empty.
const TEXT = {
  member: {
    what: 'PAN, Aadhaar and mobile',
    why: 'Banks, fund houses and insurers ask for the PAN and Aadhaar of the person when the family claims money.',
  },
  bank: {
    what: 'account number, IFSC and branch',
    why: 'Your family needs to know which bank and account to contact. The last 4 digits are often enough to find it.',
  },
  insurance: {
    what: 'the policy number',
    why: 'A claim is much faster when your family has the policy number ready.',
  },
}

export default function FamilySafetyNote({ kind = 'member' }) {
  const t = TEXT[kind] || TEXT.member
  return (
    <div className="relative overflow-hidden rounded-xl border border-violet-500/40 p-3.5"
      style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(8,145,178,0.10) 100%)' }}>
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-cyan-500" />
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <HeartHandshake size={16} className="text-violet-400 shrink-0" />
        Optional — you decide
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
        If something happens to you, your family needs these details to claim your money. {t.why} Adding {t.what} here means they don&apos;t have to search for papers at a hard time.
      </p>
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <p className="flex items-start gap-2 rounded-lg bg-[var(--bg-card)]/60 px-2.5 py-2 text-[11.5px] text-[var(--text-primary)]">
          <Lock size={13} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>Saved only in <b>your own Google Sheet</b> in your Drive. Capital Friends keeps no copy.</span>
        </p>
        <p className="flex items-start gap-2 rounded-lg bg-[var(--bg-card)]/60 px-2.5 py-2 text-[11.5px] text-[var(--text-primary)]">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-400" />
          <span>Blur them on screen with the <b>eye button</b> at the top, and they are <b>masked</b> in email reports.</span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-dim)]">Not comfortable? Leave them empty — everything else in the app still works.</p>
    </div>
  )
}

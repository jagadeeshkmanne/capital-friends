import { useMemo, useState } from 'react'
import { Landmark, Wallet, BarChart3 } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'
import { useData } from '../../context/DataContext'

// The withdraw window of a goal whose date has come. Every investment the goal holds is listed with an editable
// "taking" amount, filled with what the goal holds there. People change it to what they really took (part of the FD,
// all of the liquid fund, nothing from an equity fund…). On Done the app records it: the FD / savings value goes
// down, fund units are redeemed at today's NAV, shares are sold at today's price — then the goal is closed and the
// rest goes back to the other goals. Nothing is saved until Done (and a confirm listing every change).

const L = (v) => formatINR(Math.round(v || 0))
const fmtIn = (v) => Math.round(v || 0).toLocaleString('en-IN')
const num = (v) => { const n = parseFloat(String(v).replace(/[,₹\s]/g, '')); return Number.isFinite(n) ? n : 0 }
const KIND = {
  other: { t: 'Cash & deposits', icon: Landmark, c: '#38bdf8' },
  mf: { t: 'Mutual funds', icon: Wallet, c: '#a78bfa' },
  stock: { t: 'Stocks', icon: BarChart3, c: '#34d399' },
}
const navOf = (h) => Number(h?.currentNav) || ((Number(h?.currentValue) || 0) / (Number(h?.units) || 1)) || 0
const priceOf = (h) => Number(h?.currentPrice) || ((Number(h?.currentValue) || 0) / (Number(h?.quantity) || 1)) || 0

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseDyn = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {} } catch { return {} } }
/** a stable key per row, so typed amounts stay on their investment even if the list re-sorts */
export const rowKey = (r) => `${r.kind}:${r.portfolioId || ''}:${r.holding?.fundCode || r.holding?.schemeCode || r.holding?.symbol || r.holding?.investmentId || r.name}`

/** What to record for the amounts taken: [{ kind, label, amount, ... }] (rows taking 0 are skipped).
 *  taken: { [rowKey]: '1,23,000' } (an array by row index works too) */
export function withdrawActions(rows, taken, today = localDay()) {
  const out = []
  const val = (r, i) => (Array.isArray(taken) ? taken[i] : taken[rowKey(r)])
  rows.forEach((r, i) => {
    const amt = Math.min(num(val(r, i)), r.value * 1.0001)
    if (!(amt >= 1) || !r.holding) return
    const allOfIt = amt >= r.value - 1
    if (r.kind === 'mf') {
      const nav = navOf(r.holding)
      if (!(nav > 0)) return
      // all of it: the exact units (never rounded up past what is held); part: rounded DOWN to 4 decimals
      const held = Number(r.holding.units) || 0
      const units = allOfIt ? (r.all ? held : Math.min(held, r.units)) : Math.floor(Math.min(r.units, amt / nav) * 10000) / 10000
      if (!(units > 0)) return
      out.push({ kind: 'mf', label: splitFundName(r.name).main, amount: units * nav, redeem: { portfolioId: r.portfolioId, fundCode: r.holding.fundCode || r.holding.schemeCode, units, price: nav, date: today } })
    } else if (r.kind === 'stock') {
      const px = priceOf(r.holding)
      const maxQ = Math.floor(r.units + 1e-9)
      const qty = allOfIt ? maxQ : Math.min(maxQ, Math.floor(amt / (px || 1) + 1e-9))   // never more than typed
      if (!(px > 0) || !(qty > 0)) return
      out.push({ kind: 'stock', label: r.name, amount: qty * px, sell: { portfolioId: r.portfolioId, symbol: r.holding.symbol, quantity: qty, price: px, date: today } })
    } else {
      const inv = r.holding
      const cur = Number(inv.currentValue) || 0
      const left = Math.max(0, Math.round(cur - amt))
      const scale = cur > 0 ? left / cur : 0
      const patch = { currentValue: left, status: left < 1 ? (/fixed deposit|\bfd\b|bond|recurring|\brd\b|deposit/i.test(inv.investmentType || '') ? 'Matured' : 'Sold') : inv.status || 'Active' }
      // invested shrinks in the same proportion (else the rest shows a big loss)
      if (Number(inv.investedAmount) > 0) patch.investedAmount = Math.round(Number(inv.investedAmount) * scale)
      // gold / silver held by weight: the value comes from the grams, so the grams go down too
      const dyn = parseDyn(inv.dynamicFields)
      if (Number(dyn.weightGrams) > 0) patch.dynamicFields = { ...dyn, weightGrams: Math.round(Number(dyn.weightGrams) * scale * 1000) / 1000 }
      else if (inv.dynamicFields) patch.dynamicFields = dyn
      out.push({ kind: 'other', label: r.name, amount: amt, update: { inv, currentValue: left, status: patch.status, patch } })
    }
  })
  return out
}

/** Where a row is sold and where the money goes: the app cannot sell for you, so it says which platform / bank. */
export function whereOf(r, { mfPortfolios, stockPortfolios, investmentAccounts, banks }) {
  if (r.kind === 'other') {
    const inv = r.holding || {}
    return { key: `other:${inv.familyMemberName || ''}`, title: `Deposits & cash${inv.familyMemberName ? ` · ${inv.familyMemberName}` : ''}`, to: 'Close / withdraw at the bank, into your savings account' }
  }
  const p = (r.kind === 'mf' ? mfPortfolios : stockPortfolios || []).find((x) => x.portfolioId === r.portfolioId) || {}
  const a = (investmentAccounts || []).find((x) => x.accountId === p.investmentAccountId) || {}
  const b = (banks || []).find((x) => x.accountId === a.bankAccountId) || {}
  const platform = a.platformBroker || a.accountName || (r.kind === 'mf' ? 'your fund platform' : 'your broker')
  const owner = p.ownerName || a.memberName || ''
  const bank = b.bankName || a.bankAccountName || ''
  return { key: `${r.kind}:${platform}:${owner}`, title: `On ${platform}${owner ? ` · ${owner}` : ''}`, to: bank ? `Money goes to ${bank}${b.accountType ? ` (${b.accountType})` : ''}` : 'Money goes to the bank account linked to this account' }
}
/** Gain on the part being sold (for the tax note): units × (today's price − average buy price). */
export function gainOf(r, amount) {
  const h = r.holding || {}
  if (r.kind === 'mf') { const nav = navOf(h), avg = Number(h.avgNav) || 0; return nav > 0 && avg > 0 ? (amount / nav) * (nav - avg) : 0 }
  if (r.kind === 'stock') { const px = priceOf(h), avg = Number(h.avgBuyPrice) || 0; return px > 0 && avg > 0 ? (amount / px) * (px - avg) : 0 }
  return 0
}

export default function WithdrawPanel({ s, mt, pname, onDone, onMoreTime }) {
  const g = s.goal
  const data = useData()
  const [done, setDone] = useState({})
  const n = Math.max(1, Number(g.payYears) || 1)
  const rows = s.rows
  // multi-year goal: this year's part is taken from the safest money first (cash, then debt funds)
  const fill = useMemo(() => {
    if (n === 1) return Object.fromEntries(rows.map((r) => [rowKey(r), fmtIn(r.value)]))
    let want = Math.min(s.has, Math.round((Number(g.targetAmount) || 0) / n))
    const order = rows.map((r, i) => i).sort((a, b) => ({ other: 0, mf: 1, stock: 2 }[rows[a].kind] - { other: 0, mf: 1, stock: 2 }[rows[b].kind]))
    const v = Object.fromEntries(rows.map((r) => [rowKey(r), '0']))
    for (const i of order) { if (want < 1) break; const t = Math.min(want, rows[i].value); v[rowKey(rows[i])] = fmtIn(t); want -= t }
    return v
  }, [rows, n, s.has, g.targetAmount])
  // a completed goal is withdrawn in full: everything it holds (a goal paid over years: this year's part). No editing.
  const taken = fill
  const [record, setRecord] = useState(true)
  const total = rows.reduce((t, r) => t + Math.min(num(taken[rowKey(r)]), r.value), 0)
  const leftover = Math.max(0, s.has - total)
  // one step per platform / account (where you sell), deposits first, then funds, then shares
  const groups = []
  for (const k of ['other', 'mf', 'stock']) rows.forEach((r, i) => {
    if (r.kind !== k || num(taken[rowKey(r)]) < 1) return
    const w = whereOf(r, data)
    let gr = groups.find((x) => x.key === w.key); if (!gr) { gr = { ...w, k, items: [] }; groups.push(gr) }
    gr.items.push({ r, i })
  })
  const steps = groups.flatMap((x) => x.items)
  const nDone = steps.filter(({ r }) => done[rowKey(r)]).length
  const gain = steps.reduce((t, { r }) => t + gainOf(r, Math.min(num(taken[rowKey(r)]), r.value)), 0)
  const finish = (how) => onDone(how, { amount: Math.round(total), actions: record ? withdrawActions(rows, taken) : [] })

  return (
    <div className="g2 wdp">
      <div className="wdp-top">
        <div><span>Kept for this goal</span><b>{L(s.has)}</b></div>
        <div><span>{n > 1 ? "This year's payment" : 'You withdraw'}</span><b className="v">{L(total)}</b></div>
        {n > 1 ? <div><span>Stays for next year</span><b>{L(leftover)}</b></div> : <div><span>From</span><b>{rows.length} investment{rows.length > 1 ? 's' : ''}</b></div>}
      </div>
      <p className="wdp-help">{n > 1 ? "This year's part, taken from the safest money first." : 'The goal is complete: this is everything it holds (its share of each investment).'} The app cannot sell for you: do each step on that platform or bank, tick it, then press Done.</p>

      {groups.map((gr, gi) => { const K = KIND[gr.k]; return (
        <div key={gr.key} className="wdp-grp">
          <p className="wdp-gt"><span className="wdp-no">{gi + 1}</span><K.icon size={13} style={{ color: K.c }} /> {mt(gr.title)}<em>{gr.to}</em></p>
          {gr.items.map(({ r, i }) => {
            const v = num(taken[rowKey(r)]), all = v >= r.value - 1, none = v < 1, k = r.kind, ok = !!done[rowKey(r)]
            if (none) return null
            return (
              <div key={i} className={`wdp-row ${ok ? 'off' : ''}`}>
                <input type="checkbox" className="wdp-ck" checked={ok} onChange={(e) => setDone({ ...done, [rowKey(r)]: e.target.checked })} aria-label="Done" />
                <div className="wdp-n">
                  <b>{k === 'other' ? mt(r.name) : k === 'mf' ? splitFundName(r.name).main : r.name}</b>
                  <small>{k === 'other' ? `${r.holding?.investmentType || 'Investment'} · ${all ? 'close it / take it all' : 'take this much'}` : `${pname(r.portfolioId)} · redeem ${all && r.all ? 'all ' : ''}${Number(all ? r.units : v / (Number(r.holding?.currentNav) || Number(r.holding?.currentPrice) || 1)).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${k === 'stock' ? 'shares' : 'units'}`}</small>
                </div>
                <div className="wdp-amt"><b>{L(v)}</b>{!all && <small>of {L(r.value)}</small>}</div>
              </div>
            )
          })}
        </div>) })}

      {gain > 1000 && <p className="wdp-help">Gain on what you sell: about <b>{L(gain)}</b>. Tax may apply (equity funds and shares held over a year: 12.5% above ₹1.25 L of gains a year per person; within a year: 20%; debt funds: your slab), and some funds charge an exit load within a year. So the money you receive can be a little less.</p>}

      <label className="wdp-rec"><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />
        <span><b>Record these in the app</b><small>Lowers the FD / savings value, redeems the fund units at today's NAV and sells the shares at today's price. The real price is usually the next day's: when the money arrives, import your CAS statement and the app replaces these with the exact amounts.</small></span>
      </label>
      {steps.length > 0 && <p className="wdp-help">{nDone === steps.length ? 'All steps done.' : `${nDone} of ${steps.length} done. You can still press Done if you did them already.`}</p>}

      <div className="wdp-acts">
        {n > 1
          ? <><button type="button" className="p" onClick={() => finish('part')}>✓ Paid this year, keep the rest</button><button type="button" onClick={() => finish('used')}>Close the goal</button></>
          : <button type="button" className="p" onClick={() => finish('used')}>✓ Done · close the goal</button>}
        <button type="button" onClick={onMoreTime}>Need more time</button>
        <button type="button" className="q" onClick={() => onDone('not', { amount: 0, actions: [] })}>Not needed</button>
      </div>
      {g.repeatYears > 0 && <p className="wdp-help">This goal repeats: the next one is added for {new Date(g.targetDate).getFullYear() + g.repeatYears}.</p>}
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.wdp{display:flex;flex-direction:column;gap:12px}
.wdp-top{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.wdp-top>div{padding:12px 14px;background:var(--bg-inset)}.wdp-top>div+div{border-left:1px solid var(--border)}
.wdp-top span{display:block;font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em}.wdp-top b{display:block;font-size:18px;color:var(--text-primary);margin-top:3px;font-variant-numeric:tabular-nums}.wdp-top b.v{color:#a78bfa}
.wdp-help{font-size:12.5px;color:var(--text-muted);margin:0}
.wdp-grp{border:1px solid var(--border);border-radius:14px;overflow:hidden}
.wdp-gt{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0;padding:8px 14px;font-size:12px;font-weight:700;color:var(--text-secondary);background:var(--bg-inset);border-bottom:1px solid var(--border-light)}.wdp-gt em{flex-basis:100%;font-style:normal;font-weight:500;font-size:11.5px;color:var(--text-dim);padding-left:26px}.wdp-no{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#8b5cf6;color:#fff;font-size:11px}.wdp-ck{width:18px;height:18px;accent-color:#059669;flex-shrink:0}
.wdp-row{display:flex;align-items:center;gap:14px;padding:11px 14px;transition:opacity .15s}.wdp-row+.wdp-row{border-top:1px solid var(--border-light)}.wdp-row.off .wdp-n{opacity:.5}
.wdp-n{flex:1;min-width:0}.wdp-n b{display:block;font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wdp-n small{display:block;font-size:12px;color:var(--text-dim);margin-top:2px}
.wdp-amt{text-align:right;flex-shrink:0}.wdp-amt b{display:block;font-size:15px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums}.wdp-amt small{font-size:11.5px;color:var(--text-dim)}
.wdp-in{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.wdp-in label{display:flex;align-items:center;gap:4px;width:150px;padding:0 10px;height:38px;border-radius:10px;border:1px solid var(--border-input);background:var(--bg-input)}
.wdp-in label:focus-within{border-color:#8b5cf6;box-shadow:0 0 0 2px color-mix(in srgb,#8b5cf6 25%,transparent)}
.wdp-in span{font-size:13px;color:var(--text-dim)}.wdp-in input{flex:1;min-width:0;background:transparent;border:0;outline:0;text-align:right;font-size:15px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums}
.wdp-q{display:flex;align-items:center;gap:6px}.wdp-q small{font-size:11.5px;color:var(--text-dim);margin-right:2px}
.wdp-q button{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid var(--border);color:var(--text-muted)}.wdp-q button.on{border-color:#8b5cf6;color:#a78bfa;background:color-mix(in srgb,#8b5cf6 12%,transparent)}
.wdp-rec{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:var(--bg-inset);cursor:pointer}.wdp-rec input{margin-top:3px;width:16px;height:16px;accent-color:#8b5cf6}
.wdp-rec b{display:block;font-size:13.5px;color:var(--text-primary)}.wdp-rec small{display:block;font-size:12px;color:var(--text-dim);margin-top:2px;line-height:1.45}
.wdp-acts{display:flex;flex-wrap:wrap;gap:8px;padding-top:4px}
.wdp-acts button{padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600;border:1px solid var(--border-light);color:var(--text-primary)}
.wdp-acts button.p{background:#059669;border-color:#059669;color:#fff}.wdp-acts button.p:hover{background:#10b981}.wdp-acts button.q{color:var(--text-muted)}
@media(max-width:640px){.wdp-top{grid-template-columns:1fr 1fr}.wdp-top>div:last-child{grid-column:span 2;border-left:0;border-top:1px solid var(--border)}
 .wdp-in{flex-direction:row;align-items:center;justify-content:space-between}.wdp-in label{width:150px}
 .wdp-acts button{flex:1 1 100%}}
`

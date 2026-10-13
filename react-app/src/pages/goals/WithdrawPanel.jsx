import { useMemo, useState } from 'react'
import { Landmark, Wallet, BarChart3 } from 'lucide-react'
import { formatINR, splitFundName } from '../../data/familyData'

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

/** What to record for the amounts taken: [{ kind, label, amount, ... }] (rows taking 0 are skipped). */
export function withdrawActions(rows, taken, today = new Date().toISOString().slice(0, 10)) {
  const out = []
  rows.forEach((r, i) => {
    const amt = Math.min(num(taken[i]), r.value * 1.0001)
    if (!(amt >= 1) || !r.holding) return
    const allOfIt = amt >= r.value - 1
    if (r.kind === 'mf') {
      const nav = navOf(r.holding)
      if (!(nav > 0)) return
      const units = allOfIt ? r.units : Math.min(r.units, amt / nav)
      out.push({ kind: 'mf', label: splitFundName(r.name).main, amount: units * nav, redeem: { portfolioId: r.portfolioId, fundCode: r.holding.fundCode || r.holding.schemeCode, units: Math.round(units * 1000) / 1000, price: nav, date: today } })
    } else if (r.kind === 'stock') {
      const px = priceOf(r.holding)
      const qty = allOfIt ? Math.floor(r.units + 1e-9) : Math.min(Math.floor(r.units + 1e-9), Math.round(amt / (px || 1)))
      if (!(px > 0) || !(qty > 0)) return
      out.push({ kind: 'stock', label: r.name, amount: qty * px, sell: { portfolioId: r.portfolioId, symbol: r.holding.symbol, quantity: qty, price: px, date: today } })
    } else {
      const cur = Number(r.holding.currentValue) || 0
      const left = Math.max(0, Math.round(cur - amt))
      out.push({ kind: 'other', label: r.name, amount: amt, update: { inv: r.holding, currentValue: left, status: left < 1 ? (/fixed deposit|fd|bond/i.test(r.holding.investmentType || '') ? 'Matured' : 'Sold') : r.holding.status || 'Active' } })
    }
  })
  return out
}

export default function WithdrawPanel({ s, mt, pname, onDone, onMoreTime }) {
  const g = s.goal
  const n = Math.max(1, Number(g.payYears) || 1)
  const rows = s.rows
  // multi-year goal: this year's part is taken from the safest money first (cash, then debt funds)
  const fill = useMemo(() => {
    if (n === 1) return rows.map((r) => fmtIn(r.value))
    let want = Math.min(s.has, Math.round((Number(g.targetAmount) || 0) / n))
    const order = rows.map((r, i) => i).sort((a, b) => ({ other: 0, mf: 1, stock: 2 }[rows[a].kind] - { other: 0, mf: 1, stock: 2 }[rows[b].kind]))
    const v = rows.map(() => '0')
    for (const i of order) { if (want < 1) break; const t = Math.min(want, rows[i].value); v[i] = fmtIn(t); want -= t }
    return v
  }, [rows, n, s.has, g.targetAmount])
  const [taken, setTaken] = useState(fill)
  const [record, setRecord] = useState(true)
  const set = (i, v) => setTaken((t) => t.map((x, k) => (k === i ? v : x)))
  const total = taken.reduce((t, v, i) => t + Math.min(num(v), rows[i].value), 0)
  const leftover = Math.max(0, s.has - total)
  const groups = ['other', 'mf', 'stock'].map((k) => ({ k, items: rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === k) })).filter((x) => x.items.length)
  const finish = (how) => onDone(how, { amount: Math.round(total), actions: record ? withdrawActions(rows, taken) : [] })

  return (
    <div className="g2 wdp">
      <div className="wdp-top">
        <div><span>Kept for this goal</span><b>{L(s.has)}</b></div>
        <div><span>You're taking</span><b className="v">{L(total)}</b></div>
        <div><span>{n > 1 ? 'Stays for next year' : 'Goes back to other goals'}</span><b>{L(leftover)}</b></div>
      </div>
      <p className="wdp-help">Filled with what this goal holds in each. Change any amount to what you really took — part of the FD, all of a fund, or 0.</p>

      {groups.map(({ k, items }) => { const K = KIND[k]; return (
        <div key={k} className="wdp-grp">
          <p className="wdp-gt"><K.icon size={13} style={{ color: K.c }} /> {K.t}</p>
          {items.map(({ r, i }) => {
            const v = num(taken[i]), all = v >= r.value - 1, none = v < 1
            return (
              <div key={i} className={`wdp-row ${none ? 'off' : ''}`}>
                <div className="wdp-n">
                  <b>{k === 'other' ? mt(r.name) : k === 'mf' ? splitFundName(r.name).main : r.name}</b>
                  <small>{k === 'other' ? `${r.holding?.investmentType || 'Investment'} · update its value` : `${pname(r.portfolioId)} · ${r.all ? 'all ' : ''}${Number(r.units).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${k === 'stock' ? 'shares' : 'units'}`}</small>
                </div>
                <div className="wdp-in">
                  <label><span>₹</span><input inputMode="decimal" value={taken[i]} onChange={(e) => set(i, e.target.value)} onBlur={() => set(i, fmtIn(Math.min(num(taken[i]), r.value)))} onFocus={(e) => e.target.select()} aria-label={`Taking from ${r.name}`} /></label>
                  <div className="wdp-q"><small>of {L(r.value)}</small>
                    <button type="button" className={all ? 'on' : ''} onClick={() => set(i, fmtIn(r.value))}>All</button>
                    <button type="button" className={none ? 'on' : ''} onClick={() => set(i, '0')}>None</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>) })}

      <label className="wdp-rec"><input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />
        <span><b>Record these in the app</b><small>Lowers the FD / savings value, redeems the fund units at today's NAV and sells the shares at today's price. Untick if you'll import a CAS or record them yourself.</small></span>
      </label>

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
.wdp-gt{display:flex;align-items:center;gap:6px;margin:0;padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim);background:var(--bg-inset);border-bottom:1px solid var(--border-light)}
.wdp-row{display:flex;align-items:center;gap:14px;padding:11px 14px;transition:opacity .15s}.wdp-row+.wdp-row{border-top:1px solid var(--border-light)}.wdp-row.off .wdp-n{opacity:.5}
.wdp-n{flex:1;min-width:0}.wdp-n b{display:block;font-size:14px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wdp-n small{display:block;font-size:12px;color:var(--text-dim);margin-top:2px}
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
 .wdp-row{flex-direction:column;align-items:stretch;gap:8px}.wdp-in{flex-direction:row;align-items:center;justify-content:space-between}.wdp-in label{width:150px}
 .wdp-acts button{flex:1 1 100%}}
`

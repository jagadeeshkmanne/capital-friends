import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LOGO_ICON = `${import.meta.env.BASE_URL}logo-new.png`

function GI({ s = 14 }) {
  return (
    <svg style={{ flexShrink: 0 }} width={s} height={s} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ─── Mock window nav icons ───
function MockNav({ active }) {
  const icons = ['DB', 'FM', 'MF', 'GL', 'IN', 'LN']
  return (
    <div style={{ width: 40, flexShrink: 0, background: '#02060f', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, alignSelf: 'stretch' }}>
      {icons.map(ic => (
        <div key={ic} style={{ width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, ...(ic === active ? { background: 'rgba(167,139,250,0.12)', color: '#a78bfa' } : { color: '#475569' }) }}>
          {ic}
        </div>
      ))}
    </div>
  )
}

function WinBar({ url }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#02060f', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fec02f' }} />
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#29ca41' }} />
      <div style={{ flex: 1, maxWidth: 360, margin: '0 auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: '3px 10px', fontSize: 10.5, color: '#64748b', textAlign: 'center' }}>
        {url}
      </div>
    </div>
  )
}

// ─── Slide 0: Family Awareness / Dashboard ───
function Slide0() {
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="DB" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,.25)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Dashboard</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(167,139,250,.1)', color: '#a78bfa' }}>Everyone</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(255,255,255,.04)', color: '#475569' }}>Jagadeesh</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(255,255,255,.04)', color: '#475569' }}>Priya</span>
          </div>
        </div>
        {/* Net Worth */}
        <div style={{ padding: '12px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(128,128,128,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <div style={{ width: 3, height: 12, borderRadius: 2, background: 'rgba(148,163,184,.5)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569' }}>Net Worth</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.02em', lineHeight: 1.1 }}>₹1.37 Cr</div>
              <div style={{ marginTop: 5, fontSize: 11.5 }}>
                <span style={{ fontWeight: 600, color: '#34d399' }}>+₹31.4L</span>
                <span style={{ color: '#64748b', marginLeft: 5 }}>(+29.6% returns)</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Assets</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#94a3b8' }}>₹1.56 Cr</div>
              <div style={{ fontSize: 8.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 6 }}>Liabilities</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f87171' }}>₹18.4L</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
              <div style={{ width: '46%', background: '#8b5cf6' }} />
              <div style={{ width: '30%', background: '#60a5fa' }} />
              <div style={{ width: '10%', background: '#fbbf24' }} />
              <div style={{ width: '9%', background: '#818cf8' }} />
              <div style={{ width: '5%', background: '#94a3b8' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              {[['#8b5cf6','Equity 46%'],['#60a5fa','Debt 30%'],['#fbbf24','Gold 10%'],['#818cf8','Hybrid 9%'],['#94a3b8','Cash 5%']].map(([c,l]) => (
                <span key={l} style={{ fontSize: 9.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <b style={{ width: 6, height: 6, background: c, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />{l}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Asset Allocation */}
        <div style={{ padding: '12px 16px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <div style={{ width: 3, height: 12, borderRadius: 2, background: 'rgba(148,163,184,.5)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569' }}>Asset Allocation</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 136, height: 136 }}>
                <div style={{ width: 136, height: 136, borderRadius: '50%', background: 'conic-gradient(#f97316 0% 50%,#8b5cf6 50% 58%,#fbbf24 58% 68%,#f59e0b 68% 73%,#0d9488 73% 77%,#6366f1 77% 83%,#94a3b8 83% 100%)' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 86, height: 86, borderRadius: '50%', background: '#080d1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <div style={{ fontSize: 7, color: '#64748b', letterSpacing: '.04em', textTransform: 'uppercase' }}>Net Worth</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9' }}>₹1.37Cr</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, width: '100%' }}>
                <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 7, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Assets</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f1f5f9' }}>₹1.56Cr</div>
                  <div style={{ fontSize: 8, color: '#34d399' }}>+₹31.4L P&L</div>
                </div>
                <div style={{ background: 'rgba(248,113,113,0.08)', borderRadius: 7, padding: '5px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Liabilities</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#f87171' }}>₹18.4L</div>
                  <div style={{ fontSize: 8, color: '#64748b' }}>1 Loan</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                ['#f97316','Mutual Funds','₹78.4L','50%','rgba(249,115,22,.1)','#f97316'],
                ['#8b5cf6','Stocks','₹12.2L','10%','rgba(139,92,246,.1)','#8b5cf6'],
                ['#fbbf24','Gold (SGB)','₹14.9L','12%','rgba(251,191,36,.1)','#fbbf24'],
                ['#f59e0b','Fixed Deposits','₹8.0L','6%','rgba(245,158,11,.1)','#f59e0b'],
                ['#0d9488','PPF','₹5.2L','3%','rgba(13,148,136,.1)','#0d9488'],
                ['#6366f1','EPF','₹8.8L','6%','rgba(99,102,241,.1)','#6366f1'],
              ].map(([dotColor, name, val, pct, pctBg, pctColor]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 9px', borderRadius: 7, background: 'rgba(128,128,128,0.05)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>{name}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8' }}>{val}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: pctBg, color: pctColor }}>{pct}</span>
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 9px', borderRadius: 7, background: 'rgba(248,113,113,0.06)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: '#f87171', fontWeight: 500 }}>1 Loan</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#f87171' }}>−₹18.4L</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Slide 1: ATH Buy Signals ───
function Slide1() {
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="MF" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', cursor: 'pointer' }}>
            Growth Portfolio — Jagadeesh
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(198,40,40,.12)', color: '#c62828' }}>3 buy signals</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          {[['Invested','₹12.4L','#f1f5f9'],['Current Value','₹15.6L','#f1f5f9'],['Unrealized P&L','+₹3.2L +25.8%','#34d399'],['Monthly SIP','₹20,000','#34d399']].map(([label, val, color], i) => (
            <div key={i} style={{ padding: '8px 10px', background: '#080d1a' }}>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{val.split(' ')[0]}</div>
              {val.split(' ')[1] && <div style={{ fontSize: 9, color }}>{val.split(' ')[1]}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'rgba(0,0,0,.15)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ width: 3, height: 10, borderRadius: 2, flexShrink: 0, background: '#c62828' }} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#c62828' }}>ATH Tracker</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100, background: 'rgba(198,40,40,.1)', color: '#c62828' }}>3 signals</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 60px 76px', padding: '4px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 8 }}>
          {['Fund','ATH NAV','Current','Signal'].map((h, i) => (
            <span key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {[
          { name: 'Axis Small Cap Fund', sub: 'Dec 2024', pct: '▼26.6%', pctColor: '#c62828', ath: '₹52.10', cur: '₹38.22', signal: 'Strong Buy', sigBg: 'rgba(198,40,40,.12)', sigColor: '#c62828' },
          { name: 'HDFC Mid-Cap Opp.', sub: 'Jan 2025', pct: '▼15.5%', pctColor: '#d84315', ath: '₹168.50', cur: '₹142.35', signal: 'Good Buy', sigBg: 'rgba(216,67,21,.1)', sigColor: '#d84315' },
          { name: 'Kotak Emerging Eq.', sub: 'Feb 2025', pct: '▼3.6%', pctColor: '#b8860b', ath: '₹92.40', cur: '₹89.10', signal: 'Watch', sigBg: 'rgba(184,134,11,.1)', sigColor: '#b8860b' },
          { name: 'Parag Parikh Flexi Cap', sub: 'Mar 2025 · ▼0.4%', pct: null, pctColor: null, ath: '₹82.80', cur: '₹82.45', signal: 'Near ATH', sigBg: 'rgba(71,85,105,.1)', sigColor: '#475569' },
          { name: 'Mirae Asset Large Cap', sub: 'At all-time high today', pct: null, pctColor: null, ath: '₹105.80', curBold: true, cur: '₹105.80', curColor: '#34d399', signal: 'At ATH', sigBg: 'rgba(52,211,153,.1)', sigColor: '#34d399' },
        ].map((r, i, arr) => (
          <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '1fr 58px 60px 76px', padding: '8px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{r.name}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
                {r.pct ? <>{r.sub} · <b style={{ color: r.pctColor }}>{r.pct}</b></> : r.sub}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#475569' }}>{r.ath}</div>
            <div style={{ textAlign: 'right', fontSize: 11, color: r.curColor || '#475569', fontWeight: r.curBold ? 700 : 400 }}>{r.cur}</div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: r.sigBg, color: r.sigColor }}>{r.signal}</span>
            </div>
          </div>
        ))}
        <div style={{ padding: '5px 14px', background: 'rgba(0,0,0,.15)', borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <p style={{ fontSize: 9, color: '#475569' }}>Strong Buy ≥20% · Good Buy 10–20% · Watch 5–10% below ATH</p>
        </div>
      </div>
    </div>
  )
}

// ─── Slide 2: Smart Rebalancing ───
function Slide2() {
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="MF" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#e2e8f0', cursor: 'pointer' }}>
            Growth Portfolio — Jagadeesh
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(167,139,250,.1)', color: '#a78bfa' }}>4 off-target</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'rgba(0,0,0,.15)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ width: 3, height: 10, borderRadius: 2, flexShrink: 0, background: '#7c3aed' }} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#7c3aed' }}>Rebalance</span>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 11.5, fontWeight: 600, color: '#a78bfa', borderBottom: '2px solid #a78bfa' }}>Adjust SIP</div>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 11.5, fontWeight: 600, color: '#64748b', borderBottom: '2px solid transparent' }}>Lumpsum</div>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', fontSize: 11.5, fontWeight: 600, color: '#64748b', borderBottom: '2px solid transparent' }}>Buy / Sell</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', background: 'rgba(0,0,0,.12)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>Value</span><span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>₹12,40,000</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>SIP</span><span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>₹20,000/mo</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>Threshold</span><span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>5%</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 50px 92px', padding: '4px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 8 }}>
          {['Fund','Now','Target','New SIP'].map((h, i) => (
            <span key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', textAlign: i === 0 ? 'left' : i < 3 ? 'center' : 'right' }}>{h}</span>
          ))}
        </div>
        {[
          { name: 'Axis Bluechip Fund', sub: 'overweight +5%', now: '30%', target: '25%', sip: 'Stop SIP', sipColor: '#fbbf24' },
          { name: 'Parag Parikh Flexi Cap', sub: 'underweight −5%', now: '35%', target: '40%', sip: '₹12,000', sipColor: '#34d399' },
          { name: 'SBI Small Cap', sub: 'overweight +5%', now: '20%', target: '15%', sip: 'Stop SIP', sipColor: '#fbbf24' },
          { name: 'HDFC Short Duration', sub: 'underweight −5%', now: '15%', target: '20%', sip: '₹8,000', sipColor: '#34d399' },
        ].map((r, i, arr) => (
          <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '1fr 44px 50px 92px', padding: '8px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', gap: 8, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>{r.name}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{r.sub}</div>
            </div>
            <span style={{ textAlign: 'center', color: '#475569', fontSize: 11.5 }}>{r.now}</span>
            <span style={{ textAlign: 'center', color: '#64748b', fontSize: 11.5 }}>{r.target}</span>
            <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: r.sipColor }}>{r.sip}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 3: Goals ───
function Slide3() {
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="GL" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,.25)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Goals</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#60a5fa' }}>2 On Track</span>
            <span style={{ fontSize: 11, color: '#fb923c' }}>1 Attention</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          {[['Target','₹2.7 Cr','#f1f5f9',null],['Current','₹59.7L','#f1f5f9',null],['Gap','₹2.1 Cr','#f87171',null],['Progress','22%','#f1f5f9','3 goals'],['SIP Needed','₹42,000','#34d399','per month'],['Lumpsum','₹8.4L','#f1f5f9','one-time']].map(([l, v, c, sub]) => (
            <div key={l} style={{ padding: '8px 9px', background: '#080d1a' }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c }}>{v}</div>
              {sub && <div style={{ fontSize: 8, color: '#64748b' }}>{sub}</div>}
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#475569', marginBottom: 10 }}>Goal Timeline</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Retirement', status: 'Behind', statusBg: 'rgba(239,68,68,.12)', statusColor: '#ef4444', yrs: '18.0 yrs', pct: 14, barColor: '#ef4444', val: '₹28.5L', extra: '₹4.2L behind', extraColor: '#ef4444' },
              { name: 'Child Education', status: 'On track', statusBg: 'rgba(16,185,129,.12)', statusColor: '#10b981', yrs: '12.0 yrs', pct: 24, barColor: '#10b981', val: '₹12.2L', extra: 'Target ₹50L', extraColor: '#64748b' },
              { name: 'Own House', status: 'On track', statusBg: 'rgba(16,185,129,.12)', statusColor: '#10b981', yrs: '8.0 yrs', pct: 38, barColor: '#10b981', val: '₹19.0L', extra: 'Target ₹50L', extraColor: '#64748b' },
            ].map(r => (
              <div key={r.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: r.statusBg, color: r.statusColor, flexShrink: 0 }}>{r.status}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0, marginLeft: 8 }}>{r.yrs}</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: r.barColor, borderRadius: 100 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#f1f5f9' }}>{r.val}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: r.barColor }}>{r.pct}%</span>
                  <span style={{ fontSize: 10, color: r.extraColor }}>{r.extra}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ margin: '8px 10px', padding: '9px 12px', borderRadius: 8, background: 'rgba(251,146,60,.04)', border: '1px solid rgba(251,146,60,.2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <svg style={{ width: 13, height: 13, flexShrink: 0, color: '#fb923c', marginTop: 2 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#fb923c', marginBottom: 2 }}>De-Risking Alert</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>Retirement · Equity 78% vs rec. max 60%</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Excess ₹3.2L in equity — above glide path by 18%</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: 'rgba(251,146,60,.12)', color: '#fb923c', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>Rebalance</span>
        </div>
      </div>
    </div>
  )
}

// ─── Slide 4: Retirement Buckets ───
function Slide4() {
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="GL" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,.25)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Retirement Bucket Plan</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(251,146,60,.1)', color: '#fb923c' }}>Smart routing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'rgba(0,0,0,.15)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ width: 3, height: 10, borderRadius: 2, flexShrink: 0, background: '#ea580c' }} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#ea580c' }}>Bucket State vs Targets</span>
        </div>
        <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', gap: 1, marginBottom: 9 }}>
            <div style={{ width: '83%', background: '#8b5cf6' }} />
            <div style={{ width: '10%', background: '#fbbf24' }} />
            <div style={{ width: '7%', background: '#34d399' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.25)', borderRadius: 8, padding: '10px 11px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#a78bfa', marginBottom: 4 }}>B3 · Equity</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#a78bfa', lineHeight: 1.2, marginBottom: 3 }}>₹48.2L</div>
              <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 5 }}>Long-term growth</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#34d399' }}>✓ On target</div>
            </div>
            <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 8, padding: '10px 11px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#fbbf24', marginBottom: 4 }}>B2 · Hybrid</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24', lineHeight: 1.2, marginBottom: 3 }}>₹6.1L</div>
              <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 5 }}>Target: 60 mo</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#f87171' }}>↓ ₹2.5L short</div>
            </div>
            <div style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.25)', borderRadius: 8, padding: '10px 11px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#34d399', marginBottom: 4 }}>B1 · Liquid</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399', lineHeight: 1.2, marginBottom: 3 }}>₹3.8L</div>
              <div style={{ fontSize: 9.5, color: '#64748b', marginBottom: 5 }}>Target: 24 mo</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#f87171' }}>↓ ₹3.4L short</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'rgba(0,0,0,.15)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <div style={{ width: 3, height: 10, borderRadius: 2, flexShrink: 0, background: '#34d399' }} />
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#34d399' }}>Annual Refill Switches</span>
        </div>
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ background: 'rgba(52,211,153,.05)', border: '1px solid rgba(52,211,153,.18)', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,.15)', color: '#a78bfa' }}>B3 Equity</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>→</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(52,211,153,.15)', color: '#34d399' }}>B1 Liquid</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#34d399', marginLeft: 2 }}>DIRECT</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>₹3.4L</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Skips B2 · Saves ~₹12,000 LTCG tax</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}>Confirm →</span>
          </div>
          <div style={{ background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,.15)', color: '#a78bfa' }}>B3 Equity</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>→</span>
                <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(251,191,36,.15)', color: '#fbbf24' }}>B2 Hybrid</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#fbbf24', marginLeft: 2 }}>REFILL</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>₹2.5L</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Only what B2 actually needs</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', cursor: 'pointer', flexShrink: 0, marginLeft: 10 }}>Confirm →</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const SLIDES = [
  {
    id: 0,
    tabLabel: 'Family Awareness',
    dotColor: '#16a34a',
    tag: 'Family First',
    tagStyle: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
    heading: 'Your family knows where everything is — even in your absence',
    para: 'If something happens to you, your family needs instant access to every investment, policy, loan, and FD — not months of confusion.',
    bullets: [
      { ck: '✓', ckColor: '#16a34a', text: 'Auto monthly email reports sent to family' },
      { ck: '✓', ckColor: '#16a34a', text: 'Insurance, FD, SIP reminders for everyone' },
      { ck: '✓', ckColor: '#16a34a', text: 'Family members can sign in any time' },
      { ck: '✓', ckColor: '#16a34a', text: 'Combined or individual net worth view' },
    ],
    url: 'capitalfriends.in/dashboard',
    MockUI: Slide0,
  },
  {
    id: 1,
    tabLabel: 'ATH Buy Signals',
    dotColor: '#c62828',
    tag: 'ATH Tracking',
    tagStyle: { background: '#fff5f5', color: '#c62828', border: '1px solid #fecaca' },
    heading: 'Know exactly when to buy your funds',
    para: 'Daily NAV from AMFI. Color-coded buy signals for funds you actually hold — not random market noise.',
    bullets: [
      { ck: '▼', ckColor: '#c62828', text: 'Strong Buy — 20%+ below All-Time High' },
      { ck: '▼', ckColor: '#d84315', text: 'Good Buy — 10–20% below ATH' },
      { ck: '▼', ckColor: '#b8860b', text: 'Watch — 5–10% below ATH' },
      { ck: '✓', ckColor: '#16a34a', text: 'Updated daily from AMFI' },
    ],
    url: 'capitalfriends.in/investments/mutual-funds',
    MockUI: Slide1,
  },
  {
    id: 2,
    tabLabel: 'Smart Rebalancing',
    dotColor: '#7c3aed',
    tag: 'Smart Rebalancing',
    tagStyle: { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
    heading: 'Three rebalancing modes — SIP, Lumpsum, Buy/Sell',
    para: 'Set target allocation per fund. When portfolio drifts beyond your threshold, get exact numbers — no guesswork.',
    bullets: [
      { ck: '✓', ckColor: '#7c3aed', text: 'SIP Adjust — stop or increase monthly SIP' },
      { ck: '✓', ckColor: '#7c3aed', text: 'Lumpsum Top-up — exact amount to invest' },
      { ck: '✓', ckColor: '#7c3aed', text: 'Buy/Sell — exact units to transact' },
      { ck: '✓', ckColor: '#7c3aed', text: 'Configurable threshold per portfolio' },
    ],
    url: 'capitalfriends.in/investments/mutual-funds',
    MockUI: Slide2,
  },
  {
    id: 3,
    tabLabel: 'Goals & Glide Path',
    dotColor: '#0891b2',
    tag: 'Goals',
    tagStyle: { background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' },
    heading: 'Goals with automatic glide path de-risk alerts',
    para: 'As you get closer to a goal, equity % is auto-checked against the glide path. Alert fires when you\'re over-exposed.',
    bullets: [
      { ck: '✓', ckColor: '#0891b2', text: 'Link portfolios to goals with % allocation' },
      { ck: '✓', ckColor: '#0891b2', text: 'Live goal progress as NAVs change daily' },
      { ck: '✓', ckColor: '#0891b2', text: 'Glide path: equity reduces as goal nears' },
      { ck: '✓', ckColor: '#0891b2', text: 'One-click rebalance when alert fires' },
    ],
    url: 'capitalfriends.in/goals',
    MockUI: Slide3,
  },
  {
    id: 4,
    tabLabel: 'Retirement Buckets',
    dotColor: '#ea580c',
    tag: 'Retirement',
    tagStyle: { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' },
    heading: 'Retirement buckets with tax-smart routing',
    para: 'B3→B1 direct switch skips B2 — avoiding an unnecessary redemption and capital gains tax every annual refill cycle.',
    bullets: [
      { ck: '✓', ckColor: '#ea580c', text: 'B3 Equity — long-term growth (10+ yrs)' },
      { ck: '✓', ckColor: '#ea580c', text: 'B2 Hybrid — bridge buffer (3–7 yrs)' },
      { ck: '✓', ckColor: '#ea580c', text: 'B1 Liquid — safety net (1–2 yrs)' },
      { ck: '✓', ckColor: '#ea580c', text: 'Direct B3→B1 saves ~₹12,000/yr in tax' },
    ],
    url: 'capitalfriends.in/goals — Retirement Bucket Plan',
    MockUI: Slide4,
  },
]

const TRACK_CARDS = [
  { color: '#f97316', title: 'Mutual Funds', desc: 'Track all MF portfolios across AMCs. Units, NAV, current value, P&L, XIRR. SIP and lumpsum transactions. ATH buy signals per fund.' },
  { color: '#8b5cf6', title: 'Stocks', desc: 'Equity holdings across brokers. Buy/sell transactions, average cost, unrealized and realized P&L per scrip and portfolio.' },
  { color: '#fbbf24', title: 'FDs, Gold & Other', desc: 'Fixed deposits, SGB, real estate, PPF and any other asset. Track invested amount, current value, maturity date and expected returns.' },
  { color: '#f43f5e', title: 'Insurance Policies', desc: 'Term life, health, motor, home and travel policies. Sum assured, premium, maturity date — for every family member.' },
  { color: '#ef4444', title: 'Loans & Liabilities', desc: 'Home loan, car loan, personal loan, credit card. Outstanding balance, EMI, interest rate, tenure — all in one view.' },
  { color: '#16a34a', title: 'Family Members', desc: 'Add your entire family — spouse, parents, children. View combined or individual net worth, goals, insurance and loans per member.' },
]

const SMART_CARDS = [
  { color: '#c62828', title: 'ATH Buy Signals', desc: 'See how far each fund is from its All-Time High NAV. Strong Buy / Good Buy / Watch — color-coded signals updated daily from AMFI.', uniq: true },
  { color: '#7c3aed', title: 'Smart Rebalancing — 3 Modes', desc: 'Set target allocation per fund. Get exact SIP adjustment, lumpsum top-up, or buy/sell units when portfolio drifts beyond threshold.', uniq: true },
  { color: '#0891b2', title: 'Goals & Glide Path De-risk', desc: 'Link portfolios to goals. Equity % auto-checked against years left. De-risk alert fires when you\'re overexposed — one click to rebalance.', uniq: true },
  { color: '#ea580c', title: 'Retirement Bucket Strategy', desc: 'Split corpus into B3 (equity), B2 (hybrid), B1 (liquid). B3→B1 direct routing saves capital gains tax every refill cycle.', uniq: true },
  { color: '#0d9488', title: 'Smart Reminders', desc: 'Insurance renewals, FD maturities, SIP due dates, loan EMIs. Sorted by urgency — never let a policy lapse or a date slip by.' },
  { color: '#2563eb', title: 'Your Data, Your Drive', desc: 'Everything stored in a Google Spreadsheet in YOUR Google Drive. No servers, no database. Auto monthly email reports to your whole family.' },
]

export default function LandingPage() {
  const { isAuthenticated, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [activeSlide, setActiveSlide] = useState(0)
  const [featTab, setFeatTab] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  const N = 5
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setPaused(p => {
        if (!p) setActiveSlide(prev => (prev + 1) % N)
        return p
      })
    }, 5000)
  }, [])

  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [resetTimer])

  function goSlide(i) {
    setActiveSlide(i)
    resetTimer()
  }

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const slide = SLIDES[activeSlide]

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#f8fafc', color: '#0f172a', WebkitFontSmoothing: 'antialiased' }}>
      {/* ─── HEADER ─── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,31,0.98)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56 }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src={LOGO_ICON} alt="" style={{ height: 44, width: 'auto' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }} />
            <div style={{ display: 'none', width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#6d28d9,#0284c7)', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins',sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', flexShrink: 0 }}>CF</div>
            <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 17, letterSpacing: '-0.3px' }}>
              <b style={{ color: '#fff', fontWeight: 700 }}>Capital</b> <em style={{ color: '#34d399', fontWeight: 800, fontStyle: 'normal' }}>Friends</em>
            </span>
          </a>
          <button onClick={signIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 8, background: 'linear-gradient(to right,#7c3aed,#0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
            <GI s={14} />
            Sign In
          </button>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '24px 20px 20px' : '20px 24px 16px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Poppins',sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.3, marginBottom: 10 }}>
          One dashboard for your family's <span style={{ color: '#16a34a' }}>entire wealth</span>
        </h1>
        <p style={{ fontSize: 13.5, color: '#475569', marginBottom: 14, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Track mutual funds, stocks, insurance, loans for every family member — stored privately in your own Google Drive.
        </p>
        <button onClick={signIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, background: 'linear-gradient(to right,#7c3aed,#0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          <GI s={14} />
          Sign in with Google — it's free
        </button>
        <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>
          Free · Open source · No bank credentials · Data stays in your Google Drive
        </div>
      </section>

      {/* ─── SHOWCASE ─── */}
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Tabs bar */}
        <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', minWidth: 'max-content', margin: '0 auto' }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goSlide(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                  fontSize: 12, fontWeight: 600, background: 'none', border: 'none',
                  cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
                  color: activeSlide === i ? '#0f172a' : '#94a3b8',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dotColor, opacity: activeSlide === i ? 1 : 0.3, flexShrink: 0 }} />
                {s.tabLabel}
                {activeSlide === i && (
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: s.dotColor }} />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Show area */}
        <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', height: isMobile ? 'auto' : 'calc(100vh - 295px)', overflow: isMobile ? 'visible' : 'hidden' }}>
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: isMobile ? '12px 16px 16px' : '16px 24px', height: isMobile ? 'auto' : '100%', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 16, alignItems: 'stretch' }}>
            {/* Left feature panel */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: isMobile ? 18 : 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', padding: '3px 10px', borderRadius: 100, marginBottom: 14, ...slide.tagStyle }}>
                  {slide.tag}
                </span>
                <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 19, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: 10 }}>
                  {slide.heading}
                </div>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>{slide.para}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                  {slide.bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: '#64748b', padding: '2px 0', display: 'flex', alignItems: 'flex-start', gap: 7, lineHeight: 1.5 }}>
                      <span style={{ flexShrink: 0, marginTop: 1, fontSize: 11, fontWeight: 700, color: b.ckColor }}>{b.ck}</span>
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={signIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 9, background: 'linear-gradient(to right,#7c3aed,#0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                <GI s={13} />
                Get started free
              </button>
            </div>

            {/* Right: mock browser window */}
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(15,23,42,.18),0 2px 8px rgba(15,23,42,.1)', display: 'flex', flexDirection: 'column', height: isMobile ? 300 : '100%' }}>
              <WinBar url={slide.url} />
              <slide.MockUI />
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY CF ─── */}
      <section style={{ background: '#080d1a', borderTop: '1px solid rgba(255,255,255,.06)', padding: isMobile ? '32px 16px 36px' : '40px 24px 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
          {/* Question badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#f87171', padding: '3px 14px', borderRadius: 100, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.15)' }}>
              A question worth asking
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
          </div>
          <h2 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-.02em', lineHeight: 1.3, textAlign: 'center', marginBottom: 22 }}>
            What happens to your family's finances if something happens to <span style={{ color: '#f87171' }}>you?</span>
          </h2>

          {/* Before / After grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Without tracker */}
            <div style={{ padding: '20px 22px', borderRadius: 12, background: 'rgba(248,113,113,.04)', border: '1px solid rgba(248,113,113,.2)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#fca5a5' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#f87171' }} />
                Without a tracker
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  'No one knows which MFs you hold or where to redeem',
                  'Insurance policies expire unrenewed — premiums lapse',
                  'FDs auto-renew at low rates because nobody tracked them',
                  'Loan EMIs missed — credit score damaged',
                  'Retirement corpus eroded by panicked decisions',
                  'Family spends months just finding out what you owned',
                ].map((t, i, arr) => (
                  <li key={i} style={{ fontSize: 12.5, color: '#64748b', padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', lineHeight: 1.5 }}>
                    <span style={{ color: '#f87171', flexShrink: 0, fontSize: 11, fontWeight: 700, marginTop: 1 }}>✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* With CF */}
            <div style={{ padding: '20px 22px', borderRadius: 12, background: 'rgba(52,211,153,.04)', border: '1px solid rgba(52,211,153,.2)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#34d399' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#34d399' }} />
                With Capital Friends
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  'Complete MF, stock, FD, gold, insurance & loan ledger',
                  'Monthly email report auto-sent to spouse & parents',
                  'Insurance renewal reminders before policies lapse',
                  'FD maturity & SIP reminders every month',
                  'Goals tracked — retirement, education, emergency fund',
                  'Family signs in directly — all data available, any time',
                ].map((t, i, arr) => (
                  <li key={i} style={{ fontSize: 12.5, color: '#64748b', padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', lineHeight: 1.5 }}>
                    <span style={{ color: '#34d399', flexShrink: 0, fontSize: 11, fontWeight: 700, marginTop: 1 }}>✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Trust strip */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: isMobile ? 10 : 20, fontSize: 12.5, color: '#34d399', fontWeight: 500, justifyContent: 'center' }}>
              <span>✓ Always Free</span>
              <span style={{ color: '#1e293b' }}>·</span>
              <span>✓ No Credit Card</span>
              <span style={{ color: '#1e293b' }}>·</span>
              <span>✓ Open Source</span>
              <span style={{ color: '#1e293b' }}>·</span>
              <span>✓ Your Data stays in Google Drive</span>
            </span>
          </div>

          {/* How it works */}
          <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 32 }}>
            <span style={{ display: 'block', textAlign: 'center', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#a78bfa', marginBottom: 24 }}>
              Up and running in under a minute
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 24 : 0, position: 'relative' }}>
              {[
                { n: '1', h: 'Sign in with Google', p: 'No forms, no bank linking. Just your Google account.' },
                { n: '2', h: 'Spreadsheet created in your Drive', p: 'A private Google Sheet is set up automatically. Your data never leaves your account.' },
                { n: '3', h: 'Start tracking your wealth', p: 'Add MFs, stocks, FDs, insurance, loans. Dashboard updates live daily.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 16px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#080d1a', border: '1px solid rgba(167,139,250,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Poppins',sans-serif", fontSize: 16, fontWeight: 700, color: '#a78bfa', marginBottom: 12, flexShrink: 0 }}>{s.n}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 5 }}>{s.h}</div>
                  <p style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '36px 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#94a3b8', display: 'block', textAlign: 'center', marginBottom: 6 }}>
            Everything in one place
          </span>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 26, fontWeight: 700, color: '#0f172a', textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Your family's complete financial OS
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 18 }}>
            Built for Indian families · <span style={{ color: '#7c3aed', fontWeight: 700 }}>★ Unique</span> = not available in any other free tracker
          </div>

          {/* Feature tabs */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20, background: '#eef2f7', padding: 5, borderRadius: 12, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto' }}>
            <button
              onClick={() => setFeatTab(0)}
              style={{ padding: '8px 22px', borderRadius: 8, border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s', ...(featTab === 0 ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(15,23,42,.1)' } : { background: 'none', color: '#64748b' }) }}>
              <span style={{ color: '#64748b', fontSize: 12 }}>📊</span> Track Everything
            </button>
            <button
              onClick={() => setFeatTab(1)}
              style={{ padding: '8px 22px', borderRadius: 8, border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s', ...(featTab === 1 ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 4px rgba(15,23,42,.1)' } : { background: 'none', color: '#64748b' }) }}>
              <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 800 }}>★</span> Smart Tools
            </button>
          </div>

          {/* Feature cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12 }}>
            {(featTab === 0 ? TRACK_CARDS : SMART_CARDS).map(card => (
              <div key={card.title} style={{ padding: '22px 24px', borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ height: 3, borderRadius: 2, width: 30, marginBottom: 11, background: card.color }} />
                {card.uniq && (
                  <span style={{ display: 'inline-block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', padding: '2px 9px', borderRadius: 4, background: 'rgba(124,58,237,.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,.18)', marginBottom: 8 }}>★ Unique</span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.62 }}>{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA + FOOTER ─── */}
      <section style={{ background: '#080d1a', borderTop: '1px solid rgba(255,255,255,.06)', padding: '28px 24px 0', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 20 }}>
          <h2 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 6 }}>
            Start managing your family's wealth today
          </h2>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>No registration form. No bank linking. Just your Google account.</p>
          <button onClick={signIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 24px', borderRadius: 9, background: 'linear-gradient(to right,#7c3aed,#0891b2)', color: '#fff', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            <GI s={14} />
            Sign in with Google — it's free
          </button>
          <div style={{ marginTop: 10, fontSize: 11.5, color: '#475569' }}>
            No bank credentials · Data stays in your Google Drive · Always free · Open source
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '12px 0' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 10, flexWrap: 'wrap', padding: '0 24px', textAlign: isMobile ? 'center' : 'left' }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>
              <img src={LOGO_ICON} alt="" style={{ height: 28 }}
                onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }} />
              <div style={{ display: 'none', width: 24, height: 24, fontSize: 9, borderRadius: 5, background: 'linear-gradient(135deg,#6d28d9,#0284c7)', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>CF</div>
              <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 14, opacity: 0.4 }}>
                <b style={{ color: '#fff', fontWeight: 700 }}>Capital</b> <em style={{ color: '#34d399', fontWeight: 800, fontStyle: 'normal' }}>Friends</em>
              </span>
            </a>
            <div style={{ fontSize: 11.5, color: '#334155', textAlign: 'center' }}>
              Built with <span style={{ color: '#f43f5e' }}>♥</span> by <span style={{ color: '#475569', fontWeight: 600 }}>Jagadeesh Manne</span>
              <span style={{ color: '#1e293b', margin: '0 6px' }}>·</span>
              <span style={{ color: '#334155' }}>Free &amp; open source</span>
            </div>
            <div>
              <a href="https://capitalfriends.in/privacy" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', padding: '4px 10px', borderRadius: 5 }}>Privacy Policy</a>
              <span style={{ color: '#1e293b', fontSize: 12 }}>·</span>
              <a href="https://capitalfriends.in/terms" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', padding: '4px 10px', borderRadius: 5 }}>Terms &amp; Conditions</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

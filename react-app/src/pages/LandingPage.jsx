import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, LockKeyhole, Target } from 'lucide-react'
import LandingHeader from './landing/LandingHeader'
import StoryHero from './landing/StoryHero'

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

// ─── Slide 1: how far each fund is below its high (ATH) ───
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
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, display: 'inline-block', background: 'rgba(198,40,40,.12)', color: '#c62828' }}>3 below high</span>
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
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#c62828' }}>All-time high tracker</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100, background: 'rgba(198,40,40,.1)', color: '#c62828' }}>3 signals</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 60px 76px', padding: '4px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 8 }}>
          {['Fund','All-time high','Current','Signal'].map((h, i) => (
            <span key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#475569', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {[
          { name: 'Axis Small Cap Fund', sub: 'Dec 2024', pct: '▼26.6%', pctColor: '#c62828', ath: '₹52.10', cur: '₹38.22', signal: '20%+ below', sigBg: 'rgba(198,40,40,.12)', sigColor: '#c62828' },
          { name: 'HDFC Mid-Cap Opp.', sub: 'Jan 2025', pct: '▼15.5%', pctColor: '#d84315', ath: '₹168.50', cur: '₹142.35', signal: '10–20% below', sigBg: 'rgba(216,67,21,.1)', sigColor: '#d84315' },
          { name: 'Kotak Emerging Eq.', sub: 'Feb 2025', pct: '▼3.6%', pctColor: '#b8860b', ath: '₹92.40', cur: '₹89.10', signal: '5–10% below', sigBg: 'rgba(184,134,11,.1)', sigColor: '#b8860b' },
          { name: 'Parag Parikh Flexi Cap', sub: 'Mar 2025 · ▼0.4%', pct: null, pctColor: null, ath: '₹82.80', cur: '₹82.45', signal: 'Near high', sigBg: 'rgba(71,85,105,.1)', sigColor: '#475569' },
          { name: 'Mirae Asset Large Cap', sub: 'At all-time high today', pct: null, pctColor: null, ath: '₹105.80', curBold: true, cur: '₹105.80', curColor: '#34d399', signal: 'At its high', sigBg: 'rgba(52,211,153,.1)', sigColor: '#34d399' },
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
          <p style={{ fontSize: 9, color: '#475569' }}>Colour shows how far below its all-time high (peak) · 20%+ · 10–20% · 5–10%</p>
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

// ─── Slide 3: Goals (one pool for all goals, the road of goals, this month's steps) ───
const MiniRing = ({ pct, c }) => {
  const r = 11, cc = 2 * Math.PI * r
  return (
    <span style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
      <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="3.5" /><circle cx="15" cy="15" r={r} fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * cc} ${cc}`} transform="rotate(-90 15 15)" /></svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 700, color: '#f1f5f9' }}>{pct}%</span>
    </span>
  )
}
function Slide3() {
  const box = (l, v, c, sub) => (
    <div key={l} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 7, padding: '6px 8px' }}>
      <div style={{ fontSize: 7.5, color: '#64748b' }}>{l}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontSize: 7.5, color: '#64748b' }}>{sub}</div>}
    </div>
  )
  const goal = (icon, name, sub, pct, c, badge, side) => (
    <div style={{ width: '62%', marginLeft: side === 'r' ? 'auto' : 0, background: '#0f172a', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#f1f5f9' }}>{name}</div>
        <div style={{ fontSize: 8.5, color: '#64748b' }}>{sub}</div>
        <span style={{ display: 'inline-block', marginTop: 3, fontSize: 7.5, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: `${c}22`, color: c }}>{badge}</span>
      </div>
      <MiniRing pct={pct} c={c} />
    </div>
  )
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="GL" />
      <div style={{ flex: 1, minWidth: 0, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8.5, fontWeight: 600, padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(251,191,36,.4)', background: 'rgba(251,191,36,.08)', color: '#fbbf24' }}>🌴 Retirement: refill due ›</span>
          <span style={{ display: 'flex', gap: 5 }}>{['Money for goals', 'Edit goals', '+ Add Goal'].map((t) => <span key={t} style={{ fontSize: 8, fontWeight: 600, padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,.08)', color: '#a78bfa' }}>{t}</span>)}</span>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: '7px 10px', background: '#0f172a' }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '.08em', color: '#64748b', marginBottom: 5 }}>REBALANCE THIS MONTH</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 10.5, fontWeight: 700, color: '#f1f5f9' }}>🏠 Home · Make it safer</div><div style={{ fontSize: 8.5, color: '#64748b' }}>Sell 2,051 units of a flexi cap fund → buy a liquid fund, same portfolio</div></div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9' }}>₹6.6L</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
          {box('Have today', '₹79.3L', '#f1f5f9', 'Money for goals')}{box('Need today', '₹78.1L', '#f1f5f9', 'with your SIPs')}{box('Gap', 'On track', '#34d399', 'nothing to add')}{box('Free money', '₹1.2L', '#f1f5f9', 'covers future gaps')}
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M50,0 C50,15 31,15 31,30 C31,50 69,45 69,62 C69,78 31,75 31,100" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="5" vectorEffect="non-scaling-stroke" />
          </svg>
          {goal('🛟', 'Emergency Fund', 'Dec 2026 · 3 months left', 100, '#34d399', 'On track', 'l')}
          {goal('🎓', 'Child Education', 'Jun 2038 · 11.5 yrs left', 64, '#34d399', 'On track', 'r')}
          {goal('🌴', 'Retirement', 'Jan 2045 · 18 yrs left', 41, '#fbbf24', '● Refill due', 'l')}
        </div>
      </div>
    </div>
  )
}

// ─── Slide 4: Retirement buckets (money flows Growth → Stability → Income → your bank) ───
function Slide4() {
  const jar = (x, c, name, amt, sub, fill) => (
    <g>
      <rect x={x - 26} y="58" width="52" height="74" rx="10" fill="#0f172a" stroke={c} strokeOpacity=".6" strokeWidth="2" />
      <rect x={x - 24} y={58 + 74 * (1 - fill)} width="48" height={74 * fill - 2} rx="8" fill={c} opacity=".55" />
      <rect x={x - 14} y="50" width="28" height="7" rx="3" fill={c} opacity=".8" />
      <text x={x} y="148" textAnchor="middle" fontSize="10" fontWeight="700" fill={c}>{name}</text>
      <text x={x} y="161" textAnchor="middle" fontSize="10" fontWeight="700" fill="#f1f5f9">{amt}</text>
      <text x={x} y="173" textAnchor="middle" fontSize="8" fill="#64748b">{sub}</text>
    </g>
  )
  return (
    <div style={{ display: 'flex', background: '#080d1a', color: '#e2e8f0', flex: 1 }}>
      <MockNav active="GL" />
      <div style={{ flex: 1, minWidth: 0, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>🌴 Retirement · how your buckets work</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(52,211,153,.12)', color: '#34d399' }}>▲ market near its high</span>
        </div>
        <svg viewBox="0 0 400 180" style={{ width: '100%', maxHeight: 210, background: 'rgba(255,255,255,.02)', borderRadius: 9 }} aria-hidden="true">
          <defs><marker id="lp-ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#a78bfa" /></marker></defs>
          {jar(70, '#a78bfa', 'Growth', '₹48L', 'the rest · equity', 0.85)}
          {jar(170, '#fbbf24', 'Stability', '₹30L', '5 years · hybrid / debt', 0.9)}
          {jar(270, '#34d399', 'Income', '₹12L', '2 years · liquid', 0.95)}
          <path d="M70,46 Q170,0 262,46" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#lp-ar)" />
          <rect x="128" y="10" width="96" height="16" rx="8" fill="#0f172a" stroke="#a78bfa" strokeOpacity=".5" />
          <text x="176" y="21" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#f1f5f9">✓ Income refilled</text>
          <rect x="330" y="78" width="46" height="36" rx="8" fill="#0f172a" stroke="#34d399" strokeWidth="1.5" />
          <text x="353" y="101" textAnchor="middle" fontSize="15">🏦</text>
          <path d="M298,112 Q318,132 330,104" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" />
          <text x="353" y="128" textAnchor="middle" fontSize="8" fill="#64748b">₹50K / month</text>
        </svg>
        <div style={{ border: '1px solid rgba(251,191,36,.4)', background: 'rgba(251,191,36,.07)', borderRadius: 9, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: 10.5, fontWeight: 700, color: '#fbbf24' }}>● Refill plan · ₹6.4L due</div><div style={{ fontSize: 8.5, color: '#64748b' }}>Growth → Income · sell units shown, buy a liquid fund in the same portfolio</div></div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>Refill now ›</span>
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
    heading: 'A monthly summary for your family, and they can sign in any time',
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
    tabLabel: 'Below-high alerts',
    dotColor: '#c62828',
    tag: 'All-time high tracking',
    tagStyle: { background: '#fff5f5', color: '#c62828', border: '1px solid #fecaca' },
    heading: 'See how far each fund is from its all-time high',
    para: 'Daily NAV from AMFI. See, by colour, how far each fund you hold is below its all-time high — facts, not tips.',
    bullets: [
      { ck: '▼', ckColor: '#c62828', text: '20%+ below its all-time high' },
      { ck: '▼', ckColor: '#d84315', text: '10–20% below its all-time high' },
      { ck: '▼', ckColor: '#b8860b', text: '5–10% below its all-time high' },
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
    tabLabel: 'Goals',
    dotColor: '#0891b2',
    tag: 'Goals',
    tagStyle: { background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' },
    heading: 'All your goals from one pool of money, with exact steps',
    para: 'No linking funds to goals. The app shares your investments across all goals, each on its own glide path, and tells you exactly what to do this month.',
    bullets: [
      { ck: '✓', ckColor: '#0891b2', text: 'Money for goals: choose what counts, the app shares it out' },
      { ck: '✓', ckColor: '#0891b2', text: 'Priority decides who gets money first; same priority shares equally' },
      { ck: '✓', ckColor: '#0891b2', text: 'Near goals get "Make it safer" with exact units to switch' },
      { ck: '✓', ckColor: '#0891b2', text: 'Short? One SIP or one-time amount. Date reached? A withdraw plan' },
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
    heading: 'Retirement income from 3 buckets, refilled once a year',
    para: 'Money flows Growth → Stability → Income → your bank. Growth is sold only when markets are near their high; after a fall, Stability pays instead.',
    bullets: [
      { ck: '✓', ckColor: '#ea580c', text: 'Income: 2 years of expenses in liquid funds, pays your monthly SWP' },
      { ck: '✓', ckColor: '#ea580c', text: 'Stability: 5 years in hybrid and short-term debt funds' },
      { ck: '✓', ckColor: '#ea580c', text: 'Growth: the rest in equity, built step by step from 5 years before you retire' },
      { ck: '✓', ckColor: '#ea580c', text: '"Refill due" shows on the retirement card with exact sell and buy' },
    ],
    url: 'capitalfriends.in/goals — Retirement card',
    MockUI: Slide4,
  },
]

const TRACK_CARDS = [
  { color: '#f97316', title: 'Mutual Funds', desc: 'Track all MF portfolios across AMCs. Units, NAV, current value, P&L, XIRR. SIP and lumpsum transactions. How far each fund is below its all-time high.' },
  { color: '#8b5cf6', title: 'Stocks', desc: 'Equity holdings across brokers. Buy/sell transactions, average cost, unrealized and realized P&L per scrip and portfolio.' },
  { color: '#fbbf24', title: 'FDs, Gold & Other', desc: 'Fixed deposits, EPF, PPF, NPS, real estate, and gold: SGBs, gold and silver ETFs (like GoldBees), and physical gold at today\'s rate. For goals, gold counts as growth, not safe money.' },
  { color: '#f43f5e', title: 'Insurance Policies', desc: 'Term life, health, motor, home and travel policies. Sum assured, premium, maturity date — for every family member.' },
  { color: '#ef4444', title: 'Loans & Liabilities', desc: 'Home loan, car loan, personal loan, credit card. Outstanding balance, EMI, interest rate, tenure — all in one view.' },
  { color: '#16a34a', title: 'Family Members', desc: 'Add your entire family — spouse, parents, children. View combined or individual net worth, goals, insurance and loans per member.' },
]

const SMART_CARDS = [
  { color: '#16a34a', title: 'Import from CAMS Statement', desc: 'Upload your CAMS + KFintech statement PDF and every purchase, SIP, switch and redemption since day one comes in — with true XIRR, CAGR and profit. Read on your device; undo anytime.', uniq: true },
  { color: '#c62828', title: 'Below-high alerts', desc: 'See how far each fund is below its All-Time High NAV, colour-coded by distance and updated daily from AMFI.', uniq: true },
  { color: '#7c3aed', title: 'Smart Rebalancing — 3 Modes', desc: 'Set target allocation per fund. Get exact SIP adjustment, lumpsum top-up, or buy/sell units when portfolio drifts beyond threshold.', uniq: true },
  { color: '#0891b2', title: 'Goals from one pool', desc: 'Your investments are shared across all goals by priority, each on its own glide path. Every month: the exact SIP, one-time amount or switch, and a withdraw plan when a goal\'s date comes.', uniq: true },
  { color: '#ea580c', title: 'Retirement Buckets', desc: 'Growth, Stability and Income buckets for a steady monthly income. Built step by step before you retire, refilled once a year, and Growth is never sold in a fall.', uniq: true },
  { color: '#0d9488', title: 'Smart Reminders', desc: 'Insurance renewals, FD maturities, SIP due dates, loan EMIs. Sorted by urgency — never let a policy lapse or a date slip by.' },
  { color: '#2563eb', title: 'Your Data, Your Drive', desc: 'Everything stored in a Google Spreadsheet in YOUR Google Drive. No servers, no database. Auto monthly email reports to your whole family.' },
]


// Questions people search for (shown on the page and sent to Google as FAQ data in index.html)
export const LANDING_FAQ = [
  ['What is the best free stock and mutual fund portfolio tracker in India?', 'Capital Friends is a free, open-source stock and mutual fund portfolio tracker built for Indian families. It tracks mutual funds, stocks, FDs, PPF, EPF, gold, insurance and loans for every family member in one dashboard, with daily NAV updates from AMFI.'],
  ['Is there a portfolio tracker in Excel or Google Sheets?', 'Yes. Capital Friends keeps all your data in a Google Sheet in your own Google Drive (you can download it as Excel any time). You get a ready-made portfolio tracker spreadsheet with an app on top: dashboards, XIRR, goals, rebalancing and monthly family email reports.'],
  ['How do I track mutual funds of my whole family in one place?', 'Add each family member and their investment accounts (Zerodha, Groww, a distributor or direct). Then import each person\'s CAMS statement or add funds yourself. You see every portfolio separately and the family total together.'],
  ['Can I import my CAMS / KFintech CAS statement?', 'Yes. Download the Detailed CAMS + KFintech consolidated statement (CAS) PDF and import it. Every purchase, SIP, switch, STP and redemption is added with its real date, so invested amount, profit, XIRR and CAGR are correct.'],
  ['How is XIRR calculated for my mutual funds?', 'XIRR uses the date and amount of every purchase, SIP and redemption, plus today\'s value. Switches between your own funds are not counted as new money. You see XIRR for each fund, each portfolio and the whole family.'],
  ['Is my financial data safe?', 'Your data stays in your own Google Drive. Capital Friends never asks for bank or broker passwords, has no server database, and the developer cannot see your data. The code is open source on GitHub.'],
  ['Is Capital Friends really free?', 'Yes, free forever with no ads. It is a personal project shared openly; you can support it with a voluntary donation if it helps you.'],
]
export const YOUTUBE_URL = 'https://www.youtube.com/@capitalfriendsin'
export const INSTAGRAM_URL = 'https://www.instagram.com/jags.manne/'

// Live usage count: plain numbers the server publishes to the public master sheet (App_Stats tab).
const MASTER_DB_ID = '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s'
function useFamiliesCount() {
  const [n, setN] = useState(null)
  useEffect(() => {
    let alive = true
    // 'limit 1' keeps the reply tiny; the header check makes sure we read the App_Stats tab
    const url = `https://docs.google.com/spreadsheets/d/${MASTER_DB_ID}/gviz/tq?tqx=out:json&sheet=App_Stats&headers=1&tq=${encodeURIComponent('select A, B limit 1')}`
    fetch(url).then((r) => r.text()).then((t) => {
      const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
      if (String(j?.table?.cols?.[0]?.label || '').toLowerCase() !== 'families') return
      const c = j?.table?.rows?.[0]?.c || []
      const families = Number(c[0]?.v)
      if (alive && Number.isFinite(families) && families > 0) setN({ families })
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return n
}
const HERO_G = <GI s={20} />   // made once, so the hero isn't re-rendered by the page's own timers

export default function LandingPage() {
  const { isAuthenticated, loading, signIn } = useAuth()
  const families = useFamiliesCount()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#f8fafc', color: '#0f172a', WebkitFontSmoothing: 'antialiased' }}>
      {/* ─── HEADER + HERO: logo, families count, socials; then the animated story of what the app does ─── */}
      <LandingHeader signIn={signIn} isMobile={isMobile} youtube={YOUTUBE_URL} instagram={INSTAGRAM_URL} families={families?.families} />
      <StoryHero signIn={signIn} isMobile={isMobile} GoogleIcon={HERO_G} families={families?.families} videoUrl={YOUTUBE_URL} />

      {/* ─── ABOUT (collapsed): purpose of the app + how it uses Google data.
           Kept on the home page for Google OAuth verification, but folded away so the page stays clean. ─── */}
      <section id="about" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: isMobile ? '10px 16px' : '10px 24px' }}>
        <details style={{ maxWidth: 960, margin: '0 auto' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', textAlign: 'center', padding: '6px 0', listStyle: 'none' }}>
            What is Capital Friends and how it uses your Google account <span style={{ color: '#16a34a' }}>▾</span>
          </summary>
          <div style={{ paddingTop: 14 }}>
          <h2 style={{ fontFamily: "'Poppins',sans-serif", fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>What is Capital Friends?</h2>
          <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7, marginBottom: 18 }}>Capital Friends is a free, open-source web app that helps Indian families keep track of their money in one place: mutual funds, stocks, fixed deposits, gold, bank and investment accounts, insurance policies, loans and financial goals, for every family member. Its main purpose is family awareness: the app sends a regular email summary to the family members you choose, so your spouse or parents always know what you own and where, even if something happens to you. It also shows each fund's current value and distance from its all-time high, suggests rebalancing amounts when a portfolio drifts from its target split, and tracks goals such as retirement and children's education.</p>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>How Capital Friends uses your Google account</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Your own Google Sheet (Google Drive, app files only)</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>When you sign in, Capital Friends creates one spreadsheet in your Google Drive and stores all your data there. The app can only open the file it created, or a family member's Capital Friends sheet that you pick yourself in the Google Picker. It cannot see any other files in your Drive.</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Email reports and reminders (Gmail, send only)</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Sends your portfolio summary, SIP dates, insurance renewals and goal updates from your own Gmail to you and the family members you add. The app never reads your email.</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Scheduled updates (Apps Script triggers)</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Refreshes fund prices daily and sends the scheduled reports and reminders, even when you are not using the app.</div>
            </div>
            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Public market prices (external requests)</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Downloads public mutual fund NAVs and stock prices from the Capital Friends public price sheet. No personal data is sent out.</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 14 }}>
            There is no Capital Friends server or database. Your data stays in your own Google Drive, and the app never asks for bank passwords. Capital Friends is a tracking tool, not investment advice. Read the <a href="https://capitalfriends.in/privacy" style={{ color: '#0891b2' }}>Privacy Policy</a> and <a href="https://capitalfriends.in/terms" style={{ color: '#0891b2' }}>Terms &amp; Conditions</a>.
          </p>
          </div>
        </details>
      </section>

      {/* ─── FOOTER ─── */}
      <section style={{ background: '#080d1a', padding: 0, textAlign: 'center' }}>
        {/* Footer */}
        <div style={{ padding: '14px 0' }}>
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
              <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', padding: '4px 10px', borderRadius: 5 }}>YouTube</a>
              <span style={{ color: '#1e293b', fontSize: 12 }}>·</span>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', padding: '4px 10px', borderRadius: 5 }}>Instagram</a>
              <span style={{ color: '#1e293b', fontSize: 12 }}>·</span>
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

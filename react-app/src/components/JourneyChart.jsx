import { useEffect, useRef, useState } from 'react'
import { getNavHistories, valueOnDays } from '../utils/navHistory'
import { createChart, AreaSeries, LineSeries, LineType, LineStyle, CrosshairMode, ColorType, TickMarkType, createSeriesMarkers } from 'lightweight-charts'
import { useMaskText } from '../hooks/useMaskText'

// Investment Journey chart, in the style of broker apps (Groww / Kite):
//   big number on top that follows your finger / mouse, a clean line, range tabs underneath.
// Net money invested over time (step line) and today's value (dashed jump at the end).
// Same component for the family, a portfolio and a single fund. Built on TradingView
// Lightweight Charts (Apache-2.0): pinch / wheel to zoom, drag to move.
//
// data: [{ t (ms), date, invested, txns, hasBuy, hasSell, currentValue?, now? }] in date order

const RANGES = [['1M', 1 / 12], ['6M', 0.5], ['1Y', 1], ['3Y', 3], ['5Y', 5], ['10Y', 10], ['All', 0]]
const DAY_S = 86400

function shortINR(v) {
  const a = Math.abs(v)
  if (a >= 1e7) return `${+(v / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `${+(v / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`
  if (a >= 1e3) return `${Math.round(v / 1e3)}K`
  return String(Math.round(v))
}
// calendar day -> UTC midnight seconds (the chart works in UTC; avoids IST showing the day before)
function daySec(ms) { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 1000 }
function fmtDay(sec) { return new Date(sec * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
function cssVar(name, fallback) {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback } catch { return fallback }
}

export default function JourneyChart({ data, txns, height = 240, formatMoney = (v) => `₹${Math.round(v).toLocaleString('en-IN')}` }) {
  const mt = useMaskText()
  // value over time: NAV history of every fund in these transactions (loaded once a day, cached)
  const [navMap, setNavMap] = useState(null)
  const codesSig = [...new Set((txns || []).map((t) => String(t.fundCode || '')).filter(Boolean))].sort().join(',')
  useEffect(() => {
    let alive = true
    setNavMap(null)
    if (!codesSig) return
    getNavHistories(codesSig.split(',')).then((m) => { if (alive) setNavMap(m) }).catch(() => {})
    return () => { alive = false }
  }, [codesSig])
  const txnsRef = useRef(txns)
  txnsRef.current = txns
  const boxRef = useRef(null)
  const chartRef = useRef(null)
  const mapRef = useRef(null)      // time -> point (with fillers between transactions)
  const valueRef = useRef(null)    // time -> value of holdings that day
  const marksRef = useRef([])
  const [hover, setHover] = useState(null) // { time, point }
  const [range, setRange] = useState('All')
  const points = data || []
  const last = points[points.length - 1]
  const value = last?.currentValue || 0
  const spanYears = points.length > 1 ? (last.t - points[0].t) / (365.25 * 86400000) : 0
  // rebuild the chart only when the data really changes (callers may pass a new array every render)
  const sig = `${points.length}|${points[0]?.t}|${last?.t}|${last?.invested}|${value}|${height}|${navMap ? navMap.size : 'x'}`
  const pointsRef = useRef(points)
  pointsRef.current = points

  useEffect(() => {
    const el = boxRef.current
    const points = pointsRef.current
    const last = points[points.length - 1]
    const value = last?.currentValue || 0
    if (!el || points.length < 2) return
    const chart = createChart(el, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: cssVar('--text-dim', '#94a3b8'), fontSize: 11, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false, fixLeftEdge: true, fixRightEdge: true, rightOffset: 0, minBarSpacing: 0.02, lockVisibleTimeRangeOnResize: true,
        // our own labels (UTC dates): "2024" at a new year, "Mar" at a new month, "12 Mar" for days
        tickMarkFormatter: (time, type) => {
          const d = new Date(time * 1000)
          const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
          if (type === TickMarkType.Year) return String(d.getUTCFullYear())
          if (type === TickMarkType.Month) return M
          return `${d.getUTCDate()} ${M}`
        },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(148,163,184,0.55)', width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      localization: { priceFormatter: shortINR, locale: 'en-IN' },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
    })
    chartRef.current = chart

    // The chart spaces points evenly, so give it a regular calendar grid (daily for short spans,
    // weekly for long ones) carrying the invested amount forward: gaps in time look like gaps.
    const real = new Map()
    points.forEach((p) => real.set(daySec(p.t), p))
    const realDays = [...real.keys()].sort((a, b) => a - b)
    const startS = realDays[0], endS = realDays[realDays.length - 1]
    const stepS = (endS - startS) > 730 * DAY_S ? 7 * DAY_S : DAY_S
    const gridSet = new Set(realDays)
    for (let t = startS; t <= endS; t += stepS) gridSet.add(t)
    const times = [...gridSet].sort((a, b) => a - b)
    const byTime = new Map()
    let cur = real.get(startS)
    times.forEach((t) => {
      if (real.has(t)) cur = real.get(t)
      byTime.set(t, real.has(t) ? cur : { invested: cur.invested, txns: [], filler: true })
    })
    mapRef.current = byTime

    const area = chart.addSeries(AreaSeries, {
      lineType: LineType.WithSteps, lineColor: 'rgba(167,139,250,0.9)', lineWidth: 1.5,
      topColor: 'rgba(139,92,246,0.10)', bottomColor: 'rgba(139,92,246,0.0)',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#ffffff', crosshairMarkerBackgroundColor: '#8b5cf6',
    })
    area.setData(times.map((t) => ({ time: t, value: byTime.get(t).invested })))
    // where money went in / came out: green dot = purchase / SIP, red dot = redemption
    // (switches between your own funds are not money in or out, so no dot)
    // many transactions (e.g. the whole family over years): one dot per month for the net flow,
    // so the line stays readable; zoom in to see each day
    const flows = []
    realDays.forEach((t) => {
      const p = real.get(t)
      if (p.now) return
      const ext = (p.txns || []).filter((x) => !/SWITCH|DIVIDEND/.test(x.txnType))
      const net = ext.reduce((a, x) => a + (x.isBuy ? x.amount : -x.amount), 0)
      if (ext.length) flows.push([t, net])
    })
    let marks
    if (flows.length > 40) {
      const byMonth = new Map()
      flows.forEach(([t, net]) => {
        const d = new Date(t * 1000), k = d.getUTCFullYear() * 12 + d.getUTCMonth()
        const m = byMonth.get(k) || { t, net: 0 }
        m.net += net
        byMonth.set(k, m)
      })
      marks = [...byMonth.values()].filter((m) => m.net !== 0)
        .map((m) => ({ time: m.t, position: 'inBar', shape: 'circle', size: 0.35, color: m.net > 0 ? '#4ade80' : '#fb7185' }))
    } else {
      marks = flows.filter(([, net]) => net !== 0)
        .map(([t, net]) => ({ time: t, position: 'inBar', shape: 'circle', size: 0.45, color: net > 0 ? '#4ade80' : '#fb7185' }))
    }
    marksRef.current = marks

    // value over time (units held x that day's NAV); falls back to a dashed jump to today's value
    let valueByTime = null
    if (navMap && navMap.size && (txnsRef.current || []).length) {
      const { values } = valueOnDays(times, txnsRef.current, navMap)
      if (value > 0) values[values.length - 1] = value // today: same number as the rest of the app
      valueByTime = new Map(times.map((t, k) => [t, values[k]]))
      const valueArea = chart.addSeries(AreaSeries, {
        lineColor: '#22c55e', lineWidth: 2, topColor: 'rgba(34,197,94,0.22)', bottomColor: 'rgba(34,197,94,0.0)',
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: '#ffffff', crosshairMarkerBackgroundColor: '#22c55e',
      })
      valueArea.setData(times.map((t, k) => ({ time: t, value: values[k] })))
      createSeriesMarkers(valueArea, marksRef.current) // buy / sell dots sit on the value line
    } else if (value > 0) {
      const txDays = realDays.filter((t) => !real.get(t).now)
      const lastTx = txDays.length ? txDays[txDays.length - 1] : startS
      const from = lastTx < endS ? lastTx : endS - DAY_S
      const valueLine = chart.addSeries(LineSeries, {
        color: '#22c55e', lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false,
        crosshairMarkerVisible: false, pointMarkersVisible: false,
      })
      valueLine.setData([{ time: from, value: real.get(lastTx)?.invested ?? last.invested }, { time: endS, value }])
    }
    if (!valueByTime) createSeriesMarkers(area, marksRef.current)
    valueRef.current = valueByTime
    // a little headroom so the line never touches the edges
    area.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.04 } })

    chart.timeScale().fitContent()
    setRange('All')
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.point || param.point.x < 0) { setHover(null); return }
      const p = mapRef.current && mapRef.current.get(param.time)
      setHover(p ? { time: param.time, point: p, x: param.point.x, y: param.point.y, value: valueRef.current ? valueRef.current.get(param.time) : null } : null)
    })
    const ro = new ResizeObserver(() => { chart.applyOptions({ width: el.clientWidth }) })
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(k) {
    setRange(k)
    const chart = chartRef.current
    if (!chart || !last) return
    const yrs = (RANGES.find((r) => r[0] === k) || [])[1]
    if (!yrs) { chart.timeScale().fitContent(); return }
    const to = daySec(last.t)
    chart.timeScale().setVisibleRange({ from: Math.max(daySec(points[0].t), to - Math.round(yrs * 365.25) * DAY_S), to })
  }

  if (points.length < 2) return null

  // amount added in the chosen range (what broker apps show as "change in 1Y")
  const yrs = (RANGES.find((r) => r[0] === range) || [])[1]
  let addedInRange = null
  if (yrs) {
    const startMs = last.t - yrs * 365.25 * 86400000
    const before = points.filter((p) => p.t < startMs)
    addedInRange = last.invested - (before.length ? before[before.length - 1].invested : 0)
  }
  const gain = value - last.invested
  const gainPct = last.invested > 0 ? (gain / last.invested) * 100 : 0
  const h = hover?.point
  const hTx = h && !h.filler ? (h.txns || []) : []
  const buys = hTx.filter((t) => t.isBuy && !/SWITCH|DIVIDEND/.test(t.txnType)).reduce((s, t) => s + t.amount, 0)
  const sells = hTx.filter((t) => !t.isBuy && !/SWITCH/.test(t.txnType)).reduce((s, t) => s + t.amount, 0)
  const switches = hTx.filter((t) => /SWITCH/.test(t.txnType)).length

  return (
    <div className="select-none">
      {/* headline: follows the cursor / finger, like broker apps */}
      <div className="flex items-end justify-between gap-3 mb-1 h-[64px] overflow-hidden">
        {h ? (
          <div>
            <p className="text-[11px] text-[var(--text-dim)]">{fmtDay(hover.time)}{h.now ? ' · today' : ''}</p>
            {hover.value > 0 ? (
              <>
                <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(hover.value)} <span className="text-xs font-medium text-[var(--text-dim)]">value</span></p>
                <p className="text-xs tabular-nums">
                  <span className="text-[var(--text-dim)]">invested {formatMoney(h.invested)} · </span>
                  <span className={hover.value - h.invested >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{hover.value - h.invested >= 0 ? '+' : ''}{formatMoney(hover.value - h.invested)}{h.invested > 0 ? ` (${((hover.value - h.invested) / h.invested * 100).toFixed(1)}%)` : ''}</span>
                </p>
              </>
            ) : (
              <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(h.invested)} <span className="text-xs font-medium text-[var(--text-dim)]">invested</span></p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[11px] text-[var(--text-dim)]">Value today</p>
            <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{formatMoney(value || last.invested)}</p>
            <p className="text-xs tabular-nums">
              {value > 0 && <span className={gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{gain >= 0 ? '+' : ''}{formatMoney(gain)} ({gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)</span>}
              <span className="text-[var(--text-dim)]"> · invested {formatMoney(last.invested)}</span>
            </p>
          </div>
        )}
        {!h && (
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-3 text-[11px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-500 inline-block" /> Invested</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Bought</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Sold</span>
              {value > 0 && (navMap && navMap.size
                ? <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Value</span>
                : <span className="flex items-center gap-1.5"><span className="w-3 border-t-2 border-dashed border-emerald-500 inline-block" /> Value today{codesSig && !navMap ? ' (loading history…)' : ''}</span>)}
            </div>
            {addedInRange !== null && (
              <p className="text-xs text-[var(--text-dim)] tabular-nums">{addedInRange >= 0 ? 'Added' : 'Taken out'} in last {range}: <b className="text-[var(--text-primary)]">{formatMoney(Math.abs(addedInRange))}</b></p>
            )}
          </div>
        )}
      </div>

      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div ref={boxRef} className="absolute inset-0" />
        {hover && hTx.length > 0 && (() => {
          const w = boxRef.current?.clientWidth || 600
          const cardW = Math.min(320, w - 16)
          const left = hover.x + 16 + cardW > w ? Math.max(8, hover.x - 16 - cardW) : hover.x + 16
          const top = height / 2 // vertically centred on the chart, next to the cursor
          return (
            <div className="absolute z-20 pointer-events-none rounded-2xl border border-violet-400/50 text-xs overflow-hidden" style={{ left, top, width: cardW, transform: 'translateY(-50%)', background: 'linear-gradient(180deg, rgba(139,92,246,0.16) 0%, rgba(139,92,246,0.04) 40%), var(--bg-card)', boxShadow: '0 0 0 4px rgba(139,92,246,0.10), 0 20px 44px -12px rgba(0,0,0,.7)', backdropFilter: 'blur(6px)' }}>
              <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-400 to-emerald-400" />
              <div className="px-4 pt-3 pb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-[var(--text-primary)]">{fmtDay(hover.time)}</span>
                <span className="text-[11px] text-[var(--text-dim)]">{hTx.length} transaction{hTx.length > 1 ? 's' : ''}</span>
              </div>
              <div className="px-4 pb-2 divide-y divide-[var(--border-light)]">
                {hTx.slice(0, 5).map((t, i) => {
                  const sw = /SWITCH/.test(t.txnType)
                  const col = sw ? 'text-amber-400' : t.isBuy ? 'text-emerald-400' : 'text-rose-400'
                  const dot = sw ? 'bg-amber-400' : t.isBuy ? 'bg-emerald-400' : 'bg-rose-400'
                  return (
                    <div key={i} className="py-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-start gap-2 min-w-0">
                          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${dot}`} />
                          <span className="text-[12px] leading-snug font-medium text-[var(--text-primary)] line-clamp-2">{t.fundName}</span>
                        </span>
                        <span className={`tabular-nums font-bold text-[12px] shrink-0 ${col}`}>{t.isBuy ? '+' : '−'}{formatMoney(t.amount)}</span>
                      </div>
                      <p className="ml-4 mt-0.5 text-[11px] text-[var(--text-dim)]">
                        <span className={`font-semibold ${col}`}>{sw ? (t.isBuy ? 'Switch in' : 'Switch out') : t.isBuy ? (t.txnType === 'SIP' ? 'SIP' : 'Bought') : 'Sold'}</span>
                        {t.portfolioName ? ` · ${mt(t.portfolioName)}` : ''}{t.units ? ` · ${t.units.toLocaleString('en-IN')} units` : ''}
                      </p>
                    </div>
                  )
                })}
                {hTx.length > 5 && <p className="py-1.5 text-[11px] text-[var(--text-dim)]">+ {hTx.length - 5} more on this day</p>}
              </div>
              <div className="px-4 py-2.5 bg-black/20 flex justify-between text-[11px]">
                <span className="text-[var(--text-dim)]">Invested <b className="ml-1 text-violet-300 tabular-nums text-[12px]">{formatMoney(h.invested)}</b></span>
                {hover.value > 0 && <span className="text-[var(--text-dim)]">Value <b className="ml-1 text-emerald-400 tabular-nums text-[12px]">{formatMoney(hover.value)}</b></span>}
              </div>
            </div>
          )
        })()}
      </div>

      {/* range tabs joined to the chart, like Groww: one row, equal widths, active one highlighted */}
      <div className="mt-2 p-1 rounded-xl bg-[var(--bg-inset,rgba(0,0,0,0.25))] border border-[var(--border-light)] flex items-stretch gap-1">
        {RANGES.filter((r) => !r[1] || r[1] < spanYears + 0.05).map(([k]) => (
          <button key={k} onClick={() => pick(k)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${range === k ? 'bg-gradient-to-r from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-900/40' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}>{k}</button>
        ))}
      </div>
    </div>
  )
}

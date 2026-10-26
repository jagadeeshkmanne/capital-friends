import { describe, it, expect, afterEach, vi } from 'vitest'
import { targets, replay, nextDue, checks, WORDS_STOCKS } from './fundRule'

// weekday NAVs from 2 Jan 2025 to Fri 23 Oct 2026: a slow rise, then a sharp fall in the last week (Mon 19 – Fri 23 Oct)
function history() {
  const times = [], navs = []; let v = 100
  for (let t = Date.parse('2025-01-02T00:00:00Z'); t <= Date.parse('2026-10-23T00:00:00Z'); t += 864e5) {
    const d = new Date(t); if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    v *= d.toISOString().slice(0, 10) >= '2026-10-19' ? 0.98 : 1.0005
    times.push(t / 1000); navs.push(v)
  }
  return { times, navs }
}

describe('fund rule (G and H)', () => {
  afterEach(() => vi.useRealTimers())

  it('targets: the 60% gold limit and the sharp fall both send money to the liquid fund', () => {
    const near = (w, f, g, l) => { expect(w.fund).toBeCloseTo(f); expect(w.gold).toBeCloseTo(g); expect(w.liq).toBeCloseTo(l) }
    near(targets(0.5, 0.5, false, false), 0.25, 0.6, 0.15)
    near(targets(0.5, 0.5, false, true), 0, 0.6, 0.4)
    expect(targets(0.8, 1, false, false, 0.7).fund).toBe(0.7)   // H: stocks never above 70%
  })

  it('checks: gold-limit overflow excludes the sharp-fall share', () => {
    expect(checks({ e: 0.5, x: 0.5, up: false, fast: false }, null).goldOver).toBeCloseTo(0.15)
    expect(checks({ e: 0.5, x: 0.5, up: false, fast: true }, null).goldOver).toBeCloseTo(0.15)
    expect(checks({ e: 0.5, x: 1, up: false, fast: true }, null).goldOver).toBe(0)
  })

  it('on the weekend after a sharp fall: the switch is due Monday and the checks shown are the new ones', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-24T04:30:00Z'))   // Sat 24 Oct, 10 am in India
    const h = history(), R = replay(h, 0.7, WORDS_STOCKS)
    expect(R.asOf).toBe('2026-10-23')
    expect(R.fast).toBe(false)                         // this week's checks came from the 16 Oct close
    const N = nextDue(h, R, 0.7, WORDS_STOCKS)
    expect(N.date).toBe('2026-10-26')
    expect(N.target.fund).toBe(0)
    const C = checks(R, N, 0.7)
    expect(C.fast).toBe(true)                          // from the 23 Oct close, same as the badge
    expect(C.fgap).toBeLessThan(-0.04)
  })

  it('Tuesday early morning, Monday\'s NAV not in yet: the Monday switch still shows, marked past', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T22:46:00Z'))   // Tue 27 Oct, 4:16 am in India
    const h = history(), R = replay(h, 0.7, WORDS_STOCKS)                      // NAVs to Fri 23 Oct only
    const N = nextDue(h, R, 0.7, WORDS_STOCKS)
    expect(N.date).toBe('2026-10-26')
    expect(N.past).toBe(true)
    expect(N.target.fund).toBe(0)
    vi.setSystemTime(new Date('2026-10-24T04:30:00Z'))                         // the same on Saturday: not past
    expect(nextDue(h, R, 0.7, WORDS_STOCKS).past).toBe(false)
  })

  it('mid-week with nothing due: the checks are the replay\'s own', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T04:30:00Z'))   // Thu 22 Oct
    const h = history(), n = h.times.findIndex((t) => t >= Date.parse('2026-10-22T00:00:00Z') / 1000)
    const hh = { times: h.times.slice(0, n), navs: h.navs.slice(0, n) }   // NAVs to Wed 21 Oct
    const R = replay(hh, 0.7, WORDS_STOCKS)
    expect(nextDue(hh, R, 0.7, WORDS_STOCKS)).toBe(null)
    expect(checks(R, null, 0.7).fgap).toBe(R.fgap)
  })
})

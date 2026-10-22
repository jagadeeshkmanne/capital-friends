import { describe, it, expect } from 'vitest'
import { isClosedPortfolio, openPortfolios } from './mfClosed'

const hs = [{ portfolioId: 'A', units: 10 }, { portfolioId: 'B', units: 0 }, { portfolioId: 'C', units: 0 }]
describe('closed mutual fund portfolios', () => {
  it('everything sold with a realized profit or loss: closed', () => {
    expect(isClosedPortfolio({ portfolioId: 'B', realizedPL: 2500 }, hs)).toBe(true)
    expect(isClosedPortfolio({ portfolioId: 'B', realizedPL: -800 }, hs)).toBe(true)
  })
  it('still holding something, or new with only planned funds: open', () => {
    expect(isClosedPortfolio({ portfolioId: 'A', realizedPL: 500 }, hs)).toBe(false)
    expect(isClosedPortfolio({ portfolioId: 'C', realizedPL: 0 }, hs)).toBe(false)
    expect(isClosedPortfolio({ portfolioId: 'D' }, hs)).toBe(false)
  })
  it('a sold fund with a target (planned to buy back) keeps the portfolio open', () => {
    expect(isClosedPortfolio({ portfolioId: 'E', realizedPL: 900 }, [{ portfolioId: 'E', units: 0, targetAllocationPct: 50 }])).toBe(false)
  })
  it('a new portfolio with an Initial Investment and nothing bought, or funds that did not load: open', () => {
    expect(isClosedPortfolio({ portfolioId: 'F', realizedPL: -50000, initialInvestment: 50000, totalInvestment: 50000 }, [{ portfolioId: 'F', units: 0 }])).toBe(false)
    expect(isClosedPortfolio({ portfolioId: 'G', realizedPL: 700 }, [])).toBe(false)
  })
  it('with transactions: closed only after a sale', () => {
    const p = { portfolioId: 'B', realizedPL: 2500 }
    expect(isClosedPortfolio(p, hs, [{ portfolioId: 'B', type: 'BUY' }])).toBe(false)
    expect(isClosedPortfolio(p, hs, [{ portfolioId: 'B', type: 'BUY' }, { portfolioId: 'B', type: 'SELL' }])).toBe(true)
  })
  it('openPortfolios leaves the closed ones out', () => {
    expect(openPortfolios([{ portfolioId: 'A' }, { portfolioId: 'B', realizedPL: 10 }, { portfolioId: 'C' }], hs).map((p) => p.portfolioId)).toEqual(['A', 'C'])
  })
})

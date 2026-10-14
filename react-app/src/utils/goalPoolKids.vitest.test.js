import { describe, it, expect } from 'vitest'
import { poolItems } from './goalPool'

describe('kids portfolios in Money for goals', () => {
  const base = { mfPortfolios: [{ portfolioId: 'A', portfolioName: 'Kid A', ownerName: 'Kid One' }, { portfolioId: 'B', portfolioName: 'Kid B', ownerName: 'Kid Two' }],
    mfHoldings: [{ portfolioId: 'A', currentValue: 100 }, { portfolioId: 'B', currentValue: 100 }], eqOf: () => 1, kidNames: ['Kid Two'], kidGoalNames: ['Kid One'] }
  it('child with a goal: counted unless unticked; child without: left out unless ticked', () => {
    const a = poolItems({ ...base, choice: { off: [], on: [] } })
    expect(a.find((x) => x.id === 'A')).toMatchObject({ kind: 'pool', kidGoal: true, included: true })
    expect(a.find((x) => x.id === 'B')).toMatchObject({ kind: 'out', kid: true, included: false })
    const b = poolItems({ ...base, choice: { off: ['A'], on: ['B'] } })
    expect(b.find((x) => x.id === 'A').included).toBe(false)
    expect(b.find((x) => x.id === 'B').included).toBe(true)
  })
})

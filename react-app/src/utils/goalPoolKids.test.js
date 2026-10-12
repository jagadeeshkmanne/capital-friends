import { describe, it, expect } from 'vitest'
import { poolItems } from './goalPool'

describe('kids money is left out by default', () => {
  const mfPortfolios = [{ portfolioId: 'P1', portfolioName: 'Mine', ownerName: 'Jagadeesh' }, { portfolioId: 'P2', portfolioName: 'Kid', ownerName: 'Sai' }]
  const mfHoldings = [{ portfolioId: 'P1', units: 1, currentValue: 100 }, { portfolioId: 'P2', units: 1, currentValue: 50 }]
  const eqOf = () => 1
  it('kid portfolio out unless switched on', () => {
    const a = poolItems({ mfPortfolios, mfHoldings, eqOf, kidNames: ['Sai'] })
    expect(a.find((i) => i.id === 'P2')).toMatchObject({ kind: 'out', kid: true, included: false })
    expect(a.find((i) => i.id === 'P1').included).toBe(true)
    const b = poolItems({ mfPortfolios, mfHoldings, eqOf, kidNames: ['Sai'], choice: { on: ['P2'] } })
    expect(b.find((i) => i.id === 'P2').included).toBe(true)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
vi.mock('../../context/DataContext', () => ({ useData: () => ({ updateSettings: async () => {}, goalList: [{ goalId: 'R', goalType: 'Retirement' }] }) }))
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }))
vi.mock('../../hooks/useMaskText', () => ({ useMaskText: () => (s) => s }))
import MoneyForGoals from './MoneyForGoals'
import { poolItems } from '../../utils/goalPool'

describe('Money for goals renders every group', () => {
  it('renders', () => {
    const other = [['FD', 'Fixed Deposit', 'Debt'], ['EPF', 'EPF', 'Debt'], ['HOME', 'Real Estate', 'Property'], ['G', 'Physical Gold', 'Gold'], ['RSU', 'ESOP / RSU', 'Equity'], ['EQ', 'Equity', 'Equity']]
      .map(([id, t, c]) => ({ investmentId: id, investmentType: t, investmentCategory: c, currentValue: 1e6, status: 'Active', investmentName: t }))
    const items = poolItems({ mfPortfolios: [{ portfolioId: 'MF1', portfolioName: 'Core', status: 'Active' }], mfHoldings: [{ portfolioId: 'MF1', units: 1, currentValue: 5e6 }], otherInvList: other, eqOf: () => 1 })
    const html = renderToString(<MoneyForGoals pool={{ items, choice: { on: [], off: [] } }} />)
    for (const t of ['Mutual funds', 'Cash, FDs and bonds', 'Other equity', 'You decide', 'For retirement only', 'Not used for goals']) expect(html).toContain(t)
    expect(html).toContain('Gold · not used for goals')
  })
})

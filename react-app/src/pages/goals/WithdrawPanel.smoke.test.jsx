import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
vi.mock('../../context/DataContext', () => ({ useData: () => ({
  mfPortfolios: [{ portfolioId: 'P1', ownerName: 'Visali', investmentAccountId: 'IA1' }], stockPortfolios: [],
  investmentAccounts: [{ accountId: 'IA1', platformBroker: 'Groww', memberName: 'Visali', bankAccountId: 'B1' }],
  banks: [{ accountId: 'B1', bankName: 'HDFC', accountType: 'Savings' }] }) }))
import WithdrawPanel from './WithdrawPanel'

describe('Withdraw panel: a step list by platform', () => {
  it('renders the platform, the bank and a tax note', () => {
    const rows = [
      { kind: 'mf', portfolioId: 'P1', name: 'Some Liquid Fund - Direct Growth', value: 300000, units: 100, holding: { fundCode: 'L1', units: 100, currentNav: 3000, avgNav: 2500, currentValue: 300000 } },
      { kind: 'other', name: 'Bank FD', value: 200000, holding: { investmentId: 'FD1', investmentType: 'Fixed Deposit', familyMemberName: 'Jagadeesh', currentValue: 200000 } },
    ]
    const s = { goal: { goalId: 'G', goalName: 'Car', targetAmount: 500000 }, rows, has: 500000 }
    const html = renderToString(<WithdrawPanel s={s} mt={(x) => x} pname={() => 'P1'} onDone={() => {}} onMoreTime={() => {}} />)
    expect(html).toContain('On Groww · Visali')
    expect(html).toContain('Money goes to HDFC (Savings)')
    expect(html).toContain('Deposits &amp; cash · Jagadeesh')
    expect(html).toContain('The app cannot sell for you')
    expect(html).toContain('Tax may apply')
  })
})

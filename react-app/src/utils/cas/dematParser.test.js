import { describe, it, expect } from 'vitest'
import { parseDematCas, readHoldingNumbers, shortBroker } from './dematParser'

// made-up statement in the CDSL CAS layout (no real person's data)
const CDSL = [
  'TEST PERSON ( PAN :ABCDE1234F )',
  'DP Name :DP का नाम:ALPHA BROKING LIMITEDALPHA BROKING LIMITED   BO ID :BO ID:12000000111122221200000011112222',
  'STATEMENT OF TRANSACTIONS FOR THE PERIOD FROM 01-08-2026 TO 31-08-2026',
  'No Transaction during the period',
  'HOLDING STATEMENT AS ON 31-08-2026',
  'ISIN   Security   Current Bal   Frozen Bal   Pledge Bal   Free Bal   Price   Value',
  'GMR AIRPORTS LIMITED - NEW',
  'INE776C01039   EQUITY SHARES OF RE. 1/-   100.000   --   --   --   100.000   93.8500   9,385.00',
  'AFTER SPLIT',
  'KERNEX MICROSYSTEMS',
  'INE202H01019   (INDIA) LIMITED - EQUITY   11.000   --   --   --   11.000 1737.6000   19,113.60',
  'HOLDING STATEMENT AS ON 31-08-2026 (Other Details)',
  'INF966L01986   LTD#QUANT MF-QUANT TAX   14-08-2028 ELSS2005   5.020   0.000   0.000',
  'Portfolio Value ` 28,498.60 as on 31-08-2026',
]

describe('CDSL / NSDL statement shares', () => {
  it('reads accounts and holdings, skipping the lock-in table', () => {
    const r = parseDematCas(CDSL)
    expect(r.pan).toBe('ABCDE1234F')
    expect(r.asOf).toBe('31-08-2026')
    expect(r.accounts).toHaveLength(1)
    const a = r.accounts[0]
    expect(a).toMatchObject({ broker: 'ALPHA BROKING LIMITED', dpId: '12000000', clientId: '11112222' })
    expect(a.holdings.map((h) => [h.isin, h.qty, h.price, h.value])).toEqual([['INE776C01039', 100, 93.85, 9385], ['INE202H01019', 11, 1737.6, 19113.6]])
  })
  it('finds the quantity when a face value comes first (NSDL layout)', () => {
    expect(readHoldingNumbers('RELIANCE INDUSTRIES 10.00 120 1,400.50 1,68,060.00')).toEqual({ qty: 120, price: 1400.5, value: 168060 })
  })
  it('short broker names', () => {
    expect(shortBroker('SHAREKHAN LIMITED')).toBe('Sharekhan')
    expect(shortBroker('GROWW INVEST TECH PRIVATE LIMITED')).toBe('Groww')
    expect(shortBroker('ZERODHA BROKING LIMITED')).toBe('Zerodha')
  })
})

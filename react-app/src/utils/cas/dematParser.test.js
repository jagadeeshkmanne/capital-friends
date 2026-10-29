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
  // made-up statements in the NSDL CAS layout: no "DP Name :" label, the account line is
  // "NSDL Demat Account  <BROKER>  DP ID:… Client ID:…", holdings under "Equity Shares" with a face value column
  const NSDL = [
    'Statement for the period from 01-Sep-2026 to 30-Sep-2026',
    'TEST PERSON (PAN:ABCDE1234F)',
    'NSDL Demat Account   ALPHA BROKING LIMITED   DP ID:IN300000 Client ID:11112222   3   45,000.00',
    'CDSL Demat Account   BETA SECURITIES PVT LTD   DP ID:12088700 Client ID:33334444   1   9,000.00',
    'Holdings in the demat account are as per the records of the depository. Demat account holders should check.',
    'NSDL Demat Account   ALPHA BROKING LIMITED   DP ID:IN300000 Client ID:11112222   ACCOUNT HOLDER',
    'Equity Shares',
    'ISIN   Stock Symbol   Company Name   Face Value   No. of Shares   Market Price   Value',
    'INE040A01034   HDFC BANK LIMITED   1.00   10   1,650.20   16,502.00',
    'HDFCBANK',
    'INE009A01021   INFOSYS LIMITED   5.00   20   1,424.90   28,498.00',
    'INFY',
    'Mutual Funds (M)',
    'INF179K01VC4   HDFC FLEXI CAP FUND   10.00   1.000   2,000.00   2,000.00',
    'CDSL Demat Account',
    'BETA SECURITIES PVT LTD   TEST PERSON (PAN:ABCDE1234F)',
    'DP ID:12088700 Client ID:33334444   SECOND HOLDER (PAN:XYZAB9876C)',
    'Equity Shares',
    'INE002A01018   RELIANCE INDUSTRIES LIMITED   10.00   6   1,500.00   9,000.00',
  ]
  it('reads an NSDL statement: accounts from the DP ID line, broker next to it, joint-holder header', () => {
    const r = parseDematCas(NSDL)
    expect(r.pan).toBe('ABCDE1234F')
    expect(r.asOf).toBe('30-Sep-2026')
    expect(r.accounts.map((a) => [a.depository, a.broker, a.dpId, a.clientId])).toEqual([
      ['NSDL', 'ALPHA BROKING LIMITED', 'IN300000', '11112222'],
      ['CDSL', 'BETA SECURITIES PVT LTD', '12088700', '33334444'],
    ])
    expect(r.accounts[0].holdings.map((h) => [h.isin, h.qty, h.price, h.value])).toEqual([['INE040A01034', 10, 1650.2, 16502], ['INE009A01021', 20, 1424.9, 28498]])
    expect(r.accounts[1].holdings.map((h) => [h.isin, h.qty])).toEqual([['INE002A01018', 6]])
  })
  it('an NSDL table that carries on after the account header repeats on the next page', () => {
    const r = parseDematCas([
      'NSDL Demat Account   ALPHA BROKING LIMITED   DP ID:IN300000 Client ID:11112222',
      'Equity Shares',
      'INE040A01034   HDFC BANK LIMITED   1.00   10   1,650.20   16,502.00',
      'NSDL Demat Account   ALPHA BROKING LIMITED   DP ID:IN300000 Client ID:11112222',
      'INE009A01021   INFOSYS LIMITED   5.00   20   1,424.90   28,498.00',
    ])
    expect(r.accounts).toHaveLength(1)
    expect(r.accounts[0].holdings).toHaveLength(2)
  })
  // made-up statement in the 2026 NSDL CAS layout: English and Hindi glued on one line, the PAN masked, the ISIN on
  // its own line with the name and numbers below it and the stock symbol under those (a long name wraps around them)
  const NSDL26 = [
    'In the Single Name ofएकमात्र नाम में',
    'TEST PERSON [ABXXXXXX1C]',
    'ALPHA BROKING LIMITED',
    'NSDL Demat AccountNSDL डीमैट खाता   5   57,100.00',
    'DP ID:IN300000 Client ID:11112222',
    'Totalकुल   57,100.00',
    'NSDL Demat AccountNSDL डीमैट खाता   ACCOUNT HOLDERखाता धारक',
    'ALPHA BROKING LIMITED   TEST PERSON (PAN: [ABXXXXXX1C])',
    'DP ID : IN300000 Client ID: 11112222',
    'Equities (E)इक्विटी (E)',
    'Equity Sharesइक्विटी शेयर',
    'ISINISIN   अंकित मूल्य (₹',
    'INE040A01034',
    'HDFC BANK LIMITED   1.00   10   1,650.00   16,500.00',
    'HDFCBANK.NSE',
    'INE335Y01020   INDIAN RAILWAY CATERING AND TOURISM',
    '2.00   20   700.00   14,000.00',
    'IRCTC.NSE   CORPORATION LIMITED',
    'INE0FS801015   MOTHERSON SUMI WIRING INDIA LIMITED   50',
    '1.00   40.00   2,000.00',
    'MSUMI.NSE   of which blocked   1',
    'INE752P01024',
    'TRADING   FUTURE RETAIL LIMITED   2.00   100   2.00   200.00',
    'SUSPENDED',
    'INE009A01021',
    'INFOSYS LIMITED   5.00   16   1,525.00   24,400.00',
    'INFY.NSE',
    'Sub TotalSub Total   57,100.00',
    'Preference Shares (P)प्रेफरेंस शेयर (P)',
    'INE494B04019   TVS MOTOR COMPANY LIMITED',
    '10.00   0   10.55   0.00',
    'Sub TotalSub Total   0.00',
    'Totalकुल   57,100.00',
  ]
  it('reads the 2026 NSDL layout: bilingual headings, masked PAN, wrapped names, symbol and suspended lines', () => {
    const r = parseDematCas(NSDL26)
    expect(r.holder).toBe('TEST PERSON')
    expect(r.pan).toBe('')   // masked: never kept as the PAN
    expect(r.accounts.map((a) => [a.depository, a.broker, a.dpId, a.clientId])).toEqual([['NSDL', 'ALPHA BROKING LIMITED', 'IN300000', '11112222']])
    expect(r.accounts[0].holdings.map((h) => [h.isin, h.name, h.qty, h.value, h.symbol || '', h.flag])).toEqual([
      ['INE040A01034', 'HDFC BANK LIMITED', 10, 16500, 'HDFCBANK', ''],
      ['INE335Y01020', 'INDIAN RAILWAY CATERING AND TOURISM CORPORATION LIMITED', 20, 14000, 'IRCTC', ''],
      ['INE0FS801015', 'MOTHERSON SUMI WIRING INDIA LIMITED', 50, 2000, 'MSUMI', ''],
      ['INE752P01024', 'FUTURE RETAIL LIMITED', 100, 200, '', 'suspended'],
      ['INE009A01021', 'INFOSYS LIMITED', 16, 24400, 'INFY', ''],
    ])
  })
  it('a CDSL account first listed on the summary page gets its broker from the "DP Name" line', () => {
    const r = parseDematCas([
      'TEST PERSON ( PAN :ABCDE1234F )',
      'CDSL Demat Account   1   9,385.00',
      'DP Id: 12000000 Client Id :11112222',
      'DP Name :DP का नाम:ALPHA BROKING LIMITEDALPHA BROKING LIMITED   BO ID :BO ID:12000000111122221200000011112222',
      'HOLDING STATEMENT AS ON 31-08-2026',
      'INE776C01039   EQUITY SHARES OF RE. 1/-   100.000   --   --   --   100.000   93.8500   9,385.00',
    ])
    expect(r.accounts).toHaveLength(1)
    expect(r.accounts[0]).toMatchObject({ broker: 'ALPHA BROKING LIMITED', dpId: '12000000', clientId: '11112222' })
    expect(r.accounts[0].holdings).toHaveLength(1)
  })
})

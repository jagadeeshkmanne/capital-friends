import { describe, it, expect } from 'vitest'
import { parseCSV, extractHoldings, buildStockIndex, matchStock, normalizeSymbol, toNumber } from './holdingsImport'

const stocks = [{ symbol: 'BHARTIARTL', isin: 'INE397D01024' }, { symbol: 'M&M', isin: 'INE101A01026' }, { symbol: 'CHOICEIN' }, { symbol: 'INFY', bseCode: '500209' }]
const idx = buildStockIndex(stocks)

describe('holdings import', () => {
  it('reads a Kite holdings.csv (Instrument, Qty., Avg. cost)', () => {
    const csv = 'Instrument,Qty.,Avg. cost,LTP\nBHARTIARTL,187,1316.54,1805.1\n"CHOICEIN",210,"222.64",713.1\n'
    const r = extractHoldings(parseCSV(csv))
    expect(r.items.map((i) => [i.sourceSymbol, i.quantity, i.avgPrice])).toEqual([['BHARTIARTL', 187, 1316.54], ['CHOICEIN', 210, 222.64]])
  })
  it('finds the header below preamble rows and prefers "Quantity Available"', () => {
    const rows = [['Client', 'X'], [], ['Symbol', 'ISIN', 'Quantity Discrepant', 'Quantity Available', 'Average Price'], ['M&M', 'INE101A01026', '0', '10', '1,500.00']]
    const r = extractHoldings(rows)
    expect(r.items[0]).toMatchObject({ sourceSymbol: 'M&M', quantity: 10, avgPrice: 1500 })
  })
  it('merges a symbol listed twice with a weighted average', () => {
    const r = extractHoldings([['Symbol', 'Qty', 'Avg Price'], ['INFY', '10', '100'], ['INFY', '30', '200']])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].quantity).toBe(40)
    expect(r.items[0].avgPrice).toBe(175)
  })
  it('puts rows without quantity or price aside instead of failing', () => {
    const r = extractHoldings([['Symbol', 'Qty', 'Avg Price'], ['INFY', '0', '100'], ['TCS', '', '']])
    expect(r.items).toHaveLength(0)
    expect(r.invalid).toHaveLength(2)
  })
  it('returns a clear error when the columns are missing', () => {
    expect(extractHoldings([['a', 'b'], ['1', '2']]).error).toMatch(/Symbol/)
  })
  it('matches by symbol, suffix-stripped symbol, ISIN and BSE code; unknown → null', () => {
    expect(matchStock({ sourceSymbol: 'NSE:BHARTIARTL' }, idx).symbol).toBe('BHARTIARTL')
    expect(matchStock({ sourceSymbol: 'INFY-BE' }, idx).symbol).toBe('INFY')
    expect(matchStock({ sourceSymbol: 'Bharti Airtel', isin: 'INE397D01024' }, idx).symbol).toBe('BHARTIARTL')
    expect(matchStock({ sourceSymbol: '500209' }, idx).symbol).toBe('INFY')
    expect(matchStock({ sourceSymbol: 'GOLDBEES' }, idx)).toBeNull()
  })
  it('cleans symbols and numbers', () => {
    expect(normalizeSymbol(' infy.ns ')).toBe('INFY')
    expect(toNumber('₹ 1,316.54')).toBe(1316.54)
  })
})

import { describe, it, expect } from 'vitest'
import { parseCSV } from './holdingsImport'
import { parseTradeHistory, parseIciciTransactionPdf, groupAccounts, summarize, zerodhaClientId, toTime, fyOf, sameName, fileChecks, missingPeriods } from './tradeHistoryImport'

// Groww order history (.xlsx, read into rows): Name / Unique Client Code above the table, header on its own row
const growwRows = [
  ['Name', 'Test Person'], ['Unique Client Code', '1234567890'], ['Order history for stocks from 01-04-2020 to 20-10-2026'],
  ['Stock name', 'Symbol', 'ISIN', 'Type', 'Quantity', 'Value', 'Exchange', 'Exchange Order Id', 'Execution date and time', 'Order status'],
  ['HDFC Bank', 'HDFCBANK', 'INE040A01034', 'BUY', '10', '15,000.00', 'NSE', '1100000001', '15-03-2023 10:15 AM', 'Executed'],
  ['HDFC Bank', 'HDFCBANK', 'INE040A01034', 'BUY', '10', '17,000', 'NSE', '1100000002', '20-06-2023 02:30 PM', 'Executed'],
  ['Infosys', 'INFY', 'INE009A01021', 'BUY', '5', '7000', 'NSE', '1100000003', '01-07-2023 09:20 AM', 'Cancelled'],
  ['HDFC Bank', 'HDFCBANK', 'INE040A01034', 'SELL', '15', '24000', 'NSE', '1100000004', '10-05-2024 11:00 AM', 'Executed'],
]
// Zerodha tradebook row from a real public example, plus synthetic rows
const zCsv = 'symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time\n'
  + 'HDFCBANK,INE040A01034,2020-08-14,NSE,EQ,EQ,buy,false,1.000000,1057.500000,27162479,1100000006155381,2020-08-14T11:49:19\n'
  + 'NIFTY24MAYFUT,,2024-05-02,NFO,FO,,buy,false,50,22500,999,998,2024-05-02T10:00:00\n'
  + 'HDFCBANK,INE040A01034,2021-09-01,NSE,EQ,EQ,sell,false,1,1550,27162480,1100000006155382,2021-09-01T13:05:00\n'

describe('trade history import', () => {
  it('reads a Groww order history: client code, name, executed orders only, price = value ÷ qty', () => {
    const r = parseTradeHistory(growwRows, 'Stocks_Order_History_1234567890.xlsx')
    expect(r.broker).toBe('Groww')
    expect(r.clientId).toBe('1234567890')
    expect(r.holderName).toBe('Test Person')
    expect(r.trades).toHaveLength(3)
    expect(r.trades[0]).toMatchObject({ date: '2023-03-15', time: '10:15', symbol: 'HDFCBANK', type: 'BUY', qty: 10, price: 1500, ref: '1100000001', refKind: 'order' })
    expect(r.trades[2]).toMatchObject({ type: 'SELL', price: 1600, time: '11:00' })
    expect(r.skipped).toEqual([expect.objectContaining({ symbol: 'INFY', reason: 'Order cancelled' })])
  })
  it('reads a Zerodha tradebook: equity only, client ID from the file name', () => {
    const r = parseTradeHistory(parseCSV(zCsv), 'tradebook-AB1234-EQ.csv')
    expect(r.broker).toBe('Zerodha')
    expect(r.clientId).toBe('AB1234')
    expect(r.trades.map((t) => [t.date, t.type, t.qty, t.price, t.ref])).toEqual([['2020-08-14', 'BUY', 1, 1057.5, '27162479'], ['2021-09-01', 'SELL', 1, 1550, '27162480']])
    expect(r.trades[0].time).toBe('11:49')
    expect(r.skipped[0].reason).toMatch(/Segment FO/)
  })
  it('rejects other files with a clear message', () => {
    expect(parseTradeHistory([['Date', 'Narration', 'Amount'], ['1', '2', '3']]).error).toMatch(/Groww order history or a Zerodha tradebook/)
  })
  it('merges yearly Zerodha files into one account and drops repeated trades', () => {
    const a = { ...parseTradeHistory(parseCSV(zCsv), 'tradebook-AB1234-EQ.csv'), fileName: 'y1.csv' }
    const b = { ...parseTradeHistory(parseCSV(zCsv), 'tradebook (1).csv'), fileName: 'y2.csv' }   // renamed: joins the only Zerodha account
    const g = { ...parseTradeHistory(growwRows), fileName: 'g.xlsx' }
    const accts = groupAccounts([a, b, g])
    expect(accts.map((x) => x.key).sort()).toEqual(['Groww|1234567890', 'Zerodha|AB1234'])
    const z = accts.find((x) => x.broker === 'Zerodha')
    expect(z.trades).toHaveLength(2)
    expect(z.repeats).toBe(2)
  })
  it('works out FIFO gains by financial year, short vs long term, and what is still held', () => {
    const s = summarize(parseTradeHistory(growwRows).trades)
    // sold 15: 10 @1500 (held > 1 year → long) + 5 @1700 (short), at 1600
    expect(s.realised).toBeCloseTo(10 * 100 + 5 * -100)
    expect(s.byFY).toEqual([{ fy: 'FY 2024-25', short: -500, long: 1000 }])
    expect(s.holdings).toEqual([expect.objectContaining({ qty: 5, avg: 1700, since: '2023-06-20', longTermFrom: '2024-06-21' })])
    expect(s.netIn).toBe(32000 - 24000)
    expect(s.shortfall).toEqual([])
  })
  it('flags shares sold that the file never bought (IPO, transfer, gift, bonus)', () => {
    const s = summarize([{ date: '2024-01-01', symbol: 'X', type: 'BUY', qty: 5, price: 10 }, { date: '2024-02-01', symbol: 'X', type: 'SELL', qty: 8, price: 12 }])
    expect(s.shortfall).toEqual([expect.objectContaining({ symbol: 'X', qty: 3 })])
    expect(s.holdings).toEqual([])
  })
  it('small helpers', () => {
    expect(zerodhaClientId('tradebook-XY9876-EQ.xlsx')).toBe('XY9876')
    expect(toTime('15 Mar 2024, 12:05 AM')).toBe('00:05')
    expect(toTime('2024-03-15T15:45:00')).toBe('15:45')
    expect(fyOf('2024-03-31')).toBe('FY 2023-24')
    expect(fyOf('2024-04-01')).toBe('FY 2024-25')
    expect(sameName('VISHNU K', 'Vishnu Kumar')).toBe(true)
    expect(sameName('Ravi Teja', 'Sita Devi')).toBe(false)
  })
  it('says which file to download when the wrong report is uploaded', () => {
    expect(parseTradeHistory([['Stock Name', 'ISIN', 'Quantity', 'Buy Date', 'Buy Price', 'Sell Date', 'Sell Price'], ['X', 'I', '1', '', '', '', '']]).error).toMatch(/P&L/)
    expect(parseTradeHistory([['Symbol', 'Quantity', 'Average Price'], ['INFY', '1', '1']]).error).toMatch(/holdings file/)
    const fo = 'symbol,isin,trade_date,exchange,segment,series,trade_type,quantity,price,trade_id,order_id,order_execution_time\nNIFTY24MAYFUT,,2024-05-02,NFO,FO,,buy,50,22500,9,8,2024-05-02T10:00:00\n'
    expect(parseTradeHistory(parseCSV(fo), 'tradebook-AB1234-FO.csv').error).toMatch(/segment Equity/)
  })
  it('checks the file covers up to today, flags gaps and a missing client ID', () => {
    const g = parseTradeHistory(growwRows)
    expect(g.range).toEqual({ from: '2020-04-01', to: '2026-10-20' })
    const [acct] = groupAccounts([{ ...g, fileName: 'g.xlsx' }])
    expect(fileChecks(acct, '2026-10-21')).toEqual([])
    expect(fileChecks(acct, '2026-12-01')[0].text).toMatch(/only goes up to 2026-10-20/)
    const [z] = groupAccounts([{ ...parseTradeHistory(parseCSV(zCsv), 'tradebook.csv'), fileName: 'tradebook.csv' }])
    const zc = fileChecks(z, '2021-10-01').map((c) => c.text).join(' | ')
    expect(zc).toMatch(/No trades between 2020-08-14 and 2021-09-01/)
    expect(zc).toMatch(/client ID is not in the file name/)
    // the missing year was uploaded before: no gap
    expect(fileChecks(z, '2021-10-01', ['2021-01-05']).map((c) => c.text).join(' | ')).not.toMatch(/No trades between/)
  })
  it('reads the Excel template / another broker\'s sheet: any column names we know, ISIN in the symbol column, value instead of price', () => {
    const rows = [
      ['Date', 'Buy/Sell', 'Symbol or ISIN', 'Quantity', 'Price', 'Broker', 'Order no.'],
      ['15-03-2023', 'Buy', 'HDFCBANK', '10', '1,500', 'ICICI Direct', ''],
      ['15-03-2023', 'Buy', 'HDFCBANK', '10', '1,500', 'ICICI Direct', ''],          // a second identical trade that day
      [45000, 'B', 'INE009A01021', '5', '1400', 'HDFC Securities', 'A-77'],
      ['20/06/2024', 'Sell', 'HDFCBANK', '15', '1600', 'ICICI Direct', ''],
      ['', 'Sell', 'TCS', '1', '1', '', ''],
    ]
    const r = parseTradeHistory(rows, 'my-trades.xlsx')
    expect(r.broker).toBe('Template')
    expect(r.trades.map((t) => [t.date, t.type, t.symbol, t.isin, t.qty, t.price, t.platform, t.refKind])).toEqual([
      ['2023-03-15', 'BUY', 'HDFCBANK', '', 10, 1500, 'ICICI Direct', 'row'],
      ['2023-03-15', 'BUY', 'HDFCBANK', '', 10, 1500, 'ICICI Direct', 'row'],
      ['2023-03-15', 'BUY', 'INE009A01021', 'INE009A01021', 5, 1400, 'HDFC Securities', 'order'],
      ['2024-06-20', 'SELL', 'HDFCBANK', '', 15, 1600, 'ICICI Direct', 'row'],
    ])
    expect(r.trades[0].ref).not.toBe(r.trades[1].ref)          // both identical rows are kept
    expect(r.skipped[0].reason).toMatch(/Date not readable/)
    const accts = groupAccounts([{ ...r, fileName: 'my-trades.xlsx' }])
    expect(accts.map((a) => [a.platform, a.trades.length])).toEqual([['ICICI Direct', 3], ['HDFC Securities', 1]])
    // the same file again: same references, so nothing doubles
    const again = parseTradeHistory(rows)
    expect(again.trades.map((t) => t.ref)).toEqual(r.trades.map((t) => t.ref))
    expect(parseTradeHistory([['Date', 'Amount', 'Value'], ['1', '2', '3']]).broker).toBeUndefined()
    const pasted = parseTradeHistory([['Trade Date', 'Transaction Type', 'Scrip', 'Qty', 'Net Amount'], ['01-02-2024', 'Purchase', 'INFY', '2', '3000']])
    expect(pasted.trades[0]).toMatchObject({ type: 'BUY', symbol: 'INFY', price: 1500 })
    expect(parseTradeHistory([['Date', 'Buy/Sell', 'Symbol or ISIN', 'Quantity', 'Price']]).error).toMatch(/no trades yet/)
  })
  it('reads an ICICI Direct order book export: broker and demat account from the file, 2-digit years', () => {
    const csv = '\ufeffDate,Stock,Action,Qty,Price,Trade Value,Order Ref.,Settlement,Segment,DP Id - Client DP Id,Exchange,STT,Transaction and SEBI Turnover charges,Stamp Duty,Brokerage + Service Tax,Brokerage Incl. Taxes\n'
      + '"19-Oct-26","ICICIBANK","Buy","10","1405","14050","20261019N900006350","2026197","Rolling T1","IN300000-11112222","NSE","14","0.45","2","48.16","64.61"\n'
      + '"16-Oct-26","HFCL","Sell","100","256","25600","20261016T200019626","2026196","TT T1","IN300000-11112222","NSE","25.6","0.81","0","87.75","114.16"\n'
    const r = parseTradeHistory(parseCSV(csv.replace(/^\ufeff/, '')), 'orderBook_Equity_1.csv')
    expect(r.broker).toBe('Template')
    expect(r.trades.map((t) => [t.date, t.type, t.symbol, t.qty, t.price, t.ref, t.platform, t.dpId, t.clientId])).toEqual([
      ['2026-10-19', 'BUY', 'ICICIBANK', 10, 1405, '20261019N900006350', 'ICICI Direct', 'IN300000', '11112222'],
      ['2026-10-16', 'SELL', 'HFCL', 100, 256, '20261016T200019626', 'ICICI Direct', 'IN300000', '11112222'],
    ])
    const [a] = groupAccounts([{ ...r, fileName: 'orderBook_Equity_1.csv' }])
    expect([a.platform, a.clientId, a.dpId, a.trades.length]).toEqual(['ICICI Direct', '11112222', 'IN300000', 2])
  })
  it('reads an ICICI Securities quarterly Equity Transaction Statement (PDF text lines, made-up data)', () => {
    const lines = [
      'ICICI Securities Limited', 'MEMBER BOMBAY STOCK EXCHANGE LIMITED.', 'To,', 'ICCL CODE NO. 103', 'TEST PERSON KUMAR', 'SEBI REGN. NO.:   INZ000183631',
      'UNIQUE CLIENT CODE :   1234567890', 'Equity Transaction Statement from 01-Jan-2020 to 31-Mar-2020',
      'ISEC/2020051/10814   12-03-2020   12-03-2020',
      '2020051   NSE   1200000011291941   53314779   16-03-2020   INE805C01028   KCP LTD   B   50   50.00   2500.00   25.00   4.51   2529.51',
      '458   13:49:00   13:49',
      'ISEC/2020060/11111   20-03-2020   23-03-2020',
      '2020060   BSE   1200000011299999   53319999   25-03-2020   INE002A01018   RELIANCE INDUSTRIES LTD   S   2   1,105.50   2211.00   22.11   3.98   2184.91',
      '459   10:05:00   10:05',
      '12-03-2020   ISEC/2020051/1081   NSE   2020051   16-03-2020   3   0.05   0.50   Net amount payable by Client Rs. 2533.06',
    ]
    const r = parseIciciTransactionPdf(lines)
    expect([r.clientId, r.holderName, r.range]).toEqual(['1234567890', 'TEST PERSON KUMAR', { from: '2020-01-01', to: '2020-03-31' }])
    expect(r.trades.map((t) => [t.date, t.time, t.isin, t.type, t.qty, t.price, t.exchange, t.ref, t.platform])).toEqual([
      ['2020-03-12', '13:49', 'INE805C01028', 'BUY', 50, 50, 'NSE', '53314779', 'ICICI Direct'],
      ['2020-03-23', '10:05', 'INE002A01018', 'SELL', 2, 1105.5, 'BSE', '53319999', 'ICICI Direct'],
    ])
    expect(r.skipped).toEqual([])
    expect(parseIciciTransactionPdf(['NSDL Demat Account', 'INE040A01034 HDFC BANK 1 2 3'])).toBe(null)
    const [a] = groupAccounts([{ ...r, fileName: 'TRX-Equity_q1.PDF' }, { ...r, fileName: 'TRX-Equity_q1 (copy).PDF' }])
    expect([a.platform, a.clientId, a.trades.length, a.repeats]).toEqual(['ICICI Direct', '1234567890', 2, 2])
  })
  it('finds the periods no statement covers (quarterly and yearly statements mixed, overlaps fine)', () => {
    const r = (from, to) => ({ from, to })
    expect(missingPeriods([r('2019-04-01', '2020-03-31'), r('2020-01-01', '2020-03-31'), r('2020-04-01', '2021-03-31'), r('2021-04-01', '2021-06-30'), r('2021-07-01', '2021-09-30'), r('2022-04-01', '2023-03-31')]))
      .toEqual([{ from: '2021-10-01', to: '2022-03-31' }])
    expect(missingPeriods([r('2024-01-01', '2024-03-31'), r('2024-04-01', '2024-06-30')])).toEqual([])
  })
})

// Background job check for gas-webapp/IncomePlan.js (monthly income deduction + refill Mark done).
// Run: node tests/income-plan/run.js
const assert = require('assert')
const fs = require('fs'); const vm = require('vm')
const ctx = { console, Date, JSON, Math, Number, String, Object, Array,
  LockService: { getUserLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10) },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' }, log: () => {}, formatCurrency: (v) => '₹' + v }
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../../gas-webapp/IncomePlan.js'), 'utf8'), ctx)
let settings, inv
ctx.getAllSettings = () => ({ ...settings }); ctx.getSetting = (k) => settings[k]
ctx.updateSetting = (k, v) => { settings[k] = v }
ctx.getInvestmentById = (id) => inv[id] ? { ...inv[id] } : null
ctx.processEditInvestment = (d) => { inv[d.investmentId].currentValue = d.currentValue; return { success: true } }
const reset = (cv) => { settings = { 'IncomePlan:G1': JSON.stringify({ start: '2026-11', day: 1, sources: [{ kind: 'cash', ref: 'S1', name: 'Savings', amount: 30000 }, { kind: 'swp', ref: 'P::L', amount: 10000 }] }) }; inv = { S1: { investmentId: 'S1', investmentType: 'Cash / Savings', currentValue: cv, status: 'Active', notes: 'keep me' } } }
reset(100000)
let r = ctx.applyMonthlyIncome({ today: '2027-01-05T10:00:00' })
assert.strictEqual(JSON.stringify(r.applied.map(a => a.amount)), '[30000,30000,30000]'); assert.strictEqual(inv.S1.currentValue, 10000); assert.strictEqual(inv.S1.notes, 'keep me')
console.log('3 months caught up:', r.applied.map(a => a.month + ':' + a.amount).join(' '), '| balance', inv.S1.currentValue)
r = ctx.applyMonthlyIncome({ today: '2027-01-20T10:00:00' })
assert.strictEqual(r.applied.length, 0)
console.log('rerun same month applies nothing:', r.applied.length, '| balance', inv.S1.currentValue)
r = ctx.applyMonthlyIncome({ today: '2027-02-02T10:00:00' })
assert.strictEqual(r.applied[0].short, 20000); assert.strictEqual(inv.S1.currentValue, 0)
console.log('Feb with ₹10,000 left:', JSON.stringify(r.applied[0]), '| balance', inv.S1.currentValue)
delete inv.S1; r = ctx.applyMonthlyIncome({ today: '2027-03-02T10:00:00' })
assert.ok(r.applied[0].skip)
console.log('source removed:', JSON.stringify(r.applied[0]))
reset(500000); r = ctx.markRefillDone({ goalId: 'G1', at: '2027-01-20', ops: [{ from: 'b2', to: 'b1', amount: 200000, toRef: 'S1' }, { from: 'b3', to: 'b2', amount: 100000 }] })
assert.strictEqual(inv.S1.currentValue, 700000)
console.log('refill done:', JSON.stringify(r), '| savings now', inv.S1.currentValue, '| log', settings['RefillLog:G1'])


// ── Action required: refill due / income low / FD matured, and the once-only alert email ──
let mails = []
ctx.GmailApp = { sendEmail: (to, subject, body, o) => mails.push({ to, subject }) }
ctx.getEmailRecipients = () => [{ email: 'a@x.com' }, { email: 'b@x.com' }]
ctx.getAllGoals = () => [{ goalId: 'G1', goalName: 'Retirement', goalType: 'Retirement', isActive: true, targetDate: '2025-01-15T00:00:00.000Z' }]
ctx.getAllInvestments = () => Object.values(inv)
reset(60000) // ₹60,000 left at ₹30,000 a month: 2 months
inv.FD1 = { investmentId: 'FD1', investmentType: 'Fixed Deposit', investmentName: 'SBI FD', status: 'Active', currentValue: 500000, dynamicFields: { maturityDate: '2027-01-10' } }
let items = ctx.bucketActionItems_(new Date('2027-02-01T10:00:00'))
assert.ok(items.some(i => /yearly bucket refill/.test(i.title)), 'yearly refill due (15 Jan, not marked done)')
assert.ok(items.some(i => i.type === 'critical' && /about 2 months of income left/.test(i.description)), 'income low')
assert.ok(items.some(i => /SBI FD has matured/.test(i.title)), 'FD matured')
const origItems = ctx.bucketActionItems_
ctx.bucketActionItems_ = () => origItems(new Date('2027-02-01T10:00:00')) // same open actions on every day of this test
ctx.sendBucketAlerts_(new Date('2027-02-01T10:00:00'))
assert.strictEqual(mails.length, 2); assert.ok(/^Action needed today: /.test(mails[0].subject))
mails = []; ctx.sendBucketAlerts_(new Date('2027-02-01T18:00:00'))
assert.strictEqual(mails.length, 0, 'not again the same day')
mails = []; let rr = ctx.sendBucketAlerts_(new Date('2027-02-04T10:00:00'))
assert.strictEqual(mails.length, 2, 'critical: reminder after 3 days'); assert.ok(/^Reminder: Action needed today: /.test(mails[0].subject)); assert.strictEqual(rr.items, 1)
mails = []; rr = ctx.sendBucketAlerts_(new Date('2027-02-08T10:00:00'))
assert.strictEqual(rr.items, 3, 'after 7 days: the warnings too (critical again as well)')
// marked done after the yearly date: the yearly item goes away
settings['RefillLog:G1'] = JSON.stringify([{ at: '2027-01-20', ops: [{ from: 'b2', to: 'b1', amount: 600000 }] }])
assert.ok(!ctx.bucketActionItems_().some(i => /yearly/.test(i.title)))
// the app's saved list (with amounts) is used, and dropped once a refill is marked done after it
settings['BucketActions:G1'] = JSON.stringify({ at: '2027-03-01T00:00:00Z', items: [{ code: 'refill', type: 'warning', title: 'Retirement: refill your buckets', description: 'Growth → Stability ₹7.50 L.' }] })
assert.ok(ctx.bucketActionItems_().some(i => /refill your buckets/.test(i.title)))
settings['RefillLog:G1'] = JSON.stringify([{ at: '2027-03-05', ops: [{ from: 'b3', to: 'b2', amount: 750000 }] }])
assert.ok(!ctx.bucketActionItems_().some(i => /refill your buckets/.test(i.title)))
console.log('action required: ok')

// ── keep Income real: CAS import reminder for SWPs, savings balance check every 3 months ──
ctx.bucketActionItems_ = origItems
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
ctx.Utilities.formatDate = (d, tz, f) => f === 'yyyy-MM' ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : f === 'd MMM yyyy' ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
settings = { 'IncomePlan:G1': JSON.stringify({ start: '2026-11', day: 1, sources: [{ kind: 'cash', ref: 'S1', name: 'HDFC savings', amount: 30000 }, { kind: 'swp', ref: 'P1::L1', name: 'Liquid A', amount: 10000 }] }) }
inv = { S1: { investmentId: 'S1', investmentType: 'Cash / Savings', currentValue: 2000000, status: 'Active' } }
ctx.getAllInvestments = () => Object.values(inv)
ctx.getAllMFTransactions = () => [{ portfolioId: 'P1', fundCode: 'L1', type: 'SELL', date: '01/11/2026' }]
for (const day of ['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']) ctx.applyMonthlyIncome({ today: day + 'T10:00:00' }) // the app deducts each month, nothing typed
let it2 = ctx.bucketActionItems_(new Date('2027-02-10T10:00:00'))
assert.ok(it2.some(i => /import your CAS/.test(i.title) && /estimated since 1 Nov 2026/.test(i.description)), 'CAS not imported for 60+ days')
assert.ok(it2.some(i => /check your savings balance/.test(i.title) && /Since 1 Nov 2026/.test(i.description)), '3 months of auto deductions, balance never typed')
// she types the real balance from her bank: the check goes away and counts 3 months from then
inv.S1.currentValue = 1905000; inv.S1.lastUpdated = '15/02/2027'
assert.ok(!ctx.bucketActionItems_(new Date('2027-02-16T10:00:00')).some(i => /check your savings/.test(i.title)))
ctx.applyMonthlyIncome({ today: '2027-03-01T10:00:00' })
assert.strictEqual(settings['BalanceChecked:S1'], '2027-02-15')
inv.S1.lastUpdated = '01/03/2027' // the March deduction saved it
assert.ok(!ctx.bucketActionItems_(new Date('2027-04-10T10:00:00')).some(i => /check your savings/.test(i.title)), 'less than 3 months since she typed it')
assert.ok(ctx.bucketActionItems_(new Date('2027-05-20T10:00:00')).some(i => /check your savings/.test(i.title) && /Since 15 Feb 2027/.test(i.description)))
console.log('keep income real: ok')

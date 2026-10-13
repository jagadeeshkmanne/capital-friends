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
console.log('ok')

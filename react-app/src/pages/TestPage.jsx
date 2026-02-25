import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../services/api'

// Generate unique test identifiers to avoid conflicts
function uniqueId() { return Date.now().toString(36).toUpperCase() }
function randomPAN() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const r = (n) => Array.from({ length: n }, () => letters[Math.floor(Math.random() * 26)]).join('')
  return r(5) + Math.floor(1000 + Math.random() * 9000) + r(1)
}
function randomAadhar() {
  return String(Math.floor(200000000000 + Math.random() * 800000000000))
}
function randomPhone() {
  return '9' + String(Math.floor(100000000 + Math.random() * 900000000))
}
function randomAcctNum() {
  return String(Math.floor(1000000000 + Math.random() * 9000000000))
}

// Test data factory — generates fresh unique data each run
function makeTestData() {
  const uid = uniqueId()
  return {
    member: {
      memberName: `Test Member ${uid}`,
      relationship: 'Self',
      pan: randomPAN(),
      aadhar: randomAadhar(),
      email: `test-${uid.toLowerCase()}@example.com`,
      mobile: randomPhone(),
      includeInEmailReports: true,
    },
    bank: {
      // memberId filled dynamically at test time
      accountName: `Test Savings ${uid}`,
      bankName: 'Test Bank',
      accountNumber: randomAcctNum(),
      ifscCode: 'TEST0001234',
      accountType: 'Savings',
      branchName: 'Test Branch',
    },
    investmentAccount: {
      // memberId & bankAccountId filled dynamically at test time
      accountName: `Test Demat ${uid}`,
      accountType: 'Demat',
      platformBroker: 'Test Broker Platform',
      accountClientId: `CLI-${uid}`,
      registeredEmail: `test-${uid.toLowerCase()}@example.com`,
      registeredPhone: randomPhone(),
    },
    insurance: {
      // memberId & insuredMember filled dynamically at test time
      policyType: 'Term Life',
      company: 'Test Insurance Co',
      policyNumber: `POL-${uid}`,
      policyName: `Test Term Plan ${uid}`,
      sumAssured: 5000000,
      nominee: 'Test Nominee',
      dynamicFields: { Premium: 15000, 'Premium Frequency': 'Annual' },
    },
    liability: {
      // familyMember filled dynamically at test time
      liabilityType: 'Home Loan',
      lenderName: 'Test Bank',
      outstandingBalance: 4500000,
      dynamicFields: { 'Principal Amount': 5000000, 'Interest Rate': 8.5, 'EMI Amount': 45000 },
      notes: `Test liability ${uid}`,
    },
    otherInvestment: {
      // familyMember filled dynamically at test time
      investmentType: 'Fixed Deposit',
      investmentName: `Test FD ${uid}`,
      investedAmount: 100000,
      currentValue: 105000,
      investmentCategory: 'Debt',
    },
    stockPortfolio: {
      // owner filled dynamically at test time
      portfolioName: `Test Stock Portfolio ${uid}`,
      broker: 'Test Broker',
    },
    reminder: {
      title: `Test Reminder ${uid}`,
      description: 'Automated test reminder',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category: 'Insurance',
      priority: 'Medium',
    },
    goal: {
      goalName: `Test Goal ${uid}`,
      goalType: 'Custom',
      targetAmount: 1000000,
      targetDate: '2040-01-01',
      priority: 'Medium',
      expectedInflation: 0.06,
      expectedCAGR: 0.12,
    },
  }
}

// Status badge component
function Badge({ status, text }) {
  const colors = {
    pass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    fail: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    skip: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colors[status] || colors.pending}`}>
      {text || status.toUpperCase()}
    </span>
  )
}

export default function TestPage() {
  const { user } = useAuth()
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)
  const [diagData, setDiagData] = useState(null)
  const [diagLoading, setDiagLoading] = useState(false)

  // Add test result
  const addResult = useCallback((test, status, detail = '') => {
    setResults(prev => [...prev, { test, status, detail, time: new Date().toLocaleTimeString() }])
  }, [])

  // Update last result
  const updateLastResult = useCallback((status, detail = '') => {
    setResults(prev => {
      const copy = [...prev]
      if (copy.length > 0) {
        copy[copy.length - 1] = { ...copy[copy.length - 1], status, detail }
      }
      return copy
    })
  }, [])

  // Run diagnostics
  const runDiagnostics = async () => {
    setDiagLoading(true)
    setDiagData(null)
    try {
      const data = await api.callAPI('test:diagnose')
      setDiagData(data)
    } catch (err) {
      setDiagData({ error: err.message })
    } finally {
      setDiagLoading(false)
    }
  }

  // Run all tests
  const runAllTests = async () => {
    setRunning(true)
    setResults([])

    // Generate fresh unique test data for this run
    const TD = makeTestData()

    let memberId = null
    let memberName = null
    let bankAccountId = null
    let investmentAccountId = null
    let insurancePolicyId = null
    let liabilityId = null
    let otherInvestmentId = null
    let stockPortfolioId = null
    let reminderId = null
    let goalId = null

    try {
      // ═══════════════════════════════════════════════════════
      // 1. ECHO TEST
      // ═══════════════════════════════════════════════════════
      addResult('API Echo Test', 'running')
      try {
        const echo = await api.callAPI('test:echo', { hello: 'world' })
        if (echo && echo.echo && echo.echo.hello === 'world') {
          updateLastResult('pass', 'Echo response received correctly')
        } else {
          updateLastResult('fail', 'Unexpected response: ' + JSON.stringify(echo))
        }
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 2. DIAGNOSTICS
      // ═══════════════════════════════════════════════════════
      addResult('Diagnostics', 'running')
      try {
        const diag = await api.callAPI('test:diagnose')
        const missingSheets = Object.entries(diag.sheets || {})
          .filter(([, v]) => !v.exists)
          .map(([k]) => k)
        if (missingSheets.length > 0) {
          updateLastResult('fail', `Missing sheets: ${missingSheets.join(', ')}`)
        } else {
          const sheetCount = Object.keys(diag.sheets).length
          updateLastResult('pass', `All ${sheetCount} sheets exist. SpreadsheetId: ${diag.spreadsheetId}`)
        }
        // Check for data function errors
        const dataErrors = Object.entries(diag.dataTests || {})
          .filter(([, v]) => !v.success)
          .map(([k, v]) => `${k}: ${v.error}`)
        if (dataErrors.length > 0) {
          addResult('Data Function Errors', 'fail', dataErrors.join('; '))
        }
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 3. LOAD ALL DATA
      // ═══════════════════════════════════════════════════════
      addResult('Load All Data (bulk)', 'running')
      try {
        const all = await api.loadAllData()
        const counts = Object.entries(all).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : '?'}`)
        updateLastResult('pass', counts.join(', '))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 4. FAMILY MEMBERS CRUD
      // ═══════════════════════════════════════════════════════
      // Create
      addResult('Members → Create', 'running')
      try {
        const result = await api.createMember(TD.member)
        memberId = result?.memberId
        memberName = TD.member.memberName
        if (memberId) {
          updateLastResult('pass', `Created: ${memberId}`)
        } else {
          updateLastResult('fail', 'No memberId returned: ' + JSON.stringify(result))
        }
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // List
      addResult('Members → List', 'running')
      try {
        const list = await api.getMembers()
        const found = Array.isArray(list) && list.some(m => m.memberId === memberId)
        if (found) {
          updateLastResult('pass', `Found ${memberId} in ${list.length} member(s)`)
        } else {
          updateLastResult('fail', `Member ${memberId} not found. Got ${Array.isArray(list) ? list.length : 0} members: ${JSON.stringify(list).substring(0, 200)}`)
        }
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // Update
      if (memberId) {
        addResult('Members → Update', 'running')
        try {
          await api.updateMember({ ...TD.member, memberId, memberName: 'Updated Test Member' })
          memberName = 'Updated Test Member'
          updateLastResult('pass', 'Updated name to "Updated Test Member"')
        } catch (e) {
          updateLastResult('fail', e.message)
        }
      }

      // ═══════════════════════════════════════════════════════
      // 5. BANK ACCOUNTS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Banks → Create', 'running')
      try {
        const result = await api.createBank({ ...TD.bank, memberId: memberId || 'FM-001' })
        bankAccountId = result?.accountId
        updateLastResult(bankAccountId ? 'pass' : 'fail', bankAccountId ? `Created: ${bankAccountId}` : 'No accountId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Banks → List', 'running')
      try {
        const list = await api.getBanks()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} account(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 6. INVESTMENT ACCOUNTS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Investment Accounts → Create', 'running')
      try {
        const result = await api.createInvestmentAccount({
          ...TD.investmentAccount,
          memberId: memberId || 'FM-001',
          bankAccountId: bankAccountId || 'BA-001',
        })
        investmentAccountId = result?.accountId
        updateLastResult(investmentAccountId ? 'pass' : 'fail', investmentAccountId ? `Created: ${investmentAccountId}` : 'No accountId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Investment Accounts → List', 'running')
      try {
        const list = await api.getInvestmentAccounts()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} account(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 7. INSURANCE CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Insurance → Create', 'running')
      try {
        const result = await api.createInsurance({
          ...TD.insurance,
          memberId: memberId || 'FM-001',
          insuredMember: memberName || 'Test Member',
        })
        insurancePolicyId = result?.policyId
        updateLastResult(insurancePolicyId ? 'pass' : 'fail', insurancePolicyId ? `Created: ${insurancePolicyId}` : 'No policyId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Insurance → List', 'running')
      try {
        const list = await api.getInsurance()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} policy/policies`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 8. LIABILITIES CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Liabilities → Create', 'running')
      try {
        const result = await api.createLiability({
          ...TD.liability,
          familyMember: memberId || 'FM-001',
        })
        liabilityId = result?.liabilityId
        updateLastResult(liabilityId ? 'pass' : 'fail', liabilityId ? `Created: ${liabilityId}` : 'No liabilityId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Liabilities → List', 'running')
      try {
        const list = await api.getLiabilities()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} liability/liabilities`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 9. OTHER INVESTMENTS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Other Investments → Create', 'running')
      try {
        const result = await api.createOtherInvestment({
          ...TD.otherInvestment,
          familyMember: memberId || 'FM-001',
        })
        otherInvestmentId = result?.investmentId
        updateLastResult(otherInvestmentId ? 'pass' : 'fail', otherInvestmentId ? `Created: ${otherInvestmentId}` : 'No investmentId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Other Investments → List', 'running')
      try {
        const list = await api.getOtherInvestments()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} investment(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 10. STOCK PORTFOLIOS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Stock Portfolios → Create', 'running')
      try {
        const result = await api.createStockPortfolio({
          ...TD.stockPortfolio,
          owner: memberId || 'FM-001',
        })
        stockPortfolioId = result?.portfolioId
        updateLastResult(stockPortfolioId ? 'pass' : 'fail', stockPortfolioId ? `Created: ${stockPortfolioId}` : 'No portfolioId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Stock Portfolios → List', 'running')
      try {
        const list = await api.getStockPortfolios()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} portfolio(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 11. REMINDERS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Reminders → Create', 'running')
      try {
        const result = await api.createReminder(TD.reminder)
        reminderId = result?.reminderId
        updateLastResult(reminderId ? 'pass' : 'fail', reminderId ? `Created: ${reminderId}` : 'No reminderId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Reminders → List', 'running')
      try {
        const list = await api.getReminders()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} reminder(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 12. GOALS CRUD
      // ═══════════════════════════════════════════════════════
      addResult('Goals → Create', 'running')
      try {
        const result = await api.createGoal(TD.goal)
        goalId = result?.goalId
        updateLastResult(goalId ? 'pass' : 'fail', goalId ? `Created: ${goalId}` : 'No goalId: ' + JSON.stringify(result))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      addResult('Goals → List', 'running')
      try {
        const list = await api.getGoals()
        updateLastResult('pass', `${Array.isArray(list) ? list.length : 0} goal(s)`)
      } catch (e) {
        updateLastResult('fail', e.message)
      }

      // ═══════════════════════════════════════════════════════
      // 13. CLEANUP — DELETE TEST DATA
      // ═══════════════════════════════════════════════════════
      addResult('Cleanup — Delete test data', 'running')
      const cleanupErrors = []

      if (goalId) {
        try { await api.deleteGoal(goalId) } catch (e) { cleanupErrors.push('goal: ' + e.message) }
      }
      if (reminderId) {
        try { await api.deleteReminder(reminderId) } catch (e) { cleanupErrors.push('reminder: ' + e.message) }
      }
      if (stockPortfolioId) {
        try { await api.deleteStockPortfolio(stockPortfolioId) } catch (e) { cleanupErrors.push('stockPortfolio: ' + e.message) }
      }
      if (otherInvestmentId) {
        try { await api.deleteOtherInvestment(otherInvestmentId) } catch (e) { cleanupErrors.push('otherInv: ' + e.message) }
      }
      if (liabilityId) {
        try { await api.deleteLiability(liabilityId) } catch (e) { cleanupErrors.push('liability: ' + e.message) }
      }
      if (insurancePolicyId) {
        try { await api.deleteInsurance(insurancePolicyId) } catch (e) { cleanupErrors.push('insurance: ' + e.message) }
      }
      if (investmentAccountId) {
        try { await api.deleteInvestmentAccount(investmentAccountId) } catch (e) { cleanupErrors.push('invAcct: ' + e.message) }
      }
      if (bankAccountId) {
        try { await api.deleteBank(bankAccountId) } catch (e) { cleanupErrors.push('bank: ' + e.message) }
      }
      if (memberId) {
        try { await api.deleteMember(memberId) } catch (e) { cleanupErrors.push('member: ' + e.message) }
      }

      if (cleanupErrors.length > 0) {
        updateLastResult('fail', cleanupErrors.join('; '))
      } else {
        updateLastResult('pass', 'All test data cleaned up')
      }

      // ═══════════════════════════════════════════════════════
      // 14. FINAL LOAD ALL (verify clean state)
      // ═══════════════════════════════════════════════════════
      addResult('Final Load All (post-cleanup)', 'running')
      try {
        const all = await api.loadAllData()
        const counts = Object.entries(all).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : '?'}`)
        updateLastResult('pass', counts.join(', '))
      } catch (e) {
        updateLastResult('fail', e.message)
      }

    } catch (e) {
      addResult('UNEXPECTED ERROR', 'fail', e.message)
    } finally {
      setRunning(false)
    }
  }

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length
  const totalCount = results.filter(r => r.status !== 'running').length

  return (
    <div className="min-h-screen bg-[var(--bg-main)] p-4 max-w-3xl mx-auto">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">API Test Suite</h1>
            <p className="text-xs text-[var(--text-dim)]">
              Signed in as {user?.email || 'unknown'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runDiagnostics}
              disabled={diagLoading || running}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 cursor-pointer"
            >
              {diagLoading ? 'Running...' : 'Diagnostics'}
            </button>
            <button
              onClick={runAllTests}
              disabled={running}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
            >
              {running ? 'Running Tests...' : 'Run All Tests'}
            </button>
          </div>
        </div>

        {/* Summary */}
        {totalCount > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">Pass: {passCount}</span>
            <span className="text-rose-400">Fail: {failCount}</span>
            <span className="text-[var(--text-dim)]">Total: {totalCount}</span>
          </div>
        )}

        {/* Diagnostics Panel */}
        {diagData && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Diagnostics Report</h2>
            {diagData.error ? (
              <p className="text-xs text-rose-400">{diagData.error}</p>
            ) : (
              <>
                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                  <p><span className="text-[var(--text-dim)]">Spreadsheet:</span> {diagData.spreadsheetName}</p>
                  <p><span className="text-[var(--text-dim)]">ID:</span> <code className="text-[10px]">{diagData.spreadsheetId}</code></p>
                </div>

                {/* Sheets */}
                <div>
                  <h3 className="text-xs font-medium text-[var(--text-primary)] mb-1">Sheets</h3>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(diagData.sheets || {}).map(([name, info]) => (
                      <div key={name} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-[var(--bg-elevated)]">
                        <span className="text-[var(--text-secondary)] truncate">{name}</span>
                        {info.exists ? (
                          <span className="text-emerald-400 ml-1">{info.dataRows}r</span>
                        ) : (
                          <span className="text-rose-400 ml-1">MISSING</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Tests */}
                <div>
                  <h3 className="text-xs font-medium text-[var(--text-primary)] mb-1">Data Functions</h3>
                  <div className="space-y-1">
                    {Object.entries(diagData.dataTests || {}).map(([name, info]) => (
                      <div key={name} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-[var(--bg-elevated)]">
                        <span className="text-[var(--text-secondary)]">{name}</span>
                        {info.success ? (
                          <span className="text-emerald-400">{info.count} items</span>
                        ) : (
                          <span className="text-rose-400 truncate ml-2 max-w-[200px]" title={info.error}>{info.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SafeCall Errors */}
                {diagData.safeCallErrors && diagData.safeCallErrors.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-rose-400 mb-1">SafeCall Errors</h3>
                    {diagData.safeCallErrors.map((err, i) => (
                      <p key={i} className="text-[11px] text-rose-400">{err.fn}: {err.error}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Test Results */}
        {results.length > 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {results.map((r, i) => (
                <div key={i} className="px-4 py-2 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Badge status={r.status} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)]">{r.test}</p>
                    {r.detail && (
                      <p className="text-[11px] text-[var(--text-dim)] mt-0.5 break-all">{r.detail}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-dim)] shrink-0">{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !diagData && (
          <div className="text-center py-12 text-[var(--text-dim)]">
            <p className="text-sm">Click "Run All Tests" to test all CRUD operations</p>
            <p className="text-xs mt-1">or "Diagnostics" to check spreadsheet structure</p>
          </div>
        )}
      </div>
    </div>
  )
}

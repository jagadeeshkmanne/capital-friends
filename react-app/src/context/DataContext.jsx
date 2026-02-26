import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import * as api from '../services/api'
import * as idb from '../services/idb'
import { useAuth } from './AuthContext'

const DataContext = createContext()

const HC_SESSION_KEY = 'cf_hc_done'

function getHCSession() {
  try { return sessionStorage.getItem(HC_SESSION_KEY) === '1' ? true : null } catch { return null }
}

function setHCSession(val) {
  try { sessionStorage.setItem(HC_SESSION_KEY, val ? '1' : '0') } catch {}
}

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const cachedHC = isAuthenticated ? getHCSession() : null

  // ── Loading & Error State ──
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // ── All Data State — starts null (not loaded), hydrated from IDB then API ──
  // null = not loaded yet, [] = loaded but empty, [...] = loaded with data
  const [members, setMembers] = useState(null)
  const [banks, setBanks] = useState(null)
  const [investmentAccounts, setInvestmentAccounts] = useState(null)
  const [insurancePolicies, setInsurance] = useState(null)
  const [liabilityList, setLiabilities] = useState(null)
  const [otherInvList, setOtherInvestments] = useState(null)
  const [stockPortfolios, setStockPortfolios] = useState(null)
  const [stockHoldings, setStockHoldings] = useState(null)
  const [stockTransactions, setStockTransactions] = useState(null)
  const [mfPortfolios, setMFPortfolios] = useState(null)
  const [mfHoldings, setMFHoldings] = useState(null)
  const [mfTransactions, setMFTransactions] = useState(null)
  const [goalList, setGoals] = useState(null)
  const [reminderList, setReminders] = useState(null)
  const [goalPortfolioMappings, setGoalPortfolioMappings] = useState(null)
  const [settings, setSettings] = useState(null)
  // Health check: session cache for instant same-tab checks, IDB for persistence
  const [healthCheckCompleted, setHealthCheckCompleted] = useState(
    cachedHC !== null ? cachedHC : null
  )

  const didInitRef = useRef(false)

  // ── Hydrate state from a data object (IDB or API response) ──
  // Uses 'key' in data to set even empty arrays (transitions null → [])
  const hydrateState = useCallback((data) => {
    if (!data) return
    if ('members' in data) setMembers(data.members || [])
    if ('bankAccounts' in data) setBanks(data.bankAccounts || [])
    if ('investments' in data) setInvestmentAccounts(data.investments || [])
    if ('insurancePolicies' in data) setInsurance(data.insurancePolicies || [])
    if ('liabilities' in data) setLiabilities(data.liabilities || [])
    if ('otherInvestments' in data) setOtherInvestments(data.otherInvestments || [])
    if ('stockPortfolios' in data) setStockPortfolios(data.stockPortfolios || [])
    if ('stockHoldings' in data) setStockHoldings(data.stockHoldings || [])
    if ('stockTransactions' in data) setStockTransactions(data.stockTransactions || [])
    if ('mfPortfolios' in data) setMFPortfolios(data.mfPortfolios || [])
    if ('mfHoldings' in data) setMFHoldings((data.mfHoldings || []).map(h => h.schemeCode ? h : { ...h, schemeCode: h.fundCode }))
    if ('mfTransactions' in data) setMFTransactions(data.mfTransactions || [])
    if ('goals' in data) setGoals(data.goals || [])
    if ('reminders' in data) setReminders(data.reminders || [])
    if ('goalPortfolioMappings' in data) setGoalPortfolioMappings(data.goalPortfolioMappings || [])
    if ('settings' in data) setSettings(data.settings || {})
  }, [])

  // ── Save all data to IDB (after API load) ──
  const persistToIDB = useCallback((data) => {
    idb.putMany({
      members: data.members || [],
      bankAccounts: data.bankAccounts || [],
      investments: data.investments || [],
      insurancePolicies: data.insurancePolicies || [],
      liabilities: data.liabilities || [],
      otherInvestments: data.otherInvestments || [],
      stockPortfolios: data.stockPortfolios || [],
      stockHoldings: data.stockHoldings || [],
      stockTransactions: data.stockTransactions || [],
      mfPortfolios: data.mfPortfolios || [],
      mfHoldings: data.mfHoldings || [],
      mfTransactions: data.mfTransactions || [],
      goals: data.goals || [],
      reminders: data.reminders || [],
      goalPortfolioMappings: data.goalPortfolioMappings || [],
    })
  }, [])

  // ── Load All Data from API ──
  const refreshData = useCallback(async (background = false) => {
    try {
      if (background) setIsRefreshing(true)
      else setLoading(true)
      setError(null)
      const data = await api.loadAllData()
      hydrateState(data)
      persistToIDB(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [hydrateState, persistToIDB])

  // ── Section refresh functions (each writes to IDB) ──
  const refreshMembers = useCallback(async () => {
    const data = await api.getMembers()
    setMembers(data || [])
    idb.put('members', data || [])
  }, [])

  const refreshBanks = useCallback(async () => {
    const data = await api.getBanks()
    setBanks(data || [])
    idb.put('bankAccounts', data || [])
  }, [])

  const refreshInvestmentAccounts = useCallback(async () => {
    const data = await api.getInvestmentAccounts()
    setInvestmentAccounts(data || [])
    idb.put('investments', data || [])
  }, [])

  const refreshInsurance = useCallback(async () => {
    const data = await api.getInsurance()
    setInsurance(data || [])
    idb.put('insurancePolicies', data || [])
  }, [])

  const refreshLiabilities = useCallback(async () => {
    const data = await api.getLiabilities()
    setLiabilities(data || [])
    idb.put('liabilities', data || [])
  }, [])

  const refreshOtherInvestments = useCallback(async () => {
    const data = await api.getOtherInvestments()
    setOtherInvestments(data || [])
    idb.put('otherInvestments', data || [])
  }, [])

  const refreshGoals = useCallback(async () => {
    const [goals, mappings] = await Promise.all([api.getGoals(), api.getGoalMappings()])
    setGoals(goals || [])
    setGoalPortfolioMappings(mappings || [])
    idb.put('goals', goals || [])
    idb.put('goalPortfolioMappings', mappings || [])
  }, [])

  const refreshReminders = useCallback(async () => {
    const data = await api.getReminders()
    setReminders(data || [])
    idb.put('reminders', data || [])
  }, [])

  const refreshMF = useCallback(async () => {
    const [portfolios, holdings, transactions] = await Promise.all([
      api.getMFPortfolios(),
      api.getAllMFHoldings(),
      api.getAllMFTransactions(),
    ])
    const normalizedHoldings = (holdings || []).map(h => h.schemeCode ? h : { ...h, schemeCode: h.fundCode })
    setMFPortfolios(portfolios || [])
    setMFHoldings(normalizedHoldings)
    setMFTransactions(transactions || [])
    idb.putMany({
      mfPortfolios: portfolios || [],
      mfHoldings: normalizedHoldings,
      mfTransactions: transactions || [],
    })
  }, [])

  const refreshStocks = useCallback(async () => {
    const [portfolios, holdings, transactions] = await Promise.all([
      api.getStockPortfolios(),
      api.getAllStockHoldings(),
      api.getAllStockTransactions(),
    ])
    setStockPortfolios(portfolios || [])
    setStockHoldings(holdings || [])
    setStockTransactions(transactions || [])
    idb.putMany({
      stockPortfolios: portfolios || [],
      stockHoldings: holdings || [],
      stockTransactions: transactions || [],
    })
  }, [])

  const refreshSettings = useCallback(async () => {
    const data = await api.getSettings()
    setSettings(data || {})
    idb.put('settings', data || {})
  }, [])

  const updateSettings = useCallback(async (data) => {
    await api.saveSettings(data)
    await refreshSettings()
  }, [refreshSettings])

  // Resolve health check by looking for answers: IDB first, then API
  const resolveHealthCheck = useCallback(async () => {
    try {
      // Step 1: Check IDB for cached answers
      const cached = await idb.get('healthCheckAnswers')
      if (cached && Object.keys(cached).length > 0) {
        setHealthCheckCompleted(true)
        setHCSession(true)
        return
      }

      // Step 2: Fetch answers from API (new browser / cleared cache)
      const answers = await api.getHealthCheckAnswers()
      if (answers && Object.keys(answers).length > 0) {
        setHealthCheckCompleted(true)
        setHCSession(true)
        idb.put('healthCheckAnswers', answers)
      } else {
        // No answers anywhere — user hasn't completed health check
        setHealthCheckCompleted(false)
        setHCSession(false)
      }
    } catch {
      setHealthCheckCompleted(false)
      setHCSession(false)
    }
  }, [])

  const completeHealthCheck = useCallback(async (answers) => {
    const result = await api.saveHealthCheck(answers)
    if (result?.success) {
      setHealthCheckCompleted(true)
      setHCSession(true)
      idb.put('healthCheckAnswers', answers)
    }
    return result
  }, [])

  // ── Init: IDB hydration → then background API refresh ──
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    if (didInitRef.current) return
    didInitRef.current = true

    async function init() {
      // Step 1: Hydrate from IndexedDB (~5-20ms)
      const cached = await idb.getAll()
      const hasCache = Object.keys(cached).length > 0
      if (hasCache) {
        hydrateState(cached)
        // Health check: if answers exist in IDB, user is verified
        if (cached.healthCheckAnswers && Object.keys(cached.healthCheckAnswers).length > 0) {
          setHealthCheckCompleted(true)
          setHCSession(true)
        }
        setLoading(false) // UI renders instantly with cached data
      }

      // Step 2: Fresh data from API (background if we had cache)
      try {
        if (hasCache) setIsRefreshing(true)
        const data = await api.loadAllData()
        hydrateState(data)
        persistToIDB(data)
      } catch (err) {
        if (!hasCache) setError(err.message)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    }

    init()
    refreshSettings().catch(() => {})
    // If no session cache for health check, resolve by checking IDB → API
    if (cachedHC === null) {
      resolveHealthCheck().catch(() => {})
    }
  }, [isAuthenticated, hydrateState, persistToIDB, refreshSettings, resolveHealthCheck])

  // Reset init ref when user logs out so re-login triggers fresh init
  useEffect(() => {
    if (!isAuthenticated) {
      didInitRef.current = false
    }
  }, [isAuthenticated])

  // ── Family Members CRUD ──
  const addMember = useCallback(async (data) => {
    const result = await api.createMember(data)
    // Auto-invite: register in Script Properties + share sheet so they can log in
    if (data.email) {
      try {
        await api.inviteFamilyMember(data.email, data.memberName)
      } catch (e) {
        // Non-blocking — member is still added even if sharing fails
        console.warn('Auto-invite failed (non-blocking):', e.message)
      }
    }
    await refreshMembers()
    return result
  }, [refreshMembers])

  const updateMember = useCallback(async (id, data) => {
    await api.updateMember({ memberId: id, ...data })
    await refreshMembers()
  }, [refreshMembers])

  const deleteMember = useCallback(async (id) => {
    await api.deleteMember(id)
    await refreshMembers()
  }, [refreshMembers])

  // ── Bank Accounts CRUD ──
  const addBankAccount = useCallback(async (data) => {
    const result = await api.createBank(data)
    await refreshBanks()
    return result
  }, [refreshBanks])

  const updateBankAccount = useCallback(async (id, data) => {
    await api.updateBank({ accountId: id, ...data })
    await refreshBanks()
  }, [refreshBanks])

  const deleteBankAccount = useCallback(async (id) => {
    await api.deleteBank(id)
    await refreshBanks()
  }, [refreshBanks])

  // ── Investment Accounts CRUD ──
  const addInvestmentAccount = useCallback(async (data) => {
    const result = await api.createInvestmentAccount(data)
    await refreshInvestmentAccounts()
    return result
  }, [refreshInvestmentAccounts])

  const updateInvestmentAccount = useCallback(async (id, data) => {
    await api.updateInvestmentAccount({ accountId: id, ...data })
    await refreshInvestmentAccounts()
  }, [refreshInvestmentAccounts])

  const deleteInvestmentAccount = useCallback(async (id) => {
    await api.deleteInvestmentAccount(id)
    await refreshInvestmentAccounts()
  }, [refreshInvestmentAccounts])

  // ── Insurance CRUD ──
  const addInsurance = useCallback(async (data) => {
    const result = await api.createInsurance(data)
    await refreshInsurance()
    return result
  }, [refreshInsurance])

  const updateInsurance = useCallback(async (id, data) => {
    await api.updateInsurance({ policyId: id, ...data })
    await refreshInsurance()
  }, [refreshInsurance])

  const deleteInsurance = useCallback(async (id) => {
    await api.deleteInsurance(id)
    await refreshInsurance()
  }, [refreshInsurance])

  // ── Liabilities CRUD ──
  const addLiability = useCallback(async (data) => {
    const result = await api.createLiability(data)
    await refreshLiabilities()
    return result
  }, [refreshLiabilities])

  const updateLiability = useCallback(async (id, data) => {
    await api.updateLiability({ liabilityId: id, ...data })
    await refreshLiabilities()
  }, [refreshLiabilities])

  const deleteLiability = useCallback(async (id) => {
    await api.deleteLiability(id)
    await refreshLiabilities()
  }, [refreshLiabilities])

  // ── Other Investments CRUD ──
  const addOtherInvestment = useCallback(async (data) => {
    const result = await api.createOtherInvestment(data)
    await refreshOtherInvestments()
    if (data.quickLoan) await refreshLiabilities()
    return result
  }, [refreshOtherInvestments, refreshLiabilities])

  const updateOtherInvestment = useCallback(async (id, data) => {
    await api.updateOtherInvestment({ investmentId: id, ...data })
    await refreshOtherInvestments()
  }, [refreshOtherInvestments])

  const deleteOtherInvestment = useCallback(async (id) => {
    await api.deleteOtherInvestment(id)
    await refreshOtherInvestments()
  }, [refreshOtherInvestments])

  // ── Goals CRUD ──
  const addGoal = useCallback(async (data) => {
    const result = await api.createGoal(data)
    await refreshGoals()
    return result
  }, [refreshGoals])

  const updateGoal = useCallback(async (id, data) => {
    await api.updateGoal(id, data)
    await refreshGoals()
  }, [refreshGoals])

  const deleteGoal = useCallback(async (id) => {
    await api.deleteGoal(id)
    await refreshGoals()
  }, [refreshGoals])

  // ── Reminders CRUD ──
  const addReminder = useCallback(async (data) => {
    const result = await api.createReminder(data)
    await refreshReminders()
    return result
  }, [refreshReminders])

  const updateReminder = useCallback(async (id, data) => {
    await api.updateReminder({ reminderId: id, ...data })
    await refreshReminders()
  }, [refreshReminders])

  const deleteReminder = useCallback(async (id) => {
    await api.deleteReminder(id)
    await refreshReminders()
  }, [refreshReminders])

  // ── Goal-Portfolio Mappings ──
  const updateGoalMappings = useCallback(async (goalId, mappings) => {
    await api.updateGoalMappings(goalId, mappings)
    await refreshGoals()
  }, [refreshGoals])

  // ── Stock Portfolios CRUD ──
  const addStockPortfolio = useCallback(async (data) => {
    const result = await api.createStockPortfolio(data)
    await refreshStocks()
    return result
  }, [refreshStocks])

  const updateStockPortfolio = useCallback(async (id, data) => {
    await api.updateStockPortfolio({ portfolioId: id, ...data })
    await refreshStocks()
  }, [refreshStocks])

  const deleteStockPortfolio = useCallback(async (id) => {
    await api.deleteStockPortfolio(id)
    await refreshStocks()
  }, [refreshStocks])

  // ── Stock Transactions ──
  const buyStock = useCallback(async (data) => {
    const result = await api.buyStock(data)
    await refreshStocks()
    return result
  }, [refreshStocks])

  const sellStock = useCallback(async (data) => {
    const result = await api.sellStock(data)
    await refreshStocks()
    return result
  }, [refreshStocks])

  // ── MF Portfolios CRUD ──
  const addMFPortfolio = useCallback(async (data) => {
    const result = await api.createMFPortfolio(data)
    await refreshMF()
    return result
  }, [refreshMF])

  const updateMFPortfolio = useCallback(async (id, data) => {
    await api.updateMFPortfolio({ portfolioId: id, ...data })
    await refreshMF()
  }, [refreshMF])

  const deleteMFPortfolio = useCallback(async (id) => {
    await api.deleteMFPortfolio(id)
    await refreshMF()
  }, [refreshMF])

  // ── MF Transactions ──
  const investMF = useCallback(async (data, transactionType) => {
    const result = await api.investMF({ ...data, transactionType })
    await refreshMF()
    return result
  }, [refreshMF])

  const redeemMF = useCallback(async (data) => {
    const result = await api.redeemMF(data)
    await refreshMF()
    return result
  }, [refreshMF])

  const switchMF = useCallback(async (data) => {
    const result = await api.switchMF(data)
    await refreshMF()
    return result
  }, [refreshMF])

  const updateHoldingAllocations = useCallback(async (portfolioId, allocations) => {
    await api.updateAllocations(portfolioId, allocations)
    await refreshMF()
  }, [refreshMF])

  const deleteMFTransaction = useCallback(async (transactionId) => {
    await api.deleteMFTransaction(transactionId)
    await refreshMF()
  }, [refreshMF])

  const editMFTransaction = useCallback(async (data) => {
    await api.editMFTransaction(data)
    await refreshMF()
  }, [refreshMF])

  // ── Filtered helpers ──
  const activeMembers = (members || []).filter((m) => m.status === 'Active')
  const activeBanks = (banks || []).filter((b) => b.status === 'Active')
  const activeInvestmentAccounts = (investmentAccounts || []).filter((a) => a.status === 'Active')

  return (
    <DataContext.Provider value={{
      // Loading state
      loading, isRefreshing, error, refreshData,
      // Data
      members, banks, investmentAccounts, insurancePolicies, liabilityList, otherInvList,
      // Filtered
      activeMembers, activeBanks, activeInvestmentAccounts,
      // Family Members CRUD
      addMember, updateMember, deleteMember,
      // Bank Accounts CRUD
      addBankAccount, updateBankAccount, deleteBankAccount,
      // Investment Accounts CRUD
      addInvestmentAccount, updateInvestmentAccount, deleteInvestmentAccount,
      // Insurance CRUD
      addInsurance, updateInsurance, deleteInsurance,
      // Liabilities CRUD
      addLiability, updateLiability, deleteLiability,
      // Other Investments CRUD
      addOtherInvestment, updateOtherInvestment, deleteOtherInvestment,
      // Goals
      goalList, addGoal, updateGoal, deleteGoal,
      // Reminders
      reminderList, addReminder, updateReminder, deleteReminder,
      // Goal-Portfolio Mappings
      goalPortfolioMappings, updateGoalMappings,
      // Stock data
      stockPortfolios, stockHoldings, stockTransactions,
      // Stock CRUD
      addStockPortfolio, updateStockPortfolio, deleteStockPortfolio,
      buyStock, sellStock,
      // MF data
      mfPortfolios, mfHoldings, mfTransactions,
      // MF CRUD
      addMFPortfolio, updateMFPortfolio, deleteMFPortfolio,
      investMF, redeemMF, switchMF, updateHoldingAllocations, deleteMFTransaction, editMFTransaction,
      // Settings
      settings, updateSettings, refreshSettings,
      // Health Check
      healthCheckCompleted, completeHealthCheck,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}

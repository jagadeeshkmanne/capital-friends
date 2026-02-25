import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import * as api from '../services/api'
import { useAuth } from './AuthContext'

const DataContext = createContext()

export function DataProvider({ children }) {
  const { isAuthenticated } = useAuth()

  // ── Loading & Error State ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── All Data State (same shape as before) ──
  const [members, setMembers] = useState([])
  const [banks, setBanks] = useState([])
  const [investments, setInvestments] = useState([])
  const [insurancePolicies, setInsurance] = useState([])
  const [liabilityList, setLiabilities] = useState([])
  const [otherInvList, setOtherInvestments] = useState([])
  const [stockPortfolios, setStockPortfolios] = useState([])
  const [stockHoldings, setStockHoldings] = useState([])
  const [stockTransactions, setStockTransactions] = useState([])
  const [mfPortfolios, setMFPortfolios] = useState([])
  const [mfHoldings, setMFHoldings] = useState([])
  const [mfTransactions, setMFTransactions] = useState([])
  const [goalList, setGoals] = useState([])
  const [reminderList, setReminders] = useState([])
  const [goalPortfolioMappings, setGoalPortfolioMappings] = useState([])
  const [settings, setSettings] = useState({})
  const [healthCheckCompleted, setHealthCheckCompleted] = useState(null) // null=loading, true/false

  // ── Load All Data on Auth ──
  const refreshData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.loadAllData()
      setMembers(data.members || [])
      setBanks(data.bankAccounts || [])
      setInvestments(data.investments || [])
      setInsurance(data.insurancePolicies || [])
      setLiabilities(data.liabilities || [])
      setOtherInvestments(data.otherInvestments || [])
      setStockPortfolios(data.stockPortfolios || [])
      setStockHoldings(data.stockHoldings || [])
      setStockTransactions(data.stockTransactions || [])
      setMFPortfolios(data.mfPortfolios || [])
      setMFHoldings(data.mfHoldings || [])
      setMFTransactions(data.mfTransactions || [])
      setGoals(data.goals || [])
      setReminders(data.reminders || [])
      setGoalPortfolioMappings(data.goalPortfolioMappings || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh individual sections (lighter than full reload)
  const refreshMembers = useCallback(async () => {
    const data = await api.getMembers()
    setMembers(data || [])
  }, [])

  const refreshBanks = useCallback(async () => {
    const data = await api.getBanks()
    setBanks(data || [])
  }, [])

  const refreshInvestmentAccounts = useCallback(async () => {
    const data = await api.getInvestmentAccounts()
    setInvestments(data || [])
  }, [])

  const refreshInsurance = useCallback(async () => {
    const data = await api.getInsurance()
    setInsurance(data || [])
  }, [])

  const refreshLiabilities = useCallback(async () => {
    const data = await api.getLiabilities()
    setLiabilities(data || [])
  }, [])

  const refreshOtherInvestments = useCallback(async () => {
    const data = await api.getOtherInvestments()
    setOtherInvestments(data || [])
  }, [])

  const refreshGoals = useCallback(async () => {
    const [goals, mappings] = await Promise.all([api.getGoals(), api.getGoalMappings()])
    setGoals(goals || [])
    setGoalPortfolioMappings(mappings || [])
  }, [])

  const refreshReminders = useCallback(async () => {
    const data = await api.getReminders()
    setReminders(data || [])
  }, [])

  const refreshMF = useCallback(async () => {
    // Reload portfolios, holdings, and transactions together
    const data = await api.loadAllData()
    setMFPortfolios(data.mfPortfolios || [])
    setMFHoldings(data.mfHoldings || [])
    setMFTransactions(data.mfTransactions || [])
  }, [])

  const refreshStocks = useCallback(async () => {
    const data = await api.loadAllData()
    setStockPortfolios(data.stockPortfolios || [])
    setStockHoldings(data.stockHoldings || [])
    setStockTransactions(data.stockTransactions || [])
  }, [])

  const refreshSettings = useCallback(async () => {
    const data = await api.getSettings()
    setSettings(data || {})
  }, [])

  const updateSettings = useCallback(async (data) => {
    await api.saveSettings(data)
    await refreshSettings()
  }, [refreshSettings])

  const checkHealthCheck = useCallback(async () => {
    try {
      const status = await api.getHealthCheckStatus()
      setHealthCheckCompleted(status?.completed ?? false)
    } catch {
      setHealthCheckCompleted(false)
    }
  }, [])

  const completeHealthCheck = useCallback(async (answers) => {
    const result = await api.saveHealthCheck(answers)
    if (result?.success) {
      setHealthCheckCompleted(true)
    }
    return result
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      refreshData()
      refreshSettings().catch(() => {}) // non-blocking
      checkHealthCheck().catch(() => {}) // non-blocking
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, refreshData, refreshSettings, checkHealthCheck])

  // ── Family Members CRUD ──
  const addMember = useCallback(async (data) => {
    const result = await api.createMember(data)
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
    // Also refresh liabilities in case a quick loan was created
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

  // ── Filtered helpers (same as before) ──
  const activeMembers = members.filter((m) => m.status === 'Active')
  const activeBanks = banks.filter((b) => b.status === 'Active')
  const activeInvestmentAccounts = investments.filter((a) => a.status === 'Active')

  return (
    <DataContext.Provider value={{
      // Loading state
      loading, error, refreshData,
      // Data
      members, banks, investments, insurancePolicies, liabilityList, otherInvList,
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
      investMF, redeemMF, switchMF, updateHoldingAllocations,
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

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import * as api from '../services/api'
import * as idb from '../services/idb'
import { clearStocksCache } from '../components/forms/StockSearchInput'
import { useAuth } from './AuthContext'

const DataContext = createContext()

const HC_SESSION_KEY = 'cf_hc_done'
const IDB_OWNER_KEY = 'cf_idb_owner'

function getHCSession() {
  try { return localStorage.getItem(HC_SESSION_KEY) === '1' ? true : null } catch { return null }
}

function setHCSession(val) {
  try { localStorage.setItem(HC_SESSION_KEY, val ? '1' : '0') } catch {}
}

function getIDBOwner() {
  try { return localStorage.getItem(IDB_OWNER_KEY) || null } catch { return null }
}

function setIDBOwner(email) {
  try { localStorage.setItem(IDB_OWNER_KEY, email) } catch {}
}

export function DataProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const cachedHC = isAuthenticated ? getHCSession() : null

  // ── Loading & Error State ──
  const [loading, setLoading] = useState(true)
  const [isSetupLoading, setIsSetupLoading] = useState(false) // true only during new-user sheet creation
  const [isRefreshing, setIsRefreshing] = useState(false)
  // set after a successful load from the server (not the browser cache); loadErrors = sections that failed on the server
  const [freshLoad, setFreshLoad] = useState({ at: 0, errors: [] })
  const [settingsAt, setSettingsAt] = useState(0) // when settings last came from the server (not the cache)
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
  const [assetAllocations, setAssetAllocations] = useState(null)
  const [settings, setSettings] = useState(null)
  const settingsRef = useRef(null); settingsRef.current = settings
  // Health check: session cache for instant same-tab checks, IDB for persistence
  const [healthCheckCompleted, setHealthCheckCompleted] = useState(
    cachedHC !== null ? cachedHC : null
  )
  const [healthCheckAnswers, setHealthCheckAnswers] = useState(null)

  const didInitRef = useRef(false)
  // When each section was last written by a section refresh (after an add/edit), and which sections hold data.
  // A full load that started before such a write must not put the older copy back (e.g. a new loan
  // "disappearing" when a slower background load finishes later), and a section the server failed to
  // read must not wipe what is on screen.
  const touchedAt = useRef({})
  const hasData = useRef({})
  // when a save last sent back a section ('fresh'): the reload right after that save is then skipped
  const freshAt = useRef({})
  const justFresh = (...keys) => keys.every((k) => Date.now() - (freshAt.current[k] || 0) < 4000)
  const touch = (...keys) => { const t = Date.now(); keys.forEach((k) => { touchedAt.current[k] = t; hasData.current[k] = true }) }

  // ── Hydrate state from a data object (IDB or API response) ──
  // Uses 'key' in data to set even empty arrays (transitions null → [])
  const hydrateState = useCallback((data) => {
    if (!data) return
    Object.keys(data).forEach((k) => { if (k !== '_errors') hasData.current[k] = true })
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
    if ('assetAllocations' in data) setAssetAllocations(data.assetAllocations || [])
    if ('settings' in data) setSettings(data.settings || {})
  }, [])

  // Lists a save sent back: show them now, cache them, and mark them so the follow-up reload is skipped
  useEffect(() => {
    api.setFreshHandler((fresh) => {
      const { settings: st, ...lists } = fresh || {}
      hydrateState(lists)
      const keys = Object.keys(lists)
      if (keys.length) { idb.putMany(Object.fromEntries(keys.map((k) => [k, lists[k] || []]))); touch(...keys) }
      if (st && typeof st === 'object') { settingsSeq.current++; setSettings(st); setSettingsAt(Date.now()); idb.put('settings', st); keys.push('settings') }
      const t = Date.now(); keys.forEach((k) => { freshAt.current[k] = t })
    })
    return () => api.setFreshHandler(null)
  }, [hydrateState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save all data to IDB (after API load) ──
  const persistToIDB = useCallback((data) => {
    const KEYS = ['members', 'bankAccounts', 'investments', 'insurancePolicies', 'liabilities', 'otherInvestments',
      'stockPortfolios', 'stockHoldings', 'stockTransactions', 'mfPortfolios', 'mfHoldings', 'mfTransactions',
      'goals', 'reminders', 'goalPortfolioMappings', 'assetAllocations']
    const out = {}
    KEYS.forEach((k) => { if (k in data) out[k] = data[k] || [] })
    idb.putMany(out)
    // Tag IDB with current user so a different user on same device gets a clean cache
    if (user?.email) setIDBOwner(user.email)
  }, [user?.email])

  // ── Load All Data from API ──
  const refreshData = useCallback(async (background = false) => {
    try {
      if (background) setIsRefreshing(true)
      else setLoading(true)
      setError(null)
      const started = Date.now()
      const data = { ...(await api.loadAllData()) }
      // keep newer section writes, and keep what we have for sections the server could not read
      const FN_KEY = {
        getAllFamilyMembers: 'members', getAllBankAccounts: 'bankAccounts', getAllInvestmentAccounts: 'investments',
        getAllPortfoliosStrict_: 'mfPortfolios', getAllMFHoldings: 'mfHoldings', getAllMFTransactions: 'mfTransactions',
        getAllGoals: 'goals', getGoalPortfolioMappings: 'goalPortfolioMappings', getAllInsurancePolicies: 'insurancePolicies',
        getAllLiabilities: 'liabilities', getAllInvestmentsStrict_: 'otherInvestments', getAllStockPortfoliosStrict_: 'stockPortfolios',
        getAllStockHoldingsData: 'stockHoldings', getAllStockTransactionsData: 'stockTransactions', getAllReminders: 'reminders',
        getAllAssetAllocationsData: 'assetAllocations',
      }
      ;(data._errors || []).forEach((e) => { const k = FN_KEY[e.fn]; if (k && hasData.current[k]) delete data[k] })
      Object.keys(touchedAt.current).forEach((k) => { if (touchedAt.current[k] > started) delete data[k] })
      hydrateState(data)
      persistToIDB(data)
      setFreshLoad({ at: Date.now(), errors: (data && data._errors) || [] })
      return data
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [hydrateState, persistToIDB])

  // After an import the sheet keeps working out NAVs and values for a while (thousands of formulas), so the
  // first load can still show zeros. Load again a few times until every held fund has a value.
  const [settling, setSettling] = useState(false)
  const settleRef = useRef(0)
  const refreshUntilSettled = useCallback(async () => {
    const run = ++settleRef.current
    setSettling(true)
    const unsettled = (d) => (d?.mfHoldings || []).some((h) => (Number(h.units) || 0) > 0.0005 && !((Number(h.currentValue) || 0) > 0))
    try {
      for (const wait of [0, 8000, 15000, 25000, 40000, 60000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait))
        if (run !== settleRef.current) return
        const d = await refreshData(true)
        if (d && !unsettled(d)) break
      }
    } finally { if (run === settleRef.current) setSettling(false) }
  }, [refreshData])

  // ── Section refresh functions (each writes to IDB) ──
  const refreshMembers = useCallback(async () => {
    if (justFresh('members')) return // the save already sent this list back
    const data = await api.getMembers()
    setMembers(data || [])
    touch('members')
    idb.put('members', data || [])
  }, [])

  const refreshBanks = useCallback(async () => {
    if (justFresh('bankAccounts')) return // the save already sent this list back
    const data = await api.getBanks()
    setBanks(data || [])
    touch('bankAccounts')
    idb.put('bankAccounts', data || [])
  }, [])

  const refreshInvestmentAccounts = useCallback(async () => {
    if (justFresh('investments')) return // the save already sent this list back
    const data = await api.getInvestmentAccounts()
    setInvestmentAccounts(data || [])
    touch('investments')
    idb.put('investments', data || [])
  }, [])

  const refreshInsurance = useCallback(async () => {
    if (justFresh('insurancePolicies')) return // the save already sent this list back
    const data = await api.getInsurance()
    setInsurance(data || [])
    touch('insurancePolicies')
    idb.put('insurancePolicies', data || [])
  }, [])

  const refreshLiabilities = useCallback(async () => {
    if (justFresh('liabilities')) return // the save already sent this list back
    const data = await api.getLiabilities()
    setLiabilities(data || [])
    touch('liabilities')
    idb.put('liabilities', data || [])
  }, [])

  const refreshOtherInvestments = useCallback(async () => {
    if (justFresh('otherInvestments')) return // the save already sent this list back
    const data = await api.getOtherInvestments()
    setOtherInvestments(data || [])
    touch('otherInvestments')
    idb.put('otherInvestments', data || [])
  }, [])

  const refreshGoals = useCallback(async () => {
    if (justFresh('goals', 'goalPortfolioMappings')) return // the save already sent this list back
    const [goals, mappings] = await Promise.all([api.getGoals(), api.getGoalMappings()])
    setGoals(goals || [])
    setGoalPortfolioMappings(mappings || [])
    touch('goals', 'goalPortfolioMappings')
    idb.put('goals', goals || [])
    idb.put('goalPortfolioMappings', mappings || [])
  }, [])

  const refreshReminders = useCallback(async () => {
    if (justFresh('reminders')) return // the save already sent this list back
    const data = await api.getReminders()
    setReminders(data || [])
    touch('reminders')
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
    touch('mfPortfolios', 'mfHoldings', 'mfTransactions')
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
    touch('stockPortfolios', 'stockHoldings', 'stockTransactions')
    idb.putMany({
      stockPortfolios: portfolios || [],
      stockHoldings: holdings || [],
      stockTransactions: transactions || [],
    })
  }, [])

  // only the newest settings read is applied: an older read finishing later must not undo a save just made
  const settingsSeq = useRef(0)
  const refreshSettings = useCallback(async () => {
    if (justFresh('settings')) return // the save already sent the settings back
    const seq = ++settingsSeq.current
    const data = await api.getSettings()
    if (seq !== settingsSeq.current) return
    setSettings(data || {})
    setSettingsAt(Date.now())
    if (data) idb.put('settings', data)
    idb.put('settings', data || {})
  }, [])

  const updateSettings = useCallback(async (data) => {
    await api.saveSettings(data)
    // show the saved values at once (and keep them if an older read is still on its way)
    settingsSeq.current++
    setSettings((prev) => ({ ...(prev || {}), ...data }))
    await refreshSettings()
  }, [refreshSettings])

  // Resolve health check using HealthCheckAnswered flag in Settings sheet.
  // IDB settings cache is checked first (fast), API is fallback.
  const resolveHealthCheck = useCallback(async () => {
    try {
      // Step 1: Check IDB settings cache for the flag (fastest — set when saveHealthCheck runs)
      const cachedSettings = await idb.get('settings')
      if (cachedSettings?.HealthCheckAnswered === 'true') {
        setHealthCheckCompleted(true)
        setHCSession(true)
        return
      }

      // Step 2: Fetch settings from API (new browser / cleared cache)
      const settingsData = await api.getSettings()
      if (settingsData?.HealthCheckAnswered === 'true') {
        setHealthCheckCompleted(true)
        setHCSession(true)
        // Update IDB settings cache with the flag so next login is fast
        idb.put('settings', settingsData)
      } else {
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
      setHealthCheckAnswers(answers)
      setHCSession(true)
      // Cache answers for form pre-population on next visit
      idb.put('healthCheckAnswers', answers)
      // Update IDB settings cache with the HealthCheckAnswered flag so next login is instant
      const cachedSettings = await idb.get('settings') || {}
      idb.put('settings', { ...cachedSettings, HealthCheckAnswered: 'true' })
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
      // Show loading immediately — before any await to avoid blank flash
      setLoading(true)

      // Step 1: Hydrate from IndexedDB (~5-20ms)
      // Security: clear IDB if user explicitly logged out, or if a different user is logging in
      const currentEmail = user?.email
      const idbOwner = getIDBOwner()
      const idbStale = localStorage.getItem('cf_idb_stale') === '1'
      if (idbStale || (idbOwner && currentEmail && idbOwner !== currentEmail)) {
        await idb.clearAll()
        localStorage.removeItem('cf_idb_stale')
        if (idbOwner !== currentEmail) setHCSession(false)
      }

      const cached = await idb.getAll()
      // 'members' key in IDB means loadAllData() ran before → user completed health check
      // (new users who are mid-onboarding only have 'settings' in IDB, not 'members')
      const hasAppData = 'members' in cached

      if (hasAppData) {
        // ── FAST PATH: returning user ──
        // Show cached dashboard immediately, no API calls before render
        hydrateState(cached)
        setHealthCheckCompleted(true)
        setHCSession(true)
        setLoading(false)
        // Silent background refresh (non-blocking)
        refreshSettings().catch(() => {})
        // data refreshed below in Step 3
      } else {
        // ── SLOW PATH: no app data — new user or fresh browser ──
        // Must call data:init to detect new vs returning user
        let isNewUser = false
        try {
          const initResult = await api.initUser()
          isNewUser = initResult?.isNewUser === true
        } catch (e) {
          // ignore — loadAllData will call getOrCreateUser as fallback
        }

        if (isNewUser) {
          // Brand new account — show setup progress screen, then redirect to health check
          setIsSetupLoading(true)
          await idb.clearAll()
          hydrateState({
            members: [], bankAccounts: [], investments: [], insurancePolicies: [],
            liabilities: [], otherInvestments: [], stockPortfolios: [], stockHoldings: [],
            stockTransactions: [], mfPortfolios: [], mfHoldings: [], mfTransactions: [],
            goals: [], reminders: [], goalPortfolioMappings: [], assetAllocations: []
          })
          setHealthCheckCompleted(false)
          setHCSession(false)
          setLoading(false)
          setIsSetupLoading(false)
          refreshSettings().catch(() => {})
          return // ProtectedRoute will redirect to /health-check
        } else {
          // Returning user on fresh browser — load settings first so HC resolves from IDB (no extra API call)
          setLoading(false)
          if (cachedHC === null) {
            // Await settings so IDB is populated before resolveHealthCheck checks it
            refreshSettings().then(() => resolveHealthCheck()).catch(() => resolveHealthCheck())
          } else {
            // cachedHC is true/false from localStorage — apply it directly so ProtectedRoute doesn't block
            setHealthCheckCompleted(cachedHC)
            refreshSettings().catch(() => {})
          }
        }
      }

      // Step 3: Fresh data from API — runs in background for cache users, foreground for fresh browser
      try {
        setIsRefreshing(true)
        const data = await api.loadAllData()
        hydrateState(data)
        persistToIDB(data)
        setFreshLoad({ at: Date.now(), errors: (data && data._errors) || [] })
      } catch (err) {
        if (!hasAppData) setError(err.message)
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }

      // Step 4: safety net for NAVs — if this user's copy of the fund data is older than the
      // master DB (e.g. their background sync didn't run), refresh it and reload quietly.
      // Non-blocking: any failure here leaves the screen exactly as it is.
      api.syncMasterIfStale()
        .then(async (r) => {
          if (!r?.refreshed) return
          clearStocksCache()   // the stock & ETF list was refreshed too
          const fresh = await api.loadAllData()
          hydrateState(fresh)
          persistToIDB(fresh)
        })
        .catch(() => {})
    }

    init()
  }, [isAuthenticated, hydrateState, persistToIDB, refreshSettings, resolveHealthCheck])

  // On logout: reset init flag so next login re-runs init.
  // IDB is kept for fast re-login; init() checks cf_idb_owner to clear if a different user logs in.
  useEffect(() => {
    if (!isAuthenticated) {
      didInitRef.current = false
    }
  }, [isAuthenticated])

  // ── Family Members CRUD ──
  const addMember = useCallback(async (data) => {
    const result = await api.createMember(data)
    // Auto-invite: register in Script Properties + share sheet so they can log in.
    // Skip it for yourself: your own email already owns the sheet.
    const email = (data.email || '').trim().toLowerCase()
    const isOwnEmail = email && email === (user?.email || '').trim().toLowerCase()
    if (email && !isOwnEmail && data.relationship !== 'Self') {
      try {
        await api.inviteFamilyMember(data.email, data.memberName)
      } catch (e) {
        // The member IS saved in the sheet; only sharing the sheet failed
        // (e.g. this email already uses Capital Friends with another family).
        // Don't treat it as a failed save: return a warning for the page to show.
        await refreshMembers()
        return { ...result, inviteWarning: e.message }
      }
    }
    await refreshMembers()
    return result
  }, [refreshMembers, user])

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
    // the loan is created in the same save: load both lists together so they appear at the same time
    await Promise.all([refreshOtherInvestments(), data.quickLoan ? refreshLiabilities() : null])
    return result
  }, [refreshOtherInvestments, refreshLiabilities])

  const updateOtherInvestment = useCallback(async (id, data) => {
    await api.updateOtherInvestment({ investmentId: id, ...data })
    await Promise.all([refreshOtherInvestments(), refreshLiabilities()]) // linked liability may have changed
  }, [refreshOtherInvestments, refreshLiabilities])

  const deleteOtherInvestment = useCallback(async (id) => {
    await api.deleteOtherInvestment(id)
    await refreshOtherInvestments()
  }, [refreshOtherInvestments])

  // ── Goals CRUD ──
  // _extras ({ repeat, payYears }) are kept in the Settings tab (GoalExtras), not in the Goals sheet
  const saveGoalExtras = useCallback(async (goalId, extras) => {
    if (!goalId || !extras) return
    let all = {}
    try { all = JSON.parse(settingsRef.current?.GoalExtras || '{}') || {} } catch { all = {} }
    const e = { repeat: Math.max(0, Number(extras.repeat) || 0), payYears: Math.max(1, Number(extras.payYears) || 1) }
    // orig: the full amount and years of a goal paid over several years, so a repeat starts again from them
    if (extras.orig && Number(extras.orig.amount) > 0) e.orig = { amount: Math.round(Number(extras.orig.amount)), payYears: Math.max(1, Number(extras.orig.payYears) || 1) }
    const had = !!all[goalId]
    if (e.repeat === 0 && e.payYears === 1 && !e.orig) { if (!had) return; delete all[goalId] } else all[goalId] = e
    await updateSettings({ GoalExtras: JSON.stringify(all) })
  }, [updateSettings])
  const addGoal = useCallback(async (data) => {
    const { _extras, ...goal } = data || {}
    const result = await api.createGoal(goal)
    let exErr = null
    if (_extras) { try { await saveGoalExtras(result?.goalId, _extras) } catch (e) { exErr = e } }
    await refreshGoals()
    if (exErr) throw new Error(`Goal saved, but its Repeats / Paid setting was not: ${exErr.message}. Edit the goal to set it again.`)
    return result
  }, [refreshGoals, saveGoalExtras])

  const updateGoal = useCallback(async (id, data) => {
    const { _extras, ...goal } = data || {}
    await api.updateGoal(id, goal)
    let exErr = null
    if (_extras) { try { await saveGoalExtras(id, _extras) } catch (e) { exErr = e } }
    await refreshGoals()
    if (exErr) throw new Error(`Goal saved, but its Repeats / Paid setting was not: ${exErr.message}. Edit the goal to set it again.`)
  }, [refreshGoals, saveGoalExtras])

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
  // several goals at once (the goals pool): one save per goal, one refresh at the end — even if a save fails
  const updateManyGoalMappings = useCallback(async (list) => {
    try { for (const [goalId, mappings] of list) await api.updateGoalMappings(goalId, mappings) }
    finally { await refreshGoals() }
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

  const importStocks = useCallback(async (data) => {
    const result = await api.importStocks(data)
    await refreshStocks()
    return result
  }, [refreshStocks])

  const sellStock = useCallback(async (data) => {
    const result = await api.sellStock(data)
    await refreshStocks()
    return result
  }, [refreshStocks])

  const editStockTransaction = useCallback(async (data) => {
    await api.editStockTransaction(data)
    await refreshStocks()
  }, [refreshStocks])

  const deleteStockTransaction = useCallback(async (transactionId) => {
    await api.deleteStockTransaction(transactionId)
    await refreshStocks()
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

  const redeemMFBulk = useCallback(async (redemptions) => {
    const result = await api.redeemMFBulk(redemptions)
    await Promise.all([refreshMF(), refreshGoals()])
    return result
  }, [refreshMF, refreshGoals])

  const switchMF = useCallback(async (data) => {
    const result = await api.switchMF(data)
    await refreshMF()
    return result
  }, [refreshMF])

  const executeMFPlan = useCallback(async (switches, redemptions) => {
    const result = await api.executeMFPlan(switches, redemptions)
    await Promise.all([refreshMF(), refreshGoals()])
    return result
  }, [refreshMF, refreshGoals])

  const updateHoldingAllocations = useCallback(async (portfolioId, allocations) => {
    await api.updateAllocations(portfolioId, allocations)
    await refreshMF()
  }, [refreshMF])

  // goal-linked portfolios: keep / bring back the user's own targets (portfolio sheet column V)
  const restoreOriginalTargets = useCallback(async (portfolioId) => {
    const r = await api.originalTargets(portfolioId, 'restore')
    await refreshMF()
    return r
  }, [refreshMF])

  const toggleLumpsumRestricted = useCallback(async (portfolioId, fundCode, restricted) => {
    await api.toggleLumpsumRestricted(portfolioId, fundCode, restricted)
    await refreshMF()
  }, [refreshMF])

  const toggleSipRestricted = useCallback(async (portfolioId, fundCode, restricted) => {
    await api.toggleSipRestricted(portfolioId, fundCode, restricted)
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

  const deleteFundFromPortfolio = useCallback(async (portfolioId, fundCode) => {
    const result = await api.deleteFundFromPortfolio(portfolioId, fundCode)
    if (!result?.success) throw new Error(result?.message || 'Failed to delete fund')
    await refreshMF()
    return result
  }, [refreshMF])

  // ── Asset Allocation ──
  const updateAssetAllocation = useCallback(async (data) => {
    const result = await api.saveAssetAllocation(data)
    // Optimistically update local state
    touch('assetAllocations')
    setAssetAllocations(prev => {
      const list = prev || []
      const idx = list.findIndex(a => a.fundCode === data.fundCode)
      const assetAlloc = {}
      if (data.equity) assetAlloc.Equity = data.equity
      if (data.debt) assetAlloc.Debt = data.debt
      if (data.cash) assetAlloc.Cash = data.cash
      if (data.realEstate) assetAlloc['Real Estate'] = data.realEstate
      if (data.commodities) assetAlloc.Commodities = data.commodities
      if (data.other) assetAlloc.Other = data.other
      // Include custom asset fields
      if (data.customAsset) Object.entries(data.customAsset).forEach(([k, v]) => { if (v > 0) assetAlloc[k] = v })
      const equityAlloc = {}
      if (data.giantCap) equityAlloc.Giant = data.giantCap
      if (data.largeCap) equityAlloc.Large = data.largeCap
      if (data.midCap) equityAlloc.Mid = data.midCap
      if (data.smallCap) equityAlloc.Small = data.smallCap
      if (data.microCap) equityAlloc.Micro = data.microCap
      if (data.customCap) Object.entries(data.customCap).forEach(([k, v]) => { if (v > 0) equityAlloc[k] = v })
      const geoAlloc = {}
      if (data.geoIndia) geoAlloc.India = data.geoIndia
      if (data.geoGlobal) geoAlloc.Global = data.geoGlobal
      if (data.customGeo) Object.entries(data.customGeo).forEach(([k, v]) => { if (v > 0) geoAlloc[k] = v })
      const entry = { fundCode: data.fundCode, fundName: data.fundName, assetAllocation: assetAlloc, equityAllocation: equityAlloc, geoAllocation: geoAlloc }
      if (idx >= 0) { const next = [...list]; next[idx] = entry; return next }
      return [...list, entry]
    })
    return result
  }, [])

  // ── Filtered helpers ──
  const activeMembers = (members || []).filter((m) => m.status === 'Active')
  const activeBanks = (banks || []).filter((b) => b.status === 'Active')
  const activeInvestmentAccounts = (investmentAccounts || []).filter((a) => a.status === 'Active')

  return (
    <DataContext.Provider value={{
      // Loading state
      loading, isSetupLoading, isRefreshing, freshLoad, settingsAt, error, refreshData,
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
      goalPortfolioMappings, updateGoalMappings, assetAllocations, updateAssetAllocation,
      executeMFPlan,
      // Stock data
      stockPortfolios, stockHoldings, stockTransactions,
      // Stock CRUD
      addStockPortfolio, updateStockPortfolio, deleteStockPortfolio,
      buyStock, importStocks, sellStock, editStockTransaction, deleteStockTransaction, refreshStocks,
      // MF data
      mfPortfolios, mfHoldings, mfTransactions,
      // MF CRUD
      addMFPortfolio, updateMFPortfolio, deleteMFPortfolio,
      investMF, redeemMF, redeemMFBulk, switchMF, updateHoldingAllocations, restoreOriginalTargets, toggleLumpsumRestricted, toggleSipRestricted, deleteMFTransaction, editMFTransaction, deleteFundFromPortfolio,
      // Settings
      settings, updateSettings, refreshSettings, updateManyGoalMappings, settling, refreshUntilSettled,
      // Health Check
      healthCheckCompleted, healthCheckAnswers, completeHealthCheck,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}

// Public pages (the goal planner) mount app forms without a signed-in user: empty lists, no settings, no-op actions.
export function GuestDataProvider({ children }) {
  const noop = async () => ({ success: true })
  const value = { loading: false, activeMembers: [], members: [], settings: null, goalList: [], mfHoldings: [], mfPortfolios: [], stockPortfolios: [], otherInvList: [], liabilityList: [], banks: [],
    addGoal: noop, updateGoal: noop, deleteGoal: noop, updateGoalMappings: noop }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

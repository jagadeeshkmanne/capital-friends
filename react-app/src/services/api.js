/**
 * Capital Friends - API Service Layer
 *
 * Communicates with GAS via the Apps Script Execution API.
 * Each API call runs as the authenticated user (true privacy).
 * Uses OAuth access tokens (not ID tokens).
 */

// GAS IDs — Script ID for devMode, Deployment ID for production
const SCRIPT_ID = import.meta.env.VITE_GAS_SCRIPT_ID || ''
const DEPLOYMENT_ID = import.meta.env.VITE_GAS_DEPLOYMENT_ID || ''

const TOKEN_KEY = 'cf_access_token'
const TOKEN_EXPIRY_KEY = 'cf_token_expiry'
const USER_NAME_KEY = 'cf_user_name'

// ── Token Management ──

export function getStoredToken() {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (expiry && Date.now() > Number(expiry)) {
    clearToken()
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(accessToken, expiresInSeconds = 3500) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSeconds * 1000))
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(USER_NAME_KEY)
}

export function isTokenValid() {
  return !!getStoredToken()
}

export function setStoredUserName(name) {
  localStorage.setItem(USER_NAME_KEY, name)
}

function getStoredUserName() {
  return localStorage.getItem(USER_NAME_KEY) || ''
}

// ── Token Refresh (set by AuthContext) ──

let _refreshTokenFn = null

export function setTokenRefreshFn(fn) {
  _refreshTokenFn = fn
}

// ── API Call (Apps Script Execution API) ──

export async function callAPI(action, params = {}, retry = true) {
  const token = getStoredToken()
  if (!token) {
    throw new Error('Not authenticated. Please sign in.')
  }

  // devMode: true uses Script ID (latest saved, owner only)
  // devMode: false uses Deployment ID (published, all users)
  const devMode = import.meta.env.DEV
  const apiId = devMode ? SCRIPT_ID : (DEPLOYMENT_ID || SCRIPT_ID)
  const response = await fetch(
    `https://script.googleapis.com/v1/scripts/${apiId}:run`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: 'apiRouter',
        devMode,
        parameters: [{ action, params, userName: getStoredUserName() }],
      }),
    }
  )

  const data = await response.json()

  // Handle Apps Script API-level errors (auth, permission, quota)
  if (data.error) {
    // Token expired or permission denied — try silent refresh
    if (retry && (data.error.code === 401 || data.error.code === 403 ||
        data.error.status === 'UNAUTHENTICATED' || data.error.status === 'PERMISSION_DENIED')) {
      if (_refreshTokenFn) {
        try {
          await _refreshTokenFn()
          return callAPI(action, params, false) // retry once
        } catch {
          // Refresh failed — fall through to throw
        }
      }
    }

    // Script execution error (runtime error in GAS code)
    if (data.error.details && data.error.details.length > 0) {
      const detail = data.error.details[0]
      throw new Error(detail.errorMessage || 'Script execution error')
    }

    throw new Error(data.error.message || 'API error')
  }

  // Successful execution — extract result from response
  if (data.response && data.response.result !== undefined) {
    const result = data.response.result
    if (result && !result.success) {
      const err = new Error(result.error || 'Unknown error')
      err.code = result.code
      throw err
    }
    const returnedData = result ? result.data : null
    // GAS CRUD functions return { success: false, message } inside data — check inner result
    if (returnedData && returnedData.success === false) {
      throw new Error(returnedData.message || 'Operation failed')
    }
    return returnedData
  }

  throw new Error('Unexpected response format')
}

// ── Convenience Methods ──

// Auth
export const getMe = () => callAPI('auth:me')
export const getSharedMembers = () => callAPI('auth:shared-members')
export const inviteFamilyMember = (email, name) => callAPI('auth:invite', { email, name })
export const removeFamilyMember = (email) => callAPI('auth:remove-member', { email })

// Bulk load
export const loadAllData = () => callAPI('data:load-all')

// Family Members
export const getMembers = () => callAPI('members:list')
export const createMember = (data) => callAPI('member:create', data)
export const updateMember = (data) => callAPI('member:update', data)
export const deleteMember = (memberId) => callAPI('member:delete', { memberId })

// Bank Accounts
export const getBanks = () => callAPI('banks:list')
export const createBank = (data) => callAPI('bank:create', data)
export const updateBank = (data) => callAPI('bank:update', data)
export const deleteBank = (accountId) => callAPI('bank:delete', { accountId })

// Investment Accounts
export const getInvestmentAccounts = () => callAPI('invaccounts:list')
export const createInvestmentAccount = (data) => callAPI('invacct:create', data)
export const updateInvestmentAccount = (data) => callAPI('invacct:update', data)
export const deleteInvestmentAccount = (accountId) => callAPI('invacct:delete', { accountId })

// MF Portfolios
export const getMFPortfolios = () => callAPI('portfolios:list')
export const createMFPortfolio = (data) => callAPI('portfolio:create', data)
export const updateMFPortfolio = (data) => callAPI('portfolio:update', data)
export const deleteMFPortfolio = (portfolioId) => callAPI('portfolio:delete', { portfolioId })

// MF Holdings & Transactions
export const getPortfolioHoldings = (portfolioId) => callAPI('portfolio:holdings', { portfolioId })
export const investMF = (data) => callAPI('mf:invest', data)
export const redeemMF = (data) => callAPI('mf:redeem', data)
export const switchMF = (data) => callAPI('mf:switch', data)
export const updateAllocations = (portfolioId, allocations) => callAPI('mf:allocations-update', { portfolioId, allocations })
export const searchFunds = (query) => callAPI('funds:search', { query })

// Goals
export const getGoals = () => callAPI('goals:list')
export const createGoal = (data) => callAPI('goal:create', data)
export const updateGoal = (goalId, data) => callAPI('goal:update', { goalId, ...data })
export const deleteGoal = (goalId) => callAPI('goal:delete', { goalId })
export const getGoalMappings = () => callAPI('goal:mappings-list')
export const updateGoalMappings = (goalId, mappings) => callAPI('goal:mappings-update', { goalId, mappings })

// Insurance
export const getInsurance = () => callAPI('insurance:list')
export const createInsurance = (data) => callAPI('insurance:create', data)
export const updateInsurance = (data) => callAPI('insurance:update', data)
export const deleteInsurance = (policyId) => callAPI('insurance:delete', { policyId })

// Liabilities
export const getLiabilities = () => callAPI('liabilities:list')
export const createLiability = (data) => callAPI('liability:create', data)
export const updateLiability = (data) => callAPI('liability:update', data)
export const deleteLiability = (liabilityId) => callAPI('liability:delete', { liabilityId })

// Other Investments
export const getOtherInvestments = () => callAPI('otherinv:list')
export const createOtherInvestment = (data) => callAPI('otherinv:create', data)
export const updateOtherInvestment = (data) => callAPI('otherinv:update', data)
export const deleteOtherInvestment = (investmentId) => callAPI('otherinv:delete', { investmentId })

// Stock Portfolios
export const getStockPortfolios = () => callAPI('stock-portfolios:list')
export const createStockPortfolio = (data) => callAPI('stock-portfolio:create', data)
export const updateStockPortfolio = (data) => callAPI('stock-portfolio:update', data)
export const deleteStockPortfolio = (portfolioId) => callAPI('stock-portfolio:delete', { portfolioId })

// Stock Transactions
export const buyStock = (data) => callAPI('stock:buy', data)
export const sellStock = (data) => callAPI('stock:sell', data)
export const getStockHoldings = (portfolioId) => callAPI('stock:holdings', { portfolioId })
export const getStockTransactions = (portfolioId) => callAPI('stock:transactions', { portfolioId })

// Bulk Data (for cache refresh)
export const getAllMFHoldings = () => callAPI('mf-holdings:list')
export const getAllMFTransactions = () => callAPI('mf-transactions:list')
export const getAllStockHoldings = () => callAPI('stock-holdings:list-all')
export const getAllStockTransactions = () => callAPI('stock-transactions:list-all')

// Reminders
export const getReminders = () => callAPI('reminders:list')
export const createReminder = (data) => callAPI('reminder:create', data)
export const updateReminder = (data) => callAPI('reminder:update', data)
export const deleteReminder = (reminderId) => callAPI('reminder:delete', { reminderId })

// Health Check
export const getHealthCheckStatus = () => callAPI('healthcheck:status')
export const saveHealthCheck = (answers) => callAPI('healthcheck:save', answers)
export const getHealthCheckAnswers = () => callAPI('healthcheck:get')

// Settings
export const getSettings = () => callAPI('settings:list')
export const saveSettings = (data) => callAPI('settings:update', data)

// Market Data
export const getMarketData = () => callAPI('market:data')

// Master Data Refresh
export const refreshMasterData = () => callAPI('data:refresh-master')
export const checkDataFreshness = () => callAPI('data:check-freshness')

// Diagnostics (for testing in browser console)
export const checkTriggers = () => callAPI('test:triggers')
export const runDiagnostics = () => callAPI('test:diagnose')

// Expose callAPI on window for browser console debugging
if (typeof window !== 'undefined') {
  window._cf = { callAPI, checkTriggers: () => callAPI('test:triggers'), diagnose: () => callAPI('test:diagnose') }
}

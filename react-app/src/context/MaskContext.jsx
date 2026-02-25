import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const MaskContext = createContext()

const STORAGE_KEY = 'cf-mask-data'

// ── Masking functions ──

function maskPAN(val) {
  if (!val || val.length < 4) return '••••••••••'
  return '••••••' + val.slice(-4)
}

function maskAadhaar(val) {
  if (!val || val.length < 4) return '•••• •••• ••••'
  return '•••• •••• ' + val.slice(-4)
}

function maskMobile(val) {
  if (!val || val.length < 3) return '••••••••••'
  return '•••••••' + val.slice(-3)
}

function maskEmail(val) {
  if (!val) return '•••@•••'
  const [local, domain] = val.split('@')
  if (!domain) return '•••@•••'
  const maskedLocal = local.charAt(0) + '•••'
  const domainParts = domain.split('.')
  const maskedDomain = domainParts[0].charAt(0) + '•••' + (domainParts.length > 1 ? '.' + domainParts.slice(1).join('.') : '')
  return maskedLocal + '@' + maskedDomain
}

function maskAccountNumber(val) {
  if (!val || val.length < 4) return '••••••••'
  return '••••••' + val.slice(-4)
}

function maskClientId(val) {
  if (!val || val.length < 3) return '•••••'
  return '•••' + val.slice(-3)
}

function maskPolicyNumber(val) {
  if (!val || val.length < 4) return '••••••••'
  return '••••••' + val.slice(-4)
}

const MASK_FNS = {
  pan: maskPAN,
  aadhaar: maskAadhaar,
  mobile: maskMobile,
  email: maskEmail,
  account: maskAccountNumber,
  clientId: maskClientId,
  policy: maskPolicyNumber,
}

export function MaskProvider({ children }) {
  const [masked, setMasked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(masked)) } catch {}
  }, [masked])

  const toggleMask = useCallback(() => setMasked((m) => !m), [])

  // maskValue(value, type) — returns masked or original based on state
  const mv = useCallback((val, type) => {
    if (!masked || val == null || val === '') return val
    const fn = MASK_FNS[type]
    return fn ? fn(String(val)) : val
  }, [masked])

  return (
    <MaskContext.Provider value={{ masked, toggleMask, mv }}>
      {children}
    </MaskContext.Provider>
  )
}

export function useMask() {
  return useContext(MaskContext)
}

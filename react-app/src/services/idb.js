/**
 * Capital Friends - IndexedDB Cache Layer
 *
 * Simple key-value cache using IndexedDB.
 * Stores each data category (members, banks, mfTransactions, etc.)
 * as a separate record in a single object store.
 *
 * All methods are best-effort: errors are caught and logged,
 * never thrown. The app works without IDB (just no persistent cache).
 */

const DB_NAME = 'capital-friends'
const DB_VERSION = 1
const STORE_NAME = 'cache'

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.warn('[idb] Failed to open database:', request.error)
      _dbPromise = null
      reject(request.error)
    }
  })

  return _dbPromise
}

/**
 * Get a single cached value by key.
 * @param {string} key - e.g. 'members', 'mfTransactions'
 * @returns {Promise<any|null>}
 */
export async function get(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result ? request.result.data : null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Get a single cached record with metadata (includes updatedAt).
 * @param {string} key
 * @returns {Promise<{data: any, updatedAt: number}|null>}
 */
export async function getWithMeta(key) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Store a single value by key.
 */
export async function put(key, data) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ key, data, updatedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // silently fail
  }
}

/**
 * Get ALL cached records as a flat object.
 * @returns {Promise<Object>} e.g. { members: [...], banks: [...], ... }
 */
export async function getAll() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => {
        const result = {}
        for (const record of request.result || []) {
          result[record.key] = record.data
        }
        resolve(result)
      }
      request.onerror = () => resolve({})
    })
  } catch {
    return {}
  }
}

/**
 * Write multiple keys in a single transaction.
 * @param {Object} entries - e.g. { members: [...], banks: [...] }
 */
export async function putMany(entries) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const now = Date.now()
      for (const [key, data] of Object.entries(entries)) {
        store.put({ key, data, updatedAt: now })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // silently fail
  }
}

/**
 * Clear all cached data. Called on logout.
 */
export async function clearAll() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // silently fail
  }
}

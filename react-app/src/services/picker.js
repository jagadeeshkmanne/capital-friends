/**
 * Google Picker - one-time "open the family sheet" step for family members.
 *
 * With the drive.file permission the app can only open files it created or files
 * the user picked here. A family member's sheet belongs to the owner, so the member
 * picks it once; after that Google remembers the grant.
 *
 * No API key needed: the Picker works with the user's OAuth token + the Cloud
 * project number (the first part of the OAuth client ID).
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const PROJECT_NUMBER = import.meta.env.VITE_GOOGLE_PROJECT_NUMBER || CLIENT_ID.split('-')[0]

let _gapiPromise = null

function loadPickerLib() {
  if (window.google?.picker) return Promise.resolve()
  if (!_gapiPromise) {
    _gapiPromise = new Promise((resolve, reject) => {
      const done = () => window.gapi.load('picker', { callback: resolve, onerror: reject })
      if (window.gapi) return done()
      const s = document.createElement('script')
      s.src = 'https://apis.google.com/js/api.js'
      s.async = true
      s.onload = done
      s.onerror = () => { _gapiPromise = null; reject(new Error('Could not load Google Picker')) }
      document.head.appendChild(s)
    })
  }
  return _gapiPromise
}

/**
 * Show the Picker filtered to the family sheet.
 * Resolves with the picked file id, or null if the user closed it.
 */
export async function pickSpreadsheet({ token, title }) {
  await loadPickerLib()
  const gp = window.google.picker
  return new Promise((resolve) => {
    const view = new gp.DocsView(gp.ViewId.SPREADSHEETS)
      .setMode(gp.DocsViewMode.LIST)
      .setIncludeFolders(false)
    if (title) view.setQuery(title)
    const picker = new gp.PickerBuilder()
      .setOAuthToken(token)
      .setAppId(PROJECT_NUMBER)
      .addView(view)
      .setTitle('Open your family\'s Capital Friends sheet')
      .setCallback((data) => {
        const action = data[gp.Response.ACTION]
        if (action === gp.Action.PICKED) {
          const doc = data[gp.Response.DOCUMENTS]?.[0]
          resolve(doc ? doc[gp.Document.ID] : null)
        } else if (action && action !== gp.Action.LOADED) {
          // cancelled or closed in any other way
          resolve(null)
        }
      })
      .build()
    picker.setVisible(true)
  })
}

import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, FolderOpen, FilePlus2, Loader2 } from 'lucide-react'
import * as api from '../services/api'
import * as idb from '../services/idb'
import { pickSpreadsheet } from '../services/picker'

/**
 * One-time "open your sheet" step (drive.file permission).
 * - Family member: pick the owner's shared sheet once in the Google Picker.
 * - Owner whose sheet the app can't open: pick it once, or (if it was really
 *   deleted) start a new, empty sheet.
 * The backend answers NEEDS_FILE_PICKER until this is done; every API call that
 * hits it waits on this dialog, then retries.
 */
export default function FilePickerGate() {
  const [info, setInfo] = useState(null)
  const [picking, setPicking] = useState(false)    // Google Picker is open
  const [creating, setCreating] = useState(false)  // new sheet is being created
  const [confirmNew, setConfirmNew] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(null) // { promise, resolve }

  useEffect(() => {
    api.setFilePickerHandler((details) => {
      if (pending.current) return pending.current.promise
      let resolve
      const promise = new Promise((r) => { resolve = r })
      pending.current = { promise, resolve }
      setError('')
      setConfirmNew(false)
      setInfo(details)
      return promise
    })
    return () => api.setFilePickerHandler(null)
  }, [])

  // If the Picker is closed without telling us (X button, Esc), unlock the buttons
  // as soon as the user is back on the page.
  useEffect(() => {
    if (!picking) return
    const onFocus = () => setTimeout(() => setPicking(false), 800)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [picking])

  function finish(ok) {
    const p = pending.current
    pending.current = null
    setInfo(null)
    setPicking(false)
    setCreating(false)
    setConfirmNew(false)
    if (p) p.resolve(ok)
  }

  async function openPicker() {
    setPicking(true)
    setError('')
    try {
      const token = api.getStoredToken()
      const id = await pickSpreadsheet({ token, title: info.sheetTitle })
      setPicking(false)
      if (!id) return
      if (id !== info.spreadsheetId) {
        setError('That is a different file. Please pick the sheet named "' + info.sheetTitle + '".')
        return
      }
      finish(true)
    } catch (e) {
      setError(e.message || 'Could not open Google Picker')
      setPicking(false)
    }
  }

  function reloadFresh() {
    // Drop the cached copy of the old sheet so the app loads the new one.
    Promise.resolve()
      .then(() => idb.clearAll())
      .catch(() => {})
      .finally(() => { window.location.replace('/dashboard') })
  }

  async function createNewSheet() {
    setCreating(true)
    setError('')
    try {
      await api.callAPI('auth:recreate-sheet', {}, true, true)
      reloadFresh()
    } catch (e) {
      // The sheet may still have been created (slow network / long setup):
      // check a few times before showing an error.
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 10000))
        try {
          const me = await api.callAPI('auth:me', {}, true, true)
          if (me) { reloadFresh(); return }
        } catch { /* still not ready */ }
      }
      setError((e && e.message) || 'Could not create a new sheet. Please reload the page and try again.')
      setCreating(false)
    }
  }

  if (!info) return null

  const busy = picking || creating

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-[var(--bg-inset)]">
            <FileSpreadsheet size={20} className="text-emerald-500" />
          </div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">{info.isOwner ? 'Open your sheet' : 'Open your family sheet'}</h2>
        </div>

        {creating ? (
          <div className="py-6 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-emerald-500" />
            <p className="text-sm font-semibold text-[var(--text-primary)] mt-3">Creating your new sheet…</p>
            <p className="text-xs text-[var(--text-dim)] mt-1">This takes about 1–2 minutes. The app will open by itself.</p>
          </div>
        ) : (
          <>
            {info.isOwner ? (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Google now asks you to choose your Capital Friends sheet once, so the app can keep opening it.
                Your data is safe in your Google Drive.
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {info.ownerEmail ? <><span className="font-semibold text-[var(--text-primary)]">{info.ownerEmail}</span> shared</> : 'Your family shared'} their
                Capital Friends sheet with you. Google asks you to open it once, so the app can show it to you.
              </p>
            )}
            <p className="text-xs text-[var(--text-dim)] mt-2">
              In the next window, select <span className="font-semibold">{info.sheetTitle}</span> and click Select. You only do this once.
            </p>

            {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}

            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={openPicker}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                <FolderOpen size={16} />
                {picking ? 'Picker is open…' : (info.isOwner ? 'Choose my sheet' : 'Choose the sheet')}
              </button>

              {info.canRecreate && !confirmNew && (
                <button
                  onClick={() => { setError(''); setConfirmNew(true) }}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-light,var(--border))] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
                >
                  <FilePlus2 size={16} />
                  My sheet is deleted – start a new one
                </button>
              )}

              {info.canRecreate && confirmNew && (
                <div className="p-3 rounded-lg border border-rose-500/50 bg-rose-500/5">
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    This creates a <span className="font-semibold text-[var(--text-primary)]">new, empty</span> Capital Friends sheet.
                    Only do this if your old sheet is really gone (check Google Drive and its Trash first).
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={createNewSheet} className="flex-1 px-3 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
                      Yes, create a new sheet
                    </button>
                    <button onClick={() => setConfirmNew(false)} className="px-3 py-2 rounded-md border border-[var(--border)] text-xs text-[var(--text-muted)]">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => finish(false)}
                disabled={creating}
                className="w-full px-4 py-2 rounded-lg text-xs text-[var(--text-dim)] hover:bg-[var(--bg-hover)]"
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

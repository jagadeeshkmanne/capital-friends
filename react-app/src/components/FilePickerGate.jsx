import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import * as api from '../services/api'
import { pickSpreadsheet } from '../services/picker'

/**
 * One-time step for family members: open the owner's sheet in the Google Picker.
 * The backend answers NEEDS_FILE_PICKER until the member has picked it once.
 * Every API call that hits it waits on the same dialog, then retries.
 */
export default function FilePickerGate() {
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [askRecreate, setAskRecreate] = useState(false)
  const pending = useRef(null) // { promise, resolve }

  useEffect(() => {
    api.setFilePickerHandler((details) => {
      if (pending.current) return pending.current.promise
      let resolve
      const promise = new Promise((r) => { resolve = r })
      pending.current = { promise, resolve }
      setError('')
      setInfo(details)
      return promise
    })
    return () => api.setFilePickerHandler(null)
  }, [])

  function finish(ok) {
    const p = pending.current
    pending.current = null
    setInfo(null)
    setBusy(false)
    if (p) p.resolve(ok)
  }

  async function openPicker() {
    setBusy(true)
    setError('')
    try {
      const token = api.getStoredToken()
      const id = await pickSpreadsheet({ token, title: info.sheetTitle })
      if (!id) { setBusy(false); return }
      if (id !== info.spreadsheetId) {
        setError('That is a different file. Please pick the sheet named "' + info.sheetTitle + '".')
        setBusy(false)
        return
      }
      finish(true)
    } catch (e) {
      setError(e.message || 'Could not open Google Picker')
      setBusy(false)
    }
  }

  async function recreate() {
    setBusy(true)
    setError('')
    try {
      await api.callAPI('auth:recreate-sheet', {}, true, true)
      window.location.reload()
    } catch (e) {
      setError(e.message || 'Could not create a new sheet')
      setBusy(false)
    }
  }

  if (!info) return null

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
        {info.canRecreate && !askRecreate && (
          <button onClick={() => setAskRecreate(true)} className="text-xs text-[var(--text-dim)] underline mt-3">
            I deleted my sheet - start with a new, empty one
          </button>
        )}
        {info.canRecreate && askRecreate && (
          <div className="mt-3 p-3 rounded-lg border border-rose-500/40 text-xs text-[var(--text-muted)]">
            This creates a new, empty Capital Friends sheet. Only do this if your old sheet is really gone
            (check Google Drive and its Trash first).
            <div className="flex gap-2 mt-2">
              <button onClick={recreate} disabled={busy} className="px-3 py-1.5 rounded-md bg-rose-600 text-white font-semibold disabled:opacity-60">Create new sheet</button>
              <button onClick={() => setAskRecreate(false)} className="px-3 py-1.5 rounded-md border border-[var(--border)]">Cancel</button>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button
            onClick={openPicker}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? 'Opening…' : 'Choose the sheet'}
          </button>
          <button
            onClick={() => finish(false)}
            className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}

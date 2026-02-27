import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

const ConfirmContext = createContext()

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  const confirm = useCallback((message, { title = 'Confirm', confirmLabel = 'Yes, proceed', cancelLabel = 'Cancel', destructive = true } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ message, title, confirmLabel, cancelLabel, destructive })
    })
  }, [])

  function handleConfirm() {
    resolveRef.current?.(true)
    resolveRef.current = null
    setDialog(null)
  }

  function handleCancel() {
    resolveRef.current?.(false)
    resolveRef.current = null
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" onClick={handleCancel}>
          <div className="fixed inset-0 bg-black/60" />
          <div
            className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm p-5 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${dialog.destructive ? 'bg-rose-500/15' : 'bg-violet-500/15'}`}>
                <AlertTriangle size={18} className={dialog.destructive ? 'text-[var(--accent-rose)]' : 'text-violet-400'} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{dialog.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{dialog.message}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                {dialog.cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                autoFocus
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                  dialog.destructive
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}

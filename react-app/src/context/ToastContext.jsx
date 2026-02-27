import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [blockUI, setBlockUI] = useState(null)
  const idRef = useRef(0)

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showBlockUI = useCallback((message = 'Saving...') => {
    setBlockUI(message)
  }, [])

  const hideBlockUI = useCallback(() => {
    setBlockUI(null)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, showBlockUI, hideBlockUI }}>
      {children}

      {/* Block UI overlay */}
      {blockUI && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-[var(--bg-card)] rounded-xl px-8 py-6 border border-[var(--border)] shadow-2xl">
            <span className="w-7 h-7 border-[2.5px] border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">{blockUI}</span>
          </div>
        </div>
      )}

      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl border text-sm font-medium animate-fade-in ${
                t.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-[var(--accent-rose)]'
                  : t.type === 'warning'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}
              style={{ backdropFilter: 'blur(12px)' }}
            >
              {t.type === 'error' ? <XCircle size={16} /> : t.type === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <span>{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

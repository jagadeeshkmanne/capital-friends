import { useState } from 'react'
import { X, Heart, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const UPI_ID = 'jagadeeshmanne.hdfc@kphdfc'
const UPI_URI = `upi://pay?pa=${UPI_ID}&pn=Jagadeesh%20Manne&cu=INR`

export default function DonateDialog({ open, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  function copyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)]">
          <X size={16} className="text-[var(--text-muted)]" />
        </button>

        <div className="pt-6 pb-5 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
            <Heart size={24} className="text-pink-400" />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Support the Developer</h3>
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Capital Friends is free and always will be. If it helps your family, a small donation means a lot!
          </p>

          {/* QR Code — generated at runtime */}
          <div className="mt-4 bg-white rounded-xl p-3 inline-block mx-auto">
            <QRCodeSVG value={UPI_URI} size={192} level="M" />
          </div>

          <p className="text-xs text-[var(--text-dim)] mt-3">Scan with any UPI app</p>

          {/* UPI ID + Copy */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="bg-[var(--bg-inset)] rounded-lg px-3 py-2 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-dim)] mb-0.5">UPI ID</p>
              <p className="text-sm font-mono font-semibold text-[var(--text-primary)] select-all">{UPI_ID}</p>
            </div>
            <button
              onClick={copyUPI}
              className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 transition-colors flex items-center gap-1.5"
            >
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-dim)] mt-4">
            Developed with {'\u2764\uFE0F'} by <span className="font-semibold text-[var(--text-muted)]">Jagadeesh Manne</span>
          </p>
        </div>
      </div>
    </div>
  )
}

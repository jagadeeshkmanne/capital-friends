import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, UserPlus, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const actions = [
  { label: 'Buy SIP',       icon: TrendingUp,     path: '/portfolio' },
  { label: 'Buy Lumpsum',   icon: TrendingUp,     path: '/portfolio' },
  { label: 'Sell / Redeem',  icon: TrendingDown,   path: '/portfolio' },
  { label: 'Switch Funds',   icon: ArrowLeftRight, path: '/portfolio' },
  { label: 'Add Member',     icon: UserPlus,       path: '/family' },
  { label: 'Add Reminder',   icon: Bell,           path: '/reports' },
]

export default function QuickAction() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30">
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="relative z-20 mb-3 space-y-2">
            {actions.map(({ label, icon: Icon, path }) => (
              <button key={label} onClick={() => { navigate(path); setOpen(false) }}
                className="flex items-center gap-2.5 ml-auto bg-[#1a2038] rounded-full pl-4 pr-3 py-2 shadow-lg border border-white/10 hover:border-white/20 transition-all"
              >
                <span className="text-sm font-medium text-slate-200">{label}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                  <Icon size={13} className="text-white" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <button onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ml-auto ${
          open ? 'bg-slate-600 rotate-45' : 'bg-gradient-to-br from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600'
        }`}
      >
        <Plus size={22} className={`text-white transition-transform ${open ? '-rotate-45' : ''}`} />
      </button>
    </div>
  )
}

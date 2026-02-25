import { Construction } from 'lucide-react'
import { useLocation } from 'react-router-dom'

export default function Placeholder() {
  const location = useLocation()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-violet-500/15 rounded-2xl flex items-center justify-center mb-4">
        <Construction size={32} className="text-violet-400" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Coming Soon
      </h3>
      <p className="text-[var(--text-muted)] text-sm max-w-sm">
        This page is under construction. Navigate using the sidebar to explore
        available sections.
      </p>
      <p className="text-xs text-[var(--text-dim)] mt-3 font-mono">
        {location.pathname}
      </p>
    </div>
  )
}

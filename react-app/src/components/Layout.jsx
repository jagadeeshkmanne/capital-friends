import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import BrandedLoading from './BrandedLoading'
import { useData } from '../context/DataContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { loading, error } = useData()

  if (loading) {
    return <BrandedLoading />
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <img src="/logo-small.png" alt="Capital Friends" className="h-16 w-16 opacity-50" />
          <p className="text-rose-400 text-sm font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg-base)] overflow-hidden">
      {/* Header spans full width on top */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {/* Below header: sidebar + content side by side */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main className="flex-1 overflow-y-auto overscroll-contain pb-20 lg:pb-0">
          <div className="px-3 sm:px-4 py-3 sm:py-4 w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}

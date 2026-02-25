import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X, ChevronDown } from 'lucide-react'
import navigation from '../data/navigation'

export default function Sidebar({ open, onClose }) {
  const location = useLocation()

  const initialOpen = navigation
    .filter((item) => item.children?.some((c) => location.pathname.startsWith(c.path)))
    .map((item) => item.label)

  const [expanded, setExpanded] = useState(new Set(initialOpen))

  function toggleGroup(label) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      {/* Mobile-only sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-56
        bg-[var(--bg-sidebar)] border-r border-[var(--border)]
        flex flex-col transition-transform duration-300
        lg:hidden
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header with close button */}
        <div className="flex items-center justify-between px-3 h-12 border-b border-[var(--border)] shrink-0">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Menu</p>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)]"><X size={16} /></button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {navigation.map((item) =>
            item.children ? (
              <SidebarGroup
                key={item.label}
                item={item}
                isOpen={expanded.has(item.label)}
                onToggle={() => toggleGroup(item.label)}
                onNavigate={onClose}
                currentPath={location.pathname}
              />
            ) : (
              <SidebarLink key={item.path} item={item} onNavigate={onClose} />
            )
          )}
        </nav>
      </aside>
    </>
  )
}

function SidebarLink({ item, onNavigate, nested }) {
  const { label, icon: Icon, path } = item
  return (
    <NavLink to={path} onClick={onNavigate} end={path === '/'}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 ${
          nested ? 'pl-11 pr-4 py-[7px]' : 'px-4 py-2.5'
        } text-[13px] font-medium transition-all border-r-2 ${
          isActive
            ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] border-[var(--sidebar-active-text)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={nested ? 14 : 17} strokeWidth={isActive ? 2.2 : 1.7} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarGroup({ item, isOpen, onToggle, onNavigate, currentPath }) {
  const { label, icon: Icon, children } = item
  const hasActiveChild = children.some((c) => currentPath.startsWith(c.path))

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full group flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-all border-r-2 border-transparent ${
          hasActiveChild
            ? 'text-[var(--sidebar-active-text)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
        }`}
      >
        <Icon size={17} strokeWidth={hasActiveChild ? 2.2 : 1.7} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={13} className={`text-[var(--text-dim)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="py-0.5">
          {children.map((child) => (
            <SidebarLink key={child.path} item={child} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  )
}

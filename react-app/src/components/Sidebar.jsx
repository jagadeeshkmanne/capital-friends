import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { X, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import navigation from '../data/navigation'

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
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
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed top-0 left-0 z-50 h-full
        lg:relative lg:top-auto lg:left-auto lg:z-auto lg:h-auto
        ${collapsed ? 'lg:w-[60px]' : 'lg:w-56'}
        w-56 bg-[var(--bg-sidebar)] border-r border-[var(--border)]
        flex flex-col transition-all duration-300
        lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between px-3 h-12 border-b border-[var(--border)] shrink-0 lg:hidden">
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
                collapsed={collapsed}
              />
            ) : (
              <SidebarLink key={item.path} item={item} onNavigate={onClose} collapsed={collapsed} />
            )
          )}
        </nav>

        {/* Desktop collapse toggle at bottom */}
        <div className="hidden lg:block border-t border-[var(--border)] shrink-0">
          <button
            onClick={onToggleCollapse}
            className={`flex items-center gap-2 w-full px-3 py-2.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-xs font-medium ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  )
}

function SidebarLink({ item, onNavigate, nested, collapsed }) {
  const { label, icon: Icon, path } = item
  return (
    <NavLink to={path} onClick={onNavigate} end={path === '/'}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 ${
          collapsed
            ? 'justify-center px-2 py-2.5'
            : nested ? 'pl-11 pr-4 py-[7px]' : 'px-4 py-2.5'
        } text-[13px] font-medium transition-all ${
          collapsed ? '' : 'border-r-2'
        } ${
          isActive
            ? `bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] ${collapsed ? 'border-l-2 border-[var(--sidebar-active-text)]' : 'border-[var(--sidebar-active-text)]'}`
            : `text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] ${collapsed ? '' : 'border-transparent'}`
        }`
      }
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon size={collapsed ? 18 : nested ? 14 : 17} strokeWidth={isActive ? 2.2 : 1.7} />
          {!collapsed && <span>{label}</span>}
        </>
      )}
    </NavLink>
  )
}

function SidebarGroup({ item, isOpen, onToggle, onNavigate, currentPath, collapsed }) {
  const { label, icon: Icon, children } = item
  const hasActiveChild = children.some((c) => currentPath.startsWith(c.path))

  if (collapsed) {
    return (
      <NavLink
        to={children[0].path}
        onClick={onNavigate}
        className={`group flex items-center justify-center px-2 py-2.5 text-[13px] font-medium transition-all ${
          hasActiveChild
            ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] border-l-2 border-[var(--sidebar-active-text)]'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
        }`}
        title={label}
      >
        <Icon size={18} strokeWidth={hasActiveChild ? 2.2 : 1.7} />
      </NavLink>
    )
  }

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
            <SidebarLink key={child.path} item={child} onNavigate={onNavigate} nested collapsed={false} />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, CreditCard,
  TrendingUp, Shield, Landmark, IndianRupee,
  Menu, X, ChevronLeft, ChevronRight, DatabaseZap,
  Home, Coins, Inbox
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Financial Inbox', icon: Inbox },
  { href: '/family', label: 'Family Members', icon: Users },
  { href: '/bank-accounts', label: 'Bank Accounts', icon: Building2 },
  { href: '/credit-cards', label: 'Credit Cards', icon: CreditCard },
  { href: '/investments', label: 'Investments', icon: TrendingUp },
  { href: '/real-estate', label: 'Real Estate', icon: Home },
  { href: '/gold', label: 'Gold', icon: Coins },
  { href: '/insurance', label: 'Insurance', icon: Shield },
  { href: '/liabilities', label: 'Liabilities', icon: Landmark },
  { href: '/master-data', label: 'Master Data', icon: DatabaseZap },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-56'
  const mainMargin = collapsed ? 'md:ml-16' : 'md:ml-56'

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-800 border border-slate-700 p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full ${sidebarWidth} bg-slate-800 border-r border-slate-700 z-40
        transition-all duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 flex flex-col
      `}>
        {/* Logo */}
        <div className={`p-4 border-b border-slate-700 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <IndianRupee size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-white text-sm whitespace-nowrap">Gupta Family</h1>
              <p className="text-xs text-slate-400 whitespace-nowrap">Financial ERP</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                  ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }
                `}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle + footer */}
        <div className="border-t border-slate-700 p-2">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-xl text-xs transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
          {!collapsed && <p className="text-xs text-slate-600 text-center mt-1">v1.0</p>}
        </div>
      </aside>

      {/* Spacer so main content shifts correctly on desktop */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-300 ${sidebarWidth}`} />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  )
}

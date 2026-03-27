'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import StatCard from '@/components/ui/StatCard'
import {
  Wallet, TrendingUp, TrendingDown, Building2,
  CreditCard, Shield, Landmark, PiggyBank, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

const formatINR = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`
  return `₹${amount.toLocaleString('en-IN')}`
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBankBalance: 0,
    totalInvestments: 0,
    totalInsuredValue: 0,
    totalCreditOutstanding: 0,
    totalLiabilities: 0,
    netWorth: 0,
    totalAssets: 0,
    monthlyEMI: 0,
  })
  const [memberStats, setMemberStats] = useState<{ name: string; value: number }[]>([])
  const [investmentBreakdown, setInvestmentBreakdown] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [bankRes, investRes, insurRes, cardRes, liabRes, membersRes] = await Promise.all([
        supabase.from('bank_accounts').select('balance, member_id').eq('is_active', true),
        supabase.from('investments').select('current_value, principal_amount, investment_type, member_id').eq('is_active', true),
        supabase.from('insurance_policies').select('sum_assured, member_id').eq('is_active', true),
        supabase.from('credit_cards').select('outstanding_amount, member_id').eq('is_active', true),
        supabase.from('liabilities').select('outstanding_amount, emi_amount, member_id').eq('is_active', true),
        supabase.from('family_members').select('id, full_name'),
      ])

      const bankBalance = (bankRes.data || []).reduce((s, r) => s + Number(r.balance), 0)
      const investments = (investRes.data || []).reduce((s, r) => s + Number(r.current_value || r.principal_amount), 0)
      const insuredValue = (insurRes.data || []).reduce((s, r) => s + Number(r.sum_assured || 0), 0)
      const creditOutstanding = (cardRes.data || []).reduce((s, r) => s + Number(r.outstanding_amount), 0)
      const liabilities = (liabRes.data || []).reduce((s, r) => s + Number(r.outstanding_amount), 0)
      const monthlyEMI = (liabRes.data || []).reduce((s, r) => s + Number(r.emi_amount || 0), 0)
      const totalAssets = bankBalance + investments
      const netWorth = totalAssets - liabilities - creditOutstanding

      setStats({ totalBankBalance: bankBalance, totalInvestments: investments, totalInsuredValue: insuredValue, totalCreditOutstanding: creditOutstanding, totalLiabilities: liabilities, netWorth, totalAssets, monthlyEMI })

      // Per-member net worth breakdown
      const members = membersRes.data || []
      const memberMap = members.map(m => {
        const mBank = (bankRes.data || []).filter(r => r.member_id === m.id).reduce((s, r) => s + Number(r.balance), 0)
        const mInvest = (investRes.data || []).filter(r => r.member_id === m.id).reduce((s, r) => s + Number(r.current_value || r.principal_amount), 0)
        return { name: m.full_name.split(' ')[0], value: mBank + mInvest }
      })
      setMemberStats(memberMap.filter(m => m.value > 0))

      // Investment type breakdown
      const typeMap: Record<string, number> = {}
      ;(investRes.data || []).forEach(r => {
        typeMap[r.investment_type] = (typeMap[r.investment_type] || 0) + Number(r.current_value || r.principal_amount)
      })
      setInvestmentBreakdown(Object.entries(typeMap).map(([name, value]) => ({ name, value })))

    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchStats() }, [])

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Family Dashboard</h1>
            <p className="text-slate-400 mt-1">Complete financial overview — Gupta Family</p>
          </div>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Net Worth Hero */}
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 mb-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
          <p className="text-indigo-200 text-sm font-medium mb-2">Total Family Net Worth</p>
          <p className="text-5xl font-bold text-white mb-4">{formatINR(stats.netWorth)}</p>
          <div className="flex gap-6">
            <div>
              <p className="text-indigo-200 text-xs">Total Assets</p>
              <p className="text-white font-semibold">{formatINR(stats.totalAssets)}</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="text-indigo-200 text-xs">Total Liabilities</p>
              <p className="text-white font-semibold">{formatINR(stats.totalLiabilities + stats.totalCreditOutstanding)}</p>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          <StatCard title="Bank Balance" value={formatINR(stats.totalBankBalance)} subtitle="Across all accounts" icon={Building2} color="emerald" />
          <StatCard title="Investments" value={formatINR(stats.totalInvestments)} subtitle="FD, MF, Stocks & more" icon={TrendingUp} color="indigo" />
          <StatCard title="Credit Outstanding" value={formatINR(stats.totalCreditOutstanding)} subtitle="All credit cards" icon={CreditCard} color="rose" />
          <StatCard title="Loans Outstanding" value={formatINR(stats.totalLiabilities)} subtitle="All liabilities" icon={Landmark} color="amber" />
          <StatCard title="Monthly EMI" value={formatINR(stats.monthlyEMI)} subtitle="Total outflow" icon={Wallet} color="violet" />
          <StatCard title="Insured Value" value={formatINR(stats.totalInsuredValue)} subtitle="Sum assured, all policies" icon={Shield} color="cyan" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Member-wise breakdown */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-white font-semibold mb-6">Assets by Family Member</h3>
            {memberStats.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={memberStats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {memberStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {memberStats.map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-slate-300">{m.name}</span>
                      </div>
                      <span className="text-sm font-medium text-white">{formatINR(m.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart message="Add bank accounts and investments to see breakdown" />
            )}
          </div>

          {/* Investment breakdown */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-white font-semibold mb-6">Investment Portfolio Breakdown</h3>
            {investmentBreakdown.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={investmentBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {investmentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {investmentBreakdown.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-slate-300">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-white">{formatINR(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart message="Add investments to see portfolio breakdown" />
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Add Bank', href: '/bank-accounts', icon: Building2, color: 'bg-emerald-500/20 text-emerald-400' },
              { label: 'Add Card', href: '/credit-cards', icon: CreditCard, color: 'bg-rose-500/20 text-rose-400' },
              { label: 'Add Investment', href: '/investments', icon: TrendingUp, color: 'bg-indigo-500/20 text-indigo-400' },
              { label: 'Add Insurance', href: '/insurance', icon: Shield, color: 'bg-cyan-500/20 text-cyan-400' },
              { label: 'Add Liability', href: '/liabilities', icon: Landmark, color: 'bg-amber-500/20 text-amber-400' },
              { label: 'Family', href: '/family', icon: PiggyBank, color: 'bg-violet-500/20 text-violet-400' },
            ].map(item => {
              const Icon = item.icon
              return (
                <a key={item.label} href={item.href} className={`flex flex-col items-center gap-2 p-4 rounded-xl ${item.color} hover:opacity-80 transition-opacity cursor-pointer`}>
                  <Icon size={20} />
                  <span className="text-xs font-medium text-center">{item.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
      <TrendingUp size={32} className="mb-2 opacity-30" />
      <p className="text-sm text-center">{message}</p>
    </div>
  )
}

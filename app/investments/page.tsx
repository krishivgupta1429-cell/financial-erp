'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { TrendingUp, Plus, Edit2, Trash2, Calendar, Clock, AlertCircle, IndianRupee, Upload } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FamilyMember } from '@/types'

// ── Investment types including all Indian schemes ──────────────────
const INVESTMENT_CATEGORIES = {
  'Post Office Schemes': ['NSC (National Savings Certificate)', 'KVP (Kisan Vikas Patra)', 'SCSS (Senior Citizens Savings)', 'MIS (Monthly Income Scheme)', 'Post Office TD (Time Deposit)', 'Post Office RD', 'Post Office PPF', 'Sukanya Samriddhi Yojana'],
  'Bank Products': ['Bank FD', 'Bank RD', 'Bank PPF'],
  'Market Investments': ['Mutual Fund', 'Stocks / Equity', 'ETF', 'SGBs (Sovereign Gold Bonds)', 'Bonds / Debentures'],
  'Government Schemes': ['PPF (Public Provident Fund)', 'NPS (National Pension System)', 'EPF', 'VPF'],
  'Physical Assets': ['Gold (Physical)', 'Gold (Digital)', 'Real Estate'],
  'Other': ['Corporate FD', 'Chit Fund', 'LIC Endowment', 'Other'],
}

const ALL_TYPES = Object.values(INVESTMENT_CATEGORIES).flat()

const INTEREST_FREQUENCIES = [
  'Monthly', 'Quarterly', 'Half-Yearly', 'Annual', 'On Maturity', 'Not Applicable'
]

const TYPE_COLORS: Record<string, string> = {
  'NSC (National Savings Certificate)': 'bg-orange-500/20 text-orange-400',
  'KVP (Kisan Vikas Patra)': 'bg-yellow-500/20 text-yellow-400',
  'SCSS (Senior Citizens Savings)': 'bg-amber-500/20 text-amber-400',
  'MIS (Monthly Income Scheme)': 'bg-lime-500/20 text-lime-400',
  'Post Office TD (Time Deposit)': 'bg-green-500/20 text-green-400',
  'Post Office RD': 'bg-teal-500/20 text-teal-400',
  'Post Office PPF': 'bg-cyan-500/20 text-cyan-400',
  'Sukanya Samriddhi Yojana': 'bg-pink-500/20 text-pink-400',
  'Bank FD': 'bg-blue-500/20 text-blue-400',
  'Bank RD': 'bg-indigo-500/20 text-indigo-400',
  'Mutual Fund': 'bg-violet-500/20 text-violet-400',
  'Stocks / Equity': 'bg-emerald-500/20 text-emerald-400',
  'SGBs (Sovereign Gold Bonds)': 'bg-yellow-600/20 text-yellow-300',
  'PPF (Public Provident Fund)': 'bg-cyan-600/20 text-cyan-300',
  'NPS (National Pension System)': 'bg-purple-500/20 text-purple-400',
  'Gold (Physical)': 'bg-amber-600/20 text-amber-300',
  'Real Estate': 'bg-rose-500/20 text-rose-400',
}
const getTypeColor = (t: string) => TYPE_COLORS[t] || 'bg-slate-500/20 text-slate-400'

const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const formatINRCompact = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`
  return `₹${Number(n).toLocaleString('en-IN')}`
}

const daysUntil = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const emptyForm = {
  member_id: '',
  investment_type: 'Bank FD',
  institution_name: '',
  account_number: '',
  certificate_number: '',
  deposit_receipt_number: '',
  post_office_branch: '',
  principal_amount: '',
  current_value: '',
  expected_maturity_amount: '',
  interest_rate: '',
  interest_credit_frequency: 'On Maturity',
  cumulative: true,
  start_date: '',
  maturity_date: '',
  next_interest_date: '',
  tenure_months: '',
  nominee: '',
  notes: '',
}

type Investment = {
  id: string
  member_id: string
  investment_type: string
  institution_name: string
  account_number?: string
  certificate_number?: string
  deposit_receipt_number?: string
  post_office_branch?: string
  principal_amount: number
  current_value?: number
  expected_maturity_amount?: number
  interest_rate?: number
  interest_credit_frequency?: string
  cumulative?: boolean
  start_date?: string
  maturity_date?: string
  next_interest_date?: string
  tenure_months?: number
  nominee?: string
  notes?: string
  is_active: boolean
  created_at: string
  family_members?: { full_name: string; avatar_color: string }
}

type ViewMode = 'all' | 'maturity' | 'interest'

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Investment | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('all')

  const fetchData = async () => {
    setLoading(true)
    const [invRes, memRes] = await Promise.all([
      supabase.from('investments').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('maturity_date', { ascending: true, nullsFirst: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setInvestments(invRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openAdd = () => {
    setForm({ ...emptyForm, member_id: members[0]?.id || '' })
    setEditItem(null)
    setModalOpen(true)
  }

  const openEdit = (inv: Investment) => {
    setForm({
      member_id: inv.member_id,
      investment_type: inv.investment_type,
      institution_name: inv.institution_name,
      account_number: inv.account_number || '',
      certificate_number: inv.certificate_number || '',
      deposit_receipt_number: inv.deposit_receipt_number || '',
      post_office_branch: inv.post_office_branch || '',
      principal_amount: String(inv.principal_amount),
      current_value: String(inv.current_value || ''),
      expected_maturity_amount: String(inv.expected_maturity_amount || ''),
      interest_rate: String(inv.interest_rate || ''),
      interest_credit_frequency: inv.interest_credit_frequency || 'On Maturity',
      cumulative: inv.cumulative ?? true,
      start_date: inv.start_date || '',
      maturity_date: inv.maturity_date || '',
      next_interest_date: inv.next_interest_date || '',
      tenure_months: String(inv.tenure_months || ''),
      nominee: inv.nominee || '',
      notes: inv.notes || '',
    })
    setEditItem(inv)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.member_id || !form.institution_name || !form.principal_amount) return
    setSaving(true)
    const payload = {
      ...form,
      principal_amount: parseFloat(form.principal_amount) || 0,
      current_value: parseFloat(form.current_value) || null,
      expected_maturity_amount: parseFloat(form.expected_maturity_amount) || null,
      interest_rate: parseFloat(form.interest_rate) || null,
      tenure_months: parseInt(form.tenure_months) || null,
      start_date: form.start_date || null,
      maturity_date: form.maturity_date || null,
      next_interest_date: form.next_interest_date || null,
    }
    if (editItem) {
      await supabase.from('investments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    } else {
      await supabase.from('investments').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment?')) return
    await supabase.from('investments').update({ is_active: false }).eq('id', id)
    fetchData()
  }

  // Auto-calculate expected maturity amount
  const calcExpectedMaturity = () => {
    const p = parseFloat(form.principal_amount) || 0
    const r = parseFloat(form.interest_rate) || 0
    const months = parseInt(form.tenure_months) || 0
    if (!p || !r || !months) return
    const years = months / 12
    let maturity = 0
    if (form.cumulative) {
      // Compound quarterly
      maturity = p * Math.pow(1 + r / (4 * 100), 4 * years)
    } else {
      // Simple interest
      maturity = p + (p * r * years) / 100
    }
    setForm((f: any) => ({ ...f, expected_maturity_amount: maturity.toFixed(2) }))
  }

  // Filters
  let filtered = investments
  if (filterMember !== 'all') filtered = filtered.filter(i => i.member_id === filterMember)
  if (filterCategory !== 'all') {
    const catTypes = INVESTMENT_CATEGORIES[filterCategory as keyof typeof INVESTMENT_CATEGORIES] || []
    filtered = filtered.filter(i => catTypes.includes(i.investment_type))
  }
  if (viewMode === 'maturity') filtered = filtered.filter(i => i.maturity_date).sort((a, b) => new Date(a.maturity_date!).getTime() - new Date(b.maturity_date!).getTime())
  if (viewMode === 'interest') filtered = filtered.filter(i => i.next_interest_date).sort((a, b) => new Date(a.next_interest_date!).getTime() - new Date(b.next_interest_date!).getTime())

  // Stats
  const totalCurrent = filtered.reduce((s, i) => s + Number(i.current_value || i.principal_amount), 0)
  const totalPrincipal = filtered.reduce((s, i) => s + Number(i.principal_amount), 0)
  const totalMaturityExpected = filtered.reduce((s, i) => s + Number(i.expected_maturity_amount || i.current_value || i.principal_amount), 0)
  const totalGain = totalCurrent - totalPrincipal

  // Maturity buckets
  const maturingIn30 = investments.filter(i => i.maturity_date && daysUntil(i.maturity_date) <= 30 && daysUntil(i.maturity_date) >= 0).length
  const maturingIn90 = investments.filter(i => i.maturity_date && daysUntil(i.maturity_date) <= 90 && daysUntil(i.maturity_date) > 30).length

  const isPostOffice = (type: string) => type.toLowerCase().includes('post office') || ['NSC (National Savings Certificate)', 'KVP (Kisan Vikas Patra)', 'SCSS (Senior Citizens Savings)', 'MIS (Monthly Income Scheme)', 'Sukanya Samriddhi Yojana'].includes(type)

  return (
    <MainLayout>
      <PageHeader title="Investments" subtitle="Track all investments, maturity dates & interest credits" icon={TrendingUp}
        action={
          <div className="flex gap-2">
            <Link href="/investments/upload" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors">
              <Upload size={16} /> Bulk Upload
            </Link>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Add Investment
            </button>
          </div>
        }
      />

      {/* Alert banners */}
      {maturingIn30 > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300"><span className="font-semibold">{maturingIn30} investment{maturingIn30 > 1 ? 's' : ''}</span> maturing within 30 days — consider renewal or reinvestment.</p>
        </div>
      )}
      {maturingIn90 > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
          <Clock size={16} className="text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-300"><span className="font-semibold">{maturingIn90} investment{maturingIn90 > 1 ? 's' : ''}</span> maturing in 31–90 days.</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">Current Value</p>
          <p className="text-lg font-bold text-white">{formatINRCompact(totalCurrent)}</p>
        </div>
        <div className="bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">Total Invested</p>
          <p className="text-lg font-bold text-slate-300">{formatINRCompact(totalPrincipal)}</p>
        </div>
        <div className={`border rounded-xl px-4 py-3 ${totalGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
          <p className="text-xs text-slate-400">Gain / Loss</p>
          <p className={`text-lg font-bold ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalGain >= 0 ? '+' : ''}{formatINRCompact(totalGain)}</p>
        </div>
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">Expected at Maturity</p>
          <p className="text-lg font-bold text-violet-400">{formatINRCompact(totalMaturityExpected)}</p>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* View mode */}
        <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-1 gap-1">
          {(['all', 'maturity', 'interest'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {v === 'all' ? 'All' : v === 'maturity' ? 'By Maturity' : 'By Interest Date'}
            </button>
          ))}
        </div>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {Object.keys(INVESTMENT_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Investment List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const currentVal = inv.current_value || inv.principal_amount
            const gain = currentVal - inv.principal_amount
            const gainPct = (gain / inv.principal_amount) * 100
            const daysToMaturity = inv.maturity_date ? daysUntil(inv.maturity_date) : null
            const daysToInterest = inv.next_interest_date ? daysUntil(inv.next_interest_date) : null
            const isMaturityUrgent = daysToMaturity !== null && daysToMaturity <= 30 && daysToMaturity >= 0
            const isMaturitySoon = daysToMaturity !== null && daysToMaturity <= 90 && daysToMaturity > 30
            const isInterestSoon = daysToInterest !== null && daysToInterest <= 7 && daysToInterest >= 0

            return (
              <div key={inv.id} className={`bg-slate-800 rounded-2xl p-5 card-hover border ${isMaturityUrgent ? 'border-amber-500/40' : isMaturitySoon ? 'border-blue-500/30' : 'border-slate-700'}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white">{inv.institution_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(inv.investment_type)}`}>{inv.investment_type}</span>
                      <span className="text-xs text-slate-400">{inv.family_members?.full_name}</span>
                      {inv.cumulative === false && <span className="text-xs px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded-full">Non-Cumulative</span>}
                    </div>

                    {/* Details row */}
                    <div className="flex gap-4 text-xs text-slate-400 flex-wrap mb-3">
                      {inv.interest_rate && <span className="flex items-center gap-1"><IndianRupee size={10} />{inv.interest_rate}% p.a.</span>}
                      {inv.interest_credit_frequency && inv.interest_credit_frequency !== 'Not Applicable' && <span>Interest: {inv.interest_credit_frequency}</span>}
                      {inv.certificate_number && <span>Cert: {inv.certificate_number}</span>}
                      {inv.account_number && <span>A/C: {inv.account_number}</span>}
                      {inv.post_office_branch && <span>PO: {inv.post_office_branch}</span>}
                      {inv.nominee && <span>Nominee: {inv.nominee}</span>}
                    </div>

                    {/* Date row */}
                    <div className="flex gap-4 text-xs flex-wrap">
                      {inv.start_date && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar size={10} />Start: {new Date(inv.start_date).toLocaleDateString('en-IN')}
                        </span>
                      )}
                      {inv.maturity_date && (
                        <span className={`flex items-center gap-1 font-medium ${isMaturityUrgent ? 'text-amber-400' : isMaturitySoon ? 'text-blue-400' : 'text-slate-400'}`}>
                          <Clock size={10} />
                          Matures: {new Date(inv.maturity_date).toLocaleDateString('en-IN')}
                          {daysToMaturity !== null && daysToMaturity >= 0 && ` (${daysToMaturity}d)`}
                          {daysToMaturity !== null && daysToMaturity < 0 && ' (Matured)'}
                        </span>
                      )}
                      {inv.next_interest_date && (
                        <span className={`flex items-center gap-1 ${isInterestSoon ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}>
                          <IndianRupee size={10} />
                          Next Interest: {new Date(inv.next_interest_date).toLocaleDateString('en-IN')}
                          {daysToInterest !== null && daysToInterest >= 0 && ` (${daysToInterest}d)`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount column */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-white">{formatINR(currentVal)}</p>
                    <p className="text-xs text-slate-400">Principal: {formatINR(inv.principal_amount)}</p>
                    {gain !== 0 && (
                      <p className={`text-xs font-medium ${gain > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gain > 0 ? '▲' : '▼'} {formatINR(Math.abs(gain))} ({Math.abs(gainPct).toFixed(1)}%)
                      </p>
                    )}
                    {inv.expected_maturity_amount && (
                      <p className="text-xs text-violet-400 mt-1">Maturity: {formatINRCompact(inv.expected_maturity_amount)}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(inv)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(inv.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <TrendingUp size={48} className="mb-4 opacity-30" />
              <p>No investments found. Add one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Investment' : 'Add Investment'} size="lg">
        <div className="space-y-4">
          {/* Member + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Investment Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.investment_type} onChange={e => setForm({...form, investment_type: e.target.value})}>
                {Object.entries(INVESTMENT_CATEGORIES).map(([cat, types]) => (
                  <optgroup key={cat} label={cat}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Institution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Institution / Bank / Post Office *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.institution_name} onChange={e => setForm({...form, institution_name: e.target.value})} placeholder="e.g. SBI / Post Office Sector 4" />
            </div>
            {isPostOffice(form.investment_type) ? (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Post Office Branch</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.post_office_branch} onChange={e => setForm({...form, post_office_branch: e.target.value})} placeholder="Branch name / city" />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Account / Folio Number</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Optional" />
              </div>
            )}
          </div>

          {/* Certificate numbers (for Post Office) */}
          {isPostOffice(form.investment_type) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Certificate Number</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.certificate_number} onChange={e => setForm({...form, certificate_number: e.target.value})} placeholder="e.g. NSC12345678" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Receipt / Passbook Number</label>
                <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.deposit_receipt_number} onChange={e => setForm({...form, deposit_receipt_number: e.target.value})} placeholder="Optional" />
              </div>
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Principal / Invested Amount (₹) *</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.principal_amount} onChange={e => setForm({...form, principal_amount: e.target.value})} placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Value (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.current_value} onChange={e => setForm({...form, current_value: e.target.value})} placeholder="Same as principal if unknown" />
            </div>
          </div>

          {/* Rate + Frequency */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Interest Rate % p.a.</label>
              <input type="number" step="0.01" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})} placeholder="7.5" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Interest Credit</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.interest_credit_frequency} onChange={e => setForm({...form, interest_credit_frequency: e.target.value})}>
                {INTEREST_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tenure (months)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.tenure_months} onChange={e => setForm({...form, tenure_months: e.target.value})} placeholder="60" />
            </div>
          </div>

          {/* Cumulative toggle */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="cumulative" checked={form.cumulative} onChange={e => setForm({...form, cumulative: e.target.checked})} className="w-4 h-4 rounded" />
            <label htmlFor="cumulative" className="text-sm text-slate-300">Cumulative (interest reinvested, paid on maturity)</label>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start / Purchase Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Maturity Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.maturity_date} onChange={e => setForm({...form, maturity_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Next Interest Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.next_interest_date} onChange={e => setForm({...form, next_interest_date: e.target.value})} />
            </div>
          </div>

          {/* Auto-calculate expected maturity */}
          <div className="bg-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-slate-300">Expected Maturity Amount (₹)</label>
              <button type="button" onClick={calcExpectedMaturity} className="text-xs px-3 py-1 bg-indigo-600/50 hover:bg-indigo-600 text-indigo-200 rounded-lg transition-colors">Auto Calculate</button>
            </div>
            <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.expected_maturity_amount} onChange={e => setForm({...form, expected_maturity_amount: e.target.value})} placeholder="Click Auto Calculate or enter manually" />
            <p className="text-xs text-slate-500 mt-1">Auto-calculates from Principal + Rate + Tenure using compound quarterly formula</p>
          </div>

          {/* Nominee + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nominee</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.nominee} onChange={e => setForm({...form, nominee: e.target.value})} placeholder="Kavita Gupta" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Notes</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any additional notes" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Investment')}
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

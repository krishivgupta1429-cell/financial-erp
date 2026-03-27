'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { TrendingUp, Plus, Edit2, Trash2, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Investment, FamilyMember } from '@/types'

const INVESTMENT_TYPES = ['FD', 'RD', 'Mutual Fund', 'Stocks', 'PPF', 'NPS', 'Gold', 'Real Estate', 'Bonds', 'SGBs', 'Other']
const TYPE_COLORS: Record<string, string> = { FD: 'bg-blue-500/20 text-blue-400', RD: 'bg-cyan-500/20 text-cyan-400', 'Mutual Fund': 'bg-indigo-500/20 text-indigo-400', Stocks: 'bg-emerald-500/20 text-emerald-400', PPF: 'bg-violet-500/20 text-violet-400', NPS: 'bg-purple-500/20 text-purple-400', Gold: 'bg-amber-500/20 text-amber-400', 'Real Estate': 'bg-orange-500/20 text-orange-400', Bonds: 'bg-teal-500/20 text-teal-400', SGBs: 'bg-yellow-500/20 text-yellow-400', Other: 'bg-slate-500/20 text-slate-400' }
const emptyForm = { member_id: '', investment_type: 'FD', institution_name: '', account_number: '', principal_amount: '', current_value: '', interest_rate: '', start_date: '', maturity_date: '', tenure_months: '', nominee: '', notes: '' }
const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Investment | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [filterType, setFilterType] = useState('all')

  const fetch = async () => {
    setLoading(true)
    const [invRes, memRes] = await Promise.all([
      supabase.from('investments').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setInvestments(invRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (inv: Investment) => { setForm({ member_id: inv.member_id, investment_type: inv.investment_type, institution_name: inv.institution_name, account_number: inv.account_number || '', principal_amount: String(inv.principal_amount), current_value: String(inv.current_value || ''), interest_rate: String(inv.interest_rate || ''), start_date: inv.start_date || '', maturity_date: inv.maturity_date || '', tenure_months: String(inv.tenure_months || ''), nominee: inv.nominee || '', notes: inv.notes || '' }); setEditItem(inv); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.member_id || !form.institution_name || !form.principal_amount) return
    setSaving(true)
    const payload = { ...form, principal_amount: parseFloat(form.principal_amount) || 0, current_value: parseFloat(form.current_value) || null, interest_rate: parseFloat(form.interest_rate) || null, tenure_months: parseInt(form.tenure_months) || null, start_date: form.start_date || null, maturity_date: form.maturity_date || null }
    if (editItem) await supabase.from('investments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('investments').insert(payload)
    setSaving(false); setModalOpen(false); fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment?')) return
    await supabase.from('investments').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const getGainLoss = (inv: Investment) => {
    if (!inv.current_value) return null
    const diff = inv.current_value - inv.principal_amount
    const pct = (diff / inv.principal_amount) * 100
    return { diff, pct, positive: diff >= 0 }
  }

  let filtered = filterMember === 'all' ? investments : investments.filter(i => i.member_id === filterMember)
  filtered = filterType === 'all' ? filtered : filtered.filter(i => i.investment_type === filterType)
  const totalCurrent = filtered.reduce((s, i) => s + Number(i.current_value || i.principal_amount), 0)
  const totalPrincipal = filtered.reduce((s, i) => s + Number(i.principal_amount), 0)
  const totalGain = totalCurrent - totalPrincipal

  return (
    <MainLayout>
      <PageHeader title="Investments" subtitle="Track all investments, returns and maturity" icon={TrendingUp}
        action={<button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus size={16} /> Add Investment</button>}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 flex-1 min-w-32">
            <p className="text-xs text-slate-400">Current Value</p>
            <p className="text-lg font-bold text-white">{formatINR(totalCurrent)}</p>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 flex-1 min-w-32">
            <p className="text-xs text-slate-400">Invested</p>
            <p className="text-lg font-bold text-slate-300">{formatINR(totalPrincipal)}</p>
          </div>
          <div className={`border rounded-xl px-4 py-3 flex-1 min-w-32 ${totalGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
            <p className="text-xs text-slate-400">Gain / Loss</p>
            <p className={`text-lg font-bold ${totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalGain >= 0 ? '+' : ''}{formatINR(totalGain)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
            <option value="all">All Members</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <select className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const gl = getGainLoss(inv)
            return (
              <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-4 card-hover">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white">{inv.institution_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[inv.investment_type] || TYPE_COLORS.Other}`}>{inv.investment_type}</span>
                    <span className="text-xs text-slate-400">{(inv.family_members as any)?.full_name}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
                    {inv.interest_rate && <span>{inv.interest_rate}% p.a.</span>}
                    {inv.start_date && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(inv.start_date).toLocaleDateString('en-IN')}</span>}
                    {inv.maturity_date && <span>Matures: {new Date(inv.maturity_date).toLocaleDateString('en-IN')}</span>}
                    {inv.account_number && <span>A/C: {inv.account_number}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-white">{formatINR(inv.current_value || inv.principal_amount)}</p>
                  <p className="text-xs text-slate-400">Principal: {formatINR(inv.principal_amount)}</p>
                  {gl && <p className={`text-xs font-medium ${gl.positive ? 'text-emerald-400' : 'text-rose-400'}`}>{gl.positive ? '▲' : '▼'} {Math.abs(gl.pct).toFixed(1)}%</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(inv)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(inv.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Investment' : 'Add Investment'} size="lg">
        <div className="space-y-4">
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
                {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Institution / Name *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.institution_name} onChange={e => setForm({...form, institution_name: e.target.value})} placeholder="SBI / Axis MF / Zerodha" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account / Folio Number</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Principal Amount (₹) *</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.principal_amount} onChange={e => setForm({...form, principal_amount: e.target.value})} placeholder="100000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Value (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.current_value} onChange={e => setForm({...form, current_value: e.target.value})} placeholder="Leave blank if same as principal" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Interest Rate %</label>
              <input type="number" step="0.1" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})} placeholder="7.5" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Maturity Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.maturity_date} onChange={e => setForm({...form, maturity_date: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nominee</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.nominee} onChange={e => setForm({...form, nominee: e.target.value})} placeholder="Kavita Gupta" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Notes</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">{saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Investment')}</button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

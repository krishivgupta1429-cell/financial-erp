'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { Shield, Plus, Edit2, Trash2, AlertTriangle, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { InsurancePolicy, FamilyMember } from '@/types'

const POLICY_TYPES = ['Term Life', 'Endowment', 'ULIP', 'Health', 'Vehicle', 'Home', 'Travel', 'Other']
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Annual', 'Single Premium']
const TYPE_COLORS: Record<string, string> = { 'Term Life': 'bg-indigo-500/20 text-indigo-400', Endowment: 'bg-violet-500/20 text-violet-400', ULIP: 'bg-purple-500/20 text-purple-400', Health: 'bg-emerald-500/20 text-emerald-400', Vehicle: 'bg-amber-500/20 text-amber-400', Home: 'bg-orange-500/20 text-orange-400', Travel: 'bg-cyan-500/20 text-cyan-400', Other: 'bg-slate-500/20 text-slate-400' }
const emptyForm = { member_id: '', policy_type: 'Term Life', insurer_name: '', policy_number: '', sum_assured: '', annual_premium: '', premium_frequency: 'Annual', premium_due_date: '', policy_start_date: '', policy_end_date: '', nominee: '', auto_debit: false, notes: '' }
const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function InsurancePage() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<InsurancePolicy | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')

  const fetch = async () => {
    setLoading(true)
    const [polRes, memRes] = await Promise.all([
      supabase.from('insurance_policies').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setPolicies(polRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (p: InsurancePolicy) => { setForm({ member_id: p.member_id, policy_type: p.policy_type, insurer_name: p.insurer_name, policy_number: p.policy_number, sum_assured: String(p.sum_assured || ''), annual_premium: String(p.annual_premium || ''), premium_frequency: p.premium_frequency, premium_due_date: p.premium_due_date || '', policy_start_date: p.policy_start_date || '', policy_end_date: p.policy_end_date || '', nominee: p.nominee || '', auto_debit: p.auto_debit, notes: p.notes || '' }); setEditItem(p); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.member_id || !form.insurer_name || !form.policy_number) return
    setSaving(true)
    const payload = { ...form, sum_assured: parseFloat(form.sum_assured) || null, annual_premium: parseFloat(form.annual_premium) || null, premium_due_date: form.premium_due_date || null, policy_start_date: form.policy_start_date || null, policy_end_date: form.policy_end_date || null }
    if (editItem) await supabase.from('insurance_policies').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('insurance_policies').insert(payload)
    setSaving(false); setModalOpen(false); fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy?')) return
    await supabase.from('insurance_policies').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const isDueSoon = (dueDate?: string) => {
    if (!dueDate) return false
    const diff = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }

  const filtered = filterMember === 'all' ? policies : policies.filter(p => p.member_id === filterMember)
  const totalPremium = filtered.reduce((s, p) => s + Number(p.annual_premium || 0), 0)
  const totalCover = filtered.reduce((s, p) => s + Number(p.sum_assured || 0), 0)

  return (
    <MainLayout>
      <PageHeader title="Insurance" subtitle="All insurance policies and premium tracking" icon={Shield}
        action={<button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus size={16} /> Add Policy</button>}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-3 flex-1">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-3 flex-1">
            <p className="text-xs text-slate-400">Total Cover</p>
            <p className="text-lg font-bold text-white">{formatINR(totalCover)}</p>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 flex-1">
            <p className="text-xs text-slate-400">Annual Premium</p>
            <p className="text-lg font-bold text-amber-400">{formatINR(totalPremium)}</p>
          </div>
        </div>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(policy => {
            const due = isDueSoon(policy.premium_due_date)
            return (
              <div key={policy.id} className={`bg-slate-800 border rounded-2xl p-5 flex items-center gap-4 card-hover ${due ? 'border-amber-500/40' : 'border-slate-700'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white">{policy.insurer_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[policy.policy_type] || TYPE_COLORS.Other}`}>{policy.policy_type}</span>
                    {due && <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle size={10} />Due Soon</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
                    <span>Policy: {policy.policy_number}</span>
                    <span>{(policy.family_members as any)?.full_name}</span>
                    {policy.nominee && <span>Nominee: {policy.nominee}</span>}
                    {policy.premium_frequency && <span>{policy.premium_frequency}</span>}
                    {policy.policy_end_date && <span className="flex items-center gap-1"><Calendar size={10} />Ends: {new Date(policy.policy_end_date).toLocaleDateString('en-IN')}</span>}
                    {policy.auto_debit && <span className="text-emerald-400">Auto Debit</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {policy.sum_assured && <p className="text-lg font-bold text-white">{formatINR(policy.sum_assured)}</p>}
                  <p className="text-xs text-slate-400">Cover</p>
                  {policy.annual_premium && <p className="text-sm font-medium text-amber-400">{formatINR(policy.annual_premium)}/yr</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(policy)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(policy.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Shield size={48} className="mb-4 opacity-30" />
              <p>No insurance policies added yet</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Policy' : 'Add Insurance Policy'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Policy Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.policy_type} onChange={e => setForm({...form, policy_type: e.target.value})}>
                {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Insurance Company *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.insurer_name} onChange={e => setForm({...form, insurer_name: e.target.value})} placeholder="LIC / HDFC Life / Star Health" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Policy Number *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.policy_number} onChange={e => setForm({...form, policy_number: e.target.value})} placeholder="123456789" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Sum Assured (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.sum_assured} onChange={e => setForm({...form, sum_assured: e.target.value})} placeholder="10000000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Annual Premium (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.annual_premium} onChange={e => setForm({...form, annual_premium: e.target.value})} placeholder="25000" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Frequency</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.premium_frequency} onChange={e => setForm({...form, premium_frequency: e.target.value})}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Policy Start</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.policy_start_date} onChange={e => setForm({...form, policy_start_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Policy End</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.policy_end_date} onChange={e => setForm({...form, policy_end_date: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nominee</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.nominee} onChange={e => setForm({...form, nominee: e.target.value})} placeholder="Kavita Gupta" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Premium Due Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.premium_due_date} onChange={e => setForm({...form, premium_due_date: e.target.value})} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="autoDebitIns" checked={form.auto_debit} onChange={e => setForm({...form, auto_debit: e.target.checked})} className="w-4 h-4 rounded" />
            <label htmlFor="autoDebitIns" className="text-sm text-slate-300">Auto Debit Enabled</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">{saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Policy')}</button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

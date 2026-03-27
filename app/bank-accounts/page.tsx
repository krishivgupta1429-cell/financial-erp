'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { Building2, Plus, Edit2, Trash2, IndianRupee } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BankAccount, FamilyMember } from '@/types'

const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Fixed Deposit']
const emptyForm = { member_id: '', bank_name: '', account_number: '', ifsc_code: '', account_type: 'Savings', balance: '', minimum_balance: '', cif_number: '', linked_mobile: '', linked_email: '', nominee: '', joint_holder: '' }

const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BankAccount | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')

  const fetch = async () => {
    setLoading(true)
    const [accRes, memRes] = await Promise.all([
      supabase.from('bank_accounts').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setAccounts(accRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (a: BankAccount) => { setForm({ member_id: a.member_id, bank_name: a.bank_name, account_number: a.account_number, ifsc_code: a.ifsc_code || '', account_type: a.account_type, balance: String(a.balance), minimum_balance: String(a.minimum_balance), cif_number: a.cif_number || '', linked_mobile: a.linked_mobile || '', linked_email: a.linked_email || '', nominee: a.nominee || '', joint_holder: a.joint_holder || '' }); setEditItem(a); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.member_id || !form.bank_name || !form.account_number) return
    setSaving(true)
    const payload = { ...form, balance: parseFloat(form.balance) || 0, minimum_balance: parseFloat(form.minimum_balance) || 0 }
    if (editItem) await supabase.from('bank_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('bank_accounts').insert(payload)
    setSaving(false); setModalOpen(false); fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const filtered = filterMember === 'all' ? accounts : accounts.filter(a => a.member_id === filterMember)
  const totalBalance = filtered.reduce((s, a) => s + Number(a.balance), 0)

  return (
    <MainLayout>
      <PageHeader title="Bank Accounts" subtitle="All bank accounts across the family" icon={Building2}
        action={<button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus size={16} /> Add Account</button>}
      />

      {/* Summary + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <IndianRupee size={18} className="text-emerald-400" />
          <div>
            <p className="text-xs text-slate-400">Total Balance</p>
            <p className="text-lg font-bold text-white">{formatINR(totalBalance)}</p>
          </div>
        </div>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(acc => (
            <div key={acc.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center gap-4 card-hover">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: (acc.family_members as any)?.avatar_color || '#6366f1' }}>
                {acc.bank_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white">{acc.bank_name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{acc.account_type}</span>
                  <span className="text-xs text-slate-400">•••• {acc.account_number.slice(-4)}</span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{(acc.family_members as any)?.full_name}</p>
                {acc.ifsc_code && <p className="text-xs text-slate-500">IFSC: {acc.ifsc_code}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-white">{formatINR(acc.balance)}</p>
                {acc.minimum_balance > 0 && <p className="text-xs text-slate-500">Min: {formatINR(acc.minimum_balance)}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(acc)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(acc.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Building2 size={48} className="mb-4 opacity-30" />
              <p>No bank accounts found. Add one to get started.</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Bank Account' : 'Add Bank Account'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank Name *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="HDFC Bank" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Number *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_number} onChange={e => setForm({...form, account_number: e.target.value})} placeholder="1234567890" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">IFSC Code</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 uppercase" value={form.ifsc_code} onChange={e => setForm({...form, ifsc_code: e.target.value.toUpperCase()})} placeholder="HDFC0001234" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Balance (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.balance} onChange={e => setForm({...form, balance: e.target.value})} placeholder="50000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Minimum Balance (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.minimum_balance} onChange={e => setForm({...form, minimum_balance: e.target.value})} placeholder="10000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nominee</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.nominee} onChange={e => setForm({...form, nominee: e.target.value})} placeholder="Kavita Gupta" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Linked Mobile</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.linked_mobile} onChange={e => setForm({...form, linked_mobile: e.target.value})} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Joint Holder</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.joint_holder} onChange={e => setForm({...form, joint_holder: e.target.value})} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">{saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Account')}</button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

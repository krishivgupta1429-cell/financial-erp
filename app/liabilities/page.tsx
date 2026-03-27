'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { Landmark, Plus, Edit2, Trash2, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Liability, FamilyMember } from '@/types'

const LIABILITY_TYPES = ['Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan', 'Loan Against Property', 'Business Loan', 'Other']
const TYPE_COLORS: Record<string, string> = { 'Home Loan': 'bg-orange-500/20 text-orange-400', 'Car Loan': 'bg-amber-500/20 text-amber-400', 'Personal Loan': 'bg-rose-500/20 text-rose-400', 'Education Loan': 'bg-indigo-500/20 text-indigo-400', 'Loan Against Property': 'bg-violet-500/20 text-violet-400', 'Business Loan': 'bg-cyan-500/20 text-cyan-400', Other: 'bg-slate-500/20 text-slate-400' }
const emptyForm = { member_id: '', liability_type: 'Home Loan', lender_name: '', loan_account_number: '', principal_amount: '', outstanding_amount: '', interest_rate: '', emi_amount: '', emi_due_date: '', start_date: '', end_date: '' }
const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Liability | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')

  const fetch = async () => {
    setLoading(true)
    const [liabRes, memRes] = await Promise.all([
      supabase.from('liabilities').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setLiabilities(liabRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (l: Liability) => { setForm({ member_id: l.member_id, liability_type: l.liability_type, lender_name: l.lender_name, loan_account_number: l.loan_account_number || '', principal_amount: String(l.principal_amount), outstanding_amount: String(l.outstanding_amount), interest_rate: String(l.interest_rate || ''), emi_amount: String(l.emi_amount || ''), emi_due_date: String(l.emi_due_date || ''), start_date: l.start_date || '', end_date: l.end_date || '' }); setEditItem(l); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.member_id || !form.lender_name || !form.outstanding_amount) return
    setSaving(true)
    const payload = { ...form, principal_amount: parseFloat(form.principal_amount) || 0, outstanding_amount: parseFloat(form.outstanding_amount) || 0, interest_rate: parseFloat(form.interest_rate) || null, emi_amount: parseFloat(form.emi_amount) || null, emi_due_date: parseInt(form.emi_due_date) || null, start_date: form.start_date || null, end_date: form.end_date || null }
    if (editItem) await supabase.from('liabilities').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('liabilities').insert(payload)
    setSaving(false); setModalOpen(false); fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this liability?')) return
    await supabase.from('liabilities').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const getRepaidPct = (outstanding: number, principal: number) => principal > 0 ? Math.round(((principal - outstanding) / principal) * 100) : 0

  const filtered = filterMember === 'all' ? liabilities : liabilities.filter(l => l.member_id === filterMember)
  const totalOutstanding = filtered.reduce((s, l) => s + Number(l.outstanding_amount), 0)
  const totalEMI = filtered.reduce((s, l) => s + Number(l.emi_amount || 0), 0)

  return (
    <MainLayout>
      <PageHeader title="Liabilities" subtitle="Track all loans and EMIs" icon={Landmark}
        action={<button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus size={16} /> Add Loan</button>}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-3 flex-1">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 flex-1">
            <p className="text-xs text-slate-400">Total Outstanding</p>
            <p className="text-lg font-bold text-rose-400">{formatINR(totalOutstanding)}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex-1">
            <p className="text-xs text-slate-400">Monthly EMI</p>
            <p className="text-lg font-bold text-amber-400">{formatINR(totalEMI)}</p>
          </div>
        </div>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(liab => {
            const repaid = getRepaidPct(liab.outstanding_amount, liab.principal_amount)
            return (
              <div key={liab.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white">{liab.lender_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[liab.liability_type] || TYPE_COLORS.Other}`}>{liab.liability_type}</span>
                      <span className="text-xs text-slate-400">{(liab.family_members as any)?.full_name}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400 flex-wrap mb-3">
                      {liab.interest_rate && <span>{liab.interest_rate}% p.a.</span>}
                      {liab.emi_due_date && <span>EMI due: {liab.emi_due_date}th</span>}
                      {liab.loan_account_number && <span>A/C: {liab.loan_account_number}</span>}
                      {liab.end_date && <span className="flex items-center gap-1"><Calendar size={10} />Ends: {new Date(liab.end_date).toLocaleDateString('en-IN')}</span>}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Repaid: {repaid}%</span>
                        <span>Outstanding: {formatINR(liab.outstanding_amount)}</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${repaid}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Principal: {formatINR(liab.principal_amount)}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {liab.emi_amount && (
                      <>
                        <p className="text-lg font-bold text-amber-400">{formatINR(liab.emi_amount)}</p>
                        <p className="text-xs text-slate-400">per month</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(liab)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(liab.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Landmark size={48} className="mb-4 opacity-30" />
              <p>No liabilities added. Great financial health!</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Loan' : 'Add Liability'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Loan Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.liability_type} onChange={e => setForm({...form, liability_type: e.target.value})}>
                {LIABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Lender Name *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.lender_name} onChange={e => setForm({...form, lender_name: e.target.value})} placeholder="HDFC Bank / SBI" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Loan Account Number</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.loan_account_number} onChange={e => setForm({...form, loan_account_number: e.target.value})} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Principal Amount (₹) *</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.principal_amount} onChange={e => setForm({...form, principal_amount: e.target.value})} placeholder="5000000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Outstanding Amount (₹) *</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.outstanding_amount} onChange={e => setForm({...form, outstanding_amount: e.target.value})} placeholder="3500000" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Interest Rate %</label>
              <input type="number" step="0.1" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.interest_rate} onChange={e => setForm({...form, interest_rate: e.target.value})} placeholder="8.5" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">EMI Amount (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.emi_amount} onChange={e => setForm({...form, emi_amount: e.target.value})} placeholder="35000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">EMI Due Date</label>
              <input type="number" min="1" max="31" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.emi_due_date} onChange={e => setForm({...form, emi_due_date: e.target.value})} placeholder="5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">End Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">{saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Loan')}</button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

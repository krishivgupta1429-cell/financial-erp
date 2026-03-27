'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { CreditCard, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CreditCard as CreditCardType, FamilyMember } from '@/types'

const emptyForm = { member_id: '', bank_name: '', card_name: '', last_four_digits: '', credit_limit: '', outstanding_amount: '', billing_cycle_date: '', statement_date: '', due_date: '', auto_debit: false, expiry_month: '', expiry_year: '' }
const formatINR = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CreditCardType[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CreditCardType | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')

  const fetch = async () => {
    setLoading(true)
    const [cardsRes, memRes] = await Promise.all([
      supabase.from('credit_cards').select('*, family_members(full_name, avatar_color)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('created_at'),
    ])
    setCards(cardsRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (c: CreditCardType) => { setForm({ member_id: c.member_id, bank_name: c.bank_name, card_name: c.card_name, last_four_digits: c.last_four_digits, credit_limit: String(c.credit_limit), outstanding_amount: String(c.outstanding_amount), billing_cycle_date: String(c.billing_cycle_date || ''), statement_date: String(c.statement_date || ''), due_date: String(c.due_date || ''), auto_debit: c.auto_debit, expiry_month: String(c.expiry_month || ''), expiry_year: String(c.expiry_year || '') }); setEditItem(c); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.member_id || !form.bank_name || !form.last_four_digits) return
    setSaving(true)
    const payload = { ...form, credit_limit: parseFloat(form.credit_limit) || 0, outstanding_amount: parseFloat(form.outstanding_amount) || 0, billing_cycle_date: parseInt(form.billing_cycle_date) || null, statement_date: parseInt(form.statement_date) || null, due_date: parseInt(form.due_date) || null, expiry_month: parseInt(form.expiry_month) || null, expiry_year: parseInt(form.expiry_year) || null }
    if (editItem) await supabase.from('credit_cards').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('credit_cards').insert(payload)
    setSaving(false); setModalOpen(false); fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this card?')) return
    await supabase.from('credit_cards').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const getUtilization = (outstanding: number, limit: number) => limit > 0 ? Math.round((outstanding / limit) * 100) : 0

  const filtered = filterMember === 'all' ? cards : cards.filter(c => c.member_id === filterMember)
  const totalOutstanding = filtered.reduce((s, c) => s + Number(c.outstanding_amount), 0)
  const totalLimit = filtered.reduce((s, c) => s + Number(c.credit_limit), 0)

  return (
    <MainLayout>
      <PageHeader title="Credit Cards" subtitle="Manage all credit cards and outstanding dues" icon={CreditCard}
        action={<button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"><Plus size={16} /> Add Card</button>}
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-4 flex-1">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-5 py-3 flex-1">
            <p className="text-xs text-slate-400">Total Outstanding</p>
            <p className="text-lg font-bold text-rose-400">{formatINR(totalOutstanding)}</p>
          </div>
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl px-5 py-3 flex-1">
            <p className="text-xs text-slate-400">Total Credit Limit</p>
            <p className="text-lg font-bold text-white">{formatINR(totalLimit)}</p>
          </div>
        </div>
        <select className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(card => {
            const util = getUtilization(card.outstanding_amount, card.credit_limit)
            const isHighUtil = util > 70
            return (
              <div key={card.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 card-hover">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{card.bank_name}</h3>
                      {isHighUtil && <AlertTriangle size={14} className="text-amber-400" />}
                    </div>
                    <p className="text-sm text-slate-400">{card.card_name} •••• {card.last_four_digits}</p>
                    <p className="text-xs text-slate-500">{(card.family_members as any)?.full_name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(card)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(card.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Outstanding: {formatINR(card.outstanding_amount)}</span>
                    <span className={isHighUtil ? 'text-amber-400' : 'text-slate-400'}>{util}% used</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isHighUtil ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(util, 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Limit: {formatINR(card.credit_limit)}</p>
                </div>

                <div className="flex gap-4 text-xs text-slate-400">
                  {card.due_date && <span>Due: {card.due_date}th</span>}
                  {card.auto_debit && <span className="text-emerald-400">Auto Debit ON</span>}
                  {card.expiry_month && card.expiry_year && <span>Exp: {card.expiry_month}/{card.expiry_year}</span>}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-20 text-slate-500">
              <CreditCard size={48} className="mb-4 opacity-30" />
              <p>No credit cards added yet</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Credit Card' : 'Add Credit Card'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({...form, member_id: e.target.value})}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank / Issuer *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="HDFC Bank" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Card Name</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.card_name} onChange={e => setForm({...form, card_name: e.target.value})} placeholder="Regalia Gold" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Last 4 Digits *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.last_four_digits} onChange={e => setForm({...form, last_four_digits: e.target.value})} placeholder="4321" maxLength={4} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Credit Limit (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} placeholder="200000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Outstanding Amount (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.outstanding_amount} onChange={e => setForm({...form, outstanding_amount: e.target.value})} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Statement Date</label>
              <input type="number" min="1" max="31" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.statement_date} onChange={e => setForm({...form, statement_date: e.target.value})} placeholder="15" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Due Date</label>
              <input type="number" min="1" max="31" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} placeholder="5" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Expiry (MM/YY)</label>
              <div className="flex gap-2">
                <input type="number" min="1" max="12" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.expiry_month} onChange={e => setForm({...form, expiry_month: e.target.value})} placeholder="MM" />
                <input type="number" min="24" max="40" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.expiry_year} onChange={e => setForm({...form, expiry_year: e.target.value})} placeholder="YY" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="autoDebit" checked={form.auto_debit} onChange={e => setForm({...form, auto_debit: e.target.checked})} className="w-4 h-4 rounded" />
            <label htmlFor="autoDebit" className="text-sm text-slate-300">Auto Debit Enabled</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">{saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Card')}</button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

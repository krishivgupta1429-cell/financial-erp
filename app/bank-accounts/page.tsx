'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import {
  Building2, Plus, Edit2, Trash2, IndianRupee,
  Smartphone, Globe, CreditCard, Users, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BankAccount, FamilyMember } from '@/types'
import Link from 'next/link'

const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Fixed Deposit']
const emptyForm = {
  member_id: '', bank_name: '', account_number: '', ifsc_code: '',
  account_type: 'Savings', balance: '', minimum_balance: '',
  cif_number: '', linked_mobile: '', linked_email: '',
  nominee: '', joint_holder: '', upi_id: '', net_banking_user_id: '',
}

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtFull = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// Bank logo color from name
function bankColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('hdfc')) return '#004C8F'
  if (n.includes('sbi') || n.includes('state bank')) return '#2D5BA1'
  if (n.includes('icici')) return '#F37321'
  if (n.includes('axis')) return '#800000'
  if (n.includes('kotak')) return '#EE3124'
  if (n.includes('pnb') || n.includes('punjab')) return '#1A237E'
  if (n.includes('yes')) return '#00529C'
  if (n.includes('post') || n.includes('india post')) return '#C8102E'
  return '#6366f1'
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<BankAccount | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'bank' | 'member' | 'all'>('bank')

  const loadData = async () => {
    setLoading(true)
    const [accRes, memRes] = await Promise.all([
      supabase.from('bank_accounts')
        .select('*, family_members(full_name, avatar_color)')
        .eq('is_active', true)
        .order('bank_name'),
      supabase.from('family_members').select('*').order('full_name'),
    ])
    setAccounts(accRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openAdd = () => { setForm({ ...emptyForm, member_id: members[0]?.id || '' }); setEditItem(null); setModalOpen(true) }
  const openEdit = (a: BankAccount) => {
    setForm({
      member_id: a.member_id, bank_name: a.bank_name, account_number: a.account_number,
      ifsc_code: a.ifsc_code || '', account_type: a.account_type,
      balance: String(a.balance), minimum_balance: String(a.minimum_balance),
      cif_number: a.cif_number || '', linked_mobile: a.linked_mobile || '',
      linked_email: a.linked_email || '', nominee: a.nominee || '',
      joint_holder: a.joint_holder || '',
      upi_id: (a as any).upi_id || '',
      net_banking_user_id: (a as any).net_banking_user_id || '',
    })
    setEditItem(a); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.member_id || !form.bank_name || !form.account_number) return
    setSaving(true)
    const payload = {
      ...form,
      balance: parseFloat(form.balance) || 0,
      minimum_balance: parseFloat(form.minimum_balance) || 0,
    }
    if (editItem) await supabase.from('bank_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('bank_accounts').insert({ ...payload, is_active: true })
    setSaving(false); setModalOpen(false); loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id)
    loadData()
  }

  const filtered = filterMember === 'all' ? accounts : accounts.filter(a => a.member_id === filterMember)
  const totalBalance = filtered.reduce((s, a) => s + Number(a.balance), 0)

  // ── Bank-wise grouping ──────────────────────────────────────────
  const byBank: Record<string, { accounts: BankAccount[]; total: number }> = {}
  for (const a of filtered) {
    if (!byBank[a.bank_name]) byBank[a.bank_name] = { accounts: [], total: 0 }
    byBank[a.bank_name].accounts.push(a)
    byBank[a.bank_name].total += Number(a.balance)
  }

  // ── Member-wise grouping ────────────────────────────────────────
  const byMember: Record<string, { name: string; accounts: BankAccount[]; total: number }> = {}
  for (const a of filtered) {
    const name = (a.family_members as any)?.full_name || 'Unknown'
    if (!byMember[a.member_id]) byMember[a.member_id] = { name, accounts: [], total: 0 }
    byMember[a.member_id].accounts.push(a)
    byMember[a.member_id].total += Number(a.balance)
  }

  const toggleBank = (bank: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev)
      next.has(bank) ? next.delete(bank) : next.add(bank)
      return next
    })
  }

  const AccountCard = ({ acc }: { acc: BankAccount }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-start gap-4 card-hover">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
        style={{ backgroundColor: bankColor(acc.bank_name) }}
      >
        {acc.bank_name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-white">{acc.bank_name}</h3>
          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{acc.account_type}</span>
        </div>
        <p className="text-sm text-slate-400">{(acc.family_members as any)?.full_name}</p>
        <p className="text-xs text-slate-500 font-mono">
          {acc.account_number.length > 8
            ? `••••${acc.account_number.slice(-4)}`
            : acc.account_number}
          {acc.ifsc_code && ` · ${acc.ifsc_code}`}
        </p>

        {/* Extra fields from master data */}
        <div className="flex flex-wrap gap-3 mt-1.5">
          {(acc as any).upi_id && (
            <span className="flex items-center gap-1 text-xs text-violet-400">
              <Smartphone size={10} /> {(acc as any).upi_id}
            </span>
          )}
          {(acc as any).net_banking_user_id && (
            <span className="flex items-center gap-1 text-xs text-cyan-400">
              <Globe size={10} /> {(acc as any).net_banking_user_id}
            </span>
          )}
          {acc.nominee && (
            <span className="text-xs text-slate-500">Nominee: {acc.nominee}</span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold text-white">{fmtFull(acc.balance)}</p>
        {acc.minimum_balance > 0 && (
          <p className="text-xs text-slate-500">Min: {fmt(acc.minimum_balance)}</p>
        )}
        <div className="flex gap-1 justify-end mt-2">
          <button onClick={() => openEdit(acc)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={13} /></button>
          <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )

  return (
    <MainLayout>
      <PageHeader
        title="Bank Accounts"
        subtitle="All bank accounts across the family"
        icon={Building2}
        action={
          <div className="flex gap-2">
            <Link href="/master-data" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
              <RefreshCw size={14} /> Update via Master Data
            </Link>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Add Account
            </button>
          </div>
        }
      />

      {/* ── Summary bar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="col-span-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <IndianRupee size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Balance</p>
            <p className="text-2xl font-bold text-white">{fmt(totalBalance)}</p>
            <p className="text-xs text-slate-500">{filtered.length} account{filtered.length !== 1 ? 's' : ''} · {Object.keys(byBank).length} bank{Object.keys(byBank).length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Top 2 banks by balance */}
        {Object.entries(byBank)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 2)
          .map(([bankName, data]) => (
            <div key={bankName} className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: bankColor(bankName) }}>
                  {bankName.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-slate-300 text-xs font-medium truncate">{bankName}</p>
              </div>
              <p className="text-white font-bold">{fmt(data.total)}</p>
              <p className="text-xs text-slate-500">{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
      </div>

      {/* ── Filter + View toggle ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
          {([['bank', Building2, 'By Bank'], ['member', Users, 'By Member'], ['all', CreditCard, 'All Accounts']] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <select
          className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          value={filterMember}
          onChange={e => setFilterMember(e.target.value)}
        >
          <option value="all">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Building2 size={48} className="mb-4 opacity-30" />
          <p className="mb-2">No bank accounts found.</p>
          <p className="text-sm">Add one manually or upload via <Link href="/master-data" className="text-indigo-400 hover:underline">Master Data</Link>.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Bank view ─────────────────────────────────────────── */}
          {viewMode === 'bank' && Object.entries(byBank)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([bankName, data]) => (
              <div key={bankName} className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleBank(bankName)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: bankColor(bankName) }}>
                    {bankName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">{bankName}</p>
                    <p className="text-slate-400 text-xs">{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-white font-bold text-lg">{fmt(data.total)}</p>
                  <div className="text-slate-400 ml-2">
                    {expandedBanks.has(bankName) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                {expandedBanks.has(bankName) && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-700 pt-3">
                    {data.accounts.map(acc => <AccountCard key={acc.id} acc={acc} />)}
                  </div>
                )}
              </div>
            ))}

          {/* ── Member view ───────────────────────────────────────── */}
          {viewMode === 'member' && Object.entries(byMember)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([memberId, data]) => (
              <div key={memberId} className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleBank(memberId)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-700/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {data.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">{data.name}</p>
                    <p className="text-slate-400 text-xs">{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-white font-bold text-lg">{fmt(data.total)}</p>
                  <div className="text-slate-400 ml-2">
                    {expandedBanks.has(memberId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                {expandedBanks.has(memberId) && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-700 pt-3">
                    {data.accounts.map(acc => <AccountCard key={acc.id} acc={acc} />)}
                  </div>
                )}
              </div>
            ))}

          {/* ── All accounts view ─────────────────────────────────── */}
          {viewMode === 'all' && filtered.map(acc => <AccountCard key={acc.id} acc={acc} />)}

        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Bank Account' : 'Add Bank Account'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Family Member *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bank Name *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="HDFC Bank" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Number *</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="1234567890" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">IFSC Code</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 uppercase" value={form.ifsc_code} onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} placeholder="HDFC0001234" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">CIF / Customer ID</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.cif_number} onChange={e => setForm({ ...form, cif_number: e.target.value })} placeholder="CIF123456" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Balance (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} placeholder="50000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Minimum Balance (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.minimum_balance} onChange={e => setForm({ ...form, minimum_balance: e.target.value })} placeholder="10000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">UPI ID</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="name@oksbi" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Net Banking User ID</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.net_banking_user_id} onChange={e => setForm({ ...form, net_banking_user_id: e.target.value })} placeholder="user1234" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Linked Mobile</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.linked_mobile} onChange={e => setForm({ ...form, linked_mobile: e.target.value })} placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nominee</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.nominee} onChange={e => setForm({ ...form, nominee: e.target.value })} placeholder="Kavita Gupta" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Joint Holder</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.joint_holder} onChange={e => setForm({ ...form, joint_holder: e.target.value })} placeholder="Optional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Account')}
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

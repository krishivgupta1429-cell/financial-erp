'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { Coins, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FamilyMember } from '@/types'

const GOLD_TYPES = [
  'Physical Jewellery', 'Physical Coin', 'Physical Bar',
  'Digital Gold', 'Gold ETF', 'Gold Mutual Fund',
  'SGB (Sovereign Gold Bond)',
]
const PURITY = ['24K (99.9%)', '22K (91.6%)', '18K (75%)', '14K (58.5%)', 'Not Applicable']
const STORAGE = ['Home Safe', 'Bank Locker', 'Jewellery Shop', 'Demat Account', 'Other']

const fmt = (n?: number | null) => n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

// Current gold price per gram (22K approx — user can update manually)
const GOLD_PRICE_22K = 7200  // ₹ per gram approximate

const emptyForm = {
  member_id: '', gold_type: 'Physical Jewellery', item_description: '',
  weight_grams: '', purity: '22K (91.6%)', purchase_price_total: '',
  purchase_price_per_gram: '', current_value: '',
  purchase_date: '', hallmark_number: '', making_charges: '',
  storage_location: 'Home Safe', folio_number: '', notes: '',
}

function goldTypeColor(t: string) {
  if (t.includes('Jewellery')) return 'bg-amber-500'
  if (t.includes('Coin') || t.includes('Bar')) return 'bg-yellow-500'
  if (t.includes('Digital') || t.includes('ETF') || t.includes('Fund')) return 'bg-emerald-600'
  if (t.includes('SGB')) return 'bg-indigo-600'
  return 'bg-amber-600'
}

export default function GoldPage() {
  const [items, setItems] = useState<any[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [goldPrice, setGoldPrice] = useState(GOLD_PRICE_22K)

  const loadData = async () => {
    setLoading(true)
    const [goldRes, memRes] = await Promise.all([
      supabase.from('gold_investments').select('*, family_members(full_name)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('full_name'),
    ])
    setItems(goldRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Auto-calculate current value from weight when gold price changes
  const autoCalcValue = (weightGrams: string, purity: string, price: number) => {
    const w = parseFloat(weightGrams)
    if (!w) return ''
    const purityFactor = purity.includes('24') ? 1 : purity.includes('22') ? 0.916 : purity.includes('18') ? 0.75 : 0.916
    return String(Math.round(w * price * purityFactor))
  }

  const openAdd = () => {
    setForm({ ...emptyForm, member_id: members[0]?.id || '' })
    setEditItem(null); setModalOpen(true)
  }
  const openEdit = (g: any) => {
    setForm({
      member_id: g.member_id, gold_type: g.gold_type, item_description: g.item_description,
      weight_grams: String(g.weight_grams || ''), purity: g.purity || '22K (91.6%)',
      purchase_price_total: String(g.purchase_price_total || ''),
      purchase_price_per_gram: String(g.purchase_price_per_gram || ''),
      current_value: String(g.current_value || ''), purchase_date: g.purchase_date || '',
      hallmark_number: g.hallmark_number || '', making_charges: String(g.making_charges || ''),
      storage_location: g.storage_location || 'Home Safe',
      folio_number: g.folio_number || '', notes: g.notes || '',
    })
    setEditItem(g); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.member_id || !form.item_description) return
    setSaving(true)
    const payload = {
      ...form,
      weight_grams: parseFloat(form.weight_grams) || null,
      purchase_price_total: parseFloat(form.purchase_price_total) || null,
      purchase_price_per_gram: parseFloat(form.purchase_price_per_gram) || null,
      current_value: parseFloat(form.current_value) || null,
      making_charges: parseFloat(form.making_charges) || null,
      purchase_date: form.purchase_date || null,
    }
    if (editItem) await supabase.from('gold_investments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('gold_investments').insert({ ...payload, is_active: true })
    setSaving(false); setModalOpen(false); loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gold entry?')) return
    await supabase.from('gold_investments').update({ is_active: false }).eq('id', id)
    loadData()
  }

  // Revalue all physical gold at current gold price
  const revalueAll = async () => {
    const physicalItems = items.filter(i => ['Physical Jewellery','Physical Coin','Physical Bar'].includes(i.gold_type) && i.weight_grams)
    for (const item of physicalItems) {
      const purityFactor = item.purity?.includes('24') ? 1 : item.purity?.includes('22') ? 0.916 : item.purity?.includes('18') ? 0.75 : 0.916
      const newValue = Math.round(item.weight_grams * goldPrice * purityFactor)
      await supabase.from('gold_investments').update({ current_value: newValue, updated_at: new Date().toISOString() }).eq('id', item.id)
    }
    loadData()
  }

  const totalValue = items.reduce((s, g) => s + Number(g.current_value || g.purchase_price_total || 0), 0)
  const totalWeight = items.filter(i => i.weight_grams).reduce((s, g) => s + Number(g.weight_grams), 0)
  const physicalCount = items.filter(i => i.gold_type.includes('Physical')).length
  const digitalCount = items.filter(i => !i.gold_type.includes('Physical')).length

  return (
    <MainLayout>
      <PageHeader
        icon={Coins}
        title="Gold Investments"
        subtitle="Physical gold, digital gold, ETF, SGB across all family members"
        action={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Add Gold
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total Value</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalValue)}</p>
          <p className="text-xs text-slate-500">{items.length} holding{items.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total Weight</p>
          <p className="text-xl font-bold text-yellow-400">{totalWeight > 0 ? `${totalWeight.toFixed(2)}g` : '—'}</p>
          <p className="text-xs text-slate-500">{physicalCount} physical item{physicalCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Digital / Market</p>
          <p className="text-xl font-bold text-emerald-400">{digitalCount}</p>
          <p className="text-xs text-slate-500">ETF / SGB / Digital</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Gold Price (22K/g)</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">₹</span>
            <input
              type="number"
              value={goldPrice}
              onChange={e => setGoldPrice(Number(e.target.value))}
              className="bg-transparent text-white font-bold text-lg w-20 focus:outline-none"
            />
          </div>
          <button onClick={revalueAll} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 mt-1">
            <TrendingUp size={10}/> Revalue all physical
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse"/>)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Coins size={48} className="mb-4 opacity-30"/>
          <p>No gold holdings added yet. Click "Add Gold" to get started.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map(g => (
            <div key={g.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 ${goldTypeColor(g.gold_type)} rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0`}>
                    🪙
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{g.item_description}</h3>
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{g.gold_type}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(g)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={13}/></button>
                  <button onClick={() => handleDelete(g.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-2">{g.family_members?.full_name}</p>

              <div className="grid grid-cols-3 gap-2 text-sm">
                {g.weight_grams && (
                  <div><p className="text-slate-500 text-xs">Weight</p><p className="text-white">{g.weight_grams}g</p></div>
                )}
                {g.purity && g.purity !== 'Not Applicable' && (
                  <div><p className="text-slate-500 text-xs">Purity</p><p className="text-white">{g.purity}</p></div>
                )}
                {g.storage_location && (
                  <div><p className="text-slate-500 text-xs">Storage</p><p className="text-white">{g.storage_location}</p></div>
                )}
                {g.hallmark_number && (
                  <div><p className="text-slate-500 text-xs">Hallmark</p><p className="text-white font-mono text-xs">{g.hallmark_number}</p></div>
                )}
                {g.folio_number && (
                  <div><p className="text-slate-500 text-xs">Folio No.</p><p className="text-white font-mono text-xs">{g.folio_number}</p></div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Purchase Price</p>
                  <p className="text-white">{fmt(g.purchase_price_total)}</p>
                  {g.purchase_price_per_gram && <p className="text-xs text-slate-500">₹{g.purchase_price_per_gram}/g</p>}
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Current Value</p>
                  <p className="text-amber-400 font-bold">{fmt(g.current_value || g.purchase_price_total)}</p>
                  {g.current_value && g.purchase_price_total && g.current_value > g.purchase_price_total && (
                    <p className="text-xs text-emerald-400">+{fmt(g.current_value - g.purchase_price_total)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Gold Entry' : 'Add Gold'} size="lg">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Owner *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.member_id} onChange={e=>setForm({...form,member_id:e.target.value})}>
                {members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Gold Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.gold_type} onChange={e=>setForm({...form,gold_type:e.target.value})}>
                {GOLD_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description *</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.item_description} onChange={e=>setForm({...form,item_description:e.target.value})} placeholder="e.g. Gold Necklace, 10g Coin, Nippon Gold ETF" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Weight (grams)</label>
              <input type="number" step="0.001" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                value={form.weight_grams}
                onChange={e => {
                  const w = e.target.value
                  const cv = autoCalcValue(w, form.purity, goldPrice)
                  setForm({...form, weight_grams: w, current_value: cv || form.current_value })
                }}
                placeholder="10.5" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Purity</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.purity}
                onChange={e => {
                  const p = e.target.value
                  const cv = autoCalcValue(form.weight_grams, p, goldPrice)
                  setForm({...form, purity: p, current_value: cv || form.current_value })
                }}>
                {PURITY.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Purchase Price Total (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.purchase_price_total} onChange={e=>setForm({...form,purchase_price_total:e.target.value})} placeholder="75000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Price per Gram (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.purchase_price_per_gram} onChange={e=>setForm({...form,purchase_price_per_gram:e.target.value})} placeholder="6500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Value (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.current_value} onChange={e=>setForm({...form,current_value:e.target.value})} placeholder="Auto-calculated from weight" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Making Charges (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.making_charges} onChange={e=>setForm({...form,making_charges:e.target.value})} placeholder="5000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Purchase Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Storage Location</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.storage_location} onChange={e=>setForm({...form,storage_location:e.target.value})}>
                {STORAGE.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Hallmark Number</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.hallmark_number} onChange={e=>setForm({...form,hallmark_number:e.target.value})} placeholder="HUID number" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Folio / Account No.</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" value={form.folio_number} onChange={e=>setForm({...form,folio_number:e.target.value})} placeholder="For ETF / SGB / Digital" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes</label>
            <textarea className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 text-sm" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any additional notes" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Gold')}
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import {
  Home, Plus, Edit2, Trash2, IndianRupee, MapPin,
  Upload, Eye, FileText, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, Building, Landmark, TreePine, Store, FileImage, Clipboard
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FamilyMember } from '@/types'

const PROPERTY_TYPES = ['Residential Flat', 'House/Villa', 'Plot/Land', 'Commercial', 'Agricultural Land', 'Office Space', 'Other']
const AREA_UNITS = ['sq ft', 'sq yards', 'sq meter', 'bigha', 'acres', 'gaj', 'marla']

const fmt = (n?: number | null) => n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'
const fmtArea = (v?: number | null, u?: string | null) => v ? `${v.toLocaleString('en-IN')} ${u || 'sq ft'}` : '—'

const emptyForm = {
  member_id: '', property_name: '', property_type: 'Residential Flat',
  address: '', city: '', state: '', pin_code: '',
  area_value: '', area_unit: 'sq ft',
  purchase_price: '', current_value: '', purchase_date: '',
  registration_date: '', registration_number: '', stamp_duty_paid: '',
  co_owner_name: '', is_rented: false, annual_rental_income: '',
  loan_outstanding: '', notes: '',
}

function typeIcon(t: string) {
  if (t.includes('Flat') || t.includes('House')) return <Home size={18} />
  if (t.includes('Plot') || t.includes('Land') || t.includes('Agricultural')) return <TreePine size={18} />
  if (t.includes('Commercial') || t.includes('Office') || t.includes('Store')) return <Store size={18} />
  return <Building size={18} />
}

function typeColor(t: string) {
  if (t.includes('Flat') || t.includes('House') || t.includes('Villa')) return 'bg-indigo-600'
  if (t.includes('Plot') || t.includes('Land') || t.includes('Agricultural')) return 'bg-emerald-600'
  if (t.includes('Commercial') || t.includes('Office')) return 'bg-amber-600'
  return 'bg-slate-600'
}

type UploadMode = 'none' | 'uploading' | 'parsed' | 'error'

export default function RealEstatePage() {
  const [properties, setProperties] = useState<any[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploadMode, setUploadMode] = useState<UploadMode>('none')
  const [uploadError, setUploadError] = useState('')
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [pastedImage, setPastedImage] = useState<{ base64: string; mime: string; preview: string } | null>(null)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  // Paste listener
  useEffect(() => {
    if (!showUploadPanel) return
    const handler = (e: ClipboardEvent) => {
      for (const item of e.clipboardData?.items || []) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()!
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            const [header, data] = dataUrl.split(',')
            const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
            setPastedImage({ base64: data, mime, preview: dataUrl })
          }
          reader.readAsDataURL(blob)
          break
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [showUploadPanel])

  const loadData = async () => {
    setLoading(true)
    const [propRes, memRes] = await Promise.all([
      supabase.from('real_estate').select('*, family_members(full_name)').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').order('full_name'),
    ])
    setProperties(propRes.data || [])
    setMembers(memRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const openAdd = (prefill?: Partial<typeof emptyForm>) => {
    setForm({ ...emptyForm, member_id: members[0]?.id || '', ...prefill })
    setEditItem(null); setModalOpen(true)
  }
  const openEdit = (p: any) => {
    setForm({
      member_id: p.member_id, property_name: p.property_name, property_type: p.property_type,
      address: p.address || '', city: p.city || '', state: p.state || '', pin_code: p.pin_code || '',
      area_value: String(p.area_value || ''), area_unit: p.area_unit || 'sq ft',
      purchase_price: String(p.purchase_price || ''), current_value: String(p.current_value || ''),
      purchase_date: p.purchase_date || '', registration_date: p.registration_date || '',
      registration_number: p.registration_number || '', stamp_duty_paid: String(p.stamp_duty_paid || ''),
      co_owner_name: p.co_owner_name || '', is_rented: !!p.is_rented,
      annual_rental_income: String(p.annual_rental_income || ''),
      loan_outstanding: String(p.loan_outstanding || ''), notes: p.notes || '',
    })
    setEditItem(p); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.member_id || !form.property_name) return
    setSaving(true)
    const payload = {
      ...form,
      area_value: parseFloat(form.area_value) || null,
      purchase_price: parseFloat(form.purchase_price) || null,
      current_value: parseFloat(form.current_value) || null,
      stamp_duty_paid: parseFloat(form.stamp_duty_paid) || null,
      annual_rental_income: parseFloat(form.annual_rental_income) || null,
      loan_outstanding: parseFloat(form.loan_outstanding) || 0,
      purchase_date: form.purchase_date || null,
      registration_date: form.registration_date || null,
    }
    if (editItem) await supabase.from('real_estate').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id)
    else await supabase.from('real_estate').insert({ ...payload, is_active: true })
    setSaving(false); setModalOpen(false); loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this property?')) return
    await supabase.from('real_estate').update({ is_active: false }).eq('id', id)
    loadData()
  }

  const parseFile = async (file: File) => {
    setUploadMode('uploading'); setUploadError(''); setNeedsApiKey(false)
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/real-estate/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setNeedsApiKey(!!data.needsApiKey); setUploadError(data.error); setUploadMode('error'); return }
      setExtracted(data.extracted); setUploadMode('parsed')
    } catch (e: any) { setUploadError(e.message); setUploadMode('error') }
  }

  const parseImage = async () => {
    if (!pastedImage) return
    setUploadMode('uploading'); setUploadError(''); setNeedsApiKey(false)
    const fd = new FormData()
    fd.append('imageBase64', pastedImage.base64); fd.append('imageMime', pastedImage.mime)
    try {
      const res = await fetch('/api/real-estate/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setNeedsApiKey(!!data.needsApiKey); setUploadError(data.error); setUploadMode('error'); return }
      setExtracted(data.extracted); setUploadMode('parsed')
    } catch (e: any) { setUploadError(e.message); setUploadMode('error') }
  }

  const fillFormFromExtracted = () => {
    if (!extracted) return
    const memberId = members.find(m => m.full_name.toLowerCase().includes((extracted.member_name || '').toLowerCase()))?.id || members[0]?.id || ''
    openAdd({
      member_id: memberId,
      property_type: extracted.property_type || 'Residential Flat',
      address: extracted.address || '',
      city: extracted.city || '',
      state: extracted.state || '',
      pin_code: extracted.pin_code || '',
      area_value: String(extracted.area_value || ''),
      area_unit: extracted.area_unit || 'sq ft',
      purchase_price: String(extracted.purchase_price || ''),
      purchase_date: extracted.purchase_date || '',
      registration_date: extracted.registration_date || '',
      registration_number: extracted.registration_number || '',
      stamp_duty_paid: String(extracted.stamp_duty_paid || ''),
      co_owner_name: extracted.co_owner_name || '',
    })
    setShowUploadPanel(false)
  }

  const totalValue = properties.reduce((s, p) => s + Number(p.current_value || p.purchase_price || 0), 0)
  const totalPurchase = properties.reduce((s, p) => s + Number(p.purchase_price || 0), 0)
  const totalRental = properties.filter(p => p.is_rented).reduce((s, p) => s + Number(p.annual_rental_income || 0), 0)

  const F = ({ label, value }: { label: string; value: string }) => (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
        value={value} onChange={() => {}} readOnly />
    </div>
  )

  return (
    <MainLayout>
      <PageHeader
        icon={Home}
        title="Real Estate"
        subtitle="Property portfolio across all family members"
        action={
          <div className="flex gap-2">
            <button onClick={() => { setShowUploadPanel(!showUploadPanel); setUploadMode('none'); setExtracted(null); setPastedImage(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm transition-colors">
              <Upload size={14} /> Upload Documents
            </button>
            <button onClick={() => openAdd()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
              <Plus size={16} /> Add Property
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Properties', value: properties.length, sub: '', color: 'indigo' },
          { label: 'Current Value', value: fmt(totalValue), sub: `Purchased at ${fmt(totalPurchase)}`, color: 'emerald' },
          { label: 'Annual Rental', value: fmt(totalRental), sub: `${properties.filter(p=>p.is_rented).length} rented`, color: 'amber' },
          { label: 'Appreciation', value: totalPurchase > 0 ? `+${(((totalValue - totalPurchase) / totalPurchase) * 100).toFixed(1)}%` : '—', sub: fmt(totalValue - totalPurchase) + ' gain', color: 'violet' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
            <p className="text-slate-400 text-xs mb-1">{label}</p>
            <p className={`text-xl font-bold text-${color}-400`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className="bg-slate-800 border border-violet-500/30 rounded-2xl p-5 mb-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Upload size={16} className="text-violet-400" /> Upload Property Documents</h3>
          <p className="text-slate-400 text-sm">Upload sale deed, registry, property card, or any document — system will extract address, area, price, registration details automatically.</p>

          {uploadMode === 'none' && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* File upload */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-violet-400 bg-violet-500/10' : 'border-slate-600 hover:border-violet-500'}`}
              >
                <FileText size={28} className="text-slate-500 mx-auto mb-2" />
                <p className="text-white text-sm font-medium">PDF / Word / Excel</p>
                <p className="text-slate-500 text-xs">Sale deed, registry document, property card</p>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
              </div>

              {/* Image/paste */}
              <div className="space-y-2">
                <div
                  className="border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl p-4 text-center cursor-pointer transition-all"
                  onClick={() => imgRef.current?.click()}
                >
                  {pastedImage ? (
                    <img src={pastedImage.preview} alt="" className="max-h-24 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <Clipboard size={24} className="text-amber-500 mx-auto mb-1" />
                      <p className="text-white text-sm">Ctrl+V to paste screenshot</p>
                      <p className="text-slate-500 text-xs">or click to upload image</p>
                    </>
                  )}
                  <input ref={imgRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const dataUrl = ev.target?.result as string
                        const [h, d] = dataUrl.split(',')
                        setPastedImage({ base64: d, mime: h.match(/:(.*?);/)?.[1]||'image/jpeg', preview: dataUrl })
                      }
                      reader.readAsDataURL(f)
                    }} />
                </div>
                {pastedImage && (
                  <button onClick={parseImage} className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-xl text-sm transition-colors">
                    <Eye size={14} /> Extract from Image (needs Claude API)
                  </button>
                )}
              </div>
            </div>
          )}

          {uploadMode === 'uploading' && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={20} className="animate-spin text-violet-400" />
              <p className="text-slate-300">Extracting property details from document...</p>
            </div>
          )}

          {uploadMode === 'error' && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{uploadError}{needsApiKey && <p className="mt-1 text-amber-400 text-xs">Add ANTHROPIC_API_KEY to .env.local for image OCR.</p>}</div>
            </div>
          )}

          {uploadMode === 'parsed' && extracted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 size={16} /> Data extracted — review and confirm
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm bg-slate-900/50 rounded-xl p-4">
                {extracted.property_type && <div><p className="text-slate-500 text-xs">Type</p><p className="text-white">{extracted.property_type}</p></div>}
                {extracted.area_value && <div><p className="text-slate-500 text-xs">Area</p><p className="text-white">{fmtArea(extracted.area_value, extracted.area_unit)}</p></div>}
                {extracted.purchase_price && <div><p className="text-slate-500 text-xs">Purchase Price</p><p className="text-white font-medium">{fmt(extracted.purchase_price)}</p></div>}
                {extracted.registration_number && <div><p className="text-slate-500 text-xs">Reg. No.</p><p className="text-white font-mono">{extracted.registration_number}</p></div>}
                {extracted.purchase_date && <div><p className="text-slate-500 text-xs">Purchase Date</p><p className="text-white">{extracted.purchase_date}</p></div>}
                {extracted.state && <div><p className="text-slate-500 text-xs">State</p><p className="text-white">{extracted.state}</p></div>}
                {extracted.city && <div><p className="text-slate-500 text-xs">City</p><p className="text-white">{extracted.city}</p></div>}
                {extracted.stamp_duty_paid && <div><p className="text-slate-500 text-xs">Stamp Duty</p><p className="text-white">{fmt(extracted.stamp_duty_paid)}</p></div>}
                {extracted.member_name && <div><p className="text-slate-500 text-xs">Owner (detected)</p><p className="text-white">{extracted.member_name}</p></div>}
              </div>
              <div className="flex gap-3">
                <button onClick={fillFormFromExtracted}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  <Plus size={14} /> Fill Form with Extracted Data
                </button>
                <button onClick={() => { setUploadMode('none'); setExtracted(null); setPastedImage(null) }}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
                  Re-upload
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Property list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-32 bg-slate-800 rounded-2xl animate-pulse"/>)}</div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Home size={48} className="mb-4 opacity-30" />
          <p className="mb-1">No properties added yet.</p>
          <p className="text-sm">Click "Add Property" or upload a document above.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {properties.map(p => {
            const gain = (p.current_value && p.purchase_price) ? p.current_value - p.purchase_price : 0
            const gainPct = (p.purchase_price && gain) ? ((gain / p.purchase_price) * 100).toFixed(1) : null
            return (
              <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 ${typeColor(p.property_type)} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                      {typeIcon(p.property_type)}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{p.property_name}</h3>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{p.property_type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={13}/></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <p className="text-slate-400 text-xs">{p.family_members?.full_name}</p>
                  {(p.city || p.state) && (
                    <p className="flex items-center gap-1 text-slate-400 text-xs">
                      <MapPin size={11}/> {[p.city, p.state].filter(Boolean).join(', ')} {p.pin_code && `- ${p.pin_code}`}
                    </p>
                  )}
                  {p.area_value && <p className="text-slate-400 text-xs">{fmtArea(p.area_value, p.area_unit)}</p>}
                  {p.registration_number && <p className="text-slate-500 text-xs font-mono">Reg: {p.registration_number}</p>}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Purchase Price</p>
                    <p className="text-white font-medium">{fmt(p.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Current Value</p>
                    <p className="text-emerald-400 font-medium">{fmt(p.current_value || p.purchase_price)}</p>
                  </div>
                  {gainPct && Number(gainPct) > 0 && (
                    <div>
                      <p className="text-slate-500 text-xs">Appreciation</p>
                      <p className="text-emerald-400">+{gainPct}% ({fmt(gain)})</p>
                    </div>
                  )}
                  {p.is_rented && (
                    <div>
                      <p className="text-slate-500 text-xs">Annual Rental</p>
                      <p className="text-amber-400">{fmt(p.annual_rental_income)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Property' : 'Add Property'} size="lg">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Owner *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.member_id} onChange={e=>setForm({...form,member_id:e.target.value})}>
                {members.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Property Type *</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.property_type} onChange={e=>setForm({...form,property_type:e.target.value})}>
                {PROPERTY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Property Name / Description *</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.property_name} onChange={e=>setForm({...form,property_name:e.target.value})} placeholder="e.g. Sector 62 Flat, Noida" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Full Address</label>
            <textarea className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="House/Flat number, Street, Locality" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">City</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Noida" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">State</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} placeholder="Uttar Pradesh" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">PIN Code</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.pin_code} onChange={e=>setForm({...form,pin_code:e.target.value})} placeholder="201301" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Area</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.area_value} onChange={e=>setForm({...form,area_value:e.target.value})} placeholder="1200" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Area Unit</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.area_unit} onChange={e=>setForm({...form,area_unit:e.target.value})}>
                {AREA_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Purchase Price (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})} placeholder="5000000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Current Market Value (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.current_value} onChange={e=>setForm({...form,current_value:e.target.value})} placeholder="7500000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Purchase Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Registration Date</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.registration_date} onChange={e=>setForm({...form,registration_date:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Registration Number</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.registration_number} onChange={e=>setForm({...form,registration_number:e.target.value})} placeholder="REG/2024/12345" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Stamp Duty Paid (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.stamp_duty_paid} onChange={e=>setForm({...form,stamp_duty_paid:e.target.value})} placeholder="250000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Co-owner Name</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.co_owner_name} onChange={e=>setForm({...form,co_owner_name:e.target.value})} placeholder="Kavita Gupta" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Loan Outstanding (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.loan_outstanding} onChange={e=>setForm({...form,loan_outstanding:e.target.value})} placeholder="0" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="rented" checked={form.is_rented} onChange={e=>setForm({...form,is_rented:e.target.checked})} className="w-4 h-4 rounded accent-indigo-500" />
            <label htmlFor="rented" className="text-slate-300 text-sm">This property is currently rented out</label>
          </div>
          {form.is_rented && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Annual Rental Income (₹)</label>
              <input type="number" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" value={form.annual_rental_income} onChange={e=>setForm({...form,annual_rental_income:e.target.value})} placeholder="240000" />
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes</label>
            <textarea className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any additional notes" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={()=>setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? 'Saving...' : (editItem ? 'Save Changes' : 'Add Property')}
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

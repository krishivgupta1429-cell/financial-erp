'use client'

import { useEffect, useState } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { Users, Plus, Edit2, Phone, Mail, CreditCard, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FamilyMember } from '@/types'

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4']
const RELATIONSHIPS = ['Owner', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other']

const emptyForm = { full_name: '', relationship: 'Owner', pan_number: '', aadhaar_number: '', date_of_birth: '', email: '', phone: '', avatar_color: '#6366f1' }

export default function FamilyPage() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editMember, setEditMember] = useState<FamilyMember | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchMembers = async () => {
    setLoading(true)
    const { data } = await supabase.from('family_members').select('*').order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchMembers() }, [])

  const openAdd = () => { setForm(emptyForm); setEditMember(null); setModalOpen(true) }
  const openEdit = (m: FamilyMember) => { setForm({ full_name: m.full_name, relationship: m.relationship, pan_number: m.pan_number || '', aadhaar_number: m.aadhaar_number || '', date_of_birth: m.date_of_birth || '', email: m.email || '', phone: m.phone || '', avatar_color: m.avatar_color }); setEditMember(m); setModalOpen(true) }

  const handleSave = async () => {
    if (!form.full_name || !form.relationship) return
    setSaving(true)
    if (editMember) {
      await supabase.from('family_members').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editMember.id)
    } else {
      await supabase.from('family_members').insert(form)
    }
    setSaving(false)
    setModalOpen(false)
    fetchMembers()
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <MainLayout>
      <PageHeader
        title="Family Members"
        subtitle="Manage all family member profiles"
        icon={Users}
        action={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Add Member
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map(member => (
            <div key={member.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 card-hover">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: member.avatar_color }}>
                  {getInitials(member.full_name)}
                </div>
                <button onClick={() => openEdit(member)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
                  <Edit2 size={14} />
                </button>
              </div>
              <h3 className="font-semibold text-white text-lg">{member.full_name}</h3>
              <span className="inline-block px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full mt-1 mb-4">{member.relationship}</span>
              <div className="space-y-2">
                {member.phone && <div className="flex items-center gap-2 text-xs text-slate-400"><Phone size={12} />{member.phone}</div>}
                {member.email && <div className="flex items-center gap-2 text-xs text-slate-400"><Mail size={12} />{member.email}</div>}
                {member.pan_number && <div className="flex items-center gap-2 text-xs text-slate-400"><CreditCard size={12} />PAN: {member.pan_number}</div>}
                {member.date_of_birth && <div className="flex items-center gap-2 text-xs text-slate-400"><Calendar size={12} />{new Date(member.date_of_birth).toLocaleDateString('en-IN')}</div>}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <div className="col-span-4 flex flex-col items-center justify-center py-20 text-slate-500">
              <Users size={48} className="mb-4 opacity-30" />
              <p>No family members added yet</p>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editMember ? 'Edit Member' : 'Add Family Member'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Full Name *</label>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Vishal Gupta" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Relationship *</label>
            <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})}>
              {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">PAN Number</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 uppercase" value={form.pan_number} onChange={e => setForm({...form, pan_number: e.target.value.toUpperCase()})} placeholder="ABCDE1234F" maxLength={10} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Date of Birth</label>
              <input type="date" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Phone</label>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input type="email" className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="name@email.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Avatar Color</label>
            <div className="flex gap-2">
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => setForm({...form, avatar_color: c})} className={`w-8 h-8 rounded-full transition-all ${form.avatar_color === c ? 'ring-2 ring-white scale-110' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {saving ? 'Saving...' : (editMember ? 'Save Changes' : 'Add Member')}
            </button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  )
}

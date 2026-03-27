'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import {
  Inbox, Plus, CheckCircle2, AlertCircle, Clock, ChevronDown,
  FileText, FileImage, Mic, MicOff, Loader2, Upload, X,
  Eye, EyeOff, AlertTriangle, Info, RefreshCw, Clipboard,
  TrendingDown, Filter, ChevronRight, Bell, Archive
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type Status = 'open' | 'in_progress' | 'disposed' | 'ignored'
type Channel = 'manual' | 'sms' | 'email' | 'image_ocr' | 'voice' | 'pdf'

interface Notif {
  id: string; member_id?: string; source_channel: Channel; raw_text: string
  category: string; subcategory: string; amount?: number; reference_number?: string
  institution_name?: string; notification_date?: string; due_date?: string
  action_title: string; action_description: string; action_priority: Priority
  action_due_date?: string; status: Status; disposed_at?: string
  disposal_note?: string; disposed_by?: string; confidence: string
  needs_review: boolean; created_at: string
  family_members?: { full_name: string }
}

interface Pending {
  raw_text: string; source_channel: Channel; category: string; subcategory: string
  amount?: number; reference_number?: string; institution_name?: string
  notification_date?: string; due_date?: string; action_title: string
  action_description: string; action_priority: Priority; action_due_date?: string
  confidence: string; needs_review: boolean
}

// ── Constants ─────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'border-l-rose-500 bg-rose-500/5',
  high: 'border-l-amber-500 bg-amber-500/5',
  medium: 'border-l-indigo-500 bg-indigo-500/5',
  low: 'border-l-slate-500 bg-slate-500/5',
}
const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  high: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  medium: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
  low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}
const CATEGORY_BADGE: Record<string, string> = {
  tds: 'bg-red-500/20 text-red-300', ipo: 'bg-violet-500/20 text-violet-300',
  survival_benefit: 'bg-emerald-500/20 text-emerald-300', fd_maturity: 'bg-orange-500/20 text-orange-300',
  premium_due: 'bg-rose-500/20 text-rose-300', credit_card_bill: 'bg-amber-500/20 text-amber-300',
  dividend: 'bg-green-500/20 text-green-300', fd_interest: 'bg-cyan-500/20 text-cyan-300',
  emi_debit: 'bg-blue-500/20 text-blue-300', emi_bounce: 'bg-red-600/20 text-red-400',
  mutual_fund: 'bg-indigo-500/20 text-indigo-300', itr: 'bg-teal-500/20 text-teal-300',
  itr_refund: 'bg-emerald-500/20 text-emerald-300', loan_sanction: 'bg-slate-500/20 text-slate-300',
  kyc: 'bg-rose-600/20 text-rose-400', bonus: 'bg-yellow-500/20 text-yellow-300',
  other: 'bg-slate-600/20 text-slate-400',
}
const CHANNEL_LABEL: Record<Channel, string> = {
  manual: 'Manual', sms: 'SMS', email: 'Email', image_ocr: 'Image/OCR', voice: 'Voice', pdf: 'PDF',
}
const fmt = (n?: number | null) => n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : ''
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

// ── Speech recognition ────────────────────────────────────────────
declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any } }

export default function InboxPage() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'inbox' | 'actions'>('actions')
  const [filterStatus, setFilterStatus] = useState<'open' | 'all'>('open')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterMember, setFilterMember] = useState('all')

  // Input panel
  const [inputMode, setInputMode] = useState<'text' | 'image' | 'voice' | 'file'>('text')
  const [pasteText, setPasteText] = useState('')
  const [pastedImage, setPastedImage] = useState<{ base64: string; mime: string; preview: string } | null>(null)
  const [voiceText, setVoiceText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const [pending, setPending] = useState<Pending[]>([])
  const [selectedMember, setSelectedMember] = useState('')

  // Disposal
  const [disposalTarget, setDisposalTarget] = useState<Notif | null>(null)
  const [disposalNote, setDisposalNote] = useState('')
  const [disposalBy, setDisposalBy] = useState('Vishal')
  const [disposing, setDisposing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const srRef = useRef<any>(null)

  // ── Paste listener ───────────────────────────────────────────
  useEffect(() => {
    if (inputMode !== 'image') return
    const handler = (e: ClipboardEvent) => {
      for (const item of e.clipboardData?.items || []) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()!
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            const [h, d] = dataUrl.split(',')
            setPastedImage({ base64: d, mime: h.match(/:(.*?);/)?.[1] || 'image/png', preview: dataUrl })
          }
          reader.readAsDataURL(blob)
          break
        }
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [inputMode])

  // ── Load data ─────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    const [nr, mr] = await Promise.all([
      supabase.from('notifications').select('*, family_members(full_name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('family_members').select('id, full_name').order('full_name'),
    ])
    setNotifs(nr.data || [])
    setMembers(mr.data || [])
    setSelectedMember(mr.data?.[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // ── Voice recognition ─────────────────────────────────────────
  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setParseError('Your browser does not support voice input. Try Chrome.'); return }
    if (isListening) { srRef.current?.stop(); setIsListening(false); return }
    const sr = new SR(); sr.lang = 'en-IN'; sr.continuous = true; sr.interimResults = true
    sr.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ')
      setVoiceText(transcript)
    }
    sr.onend = () => setIsListening(false)
    sr.start(); srRef.current = sr; setIsListening(true)
  }

  // ── Parse ─────────────────────────────────────────────────────
  const parse = async () => {
    setParsing(true); setParseError(''); setNeedsApiKey(false); setPending([])
    try {
      const fd = new FormData()
      if (inputMode === 'text' && pasteText.trim()) {
        fd.append('rawText', pasteText); fd.append('channel', 'sms')
      } else if (inputMode === 'voice' && voiceText.trim()) {
        fd.append('rawText', voiceText); fd.append('channel', 'voice')
      } else if (inputMode === 'image' && pastedImage) {
        fd.append('imageBase64', pastedImage.base64); fd.append('imageMime', pastedImage.mime)
      } else if (inputMode === 'file' && fileRef.current?.files?.[0]) {
        fd.append('file', fileRef.current.files[0])
      } else {
        setParseError('Nothing to process. Enter text, paste image, or upload file.'); setParsing(false); return
      }
      const res = await fetch('/api/inbox/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setNeedsApiKey(!!data.needsApiKey); setParseError(data.error); setParsing(false); return }
      setPending(data.notifications)
    } catch (e: any) { setParseError(e.message) }
    finally { setParsing(false) }
  }

  // ── Save notification(s) ──────────────────────────────────────
  const saveAll = async () => {
    const rows = pending.map(p => ({
      member_id: selectedMember || null,
      source_channel: p.source_channel,
      raw_text: p.raw_text,
      category: p.category,
      subcategory: p.subcategory,
      amount: p.amount || null,
      reference_number: p.reference_number || null,
      institution_name: p.institution_name || null,
      notification_date: p.notification_date || null,
      due_date: p.due_date || null,
      action_title: p.action_title,
      action_description: p.action_description,
      action_priority: p.action_priority,
      action_due_date: p.action_due_date || null,
      status: 'open',
      confidence: p.confidence,
      needs_review: p.needs_review,
    }))
    await supabase.from('notifications').insert(rows)
    setPending([]); setPasteText(''); setVoiceText(''); setPastedImage(null)
    if (fileRef.current) fileRef.current.value = ''
    await loadData()
    setTab('actions')
  }

  // ── Dispose ───────────────────────────────────────────────────
  const dispose = async () => {
    if (!disposalTarget) return
    setDisposing(true)
    await supabase.from('notifications').update({
      status: 'disposed', disposed_at: new Date().toISOString(),
      disposal_note: disposalNote, disposed_by: disposalBy, updated_at: new Date().toISOString(),
    }).eq('id', disposalTarget.id)
    setDisposing(false); setDisposalTarget(null); setDisposalNote('')
    await loadData()
  }

  const ignore = async (id: string) => {
    await supabase.from('notifications').update({ status: 'ignored', updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const snooze = async (id: string) => {
    const n = notifs.find(x => x.id === id)
    if (!n) return
    const base = n.action_due_date || new Date().toISOString().slice(0, 10)
    const d = new Date(base); d.setDate(d.getDate() + 7)
    await supabase.from('notifications').update({ action_due_date: d.toISOString().slice(0,10), updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Filtered data ──────────────────────────────────────────────
  const filtered = notifs.filter(n => {
    if (filterStatus === 'open' && !['open','in_progress'].includes(n.status)) return false
    if (filterCategory !== 'all' && n.category !== filterCategory) return false
    if (filterMember !== 'all' && n.member_id !== filterMember) return false
    return true
  })

  const actionItems = filtered.filter(n => ['open','in_progress'].includes(n.status))
    .sort((a,b) => {
      const pa = ['urgent','high','medium','low'].indexOf(a.action_priority)
      const pb = ['urgent','high','medium','low'].indexOf(b.action_priority)
      return pa - pb
    })

  const urgent = actionItems.filter(n => n.action_priority === 'urgent')
  const high = actionItems.filter(n => n.action_priority === 'high')
  const medium = actionItems.filter(n => n.action_priority === 'medium')
  const low = actionItems.filter(n => n.action_priority === 'low')

  const openCount = notifs.filter(n => ['open','in_progress'].includes(n.status)).length
  const urgentCount = notifs.filter(n => n.action_priority === 'urgent' && ['open','in_progress'].includes(n.status)).length

  // ── Notification Card ─────────────────────────────────────────
  const NotifCard = ({ n }: { n: Notif }) => {
    const isExp = expanded.has(n.id)
    const days = daysUntil(n.action_due_date)
    const overdue = days !== null && days < 0
    const dueSoon = days !== null && days >= 0 && days <= 7

    return (
      <div className={`border-l-4 rounded-r-2xl rounded-l-sm bg-slate-800 border border-slate-700 ${PRIORITY_COLORS[n.action_priority]} transition-all`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[n.action_priority]}`}>
                  {n.action_priority.toUpperCase()}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_BADGE[n.category] || CATEGORY_BADGE.other}`}>
                  {n.subcategory || n.category}
                </span>
                {n.needs_review && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    ⚠ Review
                  </span>
                )}
                <span className="text-xs text-slate-500">{CHANNEL_LABEL[n.source_channel]}</span>
              </div>

              {/* Action title */}
              <p className="text-white font-semibold text-sm mb-1">{n.action_title}</p>

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                {n.amount && <span className="text-emerald-400 font-medium">{fmt(n.amount)}</span>}
                {n.institution_name && <span>{n.institution_name}</span>}
                {n.family_members?.full_name && <span>{n.family_members.full_name}</span>}
                {n.action_due_date && (
                  <span className={overdue ? 'text-rose-400 font-medium' : dueSoon ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                    {overdue ? `⚡ Overdue by ${Math.abs(days!)}d` : days === 0 ? '⚡ Due today' : `Due in ${days}d`}
                  </span>
                )}
              </div>
            </div>

            {/* Status badge */}
            {n.status === 'disposed' && (
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
          </div>

          {/* Expanded: raw text + description + actions */}
          {isExp && (
            <div className="mt-3 space-y-3">
              <div className="bg-slate-900/60 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">Original message</p>
                <p className="text-slate-300 text-xs whitespace-pre-wrap">{n.raw_text}</p>
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                <p className="text-xs text-indigo-400 font-medium mb-1">What to do</p>
                <p className="text-slate-300 text-xs">{n.action_description}</p>
              </div>
              {n.reference_number && (
                <p className="text-xs text-slate-400">Ref: <span className="font-mono text-white">{n.reference_number}</span></p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {['open','in_progress'].includes(n.status) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={() => { setDisposalTarget(n); setDisposalNote('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors border border-emerald-500/30">
                <CheckCircle2 size={12} /> Mark Disposed
              </button>
              <button onClick={() => snooze(n.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors">
                <Clock size={12} /> Snooze 7d
              </button>
              <button onClick={() => ignore(n.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg text-xs transition-colors">
                <EyeOff size={12} /> Ignore
              </button>
              <button onClick={() => toggleExpand(n.id)}
                className="ml-auto flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors">
                {isExp ? 'Less' : 'Details'} <ChevronDown size={12} className={`transition-transform ${isExp ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {n.status === 'disposed' && (
            <div className="mt-2 flex items-start gap-2 text-xs text-slate-400">
              <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>{n.disposal_note || 'Disposed'}{n.disposed_by ? ` — ${n.disposed_by}` : ''}</span>
              <button onClick={() => toggleExpand(n.id)} className="ml-auto text-slate-500 hover:text-slate-300">
                {isExp ? <ChevronDown size={12} className="rotate-180" /> : <ChevronDown size={12} />}
              </button>
            </div>
          )}
          {n.status === 'disposed' && isExp && (
            <div className="mt-2 bg-slate-900/60 rounded-xl p-3">
              <p className="text-slate-300 text-xs whitespace-pre-wrap">{n.raw_text}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Priority section ──────────────────────────────────────────
  const PrioritySection = ({ label, items, color }: { label: string; items: Notif[]; color: string }) => {
    const [open, setOpen] = useState(true)
    if (items.length === 0) return null
    return (
      <div>
        <button onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 mb-2 text-sm font-semibold ${color}`}>
          <span>{label} ({items.length})</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div className="space-y-2">{items.map(n => <NotifCard key={n.id} n={n} />)}</div>}
      </div>
    )
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <PageHeader
          icon={Inbox}
          title="Financial Inbox"
          subtitle={`${openCount} open action${openCount !== 1 ? 's' : ''}${urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}`}
        />

        {/* ── Tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
          {([['actions', Bell, 'Action Items'], ['inbox', Archive, 'All Inbox']] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === v ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Icon size={14} /> {label}
              {v === 'actions' && openCount > 0 && (
                <span className="bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{openCount > 99 ? '99+' : openCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[380px_1fr] gap-5">

          {/* ── LEFT: Input Panel ────────────────────────────────── */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Plus size={16} className="text-indigo-400" /> Add Notification
              </h3>

              {/* Input mode tabs */}
              <div className="flex gap-1 bg-slate-900 rounded-xl p-1 mb-3">
                {([['text', FileText, 'Paste'], ['image', FileImage, 'Image'], ['voice', Mic, 'Voice'], ['file', Upload, 'File']] as const).map(([m, Icon, label]) => (
                  <button key={m} onClick={() => { setInputMode(m); setParseError('') }}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors ${inputMode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              {/* Text paste */}
              {inputMode === 'text' && (
                <textarea
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  rows={5}
                  placeholder={`Paste SMS, email, or any notification text here.\n\nExamples:\n• "TDS of Rs 1500 deducted on your FD interest"\n• "Your LIC policy premium of Rs 24000 is due on 31-Mar"\n• "IPO allotment confirmed for 10 shares of ABC Ltd"\n• "Survival benefit of Rs 50000 credited to your account"`}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                />
              )}

              {/* Image paste */}
              {inputMode === 'image' && (
                <div className="space-y-2">
                  <div
                    className="border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl p-5 text-center cursor-pointer transition-all"
                    onClick={() => imgRef.current?.click()}
                  >
                    {pastedImage
                      ? <img src={pastedImage.preview} alt="" className="max-h-32 mx-auto rounded-lg" />
                      : (<>
                        <Clipboard size={24} className="text-amber-500 mx-auto mb-1" />
                        <p className="text-white text-sm font-medium">Ctrl+V to paste screenshot</p>
                        <p className="text-slate-500 text-xs mt-1">or click to upload image (needs Claude API key)</p>
                      </>)
                    }
                    <input ref={imgRef} type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const dataUrl = ev.target?.result as string
                          const [h,d] = dataUrl.split(',')
                          setPastedImage({ base64: d, mime: h.match(/:(.*?);/)?.[1]||'image/jpeg', preview: dataUrl })
                        }
                        reader.readAsDataURL(f)
                      }} />
                  </div>
                  {pastedImage && (
                    <button onClick={() => setPastedImage(null)} className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1">
                      <X size={10}/> Clear image
                    </button>
                  )}
                </div>
              )}

              {/* Voice */}
              {inputMode === 'voice' && (
                <div className="space-y-2">
                  <button onClick={toggleVoice}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${isListening ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                    {isListening ? <><MicOff size={16}/> Stop Recording</> : <><Mic size={16}/> Start Voice Input</>}
                  </button>
                  {(voiceText || isListening) && (
                    <div className="bg-slate-700 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">Transcript</p>
                      <p className="text-white text-sm">{voiceText || <span className="text-slate-500 italic">Listening...</span>}</p>
                    </div>
                  )}
                  <p className="text-slate-500 text-xs">Speak the notification details clearly. Works in Chrome/Edge.</p>
                </div>
              )}

              {/* File upload */}
              {inputMode === 'file' && (
                <div
                  className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-xl p-5 text-center cursor-pointer transition-all"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={24} className="text-slate-500 mx-auto mb-1" />
                  <p className="text-white text-sm">Upload PDF, Word, or forwarded email</p>
                  <p className="text-slate-500 text-xs mt-1">.pdf .docx .doc .txt .eml</p>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.eml,.xlsx,.csv" className="hidden" />
                </div>
              )}

              {/* Member selector */}
              <div className="mt-3">
                <label className="block text-xs text-slate-400 mb-1">Assign to member</label>
                <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                  <option value="">— Not assigned —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>

              {/* Error */}
              {parseError && (
                <div className={`mt-2 flex items-start gap-2 text-xs rounded-xl p-2.5 ${needsApiKey ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  <div>{parseError}{needsApiKey && <p className="mt-1">Add ANTHROPIC_API_KEY to .env.local and restart server.</p>}</div>
                </div>
              )}

              <button onClick={parse} disabled={parsing}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {parsing ? <><Loader2 size={14} className="animate-spin"/> Classifying...</> : <><Eye size={14}/> Extract & Classify</>}
              </button>
            </div>

            {/* ── Pending Preview ──────────────────────────────── */}
            {pending.length > 0 && (
              <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-emerald-400 font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 size={14}/> {pending.length} notification{pending.length > 1 ? 's' : ''} classified
                  </p>
                  <button onClick={() => setPending([])} className="text-slate-500 hover:text-slate-300"><X size={14}/></button>
                </div>
                {pending.map((p, i) => (
                  <div key={i} className="bg-slate-900/60 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[p.action_priority]}`}>{p.action_priority.toUpperCase()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_BADGE[p.category] || CATEGORY_BADGE.other}`}>{p.subcategory}</span>
                    </div>
                    <p className="text-white text-xs font-medium">{p.action_title}</p>
                    {p.amount && <p className="text-emerald-400 text-xs">{fmt(p.amount)}</p>}
                    {p.institution_name && <p className="text-slate-400 text-xs">{p.institution_name}</p>}
                    {p.action_due_date && <p className="text-amber-400 text-xs">Due: {p.action_due_date}</p>}
                  </div>
                ))}
                <button onClick={saveAll}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  <Plus size={14}/> Save {pending.length > 1 ? 'All' : ''} to Inbox
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Open', val: notifs.filter(n=>['open','in_progress'].includes(n.status)).length, color: 'text-white' },
                { label: 'Urgent', val: urgentCount, color: 'text-rose-400' },
                { label: 'Disposed', val: notifs.filter(n=>n.status==='disposed').length, color: 'text-emerald-400' },
                { label: 'Total', val: notifs.length, color: 'text-slate-300' },
              ].map(({label, val, color}) => (
                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{val}</p>
                  <p className="text-slate-500 text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Notification List ──────────────────────── */}
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="open">Open / In Progress</option>
                <option value="all">All Statuses</option>
              </select>
              <select className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {['tds','ipo','survival_benefit','fd_maturity','premium_due','credit_card_bill','dividend','fd_interest','emi_debit','emi_bounce','mutual_fund','itr','itr_refund','loan_sanction','kyc','bonus','other'].map(c => (
                  <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                ))}
              </select>
              <select className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                <option value="all">All Members</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <button onClick={loadData} className="flex items-center gap-1 text-slate-400 hover:text-white text-xs px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl transition-colors">
                <RefreshCw size={12}/> Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse"/>)}</div>
            ) : (

              /* Action Items tab */
              tab === 'actions' ? (
                actionItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <CheckCircle2 size={48} className="mb-4 text-emerald-500 opacity-50"/>
                    <p className="font-medium text-emerald-400">All clear! No open action items.</p>
                    <p className="text-sm mt-1">Add a notification from the left panel to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <PrioritySection label="🔴 URGENT" items={urgent} color="text-rose-400" />
                    <PrioritySection label="🟡 HIGH" items={high} color="text-amber-400" />
                    <PrioritySection label="🔵 MEDIUM" items={medium} color="text-indigo-400" />
                    <PrioritySection label="⚪ LOW" items={low} color="text-slate-400" />
                  </div>
                )
              ) : (
                /* Inbox tab */
                filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Inbox size={48} className="mb-4 opacity-30"/>
                    <p>No notifications yet. Add one from the left panel.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map(n => <NotifCard key={n.id} n={n} />)}
                  </div>
                )
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Disposal Modal ──────────────────────────────────────── */}
      {disposalTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold">Mark as Disposed</h3>
                <p className="text-slate-400 text-sm mt-0.5">{disposalTarget.action_title}</p>
              </div>
              <button onClick={() => setDisposalTarget(null)} className="text-slate-500 hover:text-white"><X size={18}/></button>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-slate-300">
              {disposalTarget.action_description}
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">What did you do? *</label>
              <textarea
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                rows={3}
                placeholder={`e.g. "ITR filed on 25-Jul, ref no. XXXXX"\ne.g. "FD renewed at HDFC for 1 year at 7.5%"\ne.g. "Premium paid via UPI, ref no. XXXXX"`}
                value={disposalNote}
                onChange={e => setDisposalNote(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Completed by</label>
              <select className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                value={disposalBy} onChange={e => setDisposalBy(e.target.value)}>
                {members.map(m => <option key={m.id} value={m.full_name}>{m.full_name}</option>)}
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={() => ignore(disposalTarget.id).then(() => setDisposalTarget(null))}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                Ignore
              </button>
              <button onClick={() => snooze(disposalTarget.id).then(() => setDisposalTarget(null))}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors flex items-center gap-1">
                <Clock size={14}/> Snooze 7d
              </button>
              <button onClick={dispose} disabled={disposing || !disposalNote.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {disposing ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                Mark Disposed
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

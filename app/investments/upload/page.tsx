'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'
import {
  Upload, Download, FileSpreadsheet, CheckCircle, XCircle,
  AlertTriangle, ArrowLeft, Info, FileText, FileImage,
  Eye, Loader2, RefreshCw, Clipboard, ChevronRight,
  TrendingUp, AlertCircle, Camera,
} from 'lucide-react'
import type { ExtractedInvestment, InvestmentExtractionResult } from '@/lib/investmentExtractor'

// ── Confidence badge ────────────────────────────────────────────
function Badge({ confidence }: { confidence: string }) {
  const cls = confidence === 'high'
    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    : confidence === 'medium'
    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
  return <span className={`text-xs px-1.5 py-0.5 rounded-full ${cls}`}>{confidence}</span>
}

// ── Format currency ─────────────────────────────────────────────
function fmt(n?: number) {
  if (!n) return '—'
  return '₹' + n.toLocaleString('en-IN')
}

type Mode = 'choose' | 'structured' | 'freeflow' | 'screenshot' | 'review' | 'done'

interface UploadResult {
  success: boolean; inserted?: number; membersAffected?: number
  message?: string; error?: string; errors?: string[]
}

export default function InvestmentUploadPage() {
  const [mode, setMode] = useState<Mode>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [extracted, setExtracted] = useState<InvestmentExtractionResult | null>(null)
  const [parseMethod, setParseMethod] = useState('')
  const [pastedImage, setPastedImage] = useState<{ base64: string; mime: string; preview: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const screenshotRef = useRef<HTMLInputElement>(null)
  const pasteZoneRef = useRef<HTMLDivElement>(null)

  // ── Listen for Ctrl+V paste anywhere on this page ─────────────
  useEffect(() => {
    if (mode !== 'screenshot') return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) continue
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            const [header, data] = dataUrl.split(',')
            const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
            setPastedImage({ base64: data, mime, preview: dataUrl })
            setError('')
          }
          reader.readAsDataURL(blob)
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [mode])

  // ── File handlers ────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setError('') }
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError('') }
  }

  const onScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const [header, data] = dataUrl.split(',')
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      setPastedImage({ base64: data, mime, preview: dataUrl })
      setError('')
    }
    reader.readAsDataURL(f)
  }

  // ── Download template ────────────────────────────────────────
  const downloadTemplate = async () => {
    const res = await fetch('/api/investments/template')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'Gupta_Family_Investments_Template.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Upload structured Excel ──────────────────────────────────
  const uploadStructured = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/investments/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setUploadResult(data); setMode('done')
    } catch (e: any) { setError(e.message) }
    finally { setUploading(false) }
  }

  // ── Parse free-flow file ─────────────────────────────────────
  const parseFreeFlow = async () => {
    if (!file) return
    setParsing(true); setError(''); setNeedsApiKey(false)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/investments/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setNeedsApiKey(!!data.needsApiKey)
        setError(data.error || 'Failed to parse file')
        return
      }
      setExtracted(data.extracted); setParseMethod(data.method); setMode('review')
    } catch (e: any) { setError(e.message) }
    finally { setParsing(false) }
  }

  // ── Parse screenshot / image ─────────────────────────────────
  const parseScreenshot = async () => {
    if (!pastedImage) return
    setParsing(true); setError(''); setNeedsApiKey(false)
    try {
      const fd = new FormData()
      fd.append('imageBase64', pastedImage.base64)
      fd.append('imageMime', pastedImage.mime)
      const res = await fetch('/api/investments/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setNeedsApiKey(!!data.needsApiKey)
        setError(data.error || 'Failed to extract from image')
        return
      }
      setExtracted(data.extracted); setParseMethod(data.method); setMode('review')
    } catch (e: any) { setError(e.message) }
    finally { setParsing(false) }
  }

  const reset = () => {
    setMode('choose'); setFile(null); setUploadResult(null)
    setExtracted(null); setError(''); setParseMethod('')
    setPastedImage(null); setNeedsApiKey(false)
    if (fileRef.current) fileRef.current.value = ''
    if (screenshotRef.current) screenshotRef.current.value = ''
  }

  const DropZone = ({ accept, label }: { accept: string; label: string }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => fileRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
        ${dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-600 hover:border-indigo-500 hover:bg-slate-800/60'}`}
    >
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={onFileChange} />
      {file ? (
        <div className="space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto">
            <FileSpreadsheet size={24} className="text-white" />
          </div>
          <p className="text-white font-medium">{file.name}</p>
          <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB — ready to {label}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload size={28} className="text-slate-500 mx-auto" />
          <p className="text-white font-medium">Drop file here or click to browse</p>
          <p className="text-slate-500 text-sm">{accept.replace(/,/g, ' / ')}</p>
        </div>
      )}
    </div>
  )

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <PageHeader
          icon={TrendingUp}
          title="Upload Investments"
          subtitle="Import investments via Excel template, PDF/Word documents, or paste a screenshot"
          action={
            <Link href="/investments" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
              <ArrowLeft size={14} /> Back
            </Link>
          }
        />

        {/* ── Mode: choose ───────────────────────────────────────── */}
        {mode === 'choose' && (
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                id: 'structured', icon: FileSpreadsheet, color: 'indigo',
                title: 'Excel Template', badge: 'Recommended',
                desc: 'Download template, fill investment details for all members, upload back.',
                tags: ['All scheme types', 'Bulk entry', 'Precise mapping'],
              },
              {
                id: 'freeflow', icon: FileText, color: 'violet',
                title: 'PDF / Word / Excel',
                desc: 'Upload FD receipt, passbook, account statement, or any document.',
                tags: ['PDF', 'Word (.docx)', 'Excel', 'Text file'],
              },
              {
                id: 'screenshot', icon: Camera, color: 'amber',
                title: 'Screenshot / Image',
                desc: 'Paste a screenshot (Ctrl+V) or upload photo of FD receipt, passbook, etc.',
                tags: ['Ctrl+V paste', 'JPG / PNG', 'Needs Claude API'],
              },
            ].map(({ id, icon: Icon, color, title, badge, desc, tags }) => (
              <button
                key={id}
                onClick={() => setMode(id as Mode)}
                className={`bg-slate-800 border border-slate-700 hover:border-${color}-500 rounded-2xl p-5 text-left transition-all group`}
              >
                <div className={`w-11 h-11 bg-${color}-600/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-${color}-600/30 transition-colors`}>
                  <Icon size={22} className={`text-${color}-400`} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold">{title}</h3>
                  {badge && <span className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full">{badge}</span>}
                </div>
                <p className="text-slate-400 text-sm mb-3">{desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <div className={`mt-3 flex items-center gap-1 text-${color}-400 text-sm font-medium`}>
                  Select <ChevronRight size={14} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Mode: structured ───────────────────────────────────── */}
        {mode === 'structured' && (
          <div className="space-y-4">
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors"
            >
              <Download size={18} /> Download Investment Template (.xlsx)
            </button>

            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-200 text-sm">Uploading this file will <strong>replace all existing investments</strong> for members included in the file. Make sure all investments are included.</p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <h4 className="text-white font-medium mb-3">Upload Filled Template</h4>
              <DropZone accept=".xlsx,.xls,.csv" label="upload" />
              {error && (
                <div className="mt-3 flex items-start gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {file && (
                <button
                  onClick={uploadStructured}
                  disabled={uploading}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  {uploading ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Upload size={18} /> Upload & Save</>}
                </button>
              )}
            </div>

            <button onClick={reset} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          </div>
        )}

        {/* ── Mode: freeflow ─────────────────────────────────────── */}
        {mode === 'freeflow' && (
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <Info size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-400 text-sm">
                  Upload any PDF, Word, or Excel document — FD receipt, bank statement, post office passbook, etc. The system will scan for scheme names, amounts, dates, certificate numbers, and interest rates. You&apos;ll get a review screen before saving.
                </p>
              </div>
              <DropZone accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" label="parse" />
              {error && (
                <div className={`mt-3 flex items-start gap-2 text-sm rounded-xl p-3 ${needsApiKey ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {file && (
                <button
                  onClick={parseFreeFlow}
                  disabled={parsing}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  {parsing ? <><Loader2 size={18} className="animate-spin" /> Extracting...</> : <><Eye size={18} /> Extract & Review</>}
                </button>
              )}
            </div>
            <button onClick={reset} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          </div>
        )}

        {/* ── Mode: screenshot ───────────────────────────────────── */}
        {mode === 'screenshot' && (
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Clipboard size={16} className="text-amber-400" /> Paste Screenshot (Ctrl+V)
              </h4>

              {/* Paste zone */}
              <div
                ref={pasteZoneRef}
                tabIndex={0}
                onFocus={() => pasteZoneRef.current?.classList.add('ring-2', 'ring-amber-400')}
                onBlur={() => pasteZoneRef.current?.classList.remove('ring-2', 'ring-amber-400')}
                className="border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-2xl p-6 text-center cursor-pointer transition-all outline-none"
                onClick={() => pasteZoneRef.current?.focus()}
              >
                {pastedImage ? (
                  <div className="space-y-2">
                    <img src={pastedImage.preview} alt="Pasted" className="max-h-48 mx-auto rounded-xl border border-slate-600" />
                    <p className="text-emerald-400 text-sm">Image captured — ready to extract</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Clipboard size={32} className="text-amber-500 mx-auto" />
                    <p className="text-white font-medium">Click here, then press Ctrl+V to paste</p>
                    <p className="text-slate-500 text-sm">Works with screenshots from any app — FD receipt, passbook, internet banking</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 border-t border-slate-700" />
                <span className="text-slate-500 text-xs">or</span>
                <div className="flex-1 border-t border-slate-700" />
              </div>

              {/* File upload for images */}
              <button
                onClick={() => screenshotRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm transition-colors"
              >
                <FileImage size={16} /> Upload image file (JPG, PNG)
              </button>
              <input ref={screenshotRef} type="file" accept="image/*" className="hidden" onChange={onScreenshotFileChange} />

              {error && (
                <div className={`mt-3 flex items-start gap-2 text-sm rounded-xl p-3 ${needsApiKey ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    {error}
                    {needsApiKey && (
                      <p className="mt-1 text-amber-400">Add <code className="bg-slate-800 px-1 rounded text-xs">ANTHROPIC_API_KEY=your_key</code> to your <code className="bg-slate-800 px-1 rounded text-xs">.env.local</code> file and restart the server.</p>
                    )}
                  </div>
                </div>
              )}

              {pastedImage && (
                <button
                  onClick={parseScreenshot}
                  disabled={parsing}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  {parsing ? <><Loader2 size={18} className="animate-spin" /> Reading image...</> : <><Eye size={18} /> Extract from Image</>}
                </button>
              )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-start gap-3">
              <Info size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-slate-500 text-xs">Image extraction uses Claude AI Vision. Once you purchase the Anthropic API key, add it to your .env.local file as ANTHROPIC_API_KEY to enable this feature.</p>
            </div>

            <button onClick={reset} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          </div>
        )}

        {/* ── Mode: review ───────────────────────────────────────── */}
        {mode === 'review' && extracted && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Extraction complete — {parseMethod}</p>
                <p className="text-violet-300 text-sm">{extracted.summary}</p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Investments Found', value: extracted.investments.length, color: 'indigo' },
                { label: 'Amounts Detected', value: extracted.allAmounts.length, color: 'emerald' },
                { label: 'Dates Found', value: extracted.allDates.length, color: 'amber' },
                { label: 'Certificate Nos.', value: extracted.allCertNumbers.length, color: 'violet' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold text-${color}-400`}>{value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Investment records */}
            {extracted.investments.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <h4 className="text-white font-medium mb-3">Detected Investment Records</h4>
                <div className="space-y-3">
                  {extracted.investments.map((inv: ExtractedInvestment, i: number) => (
                    <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-indigo-600/30 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          {inv.investment_type || 'Unknown'}
                        </span>
                        <Badge confidence={inv.confidence} />
                        {inv.institution_name && (
                          <span className="text-slate-400 text-xs">{inv.institution_name}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                        {inv.member_name && <div><p className="text-slate-500 text-xs">Member</p><p className="text-white">{inv.member_name}</p></div>}
                        {inv.principal_amount && <div><p className="text-slate-500 text-xs">Principal</p><p className="text-white font-medium">{fmt(inv.principal_amount)}</p></div>}
                        {inv.maturity_amount && <div><p className="text-slate-500 text-xs">Maturity Amount</p><p className="text-emerald-400 font-medium">{fmt(inv.maturity_amount)}</p></div>}
                        {inv.interest_rate && <div><p className="text-slate-500 text-xs">Interest Rate</p><p className="text-white">{inv.interest_rate}%</p></div>}
                        {inv.purchase_date && <div><p className="text-slate-500 text-xs">Purchase Date</p><p className="text-white">{inv.purchase_date}</p></div>}
                        {inv.maturity_date && <div><p className="text-slate-500 text-xs">Maturity Date</p><p className="text-amber-400">{inv.maturity_date}</p></div>}
                        {inv.certificate_number && <div><p className="text-slate-500 text-xs">Certificate No.</p><p className="text-white font-mono">{inv.certificate_number}</p></div>}
                        {inv.account_number && <div><p className="text-slate-500 text-xs">Account No.</p><p className="text-white font-mono">{inv.account_number}</p></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All detected amounts */}
            {extracted.allAmounts.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <h4 className="text-white font-medium mb-3">All Detected Amounts</h4>
                <div className="flex flex-wrap gap-2">
                  {extracted.allAmounts.map((a, i) => (
                    <span key={i} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-sm px-3 py-1 rounded-full font-medium">
                      {fmt(a)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-300">
                <p className="font-medium mb-1">Review and save using the template</p>
                <p className="text-amber-400">To save these to the database, fill in the <strong>Excel Template</strong> with the details extracted above and upload it. This ensures each field maps correctly to the right family member.</p>
                <button
                  onClick={() => { reset(); setTimeout(() => setMode('structured'), 50) }}
                  className="mt-2 flex items-center gap-1 text-amber-300 hover:text-white font-medium transition-colors"
                >
                  <Download size={14} /> Go to Template Upload
                </button>
              </div>
            </div>

            <button onClick={reset} className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
              <RefreshCw size={14} /> Start over
            </button>
          </div>
        )}

        {/* ── Mode: done ─────────────────────────────────────────── */}
        {mode === 'done' && uploadResult && (
          <div className="space-y-4">
            <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold text-xl mb-1">Upload Successful!</h3>
              <p className="text-emerald-300">{uploadResult.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-indigo-400">{uploadResult.inserted}</p>
                <p className="text-slate-400 text-sm mt-1">Investments imported</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">{uploadResult.membersAffected}</p>
                <p className="text-slate-400 text-sm mt-1">Members updated</p>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                <p className="text-amber-400 font-medium mb-2">{uploadResult.errors.length} row(s) skipped:</p>
                <ul className="space-y-1">
                  {uploadResult.errors.map((e, i) => <li key={i} className="text-amber-300 text-sm">• {e}</li>)}
                </ul>
              </div>
            )}

            {uploadResult.error && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
                <XCircle size={16} className="flex-shrink-0 mt-0.5" /> {uploadResult.error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                <RefreshCw size={14} /> Upload Another
              </button>
              <Link href="/investments" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                View Investments →
              </Link>
            </div>
          </div>
        )}

        {/* Supported types (always shown on choose screen) */}
        {mode === 'choose' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-3 text-sm">Supported Investment Categories</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-400">
              {[
                { cat: 'Post Office', items: ['NSC', 'KVP', 'SCSS', 'MIS', 'Time Deposit', 'RD', 'PPF', 'Sukanya Samriddhi'] },
                { cat: 'Bank Products', items: ['Bank FD', 'Bank RD', 'Bank PPF', 'Corporate FD'] },
                { cat: 'Market', items: ['Mutual Fund', 'Stocks', 'ETF', 'SGB', 'Bonds'] },
                { cat: 'Government', items: ['PPF', 'NPS', 'EPF', 'VPF'] },
                { cat: 'Physical', items: ['Gold (Physical)', 'Gold (Digital)', 'Real Estate'] },
                { cat: 'Other', items: ['LIC', 'Chit Fund', 'Other'] },
              ].map(({ cat, items }) => (
                <div key={cat}>
                  <p className="font-semibold text-slate-300 mb-1">{cat}</p>
                  <ul className="space-y-0.5">{items.map(i => <li key={i}>• {i}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

'use client'

import { useState, useRef, useCallback } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import {
  DatabaseZap, Download, Upload, FileSpreadsheet, FileText,
  FileImage, CheckCircle2, AlertCircle, Loader2, Eye,
  User, Building2, ChevronRight, RefreshCw, Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────
interface ExtractedField { value: string; confidence: 'high' | 'medium' | 'low'; context: string }
interface ExtractedMember {
  name?: ExtractedField; pan?: ExtractedField; aadhaar?: ExtractedField
  mobile?: ExtractedField[]; email?: ExtractedField[]; dob?: ExtractedField; address?: ExtractedField
}
interface ExtractedBank {
  bank_name?: ExtractedField; account_number?: ExtractedField; ifsc?: ExtractedField
  account_type?: ExtractedField; upi?: ExtractedField[]; registered_mobile?: ExtractedField
}
interface ExtractionResult {
  rawText: string; members: ExtractedMember[]; bankAccounts: ExtractedBank[]
  allPANs: string[]; allAadhaar: string[]; allMobiles: string[]
  allEmails: string[]; allIFSCs: string[]; allAccountNumbers: string[]; allUPIs: string[]
  summary: string
}

// ── Confidence badge ────────────────────────────────────────────────
function Badge({ confidence }: { confidence: string }) {
  const cls = confidence === 'high'
    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    : confidence === 'medium'
    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
  return <span className={`text-xs px-1.5 py-0.5 rounded-full ${cls}`}>{confidence}</span>
}

// ── Pill list ────────────────────────────────────────────────────────
function PillList({ items, color = 'indigo' }: { items: string[]; color?: string }) {
  if (!items.length) return <span className="text-slate-500 text-sm">—</span>
  const cls: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    violet: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v, i) => (
        <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-mono ${cls[color] || cls.indigo}`}>{v}</span>
      ))}
    </div>
  )
}

export default function MasterDataPage() {
  const [mode, setMode] = useState<'choose' | 'template' | 'freeflow' | 'review' | 'done'>('choose')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState<{ personalUpdated: number; bankInserted: number; errors?: string[]; message: string } | null>(null)
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null)
  const [parseMethod, setParseMethod] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Drag & drop ──────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setError('') }
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setError('') }
  }

  // ── Download template ────────────────────────────────────────────
  const downloadTemplate = async () => {
    const res = await fetch('/api/master-data/template')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'Gupta_Family_Master_Data_Template.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Upload structured Excel ──────────────────────────────────────
  const uploadStructured = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/master-data/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload failed'); return }
      setResult(data); setMode('done')
    } catch (e: any) { setError(e.message) }
    finally { setUploading(false) }
  }

  // ── Parse free-flow file ─────────────────────────────────────────
  const parseFreeFlow = async () => {
    if (!file) return
    setParsing(true); setError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/master-data/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        if (data.isImageFile) {
          setError('Image OCR is not yet available. Please use a PDF, Word, or Excel file, or the structured template.')
        } else {
          setError(data.error || 'Failed to parse file')
        }
        return
      }
      setExtracted(data.extracted)
      setParseMethod(data.method)
      setMode('review')
    } catch (e: any) { setError(e.message) }
    finally { setParsing(false) }
  }

  const reset = () => {
    setMode('choose'); setFile(null); setResult(null)
    setExtracted(null); setError(''); setParseMethod('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── File drop zone ───────────────────────────────────────────────
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
          <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto">
            <Upload size={24} className="text-slate-400" />
          </div>
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
          icon={<DatabaseZap size={20} />}
          title="Master Data Upload"
          subtitle="Upload PAN, Aadhaar, bank accounts, UPI IDs and more for all family members"
        />

        {/* ── Mode: choose ───────────────────────────────────────── */}
        {mode === 'choose' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Option A: Template */}
            <button
              onClick={() => setMode('template')}
              className="bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600/30 transition-colors">
                  <FileSpreadsheet size={24} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Use Structured Template</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Download our Excel template, fill in details for all family members, then upload. Best for bulk entry.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['PAN / Aadhaar', 'Bank Accounts', 'UPI IDs', 'Net Banking'].map(t => (
                      <span key={t} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-indigo-400 text-sm font-medium">
                Get started <ChevronRight size={14} />
              </div>
            </button>

            {/* Option B: Free-flow */}
            <button
              onClick={() => setMode('freeflow')}
              className="bg-slate-800 border border-slate-700 hover:border-violet-500 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-violet-600/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-600/30 transition-colors">
                  <FileText size={24} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Free-Flow Document</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Upload any PDF, Word, or Excel file — bank statement, Aadhaar PDF, etc. System auto-extracts details.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['PDF', 'Word (.docx)', 'Excel', 'Text'].map(t => (
                      <span key={t} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-violet-400 text-sm font-medium">
                Upload document <ChevronRight size={14} />
              </div>
            </button>
          </div>
        )}

        {/* ── Mode: template ─────────────────────────────────────── */}
        {mode === 'template' && (
          <div className="space-y-4">
            {/* Steps */}
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { n: '1', title: 'Download Template', desc: 'Get our pre-formatted Excel with Personal Details and Bank Accounts sheets', icon: Download, color: 'indigo' },
                { n: '2', title: 'Fill in Details', desc: 'Add PAN, Aadhaar, mobile, bank account numbers, UPI IDs for each member', icon: FileSpreadsheet, color: 'amber' },
                { n: '3', title: 'Upload & Save', desc: 'Drop the filled file below — data is saved instantly to your family database', icon: Upload, color: 'emerald' },
              ].map(({ n, title, desc, icon: Icon, color }) => (
                <div key={n} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                  <div className={`w-8 h-8 rounded-full bg-${color}-600/20 flex items-center justify-center mb-3`}>
                    <span className={`text-${color}-400 font-bold text-sm`}>{n}</span>
                  </div>
                  <h4 className="text-white font-medium text-sm">{title}</h4>
                  <p className="text-slate-400 text-xs mt-1">{desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors"
            >
              <Download size={18} /> Download Master Data Template (.xlsx)
            </button>

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
                  Upload any document containing financial details. The system will scan for PAN numbers, Aadhaar, bank account numbers, IFSC codes, UPI IDs, mobile numbers, and email addresses. You&apos;ll get a review screen before anything is saved.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                {[
                  { icon: FileText, label: 'Bank Statement PDF', color: 'text-rose-400' },
                  { icon: FileImage, label: 'PAN / Aadhaar (text PDF)', color: 'text-amber-400' },
                  { icon: FileText, label: 'Word Document', color: 'text-blue-400' },
                  { icon: FileSpreadsheet, label: 'Any Excel file', color: 'text-emerald-400' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2 bg-slate-700/50 px-3 py-1.5 rounded-lg">
                    <Icon size={14} className={color} />
                    <span className="text-slate-300 text-xs">{label}</span>
                  </div>
                ))}
              </div>

              <DropZone accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" label="parse" />

              {error && (
                <div className="mt-3 flex items-start gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {file && (
                <button
                  onClick={parseFreeFlow}
                  disabled={parsing}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  {parsing ? <><Loader2 size={18} className="animate-spin" /> Extracting data...</> : <><Eye size={18} /> Extract &amp; Review</>}
                </button>
              )}
            </div>

            <button onClick={reset} className="text-slate-500 hover:text-white text-sm transition-colors">← Back</button>
          </div>
        )}

        {/* ── Mode: review ───────────────────────────────────────── */}
        {mode === 'review' && extracted && (
          <div className="space-y-5">
            {/* Summary bar */}
            <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Extraction complete — {parseMethod}</p>
                <p className="text-violet-300 text-sm">{extracted.summary}</p>
              </div>
            </div>

            {/* Quick list */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <h4 className="text-white font-medium flex items-center gap-2"><User size={16} className="text-indigo-400" /> Personal Identifiers</h4>
                <div className="space-y-2">
                  <div><p className="text-slate-500 text-xs mb-1">PAN Numbers</p><PillList items={extracted.allPANs} color="indigo" /></div>
                  <div><p className="text-slate-500 text-xs mb-1">Aadhaar Numbers</p><PillList items={extracted.allAadhaar.map(a => `${a.slice(0,4)}-${a.slice(4,8)}-${a.slice(8)}`)} color="emerald" /></div>
                  <div><p className="text-slate-500 text-xs mb-1">Mobile Numbers</p><PillList items={extracted.allMobiles} color="amber" /></div>
                  <div><p className="text-slate-500 text-xs mb-1">Email Addresses</p><PillList items={extracted.allEmails} color="violet" /></div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <h4 className="text-white font-medium flex items-center gap-2"><Building2 size={16} className="text-emerald-400" /> Banking Details</h4>
                <div className="space-y-2">
                  <div><p className="text-slate-500 text-xs mb-1">Account Numbers</p><PillList items={extracted.allAccountNumbers} color="indigo" /></div>
                  <div><p className="text-slate-500 text-xs mb-1">IFSC Codes</p><PillList items={extracted.allIFSCs} color="cyan" /></div>
                  <div><p className="text-slate-500 text-xs mb-1">UPI IDs</p><PillList items={extracted.allUPIs} color="violet" /></div>
                </div>
              </div>
            </div>

            {/* Detailed member data */}
            {extracted.members.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <h4 className="text-white font-medium mb-3">Detected Member Records ({extracted.members.length})</h4>
                <div className="space-y-3">
                  {extracted.members.map((m, i) => (
                    <div key={i} className="bg-slate-750 border border-slate-700 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-2">Member {i + 1}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {m.name && <div><span className="text-slate-500 text-xs">Name</span><p className="text-white">{m.name.value} <Badge confidence={m.name.confidence} /></p></div>}
                        {m.pan && <div><span className="text-slate-500 text-xs">PAN</span><p className="text-white font-mono">{m.pan.value} <Badge confidence={m.pan.confidence} /></p></div>}
                        {m.aadhaar && <div><span className="text-slate-500 text-xs">Aadhaar</span><p className="text-white font-mono">{m.aadhaar.value.slice(0,4)}-xxxx-{m.aadhaar.value.slice(8)} <Badge confidence={m.aadhaar.confidence} /></p></div>}
                        {m.dob && <div><span className="text-slate-500 text-xs">DOB</span><p className="text-white">{m.dob.value} <Badge confidence={m.dob.confidence} /></p></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detected bank accounts */}
            {extracted.bankAccounts.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <h4 className="text-white font-medium mb-3">Detected Bank Records ({extracted.bankAccounts.length})</h4>
                <div className="space-y-2">
                  {extracted.bankAccounts.map((b, i) => (
                    <div key={i} className="bg-slate-750 border border-slate-700 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {b.bank_name && <div><span className="text-slate-500 text-xs">Bank</span><p className="text-white capitalize">{b.bank_name.value}</p></div>}
                      {b.account_number && <div><span className="text-slate-500 text-xs">Account No.</span><p className="text-white font-mono">{b.account_number.value}</p></div>}
                      {b.ifsc && <div><span className="text-slate-500 text-xs">IFSC</span><p className="text-white font-mono">{b.ifsc.value}</p></div>}
                      {b.account_type && <div><span className="text-slate-500 text-xs">Type</span><p className="text-white">{b.account_type.value}</p></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-300">
                <p className="font-medium mb-1">Free-flow data is for review only</p>
                <p className="text-amber-400">To save this data to the database, please use the <strong>Structured Template</strong> — fill in the template with the extracted details above and upload it. Direct save from free-flow documents is coming in a future update.</p>
              </div>
            </div>

            {/* Raw text preview */}
            <details className="bg-slate-800 border border-slate-700 rounded-2xl">
              <summary className="p-4 text-slate-400 text-sm cursor-pointer hover:text-white">View extracted raw text (first 500 chars)</summary>
              <div className="px-4 pb-4">
                <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono bg-slate-900 rounded-xl p-3 overflow-auto max-h-40">
                  {extracted.rawText.slice(0, 500)}{extracted.rawText.length > 500 ? '...' : ''}
                </pre>
              </div>
            </details>

            <button onClick={reset} className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
              <RefreshCw size={14} /> Start over
            </button>
          </div>
        )}

        {/* ── Mode: done ─────────────────────────────────────────── */}
        {mode === 'done' && result && (
          <div className="space-y-4">
            <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold text-xl mb-1">Upload Successful!</h3>
              <p className="text-emerald-300">{result.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-indigo-400">{result.personalUpdated}</p>
                <p className="text-slate-400 text-sm mt-1">Member profiles updated</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">{result.bankInserted}</p>
                <p className="text-slate-400 text-sm mt-1">Bank accounts imported</p>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                <p className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                  <AlertCircle size={16} /> {result.errors.length} row(s) had issues
                </p>
                <ul className="space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-amber-300 text-sm">• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-medium transition-colors"
            >
              <RefreshCw size={16} /> Upload Another File
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  )
}

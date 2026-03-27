'use client'

import { useState, useRef, useCallback } from 'react'
import MainLayout from '@/components/layout/MainLayout'
import PageHeader from '@/components/ui/PageHeader'
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadResult {
  success: boolean
  inserted?: number
  membersAffected?: number
  message?: string
  error?: string
  errors?: string[]
}

export default function InvestmentUploadPage() {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setResult({ success: false, error: 'Please upload an Excel file (.xlsx or .xls) or CSV file.' })
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('uploading')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/investments/upload', { method: 'POST', body: formData })
      const data: UploadResult = await res.json()
      setResult(data)
      setStatus(data.success ? 'success' : 'error')
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' })
      setStatus('error')
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }, [])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  const reset = () => { setStatus('idle'); setResult(null); setFileName(null); if (fileRef.current) fileRef.current.value = '' }

  return (
    <MainLayout>
      <PageHeader
        title="Bulk Upload Investments"
        subtitle="Upload an Excel file to import all investments in one go"
        icon={FileSpreadsheet}
        action={
          <Link href="/investments" className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
            <ArrowLeft size={14} /> Back to Investments
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto space-y-6">

        {/* Step 1 — Download Template */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-400 font-bold text-sm">1</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Download the Template</h3>
              <p className="text-sm text-slate-400 mb-4">
                Download the Excel template, fill in your investment details, and upload it back. The template includes sample data and a reference sheet with all valid values.
              </p>
              <a
                href="/api/investments/template"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Download Excel Template (.xlsx)
              </a>
            </div>
          </div>
        </div>

        {/* Important Note */}
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-200 space-y-1">
            <p className="font-semibold">Important — Upload replaces existing data</p>
            <p className="text-amber-300/80">When you upload a file, <strong>all existing investments</strong> for the family members included in the file will be replaced with the new data. If you want to keep old investments, make sure they are included in the uploaded file too.</p>
          </div>
        </div>

        {/* Step 2 — Fill the Template */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-400 font-bold text-sm">2</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-3">Fill in the Template</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                {[
                  ['Family Member', 'Vishal / Kavita / Shubh / Krishiv / Manohar Lal / Daya Gupta or HUF'],
                  ['Investment Type', 'Pick from dropdown (NSC, FD, MF, etc.)'],
                  ['Institution Name', 'Bank, Post Office, AMC name'],
                  ['Principal Amount', 'Numbers only, no ₹ symbol'],
                  ['Dates', 'Use DD/MM/YYYY format'],
                  ['Cumulative', 'Yes = reinvested / No = paid out'],
                  ['Certificate No.', 'NSC/KVP cert, FD receipt, folio no.'],
                  ['Maturity Date', 'Leave blank for open-ended (MF/Stocks)'],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-2">
                    <Info size={11} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <span><span className="text-slate-300 font-medium">{col}:</span> {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 — Upload */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-violet-400 font-bold text-sm">3</span>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Upload Your Filled File</h3>
              <p className="text-sm text-slate-400">Supports .xlsx, .xls and .csv files</p>
            </div>
          </div>

          {status === 'idle' || status === 'error' ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
              }`}
            >
              <Upload size={36} className={`mx-auto mb-3 ${dragOver ? 'text-indigo-400' : 'text-slate-500'}`} />
              <p className="text-white font-medium mb-1">Drag & drop your Excel file here</p>
              <p className="text-sm text-slate-400 mb-4">or click to browse</p>
              <span className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">
                Choose File
              </span>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
            </div>
          ) : null}

          {status === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
              <div className="text-center">
                <p className="text-white font-medium">Processing {fileName}...</p>
                <p className="text-sm text-slate-400 mt-1">Parsing rows and uploading to database</p>
              </div>
            </div>
          )}

          {status === 'success' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                <CheckCircle size={22} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-300">Upload Successful!</p>
                  <p className="text-sm text-emerald-400/80 mt-1">{result.message}</p>
                  <div className="flex gap-6 mt-3 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs">Investments Imported</p>
                      <p className="text-white font-bold text-xl">{result.inserted}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Members Updated</p>
                      <p className="text-white font-bold text-xl">{result.membersAffected}</p>
                    </div>
                  </div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <p className="text-amber-300 font-medium text-sm mb-2">{result.errors.length} row(s) were skipped:</p>
                  <ul className="space-y-1">
                    {result.errors.map((e, i) => <li key={i} className="text-xs text-amber-400/80">• {e}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors">
                  Upload Another File
                </button>
                <Link href="/investments" className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium text-center transition-colors">
                  View Investments →
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && result && (
            <div className="mt-4 flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
              <XCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-rose-300 font-medium text-sm">Upload Failed</p>
                <p className="text-rose-400/80 text-sm mt-1">{result.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Supported investment types reference */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Supported Investment Categories</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-400">
            {[
              { cat: 'Post Office', items: ['NSC', 'KVP', 'SCSS', 'MIS', 'Time Deposit', 'RD', 'PPF', 'Sukanya Samriddhi'] },
              { cat: 'Bank Products', items: ['Bank FD', 'Bank RD', 'Bank PPF', 'Corporate FD'] },
              { cat: 'Market', items: ['Mutual Fund', 'Stocks / Equity', 'ETF', 'SGBs', 'Bonds'] },
              { cat: 'Government', items: ['PPF', 'NPS', 'EPF', 'VPF'] },
              { cat: 'Physical Assets', items: ['Gold (Physical)', 'Gold (Digital)', 'Real Estate'] },
              { cat: 'Other', items: ['LIC Endowment', 'Chit Fund', 'Other'] },
            ].map(({ cat, items }) => (
              <div key={cat}>
                <p className="font-semibold text-slate-300 mb-1">{cat}</p>
                <ul className="space-y-0.5">
                  {items.map(i => <li key={i} className="flex items-center gap-1"><span className="w-1 h-1 bg-slate-500 rounded-full" />{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </MainLayout>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { extractFromText } from '@/lib/smartExtractor'
import * as XLSX from 'xlsx'

async function extractTextFromFile(file: File): Promise<{ text: string; method: string }> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  // ── Excel / CSV ───────────────────────────────────────────────
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sheetName of wb.SheetNames) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
      text += rows.map(r => r.join('\t')).join('\n') + '\n'
    }
    return { text, method: 'Excel/CSV parser' }
  }

  // ── PDF ───────────────────────────────────────────────────────
  if (name.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return { text: data.text, method: 'PDF text extractor' }
    } catch {
      return { text: '', method: 'PDF (failed to extract)' }
    }
  }

  // ── Word (.docx) ──────────────────────────────────────────────
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return { text: result.value, method: 'Word document parser' }
    } catch {
      return { text: '', method: 'Word (failed to extract)' }
    }
  }

  // ── Plain text / other ────────────────────────────────────────
  const text = buffer.toString('utf-8')
  return { text, method: 'Plain text' }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const { text, method } = await extractTextFromFile(file)

    if (!text || text.trim().length < 5) {
      return NextResponse.json({
        error: 'Could not extract text from this file. For images (JPG/PNG), AI-powered OCR will be available when Claude API is configured.',
        isImageFile: file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) !== null,
      }, { status: 422 })
    }

    const extracted = extractFromText(text)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      method,
      extracted,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

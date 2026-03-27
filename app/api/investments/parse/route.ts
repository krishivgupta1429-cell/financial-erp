import { NextRequest, NextResponse } from 'next/server'
import { extractInvestmentsFromText } from '@/lib/investmentExtractor'
import * as XLSX from 'xlsx'

async function extractText(file: File): Promise<{ text: string; method: string }> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sheetName of wb.SheetNames) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
      text += rows.map(r => r.join('\t')).join('\n') + '\n'
    }
    return { text, method: 'Excel/CSV parser' }
  }

  if (name.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return { text: data.text, method: 'PDF text extractor' }
    } catch {
      return { text: '', method: 'PDF (failed to extract)' }
    }
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return { text: result.value, method: 'Word document parser' }
    } catch {
      return { text: '', method: 'Word (failed to extract)' }
    }
  }

  return { text: buffer.toString('utf-8'), method: 'Plain text' }
}

async function extractFromImageWithClaude(base64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `Extract all investment-related information from this image. Include:
- Investment type (FD, NSC, KVP, SCSS, MIS, PPF, Mutual Fund, etc.)
- Institution / bank / post office name
- Principal amount / deposit amount
- Interest rate (%)
- Purchase date / issue date
- Maturity date
- Maturity amount
- Certificate number / receipt number / folio number
- Account number
- Name of account holder / investor
- Any other relevant financial details

Return the extracted data as plain text, one detail per line like:
Investment Type: NSC
Principal Amount: 100000
Interest Rate: 7.7%
Purchase Date: 15/03/2023
Maturity Date: 15/03/2029
Certificate No: AA123456
Holder: Vishal Gupta

If you cannot read the image clearly, describe what you can see.`,
          },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Claude API error')
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const imageBase64 = formData.get('imageBase64') as string | null
    const imageMime = formData.get('imageMime') as string | null

    // ── Image (pasted screenshot or uploaded image) ──────────────
    if (imageBase64 && imageMime) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({
          error: 'Image OCR requires the Claude API key. Please add ANTHROPIC_API_KEY to your .env.local file.',
          needsApiKey: true,
        }, { status: 422 })
      }
      const ocrText = await extractFromImageWithClaude(imageBase64, imageMime)
      const extracted = extractInvestmentsFromText(ocrText)
      return NextResponse.json({ success: true, method: 'Claude Vision OCR', extracted, ocrText })
    }

    // ── File upload (PDF / Word / Excel) ─────────────────────────
    if (!file) return NextResponse.json({ error: 'No file or image provided' }, { status: 400 })

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
    if (isImage) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({
          error: 'Image OCR requires the Claude API key. Please add ANTHROPIC_API_KEY to your .env.local file.',
          needsApiKey: true,
          isImageFile: true,
        }, { status: 422 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')
      const mime = file.type || 'image/jpeg'
      const ocrText = await extractFromImageWithClaude(base64, mime)
      const extracted = extractInvestmentsFromText(ocrText)
      return NextResponse.json({ success: true, method: 'Claude Vision OCR', extracted, ocrText })
    }

    const { text, method } = await extractText(file)
    if (!text || text.trim().length < 5) {
      return NextResponse.json({ error: 'Could not extract text from this file.' }, { status: 422 })
    }

    const extracted = extractInvestmentsFromText(text)
    return NextResponse.json({ success: true, method, extracted })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

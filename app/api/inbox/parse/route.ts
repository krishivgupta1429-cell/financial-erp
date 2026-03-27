import { NextRequest, NextResponse } from 'next/server'
import { classifyNotification } from '@/lib/notificationEngine'
import * as XLSX from 'xlsx'

async function textFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  }
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    return wb.SheetNames.map(sn =>
      (XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }) as any[][])
        .map(r => r.join('\t')).join('\n')
    ).join('\n')
  }
  return buffer.toString('utf-8')
}

async function ocrWithClaude(base64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: 'Extract and return the complete text from this financial notification image (SMS screenshot, email screenshot, bank alert, etc.) verbatim. Include all amounts, dates, reference numbers, and institution names exactly as shown.' }
        ]
      }]
    })
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Claude API error') }
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const rawText = formData.get('rawText') as string | null
    const imageBase64 = formData.get('imageBase64') as string | null
    const imageMime = formData.get('imageMime') as string | null
    const file = formData.get('file') as File | null

    let text = ''
    let channel = 'manual'

    // Direct text paste or voice transcript
    if (rawText && rawText.trim().length > 3) {
      text = rawText
      channel = (formData.get('channel') as string) || 'manual'
    }
    // Image OCR (pasted screenshot or uploaded image)
    else if (imageBase64 && imageMime) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'Image OCR requires ANTHROPIC_API_KEY in .env.local', needsApiKey: true }, { status: 422 })
      }
      text = await ocrWithClaude(imageBase64, imageMime)
      channel = 'image_ocr'
    }
    // File upload (PDF / Word / Excel)
    else if (file) {
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.name)
      if (isImage) {
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json({ error: 'Image OCR requires ANTHROPIC_API_KEY in .env.local', needsApiKey: true, isImageFile: true }, { status: 422 })
        }
        const buf = Buffer.from(await file.arrayBuffer())
        text = await ocrWithClaude(buf.toString('base64'), file.type || 'image/jpeg')
        channel = 'image_ocr'
      } else {
        text = await textFromFile(file)
        channel = file.name.endsWith('.pdf') ? 'pdf' : 'email'
      }
    } else {
      return NextResponse.json({ error: 'No input provided' }, { status: 400 })
    }

    if (!text || text.trim().length < 5) {
      return NextResponse.json({ error: 'Could not extract text from the provided input.' }, { status: 422 })
    }

    // Split into individual messages if multiple notifications in one paste
    const segments = text.split(/\n{3,}|---+|={3,}/).filter(s => s.trim().length > 10)
    const results = segments.map(seg => ({
      raw_text: seg.trim(),
      source_channel: channel,
      ...classifyNotification(seg.trim()),
    }))

    return NextResponse.json({ success: true, notifications: results, count: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

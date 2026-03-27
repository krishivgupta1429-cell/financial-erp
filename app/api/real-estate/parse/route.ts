import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ExtractedProperty {
  property_name?: string
  property_type?: string
  address?: string
  city?: string
  state?: string
  pin_code?: string
  area_value?: number
  area_unit?: string
  purchase_price?: number
  current_value?: number
  purchase_date?: string
  registration_date?: string
  registration_number?: string
  stamp_duty_paid?: number
  co_owner_name?: string
  member_name?: string
  notes?: string
}

const PROPERTY_TYPES = ['flat', 'apartment', 'house', 'villa', 'plot', 'land', 'commercial', 'shop', 'office', 'agricultural', 'farm']
const STATES = ['delhi', 'uttar pradesh', 'up', 'haryana', 'rajasthan', 'maharashtra', 'gujarat', 'karnataka', 'tamil nadu', 'west bengal', 'punjab', 'madhya pradesh', 'bihar', 'telangana', 'andhra pradesh', 'kerala', 'odisha', 'jharkhand', 'assam', 'uttarakhand', 'himachal']
const FAMILY_NAMES = ['vishal gupta', 'kavita gupta', 'shubh gupta', 'krishiv gupta', 'manohar lal gupta', 'daya gupta']

function normalizeDate(str: string): string {
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`
  return str
}

function extractFromText(text: string): ExtractedProperty {
  const lower = text.toLowerCase()
  const result: ExtractedProperty = {}

  // Property type
  for (const pt of PROPERTY_TYPES) {
    if (lower.includes(pt)) {
      result.property_type = pt.charAt(0).toUpperCase() + pt.slice(1)
      if (['flat','apartment'].includes(pt)) result.property_type = 'Residential Flat'
      if (['house','villa'].includes(pt)) result.property_type = 'House/Villa'
      if (['plot','land'].includes(pt)) result.property_type = 'Plot/Land'
      if (['commercial','shop','office'].includes(pt)) result.property_type = 'Commercial'
      if (['agricultural','farm'].includes(pt)) result.property_type = 'Agricultural Land'
      break
    }
  }

  // Registration number
  const regMatch = text.match(/(?:registration\s*(?:no|number|#)?|reg\.?\s*no)[:\s]*([A-Z0-9\/\-]{4,25})/i)
  if (regMatch) result.registration_number = regMatch[1].trim()

  // Survey / khasra number
  const surveyMatch = text.match(/(?:survey\s*(?:no|number)|khasra\s*(?:no|number)|plot\s*(?:no|number))[:\s]*([A-Z0-9\/\-]{2,20})/i)
  if (surveyMatch && !result.registration_number) result.registration_number = surveyMatch[1].trim()

  // Area
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sq\.?\s*yard|sq\.?\s*meter|sqft|sqyard|bigha|acre|gaj|marla)/i)
  if (areaMatch) {
    result.area_value = parseFloat(areaMatch[1])
    const unit = areaMatch[2].toLowerCase().replace(/\s/g,'')
    if (unit.startsWith('sqft') || unit.startsWith('sq.ft')) result.area_unit = 'sq ft'
    else if (unit.startsWith('sqyard') || unit.startsWith('sq.yard')) result.area_unit = 'sq yards'
    else if (unit.startsWith('sqmeter') || unit.startsWith('sq.meter')) result.area_unit = 'sq meter'
    else result.area_unit = areaMatch[2].trim()
  }

  // Amounts
  const amountRe = /(?:consideration|sale\s*price|purchase\s*price|total\s*value|market\s*value|circle\s*rate|stamp\s*duty)[:\s]*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi
  let m: RegExpExecArray | null
  while ((m = amountRe.exec(text)) !== null) {
    const val = parseFloat(m[0].includes('stamp') ? m[1] : m[1].replace(/,/g,''))
    if (m[0].toLowerCase().includes('stamp')) result.stamp_duty_paid = parseFloat(m[1].replace(/,/g,''))
    else if (!result.purchase_price) result.purchase_price = parseFloat(m[1].replace(/,/g,''))
  }

  // Fallback: large standalone amounts
  if (!result.purchase_price) {
    const amounts: number[] = []
    const plainRe = /(?:rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi
    while ((m = plainRe.exec(text)) !== null) {
      const v = parseFloat(m[1].replace(/,/g,''))
      if (v >= 100000) amounts.push(v)
    }
    if (amounts.length) result.purchase_price = amounts[0]
  }

  // Dates
  const dates: string[] = []
  const dateRe = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g
  while ((m = dateRe.exec(text)) !== null) dates.push(normalizeDate(m[1]))
  if (dates.length >= 1) result.purchase_date = dates[0]
  if (dates.length >= 2) result.registration_date = dates[1]

  // State
  for (const st of STATES) {
    if (lower.includes(st)) {
      result.state = st.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
      if (st === 'up') result.state = 'Uttar Pradesh'
      break
    }
  }

  // PIN code
  const pinMatch = text.match(/\b(\d{6})\b/)
  if (pinMatch) result.pin_code = pinMatch[1]

  // City (look for common cities)
  const cities = ['noida', 'delhi', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad', 'mumbai', 'pune', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'lucknow', 'chandigarh', 'ahmedabad']
  for (const c of cities) {
    if (lower.includes(c)) { result.city = c.charAt(0).toUpperCase() + c.slice(1); break }
  }

  // Family member
  for (const name of FAMILY_NAMES) {
    if (lower.includes(name)) {
      result.member_name = name.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ')
      break
    }
  }

  // Address: grab lines containing common address keywords
  const addrMatch = text.match(/(?:property\s*(?:at|located|address)|situated\s*at|premises\s*(?:at|known\s*as))[:\s]*([^\n]{10,120})/i)
  if (addrMatch) result.address = addrMatch[1].trim().slice(0, 200)

  return result
}

async function extractText(file: File): Promise<{ text: string; method: string }> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sn of wb.SheetNames) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
      text += rows.map(r => r.join('\t')).join('\n') + '\n'
    }
    return { text, method: 'Excel/CSV' }
  }

  if (name.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      return { text: data.text, method: 'PDF' }
    } catch { return { text: '', method: 'PDF (failed)' } }
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return { text: result.value, method: 'Word' }
    } catch { return { text: '', method: 'Word (failed)' } }
  }

  return { text: buffer.toString('utf-8'), method: 'Text' }
}

async function extractFromImageWithClaude(base64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: `Extract all real estate / property details from this document image. Return as plain text key: value pairs, one per line. Include: Property Type, Property Address, City, State, PIN Code, Area (with unit), Purchase Price, Registration Number, Registration Date, Purchase Date, Stamp Duty Paid, Buyer/Owner Name, Co-owner Name, Survey/Khasra Number. Extract exactly what is written, do not guess.` }
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
    const file = formData.get('file') as File | null
    const imageBase64 = formData.get('imageBase64') as string | null
    const imageMime = formData.get('imageMime') as string | null

    if (imageBase64 && imageMime) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'Image OCR requires ANTHROPIC_API_KEY in .env.local', needsApiKey: true }, { status: 422 })
      }
      const ocrText = await extractFromImageWithClaude(imageBase64, imageMime)
      return NextResponse.json({ success: true, method: 'Claude Vision OCR', extracted: extractFromText(ocrText), rawText: ocrText.slice(0,1000) })
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
    if (isImage) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'Image OCR requires ANTHROPIC_API_KEY in .env.local', needsApiKey: true, isImageFile: true }, { status: 422 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const ocrText = await extractFromImageWithClaude(buffer.toString('base64'), file.type || 'image/jpeg')
      return NextResponse.json({ success: true, method: 'Claude Vision OCR', extracted: extractFromText(ocrText), rawText: ocrText.slice(0,1000) })
    }

    const { text, method } = await extractText(file)
    if (!text || text.trim().length < 5) return NextResponse.json({ error: 'Could not extract text' }, { status: 422 })

    return NextResponse.json({ success: true, method, extracted: extractFromText(text), rawText: text.slice(0,1000) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

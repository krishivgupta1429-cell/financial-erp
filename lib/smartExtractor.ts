// ─────────────────────────────────────────────────────────────────
// Smart Extractor — finds financial identifiers in raw text
// Supports: PAN, Aadhaar, Mobile, IFSC, Account No, UPI, Email
// ─────────────────────────────────────────────────────────────────

export interface ExtractedField {
  value: string
  confidence: 'high' | 'medium' | 'low'
  context: string // surrounding text for review
}

export interface ExtractedMemberData {
  name?: ExtractedField
  pan?: ExtractedField
  aadhaar?: ExtractedField
  mobile?: ExtractedField[]
  email?: ExtractedField[]
  dob?: ExtractedField
  address?: ExtractedField
}

export interface ExtractedBankData {
  bank_name?: ExtractedField
  account_number?: ExtractedField
  ifsc?: ExtractedField
  account_type?: ExtractedField
  upi?: ExtractedField[]
  registered_mobile?: ExtractedField
  nominee?: ExtractedField
}

export interface ExtractionResult {
  rawText: string
  members: ExtractedMemberData[]
  bankAccounts: ExtractedBankData[]
  allPANs: string[]
  allAadhaar: string[]
  allMobiles: string[]
  allEmails: string[]
  allIFSCs: string[]
  allAccountNumbers: string[]
  allUPIs: string[]
  summary: string
}

// ── Regex Patterns ────────────────────────────────────────────────
const PATTERNS = {
  pan: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g,
  aadhaar: /\b([0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})\b/g,
  mobile: /\b((?:\+91[\s\-]?)?[6-9][0-9]{9})\b/g,
  email: /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g,
  ifsc: /\b([A-Z]{4}0[A-Z0-9]{6})\b/g,
  upi: /\b([a-zA-Z0-9.\-_+]+@(?:upi|oksbi|okaxis|okicici|okhdfcbank|ybl|ibl|axl|paytm|apl|freecharge|indus|kotak|rbl|sbi|icici|hdfc|axis|pnb|boi|bob|cbi|cnrb|union|airtel|jio|phonepe|gpay|amazonpay|oksbi|okaxis|okicici|okhdfcbank|aubank|myaxis|ikwik|slicepay|yesbankltd|sib|kvb|federal|idbi|idfc|mahb|bdbl|tjsb|abfspay|ezetap|timecosmos|pingpay|shriramhf|rajgovt|rajpayments|hdfcbank|indusind|icicipay|centralbank|barodampay|uboi|utbi|bom|bdb|vjb))\b/gi,
  accountNumber: /\b([0-9]{9,18})\b/g,
  dob: /\b((?:0?[1-9]|[12][0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](?:19|20)[0-9]{2})\b/g,
}

// Bank name keywords
const BANK_NAMES = [
  'hdfc', 'sbi', 'icici', 'axis', 'kotak', 'pnb', 'bank of baroda', 'bob',
  'union bank', 'canara', 'indian bank', 'bank of india', 'boi', 'yes bank',
  'idfc', 'indusind', 'federal bank', 'rbl', 'bandhan', 'au small finance',
  'post office', 'india post', 'central bank', 'uco bank', 'karnataka bank',
  'south indian bank', 'dcb', 'jammu kashmir', 'j&k bank',
]

const ACCOUNT_TYPES = ['savings', 'current', 'salary', 'nre', 'nro', 'fd', 'rd']

function getContext(text: string, match: string, radius = 60): string {
  const idx = text.indexOf(match)
  if (idx === -1) return ''
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + match.length + radius)
  return '...' + text.slice(start, end).replace(/\n/g, ' ').trim() + '...'
}

function findBankName(text: string, near: string): string | undefined {
  const lower = text.toLowerCase()
  const idx = text.indexOf(near)
  const window = lower.slice(Math.max(0, idx - 200), idx + 200)
  return BANK_NAMES.find(b => window.includes(b.toLowerCase()))
}

function findAccountType(text: string, near: string): string | undefined {
  const lower = text.toLowerCase()
  const idx = text.indexOf(near)
  const window = lower.slice(Math.max(0, idx - 100), idx + 100)
  const found = ACCOUNT_TYPES.find(t => window.includes(t))
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : undefined
}

export function extractFromText(rawText: string): ExtractionResult {
  const text = rawText.replace(/\r/g, '\n')

  // ── Extract all occurrences ───────────────────────────────────
  const allPANs = [...new Set([...text.matchAll(PATTERNS.pan)].map(m => m[1]))]
  const allAadhaarRaw = [...new Set([...text.matchAll(PATTERNS.aadhaar)].map(m => m[1].replace(/[\s\-]/g, '')))]
  const allAadhaar = allAadhaarRaw.filter(a => a.length === 12)
  const allMobilesRaw = [...new Set([...text.matchAll(PATTERNS.mobile)].map(m => m[1].replace(/[\s\-]/g, '').replace(/^\+91/, '')))]
  const allMobiles = allMobilesRaw.filter(m => m.length === 10)
  const allEmails = [...new Set([...text.matchAll(PATTERNS.email)].map(m => m[1].toLowerCase()))]
  const allIFSCs = [...new Set([...text.matchAll(PATTERNS.ifsc)].map(m => m[1]))]
  const allUPIs = [...new Set([...text.matchAll(PATTERNS.upi)].map(m => m[1]))]
  const dobMatches = [...text.matchAll(PATTERNS.dob)].map(m => m[1])

  // Account numbers — filter out obvious non-accounts (phone, aadhaar, pin)
  const allAccountNumbersRaw = [...new Set([...text.matchAll(PATTERNS.accountNumber)].map(m => m[1]))]
  const allAccountNumbers = allAccountNumbersRaw.filter(n => {
    if (allMobiles.includes(n) || allAadhaar.includes(n)) return false
    if (n.length < 9 || n.length > 18) return false
    return true
  })

  // ── Build extracted members ───────────────────────────────────
  const members: ExtractedMemberData[] = []

  // For each PAN, try to find associated data nearby
  for (const pan of allPANs) {
    const m: ExtractedMemberData = {
      pan: { value: pan, confidence: 'high', context: getContext(text, pan) },
    }
    // Name from PAN context (look for ALL CAPS words near PAN)
    const panIdx = text.indexOf(pan)
    const surrounding = text.slice(Math.max(0, panIdx - 300), panIdx + 300)
    const nameMatch = surrounding.match(/\b([A-Z][A-Z\s]{5,40})\b/)
    if (nameMatch) m.name = { value: nameMatch[1].trim(), confidence: 'medium', context: surrounding.slice(0, 80) }

    if (dobMatches.length > 0) m.dob = { value: dobMatches[0], confidence: 'medium', context: getContext(text, dobMatches[0]) }
    if (allMobiles.length > 0) m.mobile = allMobiles.map(mob => ({ value: mob, confidence: 'high', context: getContext(text, mob) }))
    if (allEmails.length > 0) m.email = allEmails.map(em => ({ value: em, confidence: 'high', context: getContext(text, em) }))

    members.push(m)
  }

  // If no PANs found but we have other data, create a generic member entry
  if (members.length === 0 && (allMobiles.length > 0 || allEmails.length > 0 || allAadhaar.length > 0)) {
    const m: ExtractedMemberData = {}
    if (allAadhaar.length > 0) m.aadhaar = { value: allAadhaar[0], confidence: 'high', context: getContext(text, allAadhaar[0]) }
    if (allMobiles.length > 0) m.mobile = allMobiles.map(mob => ({ value: mob, confidence: 'high', context: getContext(text, mob) }))
    if (allEmails.length > 0) m.email = allEmails.map(em => ({ value: em, confidence: 'high', context: getContext(text, em) }))
    members.push(m)
  }

  // Add Aadhaar to existing members
  allAadhaar.forEach((a, i) => {
    if (members[i]) members[i].aadhaar = { value: a, confidence: 'high', context: getContext(text, a) }
    else if (members[0]) members[0].aadhaar = { value: a, confidence: 'high', context: getContext(text, a) }
  })

  // ── Build extracted bank accounts ─────────────────────────────
  const bankAccounts: ExtractedBankData[] = []

  for (const acNo of allAccountNumbers) {
    const bankName = findBankName(text, acNo)
    const accType = findAccountType(text, acNo)
    const ifscNear = allIFSCs.find(ifsc => {
      const ai = text.indexOf(acNo)
      const ii = text.indexOf(ifsc)
      return Math.abs(ai - ii) < 500
    })

    const ba: ExtractedBankData = {
      account_number: { value: acNo, confidence: 'high', context: getContext(text, acNo) },
    }
    if (bankName) ba.bank_name = { value: bankName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), confidence: 'high', context: '' }
    if (accType) ba.account_type = { value: accType, confidence: 'medium', context: '' }
    if (ifscNear) ba.ifsc = { value: ifscNear, confidence: 'high', context: getContext(text, ifscNear) }
    if (allMobiles.length > 0) ba.registered_mobile = { value: allMobiles[0], confidence: 'medium', context: '' }
    if (allUPIs.length > 0) ba.upi = allUPIs.map(u => ({ value: u, confidence: 'high', context: getContext(text, u) }))

    bankAccounts.push(ba)
  }

  // If IFSCs found but no account numbers matched
  for (const ifsc of allIFSCs) {
    const alreadyLinked = bankAccounts.some(b => b.ifsc?.value === ifsc)
    if (!alreadyLinked) {
      const bankName = findBankName(text, ifsc)
      bankAccounts.push({
        ifsc: { value: ifsc, confidence: 'high', context: getContext(text, ifsc) },
        bank_name: bankName ? { value: bankName, confidence: 'high', context: '' } : undefined,
        upi: allUPIs.length > 0 ? allUPIs.map(u => ({ value: u, confidence: 'medium', context: '' })) : undefined,
      })
    }
  }

  const parts = []
  if (allPANs.length) parts.push(`${allPANs.length} PAN(s)`)
  if (allAadhaar.length) parts.push(`${allAadhaar.length} Aadhaar(s)`)
  if (allMobiles.length) parts.push(`${allMobiles.length} mobile(s)`)
  if (allEmails.length) parts.push(`${allEmails.length} email(s)`)
  if (allIFSCs.length) parts.push(`${allIFSCs.length} IFSC code(s)`)
  if (allAccountNumbers.length) parts.push(`${allAccountNumbers.length} account number(s)`)
  if (allUPIs.length) parts.push(`${allUPIs.length} UPI ID(s)`)

  return {
    rawText: text.slice(0, 2000),
    members,
    bankAccounts,
    allPANs,
    allAadhaar,
    allMobiles,
    allEmails,
    allIFSCs,
    allAccountNumbers,
    allUPIs,
    summary: parts.length > 0 ? `Found: ${parts.join(', ')}` : 'No financial identifiers detected',
  }
}

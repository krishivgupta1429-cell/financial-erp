// ─────────────────────────────────────────────────────────────────
// Investment Extractor — finds investment details in raw text
// Supports: scheme type, amount, dates, certificate no, IFSC, bank
// ─────────────────────────────────────────────────────────────────

export interface ExtractedInvestment {
  investment_type?: string
  institution_name?: string
  principal_amount?: number
  interest_rate?: number
  purchase_date?: string
  maturity_date?: string
  maturity_amount?: number
  certificate_number?: string
  account_number?: string
  member_name?: string
  notes?: string
  confidence: 'high' | 'medium' | 'low'
  raw_context: string
}

export interface InvestmentExtractionResult {
  investments: ExtractedInvestment[]
  allAmounts: number[]
  allDates: string[]
  allCertNumbers: string[]
  summary: string
  rawText: string
}

// ── Scheme keyword map ──────────────────────────────────────────
const SCHEME_KEYWORDS: Record<string, string[]> = {
  'NSC': ['nsc', 'national savings certificate', 'national saving certificate'],
  'KVP': ['kvp', 'kisan vikas patra'],
  'SCSS': ['scss', 'senior citizen savings', 'senior citizen scheme'],
  'MIS': ['mis', 'monthly income scheme', 'monthly income plan', 'post office mis'],
  'PPF': ['ppf', 'public provident fund'],
  'SSY': ['ssy', 'sukanya samriddhi', 'sukanya'],
  'Time Deposit': ['time deposit', 'td account', 'post office td', 'postal td'],
  'RD': ['rd account', 'recurring deposit', 'post office rd'],
  'Bank FD': ['fixed deposit', 'fd', 'term deposit', 'bank fd', 'fdr'],
  'Bank RD': ['bank rd', 'bank recurring'],
  'Corporate FD': ['corporate fd', 'company fd', 'corporate fixed deposit'],
  'NPS': ['nps', 'national pension', 'national pension system'],
  'EPF': ['epf', 'provident fund', 'pf account'],
  'Mutual Fund': ['mutual fund', 'mf', 'sip', 'lumpsum', 'nav', 'folio', 'amc'],
  'Stocks': ['equity', 'shares', 'stock', 'demat', 'nse', 'bse', 'zerodha', 'groww', 'upstox'],
  'SGB': ['sgb', 'sovereign gold bond', 'gold bond'],
  'Gold': ['gold', 'physical gold', 'digital gold'],
  'LIC': ['lic', 'life insurance corporation', 'endowment', 'money back'],
  'Bond': ['bond', 'debenture', 'ncd'],
}

const INSTITUTION_KEYWORDS = [
  'hdfc bank', 'sbi', 'state bank', 'icici bank', 'axis bank', 'kotak', 'pnb', 'punjab national',
  'bank of baroda', 'union bank', 'canara bank', 'indian bank', 'bank of india', 'yes bank',
  'idfc bank', 'indusind', 'federal bank', 'rbl bank', 'bandhan bank', 'au small finance',
  'post office', 'india post', 'dop', 'department of posts',
  'lic', 'sbimf', 'hdfc mutual', 'icici prudential', 'axis mutual', 'nippon', 'mirae', 'parag parikh',
  'zerodha', 'groww', 'upstox', 'angel broking', 'motilal oswal', 'uti', 'dsp', 'kotak mutual',
]

const FAMILY_NAMES = [
  'vishal gupta', 'vishal', 'kavita gupta', 'kavita',
  'shubh gupta', 'shubh', 'krishiv gupta', 'krishiv',
  'manohar lal gupta', 'manohar', 'manohar lal',
  'daya gupta', 'daya',
  'vishal gupta huf', 'manohar lal gupta huf',
]

// ── Regex patterns ──────────────────────────────────────────────
const AMOUNT_RE = /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d{1,2})?)|(?:amount|principal|deposit|invested|maturity|value)[:\s]+(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/gi
const PLAIN_AMOUNT_RE = /\b([\d,]{5,}(?:\.\d{1,2})?)\b/g
const RATE_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:p\.?a\.?|per\s*annum|interest|rate)?/gi
const DATE_RE = /\b((?:0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](?:19|20)\d{2})\b|\b((?:19|20)\d{2}[\/-](0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01]))\b/g
const CERT_RE = /(?:certificate\s*(?:no|number|#)?|cert\.?\s*(?:no)?|receipt\s*(?:no|number)?|folio\s*(?:no|number)?|fdr\s*(?:no)?|policy\s*(?:no|number)?)[:\s]*([A-Z0-9\-\/]{4,20})/gi
const ACNO_RE = /(?:a\/c|account|ac)\s*(?:no|number|#)?[:\s]*([0-9]{6,18})/gi

// ── Helpers ─────────────────────────────────────────────────────
function parseAmount(str: string): number {
  return parseFloat(str.replace(/,/g, '')) || 0
}

function normalizeDate(str: string): string {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Try YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return str
}

function detectScheme(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const [scheme, keywords] of Object.entries(SCHEME_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return scheme
  }
  return undefined
}

function detectInstitution(text: string): string | undefined {
  const lower = text.toLowerCase()
  const found = INSTITUTION_KEYWORDS.find(inst => lower.includes(inst))
  if (found) return found.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return undefined
}

function detectMember(text: string): string | undefined {
  const lower = text.toLowerCase()
  const found = FAMILY_NAMES.find(name => lower.includes(name))
  if (!found) return undefined
  return found.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getSnippet(text: string, around: string, radius = 150): string {
  const idx = text.toLowerCase().indexOf(around.toLowerCase())
  if (idx === -1) return text.slice(0, 200)
  return text.slice(Math.max(0, idx - radius), idx + around.length + radius).replace(/\n/g, ' ').trim()
}

// ── Main extractor ──────────────────────────────────────────────
export function extractInvestmentsFromText(rawText: string): InvestmentExtractionResult {
  const text = rawText.replace(/\r/g, '\n')
  const lower = text.toLowerCase()

  // ── Collect all amounts ───────────────────────────────────────
  const allAmountsRaw = new Set<number>()
  let m: RegExpExecArray | null

  const amountRe = new RegExp(AMOUNT_RE.source, 'gi')
  while ((m = amountRe.exec(text)) !== null) {
    const val = parseAmount(m[1] || m[2] || '')
    if (val > 100) allAmountsRaw.add(val)
  }

  // Also grab standalone large numbers as potential amounts
  const plainRe = new RegExp(PLAIN_AMOUNT_RE.source, 'g')
  while ((m = plainRe.exec(text)) !== null) {
    const val = parseAmount(m[1])
    if (val >= 1000 && val <= 100000000) allAmountsRaw.add(val)
  }
  const allAmounts = [...allAmountsRaw].sort((a, b) => a - b)

  // ── Collect all dates ─────────────────────────────────────────
  const allDatesRaw = new Set<string>()
  const dateRe = new RegExp(DATE_RE.source, 'g')
  while ((m = dateRe.exec(text)) !== null) {
    allDatesRaw.add(normalizeDate(m[1] || m[3] || ''))
  }
  const allDates = [...allDatesRaw].sort()

  // ── Collect certificate numbers ───────────────────────────────
  const allCertNumbers: string[] = []
  const certRe = new RegExp(CERT_RE.source, 'gi')
  while ((m = certRe.exec(text)) !== null) {
    if (m[1] && !allCertNumbers.includes(m[1])) allCertNumbers.push(m[1])
  }

  // ── Collect account numbers ───────────────────────────────────
  const allAccountNos: string[] = []
  const acRe = new RegExp(ACNO_RE.source, 'gi')
  while ((m = acRe.exec(text)) !== null) {
    if (m[1] && !allAccountNos.includes(m[1])) allAccountNos.push(m[1])
  }

  // ── Collect interest rates ────────────────────────────────────
  const allRates: number[] = []
  const rateRe = new RegExp(RATE_RE.source, 'gi')
  while ((m = rateRe.exec(text)) !== null) {
    const rate = parseFloat(m[1])
    if (rate > 0 && rate < 50) allRates.push(rate)
  }

  // ── Try to build investment records ──────────────────────────
  // Split into logical blocks (paragraphs or table rows)
  const blocks = text.split(/\n{2,}|\t{2,}/).filter(b => b.trim().length > 20)

  const investments: ExtractedInvestment[] = []

  for (const block of blocks) {
    const scheme = detectScheme(block)
    if (!scheme) continue // Only create records where we can identify a scheme

    const inv: ExtractedInvestment = {
      investment_type: scheme,
      confidence: 'medium',
      raw_context: block.replace(/\n/g, ' ').trim().slice(0, 300),
    }

    // Institution
    const inst = detectInstitution(block)
    if (inst) inv.institution_name = inst

    // Member
    const member = detectMember(block)
    if (member) inv.member_name = member

    // Amount — pick the first reasonable amount in block
    const blockAmountRe = /(?:rs\.?|₹|inr)?\s*([\d,]{4,}(?:\.\d{1,2})?)/gi
    const blockAmounts: number[] = []
    let bm: RegExpExecArray | null
    while ((bm = blockAmountRe.exec(block)) !== null) {
      const v = parseAmount(bm[1])
      if (v >= 1000) blockAmounts.push(v)
    }
    if (blockAmounts.length > 0) {
      inv.principal_amount = Math.min(...blockAmounts) // usually the smaller is principal
      if (blockAmounts.length > 1) inv.maturity_amount = Math.max(...blockAmounts)
    }

    // Dates in block
    const blockDateRe = new RegExp(DATE_RE.source, 'g')
    const blockDates: string[] = []
    while ((bm = blockDateRe.exec(block)) !== null) {
      blockDates.push(normalizeDate(bm[1] || bm[3] || ''))
    }
    if (blockDates.length >= 1) inv.purchase_date = blockDates[0]
    if (blockDates.length >= 2) inv.maturity_date = blockDates[blockDates.length - 1]

    // Interest rate
    const blockRateRe = /(\d+(?:\.\d+)?)\s*%/g
    while ((bm = blockRateRe.exec(block)) !== null) {
      const r = parseFloat(bm[1])
      if (r > 0 && r < 50) { inv.interest_rate = r; break }
    }

    // Certificate / folio number
    const blockCertRe = new RegExp(CERT_RE.source, 'gi')
    while ((bm = blockCertRe.exec(block)) !== null) {
      if (bm[1]) { inv.certificate_number = bm[1]; break }
    }

    // Account number
    const blockAcRe = new RegExp(ACNO_RE.source, 'gi')
    while ((bm = blockAcRe.exec(block)) !== null) {
      if (bm[1]) { inv.account_number = bm[1]; break }
    }

    // Confidence
    let score = 0
    if (inv.principal_amount) score++
    if (inv.purchase_date) score++
    if (inv.institution_name) score++
    if (inv.certificate_number || inv.account_number) score++
    inv.confidence = score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low'

    investments.push(inv)
  }

  // If no block-based records but we have scheme keywords globally, make a single generic record
  if (investments.length === 0) {
    const scheme = detectScheme(text)
    if (scheme || allAmounts.length > 0) {
      const inv: ExtractedInvestment = {
        investment_type: scheme,
        institution_name: detectInstitution(text),
        member_name: detectMember(text),
        principal_amount: allAmounts.length > 0 ? allAmounts[0] : undefined,
        maturity_amount: allAmounts.length > 1 ? allAmounts[allAmounts.length - 1] : undefined,
        purchase_date: allDates.length > 0 ? allDates[0] : undefined,
        maturity_date: allDates.length > 1 ? allDates[allDates.length - 1] : undefined,
        interest_rate: allRates.length > 0 ? allRates[0] : undefined,
        certificate_number: allCertNumbers.length > 0 ? allCertNumbers[0] : undefined,
        confidence: 'low',
        raw_context: text.slice(0, 300),
      }
      investments.push(inv)
    }
  }

  // ── Summary ───────────────────────────────────────────────────
  const parts: string[] = []
  if (investments.length) parts.push(`${investments.length} investment record(s)`)
  if (allAmounts.length) parts.push(`${allAmounts.length} amount(s) found`)
  if (allDates.length) parts.push(`${allDates.length} date(s)`)
  if (allCertNumbers.length) parts.push(`${allCertNumbers.length} certificate no(s)`)

  return {
    investments,
    allAmounts,
    allDates,
    allCertNumbers,
    summary: parts.length > 0 ? `Found: ${parts.join(', ')}` : 'No investment data detected',
    rawText: text.slice(0, 3000),
  }
}

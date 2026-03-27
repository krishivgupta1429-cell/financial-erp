// ─────────────────────────────────────────────────────────────────
// Notification Engine — classifies financial SMS/email/voice text
// into categories and generates actionable items automatically
// ─────────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'tds' | 'ipo' | 'ipo_refund' | 'survival_benefit'
  | 'fd_maturity' | 'rd_maturity' | 'fd_interest' | 'dividend'
  | 'premium_due' | 'emi_debit' | 'emi_bounce'
  | 'itr' | 'itr_refund' | 'credit_card_bill'
  | 'mutual_fund' | 'loan_sanction' | 'bonus' | 'kyc' | 'other'

export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface ClassifiedNotification {
  category: NotificationCategory
  subcategory: string
  amount?: number
  reference_number?: string
  institution_name?: string
  notification_date?: string
  due_date?: string
  action_title: string
  action_description: string
  action_priority: ActionPriority
  action_due_date?: string
  confidence: 'high' | 'medium' | 'low'
  needs_review: boolean
}

// ── Category detection rules ────────────────────────────────────
const RULES: Array<{
  category: NotificationCategory
  subcategory: string
  patterns: RegExp[]
  priority: ActionPriority
  action_title: string
  action_description: string
  due_offset_days?: number  // relative fallback if no date found
}> = [
  {
    category: 'emi_bounce', subcategory: 'EMI Bounce / NACH Return', priority: 'urgent',
    patterns: [/emi\s*(bounce|fail|return)/i, /nach\s*(return|fail)/i, /ecs\s*(return|fail)/i, /insufficient.*emi/i],
    action_title: 'URGENT: Arrange funds — EMI/NACH returned',
    action_description: 'Your EMI or NACH debit has failed due to insufficient funds or other reason. Arrange funds immediately and contact your bank to re-present. Bounced EMIs attract penalty and hurt your CIBIL score.',
    due_offset_days: 1,
  },
  {
    category: 'premium_due', subcategory: 'Insurance Premium Due', priority: 'urgent',
    patterns: [/premium\s*(due|reminder|payable|payment)/i, /pay.*premium/i, /policy.*lapse/i, /renewal.*premium/i],
    action_title: 'Pay insurance premium before due date',
    action_description: 'Your insurance premium is due. Non-payment beyond the grace period (usually 30 days) will lapse the policy. Pay immediately via net banking, UPI, or visit branch.',
    due_offset_days: 3,
  },
  {
    category: 'kyc', subcategory: 'KYC Update Required', priority: 'urgent',
    patterns: [/kyc\s*(update|pending|required|expired|due)/i, /re-kyc/i, /complete.*kyc/i],
    action_title: 'Complete KYC — account may be frozen',
    action_description: 'KYC update is required. If not done by the deadline, your account/investments may be frozen. Complete KYC online or visit the nearest branch.',
    due_offset_days: 7,
  },
  {
    category: 'fd_maturity', subcategory: 'FD Maturity', priority: 'urgent',
    patterns: [/fd\s*(matur|due\s*for\s*renewal)/i, /fixed\s*deposit\s*(matur|due)/i, /deposit.*matur/i, /maturity.*fd/i, /maturity.*fixed\s*deposit/i],
    action_title: 'Renew or withdraw FD — act within grace period',
    action_description: 'Your Fixed Deposit has matured or is maturing soon. You have a grace period (typically 7–14 days) to decide: auto-renew, renew at new rate, or withdraw. Contact your bank.',
    due_offset_days: 5,
  },
  {
    category: 'tds', subcategory: 'TDS Deducted', priority: 'high',
    patterns: [/tds\s*(deducted|of|@|has\s*been)/i, /tax\s*deducted\s*at\s*source/i, /tds\s*certificate/i, /form\s*16[ab]/i],
    action_title: 'Report TDS in ITR — collect Form 16A',
    action_description: 'TDS has been deducted. Collect Form 16A from the deductor. This TDS will appear in your 26AS. Report the gross income (before TDS) in ITR under the relevant head and claim TDS credit. ITR filing deadline: July 31.',
    due_offset_days: 60,
  },
  {
    category: 'credit_card_bill', subcategory: 'Credit Card Bill', priority: 'high',
    patterns: [/credit\s*card\s*(statement|bill|due)/i, /(total|minimum).*due.*(rs|₹)/i, /payment\s*due\s*(on|by|date)/i, /card.*statement.*generated/i],
    action_title: 'Pay credit card bill before due date',
    action_description: 'Your credit card statement has been generated. Pay the TOTAL due (not minimum) before the due date to avoid interest (24–42% p.a.) and late payment charges. Set auto-debit if not already done.',
    due_offset_days: 10,
  },
  {
    category: 'loan_sanction', subcategory: 'Loan Sanctioned', priority: 'high',
    patterns: [/loan\s*(sanctioned|approved|disbursed)/i, /(home|car|personal|education)\s*loan\s*(approved|sanctioned)/i],
    action_title: 'Record new loan as liability in ERP',
    action_description: 'A new loan has been sanctioned/disbursed. Record it in your Liabilities module with full details (principal, interest rate, EMI, tenure). Set up EMI auto-debit if not done.',
    due_offset_days: 3,
  },
  {
    category: 'rd_maturity', subcategory: 'RD Maturity', priority: 'high',
    patterns: [/rd\s*matur/i, /recurring\s*deposit\s*(matur|due)/i],
    action_title: 'Reinvest or withdraw RD maturity proceeds',
    action_description: 'Your Recurring Deposit has matured. Decide on reinvestment: start a new RD/FD, or transfer to savings. Contact your bank to process.',
    due_offset_days: 7,
  },
  {
    category: 'itr', subcategory: 'ITR Filed', priority: 'medium',
    patterns: [/itr\s*(filed|submitted|acknowledged)/i, /income\s*tax\s*return.*filed/i, /itr-v/i, /efiling.*income\s*tax/i],
    action_title: 'Download and keep ITR-V acknowledgment',
    action_description: 'Your ITR has been filed. Download ITR-V from incometax.gov.in and store it. If filed offline, e-verify within 30 days via Aadhaar OTP, net banking, or send signed ITR-V to CPC Bengaluru.',
    due_offset_days: 7,
  },
  {
    category: 'ipo', subcategory: 'IPO Allotment', priority: 'medium',
    patterns: [/ipo\s*allotment/i, /shares?\s*(allotted|allocated)/i, /allotment\s*(confirmed|successful)/i, /you\s*have\s*been\s*allotted/i],
    action_title: 'Update portfolio — verify IPO shares in demat',
    action_description: 'IPO allotment confirmed. Log in to your demat account (Zerodha/Groww/etc.) and verify the shares have been credited. Update your Investments module.',
    due_offset_days: 7,
  },
  {
    category: 'survival_benefit', subcategory: 'Survival/Money Back Benefit', priority: 'medium',
    patterns: [/survival\s*benefit/i, /money\s*back\s*(policy|payment|received|credited)/i, /maturity\s*benefit\s*(credited|paid)/i, /survival\s*(claim|amount)/i, /periodic\s*benefit/i],
    action_title: 'Record survival benefit receipt and reinvest',
    action_description: 'Survival/money-back benefit has been credited. Verify receipt in your bank account. Decide on reinvestment or update policy records in Insurance module.',
    due_offset_days: 14,
  },
  {
    category: 'bonus', subcategory: 'Bonus Shares', priority: 'medium',
    patterns: [/bonus\s*shares?/i, /bonus\s*issue/i, /bonus\s*(credited|allotted)/i],
    action_title: 'Update share count in investments',
    action_description: 'Bonus shares have been credited to your demat. Update your stock/investment holdings to reflect the new quantity and adjusted cost basis.',
    due_offset_days: 14,
  },
  {
    category: 'fd_interest', subcategory: 'FD Interest Credit', priority: 'low',
    patterns: [/(fd|fixed\s*deposit|deposit)\s*interest\s*(credited|paid)/i, /interest\s*(on|for)\s*(fd|fixed\s*deposit)/i, /quarterly\s*interest.*deposit/i],
    action_title: 'Note FD interest for ITR — taxable if >₹40,000',
    action_description: 'FD interest has been credited. This is taxable under "Income from Other Sources". If total FD interest exceeds ₹40,000 (₹50,000 for senior citizens) in a year, TDS will be deducted. Report gross interest in ITR.',
    due_offset_days: 90,
  },
  {
    category: 'dividend', subcategory: 'Dividend Received', priority: 'low',
    patterns: [/dividend\s*(of|credited|paid|received)/i, /(interim|final|special)\s*dividend/i],
    action_title: 'Record dividend income for ITR',
    action_description: 'Dividend received. Dividends are taxable at slab rate. Ensure this is reported in ITR under "Income from Other Sources". If total dividend exceeds ₹5,000, TDS @ 10% applies.',
    due_offset_days: 90,
  },
  {
    category: 'mutual_fund', subcategory: 'MF / SIP Transaction', priority: 'low',
    patterns: [/sip\s*(deducted|of|installment)/i, /units?\s*(allotted|purchased|redeemed)/i, /folio\s*(no|number)/i, /mutual\s*fund\s*(purchase|redemption)/i],
    action_title: 'Update MF portfolio value',
    action_description: 'Mutual fund transaction processed. Verify units in your CAMS/KFintech or broker app. Update current value in your Investments module.',
    due_offset_days: 7,
  },
  {
    category: 'ipo_refund', subcategory: 'IPO Refund', priority: 'low',
    patterns: [/ipo\s*refund/i, /refund\s*(of|for)\s*ipo/i, /asba\s*refund/i, /application\s*money\s*refund/i],
    action_title: 'Confirm IPO refund received in bank',
    action_description: 'IPO application was not allotted — refund initiated. Verify refund credit in your bank account. ASBA amounts are typically unblocked within 3 working days.',
    due_offset_days: 3,
  },
  {
    category: 'emi_debit', subcategory: 'EMI Debited', priority: 'low',
    patterns: [/emi\s*(of|for|deducted|debited)/i, /(home|car|personal|education)\s*loan\s*emi/i, /instalment\s*(debited|deducted)/i, /loan\s*emi/i],
    action_title: 'Verify EMI credited to loan account',
    action_description: 'Loan EMI has been debited. Log in to your loan account portal and confirm the payment has been applied. Update outstanding balance in Liabilities module if tracking manually.',
    due_offset_days: 2,
  },
  {
    category: 'itr_refund', subcategory: 'ITR Refund', priority: 'low',
    patterns: [/income\s*tax\s*refund/i, /it\s*refund.*(rs|₹)/i, /tax\s*refund\s*(of|credited)/i],
    action_title: 'Confirm ITR refund received; check 26AS',
    action_description: 'Income tax refund has been processed. Verify credit in your bank account. Cross-check the refund amount with your ITR computation. Update 26AS on IT portal.',
    due_offset_days: 5,
  },
]

// ── Helper: ITR due date (July 31 of current or next year) ──────
function itrDueDate(): string {
  const now = new Date()
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-07-31`
}

// ── Helper: offset date ─────────────────────────────────────────
function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Helper: normalize dates ─────────────────────────────────────
function normalizeDate(str: string): string | undefined {
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${y}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  }
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`
  return undefined
}

// ── Helper: extract amount ──────────────────────────────────────
function extractAmount(text: string): number | undefined {
  const re = /(?:rs\.?\s*|₹\s*|inr\s*)([\d,]+(?:\.\d{1,2})?)\s*(?:\/\-)?/gi
  let best: number | undefined
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g,''))
    if (!best || v > best) best = v   // take largest amount as primary
  }
  return best
}

// ── Helper: extract reference number ───────────────────────────
function extractReference(text: string): string | undefined {
  const patterns = [
    /(?:policy\s*(?:no|number|#)|policy)[:\s]+([A-Z0-9\-\/]{6,25})/i,
    /(?:fd\s*(?:no|number|#)|fdr)[:\s]+([A-Z0-9\-\/]{4,20})/i,
    /(?:application\s*(?:no|number|#))[:\s]+([A-Z0-9\-\/]{4,20})/i,
    /(?:ref(?:erence)?\s*(?:no|number|#)?)[:\s]+([A-Z0-9\-\/]{6,25})/i,
    /(?:account\s*(?:no|number|#)?)[:\s]+([0-9]{6,18})/i,
    /(?:loan\s*(?:ac|account)\s*(?:no|number)?)[:\s]+([A-Z0-9\-\/]{4,20})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return m[1].trim()
  }
  return undefined
}

// ── Helper: extract due date ────────────────────────────────────
function extractDueDate(text: string): string | undefined {
  const patterns = [
    /(?:due\s*(?:on|date|by)|pay\s*by|payable\s*by|last\s*date)[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
    /due\s*(?:on|by)\s*(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const normalized = normalizeDate(m[1].trim())
      if (normalized) return normalized
    }
  }
  return undefined
}

// ── Helper: extract institution ─────────────────────────────────
function extractInstitution(text: string): string | undefined {
  const names = [
    'hdfc bank', 'hdfc', 'sbi', 'state bank', 'icici bank', 'icici', 'axis bank', 'axis',
    'kotak', 'pnb', 'punjab national', 'bank of baroda', 'union bank', 'canara bank',
    'indian bank', 'yes bank', 'indusind', 'federal bank', 'idfc',
    'post office', 'india post', 'lic', 'sbi life', 'hdfc life', 'icici prudential',
    'max life', 'bajaj allianz', 'star health', 'tata aia', 'kotak life',
    'zerodha', 'groww', 'upstox', 'angel one', 'motilal oswal',
    'nsdl', 'cdsl', 'cams', 'karvy', 'kfintech',
    'income tax', 'it department', 'traces',
  ]
  const lower = text.toLowerCase()
  const found = names.find(n => lower.includes(n))
  if (!found) return undefined
  return found.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Main classifier ─────────────────────────────────────────────
export function classifyNotification(rawText: string): ClassifiedNotification {
  const text = rawText.trim()

  // Find matching rule
  let matched = RULES.find(r => r.patterns.some(p => p.test(text)))

  // Fallback
  if (!matched) {
    matched = {
      category: 'other', subcategory: 'General Financial Notification', priority: 'low',
      patterns: [],
      action_title: 'Review this notification and take action if needed',
      action_description: 'No specific action was auto-detected. Please review the original message and determine if any action is required.',
      due_offset_days: 30,
    }
  }

  const amount = extractAmount(text)
  const reference_number = extractReference(text)
  const institution_name = extractInstitution(text)
  const due_date = extractDueDate(text)

  // Extract notification date
  const dateRe = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/g
  let m: RegExpExecArray | null
  let notification_date: string | undefined
  while ((m = dateRe.exec(text)) !== null) {
    const nd = normalizeDate(m[1])
    if (nd && nd <= new Date().toISOString().slice(0,10)) { notification_date = nd; break }
  }

  // Compute action due date
  let action_due_date: string | undefined
  if (matched.category === 'tds' || matched.category === 'fd_interest' || matched.category === 'dividend') {
    action_due_date = itrDueDate()
  } else if (matched.category === 'premium_due' && due_date) {
    action_due_date = due_date
  } else if (matched.category === 'credit_card_bill' && due_date) {
    action_due_date = due_date
  } else if (matched.due_offset_days) {
    action_due_date = offsetDate(matched.due_offset_days)
  }

  // Confidence scoring
  let score = 0
  if (amount) score++
  if (reference_number) score++
  if (institution_name) score++
  if (notification_date || due_date) score++
  if (matched.category !== 'other') score++

  const confidence: 'high' | 'medium' | 'low' = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low'

  return {
    category: matched.category,
    subcategory: matched.subcategory,
    amount,
    reference_number,
    institution_name,
    notification_date,
    due_date,
    action_title: matched.action_title,
    action_description: matched.action_description,
    action_priority: matched.priority,
    action_due_date,
    confidence,
    needs_review: confidence === 'low' || matched.category === 'other',
  }
}

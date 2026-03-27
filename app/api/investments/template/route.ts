import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const FAMILY_MEMBERS = ['Vishal Gupta', 'Kavita Gupta', 'Shubh Gupta', 'Krishiv Gupta']

const INVESTMENT_TYPES = [
  'NSC (National Savings Certificate)',
  'KVP (Kisan Vikas Patra)',
  'SCSS (Senior Citizens Savings)',
  'MIS (Monthly Income Scheme)',
  'Post Office TD (Time Deposit)',
  'Post Office RD',
  'Post Office PPF',
  'Sukanya Samriddhi Yojana',
  'Bank FD',
  'Bank RD',
  'Bank PPF',
  'Mutual Fund',
  'Stocks / Equity',
  'ETF',
  'SGBs (Sovereign Gold Bonds)',
  'Bonds / Debentures',
  'PPF (Public Provident Fund)',
  'NPS (National Pension System)',
  'EPF',
  'VPF',
  'Gold (Physical)',
  'Gold (Digital)',
  'Real Estate',
  'Corporate FD',
  'Chit Fund',
  'LIC Endowment',
  'Other',
]

const INTEREST_FREQUENCIES = [
  'Monthly',
  'Quarterly',
  'Half-Yearly',
  'Annual',
  'On Maturity',
  'Not Applicable',
]

const HEADERS = [
  'Family Member *',
  'Investment Type *',
  'Institution / Bank / Post Office *',
  'Post Office Branch',
  'Certificate Number',
  'Account / Folio / Receipt Number',
  'Principal Amount (₹) *',
  'Current Value (₹)',
  'Interest Rate % p.a.',
  'Interest Credit Frequency',
  'Cumulative (Yes/No)',
  'Start Date (DD/MM/YYYY)',
  'Maturity Date (DD/MM/YYYY)',
  'Next Interest Credit Date (DD/MM/YYYY)',
  'Tenure (Months)',
  'Expected Maturity Amount (₹)',
  'Nominee',
  'Notes',
]

const SAMPLE_ROWS = [
  ['Vishal Gupta', 'NSC (National Savings Certificate)', 'Post Office Sector 4', 'Sector 4 Noida', 'NSC12345678', 'RCP987654', 100000, 115000, 7.7, 'On Maturity', 'Yes', '01/04/2023', '01/04/2028', '', 60, 145678, 'Kavita Gupta', '5 year NSC'],
  ['Vishal Gupta', 'Bank FD', 'HDFC Bank', '', '', 'FD123456789', 500000, 525000, 7.25, 'Quarterly', 'No', '15/01/2024', '15/01/2025', '15/04/2025', 12, 537500, 'Kavita Gupta', 'Quarterly payout FD'],
  ['Kavita Gupta', 'KVP (Kisan Vikas Patra)', 'Post Office Civil Lines', 'Civil Lines', 'KVP556677', '', 200000, 200000, 7.5, 'On Maturity', 'Yes', '10/06/2022', '10/06/2030', '', 96, 400000, 'Vishal Gupta', 'Doubles in ~115 months'],
  ['Vishal Gupta', 'Mutual Fund', 'HDFC AMC', '', '', 'HDFC123456', 300000, 385000, '', 'Not Applicable', 'Yes', '01/01/2021', '', '', '', '', 'Kavita Gupta', 'HDFC Flexi Cap Growth'],
  ['Kavita Gupta', 'SCSS (Senior Citizens Savings)', 'SBI Bank', '', '', 'SCSS998877', 1500000, 1500000, 8.2, 'Quarterly', 'No', '01/07/2023', '01/07/2028', '01/07/2025', 60, 2115000, 'Vishal Gupta', 'Max 30L limit'],
]

export async function GET() {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Investment Data ──────────────────────────────────
  const wsData: any[][] = [HEADERS, ...SAMPLE_ROWS]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // Family Member
    { wch: 36 }, // Investment Type
    { wch: 32 }, // Institution
    { wch: 20 }, // PO Branch
    { wch: 18 }, // Certificate
    { wch: 22 }, // Account
    { wch: 20 }, // Principal
    { wch: 18 }, // Current Value
    { wch: 16 }, // Rate
    { wch: 22 }, // Frequency
    { wch: 16 }, // Cumulative
    { wch: 20 }, // Start Date
    { wch: 20 }, // Maturity Date
    { wch: 26 }, // Next Interest
    { wch: 16 }, // Tenure
    { wch: 24 }, // Expected Maturity
    { wch: 16 }, // Nominee
    { wch: 28 }, // Notes
  ]

  // Style header row
  HEADERS.forEach((_, i) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i })
    if (!ws[cellAddr]) return
    ws[cellAddr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { horizontal: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'CCCCCC' } } },
    }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Investment Data')

  // ── Sheet 2: Valid Values (reference) ────────────────────────
  const refData: any[][] = [
    ['Family Members', 'Investment Types', 'Interest Frequency', 'Cumulative'],
    ...Array.from({ length: Math.max(FAMILY_MEMBERS.length, INVESTMENT_TYPES.length, INTEREST_FREQUENCIES.length) }, (_, i) => [
      FAMILY_MEMBERS[i] || '',
      INVESTMENT_TYPES[i] || '',
      INTEREST_FREQUENCIES[i] || '',
      i === 0 ? 'Yes' : i === 1 ? 'No' : '',
    ]),
  ]
  const wsRef = XLSX.utils.aoa_to_sheet(refData)
  wsRef['!cols'] = [{ wch: 22 }, { wch: 40 }, { wch: 20 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsRef, 'Valid Values (Reference)')

  // ── Sheet 3: Instructions ─────────────────────────────────────
  const instructions = [
    ['GUPTA FAMILY FINANCE — INVESTMENT UPLOAD TEMPLATE'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill data in the "Investment Data" sheet only.'],
    ['2. Do NOT change column headers (Row 1).'],
    ['3. Columns marked with * are mandatory.'],
    ['4. Use exact names from the "Valid Values (Reference)" sheet for Family Member, Investment Type, and Interest Frequency.'],
    ['5. Dates must be in DD/MM/YYYY format (e.g. 15/03/2024).'],
    ['6. Amounts should be numbers only — no ₹ symbol or commas.'],
    ['7. Cumulative: Enter Yes (interest reinvested) or No (paid out periodically).'],
    ['8. When you upload a fresh file, ALL existing investment records for members in the file will be REPLACED.'],
    ['9. To keep old records, make sure they are included in the new file too.'],
    ['10. Delete the sample rows before uploading your actual data.'],
    [''],
    ['COLUMN GUIDE:'],
    ['Family Member', 'Must match exactly: Vishal Gupta / Kavita Gupta / Shubh Gupta / Krishiv Gupta'],
    ['Investment Type', 'Select from the Valid Values sheet'],
    ['Institution', 'Bank name, Post Office location, AMC name, etc.'],
    ['Certificate Number', 'NSC/KVP certificate number, FD receipt number, etc.'],
    ['Account/Folio Number', 'Bank account, mutual fund folio, demat account, etc.'],
    ['Principal Amount', 'Original amount invested (mandatory)'],
    ['Current Value', 'Current market/book value — leave blank if same as principal'],
    ['Interest Rate', 'Annual rate in % (e.g. 7.5 for 7.5%) — leave blank for equity'],
    ['Interest Credit Frequency', 'How often interest is credited to your account'],
    ['Cumulative', 'Yes = interest reinvested; No = interest paid out periodically'],
    ['Start Date', 'Date of investment / purchase / deposit'],
    ['Maturity Date', 'When the investment matures — leave blank for open-ended'],
    ['Next Interest Credit Date', 'Next date when interest will be credited to bank'],
    ['Tenure (Months)', 'Total duration in months (e.g. 60 for 5 years)'],
    ['Expected Maturity Amount', 'Estimated amount you will receive on maturity'],
    ['Nominee', 'Name of the nominee for this investment'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions)
  wsInstr['!cols'] = [{ wch: 28 }, { wch: 70 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions')

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Gupta_Family_Investment_Template.xlsx"',
    },
  })
}

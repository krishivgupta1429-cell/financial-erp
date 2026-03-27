import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const FAMILY_MEMBERS = [
  'Vishal Gupta', 'Kavita Gupta', 'Shubh Gupta', 'Krishiv Gupta',
  'Vishal Gupta (HUF)', 'Manohar Lal Gupta (HUF)', 'Manohar Lal Gupta', 'Daya Gupta',
]

export async function GET() {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Personal Details ─────────────────────────────────
  const personalHeaders = [
    'Family Member *', 'PAN Number', 'Aadhaar Number (12 digits)',
    'Date of Birth (DD/MM/YYYY)', 'Mobile Number', 'Email Address',
    'Occupation', 'Address', 'Nominee Name', 'Nominee Relation', 'Notes',
  ]
  const personalSamples = [
    ['Vishal Gupta', 'ABCDE1234F', '123456789012', '15/03/1975', '9876543210', 'vishal@email.com', 'Business', '123 MG Road, Noida 201301', 'Kavita Gupta', 'Spouse', ''],
    ['Kavita Gupta', 'FGHIJ5678K', '234567890123', '20/07/1978', '9876543211', 'kavita@email.com', 'Homemaker', '123 MG Road, Noida 201301', 'Vishal Gupta', 'Spouse', ''],
    ['Shubh Gupta', '', '345678901234', '10/04/2005', '9876543212', 'shubh@email.com', 'Student', '123 MG Road, Noida 201301', 'Vishal Gupta', 'Father', ''],
    ['Krishiv Gupta', '', '', '22/09/2010', '', '', 'Student', '123 MG Road, Noida 201301', 'Vishal Gupta', 'Father', 'Minor'],
    ['Manohar Lal Gupta', 'LMNOP9012Q', '456789012345', '05/01/1948', '9876543213', '', 'Retired', '456 Civil Lines, Delhi', 'Daya Gupta', 'Spouse', ''],
    ['Daya Gupta', 'RSTUV3456W', '567890123456', '12/06/1952', '9876543214', '', 'Homemaker', '456 Civil Lines, Delhi', 'Manohar Lal Gupta', 'Spouse', ''],
  ]
  const wsPersonal = XLSX.utils.aoa_to_sheet([personalHeaders, ...personalSamples])
  wsPersonal['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 14 },
    { wch: 24 }, { wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, wsPersonal, 'Personal Details')

  // ── Sheet 2: Bank Accounts ────────────────────────────────────
  const bankHeaders = [
    'Family Member *', 'Bank Name *', 'Account Number *', 'Account Type *',
    'IFSC Code', 'CIF / Customer ID', 'Registered Mobile',
    'Registered Email', 'Net Banking User ID', 'UPI ID(s) (comma separated)',
    'Nominee Name', 'Joint Holder', 'Minimum Balance (₹)', 'Current Balance (₹)', 'Notes',
  ]
  const bankSamples = [
    ['Vishal Gupta', 'HDFC Bank', '50100123456789', 'Savings', 'HDFC0001234', 'CIF123456', '9876543210', 'vishal@email.com', 'vishal1234', 'vishal@oksbi, vishalg@ybl', 'Kavita Gupta', '', 10000, 125000, 'Primary account'],
    ['Vishal Gupta', 'SBI', '12345678901', 'Savings', 'SBIN0001234', '', '9876543210', '', '', 'vishal@sbi', 'Kavita Gupta', '', 5000, 45000, 'Salary account'],
    ['Kavita Gupta', 'Axis Bank', '919876543210001', 'Savings', 'UTIB0001234', 'CIF789012', '9876543211', 'kavita@email.com', 'kavita2024', 'kavita@axl', 'Vishal Gupta', '', 10000, 78000, ''],
    ['Vishal Gupta (HUF)', 'HDFC Bank', '50100987654321', 'Current', 'HDFC0001234', '', '9876543210', 'vishal@email.com', 'vishalhuf', 'vishalhuf@oksbi', '', '', 25000, 320000, 'HUF account'],
    ['Manohar Lal Gupta', 'SBI', '98765432101', 'Savings', 'SBIN0005678', '', '9876543213', '', '', '', 'Daya Gupta', '', 3000, 156000, 'Senior citizen'],
  ]
  const wsBank = XLSX.utils.aoa_to_sheet([bankHeaders, ...bankSamples])
  wsBank['!cols'] = [
    { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 32 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 24 },
  ]
  XLSX.utils.book_append_sheet(wb, wsBank, 'Bank Accounts')

  // ── Sheet 3: Valid Values ─────────────────────────────────────
  const validData = [
    ['Family Members', 'Account Types', 'Nominee Relations'],
    ...FAMILY_MEMBERS.map((m, i) => [
      m,
      ['Savings', 'Current', 'Salary', 'NRE', 'NRO'][i] || '',
      ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister'][i] || '',
    ]),
  ]
  const wsValid = XLSX.utils.aoa_to_sheet(validData)
  wsValid['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsValid, 'Valid Values')

  // ── Sheet 4: Instructions ─────────────────────────────────────
  const instructions = [
    ['GUPTA FAMILY FINANCE — MASTER DATA UPLOAD TEMPLATE'],
    [''],
    ['WHAT THIS FILE COVERS:'],
    ['• Sheet 1 (Personal Details): PAN, Aadhaar, DOB, mobile, email, address, nominee for each family member'],
    ['• Sheet 2 (Bank Accounts): All bank accounts with account numbers, IFSC, UPI IDs, net banking IDs'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill data in "Personal Details" and "Bank Accounts" sheets.'],
    ['2. Do NOT change column headers (Row 1).'],
    ['3. Columns marked * are mandatory.'],
    ['4. Use exact family member names from the "Valid Values" sheet.'],
    ['5. Aadhaar: Enter 12 digits only, no spaces or dashes.'],
    ['6. PAN: 10 characters in AAAAA9999A format.'],
    ['7. Mobile: 10 digits only, no country code or spaces.'],
    ['8. UPI IDs: If multiple, separate with commas (e.g. "name@oksbi, name@ybl")'],
    ['9. Uploading a fresh file REPLACES all existing personal and bank data for included members.'],
    [''],
    ['ALTERNATIVELY — FREE FLOW UPLOAD:'],
    ['Instead of this template, you can also upload:'],
    ['• PDF: Bank statement, Aadhaar PDF, PAN card PDF, passbook PDF'],
    ['• Word/DOC: Any document containing the above details'],
    ['• Image (JPG/PNG): PAN card photo, Aadhaar card photo, bank passbook photo'],
    ['  → The system will auto-extract PAN, Aadhaar, mobile, IFSC, account numbers, UPI IDs'],
    ['  → You will get a review screen to confirm before saving'],
    [''],
    ['IMPORTANT — SECURITY NOTE:'],
    ['This data is stored in your private Supabase database only.'],
    ['PAN and Aadhaar are sensitive — ensure your Supabase project is secured.'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions)
  wsInstr['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Gupta_Family_Master_Data_Template.xlsx"',
    },
  })
}

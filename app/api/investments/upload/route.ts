import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Map display names → DB member IDs
async function getMemberMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from('family_members').select('id, full_name')
  const map: Record<string, string> = {}
  for (const m of data || []) map[m.full_name.trim().toLowerCase()] = m.id
  return map
}

function parseDate(val: any): string | null {
  if (!val) return null
  // Handle Excel serial date number
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
  }
  // Handle DD/MM/YYYY string
  const str = String(val).trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/')
    return `${y}-${m}-${d}`
  }
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

function parseNum(val: any): number | null {
  if (val === '' || val === undefined || val === null) return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function parseYesNo(val: any): boolean {
  if (!val) return true
  return String(val).trim().toLowerCase() !== 'no'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })

    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('investment data')) || wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (rows.length < 2) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
    }

    const memberMap = await getMemberMap()

    const investments: any[] = []
    const errors: string[] = []
    const affectedMemberIds = new Set<string>()

    // Skip header row (row 0), process from row 1
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      // Skip empty rows
      if (!r[0] && !r[2]) continue

      const rowNum = i + 1
      const memberName = String(r[0] || '').trim().toLowerCase()
      const memberId = memberMap[memberName]

      if (!memberId) {
        errors.push(`Row ${rowNum}: Unknown family member "${r[0]}" — must be one of: ${Object.keys(memberMap).map(k => k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ')}`)
        continue
      }

      const principalAmount = parseNum(r[6])
      if (!principalAmount) {
        errors.push(`Row ${rowNum}: Principal Amount is required`)
        continue
      }

      const institutionName = String(r[2] || '').trim()
      if (!institutionName) {
        errors.push(`Row ${rowNum}: Institution name is required`)
        continue
      }

      affectedMemberIds.add(memberId)

      investments.push({
        member_id: memberId,
        investment_type: String(r[1] || 'Other').trim(),
        institution_name: institutionName,
        post_office_branch: String(r[3] || '').trim() || null,
        certificate_number: String(r[4] || '').trim() || null,
        account_number: String(r[5] || '').trim() || null,
        principal_amount: principalAmount,
        current_value: parseNum(r[7]),
        interest_rate: parseNum(r[8]),
        interest_credit_frequency: String(r[9] || 'On Maturity').trim() || 'On Maturity',
        cumulative: parseYesNo(r[10]),
        start_date: parseDate(r[11]),
        maturity_date: parseDate(r[12]),
        next_interest_date: parseDate(r[13]),
        tenure_months: parseNum(r[14]) ? Math.round(parseNum(r[14])!) : null,
        expected_maturity_amount: parseNum(r[15]),
        nominee: String(r[16] || '').trim() || null,
        notes: String(r[17] || '').trim() || null,
        is_active: true,
        deposit_receipt_number: null,
      })
    }

    if (investments.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. ' + errors.join('; ') }, { status: 400 })
    }

    // Supersede: soft-delete existing investments for affected members
    if (affectedMemberIds.size > 0) {
      await supabase
        .from('investments')
        .update({ is_active: false })
        .in('member_id', Array.from(affectedMemberIds))
        .eq('is_active', true)
    }

    // Insert all new investments
    const { error: insertError } = await supabase.from('investments').insert(investments)
    if (insertError) {
      return NextResponse.json({ error: 'Database error: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inserted: investments.length,
      membersAffected: affectedMemberIds.size,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${investments.length} investments across ${affectedMemberIds.size} family member(s).${errors.length > 0 ? ` ${errors.length} rows were skipped.` : ''}`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getMemberMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from('family_members').select('id, full_name')
  const map: Record<string, string> = {}
  for (const m of data || []) map[m.full_name.trim().toLowerCase()] = m.id
  return map
}

function parseDate(val: any): string | null {
  if (!val) return null
  const str = String(val).trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) { const [d, m, y] = str.split('/'); return `${y}-${m}-${d}` }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const memberMap = await getMemberMap()

    let personalUpdated = 0, bankInserted = 0
    const errors: string[] = []
    const affectedMemberIds = new Set<string>()

    // ── Sheet 1: Personal Details ─────────────────────────────
    const personalSheet = wb.Sheets['Personal Details'] || wb.Sheets[wb.SheetNames[0]]
    const personalRows: any[][] = XLSX.utils.sheet_to_json(personalSheet, { header: 1, defval: '' })

    for (let i = 1; i < personalRows.length; i++) {
      const r = personalRows[i]
      if (!r[0]) continue
      const memberId = memberMap[String(r[0]).trim().toLowerCase()]
      if (!memberId) { errors.push(`Personal row ${i+1}: Unknown member "${r[0]}"`); continue }

      affectedMemberIds.add(memberId)
      const { error } = await supabase.from('family_members').update({
        pan_number: String(r[1] || '').trim().toUpperCase() || null,
        aadhaar_number: String(r[2] || '').replace(/\s/g, '') || null,
        date_of_birth: parseDate(r[3]),
        phone: String(r[4] || '').trim() || null,
        email: String(r[5] || '').trim().toLowerCase() || null,
        occupation: String(r[6] || '').trim() || null,
        address: String(r[7] || '').trim() || null,
        nominee_name: String(r[8] || '').trim() || null,
        nominee_relation: String(r[9] || '').trim() || null,
        notes: String(r[10] || '').trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', memberId)

      if (error) errors.push(`Personal row ${i+1}: ${error.message}`)
      else personalUpdated++
    }

    // ── Sheet 2: Bank Accounts ────────────────────────────────
    const bankSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('bank')) || wb.SheetNames[1]
    const bankSheet = wb.Sheets[bankSheetName]
    if (bankSheet) {
      const bankRows: any[][] = XLSX.utils.sheet_to_json(bankSheet, { header: 1, defval: '' })
      const bankMemberIds = new Set<string>()

      // Collect affected member IDs first for cleanup
      for (let i = 1; i < bankRows.length; i++) {
        const r = bankRows[i]
        if (!r[0] || !r[1]) continue
        const mid = memberMap[String(r[0]).trim().toLowerCase()]
        if (mid) bankMemberIds.add(mid)
      }

      // Soft-delete existing bank accounts for affected members
      if (bankMemberIds.size > 0) {
        await supabase.from('bank_accounts').update({ is_active: false }).in('member_id', Array.from(bankMemberIds)).eq('is_active', true)
      }

      for (let i = 1; i < bankRows.length; i++) {
        const r = bankRows[i]
        if (!r[0] || !r[1] || !r[2]) continue
        const memberId = memberMap[String(r[0]).trim().toLowerCase()]
        if (!memberId) { errors.push(`Bank row ${i+1}: Unknown member "${r[0]}"`); continue }

        const upiRaw = String(r[9] || '').trim()
        const primaryUpi = upiRaw.split(',')[0].trim() || null

        const { error } = await supabase.from('bank_accounts').insert({
          member_id: memberId,
          bank_name: String(r[1] || '').trim(),
          account_number: String(r[2] || '').trim(),
          account_type: String(r[3] || 'Savings').trim(),
          ifsc_code: String(r[4] || '').trim().toUpperCase() || null,
          cif_number: String(r[5] || '').trim() || null,
          registered_mobile: String(r[6] || '').trim() || null,
          linked_mobile: String(r[6] || '').trim() || null,
          registered_email: String(r[7] || '').trim().toLowerCase() || null,
          linked_email: String(r[7] || '').trim().toLowerCase() || null,
          net_banking_user_id: String(r[8] || '').trim() || null,
          upi_id: primaryUpi,
          nominee: String(r[10] || '').trim() || null,
          joint_holder: String(r[11] || '').trim() || null,
          minimum_balance: parseFloat(String(r[12] || '0')) || 0,
          balance: parseFloat(String(r[13] || '0')) || 0,
          notes: String(r[14] || '').trim() || null,
          is_active: true,
        })

        if (error) errors.push(`Bank row ${i+1}: ${error.message}`)
        else bankInserted++
      }
    }

    return NextResponse.json({
      success: true,
      personalUpdated,
      bankInserted,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${personalUpdated} member profile(s) and imported ${bankInserted} bank account(s).`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

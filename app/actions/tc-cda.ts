'use server'

import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCommissionsForCycles } from '@/app/actions/tc-commissions'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Commission disbursement advice PDF on the cycle. */
export async function generateCommissionCda(
  cycleId: string,
  propertyKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role) return { ok: false, error: 'Not authorized' }

  const sb = getServiceSupabase()
  const { data: cycle } = await sb
    .from('tc_cycles')
    .select('id, deal_id, sale_price, office_gross, tc_deals(address)')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { ok: false, error: 'Cycle not found' }
  const rows = await getCommissionsForCycles([cycleId])
  const address = (cycle as { tc_deals?: { address?: string } }).tc_deals?.address ?? 'Deal'

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let y = 740
  const line = (text: string, f = font, size = 11) => {
    page.drawText(text, { x: 48, y, size, font: f, color: rgb(0.1, 0.12, 0.16) })
    y -= size + 8
  }
  line('Commission disbursement advice', bold, 16)
  line(address, bold, 12)
  line(`Sale ${money(cycle.sale_price as number | null)} · Office gross ${money(cycle.office_gross as number | null)}`)
  line(`Prepared ${new Date().toISOString().slice(0, 10)} by ${email}`, font, 9)
  y -= 8
  if (!rows.length) line('No commission rows on this cycle.')
  for (const r of rows) {
    line(`${r.broker_name} · ${r.side} · ${r.status}`, bold, 11)
    line(
      `GCI ${money(r.gci)} · split ${r.split_percent}% · agent ${money(r.agent_net)} · office ${money(r.brokerage_net)}`,
    )
    if (r.referral_fee) line(`Referral ${money(r.referral_fee)}`)
    y -= 4
  }
  const bytes = Buffer.from(await pdf.save())
  const path = `cda/${cycleId}/cda-${Date.now()}.pdf`
  const up = await sb.storage.from('tc-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
  if (up.error) return { ok: false, error: up.error.message }
  const { error: docErr } = await sb.from('tc_documents').insert({
    cycle_id: cycleId,
    name: 'Commission disbursement advice',
    storage_path: path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
    content_type: 'application/pdf',
    page_count: 1,
    classification: { source: 'cda' },
  })
  if (docErr) return { ok: false, error: docErr.message }
  await sb.from('tc_events').insert({
    deal_id: cycle.deal_id,
    cycle_id: cycleId,
    actor: email,
    action: 'cda_generated',
    detail: { payees: rows.length },
  })
  revalidatePath(`/admin/deals/${propertyKey}`)
  return { ok: true }
}

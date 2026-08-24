'use server'

import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getCommissionsForCycles, updateTcCommission } from '@/app/actions/tc-commissions'
import { getCycleForCda } from '@/lib/data/tc/listing-action-reads'
import { inboundReferralFeePctForDeal } from '@/lib/data/tc/deal-people'
import { partyNamesFromJson } from '@/lib/tc/listing-actions'
import { prefillReferralFee } from '@/lib/tc/property-facts'

function getServiceSupabase() {
  return createServiceClient()
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

  const cycle = await getCycleForCda(cycleId)
  if (!cycle) return { ok: false, error: 'Cycle not found' }
  let rows = await getCommissionsForCycles([cycleId])
  const feePct = await inboundReferralFeePctForDeal(String(cycle.deal_id ?? ''))
  if (feePct != null) {
    for (const r of rows) {
      const dollars = prefillReferralFee(r.referral_fee, r.gci, feePct)
      if (dollars == null) continue
      await updateTcCommission(r.id, { referral_fee: dollars })
    }
    rows = await getCommissionsForCycles([cycleId])
  }
  const address = cycle.address
  const sb = getServiceSupabase()

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
  if (cycle.mls_number) line(`MLS ${cycle.mls_number}`)
  if (cycle.escrow_number) line(`Escrow ${cycle.escrow_number}`)
  if (cycle.escrow_closing_date) line(`Close ${String(cycle.escrow_closing_date).slice(0, 10)}`)
  const sellers = partyNamesFromJson(cycle.sellers)
  const buyers = partyNamesFromJson(cycle.buyers)
  if (sellers.length) line(`Sellers ${sellers.join(', ')}`)
  if (buyers.length) line(`Buyers ${buyers.join(', ')}`)
  const gciPct =
    cycle.commission_percent != null && Number.isFinite(cycle.commission_percent)
      ? `${cycle.commission_percent}%`
      : '—'
  line(
    `Sale ${money(cycle.sale_price)} · List ${money(cycle.listing_price)} · GCI ${gciPct} · Office gross ${money(cycle.office_gross)}`,
  )
  line(`Prepared ${new Date().toISOString().slice(0, 10)} by ${email}`, font, 9)
  line('Figures trace to settlement records retained per OAR 863-015-0250.', font, 8)
  y -= 8
  if (!rows.length) line('No commission rows on this cycle.')
  for (const r of rows) {
    line(`${r.broker_name} · ${r.side} · ${r.status}`, bold, 11)
    line(
      `GCI ${money(r.gci)} · split ${r.split_percent}% · agent ${money(r.agent_net)} · office ${money(r.brokerage_net)}`,
    )
    if (r.referral_fee) {
      line(`Referral ${money(r.referral_fee)}`)
      line('Referral payee W-9 must be on file before disbursement.', font, 8)
    }
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

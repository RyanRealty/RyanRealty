'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createEnvelopeFromTemplate } from '@/app/actions/tc-envelopes'
import { getCycleDealId } from '@/lib/data/tc/oref-packet-reads'
import { findFormVersionIdByNumber } from '@/lib/data/tc/form-library-reads'

function getServiceSupabase() {
  return createServiceClient()
}

function monthsBetween(a: string, b: string): number {
  const s = Date.parse(a)
  const e = Date.parse(b)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 99
  return (e - s) / (1000 * 60 * 60 * 24 * 30.4375)
}

export async function saveBuyerAgreementDraft(input: {
  cycleId: string
  propertyKey: string
  license: string
  supervisingPb: string
  termStart: string
  termEnd: string
  duties: string
  searchCriteria: string
  priceRange: string
  compensation: string
  termination: string
  exclusive: boolean
}): Promise<{ ok: boolean; error?: string; envelopeId?: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role) return { ok: false, error: 'Not authorized' }
  if (!input.license.trim() || !input.supervisingPb.trim() || !input.termStart || !input.termEnd) {
    return { ok: false, error: 'License, supervising broker, and term dates are required.' }
  }
  if (monthsBetween(input.termStart, input.termEnd) > 24.05) {
    return { ok: false, error: 'Oregon caps the term at 24 months (OAR 863-015-0133).' }
  }
  const dealId = await getCycleDealId(input.cycleId)
  if (!dealId) return { ok: false, error: 'Cycle not found' }
  const sb = getServiceSupabase()
  const contents = {
    license: input.license.trim(),
    supervisingPb: input.supervisingPb.trim(),
    termStart: input.termStart,
    termEnd: input.termEnd,
    duties: input.duties.trim(),
    searchCriteria: input.searchCriteria.trim(),
    priceRange: input.priceRange.trim(),
    compensation: input.compensation.trim(),
    termination: input.termination.trim(),
    exclusive: input.exclusive,
    rule: 'OAR 863-015-0133',
  }
  await sb.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: input.cycleId,
    actor: email,
    action: 'buyer_agreement_drafted',
    detail: contents,
  })

  const formNumber = input.exclusive ? '050' : '052'
  const formVersionId = await findFormVersionIdByNumber(formNumber)
  let envelopeId: string | undefined
  if (formVersionId) {
    const env = await createEnvelopeFromTemplate(input.cycleId, [formVersionId], `Buyer representation ${formNumber}`)
    if (env.ok) envelopeId = env.envelopeId
  }
  revalidatePath(`/admin/deals/${input.propertyKey}`)
  return { ok: true, envelopeId }
}

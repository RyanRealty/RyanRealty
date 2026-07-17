'use server'

/**
 * One-tap CMA kick-off from the person page (admin-rebuild v2, D8 litmus).
 *
 * Auth in-body (§4.4): getCrmAccess + requirePersonInScope — this is an
 * independently-invocable POST regardless of the layout gate. The idempotency
 * + dedupe contract lives in lib/crm/cma-kickoff.ts (integration-tested).
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { kickoffCmaCore, type CmaKickoffResult } from '@/lib/crm/cma-kickoff'

export async function kickoffCmaForContactAction(input: {
  personId: number
  address: string
  idempotencyKey: string
}): Promise<CmaKickoffResult> {
  try {
    const personId = Number(input?.personId)
    if (!Number.isFinite(personId) || personId <= 0) {
      return { ok: false, error: 'A valid contact id is required.' }
    }
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    const scoped = await requirePersonInScope(personId, access)
    if (!scoped.ok) return { ok: false, error: scoped.error }

    const result = await kickoffCmaCore({
      personId,
      address: String(input?.address ?? ''),
      idempotencyKey: String(input?.idempotencyKey ?? ''),
      actorBroker: access.brokerSlug ?? null,
    })
    if (result.ok) {
      revalidatePath(`/admin/crm/${personId}`)
      revalidatePath('/admin/cmas')
    }
    return result
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error kicking off the CMA' }
  }
}

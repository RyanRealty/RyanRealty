'use server'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

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
import { isCmaClientIntent } from '@/lib/cma/client-intent'
import { parsePositiveInt, parsePositiveNumber } from '@/lib/cma/client-link'

export async function kickoffCmaForContactAction(input: {
  personId: number
  address: string
  idempotencyKey: string
  beds?: number | string | null
  baths?: number | string | null
  sqft?: number | string | null
  intent?: string | null
  /** Explicit "build a fresh CMA" confirmation from the sheet (Matt decision
   *  2026-07-17) — see kickoffCmaCore. */
  buildNewVersion?: boolean
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
      buildNewVersion: Boolean(input?.buildNewVersion),
      beds: parsePositiveInt(input?.beds ?? null),
      baths: parsePositiveNumber(input?.baths ?? null),
      sqft: parsePositiveInt(input?.sqft ?? null),
      intent: isCmaClientIntent(input?.intent) ? input.intent : null,
    })
    if (result.ok) {
      revalidatePerson(personId)
      revalidatePath('/admin/cmas')
    }
    return result
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unexpected error kicking off the CMA' }
  }
}

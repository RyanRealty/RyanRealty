import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmSequenceForEdit — the single-sequence reader the step builder needs.
 *
 * listCrmSequences (app/actions/crm.ts) intentionally selects a lean column set
 * for the list and does NOT include `description`. The builder needs description
 * for a clean round-trip (edit must not blank a stored description on save). This
 * focused reader returns exactly the editable identity + steps for one sequence.
 *
 * DAL boundary (G1): the raw .from('crm_sequences') read lives here in lib/data/.
 * Not cached — the builder is force-dynamic and edits invalidate immediately;
 * a stale description on the edit form would be a worse failure than one extra
 * read per page open.
 *
 * Returns null when the sequence does not exist (the page renders notFound()).
 */

export type CrmSequenceEditRow = {
  id: number
  name: string
  description: string | null
  status: string
  stopOnReply: boolean
  fubLegacyPlanId: number | null
  steps: unknown[]
  /** v2: sequence-level triggers array. Empty = manual-enroll-only. */
  triggers: unknown[]
}

export async function getCrmSequenceForEdit(id: number): Promise<CrmSequenceEditRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_sequences')
    .select('id,name,description,status,stop_on_reply,fub_legacy_plan_id,steps,triggers')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[getCrmSequenceForEdit]', error.message)
    return null
  }
  return {
    id: Number(data.id),
    name: String(data.name),
    description: data.description ?? null,
    status: String(data.status),
    stopOnReply: data.stop_on_reply !== false,
    fubLegacyPlanId: data.fub_legacy_plan_id == null ? null : Number(data.fub_legacy_plan_id),
    steps: Array.isArray(data.steps) ? (data.steps as unknown[]) : [],
    triggers: Array.isArray(data.triggers) ? (data.triggers as unknown[]) : [],
  }
}

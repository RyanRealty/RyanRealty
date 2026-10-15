import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_STAGES } from '@/lib/crm/constants'
import { decideSarahStage } from '@/lib/sarah/intent-flow'

/**
 * Apply a Sarah-proposed CRM stage when that is not a downgrade.
 * Existing stages only. Frozen pipeline stages stay put.
 */
export async function applySarahPersonStage(
  personId: number,
  proposed: string,
): Promise<string | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null
  if (!(CRM_STAGES as readonly string[]).includes(proposed)) return null
  const sb = createServiceClient()
  const { data, error } = await sb.from('crm_people').select('stage').eq('id', personId).maybeSingle()
  if (error) {
    console.warn('[applySarahPersonStage] read failed:', error.message)
    return null
  }
  const current = typeof data?.stage === 'string' ? data.stage : null
  const next = decideSarahStage(current, proposed)
  if (!next) return current
  const { error: updateError } = await sb
    .from('crm_people')
    .update({ stage: next, updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (updateError) {
    console.warn('[applySarahPersonStage] update failed:', updateError.message)
    return current
  }
  const { error: noteError } = await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'stage_change',
    title: `Stage set by Sarah: ${next}`,
    body: current ? `From ${current} to ${next}. Captured by Sarah.` : `Set to ${next}. Captured by Sarah.`,
    payload: { from: current, to: next, by: 'Sarah' },
    source: 'sarah-chat',
  })
  if (noteError) console.warn('[applySarahPersonStage] note failed:', noteError.message)
  return next
}

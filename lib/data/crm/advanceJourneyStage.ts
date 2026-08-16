import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import {
  nextStageOnTrigger,
  type JourneyAdvanceTrigger,
} from '@/lib/crm/journey-advance'

/**
 * advanceJourneyStage — the DAL write for named Lead → Nurture advances.
 *
 * Callers: auto/manual enroll (sequence-enroll) and first governed outbound
 * (first-outbound). Never used to backfill the historical book.
 *
 * DAL boundary (G1): the raw .from() lives here.
 */

export type AdvanceJourneyResult = {
  advanced: boolean
  from: string | null
  to: string | null
  error: string | null
}

export async function advanceJourneyStage(input: {
  personId: number
  trigger: JourneyAdvanceTrigger
}): Promise<AdvanceJourneyResult> {
  if (!Number.isFinite(input.personId) || input.personId <= 0) {
    return { advanced: false, from: null, to: null, error: 'invalid personId' }
  }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id,stage')
    .eq('id', input.personId)
    .maybeSingle()
  if (error) {
    console.error('[advanceJourneyStage]', error.message)
    return { advanced: false, from: null, to: null, error: error.message }
  }
  const from = (data?.stage as string | null) ?? null
  const to = nextStageOnTrigger(from, input.trigger)
  if (!to) return { advanced: false, from, to: null, error: null }

  const { error: upErr } = await sb
    .from('crm_people')
    .update({ stage: to, updated_at: new Date().toISOString() })
    .eq('id', input.personId)
    .eq('stage', from)
  if (upErr) {
    console.error('[advanceJourneyStage] update', upErr.message)
    return { advanced: false, from, to, error: upErr.message }
  }

  const { error: tlErr } = await sb.from('crm_timeline').insert({
    person_id: input.personId,
    kind: 'stage_change',
    title: `Stage: ${from} → ${to}`,
    source: input.trigger,
  })
  if (tlErr) console.error('[advanceJourneyStage] timeline', tlErr.message)
  return { advanced: true, from, to, error: null }
}

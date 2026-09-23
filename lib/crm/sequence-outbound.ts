/**
 * Sequence-engine outbound chokepoint (G3).
 *
 * After a real email/SMS send the engine must (1) write the timeline row and
 * (2) advance Lead → Nurture on the named first-outbound trigger. Both live here
 * so the cron route does not grow past the file-size ratchet.
 *
 * A drip send is NOT the broker's first action (SITE-09, Matt 2026-09-07;
 * FUNNEL-5 / TRACK-8, 2026-09-23). This helper used to call
 * stampFirstBrokerActionIfEmpty, which advances the stage AND writes
 * custom.first_broker_action_at, so the drip email seven minutes after a submit
 * became "the broker's first touch" on 37 of the 143 stamped people (read
 * 2026-09-23T02:48Z) and the
 * oversight speed-to-lead read minutes nobody spent. It now makes the G3 stage
 * advance directly and leaves the stamp to a person (the governed send rails and
 * the isHumanTouch backfill).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export async function recordSequenceOutbound(
  sb: SupabaseClient,
  input: {
    personId: number
    kind: 'email_out' | 'sms_out'
    title: string
    body: string
    payload: Record<string, unknown>
    broker: string
    dedupeKey: string
  },
): Promise<void> {
  await sb.from('crm_timeline').insert({
    person_id: input.personId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    payload: input.payload,
    broker: input.broker,
    source: 'sequence',
    dedupe_key: input.dedupeKey,
  })
  // G3 first-outbound: no-op when the person is already past Lead (an
  // enrollment has usually advanced them on sequence-enroll already).
  try {
    const { advanceJourneyStage } = await import('@/lib/data/crm/advanceJourneyStage')
    await advanceJourneyStage({ personId: input.personId, trigger: 'first-outbound' })
  } catch (e) {
    console.warn('[recordSequenceOutbound] journey advance failed:', e)
  }
}

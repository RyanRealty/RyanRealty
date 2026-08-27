import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { withIdempotency } from '@/lib/crm/idempotency'
import { createNativeTask } from '@/lib/data/crm/ensureNativeLead'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * A human replied. Do the four things that were never happening.
 *
 * WHY THIS EXISTS. Measured 2026-08-26 over 90 days: 1,157 outbound touches
 * produced 13 stage moves, none of them toward a client — while the reply rate
 * was 21.3%. One person in five was answering and nothing downstream could see
 * it. The `Engaged` rung of the ladder had ZERO people on it; everyone sat in
 * Nurture until they somehow became one of 12 Active Clients.
 *
 * Matt's rule (2026-08-26): a two-way conversation IS engagement. So a reply
 * advances the stage, tasks the broker, stops the automation, and tells him.
 *
 * EVERY STEP IS NON-BLOCKING AND INDEPENDENT. This runs inside the Twilio
 * webhook. A failure here must never lose the inbound message — recording the
 * reply already happened before we are called, and each step below is wrapped
 * so one failure cannot take the others down with it.
 */

/**
 * Only these advance. Someone already an Active Client, Past Client or in the
 * Sphere is not "newly engaged" by answering a text, and Trash stays Trash —
 * a reply from a contact you binned should not resurrect them into the funnel.
 */
const ADVANCEABLE_STAGES = new Set(['lead', 'nurture'])
const ENGAGED = 'Engaged'

/**
 * Alerts and tasks dedupe inside this window so a live back-and-forth produces
 * one task, not one per message. A genuinely new conversation tomorrow still
 * reaches him.
 */
const DEDUPE_WINDOW_HOURS = 4

export type InboundReplyInput = {
  personId: number
  /** The broker who owns this contact; falls back to the default desk. */
  broker?: string | null
  channel: 'sms' | 'email' | 'call'
  /** First line of what they said, for the alert body. Never PII beyond the message. */
  preview?: string | null
}

export type InboundReplyOutcome = {
  advanced: boolean
  fromStage: string | null
  paused: number
  tasked: boolean
  alerted: boolean
  errors: string[]
}

function brokerSlug(broker: string | null | undefined): CrmBrokerSlug {
  const b = String(broker ?? '').trim().toLowerCase()
  return (CRM_BROKERS as readonly string[]).includes(b) ? (b as CrmBrokerSlug) : 'matt'
}

export async function handleInboundReply(input: InboundReplyInput): Promise<InboundReplyOutcome> {
  const out: InboundReplyOutcome = {
    advanced: false,
    fromStage: null,
    paused: 0,
    tasked: false,
    alerted: false,
    errors: [],
  }
  if (!Number.isFinite(input.personId) || input.personId <= 0) return out

  const sb = createServiceClient()
  const slug = brokerSlug(input.broker)

  // 1. ADVANCE THE STAGE. A conversation is engagement.
  try {
    const { data: person, error } = await sb
      .from('crm_people')
      .select('id,stage,first_name,last_name,name')
      .eq('id', input.personId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const stage = (person?.stage ?? '').trim()
    out.fromStage = stage || null
    if (person && ADVANCEABLE_STAGES.has(stage.toLowerCase())) {
      const { error: upErr } = await sb
        .from('crm_people')
        .update({ stage: ENGAGED, updated_at: new Date().toISOString() })
        .eq('id', input.personId)
      if (upErr) throw new Error(upErr.message)
      await sb.from('crm_timeline').insert({
        person_id: input.personId,
        kind: 'stage_change',
        title: `Stage: ${stage} → ${ENGAGED}`,
        source: 'inbound-reply',
        // Structured as well as in the title, so the funnel report never has to
        // parse prose it does not control.
        payload: { from: stage, to: ENGAGED, via: input.channel },
      })
      out.advanced = true
    }
  } catch (e) {
    out.errors.push(`stage: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. STOP THE AUTOMATION, NOW. The sequence engine already pauses on reply,
  //    but only when the cron next reaches that enrollment — which can be after
  //    it has sent another automated message into a live conversation.
  try {
    const { data, error } = await sb
      .from('crm_sequence_enrollments')
      .update({ status: 'paused_reply' })
      .eq('person_id', input.personId)
      .eq('status', 'running')
      .select('id')
    if (error) throw new Error(error.message)
    out.paused = (data ?? []).length
  } catch (e) {
    out.errors.push(`pause: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3 + 4. TASK AND ALERT, deduped together so a burst of texts is one nudge.
  const bucket = Math.floor(Date.now() / (DEDUPE_WINDOW_HOURS * 3600_000))
  const key = `reply-nudge:${input.personId}:${bucket}`
  try {
    const done = await withIdempotency({ key, scope: 'inbound-reply' }, async () => {
      const nudge = { tasked: false, alerted: false }
      try {
        await createNativeTask({
          personId: input.personId,
          name: `Reply back — they answered your ${input.channel}`,
          type: 'call',
          dueInMinutes: 15,
          assignedBroker: slug,
        })
        nudge.tasked = true
      } catch { /* the alert below is the backstop */ }

      try {
        const said = (input.preview ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
        nudge.alerted = await queueBrokerAlert({
          broker: slug,
          personId: input.personId,
          kind: `reply:${input.channel}`,
          body: said
            ? `Replied by ${input.channel}: "${said}"`
            : `Replied by ${input.channel}.`,
        })
      } catch { /* the task above is the backstop */ }

      return nudge
    })
    out.tasked = done.tasked
    out.alerted = done.alerted
  } catch (e) {
    out.errors.push(`nudge: ${e instanceof Error ? e.message : String(e)}`)
  }

  return out
}

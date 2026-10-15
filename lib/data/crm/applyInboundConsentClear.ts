/**
 * Apply inbound DNC / no-SMS flag clear after a tracked-email recipient
 * reaches out (Matt 2026-10-14). Per docs/DATABASE_FOR_AI_AGENTS.md CRM
 * people + email_events + crm_suppressions: a prior `email_events.event='sent'`
 * row is the tracked-send gate; only phone DNC / no-SMS tags and suppressions
 * are lifted; broker flags and email unsubscribe stay; a timeline note records
 * what was cleared and why. Never sends SMS or email. Fail-soft.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { whereActiveSuppression } from '@/lib/crm/suppression-lifecycle'
import {
  inboundConsentDedupeKey,
  planInboundConsentClear,
  type InboundConsentEvent,
  type InboundConsentSuppression,
} from '@/lib/crm/inbound-consent-clear'

export type ApplyInboundConsentClearResult = {
  ok: boolean
  applied: boolean
  personId: number
  skipped: 'invalid' | 'stop-keyword' | 'no-tracked-send' | 'nothing-to-clear' | 'person-not-found' | null
  tagsRemoved: string[]
  suppressionsCleared: number
  cmaConsentReset: boolean
  timelineId: number | null
  reason?: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
}

function emailsFromPerson(emails: unknown): string[] {
  if (!Array.isArray(emails)) return []
  const out: string[] = []
  for (const item of emails) {
    const value =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && typeof (item as { value?: unknown }).value === 'string'
          ? (item as { value: string }).value
          : ''
    const norm = value.trim().toLowerCase()
    if (norm && !out.includes(norm)) out.push(norm)
  }
  return out
}

async function hasTrackedSend(
  sb: ReturnType<typeof createServiceClient>,
  personId: number,
  emails: string[],
): Promise<boolean> {
  const byPerson = await sb
    .from('email_events')
    .select('id')
    .eq('person_id', personId)
    .eq('event', 'sent')
    .limit(1)
    .maybeSingle()
  if (byPerson.error) throw new Error(byPerson.error.message)
  if (byPerson.data) return true
  if (emails.length === 0) return false
  const byEmail = await sb
    .from('email_events')
    .select('id')
    .in('recipient_email', emails)
    .eq('event', 'sent')
    .limit(1)
    .maybeSingle()
  if (byEmail.error) throw new Error(byEmail.error.message)
  return Boolean(byEmail.data)
}

export async function applyInboundConsentClear(params: {
  personId: number
  event: InboundConsentEvent
  eventId?: string | null
  smsBody?: string | null
  broker?: string | null
}): Promise<ApplyInboundConsentClearResult> {
  const personId = params.personId
  const empty = (skipped: ApplyInboundConsentClearResult['skipped'], reason?: string): ApplyInboundConsentClearResult => ({
    ok: true,
    applied: false,
    personId,
    skipped,
    tagsRemoved: [],
    suppressionsCleared: 0,
    cmaConsentReset: false,
    timelineId: null,
    reason,
  })

  if (!Number.isInteger(personId) || personId <= 0) {
    return { ...empty('invalid'), ok: false, reason: 'invalid-person' }
  }

  try {
    const sb = createServiceClient()
    const { data: row, error } = await sb
      .from('crm_people')
      .select('id,tags,emails,custom,deleted')
      .eq('id', personId)
      .maybeSingle()
    if (error) return { ...empty(null), ok: false, reason: error.message }
    if (!row || row.deleted) return empty('person-not-found', 'person-not-found')

    const tags = asStringArray(row.tags)
    const emails = emailsFromPerson(row.emails)
    const tracked = await hasTrackedSend(sb, personId, emails)

    const { data: suppressionRows, error: supErr } = await whereActiveSuppression(
      sb.from('crm_suppressions').select('id,channel,reason').eq('person_id', personId),
    )
    if (supErr) return { ...empty(null), ok: false, reason: supErr.message }
    const suppressions: InboundConsentSuppression[] = (suppressionRows ?? [])
      .map((r) => ({
        id: Number(r.id),
        channel: String(r.channel ?? ''),
        reason: String(r.reason ?? ''),
      }))
      .filter((r) => Number.isInteger(r.id) && r.id > 0)

    const plan = planInboundConsentClear({
      event: params.event,
      smsBody: params.smsBody,
      hasTrackedSend: tracked,
      tags,
      suppressions,
      eventId: params.eventId,
      custom: row.custom,
    })

    if (plan.action === 'skip-stop') return empty('stop-keyword')
    if (plan.action === 'skip-no-send') return empty('no-tracked-send')
    if (plan.action !== 'clear') return empty('nothing-to-clear')

    if (plan.tagsToRemove.length > 0 || plan.cmaConsentReset) {
      const custom =
        row.custom && typeof row.custom === 'object' && !Array.isArray(row.custom)
          ? { ...(row.custom as Record<string, unknown>) }
          : {}
      if (plan.cmaConsentReset && plan.nextCmaConsent) custom.cmaConsent = plan.nextCmaConsent
      const { error: tagErr } = await sb
        .from('crm_people')
        .update({
          tags: plan.nextTags,
          custom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', personId)
      if (tagErr) return { ...empty(null), ok: false, reason: tagErr.message }
    }

    if (plan.suppressionIdsToClear.length > 0) {
      const { error: clearErr } = await whereActiveSuppression(
        sb
          .from('crm_suppressions')
          .update({
            cleared_at: new Date().toISOString(),
            cleared_by: `inbound-${params.event}`,
            cleared_reason: plan.noteBody,
          })
          .in('id', plan.suppressionIdsToClear),
      )
      if (clearErr) return { ...empty(null), ok: false, reason: clearErr.message }
    }

    const dedupeKey = inboundConsentDedupeKey({
      personId,
      event: params.event,
      eventId: params.eventId,
    })
    const { data: note, error: noteErr } = await sb
      .from('crm_timeline')
      .upsert(
        {
          person_id: personId,
          kind: 'system',
          title: plan.noteTitle,
          body: plan.noteBody,
          payload: {
            event: params.event,
            eventId: params.eventId ?? null,
            tagsRemoved: plan.tagsToRemove,
            suppressionsCleared: plan.suppressionIdsToClear.length,
            cmaConsentReset: plan.cmaConsentReset,
          },
          broker: params.broker ?? null,
          source: 'inbound-consent-clear',
          dedupe_key: dedupeKey,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle()
    if (noteErr) {
      console.warn('[applyInboundConsentClear] timeline note failed', noteErr.message)
    }

    return {
      ok: true,
      applied: true,
      personId,
      skipped: null,
      tagsRemoved: plan.tagsToRemove,
      suppressionsCleared: plan.suppressionIdsToClear.length,
      cmaConsentReset: plan.cmaConsentReset,
      timelineId: typeof note?.id === 'number' ? note.id : note?.id != null ? Number(note.id) : null,
    }
  } catch (err) {
    console.error('[applyInboundConsentClear]', err)
    return {
      ok: false,
      applied: false,
      personId,
      skipped: null,
      tagsRemoved: [],
      suppressionsCleared: 0,
      cmaConsentReset: false,
      timelineId: null,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

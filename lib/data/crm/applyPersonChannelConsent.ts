/**
 * Apply one admin SMS / email / call consent toggle on a CRM person.
 * Per docs/DATABASE_FOR_AI_AGENTS.md CRM people + crm_suppressions: writes
 * tags, `custom.cmaConsent`, and phone suppressions, then a timeline note.
 * TCPA STOP and CAN-SPAM unsubscribe refuse an allow. Never sends.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { addSuppression } from '@/lib/crm/suppressions'
import { whereActiveSuppression } from '@/lib/crm/suppression-lifecycle'
import {
  planPersonChannelConsentEdit,
  type ConsentChannel,
  type ConsentSuppression,
} from '@/lib/crm/person-channel-consent'

export type ApplyPersonChannelConsentResult = {
  ok: boolean
  applied: boolean
  personId: number
  skipped: 'invalid' | 'noop' | 'refuse' | 'person-not-found' | null
  channel: ConsentChannel | null
  allowed: boolean | null
  timelineId: number | null
  reason?: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
}

export async function applyPersonChannelConsent(params: {
  personId: number
  channel: ConsentChannel
  allowed: boolean
  broker?: string | null
}): Promise<ApplyPersonChannelConsentResult> {
  const personId = params.personId
  const empty = (
    skipped: ApplyPersonChannelConsentResult['skipped'],
    reason?: string,
  ): ApplyPersonChannelConsentResult => ({
    ok: skipped !== 'invalid',
    applied: false,
    personId,
    skipped,
    channel: params.channel,
    allowed: params.allowed,
    timelineId: null,
    reason,
  })

  if (!Number.isInteger(personId) || personId <= 0) {
    return { ...empty('invalid'), ok: false, reason: 'invalid-person' }
  }
  if (params.channel !== 'sms' && params.channel !== 'email' && params.channel !== 'call') {
    return { ...empty('invalid'), ok: false, reason: 'invalid-channel' }
  }

  try {
    const sb = createServiceClient()
    const { data: row, error } = await sb
      .from('crm_people')
      .select('id,tags,custom,deleted')
      .eq('id', personId)
      .maybeSingle()
    if (error) return { ...empty(null), ok: false, reason: error.message }
    if (!row || row.deleted) return empty('person-not-found', 'person-not-found')

    const { data: suppressionRows, error: supErr } = await whereActiveSuppression(
      sb.from('crm_suppressions').select('id,channel,reason').eq('person_id', personId),
    )
    if (supErr) return { ...empty(null), ok: false, reason: supErr.message }
    const suppressions: ConsentSuppression[] = (suppressionRows ?? []).map((r) => ({
      id: Number(r.id),
      channel: String(r.channel ?? ''),
      reason: String(r.reason ?? ''),
    }))

    const plan = planPersonChannelConsentEdit({
      channel: params.channel,
      allowed: params.allowed,
      tags: asStringArray(row.tags),
      custom: row.custom,
      suppressions,
    })

    if (plan.action === 'noop') return empty('noop')
    if (plan.action === 'refuse') return empty('refuse', plan.refuseReason)

    const custom =
      row.custom && typeof row.custom === 'object' && !Array.isArray(row.custom)
        ? { ...(row.custom as Record<string, unknown>) }
        : {}
    if (plan.nextCmaConsent) custom.cmaConsent = plan.nextCmaConsent

    const { error: updErr } = await sb
      .from('crm_people')
      .update({
        tags: plan.nextTags,
        custom,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId)
    if (updErr) return { ...empty(null), ok: false, reason: updErr.message }

    if (plan.suppressionIdsToClear.length > 0) {
      const { error: clearErr } = await whereActiveSuppression(
        sb
          .from('crm_suppressions')
          .update({
            cleared_at: new Date().toISOString(),
            cleared_by: 'admin-consent',
            cleared_reason: plan.noteBody,
          })
          .in('id', plan.suppressionIdsToClear),
      )
      if (clearErr) return { ...empty(null), ok: false, reason: clearErr.message }
    }

    if (plan.addSuppression) {
      await addSuppression({
        personId,
        channel: plan.addSuppression.channel,
        reason: plan.addSuppression.reason,
        source: 'admin-consent',
      })
    }

    const { data: note, error: noteErr } = await sb
      .from('crm_timeline')
      .insert({
        person_id: personId,
        kind: 'system',
        title: plan.noteTitle,
        body: plan.noteBody,
        payload: {
          channel: params.channel,
          allowed: params.allowed,
          source: 'admin-consent',
        },
        broker: params.broker ?? null,
        source: 'admin-consent',
        dedupe_key: `admin-consent:${params.channel}:${params.allowed ? 'on' : 'off'}:${Date.now()}:p${personId}`,
      })
      .select('id')
      .maybeSingle()
    if (noteErr) {
      console.warn('[applyPersonChannelConsent] timeline note failed', noteErr.message)
    }

    return {
      ok: true,
      applied: true,
      personId,
      skipped: null,
      channel: params.channel,
      allowed: params.allowed,
      timelineId: typeof note?.id === 'number' ? note.id : note?.id != null ? Number(note.id) : null,
    }
  } catch (err) {
    console.error('[applyPersonChannelConsent]', err)
    return {
      ok: false,
      applied: false,
      personId,
      skipped: null,
      channel: params.channel,
      allowed: params.allowed,
      timelineId: null,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

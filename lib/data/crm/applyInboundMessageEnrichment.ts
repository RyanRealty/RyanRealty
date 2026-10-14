/**
 * Apply inbound SMS / voicemail enrichment to a crm_people row.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md CRM people + timeline: writes first_name /
 * last_name / name (placeholder only), tags, optional source, timeframe,
 * neighborhood_slug, subdivision, custom.inbound_extract, and a timeline note.
 * Never sends SMS or email. Fail-soft: a thrown extract or write is logged
 * and returned as { ok: false }.
 */

import 'server-only'
import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { extractInboundLeadFacts } from '@/lib/crm/inbound-message-extract'
import {
  fallbackExtract,
  mergeExtract,
  planInboundEnrichment,
  type InboundChannel,
  type PersonSnapshot,
} from '@/lib/crm/inbound-message-enrich'

export type EnrichApplyResult = {
  ok: boolean
  applied: boolean
  personId: number
  reason?: string
  setName?: string | null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function inboundEnrichDedupeKey(input: {
  personId: number
  channel: InboundChannel
  messageSid?: string | null
  body: string
}): string {
  if (input.messageSid?.trim()) {
    return `inbound-enrich:${input.messageSid.trim()}:p${input.personId}`
  }
  const h = createHash('sha1').update(input.body).digest('hex').slice(0, 16)
  return `inbound-enrich:${input.channel}:${h}:p${input.personId}`
}

function snapshotFromRow(row: {
  name: string | null
  first_name: string | null
  last_name: string | null
  source: string | null
  tags: unknown
  stage: string | null
  custom: unknown
  timeframe: string | null
  neighborhood_slug: string | null
  subdivision: string | null
}): PersonSnapshot {
  return {
    name: row.name,
    first_name: row.first_name,
    last_name: row.last_name,
    source: row.source,
    tags: asStringArray(row.tags),
    stage: row.stage,
    custom: asRecord(row.custom),
    timeframe: row.timeframe,
    neighborhood_slug: row.neighborhood_slug,
    subdivision: row.subdivision,
  }
}

export async function applyInboundMessageEnrichment(params: {
  personId: number
  body: string
  channel: InboundChannel
  fromNumber?: string | null
  messageSid?: string | null
  broker?: string | null
}): Promise<EnrichApplyResult> {
  const personId = params.personId
  const body = (params.body ?? '').trim()
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, applied: false, personId, reason: 'invalid-person' }
  }

  try {
    const sb = createServiceClient()
    const { data: row, error } = await sb
      .from('crm_people')
      .select('id,name,first_name,last_name,source,tags,stage,custom,timeframe,neighborhood_slug,subdivision,deleted')
      .eq('id', personId)
      .maybeSingle()
    if (error) return { ok: false, applied: false, personId, reason: error.message }
    if (!row || row.deleted) return { ok: false, applied: false, personId, reason: 'person-not-found' }

    const model = await extractInboundLeadFacts({
      body,
      channel: params.channel,
      fromNumber: params.fromNumber,
    })
    const extract = mergeExtract(model, fallbackExtract({ body, fromNumber: params.fromNumber }))
    const person = snapshotFromRow(row)
    const plan = planInboundEnrichment({
      person,
      extract,
      body,
      channel: params.channel,
      fromNumber: params.fromNumber,
    })

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (plan.setName) {
      update.first_name = plan.setName.first || null
      update.last_name = plan.setName.last || null
      update.name = plan.setName.name
    }
    if (plan.source) update.source = plan.source
    if (plan.timeframe) update.timeframe = plan.timeframe
    if (plan.neighborhoodSlug) update.neighborhood_slug = plan.neighborhoodSlug
    if (plan.subdivision) update.subdivision = plan.subdivision
    if (plan.tagsToAdd.length) {
      update.tags = [...new Set([...person.tags, ...plan.tagsToAdd])]
    }
    if (Object.keys(plan.customPatch).length) {
      update.custom = { ...person.custom, ...plan.customPatch }
    }

    const personWrites =
      plan.setName ||
      plan.source ||
      plan.timeframe ||
      plan.neighborhoodSlug ||
      plan.subdivision ||
      plan.tagsToAdd.length ||
      Object.keys(plan.customPatch).length
    if (personWrites) {
      const { error: writeErr } = await sb.from('crm_people').update(update).eq('id', personId)
      if (writeErr) return { ok: false, applied: false, personId, reason: writeErr.message }
    }

    const dedupe = inboundEnrichDedupeKey({
      personId,
      channel: params.channel,
      messageSid: params.messageSid,
      body,
    })
    const { error: noteErr } = await sb.from('crm_timeline').upsert(
      {
        person_id: personId,
        kind: 'note',
        title: plan.noteTitle,
        body: plan.noteBody,
        payload: {
          channel: params.channel,
          extract,
          skipReason: plan.skipReason,
          messageSid: params.messageSid ?? null,
        },
        broker: params.broker ?? null,
        source: 'inbound-enrich',
        dedupe_key: dedupe,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    if (noteErr) {
      console.warn('[inbound-enrich] timeline note failed', noteErr.message)
    }

    return {
      ok: true,
      applied: true,
      personId,
      reason: plan.skipReason ?? undefined,
      setName: plan.setName?.name ?? null,
    }
  } catch (err) {
    console.warn('[inbound-enrich] apply failed (fail-soft)', err)
    return {
      ok: false,
      applied: false,
      personId,
      reason: err instanceof Error ? err.message : 'apply-failed',
    }
  }
}

/**
 * Replay the latest stored inbound SMS or voicemail body for one person.
 * Safe backfill: no Twilio webhook, no reply send.
 */
export async function replayInboundMessageEnrichment(personId: number): Promise<EnrichApplyResult> {
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, applied: false, personId, reason: 'invalid-person' }
  }
  try {
    const sb = createServiceClient()
    const { data: rows, error } = await sb
      .from('crm_timeline')
      .select('kind,body,payload,broker')
      .eq('person_id', personId)
      .in('kind', ['sms_in', 'voicemail'])
      .not('body', 'is', null)
      .order('ts', { ascending: false })
      .limit(8)
    if (error) return { ok: false, applied: false, personId, reason: error.message }
    const row = (rows ?? []).find((r) => String(r.body ?? '').trim().length > 0)
    if (!row) return { ok: false, applied: false, personId, reason: 'no-inbound-body' }
    const payload = asRecord(row.payload)
    const sid = typeof payload.sid === 'string' ? payload.sid : typeof payload.callSid === 'string' ? payload.callSid : null
    const fromNumber = typeof payload.fromNumber === 'string' ? payload.fromNumber : null
    return applyInboundMessageEnrichment({
      personId,
      body: String(row.body),
      channel: row.kind === 'voicemail' ? 'voicemail' : 'sms',
      fromNumber,
      messageSid: sid,
      broker: typeof row.broker === 'string' ? row.broker : null,
    })
  } catch (err) {
    console.warn('[inbound-enrich] replay failed (fail-soft)', err)
    return {
      ok: false,
      applied: false,
      personId,
      reason: err instanceof Error ? err.message : 'replay-failed',
    }
  }
}

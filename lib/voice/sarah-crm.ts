/**
 * After a Sarah call: concise CRM note, volunteered field updates, and stage
 * changes attributed "by Sarah". Never deletes. Never downgrades a stage Matt
 * set (broker-set-stage) or a locked pipeline stage — flags him instead.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_STAGES } from '@/lib/crm/constants'
import type { Qualification } from '@/lib/voice/receptionist-log'

export const SARAH_AUDIT = 'by Sarah' as const
export const SARAH_SOURCE = 'sarah' as const

const BROKER_LOCKED_STAGES = new Set([
  'Active Client',
  'Pending',
  'Past Client',
  'Closed',
  'Archive',
  'Trash',
  'Sphere',
  'Real Estate Agent',
  'Vendor',
])

export type SarahCrmPlan = {
  noteBody: string
  tagsToAdd: string[]
  name?: string
  timeframe?: string
  price?: number
  area?: string
  stageTo?: string | null
  flagBroker: boolean
  flagReason: string | null
}

export function intentTags(intent: string): string[] {
  const t = intent.toLowerCase()
  const tags: string[] = []
  const buy = /\bbuy/.test(t)
  const sell = /\bsell/.test(t)
  if (buy) tags.push('segment:buyer')
  if (sell) tags.push('segment:seller')
  if (/\bboth\b/.test(t) || (buy && sell)) {
    if (!tags.includes('segment:buyer')) tags.push('segment:buyer')
    if (!tags.includes('segment:seller')) tags.push('segment:seller')
  }
  if (/\b(has agent|their agent|already .{0,20}agent)\b/.test(t)) tags.push('has agent')
  return tags
}

export function parseBudget(raw: string): number | undefined {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|m)?/i)
  if (!m) return undefined
  let n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return undefined
  const suf = (m[2] ?? '').toLowerCase()
  if (suf === 'k') n *= 1000
  if (suf === 'm') n *= 1_000_000
  if (n < 1000) return undefined
  return Math.round(n)
}

export function planSarahCrmUpdate(input: {
  qualification: Qualification | null
  transcript: string
  currentStage: string | null
  lastStageSource: string | null
  currentName: string | null
}): SarahCrmPlan {
  const q = input.qualification
  const summary = (q?.summary ?? '').trim()
  const transcript = input.transcript.trim()
  const noteBody = [summary, transcript].filter(Boolean).join('\n\n').slice(0, 8000)
  const tagsToAdd = intentTags(q?.intent ?? '')
  if (/\bhas agent\b/i.test(transcript)) tagsToAdd.push('has agent')
  const tags = [...new Set(tagsToAdd)]

  const placeholder = !input.currentName || /^call lead\b/i.test(input.currentName) || /^\+?\d[\d\s().-]+$/.test(input.currentName)
  const volunteeredName = (q?.name ?? '').trim()
  const name = placeholder && volunteeredName && !/^(caller|unknown)$/i.test(volunteeredName) ? volunteeredName : undefined

  const timeframe = (q?.timing ?? '').trim() || undefined
  const area = (q?.area ?? '').trim() || undefined
  const price = q?.budget ? parseBudget(q.budget) : undefined

  const locked =
    input.lastStageSource === 'broker-set-stage' ||
    BROKER_LOCKED_STAGES.has(input.currentStage ?? '')
  const seller = tags.includes('segment:seller')
  let stageTo: string | null = null
  let flagBroker = false
  let flagReason: string | null = null
  if (locked && seller && input.currentStage !== 'Seller Prospect') {
    flagBroker = true
    flagReason = `Sarah heard a seller intent but did not change stage ${input.currentStage ?? '(none)'} (${SARAH_AUDIT})`
  } else if (!locked && seller && input.currentStage === 'Lead') {
    stageTo = 'Seller Prospect'
  }

  return { noteBody, tagsToAdd: tags, name, timeframe, price, area, stageTo, flagBroker, flagReason }
}

export async function applySarahCrmUpdate(opts: {
  personId: number
  broker: string
  callId: string
  plan: SarahCrmPlan
}): Promise<void> {
  const sb = createServiceClient()
  const { data: row } = await sb
    .from('crm_people')
    .select('stage,name,tags,custom,timeframe,price,neighborhood_slug')
    .eq('id', opts.personId)
    .maybeSingle()
  if (!row) return

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (opts.plan.name) update.name = opts.plan.name
  if (opts.plan.timeframe && !row.timeframe) update.timeframe = opts.plan.timeframe
  if (opts.plan.price && !row.price) update.price = opts.plan.price
  const tags = [...new Set([...(Array.isArray(row.tags) ? row.tags : []), ...opts.plan.tagsToAdd])]
  if (tags.length) update.tags = tags
  const custom = { ...((row.custom as Record<string, unknown> | null) ?? {}) }
  if (opts.plan.area) custom.sarah_area = opts.plan.area
  custom.sarah_last_call_id = opts.callId
  update.custom = custom

  const nextStage = opts.plan.stageTo
  if (nextStage && (CRM_STAGES as readonly string[]).includes(nextStage) && row.stage !== nextStage) {
    update.stage = nextStage
  }

  await sb.from('crm_people').update(update).eq('id', opts.personId)

  const payload = { by: 'Sarah', callId: opts.callId, source: SARAH_SOURCE }
  if (opts.plan.noteBody) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: opts.personId,
        kind: 'note',
        title: `Call notes ${SARAH_AUDIT}`,
        body: opts.plan.noteBody,
        payload,
        broker: opts.broker,
        source: SARAH_SOURCE,
        dedupe_key: `sarah:note:${opts.callId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  }
  if (nextStage && row.stage !== nextStage) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: opts.personId,
        kind: 'stage_change',
        title: `Stage: ${row.stage} → ${nextStage} ${SARAH_AUDIT}`,
        payload: { ...payload, from: row.stage, to: nextStage },
        broker: opts.broker,
        source: SARAH_SOURCE,
        dedupe_key: `sarah:stage:${opts.callId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  }
  if (opts.plan.flagBroker && opts.plan.flagReason) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: opts.personId,
        kind: 'note',
        title: `Stage hold ${SARAH_AUDIT}`,
        body: opts.plan.flagReason,
        payload,
        broker: opts.broker,
        source: SARAH_SOURCE,
        dedupe_key: `sarah:stage-hold:${opts.callId}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  }
}

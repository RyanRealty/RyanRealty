/**
 * Today inbound enricher — who / quote / next / draft for a reply row.
 * Lives in lib/data/crm/ (DAL). Pure compose + one fail-soft system-note read.
 */
import 'server-only'
import { composePersonNextStep, asReplyIntent } from '@/lib/crm/person-header-lines'
import { mapPersonWhoLabels, type PersonWhoLabel } from '@/lib/crm/person-who-labels'
import { deterministicReplyIntent } from '@/lib/crm/reply-intent'
import { composeTodayInboundDraft } from '@/lib/crm/today-inbound-draft'
import type { createServiceClient } from '@/lib/supabase/service'

type Sb = ReturnType<typeof createServiceClient>

export type PersonRow = { name: string | null; tags: string[]; stage: string | null }

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }
  return null
}

export const EMPTY_REPLY_FIELDS = {
  inboundBody: '',
  inboundChannel: null as 'sms' | 'email' | null,
  whoLabels: [] as PersonWhoLabel[],
  nextStep: '',
  draftSms: '',
}

export type ReplyIntel = { intent: ReturnType<typeof asReplyIntent>; recommendedReply: string }

const IN_CHUNK = 400

export async function fetchReplyIntel(
  sb: Sb,
  ids: number[],
  cutoffIso: string,
  safeRows: <T>(q: PromiseLike<{ data: unknown }>) => Promise<T[]>,
): Promise<Map<number, ReplyIntel>> {
  const out = new Map<number, ReplyIntel>()
  type SystemRow = { person_id: number; ts: string; payload: unknown }
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const rows = await safeRows<SystemRow>(
      sb
        .from('crm_timeline')
        .select('person_id,ts,payload')
        .eq('kind', 'system')
        .in('person_id', ids.slice(i, i + IN_CHUNK))
        .gte('ts', cutoffIso)
        .order('ts', { ascending: false })
        .limit(400),
    )
    for (const row of rows) {
      if (out.has(row.person_id)) continue
      const payload = payloadRecord(row.payload)
      if (!payload) continue
      const intent = asReplyIntent(payload.intent)
      const recommendedReply =
        typeof payload.recommendedReply === 'string' ? payload.recommendedReply : ''
      if (intent || recommendedReply) out.set(row.person_id, { intent, recommendedReply })
    }
  }
  return out
}

/** Pure: who / quote / next / draft for one unread inbound row. */
export function enrichReplyTriage(input: {
  inboundKind: string
  inboundBody: string | null
  inboundPayload: unknown
  personName: string | null
  tags: string[] | null
  stage: string | null
  classifiedIntent?: ReturnType<typeof asReplyIntent>
  classifiedReply?: string
}): {
  inboundBody: string
  inboundChannel: 'sms' | 'email'
  whoLabels: PersonWhoLabel[]
  nextStep: string
  draftSms: string
} {
  const inboundBody = (input.inboundBody ?? '').trim()
  const inboundChannel = input.inboundKind === 'sms_in' ? 'sms' : 'email'
  const payload = payloadRecord(input.inboundPayload)
  const intent =
    asReplyIntent(payload?.intent) ??
    input.classifiedIntent ??
    deterministicReplyIntent(inboundBody)?.intent ??
    null
  const recommendedReply =
    (typeof payload?.recommendedReply === 'string' ? payload.recommendedReply : '') ||
    (input.classifiedReply ?? '')
  const whoLabels = mapPersonWhoLabels({ tags: input.tags, stage: input.stage })
  const nextStep = composePersonNextStep({
    unrepliedInbound: { channel: inboundChannel },
    replyIntent: intent,
    triageTask: null,
    sequenceWaiting: null,
  })
  return {
    inboundBody,
    inboundChannel,
    whoLabels,
    nextStep,
    draftSms: composeTodayInboundDraft({
      inboundBody,
      inboundChannel,
      intent,
      whoLabels,
      nextStep,
      recommendedReply,
      personName: input.personName,
    }),
  }
}

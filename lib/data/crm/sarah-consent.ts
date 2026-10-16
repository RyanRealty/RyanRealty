/**
 * Sarah consent and opt-out log. 5-year retain. DAL only (G1).
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { RECORD_RETENTION_YEARS } from '@/lib/sarah/outbound'
import {
  SARAH_CONSENT_WORDING_VERSION,
  SARAH_POST_VOICE_YES_ASK,
  type SarahConsentChannel,
} from '@/lib/sarah/lead-consent'

export type SarahConsentOutcome =
  | 'granted-marketing'
  | 'granted-request'
  | 'declined'
  | 'opt-out'
  | 'yes-reply'
  | 'queued-yes'

export type SarahConsentInput = {
  outcome: SarahConsentOutcome
  marketing: boolean
  channel: SarahConsentChannel | 'web' | 'voice' | 'sms'
  question: string
  reply: string
  wordingVersion?: string
  phone?: string | null
  email?: string | null
  pageUrl?: string | null
  ip?: string | null
  userAgent?: string | null
  sessionId?: string | null
  personId?: number | null
}

export function retainUntilIso(from = new Date(), years = RECORD_RETENTION_YEARS): string {
  const d = new Date(from)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString()
}

export async function insertSarahConsentEvent(
  input: SarahConsentInput,
): Promise<{ id: number | null; error: string | null }> {
  try {
    const sb = createServiceClient()
    const occurredAt = new Date().toISOString()
    const { data, error } = await sb
      .from('sarah_consent_events')
      .insert({
        occurred_at: occurredAt,
        retain_until: retainUntilIso(new Date(occurredAt)),
        channel: input.channel,
        outcome: input.outcome,
        marketing: input.marketing,
        question: input.question,
        reply: input.reply,
        wording_version: input.wordingVersion ?? SARAH_CONSENT_WORDING_VERSION,
        phone: input.phone ?? null,
        email: input.email ?? null,
        page_url: input.pageUrl ?? null,
        ip: input.ip ?? null,
        user_agent: input.userAgent ?? null,
        session_id: input.sessionId ?? null,
        person_id: input.personId ?? null,
        source: 'sarah-chat',
      })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[insertSarahConsentEvent]', error.message)
      return { id: null, error: error.message }
    }
    const id = typeof data?.id === 'number' ? data.id : null
    if (input.personId) {
      await sb.from('crm_timeline').insert({
        person_id: input.personId,
        kind: 'system',
        title: `Sarah consent: ${input.outcome}`,
        body: `${input.question}\nReply: ${input.reply}`,
        payload: {
          outcome: input.outcome,
          marketing: input.marketing,
          wording_version: input.wordingVersion ?? SARAH_CONSENT_WORDING_VERSION,
          channel: input.channel,
        },
        source: 'sarah-chat',
      })
    }
    return { id, error: null }
  } catch (err) {
    console.error('[insertSarahConsentEvent]', err)
    return { id: null, error: 'Could not log consent' }
  }
}

export async function queueSarahPostVoiceYes(input: {
  phone: string
  sessionId?: string | null
  personId?: number | null
  pageUrl?: string | null
}): Promise<{ id: number | null; error: string | null }> {
  return insertSarahConsentEvent({
    outcome: 'queued-yes',
    marketing: false,
    channel: 'spoken',
    question: SARAH_POST_VOICE_YES_ASK,
    reply: '',
    phone: input.phone,
    sessionId: input.sessionId,
    personId: input.personId,
    pageUrl: input.pageUrl,
  })
}

export async function applySarahYesReply(input: {
  phone: string
  reply: string
  personId?: number | null
  sessionId?: string | null
}): Promise<{ id: number | null; error: string | null }> {
  return insertSarahConsentEvent({
    outcome: 'yes-reply',
    marketing: true,
    channel: 'sms',
    question: SARAH_POST_VOICE_YES_ASK,
    reply: input.reply,
    phone: input.phone,
    personId: input.personId,
    sessionId: input.sessionId,
  })
}

export async function logSarahStopConsent(input: {
  phone: string
  reply: string
  personId?: number | null
  sessionId?: string | null
}): Promise<{ id: number | null; error: string | null }> {
  return insertSarahConsentEvent({
    outcome: 'opt-out',
    marketing: false,
    channel: 'sms',
    question: 'Reply STOP to opt out',
    reply: input.reply,
    phone: input.phone,
    personId: input.personId,
    sessionId: input.sessionId,
  })
}

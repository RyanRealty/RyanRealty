/**
 * Saves a finished receptionist call onto the caller's CRM timeline (kind
 * 'call'): clean transcript, Grok summary, and qualification fields. The
 * Twilio recording + its transcript attach separately to the twilio:call row
 * via /api/twilio/recording (private, admin-auth playback URL).
 */
import { createServiceClient } from '@/lib/supabase/service'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { DEFAULT_DESK_BROKER } from '@/lib/crm/twilio'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { generateGrokStructured } from '@/lib/grok/text'
import type { TranscriptLine } from '@/lib/grok/voice-sip'

export type Qualification = {
  summary: string
  name: string
  callback_number: string
  intent: string
  area: string
  budget: string
  timing: string
  financing: string
  urgent: boolean
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'name', 'callback_number', 'intent', 'area', 'budget', 'timing', 'financing', 'urgent'],
  properties: {
    summary: { type: 'string' }, name: { type: 'string' }, callback_number: { type: 'string' },
    intent: { type: 'string' }, area: { type: 'string' }, budget: { type: 'string' },
    timing: { type: 'string' }, financing: { type: 'string' }, urgent: { type: 'boolean' },
  },
}

export function callerFromSipHeader(v: string): string {
  const m = v.match(/\+?1?(\d{10})(?=@|>|;|$)/) ?? v.match(/(\d{10,11})/)
  return m ? m[1] : ''
}

export async function logReceptionistCall(callId: string, fromHeader: string, lines: TranscriptLine[]): Promise<void> {
  const phone = callerFromSipHeader(fromHeader)
  if (!phone || lines.length === 0) return
  const transcript = lines.map((l) => `${l.speaker === 'caller' ? 'Caller' : 'Receptionist'}: ${l.text}`).join('\n')
  let q: Qualification | null = null
  try {
    q = (await generateGrokStructured<Qualification>({
      schemaName: 'receptionist_call',
      schema: SCHEMA,
      reasoningEffort: 'low',
      system: 'Summarize this real-estate receptionist phone call for the broker in 1-3 sentences, and extract the fields. Use an empty string when a field was not stated. Never invent.',
      prompt: transcript,
    })).value
  } catch (e) {
    console.error('[receptionist-log] summary failed', e)
  }
  const { match } = await findOrCreatePersonByPhone({ phone, source: 'inbound-call', assignBroker: DEFAULT_DESK_BROKER })
  if (!match) return
  const sb = createServiceClient()
  await sb.from('crm_timeline').upsert(
    {
      person_id: match.personId,
      kind: 'call',
      title: 'Receptionist call (Grok)',
      body: q?.summary ? `${q.summary}\n\n${transcript}` : transcript,
      payload: { xaiCallId: callId, fromNumber: phone, transcript: lines, summary: q?.summary ?? null, qualification: q },
      broker: match.broker ?? DEFAULT_DESK_BROKER,
      source: 'grok-receptionist',
      dedupe_key: `xai:call:${callId}`,
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  )
}

/** Queue the caller's message as a broker alert text (governed broker-alert path) and log it on the caller's CRM record. */
export async function deliverReceptionistMessage(
  callId: string,
  fromHeader: string,
  m: { who: 'matt' | 'rebecca' | 'paul'; caller_name: string; callback_number: string; message: string },
): Promise<boolean> {
  const phone = callerFromSipHeader(fromHeader) || callerFromSipHeader(m.callback_number)
  if (!phone) return false
  const { match } = await findOrCreatePersonByPhone({ phone, source: 'inbound-call', assignBroker: m.who })
  if (!match) return false
  const who = m.who === 'matt' ? 'Matt' : m.who === 'rebecca' ? 'Rebecca' : 'Paul'
  const body = `Receptionist message for ${who}: ${m.caller_name || 'Caller'} (${m.callback_number || phone}) - ${m.message}`.slice(0, 600)
  const queued = await queueBrokerAlert({ broker: m.who, personId: match.personId, kind: `receptionist-message:${callId}`, body })
  try {
    await createServiceClient().from('crm_timeline').upsert({
      person_id: match.personId,
      kind: 'note',
      title: `Receptionist message for ${who}`,
      body,
      payload: { xaiCallId: callId, deliveredTo: m.who, alertQueued: queued },
      broker: m.who,
      source: 'grok-receptionist',
      dedupe_key: `xai:msg:${callId}:${m.who}`,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  } catch (e) {
    console.error('[receptionist-log] message log failed', e)
  }
  return queued
}

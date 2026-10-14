/**
 * Twilio inbound voice webhook (blueprint §5.5 + Twilio cutover 2026-06-24):
 * announce recording, forward the call to the right broker's cell, record
 * dual-channel, and log a `call` timeline entry.
 *
 * Hot path (AGENTS.md — Twilio inbound ack): signature, raw persist, TwiML.
 * Find-or-create, timeline, and alerts run after the ack.
 */

import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  TWILIO_PUBLIC_ORIGIN,
  DEFAULT_DESK_BROKER,
  brokerForTwilioNumber,
  forwardCellForBroker,
  lookupPersonByPhone,
} from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { isNumberBlocked, isStirSpamSuspected } from '@/lib/data/crm/getBlockedNumber'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { isWithinOfficeHours } from '@/lib/crm/office-hours'
import { lookupCaller } from '@/lib/crm/lookup'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import type { CrmBrokerSlug } from '@/lib/crm/constants'
import { ackTwilioWebhook, withAckBudget, TWILIO_RAW_PERSIST_MS } from '@/lib/crm/twilio-webhook-ack'

function rejectResponse(): NextResponse {
  return xml('<?xml version="1.0" encoding="UTF-8"?>\n<Response><Reject reason="rejected"/></Response>')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function voicemailResponse(site: string): NextResponse {
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You have reached Ryan Realty. This call is recorded. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`)
}

export async function POST(request: Request) {
  return ackTwilioWebhook({
    request,
    kind: 'voice',
    process: processVoiceInbound,
    respond: buildVoiceTwiml,
  })
}

/** TwiML only — routing lookups are budgeted so a slow DB still rings. */
export async function buildVoiceTwiml(params: Record<string, string>): Promise<NextResponse> {
  const site = TWILIO_PUBLIC_ORIGIN
  const from = params.From ?? ''
  const dialed = params.To ?? ''
  const stirVerstat = params.StirVerstat ?? null
  const spamSuspected = isStirSpamSuspected(stirVerstat)

  const [blocked, dialedBroker, existing] = await Promise.all([
    withAckBudget(isNumberBlocked(from).catch(() => false), TWILIO_RAW_PERSIST_MS, false),
    withAckBudget(brokerForTwilioNumber(dialed), TWILIO_RAW_PERSIST_MS, null),
    withAckBudget(lookupPersonByPhone(from).catch(() => null), TWILIO_RAW_PERSIST_MS, null),
  ])
  if (blocked) return rejectResponse()
  if (spamSuspected && process.env.CRM_AUTO_BLOCK_SPAM_CALLS === 'true') return rejectResponse()

  const forwardingBroker: CrmBrokerSlug = dialedBroker ?? existing?.broker ?? DEFAULT_DESK_BROKER
  const target = await withAckBudget(forwardCellForBroker(forwardingBroker), TWILIO_RAW_PERSIST_MS, null)

  if (!target) {
    console.error(`[twilio/voice] no forward number for broker=${forwardingBroker} (dialed=${dialed}); routing to voicemail`)
    return voicemailResponse(site)
  }

  let companySettings: Awaited<ReturnType<typeof getCrmCompanySettings>> | null = null
  try {
    companySettings = await withAckBudget(getCrmCompanySettings(), TWILIO_RAW_PERSIST_MS, null)
  } catch {
    companySettings = null
  }

  if (companySettings && !isWithinOfficeHours(companySettings.office_hours, companySettings.time_zone, new Date())) {
    return voicemailResponse(site)
  }

  const recording =
    process.env.CRM_CALL_RECORDING !== 'false' &&
    (companySettings?.call_recording_enabled ?? true)
  const recAttrs = recording
    ? ` record="record-from-answer-dual" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed"`
    : ''
  const announce = recording ? '<Say>This call may be recorded for quality purposes.</Say>' : ''
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${announce}
  <Dial timeout="25" callerId="${from || dialed}" action="${site}/api/twilio/voice-complete" method="POST"${recAttrs}>${target}</Dial>
</Response>`)
}

/** CRM person + timeline + alerts. Runs after TwiML. */
export async function processVoiceInbound(params: Record<string, string>): Promise<void> {
  const from = params.From ?? ''
  const dialed = params.To ?? ''
  const stirVerstat = params.StirVerstat ?? null
  const spamSuspected = isStirSpamSuspected(stirVerstat)
  const dialedBroker = await brokerForTwilioNumber(dialed)

  let match: { personId: number; name: string | null; broker: CrmBrokerSlug | null } | null = null
  let created = false
  try {
    const res = await findOrCreatePersonByPhone({
      phone: from,
      source: 'inbound-call',
      assignBroker: dialedBroker ?? DEFAULT_DESK_BROKER,
    })
    match = res.match
    created = res.created
  } catch (e) {
    console.error('[twilio/voice] find-or-create failed:', e)
  }

  const forwardingBroker: CrmBrokerSlug = dialedBroker ?? match?.broker ?? DEFAULT_DESK_BROKER
  const target = await forwardCellForBroker(forwardingBroker)

  if (match) {
    try {
      const sb = createServiceClient()
      await sb.from('crm_timeline').upsert(
        {
          person_id: match.personId,
          kind: 'call',
          title: 'Inbound call',
          payload: { fromNumber: from, toNumber: dialed, callSid: params.CallSid ?? null, forwardedTo: target, dialedBroker, forwardingBroker, recordingConsent: 'announced', stirVerstat, spamSuspected },
          broker: forwardingBroker,
          source: 'twilio',
          dedupe_key: params.CallSid ? `twilio:call:${params.CallSid}:p${match.personId}` : null,
        },
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      )
      if (created) {
        await queueBrokerAlert({
          broker: forwardingBroker,
          personId: match.personId,
          kind: 'new-lead',
          body: newLeadAlertBody({
            name: match.name,
            source: 'inbound-call',
            stage: 'Lead',
            personId: match.personId,
            detail: `Calling now from ${from}`,
          }),
        })
      }
    } catch (e) {
      console.error('[twilio/voice] timeline/alert write failed:', e)
    }
  }

  if (match && created) {
    const personId = match.personId
    const callerPhone = from
    after(async () => {
      try {
        const { callerName, lineType, carrier } = await lookupCaller(callerPhone)
        if (!callerName && !lineType) return
        const sb = createServiceClient()
        const { data: row } = await sb.from('crm_people').select('name,custom').eq('id', personId).maybeSingle()
        const cur = String(row?.name ?? '')
        const isPlaceholder = !cur || /^call lead\b/i.test(cur) || /^\+?\d[\d\s().-]+$/.test(cur)
        const update: Record<string, unknown> = {}
        if (callerName && isPlaceholder) update.name = callerName
        if (lineType) update.custom = { ...((row?.custom as Record<string, unknown> | null) ?? {}), line_type: lineType, carrier }
        if (Object.keys(update).length) await sb.from('crm_people').update(update).eq('id', personId)
      } catch (e) {
        console.error('[twilio/voice] caller lookup enrichment failed:', e)
      }
    })
  }
}

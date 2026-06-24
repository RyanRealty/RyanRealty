/**
 * Twilio inbound voice webhook (blueprint §5.5 + Twilio cutover 2026-06-24):
 * announce recording, forward the call to the right broker's cell, record
 * dual-channel, and log a `call` timeline entry.
 *
 * Routing rule (the "each business number forwards to that broker's cell" rule):
 * resolve the broker from the DIALED Twilio line (params.To) FIRST. A call to
 * Paul's line forwards to Paul and creates a Paul-assigned lead. Only the shared
 * marketing line (no single owner) falls back to the caller's existing
 * assignment, then the default desk.
 *
 * Unanswered calls fall through to /api/twilio/voice-complete (voicemail).
 * Recordings + voicemails are transcribed via /api/twilio/recording.
 *
 * Compliance (Matt directive 2026-06-24 — record both legs, announce): a "may be
 * recorded" announcement plays before connecting. Continuing past it is consent
 * in every state (out-of-state callers can be in two-party-consent states like
 * California). Disable recording entirely with CRM_CALL_RECORDING=false.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  TWILIO_PUBLIC_ORIGIN,
  DEFAULT_DESK_BROKER,
  brokerForTwilioNumber,
  forwardCellForBroker,
  verifiedTwilioParams,
} from '@/lib/crm/twilio'
import { findOrCreatePersonByPhone } from '@/lib/data/crm/findOrCreatePersonByPhone'
import { newLeadAlertBody, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function xml(body: string): NextResponse {
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

/** Voicemail TwiML — used when no forward number resolves, so a caller is never dropped. */
function voicemailResponse(site: string): NextResponse {
  return xml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>You have reached Ryan Realty. This call is recorded. Please leave a message after the tone and we will call you right back.</Say>
  <Record maxLength="180" playBeep="true" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed" />
  <Say>Thank you. Goodbye.</Say>
</Response>`)
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const site = TWILIO_PUBLIC_ORIGIN
  const from = params.From ?? ''
  const dialed = params.To ?? ''

  // 1. Who owns the DIALED line? (null = shared marketing line / unrecognized.)
  const dialedBroker = await brokerForTwilioNumber(dialed)

  // 2. Find/create the caller. A new lead created on a specific broker's line is
  //    assigned to THAT broker; on the marketing line it goes to the default desk.
  //    The create never blocks the dial — wrap it so a DB failure still rings.
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
    console.error('[twilio/voice] find-or-create failed (continuing to dial):', e)
  }

  // 3. Forwarding target: the dialed line's broker wins; else the caller's
  //    existing assignment; else the default desk. forwardCellForBroker returns
  //    null only if nothing resolves (→ voicemail, never a dropped call).
  const forwardingBroker: CrmBrokerSlug = dialedBroker ?? match?.broker ?? DEFAULT_DESK_BROKER
  const target = await forwardCellForBroker(forwardingBroker)

  // 4. Log the inbound call (idempotent on dedupe_key, crash-safe — a logging
  //    failure must never prevent the TwiML response).
  if (match) {
    try {
      const sb = createServiceClient()
      await sb.from('crm_timeline').upsert(
        {
          person_id: match.personId,
          kind: 'call',
          title: 'Inbound call',
          payload: { fromNumber: from, toNumber: dialed, callSid: params.CallSid ?? null, forwardedTo: target, dialedBroker, forwardingBroker, recordingConsent: 'announced' },
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
      console.error('[twilio/voice] timeline/alert write failed (continuing):', e)
    }
  }

  // 5. No forward number resolved → voicemail rather than a dropped/misrouted call.
  if (!target) {
    console.error(`[twilio/voice] no forward number for broker=${forwardingBroker} (dialed=${dialed}); routing to voicemail`)
    return voicemailResponse(site)
  }

  // 6. Dial the broker's cell, recording both legs with the caller already on
  //    notice. Pass the CALLER's number as caller ID so the broker sees who is
  //    calling and can call back directly (FUB's forwarding behavior).
  const recording = process.env.CRM_CALL_RECORDING !== 'false'
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

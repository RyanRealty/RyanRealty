/**
 * Twilio message StatusCallback webhook (blueprint Phase 9.4 — delivery receipts).
 *
 * Twilio POSTs here for every outbound message as it moves through its delivery
 * lifecycle (queued -> sent -> delivered, or -> undelivered/failed). The relay
 * (scripts/crm-alert-relay.mjs) wires StatusCallback to this route; before this
 * route existed the callback 404'd and no delivery state was ever recorded.
 *
 * What it does:
 *  1. Validate the X-Twilio-Signature (reject spoofed posts).
 *  2. Parse MessageStatus + MessageSid + ErrorCode from the form body.
 *  3. Find the matching crm_timeline sms_out row by payload.twilioSid.
 *  4. Write the delivery state FORWARD-ONLY onto that row's payload — a late,
 *     out-of-order 'sent' callback never overwrites a 'delivered' row.
 *  5. On a carrier-filter code (30007/30008) record it on the timeline so the
 *     broker can see the carrier dropped the text. A single filter does NOT
 *     suppress (often transient); only a delivery-receipt opt-out (21610) writes
 *     a suppression, and that flows through the suppression chokepoint.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { twilioWebhookValidationUrl, validateTwilioSignature } from '@/lib/crm/twilio'
import { classifyTwilioStatus, isForwardStateTransition, type SmsDeliveryState } from '@/lib/crm/sms-status'
import { addSuppression } from '@/lib/crm/suppressions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type SmsOutPayload = Record<string, unknown> & {
  twilioSid?: string
  deliveryState?: SmsDeliveryState
  carrierFiltered?: boolean
  errorCode?: number | null
}

export async function POST(request: Request) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  const url = twilioWebhookValidationUrl(request)
  const signature = request.headers.get('x-twilio-signature')
  if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, params, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const sid = (params.MessageSid ?? params.SmsSid ?? '').trim()
  const status = params.MessageStatus ?? params.SmsStatus ?? null
  const rawErrorCode = params.ErrorCode ?? null

  // Always 200 — Twilio retries on non-2xx and floods the relay with retries for
  // a callback we have nothing to do with. Acknowledge and no-op on bad input.
  if (!sid) return NextResponse.json({ ok: true, skipped: 'no sid' })

  const classified = classifyTwilioStatus(status, rawErrorCode)
  const sb = createServiceClient()

  // Find the sms_out row this SID belongs to. The sequence engine + relay both
  // stamp payload.twilioSid when they send (dedupe_key twilio:<sid>:p<pid>).
  const { data: row } = await sb
    .from('crm_timeline')
    .select('id,person_id,payload')
    .eq('kind', 'sms_out')
    .filter('payload->>twilioSid', 'eq', sid)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    // No matching outbound row (e.g. an alert text the relay sent that we never
    // logged to a timeline). Acknowledge so Twilio stops retrying.
    return NextResponse.json({ ok: true, sid, state: classified.state, matched: false })
  }

  const prev = (row.payload as SmsOutPayload | null) ?? {}
  const prevState = (prev.deliveryState as SmsDeliveryState | undefined) ?? null
  const advance = isForwardStateTransition(prevState, classified.state)

  // Forward-only: only roll the state forward. carrierFiltered + errorCode are
  // always recorded (additive evidence), even when the state itself is held.
  const nextPayload: SmsOutPayload = {
    ...prev,
    deliveryState: advance ? classified.state : prevState ?? classified.state,
    deliveryUpdatedAt: new Date().toISOString(),
    errorCode: classified.errorCode ?? prev.errorCode ?? null,
    carrierFiltered: classified.carrierFiltered || prev.carrierFiltered === true,
  }

  await sb.from('crm_timeline').update({ payload: nextPayload }).eq('id', row.id)

  // Carrier filter (30007/30008): the carrier silently dropped the text. Record
  // a visible system note once (deduped) so the broker knows the contact never
  // got it. Detected, not suppressed — a lone filter is often transient.
  if (classified.carrierFiltered && !(prev.carrierFiltered === true)) {
    await sb.from('crm_timeline').upsert(
      {
        person_id: row.person_id,
        kind: 'system',
        title: 'Text carrier-filtered — the carrier blocked delivery',
        body: `Twilio reported ErrorCode ${classified.errorCode} (carrier filtering) for message ${sid}. The contact did not receive this text.`,
        source: 'twilio',
        dedupe_key: `twilio-carrier-filter:${sid}`,
      },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
  }

  // The only delivery-receipt code that suppresses: a hard STOP opt-out. Routes
  // through the suppression chokepoint (writing a suppression only stops sends).
  if (classified.shouldSuppress) {
    await addSuppression({ personId: row.person_id, channel: 'sms', reason: 'twilio-opt-out', source: 'twilio' })
  }

  return NextResponse.json({
    ok: true,
    sid,
    state: nextPayload.deliveryState,
    advanced: advance,
    carrierFiltered: classified.carrierFiltered,
    matched: true,
  })
}

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
import { verifiedTwilioParams } from '@/lib/crm/twilio'
import { classifyTwilioStatus } from '@/lib/crm/sms-status'
import { addSuppression } from '@/lib/crm/suppressions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const sid = (params.MessageSid ?? params.SmsSid ?? '').trim()
  const status = params.MessageStatus ?? params.SmsStatus ?? null
  const rawErrorCode = params.ErrorCode ?? null

  // Always 200 — Twilio retries on non-2xx and floods the relay with retries for
  // a callback we have nothing to do with. Acknowledge and no-op on bad input.
  if (!sid) return NextResponse.json({ ok: true, skipped: 'no sid' })

  const classified = classifyTwilioStatus(status, rawErrorCode)
  const sb = createServiceClient()

  // Atomic forward-only merge (crm_advance_sms_delivery). Twilio fires
  // queued/sent/delivered in rapid succession; doing SELECT->compute->UPDATE in
  // app code let a late callback that read before the `delivered` write committed
  // clobber it. The RPC does the whole forward-only merge in one statement, so
  // Postgres row locks serialize concurrent callbacks and the state only ever
  // moves forward. Matches on payload.twilioSid, returns the row it touched.
  const { data: rows } = await sb.rpc('crm_advance_sms_delivery', {
    p_sid: sid,
    p_state: classified.state,
    p_error_code: classified.errorCode,
    p_carrier_filtered: classified.carrierFiltered,
  })
  const row = Array.isArray(rows) ? (rows[0] as { id: number; person_id: number } | undefined) : undefined

  if (!row) {
    // No matching outbound row (e.g. an alert text the relay sent that we never
    // logged to a timeline). Acknowledge so Twilio stops retrying.
    return NextResponse.json({ ok: true, sid, state: classified.state, matched: false })
  }

  // Carrier filter (30007/30008): the carrier silently dropped the text. Record
  // a visible system note (deduped by SID, so it lands once even across retries)
  // so the broker knows the contact never got it. Detected, not suppressed — a
  // lone filter is often transient.
  if (classified.carrierFiltered) {
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
    state: classified.state,
    carrierFiltered: classified.carrierFiltered,
    matched: true,
  })
}

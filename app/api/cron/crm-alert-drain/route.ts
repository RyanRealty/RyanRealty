import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import {
  brokerPhoneSet,
  isBrokerPhone,
  toE164,
  failureTransition,
  NON_BROKER_REFUSAL,
} from '@/lib/crm/alert-drain-core'
import {
  listPendingAlerts,
  claimAlert,
  markSent,
  markFailure,
  refuseAlert,
  reclaimStaleSending,
} from '@/lib/data/crm/brokerAlertDrain'
import { drainWebPush } from '@/app/api/push/_lib/deliver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/crm-alert-drain — the SERVERLESS crm_broker_alerts drain (W5.5).
 *
 * Moves instant broker-alert delivery off the mac mini so it survives the
 * machine: drains status='pending' rows and sends via the Twilio Messaging
 * Service (the same A2P-verified service the relay uses). Coexists safely with
 * the 45s mac-mini relay via per-row CAS claims (status 'pending'->'sending');
 * whichever drainer claims first wins — no double-texts.
 *
 * SAFETY (2026-06-16 incident backstop, gate-pinned by
 * check-crm-sms-channel-safety): the BROKER-PHONE WHITELIST — this channel
 * sends ONLY to Matt / Rebecca / Paul's lines (isBrokerPhone). Any other
 * to_phone is refused terminally, never sent.
 *
 * Gated on CRM_SMS_ALERTS='twilio' (the existing cutover flag): when unset the
 * SMS half no-ops and the mac-mini relay keeps sole ownership. ?dry=1 reports
 * the would-send batch without claiming or sending (live verification, §0-safe).
 * W5.5a cutover 2026-07-27: Production env must be exactly `twilio` (not empty).
 *
 * WEB PUSH (W5.5 leg b) runs FIRST and is deliberately OUTSIDE the
 * CRM_SMS_ALERTS gate: it is the durable channel, so it must keep delivering
 * whichever way the SMS cutover flag is set, and it claims its own column
 * (crm_broker_alerts.pushed_at) rather than the SMS `status` machine so the two
 * channels can never consume each other's rows. Both properties are pinned by
 * scripts/check-web-push-durable.mjs.
 *
 * Schedule: every minute (vercel.json). Auth: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'

  // Durable channel first, and never behind the SMS flag.
  const push = dry ? { mode: 'dry' as const } : await drainWebPush()

  if (process.env.CRM_SMS_ALERTS !== 'twilio') {
    return NextResponse.json({
      ok: true,
      mode: 'noop',
      reason: 'CRM_SMS_ALERTS != twilio (mac-mini relay owns SMS delivery)',
      push,
    })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!accountSid || !authToken || !serviceSid) {
    // The web-push pass already ran and is independent of Twilio — report it
    // even on the SMS-side failure, so a dark push channel is never hidden
    // behind an unrelated 500.
    return NextResponse.json({ ok: false, error: 'twilio env missing', push }, { status: 500 })
  }

  const whitelist = brokerPhoneSet({
    TWILIO_FORWARD_MATT: process.env.TWILIO_FORWARD_MATT,
    TWILIO_FORWARD_REBECCA: process.env.TWILIO_FORWARD_REBECCA,
    TWILIO_FORWARD_PAUL: process.env.TWILIO_FORWARD_PAUL,
  })
  const reclaimed = dry ? 0 : await reclaimStaleSending()
  const pending = await listPendingAlerts(20)

  if (dry) {
    return NextResponse.json({
      ok: true,
      mode: 'dry',
      pending: pending.map((a) => ({
        id: a.id,
        broker: a.broker,
        would: isBrokerPhone(a.to_phone, whitelist) ? 'send' : 'refuse:non-broker',
      })),
      push,
    })
  }

  let sent = 0
  let refused = 0
  let retried = 0
  let failed = 0
  for (const alert of pending) {
    // Whitelist FIRST — a non-broker row is refused before any claim/send.
    if (!isBrokerPhone(alert.to_phone, whitelist)) {
      await refuseAlert(alert.id, NON_BROKER_REFUSAL)
      refused += 1
      continue
    }
    // CAS claim — loses cleanly to the mac-mini relay or a concurrent run.
    const claimed = await claimAlert(alert.id)
    if (!claimed) continue
    try {
      const form = new URLSearchParams({
        To: toE164(alert.to_phone),
        MessagingServiceSid: serviceSid,
        Body: alert.body,
      })
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      })
      if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 140)}`)
      await markSent(alert.id, 'twilio-sms')
      sent += 1
    } catch (err) {
      const t = failureTransition(alert.attempts)
      await markFailure(alert.id, t.attempts, t.status, err instanceof Error ? err.message : 'send failed')
      if (t.status === 'failed') failed += 1
      else retried += 1
    }
  }

  return NextResponse.json({ ok: true, mode: 'drain', sent, refused, retried, failed, reclaimed, push })
}

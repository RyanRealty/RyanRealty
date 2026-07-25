/**
 * POST /api/push/test — send a test notification to the signed-in broker's own
 * registered devices (W5.5 leg b).
 *
 * This is the broker's proof that the channel is live end to end: browser
 * permission -> service worker -> subscription row -> VAPID-signed encrypted
 * POST -> notification on the lock screen. It does NOT touch the alert queue,
 * so a test can never consume or duplicate a real lead alert.
 *
 * AUTH: admin session (lib/auth/guards). Target devices come from the SESSION
 * email's broker, never from the request.
 */
import { NextResponse } from 'next/server'
import { requireAdminOr403 } from '@/lib/auth/guards'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { sendWebPush, vapidConfig } from '../_lib/web-push'
import { disableSubscription, isPushBroker, listActiveSubscriptions, markSubscriptionSuccess } from '../_lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const ctx = await requireAdminOr403()
  if (ctx instanceof Response) return ctx
  const slug = CRM_BROKER_BY_EMAIL[ctx.email.trim().toLowerCase()]
  if (!isPushBroker(slug)) {
    return NextResponse.json({ ok: false, error: 'no broker profile for this account' }, { status: 400 })
  }

  const cfg = vapidConfig()
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        mode: 'unconfigured',
        error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set on this deployment, so nothing can be signed or sent.',
      },
      { status: 503 },
    )
  }

  const devices = await listActiveSubscriptions(slug)
  if (devices.length === 0) {
    return NextResponse.json({ ok: false, error: 'no registered devices for this broker' }, { status: 400 })
  }

  const payload = JSON.stringify({
    title: 'Ryan Realty alert test',
    body: 'Web push is working on this device. Lead alerts will arrive here.',
    url: 'https://ryan-realty.com/admin/settings',
    tag: 'push-test',
  })

  let delivered = 0
  let retired = 0
  const errors: string[] = []
  for (const d of devices) {
    const res = await sendWebPush({ endpoint: d.endpoint, keys: d.keys }, payload, cfg)
    if (res.ok) {
      delivered += 1
      await markSubscriptionSuccess(d.id)
    } else if (res.gone) {
      retired += 1
      await disableSubscription(d.id, `gone ${res.status}`)
    } else {
      errors.push(res.error ?? String(res.status))
    }
  }

  return NextResponse.json({ ok: delivered > 0, devices: devices.length, delivered, retired, errors })
}

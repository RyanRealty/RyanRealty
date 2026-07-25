/**
 * /api/push/subscribe — broker device registration for the durable web-push
 * alert channel (W5.5 leg b).
 *
 *   GET    → what this broker needs to subscribe: the VAPID public key (or a
 *            plain "not provisioned" flag) plus their currently registered
 *            devices. Never invents a key.
 *   POST   → register/refresh this device for the signed-in broker.
 *   DELETE → remove one device (by endpoint) for the signed-in broker.
 *
 * AUTH: an admin session, via the shared guard in lib/auth/guards.ts. The
 * broker a subscription belongs to is derived from the SESSION email, never
 * from the request body — a signed-in admin cannot register a device that
 * notifies someone else.
 */
import { NextResponse } from 'next/server'
import { requireAdminOr403 } from '@/lib/auth/guards'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { vapidPublicKey } from '../_lib/web-push'
import { deleteSubscription, isPushBroker, listActiveSubscriptions, upsertSubscription, type PushBroker } from '../_lib/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function brokerFor(email: string): PushBroker | null {
  const slug = CRM_BROKER_BY_EMAIL[email.trim().toLowerCase()]
  return isPushBroker(slug) ? slug : null
}

export async function GET() {
  const ctx = await requireAdminOr403()
  if (ctx instanceof Response) return ctx
  const broker = brokerFor(ctx.email)
  const key = vapidPublicKey()

  return NextResponse.json({
    ok: true,
    broker,
    configured: Boolean(key),
    vapidPublicKey: key,
    // Plain-language reason so the UI can say WHY rather than showing a dead button.
    reason: key
      ? null
      : 'Web push is not provisioned yet — VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are unset on this deployment.',
    devices: broker
      ? (await listActiveSubscriptions(broker)).map((s) => ({
          endpoint: s.endpoint,
          label: s.label,
          created_at: s.created_at,
          last_success_at: s.last_success_at,
        }))
      : [],
  })
}

export async function POST(request: Request) {
  const ctx = await requireAdminOr403()
  if (ctx instanceof Response) return ctx
  const broker = brokerFor(ctx.email)
  if (!broker) {
    return NextResponse.json(
      { ok: false, error: 'No broker profile for this account — alerts are routed per broker.' },
      { status: 400 },
    )
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; label?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const endpoint = body.endpoint?.trim()
  const p256dh = body.keys?.p256dh?.trim()
  const auth = body.keys?.auth?.trim()
  if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: 'endpoint (https), keys.p256dh and keys.auth are all required' },
      { status: 400 },
    )
  }

  await upsertSubscription({
    broker,
    endpoint,
    keys: { p256dh, auth },
    label: body.label?.trim() ?? null,
    email: ctx.email,
  })
  return NextResponse.json({ ok: true, broker })
}

export async function DELETE(request: Request) {
  const ctx = await requireAdminOr403()
  if (ctx instanceof Response) return ctx
  const broker = brokerFor(ctx.email)
  if (!broker) return NextResponse.json({ ok: false, error: 'no broker profile' }, { status: 400 })

  let endpoint: string | undefined
  try {
    endpoint = (await request.json())?.endpoint
  } catch {
    endpoint = new URL(request.url).searchParams.get('endpoint') ?? undefined
  }
  if (!endpoint) return NextResponse.json({ ok: false, error: 'endpoint required' }, { status: 400 })

  const removed = await deleteSubscription(broker, endpoint)
  return NextResponse.json({ ok: true, removed })
}

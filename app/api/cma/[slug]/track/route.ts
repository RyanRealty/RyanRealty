import { NextRequest, NextResponse } from 'next/server'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cma/[slug]/track?e=open|view&p=<fubPersonId>
 *
 * Lightweight engagement tracking for CMA delivery emails (Matt directive
 * 2026-06-10: "Can I get a notice that it's been opened and if anything was
 * clicked?").
 *
 *   e=open — embedded as a 1×1 transparent GIF in the email body. Fires when
 *            the recipient's mail client loads remote images. Caveat: Apple
 *            Mail Privacy Protection / Gmail image proxies can prefetch the
 *            pixel without a human read, and images-off clients never fire it.
 *   e=view — wraps the "view the report online" link. 302-redirects to the
 *            hosted report. A click is a reliable human signal.
 *
 * First hit of each kind queues a broker alert (crm_broker_alerts → mac mini
 * relay → iMessage to the broker). queueBrokerAlert dedupes via crm_timeline
 * (`alert:<kind>:<personId>`), so repeat opens never re-text the broker, and
 * every hit after the first is still a silent 200/302.
 */

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const e = req.nextUrl.searchParams.get('e')
  const personId = Number(req.nextUrl.searchParams.get('p') ?? '')

  const cleanSlug = /^cma-[a-z0-9-]{1,60}$/.test(slug) ? slug : null
  const event = e === 'open' || e === 'view' ? e : null

  if (cleanSlug && event && Number.isFinite(personId) && personId > 0) {
    const { getCmaBySlug } = await import('@/lib/data')
    const cma = await getCmaBySlug(cleanSlug)
    if (cma) {
      const who = (cma.client_name as string | null) ?? `person ${personId}`
      const addr = (cma.subject_address as string | null) ?? cleanSlug
      const body =
        event === 'open'
          ? `${who} opened the CMA email for ${addr} (first open — image-proxy prefetch is possible).`
          : `${who} clicked through to the online CMA report for ${addr}. A click is a real read.`
      // Fire-and-forget so the pixel/redirect stays fast; dedupe lives inside.
      void queueBrokerAlert({
        broker: ((cma.broker_slug as string | null) ?? 'matt').split('-')[0],
        personId,
        kind: `cma-${event}:${cleanSlug}`,
        body,
      }).catch(() => {})
    }
  }

  if (event === 'view' && cleanSlug) {
    return NextResponse.redirect(new URL(`/cmas/${cleanSlug}/cma.html`, req.nextUrl.origin), 302)
  }
  return new NextResponse(new Uint8Array(PIXEL_GIF), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}

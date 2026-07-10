/**
 * GET /bpo/[slug] — the rendered view of a built Broker Price Opinion.
 *
 * CLIENT-SAFE BY DEFAULT: the internal Offer strategy block is stripped so this
 * URL is safe to share with a client. The full document (offer strategy intact)
 * is served only to an authenticated admin via `?variant=full` — that is what
 * the admin review page iframes. Unlisted (noindex, no-store) either way.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getBpoHtmlBySlug } from '@/lib/data/bpo/reads'
import { stripOfferStrategy } from '@/lib/bpo/render'

export const revalidate = 0

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]{3,80}$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const row = await getBpoHtmlBySlug(safeSlug)
  if (!row || !row.html_content) {
    return NextResponse.json(
      { error: 'This broker price opinion has no stored document yet. Build it from /admin/bpo.' },
      { status: 404 },
    )
  }

  // Full (offer-strategy) view is admin-only. Everyone else gets client-safe.
  const wantFull = new URL(request.url).searchParams.get('variant') === 'full'
  let allowFull = false
  if (wantFull) {
    const session = await getSession()
    const role = await getAdminRoleForEmail(session?.user?.email ?? null)
    allowFull = Boolean(role && role.role !== 'report_viewer')
  }
  const base = allowFull ? row.html_content : stripOfferStrategy(row.html_content)

  // Rewrite build-time font URLs to the serving origin so CSP font-src 'self'
  // never blocks the brand display font (same fix as /cma/[slug]).
  const origin = new URL(request.url).origin
  const html = base.replace(/https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g, `${origin}$1`)

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, no-store',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}

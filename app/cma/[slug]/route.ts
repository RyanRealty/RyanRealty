/**
 * GET /cma/[slug] — the public view of a built CMA.
 *
 * Serves the self-contained HTML stored in cmas.html_content (deterministic
 * builder output). Legacy file-based CMAs (the 21 finalized under
 * public/cmas/<slug>/cma.html) redirect to their static path, which Next
 * serves directly, so old links and new links both resolve through this one
 * URL shape.
 *
 * CMAs are unlisted client documents: noindex, no cache. A public visitor with
 * the link may open one ONLY once it is client-ready (status finalized or
 * delivered) — the same states the send rail requires. Draft / building /
 * archived documents carry unreviewed numbers and client PII, so they are
 * served only to an authenticated admin (so the /admin review-page iframe can
 * still preview a draft). Everyone else gets a 404. The document itself carries
 * a meta charset tag, so the header stays bare text/html.
 */

import { NextResponse } from 'next/server'
import { getCmaHtmlBySlug } from '@/lib/data'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

// Always render per-request (the handler reads the request URL and the DB row,
// which opts the route out of static handling — revalidate 0 makes it explicit).
export const revalidate = 0

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]{3,80}$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const row = await getCmaHtmlBySlug(safeSlug)
  if (!row) {
    return NextResponse.json({ error: 'CMA not found' }, { status: 404 })
  }

  if (row.html_content) {
    // Publication gate: only client-ready CMAs are public. Draft / building /
    // archived documents (unreviewed numbers + client PII) are admin-only, so
    // the admin review-page iframe still previews them while a guessable slug
    // never leaks one to the public.
    const status = String(row.status ?? '')
    const isPublicStatus = status === 'finalized' || status === 'delivered'
    if (!isPublicStatus) {
      const session = await getSession()
      const role = await getAdminRoleForEmail(session?.user?.email ?? null)
      const isAdmin = Boolean(role && role.role !== 'report_viewer')
      if (!isAdmin) {
        return NextResponse.json({ error: 'CMA not found' }, { status: 404 })
      }
    }
    // The stored document embeds absolute asset URLs from build time (the PDF
    // renderer needs them absolute). When the serving host differs from the
    // build-time host (dev, or a host migration), the font URL becomes
    // cross-origin and CSP font-src 'self' blocks it — rewrite font references
    // to the current origin so the brand display font always loads.
    const origin = new URL(request.url).origin
    let html = row.html_content.replace(
      /https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g,
      `${origin}$1`,
    )
    // Visitor tracking + email-click identity (?_pid= / ?_fuid=) for raw-HTML
    // documents. The site's React trackers never run here, so without this
    // script a CMA opened from a tracked email records the click but never
    // creates or identifies a web session. See public/rr-doc-tracker.js.
    const tracker = '<script src="/rr-doc-tracker.js" defer></script>'
    html = html.includes('</body>')
      ? html.replace('</body>', `${tracker}</body>`)
      : html + tracker
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
        // Route handlers bypass next.config headers() in some serve paths —
        // set the frame policy here too so the admin same-origin preview works.
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  }

  // Legacy file-based CMA — the committed static asset is the document.
  // (public/drafts/ is gitignored scratch and never exists in production, so
  // only public/cmas/ paths redirect.)
  if (row.html_path?.startsWith('public/cmas/')) {
    const publicPath = row.html_path.replace(/^public/, '')
    return NextResponse.redirect(new URL(publicPath, request.url), 302)
  }

  return NextResponse.json(
    { error: 'This CMA has no stored document yet. Build it from /admin/cmas.' },
    { status: 404 },
  )
}

/**
 * GET /cma/[slug] — the public view of a built CMA.
 *
 * Serves the self-contained HTML stored in cmas.html_content (deterministic
 * builder output). Legacy file-based CMAs (the 21 finalized under
 * public/cmas/<slug>/cma.html) redirect to their static path, which Next
 * serves directly, so old links and new links both resolve through this one
 * URL shape.
 *
 * CMAs are unlisted client documents: noindex, no cache, but not auth-gated —
 * the lead the CMA was built for opens this link from their email, exactly
 * like the pre-existing /cmas/<slug>/cma.html files. The document itself
 * carries a meta charset tag, so the header stays bare text/html.
 */

import { NextResponse } from 'next/server'
import { getCmaHtmlBySlug } from '@/lib/data'

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
    // The stored document embeds absolute asset URLs from build time (the PDF
    // renderer needs them absolute). When the serving host differs from the
    // build-time host (dev, or a host migration), the font URL becomes
    // cross-origin and CSP font-src 'self' blocks it — rewrite font references
    // to the current origin so the brand display font always loads.
    const origin = new URL(request.url).origin
    const html = row.html_content.replace(
      /https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g,
      `${origin}$1`,
    )
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

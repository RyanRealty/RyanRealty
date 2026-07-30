/**
 * GET /api/cma-document/[token] — deliver a full market analysis to a registrant.
 *
 * The token is minted by app/actions/cma-download.ts after a registration and
 * stored only as a SHA-256 hash, so a database read cannot mint a working link.
 *
 * The delivered document is a NORMAL CMA with full comparable sales. ODS Rules
 * (Aug 2024) §7-5 D: "None of the foregoing shall be construed to prevent any
 * individual legitimately in possession of 'current', 'sold', 'comparable', or
 * 'statistical' information from utilizing such information to support
 * valuations on particular properties for clients and customers." Nothing here
 * redacts the analysis. The gate is on WHO gets it, never on WHAT is in it.
 *
 * resolveCmaDocumentByToken re-checks the publish flag on every single request,
 * so unpublishing a document kills every outstanding link immediately.
 */

import { NextResponse } from 'next/server'
import { resolveCmaDocumentByToken } from '@/lib/data/cma/getPublishedCma'

// Per-request: the handler reads a token from the URL and stamps a delivery.
export const revalidate = 0

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const doc = await resolveCmaDocumentByToken(String(token ?? ''))

  // One shape for every failure — expired, revoked, unpublished, never existed.
  // A distinguishable error would let someone probe which tokens are real.
  if (!doc) {
    return new NextResponse('This link is no longer active. Please request the analysis again.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
    })
  }

  const origin = new URL(request.url).origin
  // The stored document embeds absolute asset URLs from build time. When the
  // serving host differs (dev, or a host migration) the font URL becomes
  // cross-origin and CSP font-src 'self' blocks it, so repoint fonts at the
  // current origin. Same treatment app/cma/[slug]/route.ts applies.
  const html = doc.html.replace(/https?:\/\/[^'")\s]+(\/fonts\/[^'")\s]+)/g, `${origin}$1`)

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      // A registrant's document is never indexed and never cached at an edge.
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'private, no-store',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

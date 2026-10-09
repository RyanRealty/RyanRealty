/**
 * GET /cma/[slug] — public view of a built CMA.
 * Drafts 404 for the public. Brokers with an admin session can review a draft.
 */

import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/auth/guards'
import { serveCmaDocument, CMA_DOC_HEADERS } from '@/lib/cma/serve-document'

export const dynamic = 'force-dynamic'
export const revalidate = 0
// The live letter rebuilds the comps map on this request (rule 30). The map
// budget inside serveCmaDocument is 12s. This is only the platform backstop,
// the same one the admin review route already sets.
export const maxDuration = 30

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const ctx = await getAdminContext()
  const isAdmin = Boolean(ctx && ctx.role !== 'report_viewer')
  const result = await serveCmaDocument({
    slug: String(slug ?? ''),
    requestUrl: request.url,
    isAdmin,
    viewerEmail: ctx?.email ?? null,
  })
  if (result.kind === 'redirect') {
    return NextResponse.redirect(new URL(result.url, request.url), result.status)
  }
  if (result.kind === 'json') {
    return NextResponse.json(result.body, { status: result.status })
  }
  return new NextResponse(result.html, {
    status: result.status,
    headers: result.headers ?? CMA_DOC_HEADERS,
  })
}

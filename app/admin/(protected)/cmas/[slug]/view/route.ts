/**
 * GET /admin/cmas/[slug]/view — broker review of any status, including draft.
 * Not a public send. Registration gate is skipped.
 */

import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/auth/guards'
import { serveCmaDocument, CMA_DOC_HEADERS } from '@/lib/cma/serve-document'

export const revalidate = 0

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const admin = await getAdminContext()
  if (!admin || admin.role === 'report_viewer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await context.params
  const result = await serveCmaDocument({
    slug: String(slug ?? ''),
    requestUrl: request.url,
    isAdmin: true,
    viewerEmail: admin.email,
    skipRegisterGate: true,
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

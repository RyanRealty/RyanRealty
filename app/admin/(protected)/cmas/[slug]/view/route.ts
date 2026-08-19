/**
 * GET /admin/cmas/[slug]/view — broker review of any status, including draft.
 * Not a public send. Registration gate is skipped.
 *
 * This is a route handler, not page.tsx: the document is a full HTML page and
 * must not render inside ConsoleShell. next/link client-nav 404s here (no
 * page segment) — Review CMA and Open report must be real <a target="_blank">.
 */

import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/auth/guards'
import { redirectToAdminLogin } from '@/lib/auth/admin-login-redirect'
import { serveCmaDocument, CMA_DOC_HEADERS } from '@/lib/cma/serve-document'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const admin = await getAdminContext()
  if (!admin) {
    return redirectToAdminLogin(request)
  }
  if (admin.role === 'report_viewer') {
    return NextResponse.redirect(new URL('/admin/access-denied', request.url), 307)
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

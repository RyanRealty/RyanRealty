/**
 * Browser document routes under admin must send a signed-out tap to login,
 * not a JSON 401. Route handlers skip the (protected) layout redirect.
 */

import { NextResponse } from 'next/server'
import { adminLoginHref } from '@/lib/auth/admin-return-path'

export { adminLoginHref, isSafeAdminReturnPath } from '@/lib/auth/admin-return-path'

export function hasMachineAuthHeader(request: Request): boolean {
  return Boolean(request.headers.get('authorization') || request.headers.get('x-cron-secret'))
}

export function redirectToAdminLogin(request: Request, nextPath?: string): NextResponse {
  const url = new URL(request.url)
  const next = nextPath ?? `${url.pathname}${url.search}`
  return NextResponse.redirect(new URL(adminLoginHref(next), request.url), 307)
}

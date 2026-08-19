/**
 * Paths a signed-out broker may return to after admin login.
 * Used by the login page (client + server) and document-route redirects.
 */

import { safeRedirectPath } from '@/lib/auth/safeRedirect'

const CMA_PDF_PATH_RE = /^\/api\/cma\/[a-z0-9-]{3,80}\/pdf$/i

function pathnameOnly(path: string): string {
  const q = path.indexOf('?')
  const h = path.indexOf('#')
  let end = path.length
  if (q >= 0) end = Math.min(end, q)
  if (h >= 0) end = Math.min(end, h)
  return path.slice(0, end)
}

/** True for /admin… and the broker CMA PDF (the two phone-tappable document URLs). */
export function isSafeAdminReturnPath(next: string | null | undefined): boolean {
  const path = safeRedirectPath(next, '')
  if (!path) return false
  const pathname = pathnameOnly(path)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  return CMA_PDF_PATH_RE.test(pathname)
}

export function adminLoginHref(next: string, fallback = '/admin'): string {
  const dest = isSafeAdminReturnPath(next) ? safeRedirectPath(next, fallback) : fallback
  return `/admin/login?next=${encodeURIComponent(dest)}`
}

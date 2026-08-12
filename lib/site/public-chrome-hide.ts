/**
 * Paths where the public header must not render. Copied from PublicNav
 * (2026-08-10 dual-chrome kill): those surfaces carry their own chrome or none.
 * V3Chrome in app/layout.tsx uses this so a layout swap cannot put the public
 * bar on admin, LPs, account, or dashboard.
 */
export function shouldHidePublicChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/lp/')) return true
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  if (pathname.startsWith('/sign/')) return true
  if (pathname.startsWith('/concept/')) return true
  if (pathname.startsWith('/dashboard')) return true
  if (pathname.startsWith('/account')) return true
  if (pathname.startsWith('/cma-drafts')) return true
  if (pathname.startsWith('/dev/')) return true
  if (pathname.startsWith('/marketing/request')) return true
  return false
}

'use client'

/**
 * PublicNav — the ONE public header for the site.
 *
 * Matt 2026-08-10: kill dual chrome (SiteHeader mega-menu vs KbNav).
 * KbNav + lib/site-nav.ts (Buy · Areas · Market · Sell · About) is the SSOT.
 * Hidden on LP / admin / sign / concept (those surfaces carry their own chrome
 * or none). Account and dashboard keep their own shells via the same hide set.
 */

import { usePathname } from 'next/navigation'
import { KbNav } from '@/components/site/kb/KbNav.client'

function shouldHidePublicNav(pathname: string | null | undefined): boolean {
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

/** Solid bar on inventory/app frames; transparent-over-hero elsewhere. */
function useSolidBar(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === '/homes-for-sale' || pathname.startsWith('/homes-for-sale/')) return true
  if (pathname.startsWith('/search')) return true
  if (pathname === '/compare') return true
  if (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password') return true
  return false
}

export function PublicNav() {
  const pathname = usePathname()
  if (shouldHidePublicNav(pathname)) return null
  return <KbNav solid={useSolidBar(pathname)} />
}

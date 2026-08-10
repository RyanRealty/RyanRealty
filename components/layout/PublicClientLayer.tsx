'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import HideOnLP from './HideOnLP'

/**
 * PublicClientLayer — the public site's interactive CLIENT components, code-split
 * and NEVER loaded on /admin (RC3 "drop the public bundle from admin").
 *
 * The whole admin runs in ConsoleShell; it has no use for the consumer prompts,
 * comparison tray, or public visitor/intent trackers, yet those chunks used to
 * ship in the admin client bundle (imported directly in the root layout). Wrapping
 * them here — each behind a route-aware `next/dynamic` — means the admin tree
 * returns `null` before any of them is imported, so their chunks are never fetched
 * on an admin page. Non-admin behavior is byte-identical: every piece keeps its
 * original HideOnLP / Suspense gating, and each is a client-effect component
 * (no meaningful SSR output), so `ssr: false` changes nothing a user can see.
 *
 * Deliberately NOT here: SiteHeader/SiteFooter (async SERVER components — zero
 * client JS, and their chrome must be CSS-toggled by HideChrome, never
 * mount-toggled/dynamic-imported — the "double nav" incident 2026-07-11) and
 * RootProvider (its contexts are used by admin surfaces, so it stays in the root).
 */

const SignInPromptWithSession = dynamic(() => import('./SignInPromptWithSession'), { ssr: false })
const InstallPrompt = dynamic(() => import('@/components/pwa/InstallPrompt'), { ssr: false })
const VisitTrackerWithSession = dynamic(() => import('./VisitTrackerWithSession'), { ssr: false })
const GlobalIntentTracker = dynamic(() => import('@/components/GlobalIntentTracker'), { ssr: false })
const AuthCodeRedirect = dynamic(() => import('@/components/AuthCodeRedirect'), { ssr: false })
const AuthErrorRedirect = dynamic(() => import('@/components/AuthErrorRedirect'), { ssr: false })
const SignUpTracker = dynamic(() => import('@/components/tracking/SignUpTracker'), { ssr: false })
const ComparisonTray = dynamic(() => import('@/components/comparison/ComparisonTray'), { ssr: false })
// F2 guest habit residual — soft "You're watching …" return banner (no PII).
const GuestWatchingBanner = dynamic(
  () => import('@/components/site/GuestWatchingBanner.client'),
  { ssr: false },
)

export default function PublicClientLayer() {
  const pathname = usePathname()
  // Admin never loads any of these chunks. (Return BEFORE touching the dynamic
  // components so their imports are never triggered on an admin route.)
  if (pathname === '/admin' || pathname?.startsWith('/admin/')) return null
  return (
    <>
      <HideOnLP>
        <SignInPromptWithSession />
      </HideOnLP>
      <HideOnLP>
        <InstallPrompt />
      </HideOnLP>
      {/* Trackers run site-wide (incl. the homepage /), same as before — the
          admin gate above is what keeps them off /admin. */}
      <VisitTrackerWithSession />
      <GlobalIntentTracker />
      <Suspense fallback={null}>
        <HideOnLP>
          <AuthCodeRedirect />
          <AuthErrorRedirect />
          <SignUpTracker />
        </HideOnLP>
      </Suspense>
      <HideOnLP>
        <ComparisonTray />
      </HideOnLP>
      <HideOnLP>
        <GuestWatchingBanner />
      </HideOnLP>
    </>
  )
}

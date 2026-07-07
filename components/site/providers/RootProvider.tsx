import type { ReactNode } from 'react'
import { ComparisonProvider } from '@/contexts/ComparisonContext'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import HideOnLP, { HideOnAdmin } from '@/components/layout/HideOnLP'
import { AnalyticsScripts } from './AnalyticsScripts'
import { IdentityBridges } from './IdentityBridges'
import { Toaster } from '@/components/ui/sonner'

/**
 * Site v2 root provider — wraps every page in the canonical chrome
 * dependencies: comparison state context, analytics + maps scripts,
 * identity + attribution bridges, and the brand cookie-consent banner.
 *
 * Replaces the 25-import "salad" that previously lived inline in
 * app/layout.tsx (per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 2). Chrome
 * components (SiteHeader, SiteFooter), auth redirects, and engagement
 * pop-ups stay in layout.tsx because they need positional placement
 * around `children`.
 *
 * The CookieConsentBanner is hidden on /lp/* routes per the existing
 * brand-consent policy — LP visitors see only the lead form. Analytics
 * scripts + identity bridges still run on LPs (FUB / agent-attribution
 * cookies must hydrate on landing-page hits).
 */
export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <ComparisonProvider>
      {/* No analytics/pixels/ads on /admin: broker usage was inflating GA4 +
          Meta metrics (the loop's own scoreboard) and loading AdSense for
          nothing. Identity bridges stay — harmless and auth-adjacent. */}
      <HideOnAdmin>
        <AnalyticsScripts />
      </HideOnAdmin>
      <IdentityBridges />
      {children}
      {/* Global toast surface (sonner). Mounted once for every route so
          toast.success/error calls render. Client components must never
          mount their own local Toaster. */}
      <Toaster position="bottom-right" />
      <HideOnLP>
        <CookieConsentBanner />
      </HideOnLP>
    </ComparisonProvider>
  )
}

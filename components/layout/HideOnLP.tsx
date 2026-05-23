"use client"

/**
 * HideOnLP — client-side route gate that hides chrome on /lp/* routes.
 *
 * We can't use `headers()` in the root layout for LP detection: that call
 * forces the entire route tree to render dynamically, which prevents the
 * static prerender for the public LP families (cities, communities, zip,
 * listing detail). The prerender block was the root cause of the cold
 * cache p95 spikes flagged by SITE_SPEC §45-47.
 *
 * Trade-off: the chrome HTML still ships in the RSC payload for LP routes
 * and unmounts on hydration. The brief flash is acceptable because LP
 * routes are conversion-focused and never the LCP candidate.
 */

import { usePathname } from "next/navigation"

export default function HideOnLP({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/lp/")) return null
  return <>{children}</>
}

/** Inverse: show only on /lp/* routes. */
export function OnLPOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (!pathname?.startsWith("/lp/")) return null
  return <>{children}</>
}

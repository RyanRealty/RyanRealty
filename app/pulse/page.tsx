// @data-free — E-CUT: this route only 301s to /housing-market. No listings, no pulse.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /pulse folded into /activity, and /activity folded into /housing-market
 * (SITE_PAGES.md; UXLIVE-8, visibility audit 2026-09-22). The live hop is
 * next.config.ts redirects() (one 308, no chain); this file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/housing-market' },
}

export default function PulsePage() {
  permanentRedirect('/housing-market')
}

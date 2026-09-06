// @data-free — inventory fold: this route only 301s. Never renders UI.
// @no-breadcrumb — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * Redirect-only. HTTP 308 lives in next.config.ts (Next 16 page-level
 * permanentRedirect serves a 200 shell).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/sell' },
}

export default function LpSellYourHomeRedirectPage() {
  permanentRedirect('/sell')
}

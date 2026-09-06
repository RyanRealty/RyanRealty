// @data-free — inventory fold: this route only 301s. Never renders UI.
// @no-breadcrumb — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * Redirect-only. HTTP 308 lives in next.config.ts (Next 16 page-level
 * permanentRedirect serves a 200 shell). Luxury is the Homes Field with
 * a $1.5M floor, not a second browse chrome.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/homes-for-sale/bend?minPrice=1500000' },
}

export default function LuxuryHomesBendRedirectPage() {
  permanentRedirect('/homes-for-sale/bend?minPrice=1500000')
}

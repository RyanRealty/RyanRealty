// @data-free — inventory fold: this route only 301s. Never renders UI.
// @no-breadcrumb — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * Redirect-only. HTTP 308 lives in next.config.ts (Next 16 page-level
 * permanentRedirect serves a 200 shell). Frozen noindex LP wrap still
 * names this file; do not restyle a second Heath chrome.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/communities/tetherow' },
}

export default function LpHeathRedirectPage() {
  permanentRedirect('/communities/tetherow')
}

// @data-free — situation, not a fourth product. Folds into /sell.
// @no-breadcrumb — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { ROUTE_PATH } from '../_v3/sell-constants'

/**
 * Redirect-only. Inherited is a seller situation, not a fourth Sell chrome.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: ROUTE_PATH },
}

export default function SellInheritedHomeRedirectPage() {
  permanentRedirect(ROUTE_PATH)
}

// @data-free — E-CUT: this route only 301s to /housing-market. No listings.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /resources folds into /housing-market (cut-list: router annex). This file
 * never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/housing-market' },
}

export default function ResourcesPage() {
  permanentRedirect('/housing-market')
}

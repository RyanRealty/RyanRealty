// @data-free — E-CUT: this route only 301s to /activity. No listings, no pulse.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /pulse folds into /activity (cut-list: two live feeds on the same
 * activity_events plane). This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/activity' },
}

export default function PulsePage() {
  permanentRedirect('/activity')
}

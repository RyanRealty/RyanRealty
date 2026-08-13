// @data-free — E-CUT: this route only 301s to /cities. No listings, no pulse.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /area-guides folds into /cities (cut-list: duplicate chooser of cities and
 * communities). This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/cities' },
}

export default function AreaGuidesPage() {
  permanentRedirect('/cities')
}

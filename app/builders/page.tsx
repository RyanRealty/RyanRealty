// @data-free — E-CUT: this route only 301s to /new-construction. No listings.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /builders folds into /new-construction (the dated Bend new-con page).
 * This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/new-construction' },
}

export default function BuildersIndexPage() {
  permanentRedirect('/new-construction')
}

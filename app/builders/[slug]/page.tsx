// @data-free — E-CUT: this route only 301s to /new-construction. No listings.
// @no-static-params — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /builders/[slug] folds into /new-construction. This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/new-construction' },
}

export default function BuilderSlugPage() {
  permanentRedirect('/new-construction')
}

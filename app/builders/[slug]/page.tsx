// @data-free — E-CUT: this route only 301s to new-construction search. No listings.
// @no-static-params — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /builders/[slug] folds into /homes-for-sale?newConstruction=1 (cut-list:
 * listing-detail rail absorbs the job). This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/homes-for-sale?newConstruction=1' },
}

export default function BuilderSlugPage() {
  permanentRedirect('/homes-for-sale?newConstruction=1')
}

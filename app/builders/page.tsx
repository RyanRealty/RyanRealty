// @data-free — E-CUT: this route only 301s to new-construction search. No listings.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /builders folds into /homes-for-sale?newConstruction=1 (cut-list: builders
 * index never rose to the anchor-family floor). This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/homes-for-sale?newConstruction=1' },
}

export default function BuildersIndexPage() {
  permanentRedirect('/homes-for-sale?newConstruction=1')
}

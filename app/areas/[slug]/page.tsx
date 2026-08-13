// @data-free — E-CUT: this route only 301s to /homes-for-sale. No listings.
// @no-static-params — redirect stub, never renders.
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

/**
 * /areas/[slug] folds into /homes-for-sale (cut-list: broker-drawn public saved
 * areas). This file never renders UI.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/homes-for-sale' },
}

export default function AreaSlugPage() {
  permanentRedirect('/homes-for-sale')
}

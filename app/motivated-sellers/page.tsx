// @data-free. Redirect-only. No figures. IA lock (P5): /price-drops is the survivor.

/**
 * /motivated-sellers. 308 into /price-drops.
 *
 * P5 IA lock: deal signals keep one URL. /price-drops is the buyer-framed
 * survivor. This file never renders UI. Do not spend a v3 pass here.
 */

import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: '/price-drops' },
}

export default function MotivatedSellersRedirect() {
  permanentRedirect('/price-drops')
}

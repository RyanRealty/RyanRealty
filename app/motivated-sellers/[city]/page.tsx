// @data-free. Redirect-only. No figures. IA lock (P5): /price-drops is the survivor.

/**
 * /motivated-sellers/[city]. 308 into /price-drops/[city].
 *
 * generateStaticParams stays over SITE_CITY_SLUGS. Unknown slugs 404 before
 * the redirect. This file never renders UI.
 */

import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'

export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return SITE_CITY_SLUGS.map((slug) => ({ city: slug }))
}

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  if (!SITE_CITY_SLUGS.includes(city)) notFound()
  return {
    robots: { index: false, follow: true },
    alternates: { canonical: `/price-drops/${city}` },
  }
}

export default async function MotivatedSellersCityRedirect({ params }: Props) {
  const { city } = await params
  if (!SITE_CITY_SLUGS.includes(city)) notFound()
  permanentRedirect(`/price-drops/${city}`)
}

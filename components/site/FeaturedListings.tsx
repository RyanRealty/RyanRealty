import { Suspense } from 'react'
import GeoSectionFeaturedListings from '@/components/geo-page/GeoSectionFeaturedListings'
import { getListings } from '@/app/actions/listings'

type Props = {
  /** City name to scope to (e.g. "Bend"). Omit + pass nothing for region-wide. */
  city?: string
  /** Subdivision/community name to scope to (within a city). */
  subdivision?: string
  title?: string
  viewAllHref?: string
  viewAllLabel?: string
  limit?: number
}

function citySlug(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-')
}

/**
 * Self-fetching featured-listings showcase. ANY geo page (home, city,
 * neighborhood, community) wires it with a single import, which the
 * check-mockup-parity gate can require so the section can't regress.
 *
 * Surfaces the premium active inventory for the scope (price-desc). Public —
 * does NOT read session/cookies, so it stays inside the page's ISR cache and
 * renders nothing (instead of throwing) if the geo has no active listings.
 */
async function FeaturedListingsInner({ city, subdivision, title, viewAllHref, viewAllLabel, limit = 12 }: Props) {
  const listings = await getListings({
    ...(city ? { city } : {}),
    ...(subdivision ? { subdivision } : {}),
    sort: 'price_desc',
    limit,
  }).catch(() => [])

  if (listings.length === 0) return null

  const href =
    viewAllHref ??
    (subdivision && city
      ? `/homes-for-sale/${citySlug(city)}/${citySlug(subdivision)}`
      : city
        ? `/homes-for-sale/${citySlug(city)}`
        : '/homes-for-sale')

  const heading =
    title ??
    (subdivision
      ? `Featured homes in ${subdivision}`
      : city
        ? `Featured homes in ${city}`
        : 'Featured Central Oregon homes')

  return (
    <GeoSectionFeaturedListings
      title={heading}
      listings={listings}
      viewAllHref={href}
      viewAllLabel={viewAllLabel ?? 'View all homes'}
      signedIn={false}
    />
  )
}

export default function FeaturedListings(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-80 border-t border-border" aria-hidden />}>
      <FeaturedListingsInner {...props} />
    </Suspense>
  )
}

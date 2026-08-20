import { V3Footer, V3_FOOTER_COLUMNS } from '@/components/site/v3'
import { cityEntityKey, homesForSalePath, listingTileHref } from '../../../../lib/slug'
import { type ListingCardData } from '@/components/site/ListingCard'
import { GolfLanding } from '@/components/site/golf/GolfLanding'
import { GOLF_COMMUNITIES } from '@/data/golf-landing'
import { getGolfImages, pickGolfImage, getGolfHomesForLanding } from '@/lib/data'
import { withTimeout, withTimeoutSettled } from '../fetch-guards'

/** The on-golf-course preset's purpose-built landing render (see page.tsx call site). */
export async function renderGolfLanding(city: string) {
  const [golfHomesSettled, golfImages] = await Promise.all([
    // Lightweight golf-homes fetch (search_golf_homes RPC, no full_count window)
    // returns in well under a second. The full search RPC's count(*) OVER ()
    // golf-filters all ~134K Bend rows (~7s, risks a serverless timeout).
    // Settled so a timeout is not painted as "this city has no golf homes".
    withTimeoutSettled(getGolfHomesForLanding(city, 24), [], 6000),
    withTimeout(getGolfImages(24), []),
  ])
  const golfRows = golfHomesSettled.data
  const homesDegraded = golfHomesSettled.degraded
  const heroImage = pickGolfImage(golfImages, city, null)
  const homes = golfRows.map((l): ListingCardData => {
    const street = [l.StreetNumber, l.StreetName].filter(Boolean).join(' ').trim()
    const cityLine = [[l.City, 'OR'].filter(Boolean).join(', '), l.PostalCode].filter(Boolean).join(' ').trim()
    return {
      listingKey: (l.ListNumber ?? l.ListingKey ?? '').toString().trim(),
      href: listingTileHref({
        listingKey: l.ListingKey,
        listNumber: l.ListNumber,
        streetNumber: l.StreetNumber,
        streetName: l.StreetName,
        city: l.City,
      }),
      photoUrl: l.PhotoURL ?? null,
      price: l.ListPrice ?? null,
      addressLine: street || 'Address available on request',
      cityLine: cityLine || 'Central Oregon',
      beds: l.BedroomsTotal ?? null,
      baths: l.BathroomsTotal ?? null,
      sqft: l.TotalLivingAreaSqFt ?? null,
      // The card publishes the ask; on a commercial lease ListPrice is rent.
      propertyType: l.PropertyType ?? null,
      propertySubType: l.PropertySubType ?? null,
      subdivisionName: l.SubdivisionName ?? null,
      city: l.City ?? null,
      listNumber: l.ListNumber ?? null,
    }
  })
  const citySlug = cityEntityKey(city)
  const cityCommunities = GOLF_COMMUNITIES.filter((c) => c.citySlug === citySlug)
  const communities = cityCommunities.length ? cityCommunities : GOLF_COMMUNITIES
  const allHomesHref = `${homesForSalePath(city)}/on-golf-course?all=1`
  return (
    <>
      <GolfLanding
        city={city}
        heroImage={heroImage}
        communities={communities}
        homes={homesDegraded ? [] : homes}
        totalHomes={0}
        allHomesHref={allHomesHref}
        homesDegraded={homesDegraded}
      />
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

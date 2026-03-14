import { homesForSalePath } from '../../../lib/slug'

/**
 * Resort + Place schema for type-2 (resort/amenity-rich) community pages.
 * Renders in addition to SearchPageJsonLd when the subdivision is a resort community.
 */
type Props = {
  displayName: string
  city: string
  subdivision: string
  siteUrl: string
  description: string | null
  bannerUrl: string | null
  listingUrls: string[]
}

export default function ResortCommunityJsonLd({
  displayName,
  city,
  subdivision,
  siteUrl,
  description,
  bannerUrl,
  listingUrls,
}: Props) {
  const pageUrl = `${siteUrl}${homesForSalePath(city, subdivision)}`

  const resort = {
    '@context': 'https://schema.org',
    '@type': 'Resort',
    name: displayName,
    description: (description ?? `Homes and real estate in ${displayName}, ${city}, Central Oregon.`).slice(0, 500),
    url: pageUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressRegion: 'OR',
      addressCountry: 'US',
    },
    ...(bannerUrl && { image: bannerUrl }),
    ...(listingUrls.length > 0 && {
      containsPlace: listingUrls.slice(0, 5).map((url) => ({ '@type': 'Place', url })),
    }),
  }

  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ryan Realty', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Homes for Sale', item: `${siteUrl}/homes-for-sale` },
      { '@type': 'ListItem', position: 3, name: city, item: `${siteUrl}${homesForSalePath(city)}` },
      { '@type': 'ListItem', position: 4, name: subdivision, item: pageUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(resort) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }} />
    </>
  )
}

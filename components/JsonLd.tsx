/**
 * Inline JSON-LD for SEO and AI discoverability.
 * Renders in root layout for site-wide identity.
 */
export default function JsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Ryan Realty',
    description: 'Central Oregon real estate. Browse homes for sale, search by city and neighborhood, view maps and listing details.',
    url: baseUrl,
    areaServed: {
      '@type': 'GeoCircle',
      geoMidpoint: { '@type': 'GeoCoordinates', latitude: 44.0582, longitude: -121.3153 },
      geoRadius: '80000',
    },
    sameAs: [],
  }

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ryan Realty',
    url: baseUrl,
    description: 'Search Central Oregon homes for sale. Browse listings, maps, and find your next home.',
    publisher: { '@id': `${baseUrl}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${baseUrl}/homes-for-sale?keywords={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ ...organization, '@id': `${baseUrl}#organization` }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  )
}

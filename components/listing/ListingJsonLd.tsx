/**
 * JSON-LD for a single listing: Product + Offer + Place for rich results and AI.
 */
type Fields = {
  ListingKey?: string
  ListingId?: string
  ListPrice?: number
  StreetNumber?: string
  StreetName?: string
  StreetDirPrefix?: string | null
  StreetSuffix?: string | null
  StreetDirSuffix?: string | null
  City?: string
  StateOrProvince?: string
  PostalCode?: string
  Latitude?: number
  Longitude?: number
  SubdivisionName?: string | null
  BedsTotal?: number
  BathsTotal?: number
  BedroomsTotal?: number
  BathroomsTotal?: number
  BuildingAreaTotal?: number
  PublicRemarks?: string
  [key: string]: unknown
}

type Props = { listingKey: string; fields: Fields; /** First listing photo URL for Product image (SEO/rich results) */ imageUrl?: string }

export default function ListingJsonLd({ listingKey, fields, imageUrl }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const url = `${baseUrl}/listing/${listingKey}`
  const address = [
    fields.StreetNumber,
    fields.StreetDirPrefix,
    fields.StreetName,
    fields.StreetSuffix,
    fields.StreetDirSuffix,
  ]
    .filter(Boolean)
    .join(' ')
  const addressRegion = [fields.City, fields.StateOrProvince, fields.PostalCode].filter(Boolean).join(', ')

  const place: Record<string, unknown> = {
    '@type': 'Place',
    name: address || addressRegion || `Property ${fields.ListingId ?? listingKey}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address || undefined,
      addressLocality: fields.City,
      addressRegion: fields.StateOrProvince,
      postalCode: fields.PostalCode,
    },
  }
  if (fields.Latitude != null && fields.Longitude != null) {
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: fields.Latitude,
      longitude: fields.Longitude,
    }
  }

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: address || addressRegion || `Home for sale ${fields.ListingId ?? listingKey}`,
    description: (fields.PublicRemarks ?? '').slice(0, 500) || undefined,
    url,
    ...(imageUrl && { image: imageUrl }),
    ...(place?.name ? { subjectOf: place } : {}),
    offers: {
      '@type': 'Offer',
      price: fields.ListPrice ?? undefined,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    additionalProperty: [
      (fields.BedroomsTotal ?? fields.BedsTotal) != null
        ? { '@type': 'PropertyValue', name: 'Bedrooms', value: fields.BedroomsTotal ?? fields.BedsTotal }
        : null,
      (fields.BathroomsTotal ?? fields.BathsTotal) != null
        ? { '@type': 'PropertyValue', name: 'Bathrooms', value: fields.BathroomsTotal ?? fields.BathsTotal }
        : null,
      fields.BuildingAreaTotal != null
        ? { '@type': 'PropertyValue', name: 'Square feet', value: fields.BuildingAreaTotal }
        : null,
      fields.SubdivisionName && { '@type': 'PropertyValue', name: 'Subdivision', value: fields.SubdivisionName },
    ].filter(Boolean),
  }

  const beds = fields.BedroomsTotal ?? fields.BedsTotal
  const baths = fields.BathroomsTotal ?? fields.BathsTotal
  const realEstateListing: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: address || addressRegion || `Home for sale ${fields.ListingId ?? listingKey}`,
    description: (fields.PublicRemarks ?? '').slice(0, 500) || undefined,
    url,
    ...(imageUrl ? { image: imageUrl } : {}),
    address: place.address,
    ...(place.geo ? { geo: place.geo } : {}),
    ...(beds != null ? { numberOfRooms: beds } : {}),
    offers: {
      '@type': 'Offer',
      price: fields.ListPrice ?? undefined,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  }
  const listAgent = (fields as { ListAgentName?: string }).ListAgentName
  const listOffice = (fields as { ListOfficeName?: string }).ListOfficeName
  if (listAgent ?? listOffice) {
    realEstateListing.offeredBy = {
      '@type': 'RealEstateAgent',
      name: listAgent ?? listOffice ?? 'Listing Agent',
      ...(listOffice ? { worksFor: { '@type': 'RealEstateOrganization', name: listOffice } } : {}),
    }
  }
  const amenities = (fields as { amenities?: Record<string, unknown> }).amenities
  if (amenities && typeof amenities === 'object' && Object.keys(amenities).length > 0) {
    realEstateListing.amenityFeature = Object.entries(amenities)
      .filter(([, v]) => v === true || (typeof v === 'string' && v.length > 0))
      .map(([k, v]) => ({
        '@type': 'LocationFeatureSpecification',
        name: k.replace(/_/g, ' '),
        value: v === true ? true : v,
      }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(realEstateListing) }}
      />
    </>
  )
}

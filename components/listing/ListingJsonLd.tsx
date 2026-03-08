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
  BuildingAreaTotal?: number
  PublicRemarks?: string
  [key: string]: unknown
}

type Props = { listingKey: string; fields: Fields; /** First listing photo URL for Product image (SEO/rich results) */ imageUrl?: string }

export default function ListingJsonLd({ listingKey, fields, imageUrl }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com'
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
    (place as any).geo = {
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
      (fields as any).BedroomsTotal != null || fields.BedsTotal != null
        ? { '@type': 'PropertyValue', name: 'Bedrooms', value: (fields as any).BedroomsTotal ?? fields.BedsTotal }
        : null,
      (fields as any).BathroomsTotal != null || fields.BathsTotal != null
        ? { '@type': 'PropertyValue', name: 'Bathrooms', value: (fields as any).BathroomsTotal ?? fields.BathsTotal }
        : null,
      fields.BuildingAreaTotal != null
        ? { '@type': 'PropertyValue', name: 'Square feet', value: fields.BuildingAreaTotal }
        : null,
      fields.SubdivisionName && { '@type': 'PropertyValue', name: 'Subdivision', value: fields.SubdivisionName },
    ].filter(Boolean),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
    />
  )
}

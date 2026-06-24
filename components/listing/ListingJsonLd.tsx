/**
 * JSON-LD for a single listing: Product + Offer + Place for rich results and AI.
 */
import { listingDetailPath, displaySubdivision } from '@/lib/slug'
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
  VirtualTourURLUnbranded?: string | null
  VirtualTourURL?: string | null
  VideoURL?: string | null
  [key: string]: unknown
}

type Props = { listingKey: string; fields: Fields; /** First listing photo URL for Product image (SEO/rich results) */ imageUrl?: string }

export default function ListingJsonLd({ listingKey, fields, imageUrl }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const subdivision = displaySubdivision(fields.SubdivisionName)
  const url = `${baseUrl}${listingDetailPath(
    fields.ListingId ?? listingKey,
    { streetNumber: fields.StreetNumber, streetName: fields.StreetName, city: fields.City, state: fields.StateOrProvince, postalCode: fields.PostalCode },
    { city: fields.City, subdivision },
    { mlsNumber: fields.ListingId ?? null }
  )}`
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
      subdivision && { '@type': 'PropertyValue', name: 'Subdivision', value: subdivision },
    ].filter(Boolean),
  }

  const beds = fields.BedroomsTotal ?? fields.BedsTotal
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

  const videoUrl =
    (typeof fields.VirtualTourURLUnbranded === 'string' && fields.VirtualTourURLUnbranded.trim()) ||
    (typeof fields.VirtualTourURL === 'string' && fields.VirtualTourURL.trim()) ||
    (typeof fields.VideoURL === 'string' && fields.VideoURL.trim()) ||
    null
  const videoSchema = videoUrl
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: `${address || addressRegion || `Home for sale ${fields.ListingId ?? listingKey}`} virtual tour`,
        description: (fields.PublicRemarks ?? '').slice(0, 300) || undefined,
        contentUrl: videoUrl,
        embedUrl: videoUrl,
        thumbnailUrl: imageUrl ?? undefined,
      }
    : null

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
      {videoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
        />
      )}
    </>
  )
}

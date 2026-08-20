import { getListingCanonicalPathFields } from '@/lib/data/listings/getListingCanonicalPathFields'
import { listingDetailPath, listingKeyFromSlug } from '@/lib/slug'
import { permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  ListingUnavailable,
  LISTING_UNAVAILABLE_METADATA,
} from '@/components/site/listing-detail/ListingUnavailable'

type PageProps = {
  params: Promise<{ listingKey: string }>
}

function canonicalPathFromFields(
  row: NonNullable<Awaited<ReturnType<typeof getListingCanonicalPathFields>>>
): string {
  return listingDetailPath(
    row.ListingKey,
    {
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      city: row.City,
      state: row.State,
      postalCode: row.PostalCode,
    },
    {
      city: row.boundary_city ?? row.City,
      neighborhood: row.boundary_neighborhood,
      subdivision: row.SubdivisionName,
    },
    { mlsNumber: row.ListNumber }
  )
}

async function lookupPathFields(listingKey: string) {
  const raw = String(listingKey ?? '').trim()
  if (!raw) return null
  const fromSlug = listingKeyFromSlug(raw)
  const first = await getListingCanonicalPathFields(fromSlug || raw)
  if (first) return first
  if (fromSlug && fromSlug !== raw) return getListingCanonicalPathFields(raw)
  return null
}

export default async function ListingByKeyPage({ params }: PageProps) {
  const { listingKey } = await params
  const row = await lookupPathFields(listingKey)
  // Rendered refusal, not notFound() — same streamed-shell reason as the detail
  // page. See components/site/listing-detail/ListingUnavailable.tsx.
  if (!row) return <ListingUnavailable />
  permanentRedirect(canonicalPathFromFields(row))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const row = await lookupPathFields(listingKey)
  if (!row) return LISTING_UNAVAILABLE_METADATA
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
  const title = [street, row.City].filter(Boolean).join(', ') || 'Listing'
  const canonical = canonicalPathFromFields(row)
  return {
    title,
    robots: { index: false, follow: true },
    alternates: { canonical },
  }
}

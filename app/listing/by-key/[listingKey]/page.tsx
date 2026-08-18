import { getListingCanonicalPathFields } from '@/lib/data'
import { listingDetailPath, listingKeyFromSlug } from '@/lib/slug'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'

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
  if (!row) notFound()
  permanentRedirect(canonicalPathFromFields(row))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { listingKey } = await params
  const row = await lookupPathFields(listingKey)
  if (!row) return { title: 'Listing', robots: { index: false, follow: false } }
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
  const title = [street, row.City].filter(Boolean).join(', ') || 'Listing'
  const canonical = canonicalPathFromFields(row)
  return {
    title,
    robots: { index: false, follow: true },
    alternates: { canonical },
  }
}

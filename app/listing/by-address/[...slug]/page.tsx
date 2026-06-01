import { notFound } from 'next/navigation'
import ListingDetailPage from '@/app/listing/[listingKey]/page'
import { generateMetadata as generateListingMetadata } from '@/app/listing/[listingKey]/page'
import { resolveListingKeyFromBreadcrumbPath } from '@/app/actions/listing-detail'
import type { Metadata } from 'next'
import { listingKeyFromSlug } from '@/lib/slug'

type PageProps = {
  params: Promise<{ slug: string[] }>
}

async function resolveListingKeyFromPathSegments(slug: string[]): Promise<string | null> {
  if (slug.length < 2) return null
  const citySlug = slug[0] ?? ''
  const listingSegment = slug[slug.length - 1] ?? ''
  const areaSlugs = slug.slice(1, -1)

  // Canonical patterns:
  // - /homes-for-sale/{city}/{...area}/{street-address}-{mls}
  // - /homes-for-sale/{city}/{street-address}-{mls}
  // - /homes-for-sale/{city}/{...area}/{listingKey}~{addressSlug} (legacy)
  const [candidateKey, candidateAddressSlug] = listingSegment.split('~')
  const keyFromSegment = listingKeyFromSlug(candidateKey ?? '')

  // Legacy `key~addressSlug` form: resolve from the address part first.
  const normalizedAddressSlug = (candidateAddressSlug ?? '').trim()
  if (normalizedAddressSlug) {
    const resolvedFromAddress = await resolveListingKeyFromBreadcrumbPath({
      citySlug,
      areaSlugs,
      addressSlug: normalizedAddressSlug,
    })
    if (resolvedFromAddress) return resolvedFromAddress
  }

  // Canonical URLs end in the MLS `ListNumber` (or a RETS `ListingKey`).
  // getListingDetail resolves by EITHER column directly (both uniquely indexed),
  // so hand the extracted id straight through. The MLS# is globally unique — no
  // city/area disambiguation query is needed. This removes the ~30s
  // resolveListingKeyFromCanonicalPath round-trip that previously made every
  // canonical listing URL slow and, on miss, render "Page not found".
  if (keyFromSegment) return keyFromSegment

  // Legacy fallback: resolve from a pure address slug (no embedded id).
  return resolveListingKeyFromBreadcrumbPath({
    citySlug,
    areaSlugs,
    addressSlug: listingSegment,
  })
}

export default async function ListingByAddressPage({ params }: PageProps) {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  if (!listingKey) notFound()
  return <ListingDetailPage params={Promise.resolve({ listingKey })} />
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  if (!listingKey) return {}
  return generateListingMetadata({ params: Promise.resolve({ listingKey }) })
}

import { notFound } from 'next/navigation'
import ListingDetailPage from '@/app/listing/[listingKey]/page'
import { generateMetadata as generateListingMetadata } from '@/app/listing/[listingKey]/page'
import { resolveListingKeyFromBreadcrumbPath, resolveListingKeyFromCanonicalPath } from '@/app/actions/listing-detail'
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
  const canonicalMatch = (candidateKey ?? '').trim().match(/^(.*)-(\d{5,})$/)
  const canonicalPostalCode = canonicalMatch?.[2]?.length === 5 ? canonicalMatch[2] : null

  // Prefer resolving from address slug when present.
  // Some listing feeds may emit a segment key that does not directly match listing_key.
  const normalizedAddressSlug = (candidateAddressSlug ?? '').trim()
  if (normalizedAddressSlug) {
    const resolvedFromAddress = await resolveListingKeyFromBreadcrumbPath({
      citySlug,
      areaSlugs,
      addressSlug: normalizedAddressSlug,
    })
    if (resolvedFromAddress) return resolvedFromAddress
  }

  if (keyFromSegment) {
    const resolvedFromCanonicalPath = await resolveListingKeyFromCanonicalPath({
      citySlug,
      areaSlugs,
      keyOrMls: keyFromSegment,
      postalCode: canonicalPostalCode,
    })
    if (resolvedFromCanonicalPath) return resolvedFromCanonicalPath
  }

  if (keyFromSegment) return keyFromSegment

  // Legacy fallback: resolve from address slug.
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

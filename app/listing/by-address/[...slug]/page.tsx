import ListingDetailPage from '@/app/listing/[listingKey]/page'
import { generateMetadata as generateListingMetadata } from '@/app/listing/[listingKey]/page'
import {
  ListingUnavailable,
  LISTING_UNAVAILABLE_METADATA,
} from '@/components/site/listing-detail/ListingUnavailable'
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

  // Fast path FIRST: MLS# / ListingKey from the URL tail. Do not wait on
  // breadcrumb resolution — that path can hang under load and blank the page.
  if (keyFromSegment) return keyFromSegment

  // Legacy `key~addressSlug` form: resolve from the address part.
  const normalizedAddressSlug = (candidateAddressSlug ?? '').trim()
  if (normalizedAddressSlug) {
    try {
      const resolvedFromAddress = await resolveListingKeyFromBreadcrumbPath({
        citySlug,
        areaSlugs,
        addressSlug: normalizedAddressSlug,
      })
      if (resolvedFromAddress) return resolvedFromAddress
    } catch {
      /* fall through */
    }
  }

  // Pure address slug (no embedded id).
  try {
    return await resolveListingKeyFromBreadcrumbPath({
      citySlug,
      areaSlugs,
      addressSlug: listingSegment,
    })
  } catch {
    return null
  }
}

export default async function ListingByAddressPage({ params }: PageProps) {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  // Rendered refusal, not notFound() — this is the CANONICAL public listing URL
  // (the one in listings.xml), and a thrown 404 here served a blank 200 body.
  // See components/site/listing-detail/ListingUnavailable.tsx.
  if (!listingKey) return <ListingUnavailable />
  return <ListingDetailPage params={Promise.resolve({ listingKey })} />
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  if (!listingKey) return LISTING_UNAVAILABLE_METADATA
  const base = await generateListingMetadata({ params: Promise.resolve({ listingKey }) })
  // A refused listing gets NO canonical. The status is stuck at 200 (streamed
  // shell), so noindex is the only signal doing work, and pairing noindex with
  // a self-canonical is a contradictory instruction to a crawler.
  if (base.robots && typeof base.robots === 'object' && 'index' in base.robots && base.robots.index === false) {
    return base
  }
  // Self-canonical to the PUBLIC URL the visitor/Googlebot actually requested —
  // this IS the sitemap URL. Overrides the inherited canonical so the pretty URL
  // is the indexed one and there's no canonical/sitemap split.
  const canonical = `/homes-for-sale/${slug.map(encodeURIComponent).join('/')}`
  return { ...base, alternates: { canonical } }
}

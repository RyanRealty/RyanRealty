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
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

export default async function ListingByAddressPage({ params, searchParams }: PageProps) {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  // Rendered refusal, not notFound() — this is the CANONICAL public listing URL
  // (the one in listings.xml), and a thrown 404 here served a blank 200 body.
  // See components/site/listing-detail/ListingUnavailable.tsx.
  if (!listingKey) return <ListingUnavailable />
  return (
    <ListingDetailPage
      params={Promise.resolve({ listingKey })}
      searchParams={searchParams}
    />
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params
  const listingKey = await resolveListingKeyFromPathSegments(slug)
  if (!listingKey) return LISTING_UNAVAILABLE_METADATA
  // ONE canonical per listing (SITE-22). This function returns the base
  // metadata UNCHANGED, and the canonical inside it is the one
  // app/listing/[listingKey]/page.tsx computes from the listing's OWN boundary
  // fields — so every path this route answers on points at the same URL.
  //
  // It used to end with a self-canonical to whatever path was requested, added
  // by b58edad4 on 2026-06-01. That same commit taught [listingKey]/page.tsx to
  // build the public canonical through listingDetailPath, which made the
  // override redundant the day it landed; what it did instead was declare every
  // requested path its own canonical. `:26-30` resolves the listing from the
  // MLS tail alone, so ANY city and ANY area segments render 200 — verified
  // live 2026-09-08 on 220226356 at four paths including an invented
  // /portland/ one, all 200, all index,follow, each declaring itself canonical.
  // Measured over GSC 2026-06-08..2026-09-05, 2,363 of 8,724 listing ids
  // appeared at more than one URL: 4,995 URLs and 21,808 impressions.
  //
  // SITE-32 (Matt ruled 2026-09-08). This route adds NOTHING to the robots
  // directive, and that is the policy, not an omission: off-market listing URLs
  // stay index,follow with SITE-21's honest state, and this is the path most of
  // them are indexed under. Do not add a `robots` or `noindex` override here —
  // that would put the directive in two places for one page, which is the exact
  // shape of the self-canonical defect described above. docs/MASTER_SPEC.md
  // §4.9 is the one policy statement; ci:listing-offmarket-index holds it.
  //
  // DO NOT reach for redirect()/permanentRedirect() here. This route has a
  // loading.tsx, and so does app/, so the shell is flushed before any throw and
  // the visitor gets a blank 200 — the consequence recorded at :62-64 above,
  // and the reason app/listing/by-key/[listingKey]/route.ts had to become a
  // route handler.
  return generateListingMetadata({ params: Promise.resolve({ listingKey }) })
}

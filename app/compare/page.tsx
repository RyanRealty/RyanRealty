/**
 * Compare page (/compare) — Wave 3 site-v2 rebuild.
 *
 * Utility page (noindex). Removed dead createClient import — the page
 * never constructed a Supabase client directly. Data is fetched via the
 * DAL (getListingTiles + getListingDetailPhotos from @/lib/data).
 *
 * H1 upgraded from a plain h1 to DisplayHeading (Amboqia).
 * Layout uses Container + Section primitives from @/components/site/primitives.
 * Loading skeleton uses the Skeleton primitive from @/components/ui/skeleton
 * (see CompareClient internals) — no hand-rolled loading placeholders here
 * because the compare grid is rendered server-side; the Skeleton usage lives
 * inside CompareClient's client-side transition states.
 *
 * AICompare: built but unimported. See bottom of file for investigation note
 * and wire-or-delete recommendation for Matt.
 *
 * robots: noindex, follow — kept. This route is NOT in the sitemap.
 */

import type { Metadata } from 'next'
import { getListingTiles, getListingDetailPhotos } from '@/lib/data'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import {
  Container,
  Section,
  DisplayHeading,
  Body,
} from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Compare properties · Ryan Realty',
  description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
  alternates: { canonical: `${siteUrl}/compare` },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Compare properties | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
    url: `${siteUrl}/compare`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Compare properties | Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare properties | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side — price, size, features, and more.',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

export const revalidate = 60

function daysOnMarket(d: string | null | undefined): number | null {
  if (!d) return null
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return null
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

// Suppress unused-variable lint warning. The helper is retained so it can
// be wired to listing-history data when the compare table adds a
// "listed date" row in a future sprint.
void daysOnMarket

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const idsRaw = typeof params.ids === 'string' ? params.ids : ''
  const ids = decodeURIComponent(idsRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)

  let listings: CompareListingData[] = []

  if (ids.length > 0) {
    const [byNumberTiles, byKeyTiles] = await Promise.all([
      getListingTiles({ listNumbers: ids, status: 'all', limit: 50 }).catch(() => []),
      getListingTiles({ listingKeys: ids, status: 'all', limit: 50 }).catch(() => []),
    ])
    const allTiles = [...byNumberTiles, ...byKeyTiles]
    const seen = new Set<string>()
    const deduped = allTiles.filter((t) => {
      const k = t.listingKey || t.listNumber || ''
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })

    const photoArrays = await Promise.all(
      deduped.map((t) => getListingDetailPhotos(t.listingKey).catch(() => []))
    )
    const photoMap = new Map<string, string>()
    deduped.forEach((t, idx) => {
      const photos = photoArrays[idx] ?? []
      const hero = photos.find((p) => p.is_hero === true) ?? photos[0]
      if (hero?.photo_url) photoMap.set(t.listingKey, hero.photo_url)
    })

    listings = deduped.map((t) => {
      const streetParts = [t.streetNumber, t.streetName].filter(Boolean).join(' ').trim()
      const addressParts = [streetParts, t.city, 'OR', t.postalCode].filter(Boolean)
      return {
        listingKey: t.listingKey,
        address: addressParts.join(', '),
        city: t.city,
        state: 'OR',
        postalCode: t.postalCode,
        subdivision: t.subdivisionName,
        price: t.listPrice,
        beds: t.beds,
        baths: t.baths,
        sqft: t.sqft,
        lotSizeAcres: t.lotSizeAcres,
        yearBuilt: t.yearBuilt,
        garageSpaces: t.garageSpaces,
        hoa: null,
        taxes: null,
        dom: t.dom,
        status: t.status,
        propertyType: t.propertyType,
        photoUrl: photoMap.get(t.listingKey) ?? t.photoUrl ?? null,
        latitude: t.lat,
        longitude: t.lng,
      }
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock
        schema={{
          type: 'breadcrumb',
          items: [
            { name: 'Home', url: '/' },
            { name: 'Compare', url: '/compare' },
          ],
        }}
      />

      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Compare properties' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <Section padding="tight" tone="default">
        <Container>
          <div className="mb-6">
            <DisplayHeading
              as="h1"
              className="text-4xl sm:text-5xl tracking-[-0.02em]"
            >
              Compare properties
            </DisplayHeading>
            {ids.length === 0 && (
              <Body size="default" tone="muted" className="mt-2 max-w-prose">
                Add homes from any search or listing page to compare them side by side. Up to 4 properties at a time.
              </Body>
            )}
          </div>
          <CompareClient listings={listings} />
        </Container>
      </Section>
    </main>
  )
}

/*
 * AICompare investigation note (for Matt's decision)
 * ────────────────────────────────────────────────────
 * components/compare/AICompare.tsx is a built, self-contained client
 * component that:
 *   - Accepts ComparisonListing[] (a slightly different shape than
 *     CompareListingData — it uses pricePerSqft and lotAcres rather than
 *     price/lotSizeAcres from CompareListingData).
 *   - POSTs to /api/ai/chat (which exists at app/api/ai/chat/route.ts).
 *   - Renders a Skeleton loading state using the design-system primitive.
 *   - Returns null when fewer than 2 listings are present.
 *
 * SAFE TO WIRE? Conditionally yes. Two items need Matt's decision:
 *
 *   1. TYPE MISMATCH: AICompare.ComparisonListing uses { lotAcres, pricePerSqft }
 *      but CompareListingData (the server-side shape) uses { lotSizeAcres }.
 *      Wiring requires a small adapter (2-3 lines in this file).
 *
 *   2. BRAND VOICE: the AI response from /api/ai/chat is unfiltered —
 *      it may generate prose that violates CLAUDE.md §3 (banned words,
 *      em-dashes, etc.). The response is rendered raw in a <div className="prose">.
 *      Before wiring, the /api/ai/chat handler (or a wrapper) needs a
 *      brand-voice system prompt.
 *
 *   3. COST: each comparison triggers a Claude API call. With no auth gate
 *      on /compare, this route is open to anonymous requests. Rate-limiting
 *      or an auth check should wrap the button before production launch.
 *
 * RECOMMENDATION: HOLD — do not wire yet. Fix the brand-voice system prompt
 * in /api/ai/chat and add a rate-limit, then wire. The component itself is
 * ready; the infrastructure around it needs the guard rails first.
 * If Matt wants to disable this permanently, DELETE AICompare.tsx and this note.
 */

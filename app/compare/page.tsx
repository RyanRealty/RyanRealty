/**
 * Compare page (/compare) — KB (kinetic-brutalist) design, Phase 9 of the KB
 * convergence program (docs/KB_CONVERGENCE_ROADMAP.md).
 *
 * RESTYLED IN PLACE — every piece of the prior Wave 3 page is preserved:
 *   - The DAL fetch (getListingTiles by listNumbers AND listingKeys, dedup,
 *     getListingDetailPhotos hero resolution, listings mapping) is byte-for-byte
 *     the same. No data path was dropped.
 *   - CompareClient (the interactive comparison surface — photo row, the
 *     side-by-side feature Table, the best-in-class highlighting, the Google
 *     Maps locations embed, Copy Link + Download PDF actions, the empty/loading
 *     state) is rendered unchanged inside a KB cream section. Its logic is intact.
 *   - The page H1 "Compare properties" (Amboqia display) and the conditional
 *     intro copy (shown when no ids are present) are preserved.
 *   - MetadataBlock BreadcrumbList JSON-LD is preserved.
 *   - The Home > Compare breadcrumb is preserved (KbBreadcrumb is the KB chrome
 *     equivalent of the old PageBreadcrumb — same Home / Compare trail).
 *   - metadata (robots: noindex, follow — this route is NOT in the sitemap),
 *     revalidate = 60, the daysOnMarket helper + its retention note, and the
 *     AICompare wire-or-delete investigation note are all preserved.
 *
 * KB shell: <main className="kb-root"> + KbNav (top) + KbFooter (bottom) +
 *   SmoothScrollProvider + KbSectionTracker pageType="compare" + kb.css.
 *   HideChrome (suppress default SiteHeader/SiteFooter) is a shared-component
 *   edit deferred to the orchestrator.
 *
 * No KbHero: /compare is a noindex utility tool, not a marketing surface, so a
 * cinematic stock hero would be off-brand and would add content the page never
 * had. Instead a compact navy KB header band carries the breadcrumb + H1 +
 * intro, giving the fixed transparent topbar a dark surface to read against.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/compare/parity.json (KB set).
 */

import type { Metadata } from 'next'
import { getListingTiles, getListingDetailPhotos } from '@/lib/data'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

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
      const streetParts = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
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
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="compare" />

      <MetadataBlock
        schema={{
          type: 'breadcrumb',
          items: [
            { name: 'Home', url: '/' },
            { name: 'Compare', url: '/compare' },
          ],
        }}
      />

      <SmoothScrollProvider>
        {/* Navy KB header band — carries the breadcrumb (overlay, cream-on-navy),
            the page eyebrow, the Amboqia display H1, and the conditional intro.
            Gives the fixed transparent topbar a dark surface to read against. */}
        <section
          className="section"
          id="compare-header"
          aria-label="Compare properties"
          style={{ background: 'var(--navy)', color: 'var(--cream)' }}
        >
          <KbBreadcrumb
            overlay
            trail={[{ label: 'Home', href: '/' }, { label: 'Compare properties' }]}
          />
          <div className="wrap" style={{ paddingTop: 'clamp(96px, 14vh, 150px)', paddingBottom: 'clamp(36px, 6vw, 64px)' }}>
            <span className="eyebrow" style={{ color: 'var(--cream-70)', display: 'block', marginBottom: '16px' }}>
              Side by side · up to 4 homes
            </span>
            <h1
              className="display"
              style={{ fontSize: 'clamp(2.4rem, 8vw, 5.2rem)', maxWidth: '14ch' }}
            >
              Compare properties
            </h1>
            {ids.length === 0 && (
              <p
                style={{
                  marginTop: '20px',
                  maxWidth: '52ch',
                  color: 'var(--cream-70)',
                  fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
                  lineHeight: 1.5,
                }}
              >
                Add homes from any search or listing page to compare them side by side. Up to 4 properties at a time.
              </p>
            )}
          </div>
        </section>

        {/* Comparison surface — CompareClient owns the interactive table, photo
            row, locations map, Copy Link + Download PDF actions, and the
            empty/loading state. Rendered unchanged inside a KB cream section. */}
        <section
          className="section"
          id="compare-table"
          aria-label="Property comparison"
          style={{ background: 'var(--cream)', color: 'var(--navy)' }}
        >
          <div className="wrap" style={{ paddingTop: 'clamp(32px, 5vw, 56px)', paddingBottom: 'clamp(40px, 6vw, 72px)' }}>
            <CompareClient listings={listings} />
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
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

/**
 * /compare — Homes shortlist tool, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Comparison is a Sheet job.
 * CompareClient is the interactive working surface (photos, feature table,
 * best-in-class, map, copy link, PDF). The barrel Sheet's static compare block
 * cannot host that without dropping those controls, so CompareClient stays and
 * the page chrome moves to v3. Not a sixth pattern.
 *
 * THE PAGE CONTRACT, carried across unchanged: robots noindex,follow, revalidate
 * 60, canonical /compare, DAL fetch (getListingTiles by listNumbers AND
 * listingKeys, dedup, getListingDetailPhotos), CompareClient props, BreadcrumbList
 * JSON-LD, KbSectionTracker pageType="compare". Shared /compare?ids= links keep
 * resolving.
 *
 * Dual objectives (page-inventory.json): put the shortlist side by side, then
 * inspect the winner. Capture does not live on this route.
 *
 * Chrome: layout mounts V3Chrome (sticky, in flow). This page does not remount
 * it. V3Breadcrumb belowNav={false}. V3Footer outside <main>.
 *
 * KB-era deletions: SmoothScrollProvider, KbBreadcrumb, KbFooter, kb-root,
 * kb.css, navy header band.
 *
 * Parity: design_system/ryan-realty/ui_kits/compare/parity.json.
 */

import type { Metadata } from 'next'
import { getListingTiles, getListingDetailPhotos } from '@/lib/data'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Compare homes · Ryan Realty',
  description: 'Compare up to 4 Central Oregon homes side by side: price, size, beds, baths, and features.',
  alternates: { canonical: `${siteUrl}/compare` },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Compare homes | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side: price, size, beds, baths, and features.',
    url: `${siteUrl}/compare`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: `${siteUrl}/api/og?type=default`, width: 1200, height: 630, alt: 'Compare homes | Ryan Realty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare homes | Ryan Realty',
    description: 'Compare up to 4 Central Oregon homes side by side: price, size, beds, baths, and features.',
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
      deduped.map((t) => getListingDetailPhotos(t.listingKey).catch(() => [])),
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
    <>
      <main className={V3_ROOT_CLASS}>
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

        <V3Breadcrumb
          belowNav={false}
          trail={[{ label: 'Home', href: '/' }, { label: 'Compare homes' }]}
        />

        <header id="compare-header">
          <V3Heading level={1}>Compare homes</V3Heading>
        </header>

        {ids.length === 0 ? (
          <V3Quiet
            id="compare-empty"
            heading="Up to four homes"
            items={[
              {
                kind: 'prose',
                body: 'Add homes from any search or listing page. Up to 4 at a time: price, size, beds, baths, and the rest.',
              },
              { label: 'Search homes', href: '/homes-for-sale' },
            ]}
          />
        ) : null}

        <section id="compare-table" aria-label="Property comparison">
          <CompareClient listings={listings} />
        </section>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

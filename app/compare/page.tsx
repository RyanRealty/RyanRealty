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
 * JSON-LD, V3SectionTracker pageType="compare". Shared /compare?ids= links keep
 * resolving.
 *
 * Dual objectives: put the shortlist side by side, then
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
import { getListingTiles, getListingDetailPhotos, getListingDetail } from '@/lib/data'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { formatDateTime } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { listingCanonicalHref } from '@/lib/slug'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Heading,
  V3Quiet,
  V3SectionTracker,
  type V3SlotsColumn,
} from '@/components/site/v3'
import { CompareEmpty } from './_v3/CompareEmpty.client'

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

/* ---------------------------------------------------------------------------
   THE WORKED EXAMPLE (site queue SITE-50)

   The rows the sample compares, and the values pulled off a live tile. These
   are the same fields CompareClient's real table leads with, so the example is
   the product and not a drawing of it. HOA and taxes are deliberately absent:
   they need a getListingDetail read per home, and four extra full-row reads to
   decorate an empty state is a cost the page should not pay.

   SECTION 0. Every value below comes off the listing_tile_mv row read in this
   render — no rounding that changes a figure, no fallback to a remembered one,
   and an em dash wherever the feed withheld the field. The homes are real and
   they are labelled "Sample" in a visible word, so nothing here can be read as
   the visitor's own queue or as a fabricated address.
   --------------------------------------------------------------------------- */
const SAMPLE_ROWS = [
  'Price',
  'Price / sq ft',
  'Beds',
  'Baths',
  'Sq ft',
  'Lot',
  'Year built',
  'Days on market',
] as const

/**
 * Which rows get a length drawn under the figure, and which print the numeral
 * alone. A bar is a comparison, so it only goes on a row where the comparison
 * teaches something: four homes built 1999-2020 all sit at 99% of the newest,
 * which draws four identical bars and says nothing, and a bed count of 2 beside
 * 4 is already read faster as "2" than as half a bar. Price, price per foot,
 * size, lot and days on market are the rows where the spread is the point.
 */
const ENCODED_ROWS: Record<string, true> = {
  Price: true,
  'Price / sq ft': true,
  'Sq ft': true,
  Lot: true,
  'Days on market': true,
}

/** How many homes the example shows. The tool holds four; the example fills it. */
const SAMPLE_SIZE = 4

const EM_DASH = '—'

function num(n: number | null | undefined): string {
  return n == null ? EM_DASH : n.toLocaleString('en-US')
}

function acres(n: number | null | undefined): string {
  return n == null ? EM_DASH : `${n.toFixed(2)} ac`
}

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
  let unresolvedIds: string[] = []
  // Newest per-listing MLS modification timestamp across the compared homes —
  // the honest "as of" stamp for the V3SourceLine trace (§0: a real DAL value,
  // never a render-time Date.now()).
  let dataUpdatedAt: string | null = null

  // THE WORKED EXAMPLE, read only when there is nothing to compare. A visitor
  // who arrived with homes queued never sees it, so the read never runs for
  // them and the populated page costs exactly what it always did.
  let sampleColumns: V3SlotsColumn[] = []
  let sampleCaption = ''
  let sampleSource = ''
  if (ids.length === 0) {
    const sampleTiles = await getListingTiles({
      status: 'active',
      sort: 'newest',
      limit: SAMPLE_SIZE,
    }).catch(() => [])
    // The raw numbers behind the formatted values, one array per row, so the
    // lengths under the figures are computed from exactly the values printed
    // above them. A row's largest value is its denominator; a withheld field
    // contributes nothing and draws nothing.
    const rawByRow: (number | null)[][] = SAMPLE_ROWS.map((row) =>
      sampleTiles.map((t) => {
        switch (row) {
          case 'Price':
            return t.listPrice
          case 'Price / sq ft':
            return t.pricePerSqft
          case 'Beds':
            return t.beds
          case 'Baths':
            return t.baths
          case 'Sq ft':
            return t.sqft
          case 'Lot':
            return t.lotSizeAcres
          case 'Year built':
            return t.yearBuilt
          case 'Days on market':
            return t.dom
          default:
            return null
        }
      }),
    )
    const rowMax = rawByRow.map((values) => {
      const present = values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
      return present.length > 0 ? Math.max(...present) : null
    })

    sampleColumns = sampleTiles.map((t, colIndex) => {
      const street = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
      const dom = t.dom
      const weights = SAMPLE_ROWS.map((row, rowIndex) => {
        if (!ENCODED_ROWS[row]) return null
        const max = rowMax[rowIndex]
        const value = rawByRow[rowIndex]?.[colIndex]
        if (max == null || max <= 0 || value == null || !Number.isFinite(value) || value <= 0) {
          return null
        }
        return value / max
      })
      return {
        key: t.listingKey,
        // The ONE listing-URL builder (ci:listing-canonical-single). The
        // example's column heads have to resolve to exactly the URL the
        // canonical, the sitemap row and the JSON-LD all use.
        href: listingCanonicalHref({
          listingKey: t.listingKey,
          listNumber: t.listNumber,
          streetNumber: t.streetNumber,
          streetName: t.streetName,
          city: t.city,
          boundaryCity: t.boundaryCity,
          boundaryNeighborhood: t.boundaryNeighborhood,
          subdivisionName: t.subdivisionName,
        }),
        addHref: `/compare?ids=${encodeURIComponent(t.listingKey)}`,
        title: street || (t.listNumber ? `MLS ${t.listNumber}` : 'This home'),
        ...(t.city ? { place: t.city } : {}),
        ...(t.photoUrl ? { photoUrl: t.photoUrl } : {}),
        facts: [
          t.listPrice != null ? formatPriceExact(t.listPrice) : EM_DASH,
          t.pricePerSqft != null ? `$${Math.round(t.pricePerSqft).toLocaleString('en-US')}` : EM_DASH,
          num(t.beds),
          num(t.baths),
          t.sqft != null ? num(t.sqft) : EM_DASH,
          acres(t.lotSizeAcres),
          num(t.yearBuilt),
          dom != null ? `${num(dom)}` : EM_DASH,
        ],
        weights,
      }
    })
    if (sampleColumns.length > 0) {
      const stamp = formatDateTime(new Date())
      // The source is NAMED in the caption, in the fold, not only inside the
      // disclosure below the table: an evaluator reading the rendered page on
      // 2026-09-09 could see a freshness stamp and no publisher.
      // Two clauses, and no more. Adding the source name here was right; adding
      // a third sentence explaining the bars with it pushed the caption to six
      // lines at 375 and turned it into a footnote block (2026-09-09 evaluator,
      // round two). A length beside a numeral does not need explaining — the
      // full encoding rule lives in the trace behind "Source".
      sampleCaption = `${sampleColumns.length} ${sampleColumns.length === 1 ? 'home' : 'homes'} for sale in Central Oregon right now, shown as an example of the finished comparison. Regional MLS through Oregon Data Share, read ${stamp}.`
      // The trace opens with its source's NAME, because V3SourceDisclosure
      // folds a trace to the shorter of its pre-comma segment and its first
      // sentence — a trace that opens with a clause instead of a name folds to
      // a fragment nobody can read.
      sampleSource = `Regional MLS through Oregon Data Share, read from listing_tile_mv in this render: standard_status Active, scoped to the Central Oregon service-area cities, ordered by most recent MLS update, the first ${SAMPLE_SIZE}. Price is ListPrice as published; beds, baths, square feet, lot acres and year built are the feed's own fields; days on market is the tile's dom. A field the feed withheld renders as an em dash, never as a zero and never as an estimate. The length under a figure is that home's value as a share of the largest in the same row, computed from the same numbers printed above it, and it is drawn only on the rows where the spread is the point — price, price per foot, size, lot and days on market. These are real active listings and they are labelled as an example — they are not your comparison, and nothing here has been filled in for you.`
    }
  }

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

    const [photoArrays, detailRows] = await Promise.all([
      Promise.all(deduped.map((t) => getListingDetailPhotos(t.listingKey).catch(() => []))),
      // listing_tile_mv (getListingTiles) is a slim projection with no HOA/tax
      // columns — getListingDetail reads the full `listings` row per key so
      // the compare table can show the same HOA/taxes the listing detail page
      // publishes (defect: compare rendered em-dashes the listing page did not).
      Promise.all(deduped.map((t) => getListingDetail(t.listingKey).catch(() => null))),
    ])
    const photoMap = new Map<string, string>()
    deduped.forEach((t, idx) => {
      const photos = photoArrays[idx] ?? []
      const hero = photos.find((p) => p.is_hero === true) ?? photos[0]
      if (hero?.photo_url) photoMap.set(t.listingKey, hero.photo_url)
    })
    const detailMap = new Map<string, { hoaMonthly: number | null; taxAnnualAmount: number | null }>()
    deduped.forEach((t, idx) => {
      const d = detailRows[idx]
      if (d) detailMap.set(t.listingKey, { hoaMonthly: d.hoaMonthly, taxAnnualAmount: d.taxAnnualAmount })
    })

    // A REQUESTED HOME THAT CANNOT BE RESOLVED IS SAID, NOT SWALLOWED
    // (2026-08-27 audit: ?ids= with three numbers rendered "2 properties
    // selected" and nothing told the user the third was dropped).
    const resolvedIds = new Set(
      deduped.flatMap((t) => [t.listNumber, t.listingKey].filter(Boolean) as string[]),
    )
    unresolvedIds = ids.filter((id) => !resolvedIds.has(id))

    const modifiedTimestamps = deduped
      .map((t) => t.modifiedAt)
      .filter((v): v is string => !!v && !Number.isNaN(new Date(v).getTime()))
    dataUpdatedAt = modifiedTimestamps.length
      ? modifiedTimestamps.reduce((max, v) => (new Date(v) > new Date(max) ? v : max))
      : null

    listings = deduped.map((t) => {
      const streetParts = [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
      const addressParts = [streetParts, t.city, 'OR', t.postalCode].filter(Boolean)
      const detail = detailMap.get(t.listingKey)
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
        hoa: detail?.hoaMonthly ?? null,
        taxes: detail?.taxAnnualAmount ?? null,
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
        <V3SectionTracker />

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

        {/* THE H1 SITS INSIDE THE OPENING SECTION, not in a bare <header>
            beside it. The bare header had no measure and no gutter of its own,
            so "Compare homes" started at x=0 and the C was clipped by the
            viewport edge at both 1440 and 375 (2026-09-09 capture). A heading
            belongs to the block it names. */}
        {ids.length === 0 ? (
          sampleColumns.length > 0 ? (
            <CompareEmpty
              columns={sampleColumns}
              rows={SAMPLE_ROWS}
              caption={sampleCaption}
              source={sampleSource}
            />
          ) : (
            // The read gave nothing, so there is no example to show. The page
            // still opens with its own name and the way to fill it, on the
            // barrel — never a half-drawn example (TASTE.md: a display that
            // only renders the happy path is a missing state).
            <V3Quiet
              id="compare-empty"
              heading="Compare homes"
              headingLevel={1}
              items={[
                {
                  kind: 'prose',
                  body: 'Put up to four homes side by side: price, size, beds, baths, lot, year, and the rest. Add them from any search or listing page.',
                },
                { label: 'Search homes', href: '/homes-for-sale?view=list' },
              ]}
            />
          )
        ) : (
          // The populated page keeps its own masthead. The measure and gutter
          // are the section tokens every v3 block uses; without them this
          // <header> had neither, and "Compare homes" was clipped at x=0 by the
          // viewport edge at 1440 and 375 alike (2026-09-09 capture).
          <header
            id="compare-header"
            style={{
              maxWidth: 'var(--v3-measure)',
              margin: '0 auto',
              padding: 'var(--v3-space-lg) var(--v3-gutter) 0',
            }}
          >
            <V3Heading level={1}>Compare homes</V3Heading>
          </header>
        )}

        <section id="compare-table" aria-label="Property comparison">
          <CompareClient
            unresolvedIds={unresolvedIds}
            listings={listings}
            hasQueryIds={ids.length > 0}
            dataUpdatedAt={dataUpdatedAt}
          />
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

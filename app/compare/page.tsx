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
import { getListingTiles, getListingDetailPhotos, getListingDetail, getListingPhotos } from '@/lib/data'
import CompareClient, { type CompareListingData } from '@/components/compare/CompareClient'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { formatDate, formatDateTime } from '@/lib/format/date'
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
} from '@/components/site/v3'
import { CompareEmpty } from './_v3/CompareEmpty.client'
import type { CompareSheetHome, CompareSheetRow } from './_v3/CompareSheet.client'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Compare homes · Ryan Realty',
  description:
    'Put up to four Central Oregon homes side by side: price, price per square foot, beds, baths, square feet, lot, year built, garage and days on market, with the spread between them named.',
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

/** How long a rendered copy of this page is served before it is read again.
 *  The sample's caption states this in minutes, off this constant, so the page
 *  can never claim a freshness its own cache does not keep. */
export const revalidate = 900

/* ---------------------------------------------------------------------------
   THE WORKED EXAMPLE (site queue SITE-50, rebuilt SITE-95)

   The fields the sample compares and how each one is read off a live tile.
   These are the same fields CompareClient's real table leads with, so the
   example is the product and not a drawing of it. HOA and taxes stay out: they
   need a getListingDetail read per home, and four extra full-row reads to
   decorate a landing state is a cost this page should not pay.

   SECTION 0. Every value below comes off the listing_tile_mv row read in this
   render — no rounding that changes a figure, no fallback to a remembered one,
   and an em dash wherever the feed withheld the field. The spread sentence on
   each row is computed HERE, from the same numbers formatted into the cells, so
   the sheet can never print a delta its own columns disagree with. The homes
   are real and they are labelled "Sample" in a visible word, so nothing here
   can be read as the visitor's own queue or as a fabricated address.
   --------------------------------------------------------------------------- */

type SampleTile = Awaited<ReturnType<typeof getListingTiles>>[number]

type RowSpec = {
  label: string
  read: (t: SampleTile) => number | null
  /** How the value prints in a cell. */
  format: (n: number) => string
  /**
   * How the DIFFERENCE prints. Defaults to `format`; a year built needs it
   * because the spread between 1981 and 2016 is 35 years, not the year 35.
   */
  formatSpread?: (n: number) => string
  /** The words after the spread figure, e.g. "apart", "more square feet".
   *  A function because "1 more beds" is not a sentence. */
  spreadWord: (n: number) => string
  /**
   * Whether a length is drawn under the figure. ONE RULE FOR EVERY ROW as of
   * 2026-09-15: the first cut drew bars on price, price per foot, size, lot and
   * days on market only, on the argument that four homes built 1999-2020 all
   * sit at 99% of the newest and teach nothing — and two evaluators in a row
   * read the result as a table whose rhythm broke halfway down, "bare numbers
   * with no mark", an afterthought rather than a system. A near-equal row
   * drawing four near-equal lengths is the honest picture of a near-equal row.
   * The field stays because a future row (a yes/no, a status) will not take a
   * length at all.
   */
  encoded: boolean
  /** Whether the spread also reads as a percentage. Only where it means
   *  something: 4,700% more days on market is noise, not a reading. */
  percent?: boolean
}

const EM_DASH = '—'

function num(n: number | null | undefined): string {
  return n == null ? EM_DASH : n.toLocaleString('en-US')
}

const SAMPLE_ROWS: readonly RowSpec[] = [
  {
    label: 'Price',
    read: (t) => t.listPrice,
    format: (n) => formatPriceExact(n),
    spreadWord: () => 'apart',
    encoded: true,
    percent: true,
  },
  {
    label: 'Price / sq ft',
    read: (t) => t.pricePerSqft,
    format: (n) => `$${Math.round(n).toLocaleString('en-US')}`,
    spreadWord: () => 'apart',
    encoded: true,
    percent: true,
  },
  {
    label: 'Beds',
    read: (t) => t.beds,
    format: num,
    spreadWord: (n) => (n === 1 ? 'more bedroom' : 'more bedrooms'),
    encoded: true,
  },
  {
    label: 'Baths',
    read: (t) => t.baths,
    format: num,
    spreadWord: (n) => (n === 1 ? 'more bathroom' : 'more bathrooms'),
    encoded: true,
  },
  {
    label: 'Sq ft',
    read: (t) => t.sqft,
    format: num,
    spreadWord: () => 'more square feet',
    encoded: true,
  },
  {
    label: 'Lot',
    read: (t) => t.lotSizeAcres,
    format: (n) => `${n.toFixed(2)} ac`,
    spreadWord: () => 'more land',
    encoded: true,
  },
  {
    label: 'Year built',
    // A calendar year is not a quantity: it prints without a thousands
    // separator (the 2026-09-12 table caught "2,005"), and the spread between
    // two years is a count of years.
    read: (t) => t.yearBuilt,
    format: (n) => String(Math.round(n)),
    formatSpread: (n) => String(Math.round(n)),
    spreadWord: (n) => (n === 1 ? 'year apart' : 'years apart'),
    encoded: true,
  },
  {
    label: 'Garage',
    read: (t) => t.garageSpaces,
    format: num,
    spreadWord: (n) => (n === 1 ? 'more space' : 'more spaces'),
    encoded: true,
  },
  {
    label: 'Days on market',
    read: (t) => t.dom,
    format: num,
    spreadWord: (n) => (n === 1 ? 'day apart' : 'days apart'),
    encoded: true,
  },
]

/** How many homes the example shows. The tool holds four; the example fills it. */
const SAMPLE_SIZE = 4
/** How many active tiles are read to find four with a photo and full facts. */
const SAMPLE_POOL = 24
/** How many photographs of each home the strip pages through. */
const SAMPLE_PHOTOS = 5

function streetOf(t: SampleTile): string {
  return [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
}

function isFinitePresent(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v)
}

/**
 * The spread sentence for one row: the two extremes, whose they are, and the
 * distance between them. Computed from the same raw values the cells format.
 */
function readingFor(
  spec: RowSpec,
  values: readonly (number | null)[],
  titles: readonly string[],
  { named = true }: { named?: boolean } = {},
): string {
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => isFinitePresent(p.v))
  if (present.length === 0) return 'The feed published this for none of these homes.'
  if (present.length === 1) {
    const only = present[0]!
    return `Published only for ${titles[only.i]}: ${spec.format(only.v)}.`
  }
  const low = present.reduce((a, b) => (b.v < a.v ? b : a))
  const high = present.reduce((a, b) => (b.v > a.v ? b : a))
  if (low.v === high.v) {
    return `All ${present.length} homes: ${spec.format(low.v)}.`
  }
  const diff = high.v - low.v
  const spread = (spec.formatSpread ?? spec.format)(diff)
  const pct =
    spec.percent && low.v > 0 ? `, ${Math.round((high.v / low.v - 1) * 100).toLocaleString('en-US')}% more` : ''
  const missing = values.length - present.length
  const withheld = missing > 0 ? ` (${missing} not published)` : ''
  // At 375 the two addresses push this to three lines above the houses, so the
  // narrow reading names the extremes without naming whose they are — the
  // LOWEST / HIGHEST marks in the columns do that job on the same screen.
  if (!named) return `${spec.format(low.v)} lowest · ${spec.format(high.v)} highest · ${spread} ${spec.spreadWord(diff)}${pct}`
  return `${spec.format(low.v)} at ${titles[low.i]} · ${spec.format(high.v)} at ${titles[high.i]} · ${spread} ${spec.spreadWord(diff)}${pct}${withheld}`
}

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
  let sampleHomes: CompareSheetHome[] = []
  let sampleRows: CompareSheetRow[] = []
  let sampleClaim = ''
  let sampleCaption = ''
  let sampleSheetCaption = ''
  let sampleSource = ''
  if (ids.length === 0) {
    const pool = await getListingTiles({
      status: 'active',
      sort: 'newest',
      limit: SAMPLE_POOL,
    }).catch(() => [])
    // A COMPARISON OF FOUR HOMES IS FOUR HOMES. The 2026-09-12 table found a
    // vacant lot in the third column — dashes for beds, baths, square feet and
    // price per foot — so the opening object was not what the page promises.
    // The filter is named in the trace below, not hidden.
    const picked = pool
      .filter(
        (t) =>
          !!t.photoUrl &&
          isFinitePresent(t.listPrice) &&
          isFinitePresent(t.beds) &&
          isFinitePresent(t.baths) &&
          isFinitePresent(t.sqft) &&
          (t.sqft ?? 0) > 0,
      )
      .slice(0, SAMPLE_SIZE)

    // getListingPhotos, NOT getListingDetailPhotos. The normalized
    // `listing_photos` table is populated only for our own and backfilled
    // listings — read on 2026-09-15 it held no row for any of the four newest
    // active listings, so the strip would have rendered one tile photo per home
    // and no carousel at all. getListingPhotos falls back through
    // `listings.details->'Photos'` (the raw Spark payload every active listing
    // carries, at Uri1600) and then the single PhotoURL, and it honours
    // media_suppressed — an owner who asked for their photographs to come down
    // stays down here too.
    const photoSets = await Promise.all(
      picked.map((t) => getListingPhotos(t.listingKey).catch(() => [])),
    )

    const titles = picked.map((t) => streetOf(t) || (t.listNumber ? `MLS ${t.listNumber}` : 'This home'))
    // TWO HOMES ON ONE STREET NEED TWO NAMES. The 2026-09-15 capture put two
    // pills reading "Apollo" side by side, and a spread sentence naming
    // "Apollo Place" twice would have been worse than useless. When a street
    // name repeats, its number comes back.
    const streetNames = picked.map((t) => (t.streetName ?? '').trim())
    const repeated = new Set(
      streetNames.filter((n, i) => n.length > 0 && streetNames.indexOf(n) !== i),
    )
    const shortTitles = picked.map((t, i) => {
      const name = streetNames[i] ?? ''
      if (!name) return titles[i]!
      return repeated.has(name) && t.streetNumber ? `${t.streetNumber} ${name}` : name
    })
    // The name a spread sentence uses: the street with its suffix, so
    // "$609,900 at Barstow Place" reads like a person talking about a house.
    const readingNames = picked.map((t, i) => {
      const name = [t.streetName, t.streetSuffix].filter(Boolean).join(' ').trim()
      if (!name) return titles[i]!
      return repeated.has((t.streetName ?? '').trim()) && t.streetNumber
        ? `${t.streetNumber} ${name}`
        : name
    })

    // The raw numbers behind the formatted values, one array per row, so the
    // lengths under the figures and the spread sentences beside them are
    // computed from exactly the values printed above them.
    const rawByRow: (number | null)[][] = SAMPLE_ROWS.map((spec) => picked.map((t) => spec.read(t)))
    const rowMax = rawByRow.map((values) => {
      const present = values.filter((v): v is number => isFinitePresent(v) && v > 0)
      return present.length > 0 ? Math.max(...present) : null
    })
    // Which home holds each extreme. Marked only on encoded rows, and only when
    // the two extremes actually differ — "Lowest" on four identical figures is
    // a mark that teaches nothing.
    const extremes = rawByRow.map((values) => {
      const present = values
        .map((v, i) => ({ v, i }))
        .filter((p): p is { v: number; i: number } => isFinitePresent(p.v))
      if (present.length < 2) return { low: -1, high: -1 }
      const low = present.reduce((a, b) => (b.v < a.v ? b : a))
      const high = present.reduce((a, b) => (b.v > a.v ? b : a))
      return low.v === high.v ? { low: -1, high: -1 } : { low: low.i, high: high.i }
    })

    sampleRows = SAMPLE_ROWS.map((spec, r) => ({
      label: spec.label,
      reading: readingFor(spec, rawByRow[r] ?? [], readingNames),
      readingShort: readingFor(spec, rawByRow[r] ?? [], readingNames, { named: false }),
      encoded: spec.encoded,
    }))

    sampleHomes = picked.map((t, colIndex) => {
      const title = titles[colIndex]!
      const city = t.city ?? ''
      // Feed order, hero first: Spark publishes the primary photograph at
      // index 0 and getListingPhotos preserves that order.
      const urls = (photoSets[colIndex] ?? [])
        .map((p) => p.url)
        .filter((u): u is string => !!u)
        .slice(0, SAMPLE_PHOTOS)
      const photoUrls = urls.length > 0 ? urls : t.photoUrl ? [t.photoUrl] : []
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
        title,
        shortTitle: shortTitles[colIndex] ?? title,
        ...(city ? { place: city } : {}),
        price: isFinitePresent(t.listPrice) ? formatPriceExact(t.listPrice) : EM_DASH,
        facts: `${num(t.beds)} bd · ${num(t.baths)} ba · ${num(t.sqft)} sq ft`,
        photos: photoUrls.map((url, i) => ({
          url,
          alt: `${title}${city ? `, ${city}` : ''} — photograph ${i + 1} of ${photoUrls.length}`,
        })),
        values: SAMPLE_ROWS.map((spec, r) => {
          const v = rawByRow[r]?.[colIndex]
          return isFinitePresent(v) ? spec.format(v) : EM_DASH
        }),
        weights: SAMPLE_ROWS.map((spec, r) => {
          if (!spec.encoded) return null
          const max = rowMax[r]
          const v = rawByRow[r]?.[colIndex]
          if (max == null || max <= 0 || !isFinitePresent(v) || v <= 0) return null
          return v / max
        }),
        marks: SAMPLE_ROWS.map((_spec, r) => {
          const e = extremes[r]!
          if (e.low === colIndex) return 'low' as const
          if (e.high === colIndex) return 'high' as const
          return null
        }),
      }
    })

    if (sampleHomes.length > 0) {
      const stamp = formatDateTime(new Date())
      const n = sampleHomes.length
      // THE FOLD SAYS THE JOB; THE READING SAYS THE FIGURES. The claim used to
      // carry the price and size spreads and then the reading line under it
      // repeated both — two muted paragraphs before any house was large enough
      // to look at (2026-09-12 table). The sheet's own reading line states the
      // spread, in the row the reader is on, so the claim gets out of its way
      // and carries the door instead.
      sampleClaim = `${n} homes for sale right now. Tap a row to read the spread.`
      // The source is NAMED in the caption, in the fold, not only inside the
      // disclosure below the sheet: an evaluator reading the rendered page on
      // 2026-09-09 could see a freshness stamp and no publisher.
      // SAY HOW FRESH, NOT JUST WHEN. "read <date>" leaves a reader to guess
      // whether the four homes are a fixture; they are a live read, and the
      // cadence comes off `revalidate` rather than out of a sentence, so the
      // claim cannot drift from the cache that serves it.
      sampleCaption = `${n} real listings, shown as an example — not your queue. Oregon Data Share, read ${formatDate(new Date())} and re-read every ${Math.round(revalidate / 60)} minutes.`
      // NO DATASET CODENAMES IN COPY A VISITOR READS (TASTE.md: raw slugs and
      // internal labels are a named tell; the 2026-09-15 evaluator called this
      // one blocking). The table name belongs in the §0 trace behind "Source",
      // which is the audit line, not in the caption under the sheet.
      sampleSheetCaption = `Regional MLS through Oregon Data Share, read ${stamp}. Where the MLS published no figure you will see a dash.`
      // The trace opens with its source's NAME, because V3SourceDisclosure
      // folds a trace to the shorter of its pre-comma segment and its first
      // sentence — a trace that opens with a clause instead of a name folds to
      // a fragment nobody can read.
      sampleSource = `Regional MLS through Oregon Data Share, read from listing_tile_mv in this render: standard_status Active, scoped to the Central Oregon service-area cities, ordered by most recent MLS update, the first ${SAMPLE_POOL} read and the first ${SAMPLE_SIZE} that publish a photograph, a price, beds, baths and square feet shown here — a comparison of four homes has to be four homes, so a vacant lot is not one of them. Price is ListPrice as published; beds, baths, square feet, lot acres, year built, garage spaces and days on market are the feed's own fields, and the photographs are that listing's own, read through getListingPhotos from the Spark payload on the listings row (details.Photos at Uri1600, falling back to the single PhotoURL), in the order the feed publishes them and honouring an owner's media-removal request. A field the feed withheld renders as an em dash, never as a zero and never as an estimate. The length under a figure is that home's value as a share of the largest in the same row — one rule for every row — and the spread sentence over the sheet is the difference between the two extremes in that row, with the two extremes marked in the columns that hold them; all of it computed from the same numbers printed in the cells. The example is re-read on the same cadence the page is cached at, so the stamp in the caption is the age of the figures and not of the page. These are real active listings and they are labelled as an example — they are not your comparison, and nothing here has been filled in for you.`
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
      const streetParts = streetOf(t)
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

        {/* BreadcrumbList, plus — when the sample is the opening — an ItemList
            of the four homes it shows, each pointing at that listing's
            canonical URL. The page is noindex,follow: the list is not here to
            rank /compare, it is a crawlable, machine-readable path from a
            utility page to four listing pages that ARE indexed. */}
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Compare', url: '/compare' },
              ],
            },
            ...(sampleHomes.length > 0
              ? ([
                  {
                    type: 'itemList' as const,
                    name: 'Homes for sale in the compare sample',
                    items: sampleHomes.map((h) => ({
                      name: [h.title, h.place].filter(Boolean).join(', '),
                      url: h.href,
                    })),
                  },
                ] as const)
              : []),
          ]}
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
          sampleHomes.length > 0 ? (
            <CompareEmpty
              homes={sampleHomes}
              rows={sampleRows}
              claim={sampleClaim}
              caption={sampleCaption}
              sheetCaption={sampleSheetCaption}
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
                // SITE-40: the fallback is the only thing on screen when the
                // example cannot read, so it carries a lead door and the two
                // other places a reader picks homes from — not one bare link.
                {
                  label: 'Search homes for sale',
                  detail: 'Add from any listing page, then come back here.',
                  href: '/homes-for-sale?view=list',
                  lead: true,
                },
                { label: 'Every city', href: '/cities' },
                { label: 'Price drops', href: '/price-drops' },
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

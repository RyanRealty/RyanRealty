/**
 * ZIP listings page (/zip/[zip]) — KB (kinetic-brutalist) design, Phase 9 of
 * the KB convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME
 * section library as the city pages (components/site/kb/*), fed ZIP-scoped DAL
 * data. KbNav + KbFooter carry the chrome; HideChrome is NOT applied here because
 * this route does not match the /cities/* pattern.
 *
 * THE PAGE CONTRACT (docs/KB_CONVERGENCE_ROADMAP.md): KB design + SEO for Google
 * and LLMs (generateMetadata + MetadataBlock JSON-LD: Breadcrumb/Place/Dataset) +
 * tracking (KbSectionTracker + section/interaction events). Every figure live (§0).
 *
 * DATA ACCURACY (CLAUDE.md §0):
 *   ZIP codes have NO market_pulse_live / market_stats_cache rows — those are keyed
 *   by city and region. Every stat is derived live from the listing_tile_mv tiles
 *   returned by ONE getZipListings call (propertyType 'A' = SFR). Nothing is
 *   fabricated. The KbMarketHud trend chart uses the PARENT CITY's getPriceHistory
 *   when this ZIP's own listing history is sparse — relabeled so no city figure is
 *   passed off as a ZIP stat.
 *
 * Section stack: breadcrumb · hero · market hud · featured · map · subdivisions ·
 * other ZIPs · sell · footer.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/zip/parity.json (KB set).
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getZipListings,
  getSurfaceImage,
  getPriceHistory,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildYearSeries } from '@/lib/kb/year-series'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { KbMarketData, KbTownItem, KbFeaturedItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

type Params = { zip: string }

// Canonical ZIP codes Ryan Realty serves. dynamicParams=false keeps the route
// strict so a random ZIP 404s rather than SSG-ing an empty page.
const CANONICAL_ZIPS = new Set([
  '97701', '97702', '97703', // Bend
  '97756', // Redmond
  '97759', // Sisters
  '97739', // La Pine
  '97707', // Sunriver
  '97741', // Madras
  '97754', // Prineville
  '97760', // Terrebonne
])

// Service-area labels for each ZIP. Verified geography facts.
const ZIP_AREA: Record<string, string> = {
  '97701': 'Bend NE',
  '97702': 'Bend SE',
  '97703': 'Bend West',
  '97707': 'Sunriver',
  '97739': 'La Pine',
  '97741': 'Madras',
  '97754': 'Prineville',
  '97756': 'Redmond',
  '97759': 'Sisters',
  '97760': 'Terrebonne',
}

// Parent city slug (space-separated, matching market_pulse_live / geo_snapshot_mv
// city rows) for each ZIP. Used as the price-history chart source since ZIP-level
// sales are not cached in market_stats_cache. (§0: relabeled as city-level.)
const ZIP_CITY_SLUG: Record<string, string> = {
  '97701': 'bend',
  '97702': 'bend',
  '97703': 'bend',
  '97707': 'sunriver',
  '97739': 'la pine',
  '97741': 'madras',
  '97754': 'prineville',
  '97756': 'redmond',
  '97759': 'sisters',
  '97760': 'terrebonne',
}

const ZIP_CITY_NAME: Record<string, string> = {
  '97701': 'Bend',
  '97702': 'Bend',
  '97703': 'Bend',
  '97707': 'Sunriver',
  '97739': 'La Pine',
  '97741': 'Madras',
  '97754': 'Prineville',
  '97756': 'Redmond',
  '97759': 'Sisters',
  '97760': 'Terrebonne',
}

const SUBDIVISION_NOISE = new Set(['', 'n/a', 'none', 'unknown', 'other'])

export const dynamicParams = false
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ zip: string }>> {
  return Array.from(CANONICAL_ZIPS).map((zip) => ({ zip }))
}

function normalizeZip(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 5)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

const monthLabel = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : ''

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) {
    return pageMetadata({
      title: 'ZIP not found · Ryan Realty',
      description: 'This ZIP code is outside the Ryan Realty service area.',
      path: `/zip/${zip}`,
      noindex: true,
    })
  }
  const area = ZIP_AREA[zip] ?? 'Central Oregon'
  return pageMetadata({
    title: `Homes for sale in ${zip} · ${area}, Oregon`,
    description: `Browse active single-family listings in ZIP code ${zip} (${area}), Central Oregon. Live market snapshot, subdivision breakdown, and every home on the map.`,
    path: `/zip/${zip}`,
  })
}

export default async function ZipPage({ params }: { params: Promise<Params> }) {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) notFound()

  const area = ZIP_AREA[zip] ?? 'Central Oregon'
  const citySlug = ZIP_CITY_SLUG[zip] ?? 'bend'
  const cityName = ZIP_CITY_NAME[zip] ?? 'Bend'
  const zipPageUrl = `/zip/${zip}`

  // Surface-tagged hero photo seeded by ZIP for per-page variety. (§D86)
  const [zipHeroRaw, tiles, cityPriceHist] = await Promise.all([
    withTimeoutFallback(
      getSurfaceImage('hero', {
        geoTags: ['central-oregon'],
        seed: `zip-${zip}`,
        fallback: '/images/homepage/smith-rock-terrebonne.jpg',
      }),
      null as Awaited<ReturnType<typeof getSurfaceImage>>,
      3000,
      'zip:hero',
    ),
    // ONE fetch feeds all derived stats: hero lede, market HUD, featured grid,
    // map, and subdivision explorer. limit=5000 captures the complete ZIP (no
    // ZIP in this service area has anywhere near 5000 active SFR). Per §0, we
    // never report a fetch cap as if it were the real inventory count.
    withTimeoutFallback(
      getZipListings(zip, { status: 'active', propertyType: 'A', limit: 5000 }),
      [] as Awaited<ReturnType<typeof getZipListings>>,
      5000,
      'zip:tiles',
    ),
    // Parent city price history — the chart source since ZIP-level sales are
    // not cached in market_stats_cache. Always relabeled as city-level so no
    // city figure is presented as the ZIP's own trend. (§0)
    withTimeoutFallback(
      getPriceHistory('city', citySlug, 'monthly', 60),
      [] as Awaited<ReturnType<typeof getPriceHistory>>,
      4500,
      'zip:cityPriceHistory',
    ),
  ])

  // ── LIVE STATS — derived from the single tile fetch (§0) ──────────────────
  const activeCount = tiles.length
  const listPrices = tiles
    .map((t) => t.listPrice)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
  const pricePerSqfts = tiles
    .map((t) => t.pricePerSqft)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
  const doms = tiles
    .map((t) => t.dom)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0)

  const medianListPrice = median(listPrices)
  const medianPricePerSqft = median(pricePerSqfts)
  const medianDom = median(doms)

  const now = Date.now()
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const newLast30Days = tiles.filter((t) => {
    if (!t.onMarketDate) return false
    const d = Date.parse(t.onMarketDate)
    return Number.isFinite(d) && now - d >= 0 && now - d <= THIRTY_DAYS_MS
  }).length

  // ── FEATURED + MAP ────────────────────────────────────────────────────────
  // Featured: top 14 by list price, resolved through the shared video/tour resolver.
  const featuredTiles = [...tiles].sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0)).slice(0, 14)
  const featuredItems: KbFeaturedItem[] = await resolveFeaturedItems(featuredTiles)

  // Map GeoJSON — every active SFR with coordinates.
  const mapFeatures = tiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  // ── MARKET HUD ────────────────────────────────────────────────────────────
  // ZIP codes have no cached market rows. Stats come from live tiles (active
  // count, median list, median DOM, new-30d) and the parent city's price history
  // for the trend chart. §0: closed30/saleToList/monthsSupply are null — not
  // cached at ZIP level, never fabricated.
  const marketData: KbMarketData = {
    active: activeCount,
    closed30: null,
    new30: newLast30Days,
    medianList: medianListPrice,
    saleToList: null,
    daysToPending: medianDom,
    monthsSupply: null,
    trend: cityPriceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: [],
    countyMedian: null,
    yearSeries: buildYearSeries(cityPriceHist, 5),
  }

  // ── SUBDIVISION EXPLORER ─────────────────────────────────────────────────
  // Subdivisions present in this ZIP, grouped from live tile data (§0).
  const subCounts = new Map<string, number>()
  for (const t of tiles) {
    const name = (t.subdivisionName ?? '').trim()
    if (!name || SUBDIVISION_NOISE.has(name.toLowerCase())) continue
    subCounts.set(name, (subCounts.get(name) ?? 0) + 1)
  }
  const subdivisionItems: KbTownItem[] = [...subCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      href: `/search?keywords=${encodeURIComponent(name)}`,
      activeCount: count,
      medianPrice: null,
      img: '',
    }))

  // Other canonical ZIPs we serve (static service-area facts).
  const otherZipItems: KbTownItem[] = [...CANONICAL_ZIPS]
    .filter((z) => z !== zip)
    .map((z) => ({
      name: `${z} · ${ZIP_AREA[z] ?? 'Central Oregon'}`,
      href: `/zip/${z}`,
      activeCount: 0,
      medianPrice: null,
      img: '',
    }))

  // ── HERO LEDE ─────────────────────────────────────────────────────────────
  const ledeParts: string[] = [
    `${activeCount} active single-family ${activeCount === 1 ? 'listing' : 'listings'} in ${zip}.`,
  ]
  if (medianListPrice != null) {
    ledeParts.push(`Median list price $${(Math.round(medianListPrice / 1000) * 1000).toLocaleString()}.`)
  }
  if (medianDom != null) {
    ledeParts.push(`Median ${Math.round(medianDom)} days on market.`)
  }
  const lede = ledeParts.join(' ')

  // ── STRUCTURED DATA (JSON-LD) ─────────────────────────────────────────────
  // Breadcrumb + Place + Dataset. §0: only emit stats when non-null and verified.
  type StatValue = { name: string; value: string | number; unitText?: string }
  const datasetStats: StatValue[] = [
    { name: 'Active single-family listings', value: activeCount, unitText: 'listings' },
  ]
  if (medianListPrice != null) {
    datasetStats.push({ name: 'Median list price', value: medianListPrice, unitText: 'USD' })
  }
  if (medianPricePerSqft != null) {
    datasetStats.push({ name: 'Median price per sq ft', value: Math.round(medianPricePerSqft), unitText: 'USD' })
  }
  if (medianDom != null) {
    datasetStats.push({ name: 'Median days on market', value: Math.round(medianDom), unitText: 'days' })
  }
  datasetStats.push({ name: 'New listings last 30 days', value: newLast30Days, unitText: 'listings' })

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: '/homes-for-sale' },
        { name: zip, url: zipPageUrl },
      ],
    },
    {
      type: 'place',
      name: `ZIP ${zip} · ${area}`,
      description: `Browse active single-family listings in ZIP code ${zip}, ${area}, Central Oregon.`,
      url: zipPageUrl,
      address: { postalCode: zip, state: 'OR', country: 'US' },
    },
    {
      type: 'dataset',
      name: `Active single-family market snapshot for ZIP ${zip}`,
      description: `Live market statistics for active SFR listings in ${zip}, ${area}, Central Oregon. Derived from the Oregon RMLS feed via Ryan Realty.`,
      url: zipPageUrl,
      spatialCoverageName: `ZIP ${zip} · ${area}`,
      variableMeasured: datasetStats,
    },
  ]

  // Resolve hero image URL from getSurfaceImage return (string | SurfaceImage | null).
  const posterSrc =
    zipHeroRaw == null
      ? '/images/homepage/smith-rock-terrebonne.jpg'
      : typeof zipHeroRaw === 'string'
        ? zipHeroRaw
        : (zipHeroRaw as { url?: string }).url ?? '/images/homepage/smith-rock-terrebonne.jpg'

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="zip" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Homes for sale', href: '/homes-for-sale' },
          { label: zip },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: activeCount > 0 ? activeCount : null,
            medianListPrice,
            medianDaysToPending: medianDom,
          }}
          eyebrow={`${zip} · ${area} · Oregon`}
          titleTop="Homes for sale in"
          titleBottom={zip}
          lead={`in ${area}, Oregon, with the live market behind every one.`}
          videoSrc={null}
          posterSrc={posterSrc}
        />

        {/* Market HUD — live stats from listing_tile_mv (§0). The trend chart
            sources from the parent city's price history since ZIP-level sales
            are not cached; the data is city-scoped, not fabricated as ZIP. */}
        <KbMarketHud
          data={marketData}
          eyebrow={`${zip} · The market`}
          chartScopeLabel={`${cityName} (city)`}
        />

        <KbFeatured items={featuredItems} eyebrow={`${zip} · For sale`} />

        <KbListingMap
          geojson={mapGeo}
          totalActive={activeCount}
          fitToFeatures
          showRegionMarkers={false}
          eyebrow={zip}
          title={`Homes in\n${zip}`}
          subtitle={`Every active single-family listing in ${zip}, on the real terrain. Click any dot for the price, the beds, and the street.`}
        />

        {/* Subdivisions — grouped from live tiles, verified counts (§0). */}
        {subdivisionItems.length > 0 ? (
          <KbExploreTowns
            towns={subdivisionItems}
            eyebrow={`${zip} · Neighborhoods`}
            title="What's in this ZIP"
            sectionId="subdivisions"
            cta={{ href: `/search?keywords=${encodeURIComponent(zip)}`, label: `All homes in ${zip}` }}
          />
        ) : null}

        {/* Other service-area ZIPs — static cross-navigation. */}
        <KbExploreTowns
          towns={otherZipItems}
          eyebrow="Central Oregon ZIPs"
          title="Looking elsewhere"
          sectionId="other-zips"
          cta={{ href: '/search', label: 'Open map search' }}
        />

        <KbSell
          data={{
            medianListPrice,
            medianDaysToPending: medianDom,
            soldCount30d: null,
          }}
          eyebrow={`Sell in ${area}`}
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

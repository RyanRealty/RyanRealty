// @no-static-params — public areas are broker-created at runtime; slugs unknown at build time.
// @no-parity — derived named-area landing page (no standalone mockup; reuses
// the KB section library, mirroring app/subdivisions/[slug]/page.tsx)
// brand-voice:exempt
/**
 * Named-area landing page — /areas/[slug] (SEARCH_OPTIMIZATION_PLAN_2026-07-29
 * §4 Phase 2.4, acceptance (d)): a broker-authored PUBLIC saved area ("Bend
 * West Side") rendered as an indexed SEO surface, the Flexmls "Public Access
 * (for IDX & Portals)" overlay model made first-class.
 *
 * Data ONLY through @/lib/data (G8): getPublicAreaBySlug resolves the area
 * (is_public=true rows only — a private area can never leak through this
 * route), then searchListingsAll runs the area's own drawn shapes through the
 * exact PostGIS shapes path, so the landing page's counts equal the map
 * search's counts for the same geography by construction.
 *
 * Chrome mirrors the subdivision page (KbNav + KbHero + KbListingMap +
 * KbFeatured + KbSell + KbFooter) without the market-stats sections — a drawn
 * area has no market_stats_cache geography, and inventing one would violate §0.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getPublicAreaBySlug,
  searchListingsAll,
  type ListingTile,
} from '@/lib/data'
import { resolveAreasToShapeSet } from '@/lib/alerts/area-resolve'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import { cityHero } from '@/lib/geo-images'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const dynamicParams = true
export const revalidate = 300

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// ---------------------------------------------------------------------------
// Shape → map-overlay geometry
// ---------------------------------------------------------------------------

type PolygonFeature = {
  type: 'Feature'
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  properties: { name: string }
}

/** 64-segment ring approximating a circle for the MAP OVERLAY only (the
 *  search itself runs the exact geography ST_DWithin server-side). */
function circleRing(center: [number, number], radiusM: number): [number, number][] {
  const [lng, lat] = center
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01))
  const ring: [number, number][] = []
  for (let i = 0; i <= 64; i += 1) {
    const t = (i / 64) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return ring
}

function shapesToPolygonFeatures(
  shapes: Array<
    | { type: 'polygon'; coords: [number, number][]; exclude?: boolean }
    | { type: 'circle'; center: [number, number]; radius_m: number; exclude?: boolean }
  >,
  name: string,
): PolygonFeature[] {
  const features: PolygonFeature[] = []
  for (const shape of shapes) {
    if (shape.exclude === true) continue // overlay draws the searched area only
    const ring: [number, number][] =
      shape.type === 'polygon'
        ? [...shape.coords, shape.coords[0]!]
        : circleRing(shape.center, shape.radius_m)
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { name },
    })
  }
  return features
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const area = await getPublicAreaBySlug(slug)
  if (!area) {
    return pageMetadata({
      title: 'Area not found',
      description: 'This search area is private or does not exist.',
      path: `/areas/${slug}`,
      noindex: true,
    })
  }
  return pageMetadata({
    title: `${area.name} Homes for Sale | Central Oregon`,
    description: `Homes for sale in ${area.name}, a broker-drawn Central Oregon search area, with live listings inside the exact boundary.`,
    path: `/areas/${slug}`,
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AreaPage({ params }: Props) {
  const { slug } = await params
  const area = await getPublicAreaBySlug(slug)
  if (!area) notFound()

  const shapeSet = resolveAreasToShapeSet([area])
  if (!shapeSet) notFound()

  // Exact PostGIS shapes path — same predicate as the drawn-map search.
  const read = await withTimeoutFallbackResult(
    searchListingsAll({ shapes: shapeSet, sort: 'newest', limit: 60 }),
    { rows: [] as ListingTile[], totalCount: 0, capped: false, countIsExact: true },
    6000,
    'area:listings',
  )

  const result = read.value
  const rows = result.rows
  // §0 UNKNOWN IS NOT ZERO: the fallback's `totalCount: 0` is indistinguishable
  // from an area with no inventory, so a degraded read published "No active
  // listings inside the boundary right now" as fact. null = unknown.
  const activeCount: number | null = read.ok ? result.totalCount : null

  // Modal city of the in-area listings — for the hero photo only, and only
  // when a strict majority agrees (same §0 discipline as the subdivision page).
  const cityCounts = new Map<string, { citySlug: string | null; n: number }>()
  for (const t of rows) {
    if (!t.city) continue
    const cur = cityCounts.get(t.city) ?? { citySlug: t.citySlug ?? null, n: 0 }
    cur.n += 1
    if (!cur.citySlug && t.citySlug) cur.citySlug = t.citySlug
    cityCounts.set(t.city, cur)
  }
  const modalCity = [...cityCounts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  const cityTotal = [...cityCounts.values()].reduce((s, v) => s + v.n, 0)
  const derivedCity =
    modalCity && cityTotal > 0 && modalCity[1].n / cityTotal > 0.5 && modalCity[1].citySlug
      ? { city: modalCity[0], citySlug: modalCity[1].citySlug }
      : null

  const heroData = cityHero(derivedCity?.citySlug ?? 'bend')
  const mediaCaption =
    derivedCity && heroData.verified ? `${derivedCity.city}, Oregon` : 'Central Oregon · Cascade Range'

  // KbHero already renders "<N> homes for sale" ahead of this text when
  // activeCount is non-null (see KbHero's `lead` prop contract), so this
  // string is a continuation fragment in that case and a full sentence only
  // when the count is unknown — never both, or the page reads "5 homes for
  // sale 5 homes for sale inside X."
  const lede =
    activeCount == null
      ? `Homes for sale inside the ${area.name} boundary.`
      : `inside the ${area.name} boundary.`

  const featuredItems = await resolveFeaturedItems(rows.filter((t) => Boolean(t.photoUrl)))

  // ── Map data ─────────────────────────────────────────────────────────────
  const mapFeatures = rows
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(t.lng), Number(t.lat)] as [number, number],
      },
      properties: {
        p: t.listPrice, bd: t.beds, ba: t.baths, sf: t.sqft,
        a: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '', city: t.city ?? '', img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }
  const polygonFeatures = shapesToPolygonFeatures(area.shapes, area.name)
  const mapPolygons =
    polygonFeatures.length > 0
      ? { type: 'FeatureCollection' as const, features: polygonFeatures }
      : undefined
  const hasMap = mapFeatures.length > 0 || Boolean(mapPolygons)

  // ── JSON-LD ──────────────────────────────────────────────────────────────
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: '/homes-for-sale' },
        { name: area.name, url: `/areas/${slug}` },
      ],
    },
    {
      type: 'place',
      placeType: 'Place',
      name: area.name,
      description: `Homes for sale in ${area.name}, a Central Oregon search area with a broker-drawn boundary.`,
      url: `/areas/${slug}`,
      hasMap: hasMap ? `/areas/${slug}` : undefined,
    },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="area" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Homes for sale', href: '/homes-for-sale' },
          { label: area.name },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow={`${area.name} · Central Oregon`}
          titleTop={area.name}
          titleBottom="Homes for Sale"
          lead={lede}
          videoSrc={null}
          posterSrc={heroData.src}
          mediaCaption={mediaCaption}
        />
        {hasMap ? (
          <KbListingMap
            geojson={mapGeo}
            totalActive={activeCount ?? mapFeatures.length}
            fitToFeatures
            showRegionMarkers={false}
            polygons={mapPolygons}
            eyebrow={area.name}
            title={`Homes in\n${area.name}`}
            subtitle={`Every active listing inside the drawn ${area.name} boundary.`}
          />
        ) : null}
        {featuredItems.length > 0 ? (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${area.name} · For sale`}
            viewAllHref="/homes-for-sale"
            viewAllLabel="Browse every Central Oregon home for sale"
            viewAllPlace={area.name}
            totalCount={activeCount || null}
          />
        ) : (
          <section className="section">
            <div className="wrap" style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--navy-70)', maxWidth: '36rem', margin: '0 auto' }}>
                No active listings inside {area.name} right now.
              </p>
            </div>
          </section>
        )}
        <KbSell
          data={{
            medianListPrice: null,
            medianDaysToPending: null,
            soldCount30d: null,
          }}
        />
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

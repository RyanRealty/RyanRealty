/**
 * Bend, Oregon — city-level landing page at /lp/bend/.
 *
 * Tier 1 of the four-tier search-authority stack — the top-of-funnel SEO +
 * AEO surface for "homes for sale in Bend Oregon" queries. ISR 6h.
 *
 * Spec: marketing_brain_skills/producers/site-city-page/SKILL.md
 * First exemplar; Sisters, Redmond, La Pine, Tumalo follow.
 *
 * Tone: Buffett voice. Inventory + market facts first. Map + listings +
 *       neighborhoods carry the page. No tourism brochure register.
 *
 * 12-month sold / median close / sale-to-list / ppsf overlay leftover
 * (getPublicDetachedPace) for Bend and peer cities. Miss omits.
 * Pulse DTP is not median DOM.
 */
import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { createServiceClient } from '@/lib/supabase/service'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import { CONTACT } from '@/lib/brand/contact'
import LandingPageTracker from '@/components/LandingPageTracker'
import { ListingCard, type ListingCardData } from '@/components/lp/ListingCard'
import { BendInteractiveMap } from './_components/BendInteractiveMap'
import type { CommunityPolygon } from './_components/BendInteractiveMap'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Homes for sale in Bend, Oregon',
  description:
    'Active Bend homes for sale, every neighborhood and resort community, live market figures, and a Bend principal broker. Data refreshed daily.',
  alternates: { canonical: `${siteUrl}/lp/bend/` },
  openGraph: {
    title: 'Homes for sale in Bend, Oregon',
    description:
      'Search active Bend homes, explore every neighborhood, and get live market figures from Ryan Realty.',
    type: 'website',
    url: `${siteUrl}/lp/bend/`,
    images: [`${siteUrl}/lp/bend/img/bend-hero.jpg`],
  },
  robots: { index: false, follow: false },
}
type Kpis = {
  sold_count: number | null
  median_sale_price: number | null
  median_dom: number | null
  avg_sale_to_list_ratio: number | null
  median_ppsf: number | null
  end_of_period_inventory: number | null
  computed_at: string | null
  methodology_version: string | null
}

/** 12-month sold / median close / SLT / ppsf from leftover. Miss is null, never 0. */
function leftoverSoldMedianSlt(leftover: PublicPaceRow): Pick<
  Kpis,
  'sold_count' | 'median_sale_price' | 'avg_sale_to_list_ratio' | 'median_ppsf'
> {
  return {
    sold_count: leftover.closedCount,
    median_sale_price: leftover.medianClose,
    avg_sale_to_list_ratio: leftover.saleToOriginal,
    median_ppsf: leftover.medianPpsf,
  }
}

async function readLeftoverPace(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<PublicPaceRow> {
  try {
    return await getPublicDetachedPace({ geoType, geoSlug })
  } catch (err) {
    console.warn(`[bend lp] leftover miss for ${geoType}:${geoSlug}:`, err)
    return { ...EMPTY_PUBLIC_PACE }
  }
}

async function loadBendKpis(): Promise<Kpis | null> {
  void createServiceClient
  const { getMarketStatsCacheRowForGeo } = await import('@/lib/data')
  const [data, leftover] = await Promise.all([
    getMarketStatsCacheRowForGeo({
      geoType: 'city',
      geoSlug: 'bend',
      periodType: 'rolling_365d',
    }),
    readLeftoverPace('city', 'bend'),
  ])
  const overlay = leftoverSoldMedianSlt(leftover)
  const cache = (data ?? null) as Kpis | null
  if (
    !cache &&
    overlay.sold_count == null &&
    overlay.median_sale_price == null &&
    overlay.avg_sale_to_list_ratio == null &&
    overlay.median_ppsf == null
  ) {
    return null
  }
  return {
    sold_count: overlay.sold_count,
    median_sale_price: overlay.median_sale_price,
    median_dom: cache?.median_dom ?? null,
    avg_sale_to_list_ratio: overlay.avg_sale_to_list_ratio,
    median_ppsf: overlay.median_ppsf,
    end_of_period_inventory: cache?.end_of_period_inventory ?? null,
    computed_at: cache?.computed_at ?? null,
    methodology_version: cache?.methodology_version ?? null,
  }
}

type CommunityKpiCard = {
  slug: string
  name: string
  label: string
  hero_image?: string
  sold_count: number | null
  median_sale_price: number | null
  active_count: number | null
}

async function loadBendCommunitiesIndex(): Promise<CommunityKpiCard[]> {
  const out: CommunityKpiCard[] = []
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const entries = await fs.readdir(dataDir, { withFileTypes: true })
    const slugs: Array<{ slug: string; name: string; hero?: string; geo_slug?: string }> = []
    for (const ent of entries) {
      if (!ent.isFile()) continue
      if (!ent.name.startsWith('resort-community-') || !ent.name.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(dataDir, ent.name), 'utf8')
        const parsed = JSON.parse(raw) as {
          slug?: string
          name?: string
          city?: string
          hero_image?: string
          geo_slug?: string
        }
        if (parsed?.slug && (parsed.city === 'Bend' || !parsed.city)) {
          slugs.push({
            slug: parsed.slug,
            name: parsed.name ?? parsed.slug,
            hero: parsed.hero_image,
            geo_slug: parsed.geo_slug ?? parsed.slug,
          })
        }
      } catch {
        // ignore
      }
    }

    if (slugs.length === 0) return []

    void createServiceClient
    const { getMarketStatsCacheRowsForGeos } = await import('@/lib/data')
    const geoSlugs = slugs.map((s) => s.geo_slug ?? s.slug)
    const [kpiRows, leftoverPairs] = await Promise.all([
      getMarketStatsCacheRowsForGeos({
        // Resort/area community cards — cache is inventory only. Sold/median
        // overlay leftover (neighborhood grain). Miss omits, never cache.
        geoType: 'neighborhood',
        geoSlugs,
        periodType: 'rolling_365d',
      }),
      Promise.all(
        geoSlugs.map(async (geoSlug) => {
          const leftover = await readLeftoverPace('neighborhood', geoSlug)
          return [geoSlug, leftover] as const
        }),
      ),
    ])

    const byGeo = new Map<string, { end_of_period_inventory: number | null }>()
    for (const r of kpiRows as Array<{ geo_slug: string; end_of_period_inventory: number | null }>) {
      if (!byGeo.has(r.geo_slug)) byGeo.set(r.geo_slug, r)
    }
    const leftoverByGeo = new Map<string, PublicPaceRow>(leftoverPairs)

    for (const s of slugs) {
      const geoSlug = s.geo_slug ?? s.slug
      const k = byGeo.get(geoSlug)
      const overlay = leftoverSoldMedianSlt(leftoverByGeo.get(geoSlug) ?? EMPTY_PUBLIC_PACE)
      out.push({
        slug: s.slug,
        name: s.name,
        label: s.name,
        hero_image: s.hero,
        sold_count: overlay.sold_count,
        median_sale_price: overlay.median_sale_price,
        active_count: k?.end_of_period_inventory ?? null,
      })
    }
  } catch (err) {
    console.warn('[bend lp] communities index failed:', err)
  }
  return out
}

type ActiveListing = {
  list_number: string
  listing_key: string
  address: string
  city: string
  list_price: number
  beds: number | null
  baths: string | null
  sqft: string | null
  photo_url: string | null
}

async function loadActiveListings(): Promise<ActiveListing[]> {
  void createServiceClient
  const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
  const tiles = await getCityListingsDAL('Bend', {
    status: 'active',
    propertyType: 'A',
    minPrice: 750_000,
    sort: 'price-desc',
    limit: 8,
  })
  return tiles.map((t) => ({
    list_number: t.listNumber ?? '',
    listing_key: t.listingKey,
    address: [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' '),
    city: t.city ?? 'Bend',
    list_price: Number(t.listPrice ?? 0),
    beds: t.beds,
    baths: t.baths != null ? String(t.baths) : null,
    sqft: t.sqft != null ? String(t.sqft) : null,
    photo_url: t.photoUrl,
  }))
}

type PolygonFile = {
  version: string
  source: string
  imported_at: string
  communities: Array<{
    tier?: 'city' | 'community' | 'community-overlay'
    slug: string
    route_slug: string
    name: string
    acres?: number
    centroid: { lng: number; lat: number }
    geometry: GeoJSON.Geometry
  }>
}

async function loadCommunityPolygons(): Promise<CommunityPolygon[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'bend', 'bend-neighborhood-polygons.json')
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as PolygonFile
    return parsed.communities.map((c) => ({
      slug: c.route_slug,
      name: c.name,
      geometry: c.geometry,
      centroid: c.centroid,
      tier: c.tier ?? 'city',
    }))
  } catch (err) {
    console.warn('[bend lp] polygon file load failed:', err)
    return []
  }
}

type PeerKpiRow = {
  geo_slug: string
  geo_label: string | null
  sold_count: number | null
  median_sale_price: number | null
  median_dom: number | null
  avg_sale_to_list_ratio: number | null
  median_ppsf: number | null
}

const PEER_CITY_SLUGS = ['bend', 'redmond', 'sisters', 'la-pine', 'terrebonne'] as const

/** Cache is labels + median DOM only. Closed sold/median/SLT/ppsf overlay leftover. */
async function loadPeerCities(): Promise<PeerKpiRow[]> {
  void createServiceClient
  const { getMarketStatsCacheRowsForGeos } = await import('@/lib/data')
  const [data, leftoverPairs] = await Promise.all([
    getMarketStatsCacheRowsForGeos({
      geoType: 'city',
      geoSlugs: [...PEER_CITY_SLUGS],
      periodType: 'rolling_365d',
      columns: 'geo_slug, geo_label, median_dom',
    }),
    Promise.all(
      PEER_CITY_SLUGS.map(async (geoSlug) => {
        const leftover = await readLeftoverPace('city', geoSlug)
        return [geoSlug, leftover] as const
      }),
    ),
  ])

  const cacheByGeo = new Map<string, { geo_label: string | null; median_dom: number | null }>()
  for (const r of (data ?? []) as Array<{
    geo_slug: string
    geo_label: string | null
    median_dom: number | null
  }>) {
    if (!cacheByGeo.has(r.geo_slug)) cacheByGeo.set(r.geo_slug, r)
  }
  const leftoverByGeo = new Map<string, PublicPaceRow>(leftoverPairs)

  const out: PeerKpiRow[] = []
  for (const geoSlug of PEER_CITY_SLUGS) {
    const cache = cacheByGeo.get(geoSlug)
    const overlay = leftoverSoldMedianSlt(leftoverByGeo.get(geoSlug) ?? EMPTY_PUBLIC_PACE)
    out.push({
      geo_slug: geoSlug,
      geo_label: cache?.geo_label ?? null,
      sold_count: overlay.sold_count,
      median_sale_price: overlay.median_sale_price,
      median_dom: cache?.median_dom ?? null,
      avg_sale_to_list_ratio: overlay.avg_sale_to_list_ratio,
      median_ppsf: overlay.median_ppsf,
    })
  }
  out.sort((a, b) => (b.median_sale_price ?? -1) - (a.median_sale_price ?? -1))
  return out
}

function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || n <= 0) return '—'
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—'
  return n.toLocaleString()
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

export default async function BendCityPage() {
  const [kpis, communities, peers, listings, polygons] = await Promise.all([
    loadBendKpis(),
    loadBendCommunitiesIndex(),
    loadPeerCities(),
    loadActiveListings(),
    loadCommunityPolygons(),
  ])

  return (
    <main className="bend-lp">
      <LandingPageTracker lpVariant="bend-city-landing-v2" />
      <style>{`
        :root { --tw-cream: #faf8f4; --tw-navy: #102742; --tw-muted: #5d6470; }
        .bend-lp { background-color: #faf8f4; color: #102742; font-family: 'Geist', system-ui, sans-serif; font-feature-settings: "tnum" on, "lnum" on; }
        .bend-shell { max-width: 1160px; margin: 0 auto; padding: 32px 28px; }
        .bend-section { padding: 64px 0; }
        .bend-section + .bend-section { border-top: 1px solid rgba(16,39,66,0.07); }
        .bend-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-bottom: 12px; }
        .bend-h1 { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 72px; line-height: 1.02; margin: 0 0 18px; letter-spacing: -0.018em; font-weight: 500; }
        @media (max-width: 720px) { .bend-h1 { font-size: 48px; } }
        .bend-h2 { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 38px; line-height: 1.12; margin: 0 0 16px; letter-spacing: -0.012em; font-weight: 500; }
        @media (max-width: 720px) { .bend-h2 { font-size: 30px; } }
        .bend-h3 { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 22px; line-height: 1.2; margin: 0 0 10px; font-weight: 500; }
        .bend-prose { font-size: 17px; line-height: 1.68; margin: 0 0 16px; color: rgba(16,39,66,0.86); }
        .bend-prose.lg { font-size: 19px; line-height: 1.62; }

        /* HERO */
        .hero { position: relative; min-height: 620px; overflow: hidden; }
        .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center 35%; transform: scale(1.05); }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(165deg, rgba(16,39,66,0.30) 0%, rgba(16,39,66,0.45) 55%, rgba(16,39,66,0.85) 100%); }
        .hero .bend-shell { position: relative; padding-top: 120px; padding-bottom: 56px; color: #faf8f4; max-width: 1160px; }
        .hero .bend-eyebrow { color: rgba(250,248,244,0.78); }
        .hero .bend-h1 { color: #faf8f4; max-width: 880px; }
        .hero p { color: rgba(250,248,244,0.92); max-width: 640px; font-size: 19px; line-height: 1.6; }
        .hero-cta-row { display: flex; gap: 14px; margin-top: 32px; flex-wrap: wrap; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #faf8f4; color: #102742; padding: 14px 26px; border-radius: 10px; font-size: 14.5px; font-weight: 700; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; letter-spacing: 0.01em; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.18); }
        .btn-ghost-light { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #faf8f4; border: 1.5px solid rgba(250,248,244,0.6); padding: 13px 24px; border-radius: 10px; font-size: 14.5px; font-weight: 600; text-decoration: none; transition: background 0.15s, border-color 0.15s; }
        .btn-ghost-light:hover { background: rgba(250,248,244,0.08); border-color: rgba(250,248,244,0.9); }

        /* INTRO + SIDEBAR */
        .grid-2-1 { display: grid; grid-template-columns: 1.8fr 1fr; gap: 48px; align-items: start; }
        @media (max-width: 920px) { .grid-2-1 { grid-template-columns: 1fr; gap: 32px; } }
        .facts-sidebar { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 16px; padding: 28px 30px; position: sticky; top: 28px; box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 6px 18px rgba(16,39,66,0.06); }
        .facts-sidebar dt { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-top: 18px; }
        .facts-sidebar dt:first-of-type { margin-top: 0; }
        .facts-sidebar dd { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 22px; margin: 4px 0 0; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .facts-sidebar dd .sub { display: block; font-family: 'Geist', system-ui, sans-serif; font-size: 12.5px; color: rgba(16,39,66,0.6); margin-top: 3px; font-weight: 500; letter-spacing: 0; }

        /* MAP SECTION */
        .map-wrap { display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px; align-items: start; }
        @media (max-width: 980px) { .map-wrap { grid-template-columns: 1fr; } }
        .map-intro p { font-size: 16.5px; line-height: 1.65; color: rgba(16,39,66,0.78); }
        .map-list { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; padding: 22px 24px; max-height: 540px; overflow-y: auto; box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 6px 18px rgba(16,39,66,0.06); }
        .map-list-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-bottom: 14px; }
        .map-list ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 28px; }
        @media (max-width: 980px) { .map-list ul { columns: 2; } }
        @media (max-width: 540px) { .map-list ul { columns: 1; } }
        .map-list li { padding: 6px 0; font-size: 14.5px; break-inside: avoid; }
        .map-list a { color: #102742; text-decoration: none; font-weight: 500; transition: color 0.15s; }
        .map-list a:hover { color: rgba(16,39,66,0.6); text-decoration: underline; text-underline-offset: 3px; }

        /* COMMUNITY TILES — fixed 3-col / 2-col / 1-col, no orphan rows */
        .community-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 24px; }
        @media (max-width: 920px) { .community-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .community-grid { grid-template-columns: 1fr; } }
        .community-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; }
        .community-card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 14px 32px rgba(16,39,66,0.12); }
        .community-photo { aspect-ratio: 16/10; background: linear-gradient(150deg, #102742 0%, rgba(16,39,66,0.82) 100%); background-size: cover; background-position: center; }
        .community-body { padding: 18px 22px 22px; }
        .community-name { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 22px; margin: 0 0 6px; font-weight: 500; }
        .community-stats { display: flex; gap: 14px; font-size: 12.5px; color: rgba(16,39,66,0.62); flex-wrap: wrap; }
        .community-stats strong { color: #102742; font-weight: 600; }

        /* LISTINGS — fixed 4-col / 3-col / 2-col / 1-col, 8 items render as clean 2 rows.
           Card markup lives in components/lp/ListingCard.tsx — one canonical tile shape
           reused across every Ryan Realty LP. */
        .listings-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 24px; }
        @media (max-width: 1024px) { .listings-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 760px) { .listings-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .listings-grid { grid-template-columns: 1fr; } }
        .rr-listing-card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 14px 32px rgba(16,39,66,0.12) !important; }
        .featured-cta-row { display: flex; gap: 14px; justify-content: center; align-items: center; margin-top: 36px; flex-wrap: wrap; }
        .featured-cta-primary { display: inline-flex; align-items: center; gap: 8px; background: #102742; color: #faf8f4; padding: 14px 32px; border-radius: 10px; font-size: 14.5px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
        .featured-cta-primary:hover { background: rgba(16,39,66,0.88); color: #faf8f4; }
        .featured-cta-secondary { display: inline-flex; align-items: center; gap: 8px; color: #102742; padding: 14px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1.5px solid rgba(16,39,66,0.18); transition: border-color 0.15s, background 0.15s; }
        .featured-cta-secondary:hover { border-color: rgba(16,39,66,0.45); background: rgba(16,39,66,0.04); }

        /* LIFESTYLE — editorial: 1 wide hero + 3-card row + 3 quick-stat rows */
        .lifestyle-hero { display: grid; grid-template-columns: 1.2fr 1fr; gap: 0; margin-top: 28px; background: #fff; border: 1px solid rgba(16,39,66,0.08); border-radius: 18px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 8px 24px rgba(16,39,66,0.08); }
        @media (max-width: 880px) { .lifestyle-hero { grid-template-columns: 1fr; } }
        .lifestyle-hero-img { min-height: 360px; background-size: cover; background-position: center; }
        @media (max-width: 880px) { .lifestyle-hero-img { aspect-ratio: 16/10; min-height: 0; } }
        .lifestyle-hero-body { padding: 38px 42px; display: flex; flex-direction: column; justify-content: center; }
        @media (max-width: 880px) { .lifestyle-hero-body { padding: 28px 26px; } }
        .lifestyle-hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-bottom: 12px; }
        .lifestyle-hero-title { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 30px; line-height: 1.15; margin: 0 0 14px; font-weight: 500; color: #102742; letter-spacing: -0.01em; }
        .lifestyle-hero-text { font-size: 15.5px; line-height: 1.62; color: rgba(16,39,66,0.82); margin: 0; }

        .lifestyle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 18px; }
        @media (max-width: 920px) { .lifestyle-grid { grid-template-columns: repeat(1, 1fr); } }
        .lifestyle-card { position: relative; aspect-ratio: 4/5; border-radius: 16px; overflow: hidden; background-color: rgba(16,39,66,0.1); background-size: cover; background-position: center; box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 8px 24px rgba(16,39,66,0.1); display: flex; flex-direction: column; justify-content: flex-end; transition: transform 0.25s, box-shadow 0.25s; }
        .lifestyle-card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 16px 36px rgba(16,39,66,0.18); }
        .lifestyle-card::before { content: ''; position: absolute; inset: 0; z-index: 1; background: linear-gradient(to bottom, rgba(16,39,66,0) 0%, rgba(16,39,66,0) 35%, rgba(16,39,66,0.65) 70%, rgba(16,39,66,0.95) 100%); pointer-events: none; }
        .lifestyle-card-body { position: relative; z-index: 2; padding: 22px 24px 24px; color: #faf8f4; }
        .lifestyle-card-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(250,248,244,0.78); margin-bottom: 6px; }
        .lifestyle-card h3 { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 22px; line-height: 1.15; margin: 0 0 8px; font-weight: 500; color: #faf8f4; letter-spacing: -0.005em; }
        .lifestyle-card p { font-size: 13.5px; line-height: 1.5; color: rgba(250,248,244,0.92); margin: 0; }

        .lifestyle-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; }
        @media (max-width: 920px) { .lifestyle-stats { grid-template-columns: 1fr; } }
        .lifestyle-stat { display: flex; align-items: flex-start; gap: 14px; padding: 22px 24px; background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; box-shadow: 0 1px 2px rgba(16,39,66,0.03); }
        .lifestyle-stat-icon { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; background: rgba(16,39,66,0.06); display: flex; align-items: center; justify-content: center; }
        .lifestyle-stat-title { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 18px; line-height: 1.2; font-weight: 500; color: #102742; margin: 0 0 6px; }
        .lifestyle-stat-text { font-size: 13px; line-height: 1.55; color: rgba(16,39,66,0.78); margin: 0; }

        /* BROKER BIO — "Meet a local" personal block, builds trust before the final CTA */
        .broker-bio { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; align-items: center; margin-top: 24px; background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 18px; padding: 36px 38px; box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 8px 24px rgba(16,39,66,0.06); }
        @media (max-width: 760px) { .broker-bio { grid-template-columns: 1fr; padding: 28px 26px; gap: 22px; } }
        .broker-photo { aspect-ratio: 3/4; background: rgba(16,39,66,0.06); background-size: cover; background-position: center top; border-radius: 14px; max-width: 280px; }
        @media (max-width: 760px) { .broker-photo { max-width: 200px; margin: 0 auto; } }
        .broker-name { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 30px; line-height: 1.15; margin: 0 0 4px; font-weight: 500; color: #102742; }
        .broker-title { font-size: 12.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-bottom: 16px; }
        .broker-text { font-size: 15px; line-height: 1.6; color: rgba(16,39,66,0.82); margin: 0 0 18px; }
        .broker-cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .broker-cta-primary { display: inline-flex; align-items: center; gap: 8px; background: #102742; color: #faf8f4; padding: 12px 24px; border-radius: 10px; font-size: 13.5px; font-weight: 700; text-decoration: none; letter-spacing: 0.01em; }
        .broker-cta-primary:hover { background: rgba(16,39,66,0.88); color: #faf8f4; }
        .broker-cta-secondary { display: inline-flex; align-items: center; gap: 8px; color: #102742; padding: 12px 20px; border-radius: 10px; font-size: 13.5px; font-weight: 600; text-decoration: none; border: 1.5px solid rgba(16,39,66,0.18); }
        .broker-cta-secondary:hover { border-color: rgba(16,39,66,0.45); background: rgba(16,39,66,0.04); }

        /* KPI GRID — fixed 3-col / 2-col / 1-col, 6 items render as clean 2 rows */
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 22px; }
        @media (max-width: 820px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .kpi-grid { grid-template-columns: 1fr; } }
        .kpi-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 2px rgba(16,39,66,0.03); }
        .kpi-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(16,39,66,0.6); margin-bottom: 8px; }
        .kpi-value { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; font-weight: 500; }

        /* COMPARE TABLE */
        .compare-table { width: 100%; border-collapse: collapse; background: white; border-radius: 14px; overflow: hidden; border: 1px solid rgba(16,39,66,0.08); margin-top: 22px; box-shadow: 0 1px 2px rgba(16,39,66,0.03); }
        .compare-table th, .compare-table td { padding: 14px 18px; text-align: left; font-size: 14px; border-bottom: 1px solid rgba(16,39,66,0.07); }
        .compare-table tbody tr:last-child td { border-bottom: none; }
        .compare-table th { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(16,39,66,0.6); background: rgba(16,39,66,0.03); }
        .compare-table .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
        .compare-table tr.featured td { background: rgba(16,39,66,0.04); font-weight: 600; }

        /* CTA CARDS */
        .cta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 26px; }
        @media (max-width: 720px) { .cta-row { grid-template-columns: 1fr; } }
        .cta-card { background: #102742; color: #faf8f4; padding: 36px 34px; border-radius: 18px; }
        .cta-card.alt { background: white; color: #102742; border: 1px solid rgba(16,39,66,0.1); box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 8px 24px rgba(16,39,66,0.06); }
        .cta-card h3 { font-family: var(--font-amboqia-safe), ui-serif, Georgia, serif; font-size: 28px; margin: 0 0 12px; color: inherit; font-weight: 500; }
        .cta-card p { font-size: 15px; line-height: 1.6; color: inherit; opacity: 0.92; margin: 0 0 20px; }
        .cta-card .btn { display: inline-flex; align-items: center; gap: 8px; background: #faf8f4; color: #102742; padding: 13px 26px; border-radius: 10px; font-size: 14.5px; font-weight: 700; text-decoration: none; }
        .cta-card.alt .btn { background: #102742; color: #faf8f4; }

        /* METHODOLOGY FOOTER */
        .methodology { font-size: 12.5px; color: rgba(16,39,66,0.6); line-height: 1.7; }
        .methodology code { font-size: 12px; background: rgba(16,39,66,0.04); padding: 1px 5px; border-radius: 4px; }

        a { color: inherit; }
      `}</style>

      {/* HERO */}
      <header className="hero">
        <div
          className="hero-bg"
          style={{ backgroundImage: "url('/lp/bend/img/bend-hero.jpg')" }}
          role="presentation"
        />
        <div className="hero-overlay" role="presentation" />
        <div className="bend-shell">
          <div className="bend-eyebrow">Bend · Central Oregon</div>
          <h1 className="bend-h1 font-display">Homes for sale in Bend, Oregon.</h1>
          <p>
            Cascades on one side, high desert on the other. Search active homes, open every
            neighborhood and resort community, and see the market figures that move a sale.
          </p>
          <div className="hero-cta-row">
            <Link href="/lp/seller-home-value?source=bend-lp" className="btn-primary">
              Get my Bend home value
            </Link>
            <Link href="/lp/buyer-listing-alerts?source=bend-lp" className="btn-primary">
              Get new Bend listings by email
            </Link>
          </div>
          <div className="hero-cta-row" style={{ marginTop: 14 }}>
            <Link href="#listings" className="btn-ghost-light">
              See active homes
            </Link>
            <Link href="#neighborhoods" className="btn-ghost-light">
              Browse neighborhoods
            </Link>
          </div>
        </div>
      </header>

      {/* WELCOME + FACTS */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="grid-2-1">
            <div>
              <div className="bend-eyebrow">The city</div>
              <h2 className="bend-h2 font-display">3,623 feet, east of the Cascades.</h2>
              <p className="bend-prose lg">
                Bend sits on the eastern flank of the Cascade Range at 3,623 feet, with the
                Deschutes River running through downtown and Mt. Bachelor 22 miles to the
                southwest. About 105,000 people live here. Deschutes County is about 210,000.
              </p>
              <p className="bend-prose">
                Tetherow and Broken Top on the west side sit on golf and Cascade views. NorthWest
                Crossing is walkable and family-oriented. Old Bend and River West sit closest to
                downtown and the river. Pronghorn is high-desert living on the north end. The map
                below opens any neighborhood polygon.
              </p>
              <p className="bend-prose">
                Below the map: active homes for sale across the city, market data refreshed daily,
                and the facts on recreation, schools, and the local economy.
              </p>
            </div>

            <aside className="facts-sidebar">
              <div className="bend-eyebrow">Bend at a glance</div>
              <dl>
                <dt>Population</dt>
                <dd>~105,000<span className="sub">Deschutes County ~210,000</span></dd>
                <dt>Elevation</dt>
                <dd>3,623 ft<span className="sub">High desert, east of the Cascades</span></dd>
                <dt>School district</dt>
                <dd>Bend-La Pine<span className="sub">One district city-wide</span></dd>
                <dt>Sold past 12mo</dt>
                <dd>{fmtCount(kpis?.sold_count)}<span className="sub">Single-family homes</span></dd>
                <dt>Median close</dt>
                <dd>{fmtUsd(kpis?.median_sale_price)}<span className="sub">Rolling 12 months</span></dd>
                <dt>Active today</dt>
                <dd>{kpis?.end_of_period_inventory?.toLocaleString() ?? '—'}<span className="sub">Across the city</span></dd>
                <dt>Sales tax</dt>
                <dd>0%<span className="sub">Oregon, statewide</span></dd>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      {/* INTERACTIVE MAP */}
      <section id="neighborhoods" className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Explore by neighborhood</div>
          <h2 className="bend-h2 font-display">Click a neighborhood to drill in.</h2>
          <p className="bend-prose" style={{ maxWidth: 760 }}>
            Every Bend neighborhood and resort community is mapped from official GIS boundaries.
            Hover to highlight, click to open the neighborhood page with live inventory, recent
            close history, and area details.
          </p>

          <div className="map-wrap" style={{ marginTop: 28 }}>
            <BendInteractiveMap communities={polygons} />
            <div className="map-list">
              <div className="map-list-title">All neighborhoods</div>
              <ul>
                {polygons.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/lp/${c.slug}/`}>{c.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* RESORT COMMUNITY TILES — only when there's actual content */}
      {communities.length > 0 && (
        <section className="bend-section">
          <div className="bend-shell">
            <div className="bend-eyebrow">Featured resort communities</div>
            <h2 className="bend-h2 font-display">Master-planned, with their own search-authority pages.</h2>
            <p className="bend-prose" style={{ maxWidth: 760 }}>
              Each of these communities has a dedicated landing page with HOA tiers, live
              inventory, and a buyer-side guide.
            </p>

            <div className="community-grid">
              {communities.map((c) => (
                <Link key={c.slug} href={`/lp/${c.slug}/`} className="community-card">
                  <div
                    className="community-photo"
                    style={c.hero_image ? { backgroundImage: `url('${c.hero_image}')` } : undefined}
                  />
                  <div className="community-body">
                    <div className="community-name">{c.name}</div>
                    <div className="community-stats">
                      {c.sold_count != null && c.sold_count > 0 && (
                        <span>
                          <strong>{c.sold_count}</strong> sold past 12mo
                        </span>
                      )}
                      {c.median_sale_price != null && c.median_sale_price > 0 && (
                        <span>
                          <strong>{fmtUsd(c.median_sale_price, { compact: true })}</strong> median
                        </span>
                      )}
                      {c.active_count != null && c.active_count > 0 && (
                        <span>
                          <strong>{c.active_count}</strong> active
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED HOMES — active Bend listings + showing CTA per card */}
      <section id="listings" className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Homes for sale in Bend</div>
          <h2 className="bend-h2 font-display">Featured homes for sale.</h2>
          <p className="bend-prose" style={{ maxWidth: 760 }}>
            A live look at top-of-market homes in Bend, sorted by price. Click any home for the
            full package. Gallery, history, neighborhood context, and a direct line to a local
            broker for a private showing.
          </p>

          {listings.length === 0 ? (
            <p className="bend-prose" style={{ color: 'rgba(16,39,66,0.6)' }}>
              Inventory is refreshing. Check back shortly or call{' '}
              <a href={`tel:${CONTACT.phoneFubTel}`} style={{ textDecoration: 'underline' }}>{CONTACT.phoneFub}</a>{' '}
              for a live search.
            </p>
          ) : (
            <>
              <div className="listings-grid">
                {listings.map((l) => {
                  const cardData: ListingCardData = {
                    listingKey: l.listing_key,
                    listNumber: l.list_number,
                    address: l.address,
                    city: l.city,
                    listPrice: l.list_price,
                    beds: l.beds,
                    baths: l.baths,
                    sqft: l.sqft,
                    photoUrl: l.photo_url,
                    statusLabel: 'Active',
                  }
                  return <ListingCard key={l.listing_key} listing={cardData} />
                })}
              </div>
              <div className="featured-cta-row">
                <Link href="/homes-for-sale/bend" className="featured-cta-primary">
                  Search Bend homes →
                </Link>
                <a href={`tel:${CONTACT.phoneFubTel}`} className="featured-cta-secondary">
                  Talk to a broker · {CONTACT.phoneFub}
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* LIVING IN BEND — positive frames only */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">The Bend lifestyle</div>
          <h2 className="bend-h2 font-display">A small mountain town that lives big.</h2>
          <p className="bend-prose lg" style={{ maxWidth: 780 }}>
            People move to Bend for one of three reasons. The Cascades on one side. The
            Deschutes River through the middle. Or the food and beer scene that grew up around
            both. Most stay for all three.
          </p>

          {/* Hero lifestyle card — a single wide editorial moment */}
          <div className="lifestyle-hero">
            <div className="lifestyle-hero-img" style={{ position: 'relative' }}>
              <Image
                src="https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1600&q=80&auto=format"
                alt="Mt. Bachelor and the Cascades above Bend"
                fill
                sizes="(max-width: 880px) 100vw, 55vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="lifestyle-hero-body">
              <div className="lifestyle-hero-eyebrow">Mountain &amp; trail</div>
              <h3 className="lifestyle-hero-title font-display">Mt. Bachelor mornings, Phil&rsquo;s Trail afternoons.</h3>
              <p className="lifestyle-hero-text">
                Mt. Bachelor opens late November and runs through late spring. By June the snow
                lifts and the Phil&rsquo;s Trail network opens for mountain biking. Smith Rock
                State Park is 30 minutes north. Three Sisters Wilderness is the western horizon
                from most of the city.
              </p>
            </div>
          </div>

          {/* Three-card lifestyle grid below the hero */}
          <div className="lifestyle-grid">
            <article className="lifestyle-card">
              <Image
                src="https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=900&q=80&auto=format"
                alt="The Deschutes River through Bend"
                fill
                sizes="(max-width: 920px) 100vw, 33vw"
                style={{ objectFit: 'cover', zIndex: 0 }}
              />
              <div className="lifestyle-card-body">
                <div className="lifestyle-card-eyebrow">River &amp; water</div>
                <h3>The Deschutes is downtown.</h3>
                <p>
                  Float the Old Mill stretch in summer. Paddle from Riverbend Park. Fly fish the
                  high lakes by August. The river is a 5-minute walk from most of the west side.
                </p>
              </div>
            </article>

            <article className="lifestyle-card">
              <Image
                src="https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=900&q=80&auto=format"
                alt="Bend craft beer and food scene"
                fill
                sizes="(max-width: 920px) 100vw, 33vw"
                style={{ objectFit: 'cover', zIndex: 0 }}
              />
              <div className="lifestyle-card-body">
                <div className="lifestyle-card-eyebrow">Beer &amp; food</div>
                <h3>Where Oregon craft beer started.</h3>
                <p>
                  Deschutes Brewery opened in 1988. Crux, 10 Barrel, Worthy, Sunriver, and
                  Bridge 99 followed. Restaurants run from Bos Taurus to Pine Tavern.
                </p>
              </div>
            </article>

            <article className="lifestyle-card">
              <Image
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80&auto=format"
                alt="Downtown Bend culture and shops"
                fill
                sizes="(max-width: 920px) 100vw, 33vw"
                style={{ objectFit: 'cover', zIndex: 0 }}
              />
              <div className="lifestyle-card-body">
                <div className="lifestyle-card-eyebrow">Downtown culture</div>
                <h3>The Old Mill, the Tower, the Box Factory.</h3>
                <p>
                  Riverside shops in the old timber district. Tower Theatre concerts in a
                  restored 1940 art deco hall. First Friday gallery walk. Summer markets at
                  Drake and Riverbend.
                </p>
              </div>
            </article>
          </div>

          {/* Schools + Economy stay as quick-stat cards (smaller, supporting role) */}
          <div className="lifestyle-stats">
            <div className="lifestyle-stat">
              <div className="lifestyle-stat-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102742" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 10l10-6 10 6-10 6-10-6z" />
                  <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
                </svg>
              </div>
              <div>
                <div className="lifestyle-stat-title">Schools</div>
                <div className="lifestyle-stat-text">
                  One district city-wide: Bend-La Pine. Five high schools (Summit, Mountain
                  View, Bend, Caldera, La Pine), an early-college academy, and charter options
                  like REALMS and Cascades Academy.
                </div>
              </div>
            </div>
            <div className="lifestyle-stat">
              <div className="lifestyle-stat-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102742" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 21V8l8-5 8 5v13" />
                  <path d="M9 21V13h6v8" />
                </svg>
              </div>
              <div>
                <div className="lifestyle-stat-title">Local economy</div>
                <div className="lifestyle-stat-text">
                  St. Charles Health System anchors healthcare with 4,000-plus employees.
                  Growing software and consumer-product cluster. Hospitality across Tetherow,
                  Pronghorn, and Sunriver. City, county, and school district round out the
                  largest employers.
                </div>
              </div>
            </div>
            <div className="lifestyle-stat">
              <div className="lifestyle-stat-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#102742" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              </div>
              <div>
                <div className="lifestyle-stat-title">Climate</div>
                <div className="lifestyle-stat-text">
                  High desert. Four real seasons. Dry, sunny summers in the 75-90°F range with
                  cool nights. Snow at the Mt. Bachelor base November through April. The city
                  itself sees periodic snow but not the resort total.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET KPIS */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">The market right now</div>
          <h2 className="bend-h2 font-display">Bend single-family, rolling 12 months.</h2>
          <p className="bend-prose" style={{ maxWidth: 760 }}>
            Live data pulled from the Oregon RMLS feed and refreshed every six hours.
          </p>
          {kpis ? (
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Sold</div>
                <div className="kpi-value">{fmtCount(kpis.sold_count)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Median close</div>
                <div className="kpi-value">{fmtUsd(kpis.median_sale_price, { compact: true })}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Median DOM</div>
                <div className="kpi-value">{kpis.median_dom ?? '—'}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Sale-to-list</div>
                <div className="kpi-value">{fmtPct(kpis.avg_sale_to_list_ratio)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Median $/sqft</div>
                <div className="kpi-value">{fmtUsd(kpis.median_ppsf, { compact: true })}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Active today</div>
                <div className="kpi-value">{kpis.end_of_period_inventory?.toLocaleString() ?? '—'}</div>
              </div>
            </div>
          ) : (
            <p className="bend-prose" style={{ color: 'rgba(16,39,66,0.6)' }}>
              Market data is refreshing.
            </p>
          )}
        </div>
      </section>

      {/* PEER CITY COMPARISON */}
      {peers.length > 1 && (
        <section className="bend-section">
          <div className="bend-shell">
            <div className="bend-eyebrow">Central Oregon at a glance</div>
            <h2 className="bend-h2 font-display">Bend in context across the region.</h2>
            <table className="compare-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th className="num">Sold 12mo</th>
                  <th className="num">Median close</th>
                  <th className="num">Median DOM</th>
                  <th className="num">Sale-to-list</th>
                  <th className="num">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.geo_slug} className={p.geo_slug === 'bend' ? 'featured' : undefined}>
                    <td>{p.geo_label ?? p.geo_slug}</td>
                    <td className="num">{fmtCount(p.sold_count)}</td>
                    <td className="num">{fmtUsd(p.median_sale_price, { compact: true })}</td>
                    <td className="num">{p.median_dom ?? '—'}</td>
                    <td className="num">{fmtPct(p.avg_sale_to_list_ratio)}</td>
                    <td className="num">{fmtUsd(p.median_ppsf, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* BROKER BIO — trust block before the final CTAs */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Your broker</div>
          <h2 className="bend-h2 font-display">Matt Ryan, Oregon Principal Broker.</h2>
          <div className="broker-bio">
            <div
              className="broker-photo"
              style={{ backgroundImage: "url('/images/brokers/ryan-matt.jpg')" }}
              role="presentation"
            />
            <div>
              <div className="broker-name">Matt Ryan</div>
              <div className="broker-title">Owner · Oregon Principal Broker #201206613</div>
              <p className="broker-text">
                Matt has sold homes in Bend since 2012. He lives in the Bend-La Pine school
                district, skis Mt. Bachelor, and works the west-side builder roster by name.
                Thirty minutes on the phone is free, whether you are buying, selling, or still
                deciding.
              </p>
              <div className="broker-cta-row">
                <a href={`tel:${CONTACT.phoneFubTel}`} className="broker-cta-primary">
                  Call {CONTACT.phoneFub}
                </a>
                <Link href="/team/matt-ryan" className="broker-cta-secondary">
                  See full bio →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="cta-row">
            <div className="cta-card">
              <div className="bend-eyebrow" style={{ color: 'rgba(250,248,244,0.72)' }}>Sellers</div>
              <h3>Get your home’s value</h3>
              <p>
                A 12-page value report on your neighborhood and price tier, built on closed Bend
                sales. Signed by a Bend principal broker.
              </p>
              <Link href="/sell" className="btn">
                Get my home value →
              </Link>
            </div>
            <div className="cta-card alt">
              <div className="bend-eyebrow">Buyers</div>
              <h3>Looking at Bend homes?</h3>
              <p>
                Open any neighborhood above for HOA tiers and inventory, or call Matt at{' '}
                <a href={`tel:${CONTACT.phoneFubTel}`} style={{ color: '#102742', textDecoration: 'underline' }}>
                  {CONTACT.phoneFub}
                </a>{' '}
                for a 30-minute relocation call.
              </p>
              <Link href="/buy" className="btn">
                See the buyer track →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* METHODOLOGY */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Sources</div>
          <p className="methodology" style={{ maxWidth: 880 }}>
            12-month sold, median close, sale-to-list, and median $/sqft from Market Truth leftover
            (detached, city grain) for Bend and peer cities. Miss omits. Median DOM from cache.
            Other KPI cells from Oregon RMLS via{' '}
            <code>market_stats_cache</code>, <code>geo_slug=&apos;bend&apos;</code>, rolling
            365-day window. Methodology {kpis?.methodology_version ?? 'v3-2026-05-07'}, computed{' '}
            {fmtDate(kpis?.computed_at)}. Active listing inventory pulled live from the{' '}
            <code>listings</code> table, filtered to single-family residential in Bend.
            Neighborhood boundaries from City of Bend GIS via <code>boundaries</code> table. Ryan
            Realty LLC, Oregon Principal Broker #201206613. Equal Housing Opportunity.
          </p>
        </div>
      </section>

      {/* BreadcrumbList — matches the page's logical position in the site hierarchy. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
              { '@type': 'ListItem', position: 2, name: 'Bend, Oregon', item: `${siteUrl}/lp/bend/` },
            ],
          }),
        }}
      />
      {/* Dataset — leftover 12-month sold/median/SLT/ppsf; remaining cells from cache.
          Only include a metric when its value is non-null (CLAUDE.md data-accuracy). */}
      {kpis && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Dataset',
              name: 'Bend, Oregon single-family residential market statistics (rolling 12 months)',
              description:
                'Market statistics for Bend, Oregon detached houses. 12-month closed count, median close, sale-to-list, and median price per sq ft from Market Truth leftover; remaining cells from Oregon RMLS cache.',
              url: `${siteUrl}/lp/bend/`,
              creator: { '@type': 'RealEstateAgent', name: 'Ryan Realty', url: siteUrl },
              ...(kpis.computed_at ? { dateModified: kpis.computed_at } : {}),
              spatialCoverage: { '@type': 'City', name: 'Bend', address: { '@type': 'PostalAddress', addressLocality: 'Bend', addressRegion: 'OR', addressCountry: 'US' } },
              variableMeasured: [
                ...(kpis.sold_count != null && kpis.sold_count > 0 ? [{ '@type': 'PropertyValue', name: 'Homes sold (rolling 12 months)', value: kpis.sold_count, unitText: 'homes' }] : []),
                ...(kpis.median_sale_price != null && kpis.median_sale_price > 0 ? [{ '@type': 'PropertyValue', name: 'Median sale price', value: kpis.median_sale_price, unitText: 'USD' }] : []),
                ...(kpis.median_dom != null && kpis.median_dom > 0 ? [{ '@type': 'PropertyValue', name: 'Median days on market', value: kpis.median_dom, unitText: 'days' }] : []),
                ...(kpis.avg_sale_to_list_ratio != null && kpis.avg_sale_to_list_ratio > 0 ? [{ '@type': 'PropertyValue', name: 'Average sale-to-list ratio', value: kpis.avg_sale_to_list_ratio }] : []),
                ...(kpis.median_ppsf != null && kpis.median_ppsf > 0 ? [{ '@type': 'PropertyValue', name: 'Median price per sq ft', value: kpis.median_ppsf, unitText: 'USD' }] : []),
                ...(kpis.end_of_period_inventory != null && kpis.end_of_period_inventory > 0 ? [{ '@type': 'PropertyValue', name: 'Active inventory', value: kpis.end_of_period_inventory, unitText: 'homes' }] : []),
              ],
            }),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'City',
            name: 'Bend',
            url: `${siteUrl}/lp/bend/`,
            description:
              'Bend, Oregon is a Central Oregon mountain city of about 105,000 on the east side of the Cascade Range. This page is the canonical search-authority surface for homes for sale in Bend, with active inventory, neighborhood map, and broker contact.',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Bend',
              addressRegion: 'OR',
              addressCountry: 'US',
            },
            geo: {
              '@type': 'GeoCoordinates',
              latitude: 44.0582,
              longitude: -121.3153,
            },
            containedInPlace: {
              '@type': 'State',
              name: 'Oregon',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: 'Ryan Realty',
            url: siteUrl,
            telephone: CONTACT.phoneDirectTel,
            email: 'matt@ryan-realty.com',
            address: {
              '@type': 'PostalAddress',
              streetAddress: '115 NW Oregon Avenue',
              addressLocality: 'Bend',
              addressRegion: 'OR',
              postalCode: '97703',
              addressCountry: 'US',
            },
            areaServed: { '@type': 'City', name: 'Bend' },
          }),
        }}
      />
    </main>
  )
}

/**
 * Bend, Oregon — city-level landing page at /lp/bend/.
 *
 * Tier 1 of the four-tier search-authority stack — the top-of-funnel SEO +
 * AEO surface for "homes for sale in Bend Oregon" queries. ISR 6h.
 *
 * Spec: marketing_brain_skills/producers/site-city-page/SKILL.md
 * First exemplar; Sisters, Redmond, La Pine, Tumalo follow.
 *
 * Tone: Welcome-first, positive, broker-as-host. No disclosures, no negative
 *       framing — the city sells itself. Map + listings + neighborhoods do the
 *       heavy lifting.
 */
import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { Metadata } from 'next'
import Link from 'next/link'

import { createServiceClient } from '@/lib/supabase/service'
import LandingPageTracker from '@/components/LandingPageTracker'
import { ListingCard, type ListingCardData } from '@/components/lp/ListingCard'
import { BendInteractiveMap } from './_components/BendInteractiveMap'
import type { CommunityPolygon } from './_components/BendInteractiveMap'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Homes for sale in Bend, Oregon | Ryan Realty',
  description:
    "Welcome to Bend. Search active homes, explore every Bend neighborhood and resort community, and meet a local principal broker. Current market data refreshed daily.",
  alternates: { canonical: `${siteUrl}/lp/bend/` },
  openGraph: {
    title: 'Welcome to Bend, Oregon',
    description:
      "Search homes for sale in Bend, explore every neighborhood, and meet a local principal broker.",
    type: 'website',
    url: `${siteUrl}/lp/bend/`,
    images: [`${siteUrl}/lp/bend/img/bend-hero.jpg`],
  },
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

async function loadBendKpis(): Promise<Kpis | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('market_stats_cache')
    .select(
      'sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, computed_at, methodology_version',
    )
    .eq('geo_slug', 'bend')
    .eq('period_type', 'rolling_365d')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[bend lp] kpi query failed:', error.message)
    return null
  }
  return (data ?? null) as Kpis | null
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

    const supabase = createServiceClient()
    const { data: kpiRows } = await supabase
      .from('market_stats_cache')
      .select('geo_slug, sold_count, median_sale_price, end_of_period_inventory')
      .in(
        'geo_slug',
        slugs.map((s) => s.geo_slug ?? s.slug),
      )
      .eq('period_type', 'rolling_365d')
      .order('period_end', { ascending: false })

    const byGeo = new Map<string, { sold_count: number | null; median_sale_price: number | null; end_of_period_inventory: number | null }>()
    for (const r of (kpiRows ?? []) as Array<{ geo_slug: string; sold_count: number | null; median_sale_price: number | null; end_of_period_inventory: number | null }>) {
      if (!byGeo.has(r.geo_slug)) byGeo.set(r.geo_slug, r)
    }

    for (const s of slugs) {
      const k = byGeo.get(s.geo_slug ?? s.slug)
      out.push({
        slug: s.slug,
        name: s.name,
        label: s.name,
        hero_image: s.hero,
        sold_count: k?.sold_count ?? null,
        median_sale_price: k?.median_sale_price ?? null,
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
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('listings')
    .select(
      '"ListingKey","ListNumber","StreetNumber","StreetName","City","ListPrice","BedroomsTotal","BathroomsTotal","TotalLivingAreaSqFt","PhotoURL"',
    )
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', 'A')
    .eq('City', 'Bend')
    .gte('ListPrice', 750_000)
    .order('ListPrice', { ascending: false })
    .limit(8)
  if (error) {
    console.warn('[bend lp] active listings query failed:', error.message)
    return []
  }
  type Row = {
    ListingKey: string
    ListNumber: string
    StreetNumber: string | null
    StreetName: string | null
    City: string
    ListPrice: number | string
    BedroomsTotal: number | null
    BathroomsTotal: string | null
    TotalLivingAreaSqFt: string | null
    PhotoURL: string | null
  }
  return ((data ?? []) as Row[]).map((r) => ({
    list_number: r.ListNumber,
    listing_key: r.ListingKey,
    address: [r.StreetNumber, r.StreetName].filter(Boolean).join(' '),
    city: r.City,
    list_price: Number(r.ListPrice ?? 0),
    beds: r.BedroomsTotal,
    baths: r.BathroomsTotal,
    sqft: r.TotalLivingAreaSqFt,
    photo_url: r.PhotoURL,
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

async function loadPeerCities(): Promise<PeerKpiRow[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('market_stats_cache')
    .select('geo_slug, geo_label, sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf')
    .in('geo_slug', ['bend', 'redmond', 'sisters', 'la-pine', 'terrebonne'])
    .eq('period_type', 'rolling_365d')
    .order('median_sale_price', { ascending: false })

  const seen = new Set<string>()
  const out: PeerKpiRow[] = []
  for (const r of (data ?? []) as PeerKpiRow[]) {
    if (seen.has(r.geo_slug)) continue
    seen.add(r.geo_slug)
    out.push(r)
  }
  return out
}

function fmtUsd(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null) return '—'
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
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
        .bend-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 72px; line-height: 1.02; margin: 0 0 18px; letter-spacing: -0.018em; font-weight: 500; }
        @media (max-width: 720px) { .bend-h1 { font-size: 48px; } }
        .bend-h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; line-height: 1.12; margin: 0 0 16px; letter-spacing: -0.012em; font-weight: 500; }
        @media (max-width: 720px) { .bend-h2 { font-size: 30px; } }
        .bend-h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; line-height: 1.2; margin: 0 0 10px; font-weight: 500; }
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
        .facts-sidebar dd { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin: 4px 0 0; line-height: 1.2; font-variant-numeric: tabular-nums; }
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
        .community-photo { aspect-ratio: 16/10; background: rgba(16,39,66,0.06); background-size: cover; background-position: center; }
        .community-body { padding: 18px 22px 22px; }
        .community-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin: 0 0 6px; font-weight: 500; }
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
        .lifestyle-hero-title { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; line-height: 1.15; margin: 0 0 14px; font-weight: 500; color: #102742; letter-spacing: -0.01em; }
        .lifestyle-hero-text { font-size: 15.5px; line-height: 1.62; color: rgba(16,39,66,0.82); margin: 0; }

        .lifestyle-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 18px; }
        @media (max-width: 920px) { .lifestyle-grid { grid-template-columns: repeat(1, 1fr); } }
        .lifestyle-card { position: relative; aspect-ratio: 4/5; border-radius: 16px; overflow: hidden; background-color: rgba(16,39,66,0.1); background-size: cover; background-position: center; box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 8px 24px rgba(16,39,66,0.1); display: flex; flex-direction: column; justify-content: flex-end; transition: transform 0.25s, box-shadow 0.25s; }
        .lifestyle-card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(16,39,66,0.04), 0 16px 36px rgba(16,39,66,0.18); }
        .lifestyle-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(16,39,66,0) 0%, rgba(16,39,66,0) 35%, rgba(16,39,66,0.65) 70%, rgba(16,39,66,0.95) 100%); pointer-events: none; }
        .lifestyle-card-body { position: relative; z-index: 2; padding: 22px 24px 24px; color: #faf8f4; }
        .lifestyle-card-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(250,248,244,0.78); margin-bottom: 6px; }
        .lifestyle-card h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; line-height: 1.15; margin: 0 0 8px; font-weight: 500; color: #faf8f4; letter-spacing: -0.005em; }
        .lifestyle-card p { font-size: 13.5px; line-height: 1.5; color: rgba(250,248,244,0.92); margin: 0; }

        .lifestyle-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 24px; }
        @media (max-width: 920px) { .lifestyle-stats { grid-template-columns: 1fr; } }
        .lifestyle-stat { display: flex; align-items: flex-start; gap: 14px; padding: 22px 24px; background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; box-shadow: 0 1px 2px rgba(16,39,66,0.03); }
        .lifestyle-stat-icon { flex-shrink: 0; width: 38px; height: 38px; border-radius: 10px; background: rgba(16,39,66,0.06); display: flex; align-items: center; justify-content: center; }
        .lifestyle-stat-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; line-height: 1.2; font-weight: 500; color: #102742; margin: 0 0 6px; }
        .lifestyle-stat-text { font-size: 13px; line-height: 1.55; color: rgba(16,39,66,0.78); margin: 0; }

        /* BROKER BIO — "Meet a local" personal block, builds trust before the final CTA */
        .broker-bio { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; align-items: center; margin-top: 24px; background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 18px; padding: 36px 38px; box-shadow: 0 1px 2px rgba(16,39,66,0.03), 0 8px 24px rgba(16,39,66,0.06); }
        @media (max-width: 760px) { .broker-bio { grid-template-columns: 1fr; padding: 28px 26px; gap: 22px; } }
        .broker-photo { aspect-ratio: 3/4; background: rgba(16,39,66,0.06); background-size: cover; background-position: center top; border-radius: 14px; max-width: 280px; }
        @media (max-width: 760px) { .broker-photo { max-width: 200px; margin: 0 auto; } }
        .broker-name { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; line-height: 1.15; margin: 0 0 4px; font-weight: 500; color: #102742; }
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
        .kpi-value { font-family: 'Playfair Display', Georgia, serif; font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; font-weight: 500; }

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
        .cta-card h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; margin: 0 0 12px; color: inherit; font-weight: 500; }
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
          <h1 className="bend-h1">Welcome to Bend, Oregon.</h1>
          <p>
            A small mountain city with the Cascades on one side and the high desert on the other.
            Search active homes, explore every neighborhood and resort community, and meet a local
            principal broker who actually lives here.
          </p>
          <div className="hero-cta-row">
            <Link href="#listings" className="btn-primary">
              See active homes
            </Link>
            <Link href="#neighborhoods" className="btn-ghost-light">
              Explore neighborhoods
            </Link>
          </div>
        </div>
      </header>

      {/* WELCOME + FACTS */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="grid-2-1">
            <div>
              <div className="bend-eyebrow">A short introduction</div>
              <h2 className="bend-h2">A small mountain city. A wide-open lifestyle.</h2>
              <p className="bend-prose lg">
                Bend sits on the eastern flank of the Cascade Range at 3,623 feet, with the
                Deschutes River running through downtown and Mt. Bachelor rising 22 miles to the
                southwest. About 105,000 people call it home. The city has grown into one of the
                Pacific Northwest&rsquo;s most loved places to live, work, and visit, while keeping
                the feel of a friendly mountain town.
              </p>
              <p className="bend-prose">
                The neighborhoods and resort communities each have their own personality.
                Tetherow and Broken Top on the west side hug the golf and the Cascades. NorthWest
                Crossing leans walkable and family-forward. Old Bend and River West sit closest to
                downtown and the river. Pronghorn is the high-desert escape on the north end. The
                interactive map below lets you click any neighborhood polygon to drill in.
              </p>
              <p className="bend-prose">
                Below the map, you&rsquo;ll find active homes for sale across the city, the current
                market data refreshed daily, and a quick read on what life in Bend actually looks
                like across recreation, food, schools, and the local economy.
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
                <dd>{kpis?.sold_count?.toLocaleString() ?? '—'}<span className="sub">Single-family homes</span></dd>
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
          <h2 className="bend-h2">Click a neighborhood to drill in.</h2>
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
            <h2 className="bend-h2">Master-planned, with their own search-authority pages.</h2>
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
                      {c.sold_count != null && (
                        <span>
                          <strong>{c.sold_count}</strong> sold past 12mo
                        </span>
                      )}
                      {c.median_sale_price != null && (
                        <span>
                          <strong>{fmtUsd(c.median_sale_price, { compact: true })}</strong> median
                        </span>
                      )}
                      {c.active_count != null && (
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

      {/* FEATURED HOMES — premier inventory + showing CTA per card */}
      <section id="listings" className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Bend&rsquo;s premier inventory</div>
          <h2 className="bend-h2">Featured homes for sale.</h2>
          <p className="bend-prose" style={{ maxWidth: 760 }}>
            A live look at top-of-market homes in Bend, sorted by price. Click any home for the
            full package — gallery, history, neighborhood context, and a direct line to a local
            broker for a private showing.
          </p>

          {listings.length === 0 ? (
            <p className="bend-prose" style={{ color: 'rgba(16,39,66,0.6)' }}>
              Inventory is refreshing. Check back shortly or call{' '}
              <a href="tel:+15412136706" style={{ textDecoration: 'underline' }}>541.213.6706</a>{' '}
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
                <a href="tel:+15412136706" className="featured-cta-secondary">
                  Talk to a broker · 541.213.6706
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
          <h2 className="bend-h2">A small mountain town that lives big.</h2>
          <p className="bend-prose lg" style={{ maxWidth: 780 }}>
            People move to Bend for one of three reasons. The Cascades on one side. The
            Deschutes River through the middle. Or the food and beer scene that grew up around
            both. Most stay for all three.
          </p>

          {/* Hero lifestyle card — a single wide editorial moment */}
          <div className="lifestyle-hero">
            <div
              className="lifestyle-hero-img"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1600&q=80&auto=format')" }}
              role="presentation"
            />
            <div className="lifestyle-hero-body">
              <div className="lifestyle-hero-eyebrow">Mountain &amp; trail</div>
              <h3 className="lifestyle-hero-title">Mt. Bachelor mornings, Phil&rsquo;s Trail afternoons.</h3>
              <p className="lifestyle-hero-text">
                Mt. Bachelor opens late November and runs through late spring. By June the snow
                lifts and the Phil&rsquo;s Trail network turns into one of the densest mountain-bike
                systems in the Pacific Northwest. Smith Rock State Park, 30 minutes north, is one
                of the country&rsquo;s most-loved sport-climbing destinations. Three Sisters
                Wilderness is the western horizon from most of the city.
              </p>
            </div>
          </div>

          {/* Three-card lifestyle grid below the hero */}
          <div className="lifestyle-grid">
            <article
              className="lifestyle-card"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=900&q=80&auto=format')" }}
            >
              <div className="lifestyle-card-body">
                <div className="lifestyle-card-eyebrow">River &amp; water</div>
                <h3>The Deschutes is downtown.</h3>
                <p>
                  Float the Old Mill stretch in summer. Paddle from Riverbend Park. Fly fish the
                  high lakes by August. The river is a 5-minute walk from most of the west side.
                </p>
              </div>
            </article>

            <article
              className="lifestyle-card"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=900&q=80&auto=format')" }}
            >
              <div className="lifestyle-card-body">
                <div className="lifestyle-card-eyebrow">Beer &amp; food</div>
                <h3>Where Oregon craft beer started.</h3>
                <p>
                  Deschutes Brewery opened in 1988 and the city never looked back. Add Crux,
                  10 Barrel, Worthy, Sunriver, Bridge 99. And a restaurant scene from Bos Taurus
                  to Pine Tavern that punches above its weight.
                </p>
              </div>
            </article>

            <article
              className="lifestyle-card"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80&auto=format')" }}
            >
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
          <h2 className="bend-h2">Bend single-family, rolling 12 months.</h2>
          <p className="bend-prose" style={{ maxWidth: 760 }}>
            Live data pulled from the Oregon RMLS feed and refreshed every six hours.
          </p>
          {kpis ? (
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Sold</div>
                <div className="kpi-value">{kpis.sold_count?.toLocaleString() ?? '—'}</div>
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
            <h2 className="bend-h2">Bend in context across the region.</h2>
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
                    <td className="num">{p.sold_count?.toLocaleString() ?? '—'}</td>
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
          <div className="bend-eyebrow">Meet a local broker</div>
          <h2 className="bend-h2">Matt Ryan — Oregon Principal Broker.</h2>
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
                I&rsquo;ve been selling homes in Bend since 2012, and I actually live here. My
                kids go to Bend-La Pine schools, I ski Mt. Bachelor every winter, and I know the
                builder roster on every west-side neighborhood by first name. If you&rsquo;re
                buying, selling, or just trying to figure out the right move, I&rsquo;m happy to
                spend 30 minutes on the phone with no pressure either way.
              </p>
              <div className="broker-cta-row">
                <a href="tel:+15412136706" className="broker-cta-primary">
                  Call 541.213.6706
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
              <h3>What&rsquo;s your Bend home worth?</h3>
              <p>
                A 12-page home value report tailored to your neighborhood and price tier, built on
                verified Bend close history. Signed by a Bend principal broker.
              </p>
              <Link href="/sell" className="btn">
                Get my home value →
              </Link>
            </div>
            <div className="cta-card alt">
              <div className="bend-eyebrow">Buyers</div>
              <h3>Looking at Bend homes?</h3>
              <p>
                Drill into any neighborhood above for HOA tiers and the buyer track, or call Matt
                direct at{' '}
                <a href="tel:+15412136706" style={{ color: '#102742', textDecoration: 'underline' }}>
                  541.213.6706
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
            Market figures pulled from Oregon RMLS via <code>market_stats_cache</code>,{' '}
            <code>geo_slug=&apos;bend&apos;</code>, rolling 365-day window. Methodology{' '}
            {kpis?.methodology_version ?? 'v4-2026-05-15'}, computed {fmtDate(kpis?.computed_at)}.
            Active listing inventory pulled live from the <code>listings</code> table, filtered to
            single-family residential in Bend. Neighborhood boundaries from City of Bend GIS via{' '}
            <code>boundaries</code> table. Ryan Realty LLC, Oregon Principal Broker #201206613.
            Equal Housing Opportunity.
          </p>
        </div>
      </section>

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
            telephone: '+1-541-213-6706',
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

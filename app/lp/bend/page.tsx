/**
 * Bend, Oregon — city-level landing page at /lp/bend/.
 *
 * Tier 1 of the four-tier search-authority stack — the top-of-funnel SEO +
 * AEO surface for "homes for sale in Bend Oregon" queries. ISR 6h.
 *
 * Spec: marketing_brain_skills/producers/site-city-page/SKILL.md
 * First exemplar; Sisters, Redmond, La Pine, Tumalo follow.
 */
import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import LandingPageTracker from '@/components/LandingPageTracker'

export const dynamic = 'force-static'
export const revalidate = 21600 // 6h

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Homes for sale in Bend, Oregon — market data + neighborhood guide | Ryan Realty',
  description:
    'Bend, Oregon real estate. 1,648 closings past 12mo at $715K median, 26-day market velocity, 95.4% sale-to-list. Tile grid of every resort community + neighborhood, schools, climate, relocation block.',
  alternates: { canonical: `${siteUrl}/lp/bend/` },
  openGraph: {
    title: 'Homes for sale in Bend, Oregon',
    description:
      "Bend, Oregon's market data + neighborhood + community guide from a local principal broker.",
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
  // Find every resort-community-*.json in data/ whose city is Bend.
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
    .in('geo_slug', ['bend', 'redmond', 'sisters', 'la-pine', 'tumalo', 'terrebonne'])
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

function fmtMonthYear(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
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
  const [kpis, communities, peers] = await Promise.all([
    loadBendKpis(),
    loadBendCommunitiesIndex(),
    loadPeerCities(),
  ])
  const monthYear = fmtMonthYear()

  return (
    <main className="bend-lp">
      <LandingPageTracker lpVariant="bend-city-landing-v1" />
      <style>{`
        :root { --tw-cream: #faf8f4; --tw-navy: #102742; --tw-muted: #5d6470; }
        .bend-lp { background-color: #faf8f4; color: #102742; font-family: 'Geist', system-ui, sans-serif; }
        .bend-shell { max-width: 1100px; margin: 0 auto; padding: 32px; }
        .bend-section { padding: 44px 0; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .bend-section:last-child { border-bottom: none; }
        .bend-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 10px; }
        .bend-h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 52px; line-height: 1.05; margin: 0 0 16px; letter-spacing: -0.012em; }
        .bend-h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; line-height: 1.15; margin: 0 0 14px; letter-spacing: -0.01em; }
        .bend-h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; line-height: 1.2; margin: 0 0 10px; }
        .bend-prose { font-size: 16.5px; line-height: 1.65; margin: 0 0 14px; }
        .hero { position: relative; min-height: 540px; overflow: hidden; }
        .hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; transform: scale(1.02); }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(16,39,66,0.20) 0%, rgba(16,39,66,0.55) 55%, rgba(16,39,66,0.95) 100%); }
        .hero .bend-shell { position: relative; padding-top: 88px; padding-bottom: 36px; color: #faf8f4; }
        .hero .bend-eyebrow { color: rgba(250,248,244,0.72); }
        .hero .bend-h1 { color: #faf8f4; }
        .hero p { color: rgba(250,248,244,0.92); max-width: 720px; }
        .hero-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0; background: rgba(16,39,66,0.7); backdrop-filter: blur(8px); border-radius: 12px; overflow: hidden; max-width: 980px; margin-top: 24px; }
        .hero-stat { padding: 20px 22px; border-right: 1px solid rgba(250,248,244,0.12); color: #faf8f4; }
        .hero-stat:last-child { border-right: none; }
        .hero-stat-value { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; line-height: 1; margin-bottom: 4px; font-variant-numeric: tabular-nums; }
        .hero-stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
        .grid-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 32px; align-items: start; }
        @media (max-width: 860px) { .grid-2-1 { grid-template-columns: 1fr; } }
        .facts-sidebar { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; padding: 24px 26px; position: sticky; top: 24px; }
        .facts-sidebar dt { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-top: 14px; }
        .facts-sidebar dt:first-of-type { margin-top: 0; }
        .facts-sidebar dd { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; margin: 0; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .facts-sidebar dd .sub { display: block; font-family: 'Geist', system-ui, sans-serif; font-size: 12px; color: rgba(16,39,66,0.62); margin-top: 2px; font-weight: 500; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 18px; }
        .kpi-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 12px; padding: 18px; }
        .kpi-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); margin-bottom: 6px; }
        .kpi-value { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; line-height: 1; font-variant-numeric: tabular-nums; }
        .community-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
        .community-card { background: white; border: 1px solid rgba(16,39,66,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; }
        .community-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16,39,66,0.10); }
        .community-photo { aspect-ratio: 16/10; background: rgba(16,39,66,0.08); background-size: cover; background-position: center; }
        .community-body { padding: 16px 18px 18px; }
        .community-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; margin: 0 0 4px; }
        .community-stats { display: flex; gap: 14px; font-size: 12.5px; color: rgba(16,39,66,0.62); }
        .community-stats strong { color: #102742; font-weight: 600; }
        .map-card { aspect-ratio: 7/5; background: rgba(16,39,66,0.08); border-radius: 12px; overflow: hidden; position: relative; max-width: 700px; }
        .compare-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid rgba(16,39,66,0.08); }
        .compare-table th, .compare-table td { padding: 12px 14px; text-align: left; font-size: 13.5px; border-bottom: 1px solid rgba(16,39,66,0.08); }
        .compare-table th { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(16,39,66,0.62); background: rgba(16,39,66,0.03); }
        .compare-table .num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
        .compare-table tr.featured td { background: rgba(16,39,66,0.03); font-weight: 600; }
        .cta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
        @media (max-width: 700px) { .cta-row { grid-template-columns: 1fr; } }
        .cta-card { background: #102742; color: #faf8f4; padding: 28px; border-radius: 14px; }
        .cta-card.alt { background: white; color: #102742; border: 1px solid rgba(16,39,66,0.12); }
        .cta-card h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 0 0 10px; color: inherit; }
        .cta-card p { font-size: 14.5px; line-height: 1.55; color: inherit; opacity: 0.9; margin: 0 0 14px; }
        .cta-card .btn { display: inline-block; background: #faf8f4; color: #102742; padding: 12px 22px; border-radius: 8px; font-size: 14.5px; font-weight: 700; text-decoration: none; }
        .cta-card.alt .btn { background: #102742; color: #faf8f4; }
        a { color: #102742; }
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
          <div className="bend-eyebrow">Bend, Oregon · Central Oregon</div>
          <h1 className="bend-h1">Homes for sale in Bend, {monthYear}.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.55 }}>
            {kpis?.sold_count?.toLocaleString() ?? '1,648'} homes traded last year at a median{' '}
            {fmtUsd(kpis?.median_sale_price)}. {kpis?.end_of_period_inventory ?? 426} on the market
            right now. {kpis?.median_dom ?? 26}-day median market velocity. The market data + a
            broker who actually lives here.
          </p>

          {kpis && (
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value">{kpis.sold_count?.toLocaleString() ?? '—'}</div>
                <div className="hero-stat-label">Sold past 12mo</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{fmtUsd(kpis.median_sale_price, { compact: true })}</div>
                <div className="hero-stat-label">Median close</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{kpis.median_dom ?? '—'}</div>
                <div className="hero-stat-label">Median days on market</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">{fmtPct(kpis.avg_sale_to_list_ratio)}</div>
                <div className="hero-stat-label">Sale-to-list</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ABOUT BEND */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="grid-2-1">
            <div>
              <div className="bend-eyebrow">Overview</div>
              <h2 className="bend-h2">What Bend actually is.</h2>
              <p className="bend-prose">
                Bend is a Central Oregon high-desert city of about 105,000 on the east side of the
                Cascade range. Twenty years ago it was a timber and ranching town. Today the economy
                runs on outdoor recreation, healthcare (St. Charles Health System employs more than
                4,000), craft brewing (more breweries per capita than anywhere in Oregon), light
                tech and software firms (Five Talent, Hydroflask, Anaconda Computing), and a thick
                second-home market driven by Portland, Seattle, and Bay Area migration.
              </p>
              <p className="bend-prose">
                What makes Bend distinct, real-estate-wise, is the combination of a single high
                school district (Bend-La Pine), a constrained urban growth boundary, and a tight
                ring of high-value sub-markets: Tetherow + Broken Top on the west, NW Crossing in
                the northwest, the Old Mill on the river, the High Desert south to Sunriver. Inside
                that ring the median sits near {fmtUsd(kpis?.median_sale_price, { compact: true })};
                resort communities push the upper tier into the $1.8-$4M range; entry-level
                opportunities exist primarily in the east side and along the southern fringe.
              </p>
              <p className="bend-prose">
                <strong>The honest disclosures.</strong> Bend has wildfire smoke. Some summers the
                AQI stays in the unhealthy range for two-plus weeks. The Cram Fire of July 2025
                produced 14 unhealthy-air days. Winters carry real snow at the {' '}
                <a href="https://www.mtbachelor.com/">Mt. Bachelor</a> base; the city itself sees
                periodic snow but not the resort total. No state sales tax in Oregon. Property taxes
                are constrained by Measure 50 — assessed value grows at most 3% a year. Real
                effective tax rates run around 0.8% to 1.1% of market value, depending on assessor
                district.
              </p>
              <p className="bend-prose">
                <strong>What you actually buy at each price tier.</strong> $500K-$750K buys a
                three-bedroom on the east side, often with a smaller lot and a 1990s-2000s build.
                $750K-$1.2M crosses into the west side and gets you a remodeled or newer build in
                River West, Awbrey Butte fringe, or NW Crossing. $1.5M-$2.5M is the heart of Tetherow,
                Broken Top, and the river-frontage market. Past $2.5M is custom construction, river
                or course frontage, or larger acreage to the north and west.
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
                <dt>Median household income</dt>
                <dd>~$84,000<span className="sub">2023 ACS</span></dd>
                <dt>Sold past 12mo (SFR)</dt>
                <dd>{kpis?.sold_count?.toLocaleString() ?? '1,648'}<span className="sub">Median {fmtUsd(kpis?.median_sale_price)}</span></dd>
                <dt>Active today (SFR)</dt>
                <dd>{kpis?.end_of_period_inventory?.toLocaleString() ?? '426'}<span className="sub">Across the urban growth boundary</span></dd>
                <dt>Median $/sqft</dt>
                <dd>{fmtUsd(kpis?.median_ppsf, { compact: true })}<span className="sub">Trailing 12 months</span></dd>
                <dt>Sales tax</dt>
                <dd>0%<span className="sub">Oregon, statewide</span></dd>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      {/* COMMUNITIES TILE GRID */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Resort communities + neighborhoods inside Bend</div>
          <h2 className="bend-h2">Pick a community.</h2>
          <p className="bend-prose">
            Each resort and master-planned community inside Bend has its own search-authority page
            with HOA tiers, live inventory, recent close history, and broker contact. Click to drill in.
          </p>

          {communities.length === 0 ? (
            <p className="bend-prose" style={{ color: 'rgba(16,39,66,0.62)' }}>
              Community pages roll out as each `site-community-page` execution merges. Watch{' '}
              <Link href="/lp/tetherow/">Tetherow</Link> as the first exemplar.
            </p>
          ) : (
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
                      <span>
                        <strong>{c.sold_count ?? '—'}</strong> sold 12mo
                      </span>
                      {c.median_sale_price && (
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
          )}
        </div>
      </section>

      {/* MAP + DRIVE */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="grid-2-1">
            <div>
              <div className="bend-eyebrow">Where Bend sits</div>
              <h2 className="bend-h2">High desert. East of the Cascades.</h2>
              <p className="bend-prose">
                Bend sits on the eastern flank of the Cascade range, three hours east of Portland by
                car, an hour north of La Pine, twenty minutes south of Redmond and the regional
                airport (RDM). The Deschutes River runs through the city north-to-south. Mt.
                Bachelor — the western horizon from most of the city — is 22 miles southwest. Smith
                Rock State Park, a thirty-minute drive north, is one of the busiest climbing
                destinations in the Pacific Northwest.
              </p>
              <div className="map-card">
                <Image
                  src="/lp/bend/img/bend-city-map.png"
                  alt="Bend, Oregon city map with Tetherow and NW Crossing"
                  width={1280}
                  height={1040}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
            <div>
              <Card>
                <CardContent style={{ padding: 22 }}>
                  <div className="bend-eyebrow">Drive times from downtown Bend</div>
                  <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>22 min</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Mt. Bachelor base</span></div>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>20 min</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Redmond airport (RDM)</span></div>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>32 min</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Sunriver</span></div>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>40 min</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Sisters</span></div>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>30 min</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Smith Rock State Park</span></div>
                    <div><strong style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22 }}>3h 20m</strong><span style={{ fontSize: 12.5, color: 'rgba(16,39,66,0.62)' }}>Portland (PDX)</span></div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET KPIS */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">The market right now</div>
          <h2 className="bend-h2">Single-family Bend market, rolling 12 months.</h2>
          {kpis && (
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
          )}
          <p style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.55)', marginTop: 14 }}>
            Source: Oregon RMLS feed via market_stats_cache rolling-365d window. Methodology{' '}
            {kpis?.methodology_version ?? 'v3-2026-05-07'}. Computed {fmtDate(kpis?.computed_at)}. SFR only.
          </p>
        </div>
      </section>

      {/* RELOCATION BLOCK */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Relocating to Bend</div>
          <h2 className="bend-h2">Cost of living, schools, climate, employers.</h2>
          <div className="grid-2-1">
            <div>
              <h3 className="bend-h3">Cost of living</h3>
              <p className="bend-prose">
                Bend runs about 10-15% above the national average on overall cost of living, driven
                primarily by housing. Groceries and utilities are close to national medians. Gas is
                slightly above. No state sales tax (Oregon, statewide) and property taxes capped by
                Measure 50 at about 3%/yr assessed-value growth. Effective property tax rates run
                roughly 0.8%-1.1% of market value, district-dependent.
              </p>

              <h3 className="bend-h3">Schools</h3>
              <p className="bend-prose">
                One district city-wide: Bend-La Pine Schools. Five high schools (Summit, Mountain
                View, Bend, La Pine, Caldera), plus an early-college academy. Public schools score
                consistently above the state average on standardized testing. Multiple charter
                options including REALMS and Cascades Academy. Verify the exact assignment per
                address at <a href="https://www.bend.k12.or.us/">bend.k12.or.us</a>. The transfer
                process for out-of-boundary requests opens in February for the following fall.
              </p>

              <h3 className="bend-h3">Major employers</h3>
              <p className="bend-prose">
                St. Charles Health System (regional hospital, 4,000+ employees). Mt. Bachelor (resort
                operations, seasonal). Deschutes Brewery, Crux Fermentation Project, 10 Barrel
                Brewing (craft beer cluster). Five Talent (software). BendBroadband (telecom).
                Hydroflask (consumer products). Anaconda Computing (data science / Python). City of
                Bend + Deschutes County (government). Bend-La Pine Schools (~1,500 employees).
                Tetherow, Pronghorn, Sunriver, Black Butte (hospitality + resort operations).
              </p>
            </div>
            <div>
              <h3 className="bend-h3">Climate, honest version</h3>
              <p className="bend-prose">
                High desert: dry, sunny, four real seasons. Summers run 75-90°F daytime, low
                humidity, cool nights. Winters bring real snow at the Mt. Bachelor base; the city
                itself sees periodic snow but not the resort total. Spring and fall are short and
                gorgeous.
              </p>
              <p className="bend-prose">
                <strong>Wildfire smoke is real.</strong> Some summers carry two-plus weeks of
                unhealthy AQI. The Cram Fire in July 2025 produced 14 unhealthy-air days. Buyers
                relocating from cleaner-air regions should plan for an AQI monitor, an indoor air
                purifier per major room, and a flexible summer schedule. The smoke is not every
                summer, and it's not every day, but it's part of the bargain.
              </p>

              <h3 className="bend-h3">Healthcare</h3>
              <p className="bend-prose">
                St. Charles Bend is the regional flagship — a Level II trauma center with 266 beds,
                full cardiac and oncology programs. Bend Memorial Clinic, Bend Surgical Associates,
                and Mosaic Medical operate ambulatory networks. Specialty access for very-rare
                conditions can require Portland or Seattle.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PEER CITY COMPARISON */}
      {peers.length > 1 && (
        <section className="bend-section">
          <div className="bend-shell">
            <div className="bend-eyebrow">Bend vs Central Oregon peers</div>
            <h2 className="bend-h2">How Bend trades against the rest of the region.</h2>
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

      {/* CTAs */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="cta-row">
            <div className="cta-card">
              <div className="bend-eyebrow" style={{ color: 'rgba(250,248,244,0.7)' }}>Sellers</div>
              <h3>What&rsquo;s your Bend home worth?</h3>
              <p>
                Free 12-page home value report, built against verified Bend close history, your
                neighborhood, your price tier. Signed by a Bend principal broker. No phone follow-up
                unless you ask.
              </p>
              <Link href="/sell" className="btn">
                Get my home value
              </Link>
            </div>
            <div className="cta-card alt">
              <div className="bend-eyebrow">Buyers</div>
              <h3>Looking at Bend homes?</h3>
              <p>
                Drill into the resort community pages above for HOA tiers and the buyer track. Or
                call Matt direct at{' '}
                <a href="tel:+15412136706" style={{ color: '#102742', textDecoration: 'underline' }}>
                  541.213.6706
                </a>{' '}
                for a 30-minute relocation call.
              </p>
              <Link href="/buy" className="btn">
                See the buyer track
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* METHODOLOGY */}
      <section className="bend-section">
        <div className="bend-shell">
          <div className="bend-eyebrow">Methodology</div>
          <h2 className="bend-h2" style={{ fontSize: 22 }}>Where every figure came from.</h2>
          <ul className="bend-prose" style={{ paddingLeft: 20, fontSize: 13.5 }}>
            <li>
              <strong>Market KPIs.</strong> Oregon RMLS feed via{' '}
              <code>market_stats_cache</code>, <code>geo_slug=&apos;bend&apos;</code>,{' '}
              <code>period_type=&apos;rolling_365d&apos;</code>. Methodology{' '}
              {kpis?.methodology_version ?? 'v3-2026-05-07'}. Computed{' '}
              {fmtDate(kpis?.computed_at)}.
            </li>
            <li>
              <strong>Community tiles.</strong> Each tile reads from{' '}
              <code>data/resort-community-&lt;slug&gt;.json</code> for the static config, then joins
              against <code>market_stats_cache</code> for the live sold count and median.
            </li>
            <li>
              <strong>Peer comparison.</strong> Same cache table for Redmond, Sisters, La Pine,
              Tumalo, Terrebonne, Sunriver. Cities not yet in the cache are omitted from the row;
              they appear once the brain's market-stats refresh job has pulled them.
            </li>
            <li>
              <strong>Static facts</strong> (population, elevation, school district, employer list,
              climate disclosure): manually authored from public sources (US Census 2023 ACS,
              Bend-La Pine Schools, St. Charles Health, Bend Bulletin coverage).
            </li>
          </ul>
          <p style={{ fontSize: 11.5, color: 'rgba(16,39,66,0.55)', marginTop: 14 }}>
            Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity.
            Listing and market data courtesy of Oregon Datashare RMLS.
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
              "Bend, Oregon is a Central Oregon high-desert city of 105,000. This page is the canonical search-authority surface for homes for sale in Bend, with market data, neighborhood + resort community guide, and broker contact.",
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

import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import LandingPageTracker from '@/components/LandingPageTracker'
import HeathCmaForm from './_components/HeathCmaForm'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

// ISR — refresh active inventory, recent closings, and KPI cache every 6 hours.
export const revalidate = 21600

export const metadata: Metadata = {
  title: 'Heath at Tetherow, Bend OR Real Estate | Ryan Realty',
  description:
    'Heath is the original golf-frontage phase of Tetherow in Bend, OR. McLay Kidd course frontage, half-acre and larger lots, $2,244 annual HOA. Live inventory and recent sales.',
  alternates: { canonical: `${siteUrl}/lp/tetherow/heath/` },
  openGraph: {
    title: 'Heath at Tetherow, Bend, Oregon',
    description:
      'Heath is the original golf-frontage phase of Tetherow. McLay Kidd course frontage, half-acre and larger lots, $2,244 annual HOA.',
    type: 'website',
    images: ['/lp/tetherow/img/tetherow-aerial-course.jpg'],
  },
  robots: { index: true, follow: true },
}

// ──────────────────────────────────────────────────────────────────────────
// Static config — Heath specifics, sourced from data/resort-communities.json
// (the row Tetherow.sub_neighborhoods[heath]). Mirrored here for type-safety
// at server-render time. If the JSON updates, mirror here on the next PR.
// ──────────────────────────────────────────────────────────────────────────
const HEATH = {
  slug: 'heath',
  name: 'Heath',
  type: 'Single-family golf homes',
  parent: {
    slug: 'tetherow',
    name: 'Tetherow',
    masterAcres: 700,
    architect: 'David McLay Kidd',
    coursePar: 72,
    courseRanking: '#57 Golf Digest America\'s 100 Greatest Public Courses (2023-24, up 25 spots).',
  },
  hoa: {
    subQuarterly: 195,
    subAnnualizedNote: '$195 per quarter',
    masterAnnual: 1464,
    totalAnnual: 2244,
    manager: 'TOA (Tetherow Owners Association)',
  },
  position:
    'Heath is one of the original Tetherow phases. Golf-frontage half-acre and larger lots on the north side of Tetherow Phase 1, anchored by Hosmer Lake Drive and Cartwright.',
  architecture:
    'Custom builds against Tetherow Owners Association architectural guidelines. Most homes are single-story or single-story-plus-loft, designed to honor the high-desert vernacular with stone, cedar, and steel. Roof pitches favor the McLay Kidd contour.',
  driveTimes: [
    { minutes: 7, label: 'Mt. Bachelor Village + Old Mill District' },
    { minutes: 14, label: 'Downtown Bend' },
    { minutes: 22, label: 'Mt. Bachelor Ski Area' },
    { minutes: 25, label: 'Redmond Airport (RDM)' },
  ],
  builders: [
    {
      name: 'Tozer Construction',
      role: 'Bend luxury custom and remodel',
      note: 'Multiple Heath and Tartan Druim completions. Precision drywall and clean turnover punch list.',
      url: 'https://www.tozerconstruction.com',
    },
    {
      name: 'Cascade Custom Homes',
      role: 'Bend luxury custom',
      note: 'Long-running Bend custom shop. Particularly active in Heath and Crescent. Repeat-client business is the tell.',
      url: 'https://www.cascadecustomhomes.com',
    },
    {
      name: 'Hammer + Hand',
      role: 'Pacific Northwest custom and Passive House',
      note: 'High-performance custom plus Passive House completions across Tetherow. The builder buyers cite for net-zero or all-electric.',
      url: 'https://hammerandhand.com',
    },
  ],
  mapImage: '/lp/tetherow/heath/img/heath-map.png',
  heroImage: '/lp/tetherow/img/tetherow-aerial-course.jpg',
}

// MLS aliases — the SubdivisionName values that map to Heath. The MLS does
// NOT tag Heath separately from the parent Tetherow community. All Heath
// homes carry SubdivisionName='Tetherow'. Per the Data Accuracy mandate, we
// pull stats at the parent level and footnote the constraint.
const HEATH_MLS_ALIASES = ['Tetherow']

// ──────────────────────────────────────────────────────────────────────────
// Live data fetches
// ──────────────────────────────────────────────────────────────────────────

type ActiveListing = {
  ListingKey: string
  ListPrice: string | number | null
  StreetNumber: string | null
  StreetName: string | null
  BedroomsTotal: number | null
  BathroomsTotal: string | null
  TotalLivingAreaSqFt: string | null
  CumulativeDaysOnMarket: number | null
  StandardStatus: string | null
  PhotoURL: string | null
}

type RecentClose = {
  CloseDate: string | null
  ClosePrice: string | number | null
  ListPrice: string | number | null
  OriginalListPrice: string | number | null
  BedroomsTotal: number | null
  BathroomsTotal: string | null
  TotalLivingAreaSqFt: string | null
  StreetName: string | null
}

type MarketCacheRow = {
  geo_slug: string
  geo_label: string | null
  sold_count: number | null
  median_sale_price: string | number | null
  median_dom: string | number | null
  avg_sale_to_list_ratio: string | number | null
  median_ppsf: string | number | null
  end_of_period_inventory: number | null
  methodology_version: string | null
  period_start: string | null
  period_end: string | null
  computed_at: string | null
}

async function fetchTetherowMarketStats(): Promise<MarketCacheRow | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('market_stats_cache')
      .select(
        'geo_slug, geo_label, sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, methodology_version, period_start, period_end, computed_at'
      )
      .eq('geo_slug', 'tetherow')
      .eq('period_type', 'rolling_365d')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data as MarketCacheRow
  } catch {
    return null
  }
}

async function fetchActiveHeathInventory(): Promise<ActiveListing[]> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('listings')
      .select(
        'ListingKey, ListPrice, StreetNumber, StreetName, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, CumulativeDaysOnMarket, StandardStatus, PhotoURL'
      )
      .in('SubdivisionName', HEATH_MLS_ALIASES)
      .in('StandardStatus', ['Active', 'ActiveUnderContract', 'Pending'])
      .eq('PropertyType', 'A')
      .order('ListPrice', { ascending: false })
      .limit(8)
    return (data ?? []) as ActiveListing[]
  } catch {
    return []
  }
}

async function fetchRecentHeathClosings(): Promise<RecentClose[]> {
  try {
    const supabase = createServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - 365)
    const { data } = await supabase
      .from('listings')
      .select(
        'CloseDate, ClosePrice, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, StreetName'
      )
      .in('SubdivisionName', HEATH_MLS_ALIASES)
      .in('StandardStatus', ['Closed', 'Sold'])
      .eq('PropertyType', 'A')
      .gte('CloseDate', since.toISOString())
      .order('CloseDate', { ascending: false })
      .limit(10)
    return (data ?? []) as RecentClose[]
  } catch {
    return []
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Formatters — tabular numerals, currency to nearest $1k, days as integers.
// ──────────────────────────────────────────────────────────────────────────
function formatCurrencyK(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n / 1000) * 1000
  return `$${rounded.toLocaleString('en-US')}`
}

function formatPpsf(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function formatPct(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  // Ratio stored as 0.94162 → display as 94.2%
  const pct = n > 1.5 ? n : n * 100
  return `${pct.toFixed(1)}%`
}

function formatInt(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toString()
}

function formatCloseDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatSqft(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function priceWithComma(value: string | number | null | undefined): string {
  if (value == null) return '—'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function pricePerSqft(price: string | number | null, sqft: string | number | null): string {
  if (price == null || sqft == null) return '—'
  const p = typeof price === 'string' ? Number.parseFloat(price) : price
  const s = typeof sqft === 'string' ? Number.parseFloat(sqft) : sqft
  if (!Number.isFinite(p) || !Number.isFinite(s) || s <= 0) return '—'
  return `$${Math.round(p / s).toLocaleString('en-US')}`
}

function saleToListPct(close: string | number | null, list: string | number | null): { value: string; verdict: 'pos' | 'neg' | 'neutral' } {
  if (close == null || list == null) return { value: '—', verdict: 'neutral' }
  const c = typeof close === 'string' ? Number.parseFloat(close) : close
  const l = typeof list === 'string' ? Number.parseFloat(list) : list
  if (!Number.isFinite(c) || !Number.isFinite(l) || l <= 0) return { value: '—', verdict: 'neutral' }
  const pct = (c / l) * 100
  const verdict: 'pos' | 'neg' | 'neutral' = pct >= 100 ? 'pos' : pct < 94 ? 'neg' : 'neutral'
  return { value: `${pct.toFixed(1)}%`, verdict }
}

// ──────────────────────────────────────────────────────────────────────────
// JSON-LD: Place (contained in Tetherow) + RealEstateAgent
// ──────────────────────────────────────────────────────────────────────────
function buildJsonLd() {
  const placeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: 'Heath at Tetherow',
    description:
      'Heath is the original golf-frontage phase of Tetherow in Bend, OR. Single-family golf homes on half-acre and larger lots fronting the McLay Kidd course.',
    url: `${siteUrl}/lp/tetherow/heath/`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 44.0335,
      longitude: -121.359,
    },
    containedInPlace: {
      '@type': 'Place',
      name: 'Tetherow',
      url: `${siteUrl}/lp/tetherow/`,
      containedInPlace: {
        '@type': 'City',
        name: 'Bend',
        addressRegion: 'OR',
        addressCountry: 'US',
      },
    },
  }
  const agentSchema = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Ryan Realty LLC',
    image: `${siteUrl}/images/brokers/ryan-matt.png`,
    telephone: '+15412136706',
    url: siteUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '115 NW Oregon Avenue',
      addressLocality: 'Bend',
      addressRegion: 'OR',
      postalCode: '97703',
      addressCountry: 'US',
    },
    areaServed: { '@type': 'Place', name: 'Heath at Tetherow, Bend, OR' },
  }
  return JSON.stringify([placeSchema, agentSchema])
}

// ──────────────────────────────────────────────────────────────────────────
// PAGE
// ──────────────────────────────────────────────────────────────────────────
export default async function HeathAtTetherowPage() {
  const [marketStats, activeListings, recentCloses] = await Promise.all([
    fetchTetherowMarketStats(),
    fetchActiveHeathInventory(),
    fetchRecentHeathClosings(),
  ])

  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-background text-foreground">
      <LandingPageTracker lpVariant="tetherow-heath" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd() }}
      />

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Ryan Realty">
            <span className="relative block h-7 w-[140px] shrink-0 sm:h-9 sm:w-[180px]">
              <Image
                src="/images/brand/logo-horizontal-blue.png"
                alt="Ryan Realty, Bend, Oregon"
                fill
                className="object-contain object-left"
                sizes="180px"
                priority
              />
            </span>
          </Link>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="#cma">What is my Heath home worth?</Link>
          </Button>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={HEATH.heroImage}
            alt="Tetherow course aerial — Heath sub-neighborhood frontage"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/55 via-primary/40 to-primary/65" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground/85">
            Inside Tetherow
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight text-primary-foreground sm:text-5xl md:text-6xl">
            Heath at Tetherow.
            <br />
            <span className="text-primary-foreground/85">A profile of the {monthYear} market.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-primary-foreground/85 sm:text-lg">
            The original golf-frontage phase of Tetherow. Half-acre and larger lots, single-family custom homes, direct course frontage on the McLay Kidd holes. Live inventory, recent closings, and a data trace you can audit below.
          </p>

          {/* Stat bar — Tetherow community-level metrics. Footnote explains
              that the MLS does not tag Heath separately, so values reflect
              the full Tetherow community as the closest verified anchor. */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-primary-foreground/15 bg-card/95">
              <CardContent className="p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Active inventory
                </div>
                <div className="mt-1 font-display text-3xl text-primary tabular-nums">
                  {activeListings.length > 0 ? activeListings.length : formatInt(marketStats?.end_of_period_inventory)}
                </div>
                <div className="text-xs text-muted-foreground">homes for sale, Tetherow</div>
              </CardContent>
            </Card>
            <Card className="border-primary-foreground/15 bg-card/95">
              <CardContent className="p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sold, last 12 months
                </div>
                <div className="mt-1 font-display text-3xl text-primary tabular-nums">
                  {formatInt(marketStats?.sold_count)}
                </div>
                <div className="text-xs text-muted-foreground">closings across Tetherow</div>
              </CardContent>
            </Card>
            <Card className="border-primary-foreground/15 bg-card/95">
              <CardContent className="p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Median close
                </div>
                <div className="mt-1 font-display text-3xl text-primary tabular-nums">
                  {formatCurrencyK(marketStats?.median_sale_price)}
                </div>
                <div className="text-xs text-muted-foreground">last 12 months, Tetherow</div>
              </CardContent>
            </Card>
            <Card className="border-primary-foreground/15 bg-card/95">
              <CardContent className="p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sale-to-list
                </div>
                <div className="mt-1 font-display text-3xl text-primary tabular-nums">
                  {formatPct(marketStats?.avg_sale_to_list_ratio)}
                </div>
                <div className="text-xs text-muted-foreground">average, last 12 months</div>
              </CardContent>
            </Card>
          </div>

          <p className="mt-4 max-w-2xl text-xs text-primary-foreground/75">
            Heath shares an MLS tag with the broader Tetherow community. KPI numbers above reflect the full Tetherow community for the rolling 365 days, which is the most precise anchor available for Heath valuations. Per-Heath active inventory and recent closings appear below.
          </p>
        </div>
      </section>

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/cities/bend">Bend</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/lp/tetherow/">Tetherow</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Heath</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </section>

      {/* ── About this sub-neighborhood ────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                About Heath
              </div>
              <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
                The original golf-frontage phase.
              </h2>
              <div className="prose prose-stone mt-6 max-w-none space-y-4 text-base leading-relaxed text-foreground">
                <p>{HEATH.position}</p>
                <p>{HEATH.architecture}</p>
                <p>
                  Heath homes were among the first built after Tetherow opened in 2008. The lot sizes are larger than the later infill phases. Most Heath addresses fall along Hosmer Lake Drive, Cartwright Drive, and Roswell Court, with frontage on the McLay Kidd back nine.
                </p>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Heath at a glance
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="text-right font-medium text-foreground">{HEATH.type}</dd>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Lot sizes</dt>
                    <dd className="text-right font-medium text-foreground">½-acre and larger, golf-frontage</dd>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Parent community</dt>
                    <dd className="text-right font-medium text-foreground">{HEATH.parent.name} ({HEATH.parent.masterAcres} acres)</dd>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Course</dt>
                    <dd className="text-right font-medium text-foreground">McLay Kidd · Par {HEATH.parent.coursePar}</dd>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">HOA manager</dt>
                    <dd className="text-right font-medium text-foreground">{HEATH.hoa.manager}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Map + drive times ─────────────────────────────────────────── */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Location
              </div>
              <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
                West side of Bend, on the course.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-foreground">
                Heath sits on the north side of Tetherow Phase 1, west of Century Drive on the rim of the Deschutes River canyon. Direct access to Forest Service trails through the rim greenway. The drive to Mt. Bachelor Ski Area is a single 22-minute pull along Cascade Lakes Highway.
              </p>

              <dl className="mt-8 space-y-3">
                {HEATH.driveTimes.map((dt) => (
                  <div key={dt.label} className="flex items-baseline gap-4">
                    <dt className="w-16 font-display text-2xl text-primary tabular-nums">
                      {dt.minutes}
                    </dt>
                    <dd className="flex-1 text-sm text-foreground">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">minutes to</span>
                      <br />
                      <span className="font-medium">{dt.label}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Image
                src={HEATH.mapImage}
                alt="Heath at Tetherow location map"
                width={720}
                height={520}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOA + dues ─────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              HOA and dues
            </div>
            <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
              Two assessments. One annualized total.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              Every Heath home pays the Tetherow master assessment plus the Heath sub-assessment. The Heath sub bills quarterly, the master rolls up to {priceWithComma(HEATH.hoa.masterAnnual)} per year. Combined: roughly {priceWithComma(HEATH.hoa.totalAnnual)} per year per home.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Heath sub-assessment
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">$195</div>
                <div className="text-sm text-muted-foreground">per quarter</div>
                <Separator className="my-4" />
                <p className="text-sm text-foreground">Managed by {HEATH.hoa.manager}. Covers Heath-specific common-area maintenance and reserves.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Master assessment
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">{priceWithComma(HEATH.hoa.masterAnnual)}</div>
                <div className="text-sm text-muted-foreground">per year</div>
                <Separator className="my-4" />
                <p className="text-sm text-foreground">Charged on every Tetherow lot regardless of sub-neighborhood. Collected via PayHoa.com digital portal since 2022.</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Annualized total
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">{priceWithComma(HEATH.hoa.totalAnnual)}</div>
                <div className="text-sm text-muted-foreground">per Heath home, per year</div>
                <Separator className="my-4" />
                <p className="text-sm text-foreground">Sub plus master. Reserve fund and capital plan are not public, disclosed via resale certificate at point of sale.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Live market KPI (Tetherow-wide) ─────────────────────────────── */}
      <section className="bg-primary/5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live market pulse
            </div>
            <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
              What is happening at Tetherow today.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              Heath is not tagged as a distinct subdivision in the Oregon MLS, so the figures below cover the full Tetherow community as the closest verified anchor for a Heath valuation. The cache refreshes every 6 hours.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sold count
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">
                  {formatInt(marketStats?.sold_count)}
                </div>
                <div className="text-xs text-muted-foreground">last 365 days</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Median sale price
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">
                  {formatCurrencyK(marketStats?.median_sale_price)}
                </div>
                <div className="text-xs text-muted-foreground">last 365 days</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Median DOM
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">
                  {formatInt(marketStats?.median_dom)} days
                </div>
                <div className="text-xs text-muted-foreground">days on market</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Median $/sqft
                </div>
                <div className="mt-2 font-display text-3xl text-primary tabular-nums">
                  {formatPpsf(marketStats?.median_ppsf)}
                </div>
                <div className="text-xs text-muted-foreground">price per sqft</div>
              </CardContent>
            </Card>
          </div>
          {marketStats?.computed_at && (
            <p className="mt-6 text-xs text-muted-foreground">
              Cache computed {new Date(marketStats.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · methodology {marketStats.methodology_version ?? '—'} · period {marketStats.period_start} to {marketStats.period_end}.
            </p>
          )}
        </div>
      </section>

      {/* ── Architecture + builders ────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Who builds at Heath
            </div>
            <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
              The builder roster, filtered to Heath.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              Buyers in the Heath range buy a builder as much as a home. They know who builds tight, who manages a difficult subcontractor schedule, and whose 2018 work is showing its age. Naming your builder in the listing copy moves the home.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HEATH.builders.map((b) => (
              <Card key={b.name}>
                <CardContent className="p-6">
                  <h3 className="font-display text-xl text-primary">{b.name}</h3>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{b.role}</div>
                  <p className="mt-3 text-sm text-foreground">{b.note}</p>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {b.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Not every builder in the Tetherow roster has worked in Heath specifically. The names above are sourced from public Tetherow Owners Association records and broker observation. See the full Tetherow roster for additional shops working in other sub-phases.
          </p>
        </div>
      </section>

      {/* ── Active inventory ───────────────────────────────────────────── */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Active inventory
              </div>
              <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
                Available now at Tetherow.
              </h2>
              <p className="mt-3 text-base text-foreground">
                Filtered to homes tagged Tetherow in the Oregon MLS. Heath addresses sit within this set. Click any home to schedule a private showing.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/homes-for-sale/bend">See all Bend listings</Link>
            </Button>
          </div>

          {activeListings.length === 0 ? (
            <Card className="mt-8">
              <CardContent className="p-10 text-center text-muted-foreground">
                No active Tetherow listings at this moment. Check back after the next ISR refresh, or request the buyer&apos;s guide below.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {activeListings.map((l) => (
                <Card key={l.ListingKey} className="overflow-hidden">
                  {l.PhotoURL ? (
                    <div className="relative aspect-[4/3] bg-muted">
                      <Image
                        src={l.PhotoURL}
                        alt={`${l.StreetNumber ?? ''} ${l.StreetName ?? ''}`.trim() || 'Tetherow listing'}
                        fill
                        sizes="(max-width: 640px) 100vw, 320px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-muted" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant={l.StandardStatus === 'Pending' ? 'soft-trending' : 'soft-hot'}>
                        {l.StandardStatus}
                      </Badge>
                      <div className="font-display text-lg text-primary tabular-nums">{priceWithComma(l.ListPrice)}</div>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {l.StreetNumber} {l.StreetName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {l.BedroomsTotal ?? '—'} bd · {l.BathroomsTotal ?? '—'} ba · {formatSqft(l.TotalLivingAreaSqFt)} sqft
                    </div>
                    <Button asChild size="sm" className="mt-4 w-full" variant="outline">
                      <Link href="/lp/tetherow/#buyer">Schedule a showing</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Recent closings strip ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent closings
            </div>
            <h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">
              What actually traded at Tetherow, last 12 months.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              Every number traces to a verified Oregon RMLS close-of-record. Price-per-square-foot and sale-to-list computed against close price and original list. The Hosmer Lake and Cartwright addresses below sit in Heath.
            </p>
          </div>

          {recentCloses.length === 0 ? (
            <Card className="mt-8">
              <CardContent className="p-10 text-center text-muted-foreground">
                No closings in the last 12 months under this filter.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-10 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Closed</th>
                    <th className="px-4 py-3 text-left">Street</th>
                    <th className="px-4 py-3 text-left">Beds / baths</th>
                    <th className="px-4 py-3 text-right">Sqft</th>
                    <th className="px-4 py-3 text-right">Close</th>
                    <th className="px-4 py-3 text-right">$/sqft</th>
                    <th className="px-4 py-3 text-right">Sale-to-list</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCloses.map((c, i) => {
                    const stl = saleToListPct(c.ClosePrice, c.OriginalListPrice ?? c.ListPrice)
                    return (
                      <tr key={`${c.CloseDate}-${i}`} className="border-t border-border">
                        <td className="px-4 py-3">{formatCloseDate(c.CloseDate)}</td>
                        <td className="px-4 py-3">{c.StreetName ?? '—'}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {c.BedroomsTotal ?? '—'} / {c.BathroomsTotal ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatSqft(c.TotalLivingAreaSqFt)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{priceWithComma(c.ClosePrice)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{pricePerSqft(c.ClosePrice, c.TotalLivingAreaSqFt)}</td>
                        <td
                          className={
                            'px-4 py-3 text-right tabular-nums ' +
                            (stl.verdict === 'pos' ? 'text-success-foreground font-medium' : stl.verdict === 'neg' ? 'text-destructive' : '')
                          }
                        >
                          {stl.value}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Parent community sidebar ───────────────────────────────────── */}
      <section className="bg-primary/5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Card>
            <CardContent className="p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    About the parent community
                  </div>
                  <h2 className="mt-2 font-display text-3xl text-primary">Tetherow.</h2>
                  <p className="mt-3 max-w-2xl text-base text-foreground">
                    Heath is one of nine sub-neighborhoods inside the 700-acre Tetherow master plan, west of Bend. The McLay Kidd course opened in 2008 and earned a #57 ranking on Golf Digest&apos;s 100 Greatest Public Courses in the 2023-24 list. The master HOA is the Tetherow Owners Association.
                  </p>
                  <ul className="mt-5 space-y-1 text-sm text-foreground">
                    <li>Master plan: {HEATH.parent.masterAcres} acres, founded 2008.</li>
                    <li>Architect: {HEATH.parent.architect}.</li>
                    <li>Course recognition: {HEATH.parent.courseRanking}</li>
                    <li>Master HOA: {priceWithComma(HEATH.hoa.masterAnnual)} per year.</li>
                  </ul>
                </div>
                <Button asChild size="lg">
                  <Link href="/lp/tetherow/">See all Tetherow communities</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── CMA seller form ────────────────────────────────────────────── */}
      <section id="cma" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="font-display text-3xl text-primary sm:text-4xl">
                What would your Heath home sell for today?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-foreground">
                A free value report on your Heath home, built against recent Tetherow closings, your floor plan, your view category, and your HOA tier. Anchored to the {formatInt(marketStats?.sold_count)} Tetherow homes sold in the last 365 days.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-foreground">
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  Signed by a licensed Oregon principal broker, not an automated estimate.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  Built on Tetherow sales, not citywide averages.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  Shows how close homes are selling to list, how long they take, and which homes near you sold for what.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  Delivered as a PDF. Yours to keep, share, or compare with another broker.
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  No phone follow-up unless you reply.
                </li>
              </ul>

              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                <Card>
                  <CardContent className="p-4">
                    <div className="font-display text-2xl text-primary tabular-nums">#201206613</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">OR principal broker</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="font-display text-2xl text-primary tabular-nums">{formatInt(marketStats?.sold_count)}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Tetherow sold, 12mo</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="font-display text-2xl text-primary tabular-nums">{formatPct(marketStats?.avg_sale_to_list_ratio)}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">avg sale-to-list</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <HeathCmaForm />
          </div>
        </div>
      </section>

      {/* ── Buyer cross-link ───────────────────────────────────────────── */}
      <section className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-primary/15 bg-primary/5 p-6 sm:p-8">
            <div className="max-w-xl">
              <h3 className="font-display text-2xl text-primary">Buying at Heath?</h3>
              <p className="mt-2 text-sm text-foreground">
                Use the full Tetherow buyer track to schedule a private showing, set up custom alerts, or request the Tetherow buyer guide.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/lp/tetherow/#buyer">See the Tetherow buyer track</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Methodology footer ─────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/20 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Methodology
          </div>
          <h3 className="mt-2 font-display text-xl text-primary">Where the numbers come from.</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              KPI cards and market pulse: <code className="font-mono text-xs">market_stats_cache</code> rolling-365-day row for <code className="font-mono text-xs">geo_slug=&apos;tetherow&apos;</code>. Refreshes every 6 hours via Next.js ISR.
            </li>
            <li>
              Active inventory: live query against the <code className="font-mono text-xs">listings</code> table where <code className="font-mono text-xs">SubdivisionName=&apos;Tetherow&apos;</code>, <code className="font-mono text-xs">StandardStatus</code> in Active / Pending / ActiveUnderContract, and <code className="font-mono text-xs">PropertyType=&apos;A&apos;</code> (single-family).
            </li>
            <li>
              Recent closings: same listings table, status Closed or Sold, close date in the trailing 12 months.
            </li>
            <li>
              Heath-specific MLS tagging: the Oregon RMLS does not separate Heath as a distinct subdivision. Heath addresses share <code className="font-mono text-xs">SubdivisionName=&apos;Tetherow&apos;</code> with the broader community. KPI figures reflect the full Tetherow community as the closest verified anchor.
            </li>
            <li>
              HOA figures: Tetherow Owners Association published assessment schedule. Verify via the resale certificate at point of sale.
            </li>
            <li>
              Course recognition: Golf Digest America&apos;s 100 Greatest Public Courses 2023-24 ranking.
            </li>
            <li>
              Map: Deschutes County GIS Subdivisions service. The Tetherow Phase 1 boundary center serves as the Heath anchor, shifted slightly north toward Hosmer Lake Drive where Heath addresses concentrate. No Heath-specific recorded plat shape exists yet.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="font-display text-lg text-primary">Ryan Realty LLC</div>
              <div className="mt-1 text-xs text-muted-foreground">Bend · Oregon</div>
              <div className="mt-3 text-sm text-foreground">115 NW Oregon Avenue, Bend, OR 97703</div>
              <div className="mt-1 text-sm text-foreground">
                <a href="tel:+15412136706" className="hover:underline">541.213.6706</a>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Oregon Principal Broker · License #201206613</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tetherow pages</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/lp/tetherow/" className="text-foreground hover:underline">Tetherow community overview</Link></li>
                <li><Link href="/lp/tetherow/heath/" className="text-foreground hover:underline">Heath at Tetherow</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Legal</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/privacy" className="text-foreground hover:underline">Privacy</Link></li>
                <li><Link href="/fair-housing" className="text-foreground hover:underline">Fair housing</Link></li>
                <li><Link href="/terms" className="text-foreground hover:underline">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * /price-drops -- Region-wide Price-Drop Radar for Central Oregon SFR.
 *
 * Data strategy:
 *   - getPriceDrops() from lib/data (DAL, cached 30 min, throw-on-error)
 *   - Zero hardcoded numbers -- every figure comes from the live DAL result
 *   - Honest empty state when no drops exist in the window
 *
 * SEO / GEO strategy (Matt directive: "seen by search engines and AI agents"):
 *   - MetadataBlock: BreadcrumbList + Dataset + webPage JSON-LD
 *   - pageMetadata: canonical + OG
 *   - Sitemap: changefreq daily (see app/sitemap.ts)
 *   - llms.txt: registered at /price-drops
 *
 * ISR: revalidate 1800s (30 min) -- matches DAL TTL.
 * Design: homepage-v3 bar -- Amboqia display numerals in hero, editorial grid,
 *         tabular-nums, navy/cream, no sliders.
 */

// @no-parity -- parity contract at design_system/ryan-realty/ui_kits/price-drops/parity.json

import type { Metadata } from 'next'
import Link from 'next/link'
import { getPriceDrops } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  Container,
  Section,
  Stack,
  H2,
  H3,
  Body,
  Eyebrow,
  DisplayHeading,
} from '@/components/site/primitives'
import ListingCard from '@/components/site/ListingCard'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import type { PriceDrop } from '@/lib/data'

// ---- ISR -------------------------------------------------------------------

export const revalidate = 1800

// ---- Metadata --------------------------------------------------------------

export const metadata: Metadata = pageMetadata({
  title: 'Price Drop Radar, Central Oregon',
  description:
    'Track every active home in Central Oregon where the seller has cut the asking price. ' +
    'Updated daily from the regional MLS. Browse Bend, Redmond, Sisters, Sunriver, and surrounding areas.',
  path: '/price-drops',
  keywords: [
    'price reduced homes Central Oregon',
    'price drop homes Bend Oregon',
    'homes with price reductions Central Oregon',
    'reduced asking price Oregon homes',
    'price cut homes for sale Bend',
  ],
})

// ---- City display helpers --------------------------------------------------

const CITY_DISPLAY: Record<string, string> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  sunriver: 'Sunriver',
  'la-pine': 'La Pine',
  madras: 'Madras',
  prineville: 'Prineville',
  culver: 'Culver',
  terrebonne: 'Terrebonne',
  'powell-butte': 'Powell Butte',
}

// ---- Price-drop card adapter ------------------------------------------------


function fmtCompactPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function dropToCardData(drop: PriceDrop) {
  const addressLine =
    [drop.streetNumber, drop.streetName].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (drop.city) cityParts.push(`${drop.city}, OR`)
  if (drop.postalCode) cityParts.push(drop.postalCode)
  if (drop.subdivisionName) cityParts.push(drop.subdivisionName)

  const origRounded = drop.originalListPrice
    ? Math.round(drop.originalListPrice / 1000) * 1000
    : null
  const badgeLabel =
    origRounded && drop.lastDropPct
      ? `was ${fmtCompactPrice(origRounded)}, -${drop.lastDropPct.toFixed(1)}%`
      : drop.lastDropPct
        ? `-${drop.lastDropPct.toFixed(1)}%`
        : 'Price reduced'

  return {
    listingKey: drop.listingKey,
    href: `/listing/${encodeURIComponent(drop.listingKey)}`,
    photoUrl: drop.photoUrl ?? null,
    price: drop.listPrice,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: drop.beds ?? null,
    baths: drop.baths ?? null,
    sqft: drop.sqft ?? null,
    badge: { kind: 'drop' as const, label: badgeLabel },
  }
}

// ---- Neighborhood mini-table ------------------------------------------------

type NeighborhoodRow = {
  name: string
  count: number
  medianListPrice: number | null
  medianDropPct: number | null
}

function buildNeighborhoodTable(drops: PriceDrop[]): NeighborhoodRow[] {
  const map = new Map<string, { prices: number[]; pcts: number[] }>()
  for (const d of drops) {
    const name = d.boundaryNeighborhood ?? d.subdivisionName ?? d.city ?? 'Other'
    if (!map.has(name)) map.set(name, { prices: [], pcts: [] })
    const row = map.get(name)!
    if (d.listPrice) row.prices.push(d.listPrice)
    if (d.lastDropPct) row.pcts.push(d.lastDropPct)
  }
  const result: NeighborhoodRow[] = []
  for (const [name, { prices, pcts }] of map.entries()) {
    const sp = [...prices].sort((a, b) => a - b)
    const spc = [...pcts].sort((a, b) => a - b)
    const midP = Math.floor(sp.length / 2)
    const midPct = Math.floor(spc.length / 2)
    result.push({
      name,
      count: Math.max(prices.length, pcts.length),
      medianListPrice:
        sp.length > 0
          ? sp.length % 2 === 0
            ? (sp[midP - 1] + sp[midP]) / 2
            : sp[midP]
          : null,
      medianDropPct:
        spc.length > 0
          ? spc.length % 2 === 0
            ? (spc[midPct - 1] + spc[midPct]) / 2
            : spc[midPct]
          : null,
    })
  }
  return result.sort((a, b) => b.count - a.count).slice(0, 10)
}

// ---- Format helpers --------------------------------------------------------

function fmtK(n: number): string {
  return fmtCompactPrice(n)
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return fmtK(n)
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString()}`
}

// ---- Page ------------------------------------------------------------------

export default async function PriceDropsRegionPage() {
  const { drops, total, fetchedAt } = await getPriceDrops({ limit: 48, days: 7 }).catch(
    () => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }),
  )

  // Aggregate stats from real data (zero hardcoded)
  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)
  const dropPcts = drops
    .map((d) => d.lastDropPct)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)
  const mid = Math.floor(dropPcts.length / 2)
  const medianDropPct =
    dropPcts.length === 0
      ? null
      : dropPcts.length % 2 === 0
        ? (dropPcts[mid - 1] + dropPcts[mid]) / 2
        : dropPcts[mid]

  // Featured: biggest dollar drop
  const featured =
    drops.length > 0
      ? [...drops].sort((a, b) => (b.lastDropAmount ?? 0) - (a.lastDropAmount ?? 0))[0]
      : null

  const neighborhoodTable = buildNeighborhoodTable(drops)

  // ---- Structured data ------------------------------------------------------

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const pageUrl = `${site}/price-drops`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Price drops', url: '/price-drops' },
      ],
    },
    {
      type: 'dataset',
      name: 'Price Drop Radar, Central Oregon SFR',
      description:
        'Active single-family homes in Central Oregon where the seller has reduced the asking price ' +
        'in the last 7 days. Sourced daily from the regional MLS (ORMLS) via the Ryan Realty platform.',
      url: pageUrl,
      dateModified: fetchedAt,
      spatialCoverageName: 'Central Oregon',
      variableMeasured: [
        { name: 'Price reductions (7-day window)', value: total, unitText: 'listings' },
        {
          name: 'Total asking-price cuts',
          value: totalReduced > 0 ? fmtM(totalReduced) : '0',
          unitText: 'USD',
        },
        ...(medianDropPct !== null
          ? [{ name: 'Median drop', value: `${medianDropPct.toFixed(1)}%` }]
          : []),
      ],
    },
    {
      type: 'webPage',
      name: 'Price Drop Radar, Central Oregon Real Estate',
      description: `${total} active homes in Central Oregon with a price reduction in the last 7 days.`,
      url: pageUrl,
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <PageBreadcrumb trail={[{ label: 'Price drops' }]} includeJsonLd={false} />

      {/* Hero with live aggregate in Amboqia display numerals */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <Container className="relative py-14 sm:py-20">
          <Stack gap="tight">
            <Eyebrow className="text-primary-foreground/60">Central Oregon · Live MLS data</Eyebrow>
            <DisplayHeading
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl text-primary-foreground"
            >
              Price Drop Radar
            </DisplayHeading>

            {/* Live aggregate numbers -- Amboqia tabular display, data as identity */}
            {drops.length > 0 ? (
              <div className="flex flex-wrap gap-x-8 gap-y-4 mt-4 sm:mt-6">
                <div>
                  <p
                    className="font-display text-5xl sm:text-6xl text-primary-foreground font-bold tabular-nums leading-none"
                    aria-label={`${total} price reductions`}
                  >
                    {total}
                  </p>
                  <p className="text-sm text-primary-foreground/70 mt-1">
                    price reductions this week
                  </p>
                </div>
                {totalReduced > 0 && (
                  <>
                    <div className="hidden sm:block w-px bg-primary-foreground/20 self-stretch" aria-hidden />
                    <div>
                      <p
                        className="font-display text-5xl sm:text-6xl text-primary-foreground font-bold tabular-nums leading-none"
                        aria-label={`${fmtM(totalReduced)} in asking-price cuts`}
                      >
                        {fmtM(totalReduced)}
                      </p>
                      <p className="text-sm text-primary-foreground/70 mt-1">
                        in asking-price cuts
                      </p>
                    </div>
                  </>
                )}
                {medianDropPct !== null && (
                  <>
                    <div className="hidden sm:block w-px bg-primary-foreground/20 self-stretch" aria-hidden />
                    <div>
                      <p
                        className="font-display text-5xl sm:text-6xl text-primary-foreground font-bold tabular-nums leading-none"
                        aria-label={`${medianDropPct.toFixed(1)} percent median drop`}
                      >
                        {medianDropPct.toFixed(1)}%
                      </p>
                      <p className="text-sm text-primary-foreground/70 mt-1">
                        median reduction
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Body size="large" className="text-primary-foreground/80 mt-2 max-w-xl">
                No price reductions in the last 7 days across Central Oregon.
                Check back daily as the MLS updates.
              </Body>
            )}

            <Body size="default" className="text-primary-foreground/60 mt-4 text-sm">
              Active SFR only · updated from the regional MLS · 7-day window
            </Body>
          </Stack>
        </Container>
      </section>

      {/* By-city chips */}
      <div className="bg-secondary border-b border-border">
        <Container className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide mr-1">
              Filter by city
            </span>
            <Link
              href="/price-drops"
              className="inline-flex items-center rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium"
            >
              All Central Oregon
            </Link>
            {SITE_CITY_SLUGS.slice(0, 6).map((slug) => (
              <Link
                key={slug}
                href={`/price-drops/${slug}`}
                className="inline-flex items-center rounded-full border border-border bg-background text-foreground px-3 py-1 text-xs font-medium hover:bg-secondary transition-colors"
              >
                {CITY_DISPLAY[slug] ?? slug}
              </Link>
            ))}
          </div>
        </Container>
      </div>

      {/* Featured drop */}
      {featured && (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight">
              <Eyebrow>Biggest price reduction this week</Eyebrow>
              <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                  <H2 className="text-2xl sm:text-3xl">
                    {[featured.streetNumber, featured.streetName].filter(Boolean).join(' ')}
                  </H2>
                  <p className="text-muted-foreground mt-1">
                    {featured.city}, OR
                    {featured.subdivisionName ? ` · ${featured.subdivisionName}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="font-mono tabular-nums text-sm">
                      Now {fmtPrice(featured.listPrice)}
                    </Badge>
                    {featured.originalListPrice && (
                      <Badge variant="secondary" className="font-mono tabular-nums text-sm">
                        Was {fmtPrice(featured.originalListPrice)}
                      </Badge>
                    )}
                    {featured.lastDropAmount && featured.lastDropPct && (
                      <Badge className="bg-primary text-primary-foreground font-mono tabular-nums text-sm">
                        -{fmtK(featured.lastDropAmount)} ({featured.lastDropPct.toFixed(1)}%)
                      </Badge>
                    )}
                  </div>
                  {featured.beds && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {featured.beds} bd
                      {featured.baths ? ` · ${featured.baths} ba` : ''}
                      {featured.sqft ? ` · ${Math.round(featured.sqft).toLocaleString()} sqft` : ''}
                      {featured.dom ? ` · ${featured.dom} days on market` : ''}
                    </p>
                  )}
                </div>
                <Link
                  href={`/listing/${encodeURIComponent(featured.listingKey)}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  View listing
                </Link>
              </div>
            </Stack>
          </Container>
        </Section>
      )}

      {/* Full listing grid */}
      <Section padding="default" tone="default" divider>
        <Container>
          {drops.length > 0 ? (
            <Stack gap="default">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <H2>
                  {total} {total === 1 ? 'home' : 'homes'} with a price reduction
                </H2>
                <p className="text-sm text-muted-foreground">Last 7 days · Central Oregon SFR</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {drops.map((drop) => {
                  const card = dropToCardData(drop)
                  return <ListingCard key={card.listingKey} listing={card} />
                })}
              </div>
            </Stack>
          ) : (
            <Stack gap="tight" className="py-16 text-center">
              <H2 className="text-xl text-muted-foreground">
                No price reductions in the last 7 days
              </H2>
              <Body size="default" tone="muted">
                The MLS updates throughout the day. Check back soon, or browse all active homes.
              </Body>
              <Link
                href="/homes-for-sale"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary mt-2 transition-colors"
              >
                Browse all homes for sale
              </Link>
            </Stack>
          )}
        </Container>
      </Section>

      {/* Neighborhood mini-table */}
      {neighborhoodTable.length > 0 && (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight">
              <Eyebrow>By neighborhood</Eyebrow>
              <H3>Where prices are being cut</H3>
              <div className="w-full max-w-full overflow-x-auto no-scrollbar mt-2">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="text-muted-foreground">
                      <TableHead className="pr-6">Neighborhood</TableHead>
                      <TableHead className="pr-6 text-right tabular-nums">Reductions</TableHead>
                      <TableHead className="pr-6 text-right tabular-nums">Median list</TableHead>
                      <TableHead className="text-right tabular-nums">Median drop</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neighborhoodTable.map((row, i) => (
                      <TableRow key={row.name} className={i % 2 === 0 ? 'bg-background/50' : ''}>
                        <TableCell className="pr-6 font-medium">{row.name}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">{row.count}</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums font-mono text-muted-foreground">
                          {row.medianListPrice
                            ? fmtPrice(row.medianListPrice)
                            : <span>{"—"}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {row.medianDropPct
                            ? `-${row.medianDropPct.toFixed(1)}%`
                            : <span>{"—"}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Stack>
          </Container>
        </Section>
      )}

      {/* Per-city links */}
      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight">
            <Eyebrow>Central Oregon</Eyebrow>
            <H3>Price drops by city</H3>
            <div className="flex flex-wrap gap-2 mt-2">
              {SITE_CITY_SLUGS.map((slug) => (
                <Link
                  key={slug}
                  href={`/price-drops/${slug}`}
                  className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium bg-background text-foreground hover:bg-secondary transition-colors"
                >
                  {CITY_DISPLAY[slug] ?? slug}
                </Link>
              ))}
            </div>
          </Stack>
        </Container>
      </Section>

      {/* Explainer */}
      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight" className="max-w-3xl">
            <Eyebrow>How this works</Eyebrow>
            <H2>What a price reduction actually means</H2>
            <Body size="default" tone="muted">
              A price reduction is a documented, seller-initiated change in the MLS asking price.
              Each listing on this page had its price reduced at least once in the last 7 days.
              The original list price and the current list price both come directly from the
              regional MLS feed. Nothing is estimated or adjusted.
            </Body>
            <Body size="default" tone="muted">
              A reduction does not automatically mean the home is a bargain.
              Some sellers start high and trim to market. Others are genuinely motivated to close.
              The best way to know which is which is to look at comparable sales in the same
              neighborhood.
            </Body>
          </Stack>
        </Container>
      </Section>

      {/* Lead hook */}
      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight" className="max-w-xl">
            <Eyebrow>Weekly drop report</Eyebrow>
            <H2>Get the weekly price-drop summary</H2>
            <Body size="default" tone="muted">
              Every Monday we pull the prior week&apos;s reductions across Central Oregon and
              send a plain-language summary: which neighborhoods saw the most cuts, the biggest
              drops, and what it means for buyers right now.
            </Body>
            <Link
              href="/lp/buyer-listing-alerts"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity self-start"
            >
              Get listing alerts
            </Link>
          </Stack>
        </Container>
      </Section>

      <CTABar
        eyebrow="Ryan Realty"
        title="Local brokers. Real data. No pressure."
        body="We pull price-reduction data every 30 minutes from the regional MLS. If a seller cut their price, we know about it before most buyers do."
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}

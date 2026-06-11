/**
 * /price-drops/[city] -- Per-city Price-Drop Radar for Central Oregon SFR.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * generateStaticParams pre-renders one page per SITE_CITY_SLUGS city.
 * dynamicParams=false -- unknown city slugs return 404.
 *
 * SEO strategy:
 *   - Targets "price reduced homes [City] Oregon", "price drop homes [City]"
 *   - BreadcrumbList + Dataset + webPage JSON-LD via MetadataBlock
 *   - Honest empty state when no drops in the last 7 days for that city
 */

// @no-parity -- parity contract at design_system/ryan-realty/ui_kits/price-drops/parity.json

import { notFound } from 'next/navigation'
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
import type { SchemaInput } from '@/lib/site/json-ld'
import { CONTACT } from '@/lib/brand/contact'
import type { PriceDrop } from '@/lib/data'

// ---- ISR + static params ---------------------------------------------------

export const revalidate = 1800
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return SITE_CITY_SLUGS.map((slug) => ({ city: slug }))
}

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


function fmtCompactPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function getCityName(slug: string): string {
  return (
    CITY_DISPLAY[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

// ---- Metadata --------------------------------------------------------------

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()
  const cityName = getCityName(slug)
  return pageMetadata({
    title: `Price Drops in ${cityName}, Oregon`,
    description:
      `Active homes in ${cityName}, Oregon where the seller has reduced the asking price in the last 7 days. ` +
      `Current list price, original list price, and drop percentage from the regional MLS.`,
    path: `/price-drops/${slug}`,
    keywords: [
      `price reduced homes ${cityName} Oregon`,
      `price drop homes ${cityName}`,
      `homes with price reductions ${cityName} OR`,
      `reduced asking price ${cityName} Oregon`,
      `price cut homes ${cityName}`,
    ],
  })
}

// ---- Card adapter ----------------------------------------------------------

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

export default async function PriceDropsCityPage({ params }: Props) {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()

  const cityName = getCityName(slug)

  const { drops, total, fetchedAt } = await getPriceDrops({
    city: cityName,
    limit: 48,
    days: 7,
  }).catch(() => ({ drops: [], total: 0, fetchedAt: new Date().toISOString() }))

  // Aggregate stats from real data
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

  const siblingCities = SITE_CITY_SLUGS.filter((s) => s !== slug)

  // ---- Structured data ------------------------------------------------------

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const pageUrl = `${site}/price-drops/${slug}`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Price drops', url: '/price-drops' },
        { name: cityName, url: `/price-drops/${slug}` },
      ],
    },
    {
      type: 'dataset',
      name: `Price Drop Radar, ${cityName} Oregon SFR`,
      description:
        `Active single-family homes in ${cityName}, Oregon where the seller has reduced the asking price ` +
        `in the last 7 days. Sourced daily from the regional MLS (ORMLS).`,
      url: pageUrl,
      dateModified: fetchedAt,
      spatialCoverageName: `${cityName}, Oregon`,
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
      name: `Price Drop Radar, ${cityName} Oregon`,
      description: `${total} active homes in ${cityName} with a price reduction in the last 7 days.`,
      url: pageUrl,
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <PageBreadcrumb trail={[{ label: 'Price drops', href: '/price-drops' },
            { label: cityName }]} includeJsonLd={false} />

      {/* Hero with live aggregate in Amboqia display numerals */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <Container className="relative py-14 sm:py-20">
          <Stack gap="tight">
            <Eyebrow className="text-primary-foreground/60">{cityName}, Oregon · Live MLS data</Eyebrow>
            <DisplayHeading
              as="h1"
              className="text-4xl sm:text-5xl lg:text-6xl text-primary-foreground"
            >
              Price drops in {cityName}
            </DisplayHeading>

            {drops.length > 0 ? (
              <div className="flex flex-wrap gap-x-8 gap-y-4 mt-4 sm:mt-6">
                <div>
                  <p
                    className="font-display text-5xl sm:text-6xl text-primary-foreground font-bold tabular-nums leading-none"
                    aria-label={`${total} price reductions in ${cityName}`}
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
                No price reductions in {cityName} in the last 7 days.
                Check back daily as the MLS updates.
              </Body>
            )}

            <Body size="default" className="text-primary-foreground/60 mt-4 text-sm">
              Active SFR only · updated from the regional MLS · 7-day window
            </Body>
          </Stack>
        </Container>
      </section>

      {/* Featured drop */}
      {featured && (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight">
              <Eyebrow>Biggest price reduction in {cityName} this week</Eyebrow>
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
                      <Badge className="bg-warning text-warning-foreground font-mono tabular-nums text-sm">
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
                  {total} {total === 1 ? 'home' : 'homes'} with a price reduction in {cityName}
                </H2>
                <Link
                  href="/price-drops"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  View all Central Oregon
                </Link>
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
                No price reductions in {cityName} in the last 7 days
              </H2>
              <Body size="default" tone="muted">
                The MLS updates throughout the day. Check back soon, or view all Central Oregon.
              </Body>
              <Link
                href="/price-drops"
                className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary mt-2 transition-colors"
              >
                View all Central Oregon price drops
              </Link>
            </Stack>
          )}
        </Container>
      </Section>

      {/* Other cities */}
      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight">
            <Eyebrow>Central Oregon</Eyebrow>
            <H3>Price drops in other cities</H3>
            <div className="flex flex-wrap gap-2 mt-2">
              {siblingCities.map((sibling) => (
                <Link
                  key={sibling}
                  href={`/price-drops/${sibling}`}
                  className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium bg-background text-foreground hover:bg-secondary transition-colors"
                >
                  {CITY_DISPLAY[sibling] ?? sibling}
                </Link>
              ))}
            </div>
          </Stack>
        </Container>
      </Section>

      <CTABar
        eyebrow={`Ryan Realty in ${cityName}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals in ${cityName} every year. If a seller has priced a home to move, we can tell you whether it is actually a deal.`}
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}

/**
 * /motivated-sellers/[city] — Per-city motivated seller listings page.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * generateStaticParams pre-renders one page per SITE_CITY_SLUGS city.
 * dynamicParams=false — requests for unknown cities return 404.
 *
 * SEO strategy:
 *   - Targets "motivated seller homes {city} Oregon", "price reduced homes {city}", etc.
 *   - Real H1 with city + state specificity
 *   - Honest explanation of motivation signals (transparency builds trust)
 *   - Back-link to pillar + chips to sibling city pages
 *   - ItemList + BreadcrumbList structured data
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getMotivatedListings } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
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
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'
import ListingCard from '@/components/site/ListingCard'
import { motivatedToCardData } from '@/lib/site/listing-card'
import type { SchemaInput } from '@/lib/site/json-ld'

// ─── ISR + static params ──────────────────────────────────────────────────

export const revalidate = 600
export const dynamicParams = false

export function generateStaticParams(): Array<{ city: string }> {
  return SITE_CITY_SLUGS.map((slug) => ({ city: slug }))
}

// ─── City display helpers ─────────────────────────────────────────────────

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

function getCityName(slug: string): string {
  return (
    CITY_DISPLAY[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()
  const cityName = getCityName(slug)
  return pageMetadata({
    title: `Motivated Seller Homes in ${cityName}, Oregon`,
    description:
      `Price-reduced and motivated seller homes in ${cityName}, Oregon. ` +
      `Browse listings with documented price cuts and seller motivation signals, sorted by most motivated.`,
    path: `/motivated-sellers/${slug}`,
    keywords: [
      `motivated seller homes ${cityName} Oregon`,
      `price reduced homes ${cityName}`,
      `motivated sellers ${cityName} OR`,
      `below market homes ${cityName}`,
      `price cut homes ${cityName} Oregon`,
    ],
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function MotivatedSellersCityPage({ params }: Props) {
  const { city: slug } = await params
  if (!SITE_CITY_SLUGS.includes(slug)) notFound()

  const cityName = getCityName(slug)

  const { listings } = await getMotivatedListings({
    // Pass the display-case city name; the DAL uses ilike() for matching
    city: cityName,
    limit: 48,
    offset: 0,
  }).catch(() => ({ listings: [], total: 0 }))

  // Structured data
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Motivated sellers', url: '/motivated-sellers' },
        { name: cityName, url: `/motivated-sellers/${slug}` },
      ],
    },
    {
      type: 'webPage',
      name: `Motivated Seller Homes in ${cityName}, Oregon`,
      description: `Price-reduced and motivated seller homes in ${cityName}, Oregon. Sorted by most motivated.`,
      url: `/motivated-sellers/${slug}`,
    },
  ]

  const siblingCities = SITE_CITY_SLUGS.filter((s) => s !== slug)

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Motivated sellers', href: '/motivated-sellers' },
            { label: cityName },
          ]}
        />
      </Container>

      {/* Hero */}
      <HeroBlock
        headline={`Motivated Seller Homes in ${cityName}, Oregon`}
        lede={
          listings.length > 0
            ? `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} with documented price cuts or seller motivation in ${cityName}. Updated hourly from the regional MLS.`
            : `Active homes with price cuts or seller motivation signals in ${cityName}, Oregon. Updated hourly from the regional MLS.`
        }
        minHeight={460}
      />

      {/* Intro — transparency + keyword content */}
      <Section padding="default" tone="muted" divider>
        <Container>
          <Stack gap="tight" className="max-w-3xl">
            <Eyebrow>How scores work</Eyebrow>
            <H2>Why these homes are ranked above others</H2>
            <Body size="default" tone="muted">
              Every listing on this page has at least one real motivation signal from the
              MLS: a price reduction from the original list price, the seller or agent
              using specific phrases in the listing remarks (things like &quot;seller motivated,&quot;
              &quot;priced to sell,&quot; or &quot;bring all offers&quot;), or an unusually long days on market.
              The score weights price cuts most heavily, followed by remarks, then DOM.
            </Body>
            <Body size="default" tone="muted">
              The list refreshes every 10 minutes. When a price changes in the MLS, the
              score recalculates and the ranking updates automatically.
            </Body>
          </Stack>
        </Container>
      </Section>

      {/* Listing grid */}
      <Section padding="default" tone="default" divider>
        <Container>
          {listings.length > 0 ? (
            <Stack gap="default">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <H2>
                  {listings.length}{' '}
                  motivated seller{listings.length === 1 ? ' home' : ' homes'} in {cityName}
                </H2>
                <Link
                  href="/motivated-sellers"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  View all Central Oregon
                </Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {listings.map((listing) => {
                  const card = motivatedToCardData(listing)
                  return card ? <ListingCard key={card.listingKey} listing={card} /> : null
                })}
              </div>
            </Stack>
          ) : (
            <Stack gap="tight" className="py-12 text-center">
              <Body size="default" tone="muted">
                No motivated seller listings found in {cityName} right now. The MLS updates
                throughout the day, so check back soon.
              </Body>
              <Link
                href="/motivated-sellers"
                className="text-sm text-accent-foreground hover:underline underline-offset-4"
              >
                View all Central Oregon motivated sellers
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
            <H3>Motivated sellers in other cities</H3>
            <div className="flex flex-wrap gap-2 mt-2">
              {siblingCities.map((sibling) => {
                const label = CITY_DISPLAY[sibling] ?? sibling
                return (
                  <Link
                    key={sibling}
                    href={`/motivated-sellers/${sibling}`}
                    className={cn(
                      'inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium',
                      'bg-background text-foreground hover:bg-secondary',
                      'transition-colors'
                    )}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </Stack>
        </Container>
      </Section>

      {/* CTA */}
      <CTABar
        eyebrow={`Why Ryan Realty in ${cityName}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals in ${cityName} every year. If a motivated seller has priced a home to move, we can tell you whether it is actually a deal.`}
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: 'tel:5412136706', label: 'Call 541.213.6706' }}
        tone="navy"
      />
    </main>
  )
}

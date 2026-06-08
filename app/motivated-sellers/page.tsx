/**
 * /motivated-sellers — Pillar page for motivated seller homes in Central Oregon.
 *
 * Data ONLY through @/lib/data. No app/actions/* imports.
 * ISR: revalidates every 600 seconds so the grid stays current.
 *
 * SEO strategy:
 *   - Targets "motivated seller homes Central Oregon", "price reduced homes Bend", etc.
 *   - Real H1 with geographic specificity
 *   - Honest explanation of how motivation is identified (trust + keyword relevance)
 *   - City filter chips link to per-city pages for internal linking depth
 *   - ItemList structured data for the listing grid
 *   - BreadcrumbList JSON-LD
 *
 * Layout: BreadcrumbNav, HeroBlock, intro text, city filters, listing grid,
 *         CTABar — mirrors the city page pattern.
 */

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
import { CONTACT } from '@/lib/brand/contact'

// ─── ISR ─────────────────────────────────────────────────────────────────

export const revalidate = 600
export const dynamicParams = false

// ─── Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Motivated Seller Homes in Central Oregon',
    description:
      'Browse price-reduced homes and motivated seller listings across Central Oregon. ' +
      'Sorted by most motivated. Real price cuts and listing remarks, no guesswork.',
    path: '/motivated-sellers',
    keywords: [
      'motivated seller homes Central Oregon',
      'price reduced homes Oregon',
      'motivated sellers Bend Oregon',
      'price cut homes Bend',
      'below market homes Central Oregon',
      'seller motivated homes Oregon',
    ],
  })
}

// ─── City display names ────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function MotivatedSellersPage() {
  const { listings } = await getMotivatedListings({
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
      ],
    },
  ]

  if (listings.length > 0) {
    // ItemList for the listing grid
    schemas.push({
      type: 'webPage',
      name: 'Motivated Seller Homes in Central Oregon',
      description:
        'Price-reduced and motivated seller listings across Bend, Redmond, Sisters, and Central Oregon. Sorted by most motivated.',
      url: '/motivated-sellers',
    })
  }

  return (
    <main className="min-h-screen bg-background">
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Motivated sellers' },
          ]}
        />
      </Container>

      {/* Hero */}
      <HeroBlock
        headline="Motivated Sellers in Central Oregon"
        lede="Active homes with documented price cuts or seller-signaled motivation. Sorted by most motivated, updated hourly from the regional MLS."
        photo={{
          src: '/images/hero/hero-old-mill-master-4k.jpg',
          alt: 'Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains.',
          priority: true,
        }}
        minHeight={480}
      />

      {/* How motivation is identified — transparency + keyword relevance */}
      <Section padding="default" tone="muted" divider>
        <Container>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Stack gap="tight" className="lg:col-span-2">
              <Eyebrow>How it works</Eyebrow>
              <H2>What makes a listing show up here</H2>
              <Body size="default" tone="muted">
                Each listing earns a motivation score from real MLS data only. Three signals
                drive the score: price cuts from the original list price (the more and the
                bigger, the higher the score), days on market (a long time on market with
                no takers is a signal), and specific phrases in the listing remarks
                (the agent or seller saying things like &quot;seller motivated,&quot; &quot;priced to sell,&quot;
                or &quot;bring all offers&quot;). No guesswork, no fabrication.
              </Body>
              <Body size="default" tone="muted">
                A home with two price cuts totaling 8 percent plus &quot;motivated seller&quot; in the
                remarks will rank above a home that simply sat 60 days. The score is
                recalculated every 10 minutes as new price changes come through.
              </Body>
            </Stack>
            <Stack gap="tight" className="border-l border-border pl-8 hidden lg:flex">
              <Eyebrow>Score signals</Eyebrow>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-foreground font-medium w-20 shrink-0">Price cuts</span>
                  <span>Number of distinct reductions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground font-medium w-20 shrink-0">Total drop</span>
                  <span>From original list to current price</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground font-medium w-20 shrink-0">Remarks</span>
                  <span>Seller motivation phrases in listing text</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-foreground font-medium w-20 shrink-0">DOM</span>
                  <span>Days on market (secondary weight)</span>
                </li>
              </ul>
            </Stack>
          </div>
        </Container>
      </Section>

      {/* City filter chips */}
      <Section padding="default" tone="default" divider>
        <Container>
          <Stack gap="tight">
            <Eyebrow>Filter by city</Eyebrow>
            <H3>Browse motivated homes by area</H3>
            <div className="flex flex-wrap gap-2 mt-2">
              <Link
                href="/motivated-sellers"
                className={cn(
                  'inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-medium',
                  'bg-primary text-primary-foreground',
                  'transition-colors'
                )}
              >
                All cities
              </Link>
              {SITE_CITY_SLUGS.map((slug) => {
                const label = CITY_DISPLAY[slug] ?? slug
                return (
                  <Link
                    key={slug}
                    href={`/motivated-sellers/${slug}`}
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

      {/* Listing grid */}
      <Section padding="default" tone="muted" divider>
        <Container>
          {listings.length > 0 ? (
            <Stack gap="default">
              <div className="flex items-baseline justify-between gap-4">
                <H2>{listings.length} motivated seller homes in Central Oregon</H2>
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
                No motivated seller listings found at the moment. Check back soon as the
                MLS updates throughout the day.
              </Body>
            </Stack>
          )}
        </Container>
      </Section>

      {/* CTA */}
      <CTABar
        eyebrow="Ready to make an offer"
        title="Local brokers. Specific numbers. No pressure."
        body="We know this market. If a motivated seller has priced a home to move, we can tell you whether it is actually a deal. No hype, just the facts."
        primary={{ href: '/contact', label: 'Talk to a broker' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: `Call ${CONTACT.phoneDirect}` }}
        tone="navy"
      />
    </main>
  )
}

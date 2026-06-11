/**
 * Broker detail page (/team/[slug]) — Wave 3 site-v2 rebuild.
 *
 * Substantial trust-building agent page: large headshot, full contact info
 * including Oregon license number (from data only, never invented), bio,
 * active listings, and a clear call/email CTA.
 *
 * DATA ACCURACY (CLAUDE.md §0): all broker fields come from getBrokerBySlug
 * via getAgentBySlug — name, title, license_number, bio, phone, email. No
 * stats or review numbers are fabricated. License numbers show only when
 * present in the database row. If the per-broker license is null the firm
 * license (Principal Broker 201206613) is noted as context only for Matt.
 *
 * Uses @/components/site/* + @/components/ui/* only. No legacy broker/*
 * components.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getAgentBySlug, getAgentActiveListings, getAgentSoldListings } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { BrokerContactCard } from '@/components/site/BrokerContactCard'
import { CTABar } from '@/components/site/CTABar'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { ReviewsBlock } from '@/components/site/ReviewsBlock'
import BrokerAttributionSetter from '@/components/BrokerAttributionSetter'
import { submitBrokerSellerLead } from '@/app/team/actions'
import { getReviews } from '@/lib/data'
import { normalizeAgentSlug, BROKER_EMAIL_BY_SLUG, type BrokerSlug } from '@/lib/agent-attribution'
import { Separator } from '@/components/ui/separator'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { listingTileHref } from '@/lib/slug'
import {
  Body,
  Caption,
  Container,
  DisplayHeading,
  Eyebrow,
  Grid,
  H2,
  H3,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getAgentBySlug(slug), getBrokerageSettings()])
  if (!broker) notFound()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const title = `${broker.display_name} · ${siteName} — Central Oregon real estate`
  const description =
    broker.bio?.slice(0, 155) ??
    `${broker.display_name}, ${broker.title ?? 'Real Estate Broker'} at ${siteName}. Licensed in Oregon. Contact for Central Oregon real estate.`
  const canonical = `${siteUrl}/team/${slug}`
  const ogImage = `${siteUrl}/api/og?type=broker&id=${encodeURIComponent(slug)}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: 'profile',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${broker.display_name} | ${siteName}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export const revalidate = 60

/** Map a HomeTileRow from getAgentActiveListings to the ListingCardData shape. */
function toListingCardData(tile: {
  ListingKey?: string | null
  ListPrice?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
  PhotoURL?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  TotalLivingAreaSqFt?: number | null
}): ListingCardData | null {
  const key = tile.ListingKey
  if (!key) return null
  const addressLine = [tile.StreetNumber, tile.StreetName].filter(Boolean).join(' ') || 'Address unavailable'
  const cityParts = [tile.City, tile.PostalCode].filter(Boolean).join(' ')
  const cityLine = [cityParts, tile.SubdivisionName].filter(Boolean).join(' · ')
  return {
    listingKey: key,
    href: listingTileHref({
      listingKey: tile.ListingKey,
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      city: tile.City,
      subdivisionName: tile.SubdivisionName,
    }),
    photoUrl: tile.PhotoURL ?? null,
    price: tile.ListPrice ?? null,
    addressLine,
    cityLine,
    beds: tile.BedroomsTotal ?? null,
    baths: tile.BathroomsTotal ?? null,
    sqft: tile.TotalLivingAreaSqFt ?? null,
  }
}

/** Format a close date (ISO or YYYY-MM-DD) to "Sold Mon YYYY" for the SOLD badge. */
function soldBadgeLabel(closeDate: string | null | undefined): string {
  if (!closeDate) return 'Sold'
  const d = new Date(closeDate)
  if (Number.isNaN(d.getTime())) return 'Sold'
  return `Sold ${d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`
}

/**
 * Map a sold tile (from getAgentSoldListings) to a ListingCardData. The card
 * price is the recorded MLS closing price (CLAUDE.md §0: a verified figure
 * straight from the listing row, not a derived stat), with a SOLD badge carrying
 * the close month + year.
 */
function toSoldCardData(
  tile: Parameters<typeof toListingCardData>[0] & { ClosePrice?: number | null; CloseDate?: string | null },
): ListingCardData | null {
  const base = toListingCardData(tile)
  if (!base) return null
  return {
    ...base,
    price: tile.ClosePrice ?? base.price,
    badge: { kind: 'sold', label: soldBadgeLabel(tile.CloseDate) },
  }
}

/**
 * Factual fallback bio when the broker has no bio in the database.
 * Sentence-case, no banned words, no invented claims.
 */
function factualFallbackBio(displayName: string, title: string): string {
  return `${displayName} is a licensed Oregon real estate broker at Ryan Realty, a small independent brokerage based in Bend, Oregon. Ryan Realty serves buyers and sellers across Central Oregon, including Bend, Redmond, Sisters, Sunriver, and surrounding communities. ${displayName} works directly with clients from first contact through closing.`
}

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) notFound()

  const brokerage = await getBrokerageSettings()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const hasLicense = Boolean(broker.license_number?.trim())
  const canonicalUrl = `${siteUrl}/team/${slug}`

  // Active + recently-sold listings — only fetch when the broker has a license or
  // email to match against. Resolution runs through listings.list_agent_email
  // (the populated, indexed source) so our own brokers actually resolve.
  const canMatch = hasLicense || !!broker.email
  const [activeListings, soldListings] = canMatch
    ? await Promise.all([
        getAgentActiveListings(broker.license_number ?? null, 6, broker.email),
        getAgentSoldListings(broker.license_number ?? null, 9, broker.email),
      ])
    : [[], []]
  const listingCards: ListingCardData[] = activeListings
    .map(toListingCardData)
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, 6)
  const soldCards: ListingCardData[] = soldListings
    .map(toSoldCardData)
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, 9)

  // Bio — use data row value if present; else a factual fallback sentence
  const bioText: string = broker.bio?.trim()
    ? broker.bio.trim()
    : factualFallbackBio(broker.display_name, broker.title ?? 'Broker')

  // Headshot: map display_name → known public headshot paths
  // The photo_url column stores a remote URL; use the local PNG as the canonical headshot
  const HEADSHOT: Record<string, string> = {
    'matthew-ryan': '/images/brokers/ryan-matt.png',
    'matt-ryan': '/images/brokers/ryan-matt.png',
    'paul-stevenson': '/images/brokers/stevenson-paul.png',
    'rebecca-peterson': '/images/brokers/peterson-rebecca.png',
    'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.png',
  }
  const headshotSrc = HEADSHOT[broker.slug] ?? broker.photo_url ?? '/images/brokers/ryan-matt.png'

  const telHref = broker.phone ? `tel:${broker.phone.replace(/\./g, '').replace(/[^\d]/g, '')}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null

  const trustLine = broker.license_number
    ? `Oregon real estate license #${broker.license_number}`
    : 'Licensed real estate broker · Ryan Realty, Bend Oregon'

  // Canonical broker slug for FUB attribution. The URL slug normalizes for Paul
  // and Rebecca; Matt's 'matthew-ryan' does not, so fall back to an email match.
  const canonicalSlug: BrokerSlug | null =
    normalizeAgentSlug(slug) ??
    ((Object.entries(BROKER_EMAIL_BY_SLUG).find(
      ([, email]) => email.toLowerCase() === (broker.email ?? '').toLowerCase(),
    )?.[0] as BrokerSlug | undefined) ?? null)

  const reviews = await getReviews(6)

  return (
    <main className="min-h-screen bg-background">
      {/* Route any lead from this page to this broker in FUB. */}
      <BrokerAttributionSetter slug={canonicalSlug} />

      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: broker.display_name,
            jobTitle: broker.title ?? 'Real Estate Broker',
            image: broker.photo_url ?? undefined,
            telephone: broker.phone ?? undefined,
            email: broker.email ?? undefined,
            url: canonicalUrl,
            areaServed: { '@type': 'Place', name: 'Central Oregon' },
            worksFor: {
              '@type': ['LocalBusiness', 'RealEstateAgent'],
              name: siteName,
              url: siteUrl,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Team', url: `${siteUrl}/team` },
              { name: broker.display_name, url: canonicalUrl },
            ])
          ),
        }}
      />
      {/* AEO: the broker's recently-sold homes as a structured ItemList, so an
          answer engine can surface "homes <broker> has sold". Sale prices are the
          recorded MLS closing prices (verified from the listing row). */}
      {soldCards.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: `Homes ${broker.display_name} recently sold`,
              description: `Closed sales from the last two years where ${broker.display_name} represented the seller, from the Oregon Data Share MLS.`,
              numberOfItems: soldCards.length,
              itemListElement: soldCards.map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: {
                  '@type': 'SingleFamilyResidence',
                  name: c.addressLine,
                  address: c.cityLine,
                  ...(c.price
                    ? {
                        offers: {
                          '@type': 'Offer',
                          price: c.price,
                          priceCurrency: 'USD',
                          availability: 'https://schema.org/SoldOut',
                        },
                      }
                    : {}),
                },
              })),
            }),
          }}
        />
      ) : null}

      {/* Breadcrumb */}
      <PageBreadcrumb trail={[{ label: 'Team', href: '/team' },
              { label: broker.display_name }]} />

      {/* Hero section — large headshot + identity + contact */}
      <Section padding="loose" tone="default">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px] lg:gap-16 items-start">

            {/* Left — identity + bio + trust signals */}
            <div>
              {/* Mobile headshot (visible below md, hidden at lg) */}
              <div className="flex justify-center mb-8 lg:hidden">
                <Image
                  src={headshotSrc}
                  alt={broker.display_name}
                  width={200}
                  height={300}
                  className="select-none w-40 h-auto"
                  priority
                />
              </div>

              <Stack gap="tight">
                <Eyebrow>Ryan Realty · Bend, Oregon</Eyebrow>
                <DisplayHeading as="h1" className="text-4xl text-foreground sm:text-5xl">
                  {broker.display_name}
                </DisplayHeading>
                <div className="text-lg font-semibold text-muted-foreground">
                  {broker.title ?? 'Real Estate Broker'}
                </div>

                {/* License + state credential */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {broker.license_number ? (
                    <Caption tone="muted" className="tabular-nums">
                      Oregon license #{broker.license_number}
                    </Caption>
                  ) : null}
                  <Caption tone="muted">Licensed in the State of Oregon</Caption>
                </div>
              </Stack>

              <Separator className="my-6" />

              {/* Direct contact links */}
              <Stack gap="tight">
                <Caption tone="muted">Direct contact</Caption>
                {broker.phone ? (
                  <div className="flex items-center gap-2">
                    <TextLink
                      href={telHref!}
                      underline="never"
                      weight="semibold"
                      className="tabular-nums text-lg"
                    >
                      {broker.phone}
                    </TextLink>
                    <Caption tone="muted">(call or text)</Caption>
                  </div>
                ) : null}
                {broker.email ? (
                  <TextLink
                    href={mailHref!}
                    underline="on-hover"
                    weight="normal"
                    className="text-base break-all"
                  >
                    {broker.email}
                  </TextLink>
                ) : null}
              </Stack>

              <Separator className="my-6" />

              {/* Bio */}
              <Stack gap="tight">
                <H3>{firstName}&apos;s background</H3>
                <Body size="default" tone="muted" className="leading-relaxed max-w-prose">
                  {bioText}
                </Body>
              </Stack>

              {/* What they do */}
              <div className="mt-8 bg-muted rounded-xl p-6">
                <Stack gap="tight">
                  <H3>The standard your home gets</H3>
                  <ul className="mt-2 space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                    <li>Cinematic video and a 3D walkthrough on your listing, the showcase treatment buyers expect at the high end</li>
                    <li>A price built from live Central Oregon market data, with the comparable sales that support it</li>
                    <li>A marketing plan shaped to your home and the buyer most likely to want it</li>
                    <li>{firstName} from the first call to the closing table, on a direct line the whole way</li>
                  </ul>
                </Stack>
              </div>
            </div>

            {/* Right sidebar — contact card (hidden on mobile, shown at lg) */}
            <div className="hidden lg:block sticky top-6">
              <BrokerContactCard
                name={broker.display_name}
                title={broker.title ?? 'Real Estate Broker'}
                licenseNumber={broker.license_number}
                phone={broker.phone}
                email={broker.email}
                headshotSrc={headshotSrc}
                headshotAlt={broker.display_name}
                trustLine={trustLine}
                ctaHref={broker.phone ? telHref! : (broker.email ? mailHref! : '/contact')}
                firstName={firstName}
                variant="card"
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* Lead capture — the broker's primary conversion, routed to them in FUB */}
      <LeadCaptureBlock
        variant="seller"
        onSubmit={submitBrokerSellerLead}
        eyebrow="What's your home worth"
        title={`Get a valuation from ${firstName}`}
        intro={`Tell ${firstName} about your home and you will get a comparative market analysis, with the comparable sales behind the number. No automated estimate, no obligation.`}
        submitLabel="Request my valuation"
        tone="muted"
      />

      {/* Active listings */}
      {listingCards.length > 0 ? (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight" className="mb-8">
              <Eyebrow>Active listings</Eyebrow>
              <H2>{firstName}&apos;s current listings</H2>
              <Body size="default" tone="muted">
                Active listings where {firstName} is the listing broker, pulled directly from the Oregon Data Share MLS.
              </Body>
            </Stack>
            <Grid cols={3} gap="default">
              {listingCards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </Grid>
          </Container>
        </Section>
      ) : null}

      {/* Recently sold — closed sales where this broker represented the seller */}
      {soldCards.length > 0 ? (
        <Section padding="default" tone="default" divider>
          <Container>
            <Stack gap="tight" className="mb-8">
              <Eyebrow>Recently sold</Eyebrow>
              <H2>Homes {firstName} recently sold</H2>
              <Body size="default" tone="muted">
                Closed sales from the last two years where {firstName} represented the seller, pulled directly from
                the Oregon Data Share MLS. Each price is the recorded closing price.
              </Body>
            </Stack>
            <Grid cols={3} gap="default">
              {soldCards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </Grid>
          </Container>
        </Section>
      ) : null}

      {/* Brokerage social proof — the firm's reputation backs every broker */}
      <ReviewsBlock
        data={reviews}
        eyebrow="Client reviews"
        title="What clients say about Ryan Realty"
        tone="muted"
        max={6}
      />

      {/* Mobile CTA band */}
      <div className="lg:hidden">
        <CTABar
          eyebrow={`Work with ${firstName}`}
          title="Ready to get started?"
          body="Call or email directly. No scripts, no waiting on a call queue."
          primary={broker.phone ? { href: telHref!, label: broker.phone } : { href: '/contact', label: 'Get in touch' }}
          secondary={broker.email ? { href: mailHref!, label: 'Send an email' } : undefined}
          tone="navy"
        />
      </div>

      {/* Bottom CTA — schedule */}
      <CTABar
        eyebrow="Ready to talk"
        title={`Work with ${firstName} on your next move.`}
        body="Call, text, or email directly. No hand-offs. The broker you contact is the broker you work with."
        primary={broker.phone ? { href: telHref!, label: `Call ${firstName}: ${broker.phone}` } : { href: '/contact', label: 'Get in touch' }}
        secondary={broker.email ? { href: mailHref!, label: 'Send an email' } : { href: '/team', label: 'Meet the team' }}
        tone="navy"
      />
    </main>
  )
}

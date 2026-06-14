/**
 * Broker landing page (/team/[slug]) — conversion-oriented redesign.
 *
 * Visual thesis: lead with the person and the firm's proof. An oversized
 * editorial portrait against a navy field, the Google rating and Ryan Realty's
 * track record stated immediately, one direct way to start. The broker is the
 * face; Ryan Realty's results are the backing, so a newer broker never looks
 * thin on volume.
 *
 * DATA ACCURACY (CLAUDE.md §0): broker identity from getAgentBySlug; the rating
 * and review count from getReviews (public.reviews); the "recent sales" grid is
 * Ryan Realty BROKERAGE closings (getBrokerageListingTiles, by ListOfficeName),
 * NOT per-broker volume — newer brokers are backed by the firm's record. Every
 * price is the recorded MLS closing price. No invented stats, ever.
 *
 * Uses @/components/site/* + @/components/ui/* only.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getAgentBySlug } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { getBrokerageListingTiles, getReviews, getBrokerSales } from '@/lib/data'
import type { BrokerSaleTile } from '@/lib/data'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { CTAButton } from '@/components/site/primitives'
import { CTABar } from '@/components/site/CTABar'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { ReviewsBlock } from '@/components/site/ReviewsBlock'
import BrokerAttributionSetter from '@/components/BrokerAttributionSetter'
import { submitBrokerSellerLead } from '@/app/team/actions'
import { normalizeAgentSlug, BROKER_EMAIL_BY_SLUG, type BrokerSlug } from '@/lib/agent-attribution'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { listingTileHref } from '@/lib/slug'
import {
  Body,
  Container,
  DisplayHeading,
  Eyebrow,
  Grid,
  H2,
  Section,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const OFFICE_NAME = 'Ryan Realty'

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

/** "Sold Mon YYYY" badge label from a close date. */
function soldBadgeLabel(closeDate: string | null | undefined): string {
  if (!closeDate) return 'Sold'
  const d = new Date(closeDate)
  if (Number.isNaN(d.getTime())) return 'Sold'
  return `Sold ${d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`
}

/** Map a brokerage closing tile to a SOLD ListingCard (price = recorded MLS close). */
function toBrokerageSoldCard(tile: PriceDropTile): ListingCardData | null {
  if (!tile.ListingKey) return null
  const addressLine = [tile.StreetNumber, tile.StreetName].filter(Boolean).join(' ') || 'Address unavailable'
  const cityParts = [tile.City, tile.PostalCode].filter(Boolean).join(' ')
  const cityLine = [cityParts, tile.SubdivisionName].filter(Boolean).join(' · ')
  return {
    listingKey: tile.ListingKey,
    href: listingTileHref({
      listingKey: tile.ListingKey,
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      city: tile.City,
      subdivisionName: tile.SubdivisionName,
    }),
    photoUrl: tile.PhotoURL ?? null,
    price: tile.ClosePrice ?? tile.ListPrice ?? null,
    addressLine,
    cityLine,
    beds: tile.BedroomsTotal ?? null,
    baths: tile.BathroomsTotal ?? null,
    sqft: tile.TotalLivingAreaSqFt ?? null,
    badge: { kind: 'sold', label: soldBadgeLabel(tile.CloseDate) },
  }
}

/** The three broker first names, lowercased — used to keep a review that names
 *  one broker off another broker's page. */
const BROKER_FIRST_NAMES = ['matt', 'rebecca', 'paul'] as const

/** Word-boundary, case-insensitive test for a first name inside review text. */
function namesBroker(text: string, firstName: string): boolean {
  const fn = firstName.trim().toLowerCase()
  if (!fn) return false
  return new RegExp(`\\b${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text.toLowerCase())
}

/**
 * Brokerage Google reviews are not split per broker (broker_id is unset) and
 * most name Matt by name. A review that names a DIFFERENT broker reads as
 * misattributed on this page, so keep only reviews that name THIS broker or name
 * no broker at all (CLAUDE.md §0 — never imply a client praised the wrong broker).
 */
function reviewBelongsOnPage(text: string, firstName: string): boolean {
  if (namesBroker(text, firstName)) return true
  const me = firstName.trim().toLowerCase()
  return !BROKER_FIRST_NAMES.some((n) => n !== me && namesBroker(text, n))
}

/** Five star glyphs; `filledClass` colors the filled set, the rest inherit at 30%. */
function Stars({ count = 5, filledClass, className }: { count?: number; filledClass: string; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(count)))
  return (
    <span aria-label={`${full} out of 5 stars`} className={`tracking-wide ${className ?? ''}`}>
      <span aria-hidden className={filledClass}>{'★'.repeat(full)}</span>
      <span aria-hidden className="text-current opacity-30">{'★'.repeat(5 - full)}</span>
    </span>
  )
}

/** Map a broker closed-sale tile to a ListingCard with a side-aware badge. */
function toBrokerSaleCard(tile: BrokerSaleTile): ListingCardData | null {
  const base = toBrokerageSoldCard(tile)
  if (!base) return null
  const when = soldBadgeLabel(tile.CloseDate).replace(/^Sold/, '').trim()
  const verb = tile.saleSide === 'listed' ? 'Sold' : 'Bought'
  return { ...base, badge: { kind: 'sold', label: when ? `${verb} ${when}` : verb } }
}

function factualFallbackBio(displayName: string): string {
  return `${displayName} is a real estate broker at Ryan Realty, based in Bend, Oregon. Ryan Realty serves buyers and sellers across Central Oregon, including Bend, Redmond, Sisters, Sunriver, and surrounding communities. ${displayName} works directly with clients from first contact through closing.`
}

const HEADSHOT: Record<string, string> = {
  'matthew-ryan': '/images/brokers/ryan-matt.png',
  'matt-ryan': '/images/brokers/ryan-matt.png',
  'paul-stevenson': '/images/brokers/stevenson-paul.png',
  'rebecca-peterson': '/images/brokers/peterson-rebecca.png',
  'rebecca-ryser-peterson': '/images/brokers/peterson-rebecca.png',
}

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) notFound()

  const brokerage = await getBrokerageSettings()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const canonicalUrl = `${siteUrl}/team/${slug}`

  const [reviews, brokerageTiles, brokerSales] = await Promise.all([
    // Pull the full review pool (count/average are computed across all rows) so
    // the per-broker attribution filter has everything to choose from.
    getReviews(24),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 60 }),
    getBrokerSales({ email: broker.email, mlsId: broker.mls_id, limit: 9 }),
  ])

  // This broker's own closings — both sides, newest first. Verified keys only
  // (list_agent_email + buyer_agent_mls_id); each price is the recorded close.
  const brokerSaleCards: ListingCardData[] = brokerSales
    .map(toBrokerSaleCard)
    .filter((c): c is ListingCardData => c !== null)
  const hasOwnSales = brokerSaleCards.length > 0

  // Brokerage recent sales — closed listings across Ryan Realty, newest first.
  // Shown as the track record for a broker who has no own closings yet.
  const soldCards: ListingCardData[] = brokerageTiles
    .filter((t) => t.ClosePrice != null && (t.CloseDate != null || /clos|sold/i.test(t.StandardStatus ?? '')))
    .sort((a, b) => new Date(b.CloseDate ?? 0).getTime() - new Date(a.CloseDate ?? 0).getTime())
    .map(toBrokerageSoldCard)
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, 6)

  const bioText = broker.bio?.trim() ? broker.bio.trim() : factualFallbackBio(broker.display_name)
  const headshotSrc = HEADSHOT[broker.slug] ?? broker.photo_url ?? '/images/brokers/ryan-matt.png'
  const telHref = broker.phone ? `tel:${broker.phone.replace(/[^\d]/g, '')}` : null
  const smsHref = broker.phone ? `sms:${broker.phone.replace(/[^\d]/g, '')}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null

  // Reviews that belong on THIS broker's page (name them, or name nobody),
  // with the ones that name this broker first.
  const relevantReviews = reviews.reviews
    .filter((r) => reviewBelongsOnPage(r.text, firstName))
    .sort((a, b) => Number(namesBroker(b.text, firstName)) - Number(namesBroker(a.text, firstName)))

  // The single strongest relevant review for the social-proof band near the top.
  const featured =
    relevantReviews.find((r) => namesBroker(r.text, firstName) && r.rating >= 5 && r.text.length > 80) ??
    relevantReviews.find((r) => r.rating >= 5 && r.text.length > 80) ??
    relevantReviews[0] ??
    null

  const canonicalSlug: BrokerSlug | null =
    normalizeAgentSlug(slug) ??
    ((Object.entries(BROKER_EMAIL_BY_SLUG).find(
      ([, email]) => email.toLowerCase() === (broker.email ?? '').toLowerCase(),
    )?.[0] as BrokerSlug | undefined) ?? null)

  return (
    <main className="min-h-screen bg-background">
      <BrokerAttributionSetter slug={canonicalSlug} />

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
            // The Google rating is the BROKERAGE's (reviews are not split per
            // broker), so it sits on the firm node, not the individual agent.
            worksFor: {
              '@type': ['LocalBusiness', 'RealEstateAgent'],
              name: siteName,
              url: siteUrl,
              ...(reviews.count > 0
                ? {
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: reviews.averageRating,
                      reviewCount: reviews.count,
                      bestRating: 5,
                    },
                  }
                : {}),
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
            ]),
          ),
        }}
      />

      <PageBreadcrumb trail={[{ label: 'Team', href: '/team' }, { label: broker.display_name }]} />

      {/* ───────── Hero — navy field, oversized portrait, identity, rating, CTA ───────── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <Container className="grid items-end gap-8 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-20">
          {/* Identity + proof + CTA */}
          <div className="order-2 lg:order-1 lg:pb-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Eyebrow className="text-primary-foreground/70">Ryan Realty · Bend, Oregon</Eyebrow>
            <DisplayHeading as="h1" className="mt-3 text-5xl text-primary-foreground sm:text-6xl">
              {broker.display_name}
            </DisplayHeading>
            <p className="mt-2 text-lg font-medium text-primary-foreground/80">
              {broker.title ?? 'Real Estate Broker'}
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/85">
              The broker you call is the broker you get. No hand-offs, no transaction desk, from the
              first conversation to the closing table.
            </p>

            {/* Trust strip — Google rating + license, real values only */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              {reviews.count > 0 ? (
                <div className="flex items-center gap-2.5 text-primary-foreground">
                  <Stars count={reviews.averageRating} filledClass="text-primary-foreground" className="text-xl leading-none" />
                  <span className="text-base font-medium text-primary-foreground/90">
                    <TabularNumber value={reviews.averageRating} /> on Google ·{' '}
                    <TabularNumber value={reviews.count} /> reviews
                  </span>
                </div>
              ) : null}
              {broker.license_number ? (
                <span className="text-sm text-primary-foreground/65 tabular-nums">
                  Oregon license #{broker.license_number}
                </span>
              ) : null}
            </div>

            {/* Primary CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              {telHref ? (
                <CTAButton href={telHref} tone="on-navy" size="lg">
                  Call {firstName}
                </CTAButton>
              ) : null}
              {smsHref ? (
                <CTAButton href={smsHref} tone="on-navy-ghost" size="lg" external>
                  Text {firstName}
                </CTAButton>
              ) : mailHref ? (
                <CTAButton href={mailHref} tone="on-navy-ghost" size="lg">
                  Email {firstName}
                </CTAButton>
              ) : null}
            </div>
            {broker.phone ? (
              <p className="mt-3 text-sm tabular-nums text-primary-foreground/65">{broker.phone}</p>
            ) : null}
          </div>

          {/* Oversized transparent portrait, bottom-anchored into the navy field.
              A soft cream halo behind it anchors the figure so the light shirt
              does not dissolve into the navy. */}
          <div className="relative order-1 flex justify-center self-end lg:order-2 lg:justify-end">
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-foreground/5 blur-2xl sm:h-72 sm:w-72 lg:h-96 lg:w-96"
            />
            <Image
              src={headshotSrc}
              alt={broker.display_name}
              width={520}
              height={780}
              priority
              className="relative h-auto w-64 select-none drop-shadow-2xl sm:w-72 lg:w-full lg:max-w-md"
            />
          </div>
        </Container>
      </section>

      {/* ───────── Social proof — designed cream band directly under the hero ───────── */}
      {featured ? (
        <Section padding="loose" tone="muted">
          <Container className="relative max-w-3xl text-center">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 select-none font-display text-9xl leading-none text-primary/10"
            >
              “
            </span>
            <Eyebrow className="relative">Clients on Ryan Realty</Eyebrow>
            <div className="relative mt-4 flex justify-center text-foreground">
              <Stars count={featured.rating} filledClass="text-primary" className="text-2xl leading-none" />
            </div>
            <blockquote className="relative mt-5">
              <DisplayHeading as="p" className="text-2xl leading-snug text-foreground sm:text-3xl">
                {featured.text.length > 240 ? `${featured.text.slice(0, 237).trimEnd()}…` : featured.text}
              </DisplayHeading>
              <footer className="mt-7 flex flex-col items-center gap-1">
                <span className="text-base font-semibold text-foreground">
                  {featured.reviewerName ?? 'Verified Ryan Realty client'}
                </span>
                {reviews.count > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Google review · <TabularNumber value={reviews.averageRating} />/5 across{' '}
                    <TabularNumber value={reviews.count} /> reviews
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Verified Google review</span>
                )}
              </footer>
            </blockquote>
          </Container>
        </Section>
      ) : null}

      {/* ───────── Track record ─────────
          This broker's own closings when they have them (both sides, with a
          Sold / Bought badge); otherwise the brokerage record so a newer broker
          still shows proof. Both are recorded MLS closings — never invented. */}
      {hasOwnSales ? (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight" className="mb-8 max-w-2xl">
              <Eyebrow>Track record</Eyebrow>
              <H2>{firstName}&apos;s recent sales</H2>
              <Body size="default" tone="muted">
                Homes {firstName} has sold for sellers and bought for buyers, pulled directly from
                the Oregon Data Share MLS. Each price is the recorded closing price.
              </Body>
            </Stack>
            <Grid cols={3} gap="default">
              {brokerSaleCards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </Grid>
          </Container>
        </Section>
      ) : soldCards.length > 0 ? (
        <Section padding="default" tone="muted" divider>
          <Container>
            <Stack gap="tight" className="mb-8 max-w-2xl">
              <Eyebrow>The Ryan Realty record</Eyebrow>
              <H2>Recent Ryan Realty sales across Central Oregon</H2>
              <Body size="default" tone="muted">
                When you work with {firstName}, the whole brokerage is behind you. These are recent
                Ryan Realty closings, pulled directly from the Oregon Data Share MLS. Each price is
                the recorded closing price.
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

      {/* ───────── Meet the broker — editorial bio, no repeated portrait ───────── */}
      <Section padding="default" tone="default" divider>
        <Container>
          <div className="grid gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div className="lg:pt-1">
              <Eyebrow>Meet your broker</Eyebrow>
              <H2 className="mt-2">{firstName}</H2>
              <p className="mt-2 text-base font-medium text-muted-foreground">
                {broker.title ?? 'Real Estate Broker'}
              </p>
              <div aria-hidden className="mt-5 h-1 w-12 rounded-full bg-primary" />
            </div>
            <div>
              <Body size="default" tone="muted" className="max-w-prose leading-relaxed">
                {bioText}
              </Body>
              <div className="mt-7 flex flex-wrap gap-3">
                {telHref ? (
                  <CTAButton href={telHref} tone="primary" size="md">
                    Call {firstName}
                  </CTAButton>
                ) : null}
                {mailHref ? (
                  <CTAButton href={mailHref} tone="outline" size="md">
                    Email {firstName}
                  </CTAButton>
                ) : null}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ───────── Full reviews grid ─────────
          Brokerage Google rating (count + average across all rows) with the
          review cards filtered to this broker so no other broker's named review
          shows here. */}
      <ReviewsBlock
        data={{ ...reviews, reviews: relevantReviews }}
        eyebrow="Client reviews"
        title="What clients say about Ryan Realty"
        tone="muted"
        max={6}
      />

      {/* ───────── Lead capture — routed to this broker in FUB ───────── */}
      <LeadCaptureBlock
        variant="seller"
        onSubmit={submitBrokerSellerLead}
        eyebrow="What's your home worth"
        title={`Get a valuation from ${firstName}`}
        intro={`Tell ${firstName} about your home and you will get a comparative market analysis, with the comparable sales behind the number. No automated estimate, no obligation.`}
        submitLabel="Request my valuation"
        tone="default"
      />

      {/* ───────── Bottom CTA ───────── */}
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

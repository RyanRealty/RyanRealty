/**
 * Broker landing page (/team/[slug]) — KB (kinetic-brutalist) design, Phase 9 of
 * the convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME
 * section library as the homepage + city/community pages (components/site/kb/*),
 * fed per-broker DAL data, never forked (ci:kb-single-source G50). KbNav +
 * KbFooter carry the chrome (default chrome hidden for /team/* via HideChrome —
 * handled by the orchestrator, not this file).
 *
 * THE PAGE CONTRACT: KB design + SEO (generateMetadata + MetadataBlock JSON-LD:
 * RealEstateAgent/Breadcrumb) + tracking (KbSectionTracker pageType="broker").
 *
 * DATA ACCURACY (CLAUDE.md §0): broker identity from getAgentBySlug; the rating
 * and review count from getReviews (public.reviews); the "recent sales" grid is
 * either THIS BROKER'S OWN closings (getBrokerSales — both sides, verified MLS
 * close price) or the brokerage record (getBrokerageListingTiles, by
 * ListOfficeName) — newer brokers are backed by the firm's record. No invented
 * stats, ever.
 *
 * REVIEW FILTERING (CRITICAL — do not remove): brokerage Google reviews are not
 * split per broker. A review that names a DIFFERENT broker reads as misattributed
 * on this page. reviewBelongsOnPage() keeps only reviews that name THIS broker
 * or name no broker at all (§0 — never imply a client praised the wrong broker).
 *
 * Section stack: nav · breadcrumb · hero (broker portrait + stats) · bio (About)
 * · track record (Featured) · testimonials · sell · footer.
 *
 * JSON-LD: RealEstateAgent (Person + worksFor LocalBusiness) + BreadcrumbList.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/team/parity.json (KB set).
 *
 * NOTE — HideChrome: this page needs the default site header/footer suppressed.
 * The orchestrator handles this via HideChrome; this file does not touch layouts.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAgentBySlug } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { getBrokerageListingTiles, getReviews, getBrokerSales } from '@/lib/data'
import type { BrokerSaleTile } from '@/lib/data'
import type { PriceDropTile } from '@/lib/data/listings/getPriceDropTiles'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { listingTileHref, displaySubdivision } from '@/lib/slug'
import { normalizeAgentSlug, BROKER_EMAIL_BY_SLUG, type BrokerSlug } from '@/lib/agent-attribution'
import { submitBrokerSellerLead } from '@/app/team/actions'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import BrokerAttributionSetter from '@/components/BrokerAttributionSetter'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbFeaturedItem, KbReview } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

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

/** Map a brokerage closing tile to a KbFeaturedItem (price = recorded MLS close). */
function brokerageTileToFeatured(tile: PriceDropTile): KbFeaturedItem | null {
  if (!tile.ListingKey) return null
  const addressLine = [tile.StreetNumber, tile.StreetName, tile.StreetSuffix].filter(Boolean).join(' ') || 'Address unavailable'
  const cityParts = [tile.City, tile.PostalCode].filter(Boolean).join(' ')
  // design-audit #168: raw MLS sentinel values ("N/A", "None") rendered
  // verbatim as if they were a real subdivision name.
  const sub = [cityParts, displaySubdivision(tile.SubdivisionName)].filter(Boolean).join(' · ')
  return {
    price: tile.ClosePrice ?? tile.ListPrice ?? null,
    address: addressLine,
    sub,
    city: tile.City ?? '',
    beds: tile.BedroomsTotal ?? null,
    baths: tile.BathroomsTotal ?? null,
    sqft: tile.TotalLivingAreaSqFt ?? null,
    img: tile.PhotoURL ?? '',
    href: listingTileHref({
      listingKey: tile.ListingKey,
      streetNumber: tile.StreetNumber,
      streetName: tile.StreetName,
      city: tile.City,
      subdivisionName: tile.SubdivisionName,
    }),
    video: null,
  }
}

/** Map a broker closed-sale tile to a KbFeaturedItem with a side-aware badge. */
function brokerSaleToFeatured(tile: BrokerSaleTile): KbFeaturedItem | null {
  const base = brokerageTileToFeatured(tile)
  if (!base) return null
  // For broker's own sales, surface the Sold/Bought label in the sub field.
  const when = soldBadgeLabel(tile.CloseDate).replace(/^Sold/, '').trim()
  const verb = tile.saleSide === 'listed' ? 'Sold' : 'Bought'
  const badge = when ? `${verb} ${when}` : verb
  return { ...base, sub: [badge, base.sub].filter(Boolean).join(' · ') }
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

/** Fallback bio when a broker has no DB bio — leads with the receipt (the live
 *  closings count) when there is one, never recited category geography. */
function factualFallbackBio(opts: {
  displayName: string
  firstName: string
  closings: number
  phone: string | null
}): string {
  if (opts.closings > 0) {
    return `${opts.firstName} has closed ${opts.closings} homes across Central Oregon, for both buyers and sellers.`
  }
  if (opts.phone) {
    return `${opts.displayName} works with buyers and sellers across Bend, Redmond, Sisters, and Sunriver. Call or text ${opts.phone}.`
  }
  return `${opts.displayName} works with buyers and sellers across Bend, Redmond, Sisters, and Sunriver.`
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
    getBrokerSales({ email: broker.email, mlsId: broker.mls_id, limit: 24 }),
  ])

  // This broker's own closings — both sides, newest first. Verified keys only
  // (list_agent_email + buyer_agent_mls_id); each price is the recorded close.
  // design-audit #171: getBrokerSales has no geographic filter (list_agent_email
  // / buyer_agent_mls_id are exact identifiers, unrelated to location), so an
  // out-of-area referral closing (534 Crowson, Ashland OR 97520 — Jackson
  // County, hundreds of miles south) rendered in the track record directly
  // under a hero claiming "homes closed across Central Oregon." Every real
  // Central Oregon city's zip starts with 977 (Bend/Redmond/Sisters/Sunriver/
  // La Pine/Prineville/Madras/Terrebonne); a non-977 zip is out of the stated
  // service area and excluded rather than silently contradicting the claim.
  const brokerSaleItems: KbFeaturedItem[] = brokerSales
    .filter((t) => (t.PostalCode ?? '').trim().startsWith('977'))
    .map(brokerSaleToFeatured)
    .filter((c): c is KbFeaturedItem => c !== null)
  const closings = brokerSaleItems.length // true distinct count, both sides (<=24)
  const hasOwnSales = closings > 0

  // Brokerage recent sales — closed listings across Ryan Realty, newest first.
  // Shown as the track record for a broker who has no own closings yet.
  // Same out-of-service-area exclusion as brokerSaleItems above (design-audit #171).
  const brokerageItems: KbFeaturedItem[] = brokerageTiles
    .filter((t) => t.ClosePrice != null && (t.CloseDate != null || /clos|sold/i.test(t.StandardStatus ?? '')))
    .filter((t) => (t.PostalCode ?? '').trim().startsWith('977'))
    .sort((a, b) => new Date(b.CloseDate ?? 0).getTime() - new Date(a.CloseDate ?? 0).getTime())
    .map(brokerageTileToFeatured)
    .filter((c): c is KbFeaturedItem => c !== null)
    .slice(0, 6)

  const bioText = broker.bio?.trim()
    ? broker.bio.trim()
    : factualFallbackBio({ displayName: broker.display_name, firstName, closings, phone: broker.phone })
  const headshotSrc = HEADSHOT[broker.slug] ?? broker.photo_url ?? '/images/brokers/ryan-matt.png'

  // Direct-broker contact links — the one accountability fact a transaction-desk
  // shop cannot truthfully paste (passes the competitor test). Live values only.
  const telHref = broker.phone ? `tel:${broker.phone.replace(/[^\d]/g, '')}` : null
  const smsHref = broker.phone ? `sms:${broker.phone.replace(/[^\d]/g, '')}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null

  // Reviews that belong on THIS broker's page (name them, or name nobody),
  // with the ones that name this broker first.
  const relevantReviews = reviews.reviews
    .filter((r) => reviewBelongsOnPage(r.text, firstName))
    .sort((a, b) => Number(namesBroker(b.text, firstName)) - Number(namesBroker(a.text, firstName)))

  // Map to KbReview shape for KbTestimonials.
  const kbReviews: KbReview[] = relevantReviews.slice(0, 8).map((r) => ({
    quote: r.text.length > 400 ? `${r.text.slice(0, 397).trimEnd()}…` : r.text,
    author: r.reviewerName ?? 'Verified Ryan Realty client',
  }))

  const canonicalSlug: BrokerSlug | null =
    normalizeAgentSlug(slug) ??
    ((Object.entries(BROKER_EMAIL_BY_SLUG).find(
      ([, email]) => email.toLowerCase() === (broker.email ?? '').toLowerCase(),
    )?.[0] as BrokerSlug | undefined) ?? null)

  // KbAbout facts — live data only, no fabricated stats.
  const aboutFacts: { label: string; value: string; href?: string }[] = [
    { label: 'Title', value: broker.title ?? 'Real Estate Broker' },
    ...(broker.license_number ? [{ label: 'Oregon license', value: `#${broker.license_number}` }] : []),
    ...(hasOwnSales ? [{ label: 'Homes closed', value: closings.toLocaleString('en-US') }] : []),
    ...(reviews.count > 0 ? [{ label: 'Google rating', value: `${reviews.averageRating}/5 · ${reviews.count} reviews` }] : []),
    ...(broker.phone ? [{ label: 'Phone', value: broker.phone, href: `tel:${broker.phone.replace(/[^\d]/g, '')}` }] : []),
  ]

  // KbHero sub-row copy — honest, from live data.
  const heroLead = hasOwnSales
    ? `${closings} homes closed across Central Oregon, for buyers and sellers.`
    : `${firstName} lists and sells homes across Bend, Redmond, Sisters, Sunriver, and Prineville.`

  // Track-record items — own sales when available, brokerage record otherwise.
  // design-audit CMP-3: only tiles with a real MLS photo fill the grid. A photoless
  // tile renders as an empty navy void (KbFeatured fallback), so 3 of 9 read as broken.
  // Six good tiles beat nine with three holes. The true `closings` count above is the
  // full record and is unaffected — this is display-only.
  const withPhoto = (items: KbFeaturedItem[]) => items.filter((it) => Boolean(it.img))
  const featuredItems: KbFeaturedItem[] = hasOwnSales
    ? withPhoto(brokerSaleItems).slice(0, 9)
    : withPhoto(brokerageItems)
  const featuredEyebrow = hasOwnSales
    ? `${firstName} · Track record`
    : 'Ryan Realty · Track record'

  return (
    <main className="kb-root">
      <BrokerAttributionSetter slug={canonicalSlug} />

      {/* RealEstateAgent / Person JSON-LD — brokerage aggregate rating on worksFor,
          not the individual (reviews are not split per broker). */}
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

      <KbNav />
      <KbSectionTracker pageType="broker" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Team', url: '/team' },
              { name: broker.display_name, url: `/team/${slug}` },
            ],
          },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Team', href: '/team' },
          { label: broker.display_name },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — broker portrait as the poster, identity + live proof in the sub row. */}
        <KbHero
          data={{
            activeCount: null,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow={`Ryan Realty · Bend, Oregon`}
          titleTop={broker.display_name.includes(' ')
            ? broker.display_name.split(' ').slice(0, -1).join(' ')
            : broker.display_name}
          titleBottom={broker.display_name.includes(' ')
            ? broker.display_name.split(' ').slice(-1).join('')
            : ''}
          lead={heroLead}
          videoSrc={null}
          posterSrc="/images/office/ryan-realty-bend-office-interior-02.jpg"
          portraitSrc={headshotSrc}
          showSearch={false}
        />

        {/* Bio — KbAbout with the broker's verified bio and key facts. */}
        <KbAbout
          eyebrow={`${firstName} · ${broker.title ?? 'Real Estate Broker'}`}
          heading={`Meet ${firstName}`}
          paragraphs={[bioText]}
          facts={aboutFacts}
        />

        {/* Track record — own sales (both sides, with Sold/Bought badge) when the
            broker has them; otherwise the brokerage record so a newer broker still
            shows proof. Both are recorded MLS closings — never invented. */}
        {featuredItems.length > 0 ? (
          <KbFeatured items={featuredItems} eyebrow={featuredEyebrow} />
        ) : null}

        {/* Reviews filtered to this broker — no other broker's name appears here.
            The aggregate rating is the brokerage rating (reviews are not per-broker)
            so it sits on the firm node in JSON-LD, not on the individual agent. */}
        {kbReviews.length > 0 ? (
          <KbTestimonials reviews={kbReviews} />
        ) : null}

        {/* Sell CTA — no fabricated market stats; omit the sell data numbers here
            since there is no city-scoped pulse context on the broker profile page. */}
        <KbSell
          data={{
            medianListPrice: null,
            medianDaysToPending: null,
            soldCount30d: null,
          }}
          eyebrow={`Sell with ${firstName}`}
        />

        {/* Broker-attributed lead capture (restored) — KbSell above only redirects
            to /sell/valuation, so the per-broker FUB lead write the old page carried
            was lost. This form posts to submitBrokerSellerLead, which adapts to the
            seller LP pipeline and routes the lead to the ATTRIBUTED broker (the
            BrokerAttributionSetter cookie set above). Carries SmsConsentDisclosure
            (A2P consent surface) by way of LeadCaptureBlock. */}
        <LeadCaptureBlock
          variant="seller"
          onSubmit={submitBrokerSellerLead}
          eyebrow="What's your home worth"
          title={`Get a valuation from ${firstName}`}
          intro={`Tell ${firstName} about your home and you'll get a comparative market analysis with the comparable sales behind the number, not an automated estimate.`}
          submitLabel="Request my valuation"
          tone="default"
        />

        {/* Direct-broker contact (restored) — the call/text/email links and the
            direct-broker accountability fact the old page surfaced. KB-styled with
            kb.css section/btn classes; live phone + email only, no fabricated copy. */}
        {(telHref || smsHref || mailHref) ? (
          <section className="section" id="contact-broker" style={{ background: 'var(--cream)', color: 'var(--navy)' }}>
            <div className="wrap" style={{ paddingTop: 'clamp(48px,7vw,72px)', paddingBottom: 'clamp(48px,7vw,72px)' }}>
              <span className="sec-index">{`Talk to ${firstName} directly`}</span>
              <h2 className="display" style={{ fontSize: 'clamp(2.2rem,7vw,4rem)', lineHeight: 0.92, margin: '14px 0 0' }}>
                {`Work with ${firstName}.`}
              </h2>
              <p style={{ maxWidth: '52ch', margin: '18px 0 0', fontSize: '1.05rem', lineHeight: 1.55 }}>
                {broker.phone ? `Call or text ${broker.phone}` : null}
                {broker.phone && broker.email ? ', or ' : null}
                {broker.email ? `email ${broker.email}` : null}
                {broker.phone || broker.email ? '. ' : null}
                {`You work with ${firstName} directly, from the first call to closing.`}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
                {telHref ? (
                  <a href={telHref} className="btn alt">
                    {`Call ${firstName}`} <span className="arr">→</span>
                  </a>
                ) : null}
                {smsHref ? (
                  <a href={smsHref} className="btn">
                    {`Text ${firstName}`}
                  </a>
                ) : null}
                {mailHref ? (
                  <a href={mailHref} className="btn">
                    {`Email ${firstName}`}
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

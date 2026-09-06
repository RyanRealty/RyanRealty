/**
 * /team/[slug] - one broker's page, on the components/site/v3 barrel.
 *
 * PAGE_INVENTORY §6 / PAGE_OUTLINE /team/[slug]:
 * 1. Normal headshot, name, title, license, firm review door
 * 2. Call / Text / Email above any CMA sheet (valuation is /sell)
 * 3. Firm proof (same reviews + firm sales as About), labeled Ryan Realty
 * 4. Personal Atlas / Ledger / Instrument only if hasRealPersonalRecord
 * 5. Bio, facts only
 * 6. Doors: team · reviews · sell
 *
 * THE PAGE CONTRACT: generateMetadata with the canonical-slug fix,
 * BrokerAttributionSetter, RealEstateAgent JSON-LD on worksFor (brokerage
 * aggregate), BreadcrumbList, V3SectionTracker pageType="broker",
 * revalidate 60. publishOwnClosingRows is the whole MLS set (C7).
 *
 * D11: no virtue names. No invented quote. MLS remarks N/A.
 *
 * Parity: design_system/ryan-realty/ui_kits/team/parity.json perBrokerPage
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAgentBySlug } from '@/app/actions/agents'
import { getBrokerageSettings } from '@/app/actions/brokerage'
import { getBrokerageListingTiles, getReviews, getBrokerSales } from '@/lib/data'
import { normalizeAgentSlug, BROKER_EMAIL_BY_SLUG, type BrokerSlug } from '@/lib/agent-attribution'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import BrokerAttributionSetter from '@/components/BrokerAttributionSetter'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
  V3Atlas,
  V3Doors,
  V3Instrument,
  V3Proof,
} from '@/components/site/v3'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutDisplayName, aboutFaceFromBroker } from '@/app/about/_v3/about-faces'
import {
  factualFallbackBio,
  HEADSHOT,
  hasRealPersonalRecord,
  publishFirmClosingRows,
  publishOwnClosingRows,
} from './_v3/sale-rows'
import { buildBrokerRecord, brokerRecordSource, brokerRecordStamp } from './_v3/broker-record'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { formatDate } from '@/lib/format/date'
import { basemapForRegions } from '@/lib/geo/basemap-source'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const OFFICE_NAME = 'Ryan Realty'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getAgentBySlug(slug), getBrokerageSettings()])
  if (!broker) notFound()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const title = `${broker.display_name}, Bend realtor`
  const description =
    broker.bio?.trim()?.slice(0, 155) ??
    `${broker.display_name}, ${broker.title ?? 'Real Estate Broker'} at ${siteName}. Licensed in Oregon. Contact for Central Oregon real estate.`
  const canonicalSlug = broker.slug || slug
  const canonical = `${siteUrl}/team/${canonicalSlug}`
  const ogImage = `${siteUrl}/api/og?type=broker&id=${encodeURIComponent(canonicalSlug)}`
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

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params
  const broker = await getAgentBySlug(slug)
  if (!broker) notFound()

  const brokerage = await getBrokerageSettings()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const canonicalPathSlug = broker.slug || slug
  const canonicalUrl = `${siteUrl}/team/${canonicalPathSlug}`
  const shownName = aboutDisplayName(canonicalPathSlug, broker.display_name)

  const [reviews, brokerageTiles, brokerSales, regionAtlas] = await Promise.all([
    getReviews(50),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 60 }),
    getBrokerSales({ email: broker.email, mlsId: broker.mls_id }),
    buildRegionAtlasRegions().catch(() => null),
  ])
  const record = buildBrokerRecord(brokerSales)
  const recordSource = brokerRecordSource(firstName, record)
  const recordStamp = brokerRecordStamp(record)

  const ownRows = publishOwnClosingRows(brokerSales)
  const hasOwnSales = hasRealPersonalRecord(ownRows.length)
  const firmRows = publishFirmClosingRows(brokerageTiles)
  const [firstOwn, ...restOwn] = ownRows
  const [firstFirm, ...restFirm] = firmRows

  const bioText = broker.bio?.trim()
    ? broker.bio.trim()
    : factualFallbackBio({ displayName: broker.display_name, firstName, closings: ownRows.length, phone: broker.phone })

  const digits = broker.phone ? broker.phone.replace(/[^\d]/g, '') : ''
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : digits
  const telHref = e164 ? `tel:${e164}` : null
  const smsHref = e164 ? `sms:${e164}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null

  const quotes = toReviewQuotes(reviews.reviews).slice(0, 4)
  const reviewCount = reviews.count > 0 ? reviews.count : quotes.length
  const reviewAverage = reviews.count > 0 ? reviews.averageRating : 5
  const newestReview = quotes.find((q) => q.date)?.date ?? null

  const canonicalSlug: BrokerSlug | null =
    normalizeAgentSlug(slug) ??
    ((Object.entries(BROKER_EMAIL_BY_SLUG).find(
      ([, email]) => email.toLowerCase() === (broker.email ?? '').toLowerCase(),
    )?.[0] as BrokerSlug | undefined) ?? null)

  const face = aboutFaceFromBroker({
    slug: broker.slug || canonicalPathSlug,
    fullName: broker.display_name,
    title: broker.title,
    headshotPng: HEADSHOT[broker.slug] ?? HEADSHOT[canonicalPathSlug] ?? null,
    phoneDirect: broker.phone,
  })

  const identityItems: V3QuietItem[] = [
    ...(broker.license_number
      ? [{ kind: 'prose' as const, term: 'Oregon license', body: `#${broker.license_number}` }]
      : []),
    ...(reviewCount > 0
      ? [{ label: `${reviewCount} Google reviews · ${reviewAverage.toFixed(1)} of 5`, href: '/reviews' }]
      : []),
  ]

  const contactItems: V3QuietItem[] = [
    ...(broker.phone ? [{ kind: 'prose' as const, term: 'Phone', body: broker.phone }] : []),
    ...(broker.email ? [{ kind: 'prose' as const, term: 'Email', body: broker.email }] : []),
    ...(telHref ? [{ label: `Call ${firstName}`, href: telHref }] : []),
    ...(smsHref ? [{ label: `Text ${firstName}`, href: smsHref }] : []),
    ...(mailHref ? [{ label: `Email ${firstName}`, href: mailHref }] : []),
  ]

  const bioItems: V3QuietItem[] = [
    { kind: 'prose', body: bioText },
    { label: 'All brokers', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Sell', href: '/sell' },
  ]

  const firmSaleSource = v3Text(
    'Closed MLS sales listed by Ryan Realty. Central Oregon zips starting with 977. Recorded ClosePrice.',
  )
  const ownSaleSource = v3Text(
    `Closed MLS sales where ${firstName} listed the home or represented the buyer, every one on the regional MLS. Recorded ClosePrice.`,
  )

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <BrokerAttributionSetter slug={canonicalSlug} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'RealEstateAgent',
              name: broker.display_name,
              jobTitle: broker.title ?? 'Real Estate Broker',
              image: broker.photo_url ?? HEADSHOT[broker.slug] ?? undefined,
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
        <V3SectionTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Team', url: '/team' },
                { name: broker.display_name, url: `/team/${canonicalPathSlug}` },
              ],
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Team', href: '/team' },
            { label: shownName },
          ]}
        />

        {face ? (
          <AboutFaces people={[face]} heading={shownName} headingLevel={1} size="portrait" reach={false} />
        ) : null}

        {telHref && smsHref && mailHref ? (
          <V3Doors
            id="contact-broker"
            name={v3Text(`Reach ${firstName}`)}
            doors={[
              { kicker: v3Text('Call'), label: v3Text(broker.phone ?? 'Call'), fact: v3Text(`${firstName} answers, not a desk`), href: telHref },
              { kicker: v3Text('Text'), label: v3Text(`Text ${firstName}`), fact: v3Text('The fastest reply'), href: smsHref },
              { kicker: v3Text('Email'), label: v3Text(`Email ${firstName}`), fact: v3Text(broker.email ?? 'Email'), href: mailHref },
            ]}
          />
        ) : telHref || smsHref || mailHref ? (
          <V3Quiet
            id="contact-broker"
            eyebrow="Direct line"
            heading={broker.phone ? `Call or text ${firstName}` : `Email ${firstName}`}
            items={contactItems}
          />
        ) : null}

        <V3Quiet
          id="profile"
          eyebrow={`${shownName} · ${broker.title ?? 'Real Estate Broker'}`}
          heading={face ? `${firstName}'s license` : shownName}
          headingLevel={face ? 2 : 1}
          items={identityItems}
        />

        {quotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. The newest four, in full, as written.`}
            figures={[
              { value: String(reviewCount), label: 'Google reviews' },
              { value: reviewAverage.toFixed(1), label: 'average of 5' },
              ...(newestReview
                ? [{ value: formatDate(newestReview, { month: 'short', day: undefined, year: 'numeric' }), label: 'newest' }]
                : []),
            ]}
            quotes={quotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}

        {firstFirm ? (
          <V3Ledger
            id="firm-sales"
            eyebrow={v3Text('Ryan Realty · Closings')}
            heading={v3Text('Recent brokerage closings')}
            rows={[firstFirm, ...restFirm]}
            source={firmSaleSource}
          />
        ) : (
          <V3Ledger
            id="firm-sales"
            eyebrow={v3Text('Ryan Realty · Closings')}
            heading={v3Text('Recent brokerage closings')}
            rows={[]}
            emptyMessage={v3Text('No Central Oregon closings in this refresh.')}
            source={firmSaleSource}
          />
        )}

        {hasOwnSales && record.figures.length > 0 ? (
          <V3Instrument
            id="record"
            level={2}
            eyebrow={v3Text(`${firstName} · Record`)}
            headline={v3Text(`${record.closings.length.toLocaleString('en-US')} closed ${record.closings.length === 1 ? 'sale' : 'sales'} on the MLS`)}
            figures={[
              { value: v3Text(record.figures[0]!.value), label: v3Text(record.figures[0]!.label) },
              ...record.figures.slice(1).map((f) => ({ value: v3Text(f.value), label: v3Text(f.label) })),
            ]}
            chart={record.chart}
            source={v3Text(recordSource)}
            updated={recordStamp ? v3Text(recordStamp) : undefined}
          />
        ) : null}
        {hasOwnSales && record.dots.length > 0 ? (
          <V3Atlas
            id="closings"
            headingLevel={2}
            headline={v3Text(`Where ${firstName} has closed`)}
            dots={record.dots}
            regions={regionAtlas?.regions ?? []}
            basemap={basemapForRegions(regionAtlas?.regions ?? [], { dots: record.dots, fit: 'dots' })}
            types={record.types}
            events={[]}
            source={recordSource}
            stamp={recordStamp}
            noun={{ one: 'closing', many: 'closings' }}
            fit="dots"
          />
        ) : null}
        {hasOwnSales && firstOwn ? (
          <V3Ledger
            id="track-record"
            eyebrow={v3Text(`${firstName} · Newest closings`)}
            heading={v3Text(`${firstName}'s newest closings`)}
            rows={[firstOwn, ...restOwn.slice(0, 7)]}
            source={ownSaleSource}
          />
        ) : null}

        <V3Quiet
          id="bio"
          ariaLabel={`${firstName}`}
          items={bioItems}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

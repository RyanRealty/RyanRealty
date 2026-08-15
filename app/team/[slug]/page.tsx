/**
 * /team/[slug] - one broker's page, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Faces first (same AboutFaces cutout as /about and /team). Quiet (identity)
 * then Ledger (closings) then Quiet (filtered reviews) then Sheet (valuation,
 * same submitBrokerSellerLead payload) then Quiet (call, text, email).
 *
 * THE PAGE CONTRACT, carried across: generateMetadata with the canonical-slug
 * fix, BrokerAttributionSetter, RealEstateAgent JSON-LD on worksFor (brokerage
 * aggregate, not the individual), BreadcrumbList, V3SectionTracker
 * pageType="broker", revalidate 60, reviewBelongsOnPage, 977 zip filter,
 * photo-only tiles.
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
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker } from '@/app/about/_v3/about-faces'
import { BrokerValuationSheet } from './_v3/BrokerValuationSheet.client'
import { namesBroker, reviewBelongsOnPage } from './_v3/review-filter'
import { brokerageTileToRow, brokerSaleToRow, factualFallbackBio, HEADSHOT } from './_v3/sale-rows'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const OFFICE_NAME = 'Ryan Realty'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [broker, brokerage] = await Promise.all([getAgentBySlug(slug), getBrokerageSettings()])
  if (!broker) notFound()
  const siteName = brokerage?.name ?? 'Ryan Realty'
  const title = `${broker.display_name} · ${siteName}`
  const description =
    broker.bio?.slice(0, 155) ??
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

  const [reviews, brokerageTiles, brokerSales] = await Promise.all([
    getReviews(24),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 60 }),
    getBrokerSales({ email: broker.email, mlsId: broker.mls_id, limit: 24 }),
  ])

  const ownRows = brokerSales
    .map(brokerSaleToRow)
    .filter((row): row is V3LedgerFigureRow => row !== null && Boolean(row.media?.src))
  const closings = brokerSales.filter((t) => (t.PostalCode ?? '').trim().startsWith('977')).length
  const hasOwnSales = closings > 0

  const firmRows = brokerageTiles
    .filter((t) => t.ClosePrice != null && (t.CloseDate != null || /clos|sold/i.test(t.StandardStatus ?? '')))
    .sort((a, b) => new Date(b.CloseDate ?? 0).getTime() - new Date(a.CloseDate ?? 0).getTime())
    .map(brokerageTileToRow)
    .filter((row): row is V3LedgerFigureRow => row !== null && Boolean(row.media?.src))
    .slice(0, 6)

  const saleRows = hasOwnSales ? ownRows.slice(0, 9) : firmRows
  const [firstSale, ...restSales] = saleRows

  const bioText = broker.bio?.trim()
    ? broker.bio.trim()
    : factualFallbackBio({ displayName: broker.display_name, firstName, closings, phone: broker.phone })

  const telHref = broker.phone ? `tel:${broker.phone.replace(/[^\d]/g, '')}` : null
  const smsHref = broker.phone ? `sms:${broker.phone.replace(/[^\d]/g, '')}` : null
  const mailHref = broker.email ? `mailto:${broker.email}` : null

  const relevantReviews = reviews.reviews
    .filter((r) => reviewBelongsOnPage(r.text, firstName))
    .sort((a, b) => Number(namesBroker(b.text, firstName)) - Number(namesBroker(a.text, firstName)))

  const reviewItems: V3QuietItem[] = relevantReviews.map((r) => {
    const author = r.reviewerName?.trim()
    return author
      ? { kind: 'prose' as const, term: author, body: r.text }
      : { kind: 'prose' as const, body: r.text }
  })

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
    { kind: 'prose', body: bioText },
    ...(broker.title ? [{ kind: 'prose' as const, term: 'Title', body: broker.title }] : []),
    ...(broker.license_number
      ? [{ kind: 'prose' as const, term: 'Oregon license', body: `#${broker.license_number}` }]
      : []),
    ...(hasOwnSales
      ? [{ kind: 'prose' as const, term: 'Homes closed', body: `${closings} across Central Oregon` }]
      : []),
    ...(reviews.count > 0
      ? [
          {
            kind: 'prose' as const,
            term: 'Brokerage Google rating',
            body: `${reviews.averageRating}/5 from ${reviews.count} reviews`,
          },
        ]
      : []),
    ...(telHref ? [{ label: `Call ${firstName}`, href: telHref }] : []),
    ...(smsHref ? [{ label: `Text ${firstName}`, href: smsHref }] : []),
    ...(mailHref ? [{ label: `Email ${firstName}`, href: mailHref }] : []),
    { label: 'All brokers', href: '/team' },
  ]

  const contactItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: broker.phone
        ? `${firstName} works the deal from the first call to closing.`
        : `${firstName} works the deal from the first note to closing.`,
    },
    ...(broker.phone ? [{ kind: 'prose' as const, term: 'Phone', body: broker.phone }] : []),
    ...(broker.email ? [{ kind: 'prose' as const, term: 'Email', body: broker.email }] : []),
    ...(telHref ? [{ label: `Call ${firstName}`, href: telHref }] : []),
    ...(smsHref ? [{ label: `Text ${firstName}`, href: smsHref }] : []),
    ...(mailHref ? [{ label: `Email ${firstName}`, href: mailHref }] : []),
    { label: 'All brokers', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
  ]

  const saleSource = hasOwnSales
    ? v3Text(
        `Closed MLS sales where ${firstName} listed the home or represented the buyer. Central Oregon zips starting with 977. Recorded ClosePrice.`,
      )
    : v3Text(
        'Closed MLS sales listed by Ryan Realty. Central Oregon zips starting with 977. Recorded ClosePrice. Shown while this broker builds a personal record.',
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
        <V3SectionTracker pageType="broker" />
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
            { label: broker.display_name },
          ]}
        />

        {face ? <AboutFaces people={[face]} heading={broker.display_name} /> : null}

        <V3Quiet
          id="profile"
          eyebrow={`${firstName} · ${broker.title ?? 'Real Estate Broker'}`}
          heading={face ? `${firstName}'s license` : broker.display_name}
          headingLevel={face ? 2 : 1}
          items={identityItems}
        />

        {firstSale ? (
          <V3Ledger
            id="track-record"
            eyebrow={v3Text(hasOwnSales ? `${firstName} · Closings` : 'Ryan Realty · Closings')}
            heading={v3Text(hasOwnSales ? `${firstName}'s closed sales` : 'Recent brokerage closings')}
            rows={[firstSale, ...restSales]}
            source={saleSource}
          />
        ) : (
          <V3Ledger
            id="track-record"
            eyebrow={v3Text('Closings')}
            heading={v3Text('Closed sales')}
            rows={[]}
            emptyMessage={v3Text('No Central Oregon closings with a listing photo in this refresh.')}
          />
        )}

        {reviewItems.length > 0 ? (
          <V3Quiet
            id="reviews"
            eyebrow="Google reviews"
            heading={`Reviews that name ${firstName}, or name no broker`}
            items={[...reviewItems, { label: 'All Google reviews', href: '/reviews' }]}
          />
        ) : null}

        <BrokerValuationSheet firstName={firstName} />

        {(telHref || smsHref || mailHref) ? (
          <V3Quiet
            id="contact-broker"
            eyebrow="Direct line"
            heading={broker.phone ? `Call or text ${firstName}` : `Email ${firstName}`}
            items={contactItems}
          />
        ) : null}
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

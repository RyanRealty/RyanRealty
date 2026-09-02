/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Look (2026-08-14): About = faces. The first viewport is the live brokers'
 * canonical transparent PNGs (no card, no wash, no box). Name is the door.
 * Call and text sit on the face row. Quiet (origin) then Instrument (verified
 * licenses) then Atlas (the service area as the living map) then Proof (the
 * newest reviews) then Quiet (FAQ). PUBLIC_UI.md opens
 * About on Quiet + Sheet. The Sheet stays on /contact and /team/[slug]. A new
 * on-page form here would be a new capture contract. Seller lives on Sell.
 * The next tap is the name or the number.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata, MetadataBlock JSON-LD (AboutPage + aboutOrganization +
 * BreadcrumbList + FAQPage), a rendered V3SectionTracker with pageType="about",
 * revalidate 3600, and the route. MetadataBlock stays on the legacy register
 * (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D11: the mission sentence is the one virtue-word exception, exact words, We.
 * It ships in the closing Quiet, never on the first screen. No invented quote.
 * MLS remarks N/A.
 *
 * DATES RENDER IN PACIFIC, a change from the KB page, stated rather than absorbed.
 * The KB articles rail (now deleted) formatted with timeZone UTC. formatDate is
 * pinned to America/Los_Angeles. The city Ledger stamp uses formatDate.
 *
 * Parity: design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers, getReviews } from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath, teamPath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { BRAND, BROKERS } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
  V3Atlas,
  V3Proof,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  ABOUT_FAQ_ITEMS,
  ABOUT_MISSION,
  FIRM_LICENSE,
} from './_v3/about-constants'
import { AboutFaces } from './_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from './_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { basemapForRegions } from '@/lib/geo/basemap-source'

const ROUTE_PATH = '/about'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'About Ryan Realty · Bend, Oregon',
    description:
      'Ryan Realty is a Bend, Oregon brokerage, open since June 2023. Every listing gets video, a 3D walkthrough, and a price built from closed comps. The broker you call closes your sale.',
    path: ROUTE_PATH,
    ogImage: '/images/office/ryan-realty-bend-office-interior-01.jpg',
    keywords: [
      'Ryan Realty',
      'Bend Oregon real estate',
      'Central Oregon brokerage',
      'Matt Ryan broker',
    ],
  })
}

export const revalidate = 3600

export default async function AboutPage() {
  const brokers = await getBrokers()

  // The service area as the living map, from the same population the
  // homepage hero reads, plus the newest verified reviews with their record.
  const [atlasRead, regionAtlas, reviewSummary] = await Promise.all([
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null), null, 6000, 'about atlas'),
    buildRegionAtlasRegions().catch(() => null),
    getReviews(6).catch(() => null),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const newestReview = quotes.find((q) => q.date)?.date ?? null


  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const originItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: [
        `Matt Ryan opened Ryan Realty in Bend in ${BRAND.foundedLabel}, after years in the fire service. He learned the business from Hjalmar "Red" Erickson.`,
        'When the comps do not support the price you want, we say so before you sign anything. Every listing gets a video, a 3D walkthrough, and its own page here.',
        'The broker you first speak to is the broker who works your purchase or sale through to close. No hand-off.',
      ],
    },
    { label: 'Broker profiles', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Call, text, or write', href: '/contact' },
  ]

  const licenseFigures: V3InstrumentFigure[] = [
    { value: v3Text(BRAND.foundedLabel), label: v3Text('founded') },
    { value: v3Text(FIRM_LICENSE), label: v3Text('firm license') },
    {
      value: v3Text(`OR #${BROKERS.matt.license}`),
      label: v3Text('principal broker'),
      href: teamPath(BROKERS.matt.slug),
    },
  ]
  const [firstLicense, ...restLicense] = licenseFigures

  const faqItems: V3QuietItem[] = [
    { kind: 'prose', body: ABOUT_MISSION },
    ...ABOUT_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Broker profiles', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Call, text, or write', href: '/contact' },
    { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
    { label: 'Homes for sale', href: listingsBrowsePath() },
    { label: 'Central Oregon housing market', href: '/housing-market' },
  ]

  const schemas: SchemaInput[] = [
    {
      type: 'webPage',
      pageType: 'AboutPage',
      aboutOrganization: true,
      name: 'About Ryan Realty',
      description:
        'Ryan Realty is based in Bend, Oregon. We cover Bend, Redmond, Sisters, Sunriver, and the surrounding Central Oregon communities.',
      url: '/about',
    },
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'About', url: '/about' },
      ],
    },
    {
      type: 'faqPage',
      items: [...ABOUT_FAQ_ITEMS],
    },
  ]

  const brokerDoors: V3QuietItem[] = orderedBrokers.flatMap((b) => {
    const name = b.fullName?.trim()
    const slug = b.slug?.trim()
    if (!name || !slug) return []
    const title = b.title?.trim()
    return [{ label: title ? `${name}, ${title}` : name, href: teamPath(slug) }]
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <AboutFaces people={faces} heading="About Ryan Realty" />

        <V3Quiet
          id="about"
          heading="How it started"
          headingLevel={2}
          items={originItems}
        />

        {firstLicense ? (
          <V3Instrument
            id="record"
            level={2}
            eyebrow={v3Text('Verified record')}
            headline={v3Text('Open since June 2023')}
            figures={[firstLicense, ...restLicense]}
            source={v3Text(
              'Oregon Real Estate Agency. Ryan Realty LLC firm license and the principal broker license on file.',
            )}
          />
        ) : null}

        <V3Atlas
          id="service-area"
          headingLevel={2}
          headline={v3Text('Where we work')}
          dots={atlas.dots}
          regions={atlasRegions}
          basemap={basemapForRegions(atlasRegions)}
          types={atlas.types}
          events={atlas.events}
          source={atlas.source}
          stamp={atlas.stamp}
          incomplete={!atlas.complete}
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
        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading="Working with Ryan Realty"
          items={[
            ...faqItems,
            ...(brokerDoors.length > 0
              ? [{ kind: 'prose' as const, term: 'Who you work with', body: 'Matt Ryan, Paul Stevenson, Rebecca Peterson.' }, ...brokerDoors]
              : []),
          ]}
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

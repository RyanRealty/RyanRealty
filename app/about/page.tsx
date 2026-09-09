/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE_INVENTORY §6 / PAGE_OUTLINE /about (locked 2026-09-05):
 * 1. Who we are · office · firm/principal licenses · Call/Text/Email/Schedule
 * 2. Firm proof (V3Proof)
 * 3. Firm sales (same house row)
 * 4. Brokers as doors, not a poster that eats the fold
 * 5. Atlas of the service area
 * 6 and 7. How it started (short Quiet) + licenses restated as sourced line
 * 8. V3Answers
 *
 * THE PAGE CONTRACT: generateMetadata through pageMetadata, MetadataBlock
 * JSON-LD (AboutPage + aboutOrganization + BreadcrumbList + FAQPage),
 * V3SectionTracker pageType="about", revalidate 3600.
 *
 * No invented quote. MLS remarks N/A. D11 mission sentence is off this page.
 * Parity: design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers, getBrokerageListingTiles, getReviews } from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingsBrowsePath, teamPath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3Answers,
  V3SectionTracker,
  type V3QuietItem,
  type V3Answer,
  type V3AnswersDoor,
  V3Atlas,
  V3Proof,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { ABOUT_FAQ_ITEMS, FIRM_LICENSE } from './_v3/about-constants'
import { AboutFaces } from './_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from './_v3/about-faces'
import { FirmClosings } from './_v3/FirmClosings'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { publishFirmClosingRows } from '@/app/team/[slug]/_v3/sale-rows'
import { basemapForRegions } from '@/lib/geo/basemap-source'

const ROUTE_PATH = '/about'
const OFFICE_NAME = 'Ryan Realty'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'About Ryan Realty · Bend, Oregon',
    description:
      'Ryan Realty is a boutique brokerage in Bend, Oregon. Local experts in Central Oregon real estate, known for exceptional customer service. Ryan Realty LLC since 2014, Bend office open since June 2023.',
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

  const [atlasRead, regionAtlas, reviewSummary, brokerageTiles] = await Promise.all([
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null), null, 6000, 'about atlas'),
    buildRegionAtlasRegions().catch(() => null),
    getReviews(6).catch(() => null),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 60 }).catch(() => []),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const firmRows = publishFirmClosingRows(brokerageTiles)
  const principal =
    brokers.find((b) => b.isPrincipal) ?? brokers.find((b) => b.slug === BROKERS.matt.slug) ?? null

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  /**
   * SITE-40. The taste table scored this page 31 and named one cause: "below
   * the Amboqia H1 the entire remaining fold at both viewports is seven
   * identical hairline-divided link rows — each just text plus a trailing arrow
   * glyph", TASTE.md's "scrolling lists as the design" applied to a link menu.
   * Nothing here is removed: the same seven destinations are one lead door
   * (the principal broker, who is the page's actual proof) and six channels
   * laid 2-up, each with the mark of the channel it opens, so the phone and the
   * email are two different objects rather than two copies of one row. The
   * licenses ride on the lead door's detail line and still print in full in
   * #about below.
   */
  const whoItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: `A boutique brokerage in Bend. Ryan Realty LLC since ${BRAND.llcSince}, Bend office open since ${BRAND.foundedLabel}.`,
    },
    {
      label: `${BROKERS.matt.name}, principal broker`,
      detail: `Oregon license #${BROKERS.matt.license} · firm license ${FIRM_LICENSE}`,
      href: teamPath(BROKERS.matt.slug),
      mark: 'person',
      lead: true,
      // The face is the mark (SITE-40, second evaluator pass): seven doors
      // with seven glyphs read as "an icon card grid"; the person door with
      // the person's photograph reads as a person.
      ...(principal ? { media: { src: principal.headshotPng, alt: principal.fullName } } : {}),
    },
    // The four ways to reach him are one line under his door (V3Quiet
    // `weight: 'secondary'`), not four more rows: the evaluator named the
    // seven-row grid "scrolling lists as the design" on two passes.
    { label: 'Call', detail: CONTACT.phoneDirect, href: `tel:${CONTACT.phoneDirectTel}`, weight: 'secondary' },
    { label: 'Text', href: `sms:${CONTACT.phoneDirectTel}`, weight: 'secondary' },
    { label: 'Email', detail: CONTACT.email.primary, href: `mailto:${CONTACT.email.primary}`, weight: 'secondary' },
    { label: 'Schedule', href: '/book', weight: 'secondary' },
    {
      label: 'Client reviews',
      href: '/reviews',
      // The 5.0 the page is about, on the door that opens to it — from the
      // same getReviews read the proof block below already makes. Printed only
      // when the read returned rows: the fallback average is not a figure (§0).
      ...(reviewSummary && reviewSummary.count > 0
        ? {
            figure: {
              value: reviewSummary.averageRating.toFixed(1),
              unit: `of 5, from ${reviewSummary.count} Google reviews`,
              ratio: reviewSummary.averageRating / 5,
              source:
                'Google Business Profile reviews of Ryan Realty — every non-hidden review row in public.reviews, ratings averaged to a tenth, read live at render.',
              sourceName: 'Google reviews',
            },
          }
        : {}),
    },
    {
      label: 'The office',
      detail: `${BRAND.address.street}, ${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`,
      href: BRAND.social.googleBusinessProfile,
      mark: 'map',
    },
  ]

  const originItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: `Matt Ryan started Ryan Realty LLC in ${BRAND.llcSince} and opened the Bend office in ${BRAND.foundedLabel}, after years in the fire service. He learned the business from his mentor, Hjalmar "Red" Erickson, and runs the brokerage the way Red taught him: every client gets the same care and the same effort.`,
    },
  ]

  const licenseFigures: V3QuietItem[] = [
    { kind: 'fact', term: 'Firm license', value: FIRM_LICENSE },
    {
      label: `Principal broker OR #${BROKERS.matt.license}`,
      href: teamPath(BROKERS.matt.slug),
    },
  ]

  const faqAnswers: V3Answer[] = ABOUT_FAQ_ITEMS.map((item, index) => ({
    question: item.question,
    body: item.answer,
    open: index === 0,
  }))

  const faqDoors: V3AnswersDoor[] = [
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

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <V3Quiet
          id="who"
          heading="About Ryan Realty · Bend"
          headingLevel={1}
          items={whoItems}
        />

        {quotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. The newest four, in full, as written.`}
            figures={[]}
            quotes={quotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}

        {/* id="firm-sales" — FirmClosings mounts the house-row Ledger. */}
        <FirmClosings rows={firmRows} />

        <AboutFaces people={faces} heading="The brokers" headingLevel={2} />

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

        <V3Quiet
          id="about"
          heading="How it started"
          headingLevel={2}
          items={[...originItems, ...licenseFigures]}
          note="Oregon Real Estate Agency. Ryan Realty LLC firm license and the principal broker license on file."
        />

        <V3Answers
          id="faq"
          eyebrow="Common questions"
          heading="Working with Ryan Realty"
          headingLevel={2}
          questions={faqAnswers}
          doors={faqDoors}
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

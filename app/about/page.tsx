/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (SITE-48, 2026-09-09 — supersedes the 2026-09-05 lock):
 * 1. The brokers' faces, the H1, and the firm's own record (AboutFaces)
 * 2. One reach control: Call at display scale with the live hours, then Text,
 *    Email and the calendar as the lighter alternatives (V3Doors #reach)
 * 3. Firm proof, the words rather than the score again (V3Proof)
 * 4. Firm sales (same house row)
 * 5. Atlas of the service area
 * 6. How it started (short Quiet) + licenses as one sourced line
 * 7. V3Answers
 *
 * WHAT MOVED AND WHY. The page opened on a V3Quiet whose entire fold was a
 * license line and seven identical hairline link rows — Principal broker,
 * Call, Text, Email, Schedule, Client reviews, Contact — with the Proof, the
 * closings, the faces and the Atlas all below it. The taste table of
 * 2026-09-08 scored it 31 and its verdict was "the About page's first screen
 * is a phone book, not a proof point". So the faces and the firm's record are
 * the opening, the seven rows are one reach control, and the licences stay on
 * the origin Quiet where they were always restated anyway.
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
import { formatDate } from '@/lib/format/date'
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
  V3Doors,
  V3OnDuty,
  V3SourceLine,
} from '@/components/site/v3'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
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

  const [atlasRead, regionAtlas, reviewSummary, brokerageTiles, companySettings] = await Promise.all([
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null), null, 6000, 'about atlas'),
    buildRegionAtlasRegions().catch(() => null),
    getReviews(6).catch(() => null),
    getBrokerageListingTiles({ officeName: OFFICE_NAME, limit: 60 }).catch(() => []),
    // The published hours behind the reach control's live state — the same
    // rows /book fills its calendar from. Why hours and not a reply-time
    // figure: components/site/v3/V3OnDuty.view.ts.
    getCrmCompanySettings().catch(() => null),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const firmRows = publishFirmClosingRows(brokerageTiles)

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  /* THE OPENING'S FIGURES. Three, each one read in this render:
       - the Google average, `getReviews().averageRating` over the non-hidden
         Google rows in `reviews`;
       - the count from the same read;
       - the roster size, which is `getBrokers()` filtered to is_active.
     No firm sales figure sits here: `getBrokerageListingTiles` is capped at 60
     rows, so a "closings in the last N months" count off it could be a
     ceiling rather than a total. The closings appear below as the rows
     themselves, where a cap cannot become a wrong number. */
  const openingFigures =
    reviewSummary && reviewSummary.count > 0
      ? [
          { value: reviewAverage.toFixed(1), label: 'Google rating, of 5' },
          { value: String(reviewCount), label: reviewCount === 1 ? 'client review' : 'client reviews' },
          { value: String(faces.length), label: 'licensed Oregon brokers' },
        ]
      : [{ value: String(faces.length), label: 'licensed Oregon brokers' }]

  const openingTrace =
    reviewSummary && reviewSummary.count > 0
      ? `Google reviews through the public.reviews table, source = 'google' and is_hidden = false: ${reviewCount} rows, mean rating ${reviewAverage.toFixed(1)} of 5, read in this render (getReviews). Brokers are public.brokers where is_active is true, ${faces.length} rows, each with an Oregon licence number on file with the Oregon Real Estate Agency (getBrokers).`
      : `Brokers are public.brokers where is_active is true, ${faces.length} rows, each with an Oregon licence number on file with the Oregon Real Estate Agency (getBrokers). The reviews read returned nothing in this render, so no rating is printed.`

  /* The reach control's live state. Hours, never a reply-time promise — the
     reasoning and the SITE-09 read are in components/site/v3/V3OnDuty.view.ts. */
  const hoursBlocks = companySettings?.booking_hours ?? []
  const hoursTimeZone = companySettings?.time_zone || 'America/Los_Angeles'
  const hoursLive =
    hoursBlocks.length > 0 ? (
      <>
        <V3OnDuty blocks={hoursBlocks} timeZone={hoursTimeZone} nowIso={new Date().toISOString()} />
        {/* No `asOf` stamp on this one. The state above is as of NOW — that is
            what makes it live — and "as of <the day the row was last edited>"
            beside it reads as a stale figure, besides wrapping onto a line of
            its own behind a stray middot at 375. The row's own edit date is
            inside the trace, where it belongs. */}
        <V3SourceLine
          sourceName={v3Text('Ryan Realty booking hours')}
          source={v3Text(
            `Ryan Realty booking hours, public.crm_company_settings.booking_hours — ${hoursBlocks
              .map((b) => `${b.days.join(', ')} ${b.start_time} to ${b.end_time}`)
              .join('; ')}, evaluated in ${hoursTimeZone} against the clock at page render. Hours row last edited ${companySettings?.updated_at ? formatDate(companySettings.updated_at) : 'unknown'}. The same windows /book offers time from (lib/booking/slots.ts). Published hours only: this page makes no claim about how fast anyone replies.`,
          )}
        />
      </>
    ) : null

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

        {/* The fold: faces, the H1, the firm's record. AboutFaces carries the
            page title now — the section that used to hold it was a list of
            links, and a reader met no photograph and no figure before
            scrolling. */}
        <AboutFaces
          people={faces}
          heading="About Ryan Realty · Bend"
          headingLevel={1}
          eyebrow="Ryan Realty · Central Oregon"
          claim={`A boutique brokerage in Bend since ${BRAND.llcSince}. Three licensed Oregon brokers, and the one you call is the one who works your deal.`}
          figures={openingFigures}
          source={<V3SourceLine sourceName={v3Text('Ryan Realty record')} source={v3Text(openingTrace)} />}
        />

        {/* One reach control instead of seven identical rows: Call at display
            scale with the live hours under it, the rest as lighter links. */}
        <V3Doors
          id="reach"
          name={v3Text('Reach a broker')}
          doors={[
            {
              kicker: v3Text('Call or text'),
              label: v3Text(CONTACT.phoneDirect),
              fact: v3Text('One number for the whole brokerage'),
              href: `tel:${CONTACT.phoneDirectTel}`,
              primary: true,
              live: hoursLive,
            },
            {
              kicker: v3Text('Text'),
              label: v3Text(`Text ${CONTACT.phoneDirect}`),
              fact: v3Text('Same line, if a call is not the moment'),
              href: `sms:${CONTACT.phoneDirectTel}`,
            },
            {
              kicker: v3Text('Email'),
              label: v3Text(CONTACT.email.primary),
              fact: v3Text("Straight to Matt's inbox"),
              href: `mailto:${CONTACT.email.primary}`,
            },
            {
              kicker: v3Text('Schedule'),
              label: v3Text('Book a time'),
              fact: v3Text('Open slots on the calendar'),
              href: '/book',
            },
          ]}
        />

        {quotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Ryan Realty · Google"
            /* The score is in the fold above; this band is for the WORDS. A
               headline of the count here would print the same figure twice
               on one page, which is how a page reads as two builders' work. */
            headline="In their own words"
            headingLevel={2}
            claim={`The newest four of ${reviewCount} verified Google reviews, in full, exactly as they were written.`}
            figures={[]}
            quotes={quotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}

        {/* id="firm-sales" — FirmClosings mounts the house-row Ledger. */}
        <FirmClosings rows={firmRows} />

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

/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (SITE-163 — faces open, brokerage story stays):
 * 1. Hero: AboutFirm — faces at display scale, branded H1, one purpose line
 *    (boutique · Central Oregon · buy and sell). 5.0 from 25. Not broker Cards.
 * 2. V3Proof — client reviews PRIMARY (Google + featured quote). Not press.
 * 3. FirmClosings — dated local sold homes. Never invented MOS.
 * 4. AboutReach — catalog Button Group Call | Text | Email | Schedule
 * 5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only.
 * 6. AboutInquiry GET to /contact. Full form stays on Contact.
 * Then, below the proof (Matt 2026-09-23, the About-page AEO playbook):
 * 7. V3Entries #services "What Ryan Realty does" (each service an H3)
 * 8. V3Claims #different "What makes Ryan Realty different" (our own facts,
 *    each with its figure; no competitor named)
 * 9. V3Roll #clients "Who Ryan Realty works with" (clients by need)
 * 10. V3Atlas #service-area "Where we work"
 * 11. V3Steps #how-we-work "How Ryan Realty works" (same business day)
 * 12. V3Quiet #about "The team behind Ryan Realty" (origin, brokers as doors,
 *     licenses, profiles; no roster cards)
 * 13. V3Facts #key-facts "Key facts about Ryan Realty" (one <dl>)
 * 14. V3Answers #faq "Frequently asked questions" (H3 questions = FAQPage)
 * Never the sofa interior. No coast-to-coast copy. No competitor named.
 *
 * THE PAGE CONTRACT: generateMetadata through pageMetadata, MetadataBlock
 * JSON-LD (AboutPage + aboutOrganization carrying the key facts this page
 * prints + BreadcrumbList + FAQPage equal to the visible questions),
 * V3SectionTracker pageType="about", revalidate 3600.
 *
 * No invented quote. MLS remarks N/A. Parity:
 * design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getReviews } from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { runPublishedPageRender } from '@/lib/site/degraded-isr'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { BRAND, BROKERS } from '@/lib/brand/contact'
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
  V3OnDuty,
  V3Entries,
  V3Claims,
  V3Roll,
  V3Steps,
  V3Facts,
} from '@/components/site/v3'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { aboutFaqItems, FIRM_LICENSE } from './_v3/about-constants'
import {
  ABOUT_CLIENTS,
  ABOUT_CLIENTS_LEDE,
  ABOUT_HOW_STEPS,
  ABOUT_PROMISE_LINE,
  ABOUT_SERVICES_LEDE,
  aboutBrokerDoors,
  aboutDifferentiators,
  aboutDifferentiatorsSource,
  aboutHoursSentence,
  aboutHowFacts,
  aboutKeyFacts,
  aboutOrganizationFacts,
  aboutOriginBody,
  aboutServices,
  aboutSocialDoors,
  aboutTeamBody,
  type AboutPerson,
} from './_v3/about-playbook'
import { AboutFirm } from './_v3/AboutFirm'
import { AboutInquiry } from './_v3/AboutInquiry'
import { AboutOffice } from './_v3/AboutOffice'
import { AboutReach } from './_v3/AboutReach'
import { FirmClosings } from './_v3/FirmClosings'
import { loadAboutProof } from './_v3/load-about-faces'
import { basemapFrameForRegions } from '@/lib/geo/basemap-source'
import { deferredAtlasProps } from '@/lib/atlas/atlas-deferred'
import './_v3/about-fold.css'

const ROUTE_PATH = '/about'

export async function generateMetadata(): Promise<Metadata> {
  const reviewSummary = await getReviews(6).catch(() => null)
  const reviewLine =
    reviewSummary && reviewSummary.count > 0
      ? `${reviewSummary.averageRating.toFixed(1)} from ${reviewSummary.count} Google reviews. `
      : ''
  return pageMetadata({
    title: 'About Ryan Realty · Bend',
    description: `${reviewLine}A small boutique brokerage in Central Oregon. We help clients buy and sell. Bend office at ${BRAND.address.street}.`,
    path: ROUTE_PATH,
    ogImage: '/images/office/ryan-realty-bend-office-exterior-01.jpg',
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
  return runPublishedPageRender('about', renderAboutPage)
}

async function renderAboutPage() {
  const [atlasRead, regionAtlas, reviewSummary, companySettings, proof] = await Promise.all([
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null), null, 6000, 'about atlas'),
    buildRegionAtlasRegions().catch(() => null),
    getReviews(6).catch(() => null),
    getCrmCompanySettings().catch(() => null),
    loadAboutProof(),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  // UXLIVE-3 (visibility audit 2026-09-22): the 5,650 dots (2.0 MB of this
  // page's RSC payload), the sales heat drawn from them and the basemap load
  // after paint; the counts, the outlines and the text stay in the server HTML.
  const atlasProps = deferredAtlasProps({
    population: atlas,
    scope: { cities: [], boundaryRef: null, boundary: null },
    regions: atlasRegions,
    types: atlas.types,
    basemapFrame: basemapFrameForRegions(atlasRegions),
  })
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const firmRows = proof.closings
  const newestReviewDate = reviewSummary?.reviews.find((r) => r.reviewDate)?.reviewDate ?? undefined

  const hoursBlocks = companySettings?.booking_hours ?? []
  const hoursTimeZone = companySettings?.time_zone || 'America/Los_Angeles'
  const hoursLive =
    hoursBlocks.length > 0 ? (
      <V3OnDuty blocks={hoursBlocks} timeZone={hoursTimeZone} nowIso={new Date().toISOString()} />
    ) : null

  // The roster this render already loaded (public.brokers through
  // loadAboutProof), as the playbook sections name it: display name, title,
  // and the broker's own /team page. The principal is the founder.
  const people: AboutPerson[] = proof.faces.map((face) => ({
    name: face.name,
    title: face.title,
    href: face.href,
    src: face.src,
  }))
  const founder = people.find((person) => /principal/i.test(person.title)) ?? null
  const hoursLine = aboutHoursSentence(hoursBlocks, hoursTimeZone)
  const reviewsFigure =
    reviewSummary && reviewSummary.count > 0
      ? { average: reviewSummary.averageRating, count: reviewSummary.count }
      : null
  const closingRecord = firmRows.length > 0 ? proof.record : null
  const valuation = valuationHref(ROUTE_PATH)
  const services = aboutServices(valuation)
  const differentiators = aboutDifferentiators({ reviews: reviewsFigure, record: closingRecord, valuationHref: valuation })
  const keyFacts = aboutKeyFacts({
    founder,
    people,
    services,
    hours: hoursLine,
    record: closingRecord,
    reviews: reviewsFigure,
  })

  // The team behind Ryan Realty: the origin, the team from the live roster
  // with a door to each broker's page, the licenses, the firm's profiles.
  const teamBody = aboutTeamBody(people)
  const originItems: V3QuietItem[] = [
    { kind: 'prose', term: 'How it started', body: aboutOriginBody() },
    ...(teamBody ? [{ kind: 'prose' as const, term: 'The brokers', body: teamBody }] : []),
    ...aboutBrokerDoors(people),
  ]

  const licenseFigures: V3QuietItem[] = [
    { kind: 'fact', term: 'Firm license', value: FIRM_LICENSE },
    {
      label: `Principal broker OR #${BROKERS.matt.license}`,
      href: '/team',
    },
    ...aboutSocialDoors(),
  ]

  // AEO-5 / VOICE-5: the brokers' names and roles come from the roster this
  // render already loaded, so the FAQ and its FAQPage name the same people
  // the fold shows. The office hours come from the same booking_hours rows
  // V3OnDuty reads. One array feeds the visible questions (H3s) and FAQPage.
  const faqItems = aboutFaqItems(proof.faces, { hours: hoursLine })
  const faqAnswers: V3Answer[] = faqItems.map((item, index) => ({
    question: item.question,
    body: item.answer,
    open: index === 0,
  }))

  const faqDoors: V3AnswersDoor[] = [
    { label: 'The brokers', href: '/team' },
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
        'Ryan Realty is a small boutique brokerage in Bend, Oregon. We cover all of Central Oregon and help clients buy and sell their properties.',
      url: '/about',
      // Only facts this page prints: the services (What Ryan Realty does),
      // the service area and the licensed-broker count (Key facts).
      organizationFacts: aboutOrganizationFacts({ services, brokerCount: people.length }),
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
      items: faqItems,
    },
    {
      type: 'itemList',
      name: 'Ryan Realty brokers',
      items:
        proof.faces.length > 0
          ? proof.faces.map((face) => ({ name: face.name, url: face.href }))
          : [{ name: 'The brokers', url: '/team' }],
    },
    ...(firmRows.length > 0
      ? [
          {
            type: 'itemList' as const,
            name: 'Recent Ryan Realty closings',
            items: firmRows.map((row) => ({
              name: `${row.what} · ${row.value}`,
              url: row.href,
            })),
          },
        ]
      : []),
    ...(reviewSummary && reviewSummary.count > 0
      ? [
          {
            type: 'dataset' as const,
            name: 'Ryan Realty Google reviews',
            description:
              'Verified Google Business Profile reviews for Ryan Realty in Bend, Oregon. Average rating and count from public.reviews where source is google and is_hidden is false.',
            url: '/about',
            dateModified: newestReviewDate?.slice(0, 10),
            variableMeasured: [
              { name: 'Average Google rating', value: reviewAverage },
              { name: 'Google review count', value: reviewCount },
            ],
          },
        ]
      : []),
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />

        <div className="about-fold">
          <AboutFirm
            id="firm"
            heading="About Ryan Realty · Bend"
            people={proof.faces}
            proof={
              reviewCount > 0
                ? { value: reviewAverage.toFixed(1), count: reviewCount, href: '/reviews' }
                : null
            }
          />
          {quotes.length > 0 ? (
            <div className="about-fold__proof">
              <V3Proof
                id="proof"
                eyebrow="Ryan Realty · Google"
                headline="In their own words"
                headingLevel={2}
                claim={`The newest four of ${reviewCount} verified Google reviews, in full, exactly as they were written.`}
                figures={[
                  { value: reviewAverage.toFixed(1), label: 'Average rating' },
                  { value: String(reviewCount), label: 'Google reviews' },
                ]}
                quotes={quotes}
                source={{ label: 'Every review', href: '/reviews' }}
                record={false}
              />
            </div>
          ) : null}
          <div className="about-fold__sales">
            <FirmClosings id="firm-sales" rows={firmRows} />
          </div>
          <div className="about-fold__reach">
            {hoursLive}
            <AboutReach id="reach" />
          </div>
          <AboutOffice id="office" />
          <div className="about-fold__write">
            <AboutInquiry id="write" />
          </div>
        </div>

        <V3Entries
          id="services"
          eyebrow="Ryan Realty · Services"
          heading="What Ryan Realty does"
          lede={ABOUT_SERVICES_LEDE}
          entries={services}
        />

        <V3Claims
          id="different"
          eyebrow="Ryan Realty · On the record"
          heading="What makes Ryan Realty different"
          claims={differentiators}
          source={aboutDifferentiatorsSource({ reviews: reviewsFigure, record: closingRecord })}
        />

        <V3Roll
          id="clients"
          heading="Who Ryan Realty works with"
          lede={ABOUT_CLIENTS_LEDE}
          items={ABOUT_CLIENTS}
        />

        <V3Atlas
          id="service-area"
          headingLevel={2}
          headline={v3Text('Where we work')}
          dots={atlasProps.dots}
          dotsSrc={atlasProps.dotsSrc}
          dotsSummary={atlasProps.dotsSummary}
          regions={atlasProps.regions}
          basemapSrc={atlasProps.basemapSrc}
          types={atlas.types}
          events={atlas.events}
          source={atlas.source}
          stamp={atlas.stamp}
          incomplete={!atlas.complete}
        />

        <V3Steps
          id="how-we-work"
          heading="How Ryan Realty works"
          promise={ABOUT_PROMISE_LINE}
          facts={aboutHowFacts(hoursLine)}
          steps={ABOUT_HOW_STEPS}
        />

        <V3Quiet
          id="about"
          heading="The team behind Ryan Realty"
          headingLevel={2}
          items={[...originItems, ...licenseFigures]}
          note="Oregon Real Estate Agency. Ryan Realty LLC firm license and the principal broker license on file."
        />

        <V3Facts
          id="key-facts"
          heading="Key facts about Ryan Realty"
          facts={keyFacts}
          note="Clients served counts the recorded MLS closings of Ryan Realty brokers in Central Oregon. Reviews are our Google Business Profile reviews, read live."
        />

        <V3Answers
          id="faq"
          eyebrow="Common questions"
          heading="Frequently asked questions"
          headingLevel={2}
          questionHeadings
          questions={faqAnswers}
          doors={faqDoors}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

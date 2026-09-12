/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (Researchy 1–8 + Matt 2026-09-12 — brokerage, not Team):
 * 1. Hero: AboutFirm — office exterior + one purpose line
 *    (boutique · Central Oregon · buy and sell). Not broker Cards.
 * 2. V3Proof — client reviews PRIMARY (Google + featured quote). Not press.
 * 3. FirmClosings — dated local sold homes. Never invented MOS.
 * 4. AboutTeamTeaser — photo + name → /team only. No bios/licenses.
 * 5. V3Doors four-up matching Contact (Call / Text / Email / Schedule)
 * 6. AboutInquiry GET to /contact. Full form stays on Contact.
 * Then Atlas, How it started + OREA, V3Answers.
 * Never the sofa interior. No coast-to-coast / fee copy.
 *
 * THE PAGE CONTRACT: generateMetadata through pageMetadata, MetadataBlock
 * JSON-LD (AboutPage + aboutOrganization + BreadcrumbList + FAQPage),
 * V3SectionTracker pageType="about", revalidate 3600.
 *
 * No invented quote. MLS remarks N/A. Parity:
 * design_system/ryan-realty/ui_kits/about/parity.json
 */

import type { Metadata } from 'next'
import { getReviews } from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildRegionAtlasRegions } from '@/app/_v3/region-atlas'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { listingsBrowsePath } from '@/lib/slug'
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
} from '@/components/site/v3'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { ABOUT_FAQ_ITEMS, FIRM_LICENSE } from './_v3/about-constants'
import { AboutFirm } from './_v3/AboutFirm'
import { AboutInquiry } from './_v3/AboutInquiry'
import { AboutTeamTeaser } from './_v3/AboutTeamTeaser'
import { FirmClosings } from './_v3/FirmClosings'
import { loadAboutProof } from './_v3/load-about-faces'
import { basemapForRegions } from '@/lib/geo/basemap-source'
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
  const [atlasRead, regionAtlas, reviewSummary, companySettings, proof] = await Promise.all([
    withTimeoutFallback(buildPlaceAtlas({ cities: [], label: 'Central Oregon' }).catch(() => null), null, 6000, 'about atlas'),
    buildRegionAtlasRegions().catch(() => null),
    getReviews(6).catch(() => null),
    getCrmCompanySettings().catch(() => null),
    loadAboutProof(),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const firmRows = proof.closings
  const teamTeaser = proof.faces.map((face) => ({ name: face.name, src: face.src }))
  const featuredQuote = quotes[0]
    ? { pull: quotes[0].pull, author: quotes[0].author }
    : undefined
  const newestReviewDate = reviewSummary?.reviews.find((r) => r.reviewDate)?.reviewDate ?? undefined

  const hoursBlocks = companySettings?.booking_hours ?? []
  const hoursTimeZone = companySettings?.time_zone || 'America/Los_Angeles'
  const hoursLive =
    hoursBlocks.length > 0 ? (
      <V3OnDuty blocks={hoursBlocks} timeZone={hoursTimeZone} nowIso={new Date().toISOString()} />
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
      href: '/team',
    },
  ]

  const faqAnswers: V3Answer[] = ABOUT_FAQ_ITEMS.map((item, index) => ({
    question: item.question,
    body: item.answer,
    open: index === 0,
  }))

  const faqDoors: V3AnswersDoor[] = [
    { label: 'Meet the team', href: '/team' },
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
    {
      type: 'itemList',
      name: 'Meet the Ryan Realty team',
      items: [{ name: 'The brokers', url: '/team' }],
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
            heading="About Ryan Realty · Bend"
            officeSrc="/images/office/ryan-realty-bend-office-exterior-01.jpg"
            officeAlt={`Ryan Realty at ${BRAND.address.street}, ${BRAND.address.city}`}
            officeCaption={`BEND OFFICE · ${BRAND.address.street}`}
            proof={
              reviewSummary && reviewSummary.count > 0
                ? {
                    value: reviewAverage.toFixed(1),
                    count: reviewCount,
                    href: '/reviews',
                  }
                : undefined
            }
            quote={featuredQuote}
          />
          {quotes.length > 0 ? (
            <div className="about-fold__proof">
              <V3Proof
                id="proof"
                eyebrow="Ryan Realty · Google"
                headline="In their own words"
                headingLevel={2}
                claim={`The newest four of ${reviewCount} verified Google reviews, in full, exactly as they were written.`}
                figures={[]}
                quotes={quotes}
                source={{ label: 'Every review', href: '/reviews' }}
                record={false}
              />
            </div>
          ) : null}
          <div className="about-fold__sales">
            <FirmClosings rows={firmRows} />
          </div>
          <AboutTeamTeaser people={teamTeaser} />
          <div className="about-fold__reach">
            <V3Doors
              id="reach"
              name={v3Text('Reach a broker')}
              doors={[
                {
                  kicker: v3Text('Call'),
                  label: v3Text(CONTACT.phoneDirect),
                  fact: v3Text('One number for the whole brokerage'),
                  href: `tel:${CONTACT.phoneDirectTel}`,
                  primary: true,
                  live: hoursLive,
                },
                {
                  kicker: v3Text('Text'),
                  label: v3Text('Send a text'),
                  fact: v3Text('Same line as the call'),
                  href: `sms:${CONTACT.phoneDirectTel}`,
                },
                {
                  kicker: v3Text('Email'),
                  label: v3Text('Send an email'),
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
          </div>
          <div className="about-fold__write">
            <AboutInquiry />
          </div>
        </div>

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

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

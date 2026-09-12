/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (SITE-90, 2026-09-12 — people + firm + closings):
 * 1. The fold: AboutFaces proof (H1, a real firm beat, three broker Cards
 *    with separate Avatars — Matt, Rebecca, Paul) + Street View exterior of
 *    115 NW Oregon Ave #2 + FirmClosings as a shadcn carousel of real
 *    closings. Never the interior sofa. No AvatarGroup overlap. No
 *    methodology disclosure on the fold.
 * 2. One reach control: Call at display scale with the live hours, then Text,
 *    Email and the calendar as the lighter alternatives (V3Doors #reach)
 * 3. Firm proof, the words rather than the score again (V3Proof)
 * 4. Atlas of the service area
 * 5. How it started (short Quiet) + licenses as one sourced line
 * 6. V3Answers
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
import { getReviews } from '@/lib/data'
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
  V3Doors,
  V3OnDuty,
} from '@/components/site/v3'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { ABOUT_FAQ_ITEMS, FIRM_LICENSE } from './_v3/about-constants'
import { AboutFaces } from './_v3/AboutFaces'
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
    description: `${reviewLine}${BROKERS.matt.nameShort}, ${BROKERS.rebecca.nameShort}, and ${BROKERS.paul.nameShort}. Recent closings with recorded prices, addresses, and beds. Bend office since ${BRAND.llcSince}.`,
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
    // The published hours behind the reach control's live state — the same
    // rows /book fills its calendar from. Why hours and not a reply-time
    // figure: components/site/v3/V3OnDuty.view.ts.
    getCrmCompanySettings().catch(() => null),
    loadAboutProof(),
  ])
  const atlas = atlasRead ?? EMPTY_PLACE_ATLAS
  const atlasRegions = regionAtlas?.regions ?? []
  const quotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount = reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : quotes.length
  const reviewAverage = reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const faces = proof.faces
  const firmRows = proof.closings
  const newestReviewDate = reviewSummary?.reviews.find((r) => r.reviewDate)?.reviewDate ?? undefined
  const firmBeat = [
    `Ryan Realty has been a Bend brokerage since ${BRAND.llcSince}. The office is at ${BRAND.address.street}. ${BROKERS.matt.nameShort}, ${BROKERS.rebecca.nameShort}, and ${BROKERS.paul.nameShort} are the licensed brokers.`,
    'The person you call is the person who works your purchase or sale through closing.',
  ].join('\n\n')

  /* The reach control's live state. Hours, never a reply-time promise — the
     reasoning and the SITE-09 read are in components/site/v3/V3OnDuty.view.ts.
     About fold proof stays people + firm + closings, not a method disclosure. */
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
    {
      type: 'itemList',
      name: 'Ryan Realty brokers',
      items: faces.map((face) => ({ name: face.name, url: face.href })),
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

        {/* SITE-90 fold: three broker Cards, Street View exterior,
            closings as a carousel. Never the sofa. */}
        <div className="about-fold">
          <AboutFaces
            people={faces}
            heading="About Ryan Realty · Bend"
            headingLevel={1}
            size="proof"
            eyebrow="Ryan Realty · Central Oregon"
            claim={firmBeat}
            proof={
              reviewSummary && reviewSummary.count > 0
                ? {
                    value: reviewAverage.toFixed(1),
                    count: reviewCount,
                    href: '/reviews',
                  }
                : undefined
            }
          />
          <figure className="about-fold__place">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/office/ryan-realty-bend-office-exterior-01.jpg"
              alt={`Ryan Realty at ${BRAND.address.street}, ${BRAND.address.city}`}
              width={640}
              height={640}
            />
            <figcaption>
              BEND OFFICE · {BRAND.address.street}
            </figcaption>
          </figure>
          <div className="about-fold__sales">
            {/* id="firm-sales" — FirmClosings mounts the carousel (page-purpose binds here). */}
            <FirmClosings rows={firmRows} />
          </div>
        </div>

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

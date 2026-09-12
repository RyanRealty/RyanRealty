/**
 * /about - brokerage profile, on the components/site/v3 barrel.
 *
 * PAGE OUTLINE (Looking brief, 2026-09-12 — reviews primary, no roster):
 * 1. Firm hero (H1, Bend office, who you call works your deal)
 * 2. Reviews as the primary proof band (V3Proof #proof, score face + words)
 * 3. Local closings (FirmClosings #firm-sales)
 * 4. Four-up CTA (V3Doors #reach)
 * 5. Who-you-work-with teaser → /team (photo + name only)
 * 6. Inquiry → /contact
 * 7. Atlas, origin Quiet, FAQ
 *
 * AboutFaces / three equal broker Cards / per-broker Call buttons stay off
 * this page. The roster lives on /team. layoutLock + page-purpose fail if
 * that roster comes back.
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
import { AboutFirmHero } from './_v3/AboutFirmHero'
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

        {/* id="firm" — AboutFirmHero mounts the landmark (page-purpose binds here). */}
        <AboutFirmHero
          heading="About Ryan Realty · Bend"
          eyebrow="Ryan Realty · Central Oregon"
          beat={firmBeat}
          office={{
            src: '/images/office/ryan-realty-bend-office-exterior-01.jpg',
            alt: `Ryan Realty at ${BRAND.address.street}, ${BRAND.address.city}`,
            caption: `BEND OFFICE · ${BRAND.address.street}`,
          }}
        />

        {quotes.length > 0 ? (
          <V3Proof
            id="proof"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewAverage.toFixed(1)} from ${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`The newest four of ${reviewCount} verified Google reviews, in full, exactly as they were written.`}
            figures={[]}
            quotes={quotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
            face
          />
        ) : null}

        {/* id="firm-sales" — FirmClosings mounts the carousel (page-purpose binds here). */}
        <FirmClosings rows={firmRows} />

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

        {/* id="who-you-work-with" — AboutTeamTeaser mounts the teaser (page-purpose binds here). */}
        <AboutTeamTeaser people={faces.map((face) => ({ name: face.name, src: face.src }))} />

        <V3Quiet
          id="inquiry"
          heading="Write the office"
          headingLevel={2}
          items={[
            {
              label: 'Send a question',
              href: '/contact',
              detail: 'The contact form reaches the brokerage. A broker writes back.',
              lead: true,
            },
          ]}
        />

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

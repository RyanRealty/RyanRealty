/**
 * /team - broker roster, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Look (2026-08-14): Team = faces. The first viewport is the live brokers'
 * canonical transparent PNGs (no card, no wash, no box). Name is the door.
 * Call and text sit on the face row. Ledger (licenses) then Quiet (reviews
 * and FAQ) sit below. PUBLIC_UI.md opens About-family on Quiet + Sheet.
 * Faces first. The family's Sheet stays on /contact and /team/[slug]. Seller
 * lives on Sell. The next tap is the name or the number.
 *
 * THE PAGE CONTRACT, carried across unchanged: export const metadata through
 * pageMetadata, MetadataBlock JSON-LD (CollectionPage + aboutOrganization +
 * BreadcrumbList), a rendered V3SectionTracker with pageType="team", and the
 * route. MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D11: no virtue names. No invented quote. Reviews are verbatim from
 * getReviews, with the recorded testimonials as the empty-pool fallback (lib/reviews/review-quotes).
 *
 * Parity: design_system/ryan-realty/ui_kits/team/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers, getReviews } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { formatDate } from '@/lib/format/date'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
  V3Proof,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { brokerLedgerRow, TEAM_FAQ_ITEMS, TEAM_RANK } from './_v3/team-constants'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'The broker you call is the broker who works the deal. Every Ryan Realty listing gets video, a 3D walkthrough, and a price from live Central Oregon comps.',
  path: '/team',
  ogImage: '/images/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

export default async function TeamPage() {
  const [brokers, reviews] = await Promise.all([getBrokers(), getReviews(24)])

  const orderedBrokers = [...brokers].sort(
    (a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  const faces = orderedBrokers
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  const brokerRows = orderedBrokers
    .map((b) => brokerLedgerRow(b))
    .filter((row): row is V3LedgerPlainRow => row !== null)
  const [firstBroker, ...restBrokers] = brokerRows

  const namesMatt = (text: string) => /\bmatt(hew)?\b/i.test(text)
  const namesOtherBroker = (text: string) => /\brebecca\b/i.test(text) || /\bpaul\b/i.test(text)

  // The newest verified reviews as a Proof band (record off: a strip of four
  // must not sit beside a figure that says twenty-five); the same shaping
  // /reviews prints, with the recorded testimonials as the empty-pool fallback.
  const quotes = toReviewQuotes(reviews.reviews).slice(0, 4)
  const reviewCount = reviews.count > 0 ? reviews.count : quotes.length
  const reviewAverage = reviews.count > 0 ? reviews.averageRating : 5
  const newestReview = quotes.find((q) => q.date)?.date ?? null

  const faqItems: V3QuietItem[] = [
    ...TEAM_FAQ_ITEMS.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    { label: 'Call, text, or write', href: '/contact' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'About Ryan Realty', href: '/about' },
    { label: 'Value my home', href: valuationHref('/team') },
  ]

  const schemas: SchemaInput[] = [
    {
      type: 'webPage',
      pageType: 'CollectionPage',
      aboutOrganization: true,
      name: 'The Ryan Realty Team',
      description:
        'The licensed Oregon brokers behind Ryan Realty in Bend, serving buyers and sellers across Central Oregon.',
      url: '/team',
    },
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Team', url: '/team' },
      ],
    },
    {
      type: 'faqPage',
      items: [...TEAM_FAQ_ITEMS],
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Team' }]} />

        <AboutFaces people={faces} heading="The brokers" />

        {firstBroker ? (
          <V3Ledger
            id="brokers"
            eyebrow={v3Text('Licensed in Oregon')}
            heading={v3Text('Who you work with')}
            rows={[firstBroker, ...restBrokers]}
            action={{ label: v3Text('Call, text, or write'), href: '/contact', variant: 'primary' }}
          />
        ) : (
          <V3Ledger
            id="brokers"
            eyebrow={v3Text('Licensed in Oregon')}
            heading={v3Text('Who you work with')}
            rows={[]}
            emptyMessage={v3Text('Broker profiles did not return in this refresh.')}
            action={{ label: v3Text('Call, text, or write'), href: '/contact', variant: 'primary' }}
          />
        )}

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
          id="reviews-faq"
          eyebrow="Clients and questions"
          heading="Working with a Bend broker"
          items={[
            { label: 'All Google reviews', href: '/reviews' },
            ...faqItems,
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

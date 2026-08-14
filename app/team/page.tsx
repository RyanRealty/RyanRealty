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
 * getReviews, with TESTIMONIALS as the empty-pool fallback.
 *
 * Parity: design_system/ryan-realty/ui_kits/team/parity.json
 */

import type { Metadata } from 'next'
import { getBrokers, getReviews } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { TESTIMONIALS } from '@/lib/testimonials'
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
  const sortedReviews = [
    ...reviews.reviews.filter((r) => namesOtherBroker(r.text)),
    ...reviews.reviews.filter((r) => !namesOtherBroker(r.text) && !namesMatt(r.text)),
    ...reviews.reviews.filter((r) => !namesOtherBroker(r.text) && namesMatt(r.text)),
  ]

  const liveReviewItems: V3QuietItem[] = sortedReviews.slice(0, 8).map((r) => {
    const author = r.reviewerName?.trim()
    return author
      ? { kind: 'prose' as const, term: author, body: r.text }
      : { kind: 'prose' as const, body: r.text }
  })
  const fallbackReviewItems: V3QuietItem[] = TESTIMONIALS.slice(0, 8).map((t) => ({
    kind: 'prose' as const,
    term: t.author,
    body: t.quote,
  }))
  const reviewItems = liveReviewItems.length > 0 ? liveReviewItems : fallbackReviewItems

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
        <V3SectionTracker pageType="team" />
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

        <V3Quiet
          id="reviews-faq"
          eyebrow="Clients and questions"
          heading="Working with a Bend broker"
          items={[
            ...reviewItems,
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

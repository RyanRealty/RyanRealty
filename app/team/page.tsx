/**
 * /team - broker roster, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * About-family destinations open on Quiet. This page is Quiet (who you work
 * with) then Ledger (the three brokers) then Quiet (reviews and FAQ). The
 * family's Sheet lives on /contact and /team/[slug]. Primary ask is /contact.
 *
 * THE PAGE CONTRACT, carried across unchanged: export const metadata through
 * pageMetadata, MetadataBlock JSON-LD (CollectionPage + aboutOrganization +
 * BreadcrumbList), a rendered KbSectionTracker with pageType="team", and the
 * route. MetadataBlock and KbSectionTracker stay on the non-v3 register
 * deliberately: both are wiring, neither is visual language.
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
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
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
        <KbSectionTracker pageType="team" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Team' }]} />

        <V3Quiet
          id="team"
          eyebrow="Ryan Realty · Bend, Oregon"
          heading="The brokers"
          headingLevel={1}
          items={[
            {
              kind: 'prose',
              body: 'The broker you first speak to is the broker who works your purchase or sale through to close. Call the number on their card. That is who answers.',
            },
            { label: 'Call, text, or write', href: '/contact' },
            { label: 'Client reviews', href: '/reviews' },
            { label: 'Value my home', href: valuationHref('/team') },
          ]}
        />

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

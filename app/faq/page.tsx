// @data-free
/**
 * /faq. Frequently asked questions for Ryan Realty (Bend, Central Oregon),
 * on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Three of the six patterns, no two adjacent alike: Quiet (every answer
 * visible) -> Sheet (the ask) -> Quiet (outbound edges).
 *
 * THE PAGE CONTRACT, carried across: export const metadata (title, description,
 * canonical, OpenGraph, Twitter), FAQPage JSON-LD through MetadataBlock, a
 * rendered V3SectionTracker with pageType="faq", and the route. Content is
 * still app/faq/data.ts, shared with /faq/[slug] and the GBP Q&A seed.
 *
 * DROPPED: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider, FaqAccordion
 * (Radix, answers were collapsed on first paint), the Talk to us / Latest
 * market report button row, the category TOC grid, per-question permalink
 * rows on the hub (each answer is already on this page; /faq/[slug] remains
 * for search citations and related-question doors). Category names stay as
 * Quiet terms above the questions in that group. The contact CTA is the Sheet.
 *
 * Answers stay in the HTML (V3Quiet prose), so crawler-visible text and the
 * FAQPage JSON-LD stay intact. Each answer still links to /faq/[slug].
 */

import type { Metadata } from 'next'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { valuationHref } from '@/lib/site/valuation-href'
import { getFaqGroupedByCategory } from './data'
import { FaqInquirySheet } from './_v3/FaqInquirySheet.client'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const faqOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'FAQ · Real estate in Bend, Oregon',
  description:
    'Neighborhoods we cover, first-time buying, listing cost, sale timelines, relocations, and how Ryan Realty works in Bend.',
  alternates: { canonical: `${siteUrl}/faq` },
  openGraph: {
    title: 'FAQ · Ryan Realty Bend',
    description:
      'Neighborhoods we cover, first-time buying, listing cost, sale timelines, relocations, and how we work in Bend.',
    url: `${siteUrl}/faq`,
    images: [{ url: faqOgImage, width: 1200, height: 630, alt: 'Ryan Realty FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [faqOgImage],
  },
}

export default async function FAQPage() {
  const grouped = getFaqGroupedByCategory()
  const allItems = grouped.flatMap((g) => g.items)

  const faqItems: V3QuietItem[] = []
  for (const group of grouped) {
    faqItems.push({
      kind: 'prose',
      term: group.cat,
      body: `${group.items.length} question${group.items.length === 1 ? '' : 's'}`,
    })
    for (const item of group.items) {
      faqItems.push({
        kind: 'prose',
        term: item.question,
        body: item.answer,
      })
    }
  }

  const schemas: SchemaInput[] = [
    { type: 'breadcrumb', items: [{ name: 'Home', url: '/' }, { name: 'FAQ', url: '/faq' }] },
    {
      type: 'faqPage',
      items: allItems.map((item) => ({ question: item.question, answer: item.answer })),
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="faq" />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]} />

        <V3Quiet
          id="faq"
          heading="Central Oregon real estate FAQ"
          headingLevel={1}
          eyebrow="Bend and the towns around it"
          items={faqItems}
        />

        <FaqInquirySheet />

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: 'Central Oregon housing market', href: '/housing-market' },
            { label: 'Market report index', href: '/housing-market/reports' },
            { label: 'Value my home', href: valuationHref('/faq') },
            { label: 'Contact Ryan Realty', href: '/contact' },
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

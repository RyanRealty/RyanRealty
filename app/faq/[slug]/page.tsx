// @no-parity — no standalone mockup; reuses the FAQ hub's v3 Quiet + Sheet.
// @data-free
/**
 * /faq/[slug]. Standalone, indexable page for a single Ryan Realty FAQ answer,
 * on the components/site/v3 barrel.
 *
 * WHY THIS ROUTE EXISTS: the /faq hub bundles every question into one long
 * page. A search result, a Google featured snippet, or an AI answer engine
 * can only cite the hub's URL, never a single question. This route gives
 * each question its own canonical URL, its own H1, and its own
 * single-question FAQPage JSON-LD.
 *
 * Content is NOT duplicated. app/faq/data.ts is the single canonical source
 * for both this route and app/faq/page.tsx. Marked @data-free for
 * scripts/check-page-dal.mjs: every FAQ answer is a static in-repo array.
 *
 * generateStaticParams + dynamicParams = false: the FAQ list is a fixed,
 * small, code-owned set, so every /faq/[slug] page is fully static (SSG) at
 * build time. A slug outside the known set 404s.
 *
 * DROPPED: KbBreadcrumb, KbFooter, SmoothScrollProvider, the Talk to us /
 * Latest market report button row, the related-question card grid. Related
 * questions are a Ledger. The ask is the same Sheet the hub uses.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { valuationHref } from '@/lib/site/valuation-href'
import { getFaqBySlug, getFaqSlugs, getRelatedFaq } from '../data'
import { FaqInquirySheet } from '../_v3/FaqInquirySheet.client'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams(): Array<{ slug: string }> {
  return getFaqSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = getFaqBySlug(slug)
  if (!item) notFound()

  return pageMetadata({
    title: `${item.question} | Central Oregon FAQ`,
    description: item.answer,
    path: `/faq/${slug}`,
  })
}

export default async function FaqAnswerPage({ params }: Props) {
  const { slug } = await params
  const item = getFaqBySlug(slug)
  if (!item) notFound()

  const related = getRelatedFaq(item, 3)
  const categoryAnchor = item.category.toLowerCase().replace(/\s+/g, '-')

  const relatedRows: V3LedgerPlainRow[] = []
  for (const row of related) {
    const question = row.question?.trim()
    const id = row.id?.trim()
    if (!question || !id) continue
    relatedRows.push({
      href: `/faq/${id}`,
      when: v3Text(row.category),
      what: v3Text(question),
      id,
    })
  }
  const [firstRelated, ...restRelated] = relatedRows

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'FAQ', url: '/faq' },
        { name: item.question, url: `/faq/${slug}` },
      ],
    },
    { type: 'faqPage', items: [{ question: item.question, answer: item.answer }] },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'FAQ', href: '/faq' },
            { label: item.category, href: `/faq#${categoryAnchor}` },
            { label: item.question },
          ]}
        />

        <V3Quiet
          id="faq-answer"
          heading={item.question}
          headingLevel={1}
          eyebrow={`${item.category} · Central Oregon FAQ`}
          items={[{ kind: 'prose', body: item.answer }]}
        />

        {firstRelated ? (
          <V3Ledger
            id="related"
            eyebrow={v3Text('Keep reading')}
            heading={v3Text('Related questions')}
            rows={[firstRelated, ...restRelated]}
            action={{ label: v3Text('All frequently asked questions'), href: '/faq' }}
          />
        ) : null}

        <FaqInquirySheet />

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: 'All frequently asked questions', href: '/faq' },
            { label: 'Central Oregon housing market', href: '/housing-market' },
            { label: 'Market report index', href: '/housing-market/reports' },
            { label: 'Value my home', href: valuationHref(`/faq/${slug}`) },
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

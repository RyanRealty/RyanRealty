// @no-parity — no standalone mockup; reuses the KB section library and the
// app/blog/[slug]/page.tsx + app/parks/[slug]/page.tsx article/detail pattern.
// @data-free
/**
 * /faq/[slug]. Standalone, indexable page for a single Ryan Realty FAQ answer.
 *
 * WHY THIS ROUTE EXISTS: the /faq hub bundles every question into one long
 * page. A search result, a Google featured snippet, or an AI answer engine
 * can only cite the hub's URL, never a single question. This route gives
 * each question its own canonical URL, its own H1, and its own
 * single-question FAQPage JSON-LD, so an individual answer can rank and be
 * cited on its own (task: audit item 15, part (b)).
 *
 * Content is NOT duplicated. app/faq/data.ts is the single canonical source
 * for both this route and app/faq/page.tsx (the hub). Marked @data-free for
 * scripts/check-page-dal.mjs: every FAQ answer is a static in-repo array,
 * there is no Supabase read on this route.
 *
 * KB (kinetic-brutalist) design, matching the rest of the migrated site:
 * KbNav (solid, no hero photo, same treatment as a blog post), KbBreadcrumb,
 * SmoothScrollProvider, KbFooter. Layout follows the article template used by
 * app/blog/[slug]/page.tsx (header + prose body + related items + CTA), scaled
 * down for a single answer instead of a full article. Styling is Tailwind
 * classes plus inline style objects (CSSProperties), the same approach the
 * blog detail page uses, not a raw CSS <style> block.
 *
 * generateStaticParams + dynamicParams = false: the FAQ list is a fixed,
 * small, code-owned set, so every /faq/[slug] page is fully static (SSG) at
 * build time. No revalidate needed. A slug outside the known set 404s.
 */

import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { getFaqBySlug, getFaqSlugs, getRelatedFaq } from '../data'
import '@/components/site/kb/kb.css'

// KB tokens (all from kb.css) as inline style values, matching
// app/blog/[slug]/page.tsx. Keeps the page on the brand palette without raw
// hex or off-ladder Tailwind arbitrary utilities.
const NAVY = 'var(--navy)'
const NAVY_70 = 'var(--navy-70)'
const NAVY_12 = 'var(--navy-12)'
const CREAM = 'var(--cream)'
const EDGE_NAVY = 'var(--edge) solid var(--navy)'

const eyebrowStyle: CSSProperties = { color: NAVY_70 }
const catCardStyle: CSSProperties = { borderColor: NAVY_12, background: CREAM }
const catLabelStyle: CSSProperties = { color: NAVY_70 }

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
    <main className="kb-root">
      {/* solid: this route has no hero photo, the same treatment as a blog article */}
      <KbSectionTracker pageType="faq_answer" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        belowNav
        trail={[{ label: 'Home', href: '/' }, { label: 'FAQ', href: '/faq' }, { label: item.category, href: `/faq#${categoryAnchor}` }]}
      />

      <SmoothScrollProvider>
        <section className="section" id="faq-answer" aria-label={item.question}>
          <div className="wrap">
            <article className="mx-auto w-full pb-4 pt-12" style={{ color: NAVY, maxWidth: 880 }}>
              <span
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase"
                style={{ ...eyebrowStyle, letterSpacing: '.14em' }}
              >
                {item.category} · Central Oregon FAQ
              </span>

              <h1
                className="display mt-4"
                style={{ fontSize: 'clamp(2.1rem,5.6vw,3.8rem)', lineHeight: 0.98, letterSpacing: '-.01em', maxWidth: '22ch' }}
              >
                {item.question}
              </h1>

              <p
                className="mt-6 max-w-prose font-medium"
                style={{ fontSize: 'clamp(1.02rem,1.6vw,1.2rem)', lineHeight: 1.6, color: NAVY_70 }}
              >
                {item.answer}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 pb-2">
                <Link href="/contact" className="btn alt">
                  Talk to us <span className="arr">→</span>
                </Link>
                <Link
                  href="/housing-market/reports"
                  className="btn alt"
                  style={{ background: 'transparent', color: NAVY }}
                >
                  Latest market report <span className="arr">→</span>
                </Link>
              </div>
            </article>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="section" id="related" aria-label="Related questions">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Keep reading</span>
                <h2 className="sec-title display">Related questions</h2>
              </div>
              <ul
                className="mt-8 grid grid-cols-1 border-l border-t sm:grid-cols-3"
                style={{ borderColor: NAVY_12, listStyle: 'none' }}
              >
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/faq/${r.id}`}
                      className="group flex h-full flex-col gap-2.5 p-6 transition-colors"
                      style={catCardStyle}
                    >
                      <span
                        className="text-xs font-semibold uppercase transition-colors"
                        style={{ ...catLabelStyle, letterSpacing: '.1em' }}
                      >
                        {r.category}
                      </span>
                      <span className="text-base font-semibold leading-snug" style={{ color: NAVY }}>
                        {r.question}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6">
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-2 pb-0.5 text-sm font-semibold"
                  style={{ color: NAVY, borderBottom: `1px solid ${NAVY_12}` }}
                >
                  All frequently asked questions <span className="arr">→</span>
                </Link>
              </p>
            </div>
          </section>
        ) : (
          <section className="section" id="back-to-faq" aria-label="All FAQs">
            <div className="wrap" style={{ borderTop: `1px solid ${NAVY_12}`, paddingTop: '24px' }}>
              <p>
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-2 pb-0.5 text-sm font-semibold"
                  style={{ color: NAVY, borderBottom: `1px solid ${NAVY_12}` }}
                >
                  All frequently asked questions <span className="arr">→</span>
                </Link>
              </p>
            </div>
          </section>
        )}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

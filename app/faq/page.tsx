/**
 * /faq. Frequently asked questions for Ryan Realty (Bend, Central Oregon).
 *
 * KB (kinetic-brutalist) design, Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + shadcn Card layout. Every piece of
 * content is preserved:
 *   - Every FAQ entry (question + answer + category + anchor id). The
 *     canonical source is app/faq/data.ts, shared with app/faq/[slug]/page.tsx
 *     and the GBP Q&A seed.
 *   - The FAQPage JSON-LD schema (Gemini Ask Maps + Google featured snippets),
 *     now built through the shared MetadataBlock/buildJsonLd helper instead of
 *     a hand-rolled script tag, matching every other detail page on the site.
 *   - The category table-of-contents (Neighborhoods / Buying / Selling /
 *     Working with us) with per-category counts and in-page anchors.
 *   - The grouped FaqAccordion sections (Radix accordions, answers stay
 *     mounted in the DOM so crawler-visible answer text and the JSON-LD stay
 *     intact). Each answer now also links to its own standalone /faq/[slug]
 *     page.
 *   - The hero copy + both CTAs (Talk to us / Latest market report).
 *   - The "Have a question we did not cover?" contact CTA card.
 *
 * Only the presentation changed, the page wears the KB shell (KbNav, KbHero,
 * KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia display
 * / hard-edge cream surfaces of the rest of the migrated site.
 *
 * dynamic = 'force-dynamic' removed 2026-08-03. The FUB session/cookie reads
 * it was pinned for were already deleted with the FUB decommission
 * (2026-06-24), and every FAQ answer is a static in-repo array with zero DB
 * or request-scoped reads. Nothing here needs to run per-request, so the page
 * is now fully static (SSG). Faster, CDN-cacheable, and the correct default
 * for an SEO page.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved. JSON-LD
 * preserved (breadcrumb + FAQPage). PAGE CONTRACT: KB design + SEO + tracking
 * (KbSectionTracker pageType="faq").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { FaqAccordion } from './FaqAccordion'
import { getFaqGroupedByCategory } from './data'
import '@/components/site/kb/kb.css'

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
  // Group for the table-of-contents. Content itself lives in app/faq/data.ts,
  // shared verbatim with the standalone /faq/[slug] pages.
  const grouped = getFaqGroupedByCategory()

  const schemas: SchemaInput[] = [
    { type: 'breadcrumb', items: [{ name: 'Home', url: '/' }, { name: 'FAQ', url: '/faq' }] },
    {
      type: 'faqPage',
      items: grouped.flatMap((g) => g.items).map((item) => ({ question: item.question, answer: item.answer })),
    },
  ]

  return (
    <main className="kb-root">
      <KbSectionTracker pageType="faq" />
      {/* Breadcrumb + FAQPage JSON-LD for Gemini Ask Maps + Google featured snippets */}
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'FAQ' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle + CTAs as the prior ContentPageHero, in the
            KB Amboqia display. The two CTAs (Talk to us / Latest market report)
            are preserved in the CTA row below the hero. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Bend real estate"
          titleTop="Frequently asked"
          titleBottom="questions"
          lead="Neighborhoods we cover, first-time buying, listing cost, sale timelines, relocations, and how we work."
          videoSrc={null}
          posterSrc="/images/homepage/smith-rock-terrebonne.jpg"
          showSearch={false}
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="faq-cta" aria-label="Talk to us">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href="/contact" className="btn alt">
                Talk to us <span className="arr">→</span>
              </Link>
              <Link
                href="/housing-market/reports"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Latest market report <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Category table-of-contents — anchor links into each grouped section,
            with the per-category count preserved. */}
        <section className="section" id="faq-toc" aria-label="Jump to a category">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Four topics</span>
              <h2 className="sec-title display">Neighborhoods, buying,<br />selling, working with us</h2>
            </div>
            <nav
              className="grid grid-cols-2 gap-0 border-t border-l sm:grid-cols-4"
              style={{ borderColor: 'var(--navy)', borderTopWidth: 'var(--edge)', borderLeftWidth: 'var(--edge)', marginTop: '28px' }}
              aria-label="FAQ categories"
            >
              {grouped.map((g) => (
                <a
                  key={g.cat}
                  href={`#${g.cat.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex items-baseline justify-between gap-3 p-5 transition-colors hover:bg-[color:var(--navy)] hover:text-[color:var(--cream)]"
                  style={{ borderColor: 'var(--navy)', borderRightWidth: 'var(--edge)', borderBottomWidth: 'var(--edge)' }}
                >
                  <span className="font-display text-lg leading-none">{g.cat}</span>
                  <span className="mono-num text-sm" style={{ opacity: 0.7 }}>({g.items.length})</span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Grouped accordions — every FAQ entry rendered. Radix keeps answers
            mounted, so the FAQPage JSON-LD and crawler-visible text are intact. */}
        {grouped.map((g) => (
          <section
            key={g.cat}
            id={g.cat.toLowerCase().replace(/\s+/g, '-')}
            className="section"
            aria-label={`${g.cat} questions`}
            style={{ scrollMarginTop: '96px' }}
          >
            <div className="wrap">
              <div className="sec-head">
                {/* design-audit #136: eyebrow + title both repeated the same
                    category name, a full viewport-scale heading for as few as
                    2 questions. Eyebrow now carries real information instead. */}
                <span className="sec-index">{g.items.length} question{g.items.length === 1 ? '' : 's'}</span>
                {/* design-audit: the full 3.6rem .sec-title pushed right by the
                    flex space-between overpowered a 2-4 question group. Scale the
                    per-category header down so it introduces, not dominates. */}
                <h2 className="sec-title display" style={{ fontSize: 'clamp(1.5rem,3.4vw,2.3rem)' }}>{g.cat}</h2>
              </div>
              <div className="pt-2">
                <FaqAccordion items={g.items} />
              </div>
            </div>
          </section>
        ))}

        {/* "Have a question we did not cover?" contact CTA — preserved. */}
        <section className="section" id="faq-contact" aria-label="Still have a question">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Still have a question</span>
              <h2 className="sec-title display">Did we miss<br />your question?</h2>
            </div>
            <div className="max-w-2xl pt-6">
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.55 }}>
                Send us your question and we will answer it.
              </p>
              <div className="sec-cta">
                <Link href="/contact" className="btn alt">
                  Contact Ryan Realty <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

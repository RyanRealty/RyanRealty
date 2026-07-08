/**
 * /faq — Frequently asked questions for Ryan Realty (Bend, Central Oregon).
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + shadcn Card layout. Every piece of
 * content is preserved:
 *   - All 10 FAQ entries (question + answer + category + anchor id) — the
 *     canonical source for the page, the FAQPage JSON-LD, and the GBP Q&A seed.
 *   - The FAQPage JSON-LD schema (Gemini Ask Maps + Google featured snippets).
 *   - The category table-of-contents (Neighborhoods / Buying / Selling /
 *     Working with us) with per-category counts and in-page anchors.
 *   - The grouped FaqAccordion sections (Radix accordions; answers stay mounted
 *     in the DOM so crawler-visible answer text and the JSON-LD stay intact).
 *   - The hero copy + both CTAs (Talk to us / Latest market report).
 *   - The "Have a question we did not cover?" contact CTA card.
 *   - The session + FUB page-view tracking side-effect.
 *
 * Only the presentation changed — the page now wears the KB shell (KbNav,
 * KbHero, KbFooter, SmoothScrollProvider, KbSectionTracker) and the Amboqia
 * display / hard-edge cream surfaces of the rest of the migrated site.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved. JSON-LD
 * preserved. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="info").
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { FaqAccordion } from './FaqAccordion'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const faqOgImage = `${siteUrl}/api/og?type=default`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FAQ — Real Estate in Bend, Oregon',
  description:
    "Honest answers to the questions Bend buyers and sellers ask Ryan Realty every week. Neighborhoods, timelines, market conditions, working with a brokerage.",
  alternates: { canonical: `${siteUrl}/faq` },
  openGraph: {
    title: 'FAQ — Ryan Realty Bend',
    description:
      'Honest, direct answers to the most common questions about buying and selling real estate in Bend, Oregon.',
    url: `${siteUrl}/faq`,
    images: [{ url: faqOgImage, width: 1200, height: 630, alt: 'Ryan Realty FAQ' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [faqOgImage],
  },
}

// ---------------------------------------------------------------------------
// FAQ content. This is the canonical source for:
//   - the /faq page itself
//   - the JSON-LD FAQPage schema (read by Gemini "Ask Maps", Google Search
//     featured snippets, and AI-driven local discovery surfaces)
//   - the GBP Q&A seed when posted via the UI runbook
// Brand voice: §0.7 CLAUDE.md (no em-dashes, no semicolons, no banned words).
// ---------------------------------------------------------------------------

interface FAQItem {
  question: string
  answer: string
  // Optional anchor + category for the on-page index
  id: string
  category: 'Neighborhoods' | 'Buying' | 'Selling' | 'Working with us'
}

const FAQ: FAQItem[] = [
  {
    id: 'bend-neighborhoods',
    category: 'Neighborhoods',
    question: 'Do you specialize in any particular Bend neighborhoods?',
    answer:
      "We work the full Central Oregon region and spend the most time in Bend's named neighborhoods. Old Mill, Northwest Crossing, Tetherow, Broken Top, Awbrey Butte, Tumalo, and Vandevert Ranch are where we have the most active comp knowledge and the most relationships. Outside of Bend itself, Sisters, Redmond, Sunriver, and Crooked River Ranch are in our regular service area. Tell us the neighborhood and the budget and we will be honest about whether we are the right team for that pocket.",
  },
  {
    id: 'first-time-buyers',
    category: 'Buying',
    question: 'Do you work with first-time home buyers in Central Oregon?',
    answer:
      "Yes. A meaningful share of our business is first-time buyers, and we like that work. The Bend market can be intimidating for someone who has never bought before, so we walk you through the entire process at a pace that makes sense for you. We are direct about what you can and cannot get at your budget. We never push you toward a stretch you will regret.",
  },
  {
    // Design-audit (copy-clarity): the number-one seller question was missing
    // from the sitewide FAQ while /sell answered it — a seller researching
    // fees found nothing here and could read that as hiding the answer.
    // Answer mirrors the /sell FAQ verbatim (§0: one answer, one place edited).
    id: 'cost-to-list',
    category: 'Selling',
    question: 'What does it cost to list with you?',
    answer:
      'One plan at 3% of the sale price, with no add-on fees. That covers photography, the MLS listing, the full marketing plan, every showing, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer under the current rules. Commission is negotiable and every listing agreement is its own conversation.',
  },
  {
    id: 'timeline-selling',
    category: 'Selling',
    question: "What is the typical timeline for selling a home in Bend right now?",
    answer:
      "It depends on the price band and the neighborhood. A well-priced single-family home in Bend's $500K to $700K range tends to go pending in two to four weeks. Homes priced over $1M can take longer if the property has a narrower buyer pool. We pull live comps for your specific neighborhood and price band before we list, and we tell you what to expect. The unpredictable side of the market is one reason we stay close to the data.",
  },
  {
    id: 'investment',
    category: 'Buying',
    question: 'Do you have brokers who specialize in investment or second-home properties?',
    answer:
      'Yes. We work with second-home buyers across Bend, Sunriver, Vandevert Ranch, Crooked River Ranch, and the Cascade resort communities. We also work with investor clients looking at long-term holds, value-add opportunities, and 1031 exchanges. We do not manage rental properties for clients, but we have working relationships with reputable property managers in town and we can introduce you.',
  },
  {
    id: 'relocations',
    category: 'Buying',
    question: 'Can you help with relocations from out of state?',
    answer:
      'Yes. A large share of our business is relocations into Central Oregon from California, Washington, Colorado, and the Midwest. We do virtual tours, custom market reports for the neighborhoods you are considering, and we coordinate with lenders and title teams to make a long-distance close work smoothly. The conversation about what Bend is actually like, traffic, snow, wildfire risk, cost of living, happens before you make an offer, not after.',
  },
  {
    id: 'expired-listing',
    category: 'Selling',
    question: 'Do you work with sellers whose home did not sell with another agent?',
    answer:
      'Yes, and we take that work seriously. If your listing expired or you withdrew, we start with an honest audit of what happened. We look at pricing, presentation, photography, marketing reach, and feedback from the original showings. Then we put together a re-launch plan only if we believe it actually has a strong chance to perform. If we do not think we can do better, we will tell you.',
  },
  {
    id: 'service-area',
    category: 'Neighborhoods',
    question: 'What areas outside of Bend do you cover?',
    answer:
      'Our service area covers Bend, Tumalo, Redmond, Sisters, Sunriver, Tetherow, La Pine, Prineville, Terrebonne, Eagle Crest, Crooked River Ranch, Seventh Mountain, and Deschutes River Woods. We can take on work in the broader Central Oregon area when the fit makes sense. If your property is far outside our area of competency, we will refer you to a broker who knows that pocket of the market.',
  },
  {
    id: 'new-construction',
    category: 'Buying',
    question: 'Do you handle new construction or only resale homes?',
    answer:
      "Both. We represent buyers on new construction throughout Bend and Redmond, including walking the floor plans, reviewing builder contracts, negotiating upgrades, and managing inspections at key construction milestones. We also list resale homes across all of Central Oregon. If you are considering new construction, talk to us before you visit the model homes. The builder's onsite representative works for the builder, not for you.",
  },
  {
    id: 'market-report',
    category: 'Working with us',
    question: 'Is there a market report you publish regularly?',
    answer:
      'Yes. We publish a monthly Central Oregon market report covering Bend, Redmond, Sisters, Sunriver, and the resort communities. The report includes median price, days on market, months of supply by neighborhood, and a short narrative on what the data is telling us. You can find the current report on our market page or ask us to email it to you.',
  },
  {
    id: 'availability',
    category: 'Working with us',
    question: 'Are you available evenings and weekends for showings?',
    answer:
      'Yes. Bend buyers and sellers do most of their thinking outside of standard business hours, and we work the schedule you need. We routinely run showings on weekday evenings and Saturdays and Sundays. Just tell us what works for you and we will make it happen.',
  },
]

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export default async function FAQPage() {
  try {
    const [session, fubPersonId] = await Promise.all([
      getSession().catch(() => null),
      getFubPersonIdFromCookie().catch(() => null),
    ])
    const pageUrl = `${getCanonicalSiteUrl()}/faq`
    const pageTitle = 'FAQ | Ryan Realty Bend'
    trackPageViewIfPossible({
      sessionUser: session?.user ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      pageUrl,
      pageTitle,
    })
  } catch (err) {
    console.error('[FAQPage]', err)
  }

  // Group for the table-of-contents
  const categories: FAQItem['category'][] = ['Neighborhoods', 'Buying', 'Selling', 'Working with us']
  const grouped = categories.map((cat) => ({
    cat,
    items: FAQ.filter((f) => f.category === cat),
  }))

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="info" />
      {/* JSON-LD FAQPage schema for Gemini Ask Maps + Google Search featured snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
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
          eyebrow="Central Oregon · Buyer & seller questions"
          titleTop="Frequently asked"
          titleBottom="questions"
          lead="Honest answers to the questions Bend buyers and sellers ask us every week."
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
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
              <span className="sec-index">Browse by topic</span>
              <h2 className="sec-title display">What buyers and<br />sellers ask</h2>
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
                <span className="sec-index">{g.cat}</span>
                <h2 className="sec-title display">{g.cat}</h2>
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
                Reach out and we will give you a direct answer. No pitch, no pressure.
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

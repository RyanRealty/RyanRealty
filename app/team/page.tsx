/**
 * Team index (/team) — KB (kinetic-brutalist) design, Phase 9 of the
 * convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Reuses the SAME section
 * library as the homepage + city/community pages (components/site/kb/*), fed the
 * team DAL, never forked (ci:kb-single-source G50). KbNav + KbFooter carry the
 * chrome (default chrome hidden for /team via HideChrome — handled by the
 * orchestrator, not this file).
 *
 * THE PAGE CONTRACT: KB design + SEO (export const metadata + MetadataBlock
 * JSON-LD: CollectionPage/Breadcrumb) + tracking (KbSectionTracker pageType="team").
 * Every broker figure comes from getBrokers() (§0 — no fabricated stats).
 *
 * Section stack: nav · breadcrumb · hero · about · testimonials · team grid ·
 * sell · faq · footer.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/team/parity.json (KB set).
 *
 * NOTE — HideChrome: this page needs the default site header/footer suppressed so
 * KbNav and KbFooter can carry the chrome. That requires a HideChrome wrapper in
 * app/layout.tsx or a route-group layout. The orchestrator handles this; this file
 * does not touch layout components.
 */

import type { Metadata } from 'next'
import { getBrokers } from '@/lib/data/brokers/getBrokers'
import { getReviews } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbReview } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import { CONTACT } from '@/lib/brand/contact'
import '@/components/site/kb/kb.css'

export const metadata: Metadata = pageMetadata({
  title: 'Our team · Ryan Realty, Bend Oregon',
  description:
    'Work directly with a Ryan Realty broker in Bend, Oregon. Cinematic video, 3D tours, and data-backed pricing on every Central Oregon listing, from first call to closing.',
  path: '/team',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'Ryan Realty team',
    'Bend Oregon real estate brokers',
    'Matt Ryan',
    'Central Oregon broker',
  ],
})

// Agent-choice intent FAQ ("bend oregon realtor", "bend real estate agent" —
// target-query benchmark 2026-06-10). Restored in the KB migration via the
// shared FAQBlock (which also emits its own FAQPage JSON-LD), same pattern as
// the community KB page. DATA ACCURACY (§0): every answer reuses facts already
// approved on live /team and /about copy. No new claims.
const TEAM_FAQ_ITEMS = [
  {
    question: 'What does working directly with a broker mean?',
    answer:
      'You work with one broker from the first call to the closing table. There is no hand-off to a junior agent or a transaction desk, and the broker who prices your home is the one who answers your calls.',
  },
  {
    question: 'What does my listing get?',
    answer:
      'Every Ryan Realty listing gets cinematic video, a 3D walkthrough, and a price built from live Central Oregon market data. The same treatment at every price point.',
  },
  {
    question: 'Which areas do Ryan Realty brokers cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, and Terrebonne, plus the resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch.',
  },
  {
    question: 'How do I start?',
    answer: `Call ${CONTACT.phoneDirect} or schedule a time through the contact page. You talk directly with a broker, not a call center.`,
  },
] as const

export default async function TeamPage() {
  const [brokers, reviews] = await Promise.all([
    getBrokers(),
    getReviews(8),
  ])

  // Display order locked to Matt, Rebecca, Paul (Matt directive). Rank by first
  // name so it holds regardless of the DB sort_order.
  const RANK: Record<string, number> = { matt: 0, matthew: 0, rebecca: 1, paul: 2 }
  const orderedBrokers = [...brokers].sort(
    (a, b) => (RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (RANK[b.slug.split('-')[0] ?? ''] ?? 9),
  )

  // Verified-credential ledger for the KbAbout block. The KB team grid (KbTeam)
  // shows only name/role/photo; the old /team index also surfaced each broker's
  // Oregon license number. Restore that trust credential here, straight from
  // getBrokers() (§0 — verified data only, no invented stats). Renders the
  // broker name + title as the label and the licensed OR number as the value.
  const brokerFacts = orderedBrokers
    .filter((b) => b.licenseNumber)
    .map((b) => ({
      label: `${b.fullName} · ${b.title}`,
      value: `OR ${b.licenseNumber}`,
    }))

  // Map the live reviews pool to KbReview shape for KbTestimonials.
  const kbReviews: KbReview[] = reviews.reviews.map((r) => ({
    quote: r.text,
    author: r.reviewerName ?? 'Verified Ryan Realty client',
  }))

  // Fall back to TESTIMONIALS when the live pool is empty (e.g. DB cold start).
  const testimonialsToShow: KbReview[] =
    kbReviews.length > 0
      ? kbReviews.slice(0, 8)
      : TESTIMONIALS.slice(0, 8).map((t) => ({ quote: t.quote, author: t.author }))

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="team" />
      <MetadataBlock
        schemas={[
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
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Team' }]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: null,
            medianListPrice: null,
            medianDaysToPending: null,
          }}
          eyebrow="Ryan Realty · Bend, Oregon"
          titleTop="The broker you call"
          titleBottom="is the broker you get."
          lead="No hand-offs, no transaction desk, no junior agent learning on your deal."
          videoSrc={null}
          posterSrc="/brand/hero/hero-old-mill-master-4k.jpg"
        />
        <KbAbout
          eyebrow="The team"
          heading="Work with the broker who lists your home"
          paragraphs={[
            'You work directly with the same broker from the first conversation to the closing table. No hand-offs to a junior agent, no transaction desk.',
            'Call any broker directly using the number on their card. The broker who prices your home is the one who answers your calls.',
          ]}
          facts={brokerFacts}
        />
        <KbTestimonials reviews={testimonialsToShow} />
        <KbTeam />
        <KbSell
          data={{
            medianListPrice: null,
            medianDaysToPending: null,
            soldCount30d: null,
          }}
        />
        <section id="faq" aria-label="Working with a Bend broker — common questions">
          <FAQBlock
            eyebrow="Choosing a broker"
            title="Working with a Bend broker"
            items={TEAM_FAQ_ITEMS}
            tone="default"
          />
        </section>
        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

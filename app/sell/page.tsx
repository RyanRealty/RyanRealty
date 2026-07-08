/**
 * Sell page (/sell) — KB (kinetic-brutalist) design, Phase 9 of the KB
 * convergence program (docs/KB_CONVERGENCE_ROADMAP.md). Restyled in place:
 * every section, DAL call, FAQ item, internal link, and the #marketing-plan
 * anchor from the prior Wave 3 build is preserved. KB shell (KbNav + KbFooter)
 * carries the chrome; the existing seller sections render inside .kb-root with
 * design-system tokens.
 *
 * Composed from @/components/site/* blocks + @/lib/data DAL. No legacy
 * components/layout/* or components/broker/* or CMS getPageContent.
 *
 * DATA ACCURACY (CLAUDE.md §0): the value props describe real capabilities
 * (live market data, a local licensed broker, a CMA with comparable sales,
 * one broker start-to-finish). NO invented results, "results you can verify"
 * claims, sale-percentages, or days-to-sell stats (D99). The current-market
 * line is live getMarketPulse data for Bend, classified by the canonical
 * months-of-supply thresholds. The lead path is the existing
 * /lp/seller-home-value LP, which captures the lead and triggers the FUB
 * seller workflow. This page has no form of its own.
 *
 * Section stack: KbNav · MetadataBlock (Service/Breadcrumb/FAQPage JSON-LD) ·
 *   KbBreadcrumb · KbHero · SellValueProps · SellProcess · SellMarketingPlan ·
 *   SellCommission · SellMarketContext · LifestyleStrip · SellValuationCTA ·
 *   CTABar · FAQBlock · KbFooter. (The "How it works" ContentSection was
 *   removed 2026-07 — a word-for-word duplicate of SellProcess, design-audit P2.)
 *
 * Parity contract: design_system/ryan-realty/ui_kits/sell/parity.json (KB set).
 */

import type { Metadata } from 'next'
import { getMarketPulse, getSurfaceImage, getLifestyleImages } from '@/lib/data'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { LifestyleStrip } from '@/components/site/LifestyleStrip'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { SellValueProps } from '@/components/site/sell/SellValueProps'
import { SellProcess } from '@/components/site/sell/SellProcess'
import { SellMarketingPlan } from '@/components/site/sell/SellMarketingPlan'
import { SellCommission } from '@/components/site/sell/SellCommission'
import { SellValuationCTA } from '@/components/site/sell/SellValuationCTA'
import { SellMarketContext } from '@/components/site/sell/SellMarketContext'
import { CONTACT } from '@/lib/brand/contact'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 300

const ROUTE_PATH = '/sell'
const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Sell your home · Ryan Realty, Central Oregon',
    description:
      'List your Central Oregon home with Ryan Realty. Pricing from live market data, professional marketing, and one broker from valuation to close. Request a free home valuation.',
    path: ROUTE_PATH,
    ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
    keywords: [
      'sell home Bend Oregon',
      'Central Oregon home valuation',
      'list home Bend',
      'Ryan Realty seller',
    ],
  })
}

const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a listing agreement to get the CMA?',
    answer:
      'No. The comparative market analysis is free and requires no contract. If you decide to list with us after reading it, that is a separate signed agreement.',
  },
  {
    question: 'What does it cost to list with you?',
    answer:
      'One plan at 3% of the sale price, with no add-on fees. That covers photography, the MLS listing, the full marketing plan, every showing, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer under the current rules. Commission is negotiable and every listing agreement is its own conversation.',
  },
  {
    question: 'How do you decide on a list price?',
    answer:
      'We use recent comparable sales and current active inventory in your area, the same market data shown across this site. You see the three closed comps and three active comps we base the range on.',
  },
  {
    question: 'How long does it take to get listed?',
    answer:
      'From a signed agreement to live on MLS is typically 5 to 7 business days. Professional photos within 48 hours. MLS description and pricing locked the day after photos return.',
  },
  {
    question: 'Will I work with the same broker the whole time?',
    answer:
      'Yes. The broker who lists your home is the broker who markets, negotiates, and closes it. Ryan Realty does not use a hand-off model.',
  },
  {
    question: 'What if my home is in a resort community with very few sales?',
    answer:
      'For slow-turnover areas like Pronghorn, Crosswater, Black Butte Ranch, or Vandevert Ranch, we expand the comp window to 12 or 24 months and tell you exactly which comps were stretched and why.',
  },
  {
    question: 'What areas do you list homes in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding communities.',
  },
] as const

export default async function SellPage() {
  const [pulse, heroSrc, lifestyleImages] = await Promise.all([
    withTimeoutFallback(
      getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
      null,
      3500,
      'sell:pulse',
    ),
    // Distinct approved hero so /sell does not reuse the homepage Old Mill banner.
    withTimeoutFallback(
      getSurfaceImage('hero', {
        geoTags: ['central-oregon'],
        seed: ROUTE_PATH,
        fallback: OLD_MILL_HERO,
      }),
      OLD_MILL_HERO,
      3500,
      'sell:hero',
    ),
    withTimeoutFallback(getLifestyleImages(8), [], 3000, 'sell:lifestyle'),
  ])

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="sell" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Sell', url: '/sell' },
            ],
          },
          { type: 'faqPage', items: FAQ_ITEMS },
        ]}
      />
      <KbBreadcrumb
        overlay
        trail={[{ label: 'Home', href: '/' }, { label: 'Sell' }]}
      />

      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Sell with Ryan Realty"
          titleTop="Selling your home,"
          titleBottom="done honestly."
          lead="in Bend. The broker who prices your home is the broker who walks you to the finish line. Specific numbers from the data, no layered hand-offs."
          showSearch={false}
          cta={{ href: '/sell/valuation', label: "What's my home worth" }}
          ctaSecondary={{ href: '/homes-for-sale', label: 'Browse' }}
          videoSrc={null}
          posterSrc={heroSrc ?? OLD_MILL_HERO}
        />

        <SellValueProps />

        {/* Early ask (design-audit P1): the conversion modules used to sit ~11
            mobile screens down — a seller who stops reading here still has a
            path to the valuation. */}
        <section className="section" id="sell-early-cta" aria-label="Get a home valuation">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href="/sell/valuation" className="btn alt">
                {"What's my home worth"} <span className="arr">→</span>
              </a>
              <a href={`tel:${CONTACT.phoneDirectTel}`} className="btn alt" style={{ background: 'transparent', color: 'var(--navy)' }}>
                Or call {CONTACT.phoneDirect}
              </a>
            </div>
          </div>
        </section>

        <SellProcess />

        <SellMarketingPlan />

        <SellCommission />

        <SellMarketContext pulse={pulse} />

        <LifestyleStrip
          images={lifestyleImages}
          eyebrow="Why buyers come here"
          title="The lifestyle your home is part of."
          lede="Buyers move to Central Oregon for the life outside the front door. Trails, rivers, fairways, and ski lifts within reach. That demand is what your listing taps into."
        />

        <SellValuationCTA
          valuationHref="/lp/seller-home-value"
          phoneHref={`tel:${CONTACT.phoneDirectTel}`}
        />

        {/* The "How it works — From first call to closing table" ContentSection
            was removed (design-audit P2): it restated SellProcess word for word
            (CMA, 48-hour photos, weekly updates, same broker to close) and
            stretched the page without adding a fact. */}

        <CTABar
          eyebrow="What is your home worth?"
          title="Get a free home valuation."
          body="A broker prepares a comparative market analysis with recent comparable sales and an honest price range. No cost, no obligation."
          primary={{ href: '/lp/seller-home-value', label: 'Get a home valuation' }}
          secondary={{ href: '/contact?inquiry=Selling', label: 'Talk to a broker' }}
          tone="navy"
        />

        <FAQBlock
          eyebrow="Common questions"
          title="Selling with Ryan Realty"
          items={FAQ_ITEMS}
          tone="muted"
        />

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      {/* Sticky mobile CTA bar (design-audit P1) — the ask reachable from every
          scroll depth, same pattern as /lp/sell-your-home. Mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 px-3 py-3 sm:hidden" style={{ background: 'var(--cream)', borderColor: 'var(--navy)' }}>
        <div className="flex items-center gap-2">
          <a
            href="/sell/valuation"
            className="flex-1 px-4 py-3 text-center text-sm font-bold uppercase tracking-widest"
            style={{ background: 'var(--navy)', color: 'var(--cream)' }}
          >
            {"What's my home worth"}
          </a>
          <a
            href={`tel:${CONTACT.phoneDirectTel}`}
            aria-label={`Call Ryan Realty at ${CONTACT.phoneDirect}`}
            className="flex h-12 items-center justify-center px-3 text-sm font-bold"
            style={{ border: '2px solid var(--navy)', color: 'var(--navy)' }}
          >
            Call
          </a>
        </div>
      </div>
    </main>
  )
}

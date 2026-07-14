/**
 * Sell page (/sell) — KB (kinetic-brutalist) design, conversion-first rework
 * 2026-07-11. The page is Ryan Realty's highest-intent lead surface, and the
 * prior build was a brochure: the ask lived two clicks away (/sell/valuation →
 * scroll past a second hero → form) and the page carried zero proof (no
 * reviews, no sold homes, no track record). This rework:
 *
 *   1. THE ASK IS IN THE HERO. The proven two-step seller form from
 *      /lp/seller-home-value (Google Places autocomplete, partial-lead capture
 *      on step 1, FUB workflow + broker assignment + CMA queue on submit)
 *      renders inside KbHero via formSlot. pagePath='/sell' keeps FUB
 *      sourceUrl attribution on this page.
 *   2. THE PAGE LEADS WITH THE SERVICE (Matt 2026-07-11: selling a home is not
 *      just the home's value). Order: how we sell (value props → process →
 *      marketing plan → fee), THEN proof (SellProof live track record + sold
 *      homes with verbatim paired reviews, KbTestimonials seller reviews).
 *      The valuation form is the entry point, not the theme.
 *   3. Every internal valuation CTA anchors to the on-page form (#get-value)
 *      instead of navigating away.
 *
 * DATA ACCURACY (CLAUDE.md §0): all stats are live DAL values (getMarketPulse,
 * getCityMarketDetail, getBrokerageTrackRecord, Sold Stories via
 * listing_tile_mv) or they do not render. Reviews are verbatim Google reviews
 * from lib/testimonials.ts. No invented results, sale percentages, or
 * days-to-sell stats (D99). Pulse/detail timeouts run at 8s: with
 * revalidate=300 the wait happens during background ISR revalidation, never on
 * a user request — the prior 3.5s budget silently blanked the live numbers.
 *
 * Section stack: KbNav · MetadataBlock · KbBreadcrumb · KbHero(formSlot) ·
 *   SellProof · KbTestimonials · SellValueProps · SellProcess ·
 *   SellMarketingPlan · SellCommission · SellMarketContext · LifestyleStrip ·
 *   SellValuationCTA · CTABar · FAQBlock · KbFooter.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/sell/parity.json (KB set).
 */

import type { Metadata } from 'next'
import {
  getMarketPulse,
  getCityMarketDetail,
  getSurfaceImage,
  getLifestyleImages,
  getBrokerageTrackRecord,
} from '@/lib/data'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { LifestyleStrip } from '@/components/site/LifestyleStrip'
import { pageMetadata } from '@/lib/site/page-metadata'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { SellValueProps } from '@/components/site/sell/SellValueProps'
import { SellProcess } from '@/components/site/sell/SellProcess'
import { SellProof } from '@/components/site/sell/SellProof'
import { SellMarketingPlan } from '@/components/site/sell/SellMarketingPlan'
import { SellCommission } from '@/components/site/sell/SellCommission'
import { SellValuationCTA } from '@/components/site/sell/SellValuationCTA'
import { SellMarketContext } from '@/components/site/sell/SellMarketContext'
import { CONTACT } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
import { getSoldStories, getTestimonialAggregate } from '@/app/lp/seller-home-value/data'
import SellerLPForm from '@/app/lp/seller-home-value/SellerLPForm'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

export const revalidate = 300

const ROUTE_PATH = '/sell'
const OLD_MILL_HERO = '/images/homepage/tetherow-golf-aerial.jpg'
/** On-page anchor of the hero form (SellerLPForm default formId). */
const FORM_ANCHOR = '#get-value'

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Sell your home · Ryan Realty, Central Oregon',
    description:
      'List your Central Oregon home with Ryan Realty. Pricing from live market data, professional marketing, and one broker from valuation to close. Request a free home valuation.',
    path: ROUTE_PATH,
    ogImage: '/images/homepage/tetherow-golf-aerial.jpg',
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
      'Three plans: Essential at 2.5%, Enhanced at 3%, and Elite at 3.5% of the sale price, with no add-on fees. Every plan lists on the MLS, includes professional photography, a 3D tour, every showing, and transaction management through close. The higher tiers add marketing reach: drone video, paid social, professional staging, and a pre-listing inspection. Buyer-agent compensation is a separate number, negotiated per offer under the current rules. Commission is negotiable and every listing agreement is its own conversation.',
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

// Seller-side verified Google reviews for the "In their words" grid. Gary
// Timms + Doug Millard are excluded here because their quotes render on the
// SellProof sold cards above — one page never repeats a quote.
const SELL_REVIEW_AUTHORS = [
  'Audra Hedberg',
  'Douglas Grant',
  'Charise Millard',
  'C Jenkins',
  'Helen Luna Fess',
  'SwankHQ',
] as const
const SELL_REVIEWS = TESTIMONIALS.filter((t) =>
  (SELL_REVIEW_AUTHORS as readonly string[]).includes(t.author),
).map((t) => ({ quote: t.quote, author: t.author }))

export default async function SellPage() {
  const [pulse, marketDetail, heroSrc, lifestyleImages, trackRecord, soldStories] =
    await Promise.all([
      withTimeoutFallback(
        getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
        null,
        8000,
        'sell:pulse',
      ),
      withTimeoutFallback(
        getCityMarketDetail({ geoType: 'city', geoSlug: 'bend' }),
        null,
        8000,
        'sell:market-detail',
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
      withTimeoutFallback(getBrokerageTrackRecord(), null, 8000, 'sell:track-record'),
      withTimeoutFallback(getSoldStories(), [], 8000, 'sell:sold-stories'),
    ])

  // Proof cards: list-side sold transactions only, highest value first (the
  // stories pipeline is already price-descending). Max 3.
  const soldProof = soldStories
    .filter((s) => s.listing.badge === 'Sold' && s.side === 'list')
    .slice(0, 3)

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
          titleTop="This is how"
          titleBottom="your home gets sold."
          statless
          lead="Professional photography, a 3D tour, the MLS and every national feed, and a written report every week it is listed. Start with the free valuation."
          showSearch={false}
          formSlot={
            <>
              <SellerLPForm knownVisitor={false} heroVariant pagePath={ROUTE_PATH} />
              <p className="hero-form-note">
                Prefer to talk first? Call{' '}
                <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>.
              </p>
            </>
          }
          cta={null}
          ctaSecondary={null}
          videoSrc={null}
          posterSrc={heroSrc ?? OLD_MILL_HERO}
        />

        <SellValueProps />

        <SellProcess />

        <SellMarketingPlan />

        <SellCommission />

        <SellProof
          record={trackRecord}
          reviewAggregate={getTestimonialAggregate()}
          stories={soldProof}
        />

        <KbTestimonials reviews={SELL_REVIEWS} />

        <SellMarketContext pulse={pulse} detail={marketDetail} />

        <LifestyleStrip
          images={lifestyleImages}
          eyebrow="Why buyers come here"
          title="The lifestyle your home is part of."
          lede="Buyers move to Central Oregon for the life outside the front door. Trails, rivers, fairways, and ski lifts within reach. That demand is what your listing taps into."
        />

        <SellValuationCTA
          valuationHref={FORM_ANCHOR}
          phoneHref={`tel:${CONTACT.phoneDirectTel}`}
        />

        <CTABar
          eyebrow="What is your home worth?"
          title="Get a free home valuation."
          body="A broker prepares a comparative market analysis with recent comparable sales and the price range those comps support. No cost, no obligation."
          primary={{ href: FORM_ANCHOR, label: 'Get a home valuation' }}
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

      {/* Sticky mobile CTA bar — the ask reachable from every scroll depth,
          anchored to the on-page hero form. Mobile only. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 px-3 py-3 sm:hidden" style={{ background: 'var(--cream)', borderColor: 'var(--navy)' }}>
        <div className="flex items-center gap-2">
          <a
            href={FORM_ANCHOR}
            className="flex-1 px-4 py-3 text-center text-sm font-bold uppercase tracking-widest"
            style={{ background: 'var(--navy)', color: 'var(--cream)' }}
          >
            Get my home value
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

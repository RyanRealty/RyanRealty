/**
 * Sell page (/sell) — KB design, conversion-first craft (E5).
 *
 * Conversion stack (parity competitive target + B3 wiring):
 *   1. THE ASK IS IN THE HERO. SellerLPForm (Places autocomplete, partial-lead
 *      on step 1, FUB + CMA queue on submit) via formSlot. pagePath='/sell'
 *      keeps sourceUrl attribution on this page. Anchor #get-value.
 *   2. PROOF EARLY. SellProof (live track record + sold homes) then
 *      KbTestimonials, so receipts sit above the long service story.
 *   3. SERVICE STORY. Value props → situations → process → marketing plan →
 *      fee → live market context.
 *   4. Every internal valuation CTA anchors to #get-value (on-page form).
 *      Secondary path: /sell/valuation for the dedicated written CMA surface.
 *
 * DATA ACCURACY (CLAUDE.md §0): all stats are live DAL values or they do not
 * render. Reviews are verbatim Google reviews from lib/testimonials.ts.
 *
 * Layer A (seo-shell): titleTop "Sell your home in" + metadata "Sell Your Home…".
 * Brand lock: navy/cream KB shell, Amboqia display, no invented metrics.
 *
 * Parity: design_system/ryan-realty/ui_kits/sell/parity.json (KB set).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
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
import { SellerSituations } from '@/components/site/sell/SellerSituations.client'
import { SellProcess } from '@/components/site/sell/SellProcess'
import { SellProof } from '@/components/site/sell/SellProof'
import { SellPlanSingle } from '@/components/site/sell/SellPlanSingle'
import { SellCommission } from '@/components/site/sell/SellCommission'
import { SellValuationCTA } from '@/components/site/sell/SellValuationCTA'
import { SellMarketContext } from '@/components/site/sell/SellMarketContext'
import { CONTACT } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
import { getSoldStories, getTestimonialAggregate } from '@/app/lp/seller-home-value/data'
import SellerLPForm from '@/app/lp/seller-home-value/SellerLPForm'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
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
    title: 'Sell Your Home in Central Oregon',
    description:
      'List your Central Oregon home with Ryan Realty. The listing fee is 3% of the sale price, photos within 48 hours of signing, and a written report every week it is listed.',
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
      'The listing fee is 3% of the sale price, with no add-on fees. It covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer under the current rules.',
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
        {/* Layer A H1: sell intent + place (seo-shell locked). */}
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Sell with Ryan Realty"
          titleTop="Sell your home in"
          titleBottom="Central Oregon"
          statless
          lead="The listing fee is 3% of the sale price, nothing billed on the side. Photos in 48 hours, on the MLS in 5 to 7 business days, and a written report every week."
          showSearch={false}
          formSlot={
            <>
              <SellerLPForm knownVisitor={false} heroVariant pagePath={ROUTE_PATH} />
              <p className="hero-form-note">
                Prefer to talk first? Call{' '}
                <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
                . Dedicated written valuation page:{' '}
                <Link href="/sell/valuation#valuation-form">Value my home</Link>.
              </p>
            </>
          }
          cta={null}
          ctaSecondary={null}
          videoSrc={null}
          posterSrc={heroSrc ?? OLD_MILL_HERO}
        />

        {/* Proof early — conversion rhythm: form → receipts → story */}
        <SellProof
          record={trackRecord}
          reviewAggregate={getTestimonialAggregate()}
          stories={soldProof}
          valuationHref={FORM_ANCHOR}
        />

        <KbTestimonials reviews={SELL_REVIEWS} />

        <SellValueProps />

        <SellerSituations valuationHref={FORM_ANCHOR} />

        <SellProcess />

        <SellPlanSingle valuationHref={FORM_ANCHOR} />

        <SellCommission />

        <SellMarketContext
          pulse={pulse}
          detail={marketDetail}
          valuationHref={FORM_ANCHOR}
        />

        <LifestyleStrip
          images={lifestyleImages}
          eyebrow="Central Oregon"
          title="What buyers move here for."
          lede="Trails, rivers, fairways, and ski lifts, all within reach of Bend, Redmond, Sisters, and Sunriver."
        />

        <SellValuationCTA
          valuationHref={FORM_ANCHOR}
          phoneHref={`tel:${CONTACT.phoneDirectTel}`}
        />

        <CTABar
          eyebrow="What is your home worth?"
          title="Send your address, get the comps."
          body="A broker writes a comparative market analysis: three closed sales near you, three homes yours would compete against, and the price range those six support. It costs nothing and requires no listing agreement."
          primary={{ href: FORM_ANCHOR, label: 'Get the written valuation' }}
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

      {/* Sticky mobile CTA — form reachable from every scroll depth. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t-2 px-3 py-3 sm:hidden"
        style={{
          background: 'var(--cream)',
          borderColor: 'var(--navy)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2">
          <a
            href={FORM_ANCHOR}
            className="flex min-h-12 flex-1 items-center justify-center px-4 py-3 text-center text-sm font-bold uppercase tracking-widest"
            style={{ background: 'var(--navy)', color: 'var(--cream)' }}
          >
            Get the valuation
          </a>
          <a
            href={`tel:${CONTACT.phoneDirectTel}`}
            aria-label={`Call Ryan Realty at ${CONTACT.phoneDirect}`}
            className="flex h-12 min-w-12 items-center justify-center px-3 text-sm font-bold"
            style={{ border: '2px solid var(--navy)', color: 'var(--navy)' }}
          >
            Call
          </a>
        </div>
      </div>
    </main>
  )
}

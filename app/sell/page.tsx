/**
 * Sell page (/sell) — Wave 3 site-v2 rebuild.
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
 */

import { getMarketPulse, getSurfaceImage } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { CTABar } from '@/components/site/CTABar'
import { SellValueProps } from '@/components/site/sell/SellValueProps'
import { SellProcess } from '@/components/site/sell/SellProcess'
import { SellCommission } from '@/components/site/sell/SellCommission'
import { SellValuationCTA } from '@/components/site/sell/SellValuationCTA'
import { SellMarketContext } from '@/components/site/sell/SellMarketContext'
import {
  Body,
  Container,
} from '@/components/site/primitives'

export const revalidate = 300

export const metadata = pageMetadata({
  title: 'Sell your home · Ryan Realty, Central Oregon',
  description:
    'List your Central Oregon home with Ryan Realty. Pricing from live market data, marketing from a local licensed broker, and one broker from valuation to close. Request a free home valuation.',
  path: '/sell',
  ogImage: '/brand/hero/hero-old-mill-master-4k.jpg',
  keywords: [
    'sell home Bend Oregon',
    'Central Oregon home valuation',
    'list home Bend',
    'Ryan Realty seller',
  ],
})

const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a listing agreement to get the CMA?',
    answer:
      'No. The comparative market analysis is free and requires no contract. If you decide to list with us after reading it, that is a separate signed agreement.',
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

const OLD_MILL_HERO = '/brand/hero/hero-old-mill-master-4k.jpg'

export default async function SellPage() {
  const pulse = await getMarketPulse({ geoType: 'city', geoSlug: 'bend' }).catch(() => null)
  // Distinct approved hero so /sell does not reuse the homepage Old Mill banner.
  const heroSrc = await getSurfaceImage('hero', {
    geoTags: ['central-oregon'],
    seed: '/sell',
    fallback: OLD_MILL_HERO,
  })

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background border-b border-border py-3">
        <Container>
          <BreadcrumbNav
            items={[{ label: 'Home', href: '/' }, { label: 'Sell' }]}
            tone="on-light"
          />
        </Container>
      </div>

      <HeroBlock
        headline="Selling your home, done honestly."
        lede="A small team of three brokers. Specific numbers from the data. No layered hand-offs. The broker who prices your home is the broker who walks you to the finish line."
        photo={{
          src: heroSrc ?? OLD_MILL_HERO,
          alt: 'Central Oregon high desert and Cascade mountains around Bend.',
          priority: true,
        }}
        minHeight={500}
        chips={[
          { label: 'Free home valuation', href: '/lp/seller-home-value' },
          { label: 'Talk to a broker', href: '/contact?inquiry=Selling' },
          { label: 'How we price', href: '#our-process' },
        ]}
      />

      <SellValueProps />

      <SellProcess />

      <SellCommission />

      <SellMarketContext pulse={pulse} />

      <SellValuationCTA
        valuationHref="/lp/seller-home-value"
        phoneHref="tel:5412136706"
      />

      <ContentSection
        eyebrow="How it works"
        title="From first call to closing table."
        tone="default"
        divider
        width="wide"
      >
        <div className="space-y-4">
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Request a valuation.</strong>{' '}
            Share your address and your timeline. We prepare the written CMA and email it within 24 hours.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Review the numbers together.</strong>{' '}
            We walk you through the comparable sales, the active competition, and an honest price range. You decide the list price from real data.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">List and market.</strong>{' '}
            Professional photography within 48 hours of signing. MLS syndication, open-house cadence, and weekly written updates on showings and traffic.
          </Body>
          <Body size="default" tone="muted">
            <strong className="text-foreground font-semibold">Close.</strong>{' '}
            We review every offer, negotiate, manage the transaction through inspection and appraisal, and stay with you to the closing table. The same broker, start to finish.
          </Body>
        </div>
      </ContentSection>

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
    </main>
  )
}

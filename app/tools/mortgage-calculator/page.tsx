// @data-free — pure client-side calculator, fetches no data (price/down/rate/term pre-fill comes from searchParams)
/**
 * /tools/mortgage-calculator — free monthly-payment estimator for Central Oregon
 * buyers.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + Card layout. Every piece of content is
 * preserved: SoftwareApplication JSON-LD, the searchParams pre-fill
 * (price/down/rate/term), the interactive MortgageCalculator client component
 * (shadcn inputs/select — logic untouched), the hero H1 + subtitle + the two
 * CTAs (Browse Listings / Get a Home Valuation), and the full three-paragraph
 * "How to use this calculator" explainer plus its valuation CTA. Only the
 * presentation changed — the page now wears the KB shell (KbNav, KbHero,
 * Amboqia display, hard-edge cream surfaces, KbFooter).
 *
 * SEO: export const metadata (canonical + OG + Twitter) + SoftwareApplication
 * JSON-LD. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="tools").
 */

import type { Metadata } from 'next'
import MortgageCalculator from './MortgageCalculator'
import { getCalculatorDefaults } from '@/lib/data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Mortgage Calculator',
  description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
  alternates: { canonical: `${siteUrl}/tools/mortgage-calculator` },
  openGraph: {
    title: 'Mortgage Calculator | Ryan Realty',
    description: 'Estimate your monthly payment. Home price, down payment, interest rate, and loan term.',
    url: `${siteUrl}/tools/mortgage-calculator`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

type Props = {
  searchParams: Promise<{
    price?: string
    down?: string
    rate?: string
    term?: string
  }>
}

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mortgage Calculator',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  url: `${siteUrl}/tools/mortgage-calculator`,
  description:
    'Free mortgage calculator for Central Oregon home buyers. Estimate monthly payment from home price, down payment, interest rate, and loan term.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  provider: { '@type': 'RealEstateAgent', name: 'Ryan Realty', url: siteUrl },
}

export default async function MortgageCalculatorPage({ searchParams }: Props) {
  const [sp, calcDefaults] = await Promise.all([searchParams, getCalculatorDefaults()])
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialDown = sp.down != null ? parseInt(sp.down, 10) : undefined
  // URL param takes precedence; fall back to app_config mortgage_rate
  const initialRate = sp.rate != null ? parseFloat(sp.rate) : calcDefaults.mortgageRate
  const initialTerm = sp.term != null ? parseInt(sp.term, 10) : undefined

  // Derive dollar-amount defaults from app_config rate percentages.
  // Base: default home price ($500k) — matches the component's fallback.
  const defaultHomePrice = initialPrice ?? 500000
  const defaultPropertyTaxYear = Math.round((defaultHomePrice * calcDefaults.taxRatePct) / 100 / 50) * 50
  const defaultInsuranceYear = Math.round((defaultHomePrice * calcDefaults.insuranceRatePct) / 100 / 50) * 50

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="tools" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Tools', href: '/tools/mortgage-calculator' },
          { label: 'Mortgage calculator' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero, in the KB
            Amboqia display. The prior CTAs (Browse Listings / Get a Home
            Valuation) are preserved as a dedicated CTA row below the hero. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Buyer tools"
          titleTop="Mortgage"
          titleBottom="Calculator"
          lead="Adjust home price, down payment, interest rate, and loan term to plan your purchase and estimate your monthly payment."
          showSearch={false}
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero (Browse Listings · Get a Home Valuation) */}
        <section className="section" id="tool-cta" aria-label="Browse and value">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href="/homes-for-sale" className="btn alt">
                Browse listings <span className="arr">&rarr;</span>
              </a>
              <a
                href="/sell/valuation"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Get a home valuation <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* The calculator — interactive shadcn client component, logic untouched.
            Wrapped in a KB section + hard-edge cream card so it sits on the
            navy-on-cream surface. */}
        <section className="section" id="calculator" aria-label="Mortgage calculator">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Estimate</span>
              <h2 className="sec-title display">Your monthly<br />payment</h2>
            </div>
            <div
              className="kb-tool-card"
              style={{ border: 'var(--edge) solid var(--navy)', padding: 'clamp(16px,3vw,28px)', marginTop: 28 }}
            >
              <MortgageCalculator
                initialHomePrice={initialPrice}
                initialDownPaymentPct={initialDown}
                initialInterestRate={initialRate}
                initialLoanTermYears={initialTerm}
                initialPropertyTaxYear={defaultPropertyTaxYear}
                initialInsuranceYear={defaultInsuranceYear}
              />
            </div>
          </div>
        </section>

        {/* How to use this calculator — full explainer copy preserved verbatim,
            plus the valuation CTA. */}
        <section className="section" id="how-to-use" aria-label="How to use this calculator">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Guide</span>
              <h2 className="sec-title display">How to use<br />this calculator</h2>
            </div>
            <div className="ov-prose" style={{ paddingTop: 24, color: 'var(--navy)' }}>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 16 }}>
                Enter the home price and down payment percentage to set the loan amount. Adjust the interest
                rate and loan term to match the scenario you want to model. The property tax and home insurance
                fields default to Central Oregon estimates and are editable assumptions. PMI applies automatically
                when the down payment is below 20 percent and is calculated at 0.5 percent of the loan amount
                per year.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 16 }}>
                The monthly total is an estimate, not a lender quote. Your actual payment will reflect the
                rate your lender offers, the exact tax assessment on the property, your insurance policy
                premium, and any HOA dues not included here.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 0 }}>
                If you want to know what a specific home is worth before running the numbers, start with a
                free home value report.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a href="/sell/valuation" className="btn alt">
                Get your home&apos;s actual value <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

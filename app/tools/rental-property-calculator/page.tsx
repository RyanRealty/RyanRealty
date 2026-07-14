// @no-parity — utility calculator tool, no mockup contract (same as /tools/mortgage-calculator)
// @data-free — pure client-side calculator, fetches no data (rent/MLS pre-fill is a future enhancement)
/**
 * /tools/rental-property-calculator — free rental underwriting tool for Bend and
 * Central Oregon investors.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + Card layout. Every piece of content is
 * preserved: SoftwareApplication JSON-LD, the four-question FAQPage JSON-LD (now
 * ALSO surfaced visibly so answer engines and readers see the same content), the
 * searchParams pre-fill (price/rent/taxes/down/rate), the interactive
 * RentalCalculator client component (shadcn inputs/select + 30-year projection —
 * logic untouched), the hero H1 + subtitle + the two CTAs (Browse Homes for Sale
 * / Talk to an Agent), and the full three-paragraph "How to use this calculator"
 * explainer plus its broker CTA. Only the presentation changed — the page now
 * wears the KB shell (KbNav, KbHero, Amboqia display, hard-edge cream surfaces,
 * KbFooter).
 *
 * SEO: export const metadata (canonical + OG + Twitter) + SoftwareApplication +
 * FAQPage JSON-LD. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="tools").
 */

import type { Metadata } from 'next'
import RentalCalculator from '@/components/tools/RentalCalculator'
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
  title: 'Rental Property Calculator',
  description:
    'Run the numbers on any rental in Bend and Central Oregon. See monthly cash flow, cap rate, cash-on-cash return, and a long-term projection.',
  alternates: { canonical: `${siteUrl}/tools/rental-property-calculator` },
  openGraph: {
    title: 'Rental Property Calculator | Ryan Realty',
    description:
      'See monthly cash flow, cap rate, cash-on-cash return, and a long-term projection for any rental property.',
    url: `${siteUrl}/tools/rental-property-calculator`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

type Props = {
  searchParams: Promise<{
    price?: string
    rent?: string
    taxes?: string
    down?: string
    rate?: string
  }>
}

// AEO: a free finance tool + the calculator's key concepts as an FAQ, so answer
// engines can surface "rental property calculator" and "what is cap rate / cash
// flow / cash-on-cash". Answers match the engine in lib/rental-analysis.ts.
// The same Q&A pairs render visibly in the FAQ section below.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is cash flow on a rental property?',
    a: 'Cash flow is what is left each month after the mortgage, property taxes, insurance, management, and maintenance reserves are paid out of the rent. Positive cash flow means the rent covers every cost with money to spare.',
  },
  {
    q: 'What is cap rate?',
    a: 'Cap rate is the annual net operating income divided by the purchase price, shown as a percent. It measures the yield of the property independent of how you finance it.',
  },
  {
    q: 'What is cash-on-cash return?',
    a: 'Cash-on-cash return compares your annual cash flow to the cash you put in, including the down payment, closing costs, and any upfront work. It shows the yearly return on the actual dollars you invested.',
  },
  {
    q: 'Are these rental numbers a guarantee?',
    a: 'No. The figures are estimates based on the numbers you enter, not investment advice or a guarantee of rent, value, or return. A Ryan Realty broker can pull real rent comps and help you underwrite a specific property.',
  },
]

export default async function RentalPropertyCalculatorPage({ searchParams }: Props) {
  const [sp, calcDefaults] = await Promise.all([searchParams, getCalculatorDefaults()])
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialRent = sp.rent ? parseInt(sp.rent, 10) : undefined
  const initialPropertyTaxesYear = sp.taxes ? parseInt(sp.taxes, 10) : undefined
  const initialDownPaymentPct = sp.down != null ? parseInt(sp.down, 10) : undefined
  // URL param takes precedence; fall back to app_config mortgage_rate
  const initialInterestRate = sp.rate != null ? parseFloat(sp.rate) : calcDefaults.mortgageRate

  const toolUrl = `${siteUrl}/tools/rental-property-calculator`
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Rental Property Calculator',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: toolUrl,
    description:
      'Free rental property calculator for Bend and Central Oregon. See monthly cash flow, cap rate, cash-on-cash return, total cash needed, and a 30-year projection.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'RealEstateAgent', name: 'Ryan Realty', url: siteUrl },
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="tools" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Tools' },
          { label: 'Rental property calculator' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero, in the KB
            Amboqia display. The prior CTAs (Browse Homes for Sale / Talk to an
            Agent) are preserved as a dedicated CTA row below the hero. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Investor tools"
          titleTop="Rental Property"
          titleBottom="Calculator"
          lead="Adjust price, financing, rent, and expenses to see monthly cash flow, cap rate, cash-on-cash return, and how equity builds over time."
          videoSrc={null}
          posterSrc="/images/lp/hero-pond.jpg"
        />

        {/* CTA row preserved from the prior hero (Browse Homes for Sale · Talk to an Agent) */}
        <section className="section" id="tool-cta" aria-label="Browse and contact">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href="/homes-for-sale" className="btn alt">
                Browse homes for sale <span className="arr">&rarr;</span>
              </a>
              <a
                href="/contact"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Talk to an agent <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* The calculator — interactive shadcn client component, logic untouched
            (cash flow, cap rate, cash-on-cash, total cash, 30-year projection).
            Wrapped in a KB section + hard-edge cream card. */}
        <section className="section" id="calculator" aria-label="Rental property calculator">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Underwrite</span>
              <h2 className="sec-title display">Run the<br />numbers</h2>
            </div>
            <div
              className="kb-tool-card"
              style={{ border: 'var(--edge) solid var(--navy)', padding: 'clamp(16px,3vw,28px)', marginTop: 28 }}
            >
              <RentalCalculator
                initialPrice={initialPrice}
                initialRent={initialRent}
                initialPropertyTaxesYear={initialPropertyTaxesYear}
                initialDownPaymentPct={initialDownPaymentPct}
                initialInterestRate={initialInterestRate}
              />
            </div>
          </div>
        </section>

        {/* How to use this calculator — full explainer copy preserved verbatim,
            plus the broker CTA. */}
        <section className="section" id="how-to-use" aria-label="How to use this calculator">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Guide</span>
              <h2 className="sec-title display">How to use<br />this calculator</h2>
            </div>
            <div className="ov-prose" style={{ paddingTop: 24, color: 'var(--navy)' }}>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 16 }}>
                Start with the purchase price and the rent you expect to collect. Set your down payment, interest
                rate, and loan term to match the financing you plan to use. The operating-expense fields carry
                editable defaults for Central Oregon, property taxes near 0.75 percent of price, management at 8
                percent of rent, and reserves for maintenance and capital repairs. Adjust each one to fit the
                property.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 16 }}>
                The results panel updates as you type. Cash flow is what is left each month after the mortgage,
                taxes, insurance, management, and reserves. Cap rate measures yield independent of financing.
                Cash-on-cash compares your annual cash flow to the cash you put in. Open the 30-year projection to
                see how rent, value, and equity grow over time.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 0 }}>
                These figures are estimates, not investment advice or a guarantee of rent, value, or return. When
                you find a property worth a closer look, a Ryan Realty broker can pull real rent comps and help you
                underwrite it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a href="/contact" className="btn alt">
                Talk to a Ryan Realty broker <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* FAQ — the same four Q&A pairs carried in the FAQPage JSON-LD, now
            surfaced visibly for readers and answer engines. */}
        <section className="section" id="faq" aria-label="Rental calculator questions">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Questions</span>
              <h2 className="sec-title display">Cash flow,<br />cap rate &amp; more</h2>
            </div>
            <dl style={{ paddingTop: 24, maxWidth: '72ch' }}>
              {FAQ.map((item, i) => (
                <div
                  key={item.q}
                  style={{
                    borderTop: 'var(--edge) solid var(--navy-12)',
                    paddingTop: 22,
                    paddingBottom: 22,
                    ...(i === FAQ.length - 1 ? { borderBottom: 'var(--edge) solid var(--navy-12)' } : {}),
                  }}
                >
                  <dt
                    className="display"
                    style={{ fontSize: 'clamp(1.15rem,2.4vw,1.55rem)', lineHeight: 1.1, marginBottom: 10 }}
                  >
                    {item.q}
                  </dt>
                  <dd
                    style={{
                      color: 'var(--navy-70)',
                      fontSize: 'clamp(1rem,1.5vw,1.12rem)',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

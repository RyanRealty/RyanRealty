// @data-free — pure client-side calculator, fetches no data (a consent-gated AdUnit + a client CTA are the only dynamic pieces)
/**
 * /tools/appreciation — home appreciation projector for Central Oregon
 * homeowners.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE from the prior ContentPageHero + Card layout. Every piece of content is
 * preserved: WebApplication JSON-LD, the interactive AppreciationCalculator
 * client component (logic untouched), the consent-gated AdUnit (slot
 * 1001003001, horizontal), the HomeValuationCta lead-capture card, the hero H1 +
 * subtitle + the two CTAs (Browse Listings / Mortgage Calculator), and the full
 * three-paragraph "How to use this calculator" explainer plus its valuation CTA.
 * Only the presentation changed — the page now wears the KB shell (KbNav,
 * KbHero, Amboqia display, hard-edge cream surfaces, KbFooter).
 *
 * SEO: export const metadata (canonical + OG + Twitter) + WebApplication
 * JSON-LD. PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker
 * pageType="tools").
 */

import type { Metadata } from 'next'
import AppreciationCalculator from '@/components/tools/AppreciationCalculator'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
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
  title: 'Home Appreciation Calculator',
  description: 'Estimate your future home value with a simple appreciation calculator built for Central Oregon homeowners.',
  alternates: { canonical: `${siteUrl}/tools/appreciation` },
  openGraph: {
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare potential appreciation scenarios.',
    url: `${siteUrl}/tools/appreciation`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Home Appreciation Calculator | Ryan Realty',
    description: 'Project home value growth and compare appreciation scenarios.',
    images: [ogImage],
  },
}

export default function AppreciationToolPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Home Appreciation Calculator',
    url: `${siteUrl}/tools/appreciation`,
    applicationCategory: 'FinanceApplication',
    description: 'Estimate future home value with appreciation scenarios.',
  }

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="tools" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Tools' },
          { label: 'Home appreciation calculator' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero, in the KB
            Amboqia display. The prior CTAs (Browse Listings / Mortgage
            Calculator) are preserved as a dedicated CTA row below the hero. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Homeowner tools"
          titleTop="Home Appreciation"
          titleBottom="Calculator"
          lead="Model different annual appreciation rates to understand long-term equity growth and plan your investment."
          videoSrc={null}
          posterSrc="/images/hero/hero-old-mill-master-4k.jpg"
        />

        {/* CTA row preserved from the prior hero (Browse Listings · Mortgage Calculator) */}
        <section className="section" id="tool-cta" aria-label="Browse and calculate">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <a href="/homes-for-sale" className="btn alt">
                Browse listings <span className="arr">&rarr;</span>
              </a>
              <a
                href="/tools/mortgage-calculator"
                className="btn alt"
                style={{ background: 'transparent', color: 'var(--navy)' }}
              >
                Mortgage calculator <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* The calculator — interactive client component, logic untouched.
            Wrapped in a KB section + hard-edge cream card. */}
        <section className="section" id="calculator" aria-label="Home appreciation calculator">
          <div className="wrap">
            <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
              <span className="sec-index">Project</span>
              <h2 className="sec-title display">Future value<br />&amp; total gain</h2>
            </div>
            <div
              className="kb-tool-card"
              style={{ border: 'var(--edge) solid var(--navy)', padding: 'clamp(16px,3vw,28px)', marginTop: 28 }}
            >
              <AppreciationCalculator />
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
                Enter the current value of the home in the purchase price field. Set an annual appreciation
                rate to model different growth scenarios, then adjust the years held to see the projected
                future value and total gain over time.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 16 }}>
                The result is a mathematical projection based on a fixed annual rate. It is not an appraisal
                and it is not a Comparative Market Analysis. Actual home values depend on market conditions,
                property condition, location, and buyer demand, none of which a fixed-rate formula captures.
              </p>
              <p style={{ fontSize: 'clamp(1rem,1.5vw,1.15rem)', lineHeight: 1.6, marginBottom: 0 }}>
                For an address-specific valuation based on real sales data, request a free home value report.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a href="/sell/valuation" className="btn alt">
                Get your home&apos;s actual value <span className="arr">&rarr;</span>
              </a>
            </div>
          </div>
        </section>

        {/* Sponsored ad slot — consent-gated client component, preserved
            (renders null without marketing consent). */}
        <section className="section" id="sponsored" aria-label="Sponsored">
          <div className="wrap">
            <AdUnit slot="1001003001" format="horizontal" />
          </div>
        </section>

        {/* Home valuation lead-capture CTA — interactive client component with
            campaign attribution, preserved. */}
        <section className="section" id="valuation-cta" aria-label="Home valuation">
          <div className="wrap">
            <HomeValuationCta />
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}

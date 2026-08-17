// @data-free — pure client-side calculator, fetches no data (a consent-gated AdUnit is the only dynamic piece)
/**
 * /tools/appreciation — home appreciation projector for Central Oregon
 * homeowners, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Quiet (what this calculator is) -> calculator island -> Quiet (how the
 * math works, plus the valuation door). Two of the six patterns.
 *
 * THE PAGE CONTRACT: export const metadata (canonical + OG + Twitter),
 * WebApplication JSON-LD, V3SectionTracker pageType="tools", the
 * AppreciationCalculator island (singleton hold-period math, not a year
 * path), the consent-gated AdUnit (slot 1001003001, horizontal).
 *
 * DROPPED: KbHero, KbBreadcrumb, KbFooter, SmoothScrollProvider,
 * HomeValuationCta (the closing Quiet edge goes through valuationHref so
 * ?from=/tools/appreciation is kept), the Browse listings / Mortgage
 * calculator button row (those doors live in the closing Quiet), V3Stage.
 * The barrel Stage does not accept a breadcrumb child, and a cream trail
 * above a dark opening is the overlay defect ci:kb-breadcrumb-overlay
 * exists to stop. This page is a tool, so it opens on Quiet.
 */

import type { Metadata } from 'next'
import AppreciationCalculator from '@/components/tools/AppreciationCalculator'
import AdUnit from '@/components/AdUnit'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { valuationHref } from '@/lib/site/valuation-href'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
const VALUATION_HREF = valuationHref('/tools/appreciation')

export const metadata: Metadata = {
  title: 'Home Appreciation Calculator',
  description:
    'Project future home value from a purchase price, annual appreciation rate, and years held. Math, not an appraisal.',
  alternates: { canonical: `${siteUrl}/tools/appreciation` },
  openGraph: {
    title: 'Home Appreciation Calculator | Ryan Realty',
    description:
      'Project future home value from a purchase price, an annual appreciation rate, and years held. Math, not an appraisal.',
    url: `${siteUrl}/tools/appreciation`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Home Appreciation Calculator | Ryan Realty',
    description:
      'Project future home value from a purchase price, an annual appreciation rate, and years held. Math, not an appraisal.',
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
    description: 'Project future home value from a purchase price, an annual appreciation rate, and years held.',
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="tools" />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Home appreciation calculator', url: '/tools/appreciation' },
              ],
            },
          ]}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Tools' },
            { label: 'Home appreciation calculator' },
          ]}
        />

        <V3Quiet
          id="tool"
          heading="Home appreciation calculator"
          headingLevel={1}
          eyebrow="Central Oregon · Hold-period math"
          items={[
            {
              kind: 'prose',
              body: 'Project future home value from a purchase price, an annual appreciation rate, and years held. Math, not an appraisal.',
            },
          ]}
        />

        <section id="calculator" aria-label="Home appreciation calculator">
          <AppreciationCalculator />
        </section>

        <V3Quiet
          id="how-to-use"
          eyebrow="Guide"
          heading="How to use this calculator"
          items={[
            {
              kind: 'prose',
              body: 'Set a purchase price, an annual appreciation rate, and years held. The calculator projects future value and total gain from those three numbers.',
            },
            {
              kind: 'prose',
              body: 'The result is a mathematical projection based on a fixed annual rate. It is not an appraisal and it is not a Comparative Market Analysis. Actual home values depend on market conditions, property condition, location, and buyer demand, none of which a fixed-rate formula captures.',
            },
            {
              kind: 'prose',
              body: 'For an address-specific valuation based on real sales data, request a written home value report.',
            },
            { label: 'Value my home', href: VALUATION_HREF },
            { label: 'Browse homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
          ]}
        />

        <section id="sponsored" aria-label="Sponsored">
          <AdUnit slot="1001003001" format="horizontal" />
        </section>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

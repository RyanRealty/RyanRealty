/**
 * /tools/mortgage-calculator — monthly payment estimator, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Rhythm: three of six,
 * no two adjacent alike. Order is Breadcrumb, Instrument level 1, Sheet
 * (calculator island), Quiet, Footer.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title "Mortgage
 * Calculator for Home Buyers", SoftwareApplication JSON-LD, searchParams
 * pre-fill (price/down/rate/term), getCalculatorDefaults seeds, MortgageCalculator
 * math and field names, V3SectionTracker pageType="tools". MetadataBlock stays
 * on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a
 * seventh pattern.
 *
 * SoftwareApplication stays a page-level script. MetadataBlock has no
 * SoftwareApplication input type, and ci:ai-structured-data pins the literal
 * on this file.
 *
 * ONE PRIMARY PER VIEWPORT, counting visible filled controls. At 390 the
 * chrome CTA sits in the collapsed menu, so the Instrument ask is primary.
 * Label is Value my home (D11). valuationHref carries ?from=.
 *
 * KB-era deletions: KbHero (poster, no search), KbFooter, SmoothScrollProvider,
 * kb.css, the dedicated Browse / Get a home value estimate button row (those
 * doors now live on the Instrument and in Quiet).
 */

import type { Metadata } from 'next'
import { getCalculatorDefaults } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import MortgageCalculator from './MortgageCalculator'
import { CalculatorSheet } from './_v3/CalculatorSheet'
import { DEFAULT_HOME_PRICE, MORTGAGE_TRACE, ROUTE_PATH } from './_v3/mortgage-constants'

export const metadata: Metadata = pageMetadata({
  title: 'Mortgage Calculator for Home Buyers',
  description:
    'Estimate your monthly house payment from price, down payment, interest rate, and loan term. Central Oregon tax and insurance defaults included.',
  path: ROUTE_PATH,
})

type Props = {
  searchParams: Promise<{
    price?: string
    down?: string
    rate?: string
    term?: string
  }>
}

function formatPctPoints(n: number): string {
  return `${Number(n.toFixed(4))}%`
}

export default async function MortgageCalculatorPage({ searchParams }: Props) {
  const [sp, calcDefaults] = await Promise.all([searchParams, getCalculatorDefaults()])
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialDown = sp.down != null ? parseInt(sp.down, 10) : undefined
  const initialRate = sp.rate != null ? parseFloat(sp.rate) : calcDefaults.mortgageRate
  const initialTerm = sp.term != null ? parseInt(sp.term, 10) : undefined

  const defaultHomePrice = initialPrice ?? DEFAULT_HOME_PRICE
  const defaultPropertyTaxYear = Math.round((defaultHomePrice * calcDefaults.taxRatePct) / 100 / 50) * 50
  const defaultInsuranceYear = Math.round((defaultHomePrice * calcDefaults.insuranceRatePct) / 100 / 50) * 50

  const siteUrl = getCanonicalSiteUrl()
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Mortgage Calculator',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${siteUrl}${ROUTE_PATH}`,
    description:
      'Free mortgage calculator for Central Oregon home buyers. Estimate monthly payment from home price, down payment, interest rate, and loan term.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'RealEstateAgent', name: 'Ryan Realty', url: siteUrl },
  }

  const figures: V3InstrumentFigure[] = []
  if (calcDefaults.mortgageRate > 0) {
    figures.push({
      value: v3Text(formatPctPoints(calcDefaults.mortgageRate)),
      label: v3Text('starting interest rate'),
      href: '#calculator',
    })
  }
  if (calcDefaults.taxRatePct > 0) {
    figures.push({
      value: v3Text(formatPctPoints(calcDefaults.taxRatePct)),
      label: v3Text('starting property tax rate'),
      href: '#calculator',
    })
  }
  if (calcDefaults.insuranceRatePct > 0) {
    figures.push({
      value: v3Text(formatPctPoints(calcDefaults.insuranceRatePct)),
      label: v3Text('starting insurance rate'),
      href: '#calculator',
    })
  }
  const [firstFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Mortgage calculator', url: ROUTE_PATH },
      ],
    },
  ]

  const edgeItems: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'How it works',
      body: 'Enter price, down payment, rate, and term. Tax and insurance start at Central Oregon defaults you can change. PMI is 0.5 percent of the loan per year when the down payment is below 20 percent.',
    },
    {
      kind: 'prose',
      term: 'What the total is',
      body: 'An estimate, not a lender quote. Your payment will follow the rate your lender offers, the tax on that property, and the insurance you buy. HOA dues are not in this total.',
    },
    { label: 'Homes for sale in Central Oregon', href: listingsBrowsePath() },
    { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
    { label: 'Rental property calculator', href: '/tools/rental-property-calculator' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Tools' },
            { label: 'Mortgage calculator' },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="answer"
            level={1}
            eyebrow={v3Text('Central Oregon · before you offer')}
            headline={v3Text('Mortgage calculator for home buyers')}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(MORTGAGE_TRACE)}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(ROUTE_PATH),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="answer"
            heading="Mortgage calculator for home buyers"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'Starting rates are not on this page right now',
                body: 'The calculator below still runs on the numbers you type.',
              },
              { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
            ]}
          />
        )}

        <CalculatorSheet
          id="calculator"
          headingId="calculator-heading"
          eyebrow="Estimate"
          heading="Your monthly payment"
        >
          <MortgageCalculator
            initialHomePrice={initialPrice}
            initialDownPaymentPct={initialDown}
            initialInterestRate={initialRate}
            initialLoanTermYears={initialTerm}
            initialPropertyTaxYear={defaultPropertyTaxYear}
            initialInsuranceYear={defaultInsuranceYear}
            bare
          />
        </CalculatorSheet>

        <V3Quiet id="how-to-use" heading="How to use this calculator" items={edgeItems} />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

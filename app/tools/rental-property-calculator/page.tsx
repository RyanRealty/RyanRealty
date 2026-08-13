/**
 * /tools/rental-property-calculator — rental underwriting tool, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Rhythm: three of six,
 * no two adjacent alike. Order is Breadcrumb, Instrument level 1, Sheet
 * (calculator island), Quiet, Footer.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title "Rental Property
 * Calculator", SoftwareApplication JSON-LD, FAQPage JSON-LD from the same FAQ
 * array the Quiet block renders, searchParams pre-fill (price/rent/taxes/down/rate),
 * getCalculatorDefaults rate seed, RentalCalculator math (cash flow, cap rate,
 * cash-on-cash, 30-year projection, PDF, submitRentalLead), V3SectionTracker
 * pageType="tools". MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * SoftwareApplication stays a page-level script. MetadataBlock has no
 * SoftwareApplication input type.
 *
 * ONE PRIMARY PER VIEWPORT, counting visible filled controls. At 390 the
 * chrome CTA sits in the collapsed menu, so the Instrument ask is primary.
 * Label is Value my home (D11). valuationHref carries ?from=.
 *
 * KB-era deletions: KbHero, KbFooter, SmoothScrollProvider, kb.css, the
 * dedicated Browse / Talk to an agent button row (those doors now live in
 * Quiet), the separate how-to KB section (folded into Quiet with the FAQ).
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
import RentalCalculator from '@/components/tools/RentalCalculator'
import { CalculatorSheet } from './_v3/CalculatorSheet'
import { FAQ, RENTAL_TRACE, ROUTE_PATH } from './_v3/rental-constants'

export const metadata: Metadata = pageMetadata({
  title: 'Rental Property Calculator',
  description:
    'See whether rent covers the mortgage, taxes, insurance, and reserves on a Bend or Central Oregon rental. Cash flow, cap rate, cash-on-cash, and a long hold projection.',
  path: ROUTE_PATH,
})

type Props = {
  searchParams: Promise<{
    price?: string
    rent?: string
    taxes?: string
    down?: string
    rate?: string
  }>
}

function formatPctPoints(n: number): string {
  return `${Number(n.toFixed(4))}%`
}

export default async function RentalPropertyCalculatorPage({ searchParams }: Props) {
  const [sp, calcDefaults] = await Promise.all([searchParams, getCalculatorDefaults()])
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialRent = sp.rent ? parseInt(sp.rent, 10) : undefined
  const initialPropertyTaxesYear = sp.taxes ? parseInt(sp.taxes, 10) : undefined
  const initialDownPaymentPct = sp.down != null ? parseInt(sp.down, 10) : undefined
  const initialInterestRate = sp.rate != null ? parseFloat(sp.rate) : calcDefaults.mortgageRate

  const siteUrl = getCanonicalSiteUrl()
  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Rental Property Calculator',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${siteUrl}${ROUTE_PATH}`,
    description:
      'Free rental property calculator for Bend and Central Oregon. See monthly cash flow, cap rate, cash-on-cash return, total cash needed, and a 30-year projection.',
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
  const [firstFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Rental property calculator', url: ROUTE_PATH },
      ],
    },
    { type: 'faqPage', items: FAQ },
  ]

  const quietItems: V3QuietItem[] = [
    ...FAQ.map((item) => ({
      kind: 'prose' as const,
      term: item.question,
      body: item.answer,
    })),
    {
      kind: 'prose',
      term: 'How it works',
      body: 'Start with price and rent. Set down payment, rate, and term to match the loan you plan to use. Operating expenses start as editable defaults. Cash flow is what is left after the mortgage, taxes, insurance, management, and reserves.',
    },
    { label: 'Homes for sale in Central Oregon', href: listingsBrowsePath() },
    { label: 'Contact us', href: '/contact' },
    { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
    { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="tools" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Tools' },
            { label: 'Rental property calculator' },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="answer"
            level={1}
            eyebrow={v3Text('Central Oregon · before you buy a rental')}
            headline={v3Text('Rental property calculator')}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(RENTAL_TRACE)}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(ROUTE_PATH),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="answer"
            heading="Rental property calculator"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'Starting rate is not on this page right now',
                body: 'The calculator below still runs on the numbers you type.',
              },
              { label: 'Value my home', href: valuationHref(ROUTE_PATH) },
            ]}
          />
        )}

        <CalculatorSheet
          id="calculator"
          headingId="calculator-heading"
          eyebrow="Underwrite"
          heading="Run the numbers"
        >
          <RentalCalculator
            initialPrice={initialPrice}
            initialRent={initialRent}
            initialPropertyTaxesYear={initialPropertyTaxesYear}
            initialDownPaymentPct={initialDownPaymentPct}
            initialInterestRate={initialInterestRate}
            embedded
          />
        </CalculatorSheet>

        <V3Quiet id="faq" heading="Cash flow, cap rate, and more" items={quietItems} />
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

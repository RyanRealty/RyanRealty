/**
 * /buy/concessions: seller concessions for Bend buyers.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Rhythm: Breadcrumb,
 * Instrument (hero + stats), Sheet (calculator), Instrument (trend chart),
 * Quiet (caps), Ask (lead), Quiet (phone / fair housing), Footer.
 * No two adjacent patterns alike. Does not edit /buy layout, /buy/leverage,
 * or /buy/alerts.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatDate } from '@/lib/format/date'
import { getCalculatorDefaults } from '@/lib/data'
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import { listingsBrowsePath } from '@/lib/slug'
import { DEFAULT_COMPARE } from '@/lib/concessions/payment-math'
import { formatPriceExact } from '@/lib/format/money'
import {
  CONCESSION_QUERY_RUN,
  CONCESSION_SOURCE,
  CONCESSION_WINDOW_END,
  LAST_90D,
  ON_SCREEN,
} from '@/lib/concessions/results'
import EqualHousing from '@/components/legal/EqualHousing'
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
import { CalculatorSheet } from './_v3/CalculatorSheet'
import { ConcessionsCalculator } from './_v3/Calculator.client'
import { ConcessionsAsk } from './_v3/Ask.client'
import { buildConcessionShareChart } from './_v3/chart'
import { ConcessionsJsonLd } from './_v3/JsonLd'
import {
  DESCRIPTION,
  HERO_HEADLINE,
  HERO_LEDE,
  CALCULATOR_INTRO,
  CAPS_INTRO,
  LENDER_LINE,
  PHONE_HREF,
  PHONE_LABEL,
  ROUTE_PATH,
  RULES_REQUIRED_LINE,
  TITLE,
} from './_v3/constants'
import './_v3/concessions-page.css'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: ROUTE_PATH,
})

const schemas: SchemaInput[] = [
  {
    type: 'breadcrumb',
    items: [
      { name: 'Home', url: '/' },
      { name: 'Homes for sale', url: listingsBrowsePath() },
      { name: 'Seller concessions', url: ROUTE_PATH },
    ],
  },
  {
    type: 'webPage',
    name: TITLE,
    description: DESCRIPTION,
    url: ROUTE_PATH,
  },
]

export default async function BuyConcessionsPage() {
  const [liveRate, calcDefaults] = await Promise.all([
    getLiveMortgageRate(),
    getCalculatorDefaults(),
  ])
  const ratePct = liveRate?.ratePct ?? calcDefaults.mortgageRate
  const rateSourceLine = liveRate
    ? `Freddie Mac Primary Mortgage Market Survey, 30-year fixed ${ratePct.toFixed(2)}%, week of ${formatDate(liveRate.weekStart)}. ${liveRate.source}. Starting rate for this calculator; you can change it. Not a quote.`
    : `30-year fixed ${ratePct.toFixed(2)}% from the site calculator defaults (ingested weekly series). Starting rate for this calculator; you can change it. Not a quote.`

  const heroFigures: [V3InstrumentFigure, ...V3InstrumentFigure[]] = [
    {
      value: v3Text(ON_SCREEN.shareLabel),
      label: v3Text('Bend sales with a seller concession'),
      sentence: v3Text('At least half of recent Bend sales reported a seller credit.'),
    },
    {
      value: v3Text(formatPriceExact(ON_SCREEN.typicalDollars)),
      label: v3Text('typical concession'),
      sentence: v3Text('The median reported credit in that window.'),
    },
    {
      value: v3Text(ON_SCREEN.typicalPctLabel),
      label: v3Text('of the sale price'),
      sentence: v3Text('Median credit as a share of the close price.'),
    },
  ]

  const trendFigures: [V3InstrumentFigure, ...V3InstrumentFigure[]] = [
    {
      value: v3Text(`${ON_SCREEN.sep2025ShareRounded}%`),
      label: v3Text('Sep 2025 share'),
      sentence: v3Text('Lower-bound share of Bend sales that reported a concession that month.'),
    },
    {
      value: v3Text(`${ON_SCREEN.sep2026ShareRounded}%`),
      label: v3Text('Sep 2026 share'),
      sentence: v3Text('The same measure one year later.'),
    },
  ]

  const capItems: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'Conventional',
      body: 'Principal residence or second home: LTV over 90% is 3%, 75.01% to 90% is 6%, 75% and under is 9%. Investment property is 2%. Based on the lower of price or appraised value. Seller-funded buy-downs count toward the cap. The credit cannot exceed actual closing costs; excess is treated as a sales concession deducted from price. Fannie Mae Selling Guide B3-4.1-02, fetched 2026-10-13.',
    },
    {
      kind: 'prose',
      term: 'FHA, VA, USDA',
      body: 'FHA 6% of sales price (HUD Handbook 4000.1). VA 4% of reasonable value for concessions; normal buyer closing costs the seller pays are not counted toward that 4%. USDA 6%. Verify with your lender. Those three handbooks were not re-fetched this session.',
    },
    {
      kind: 'prose',
      term: 'RESPA',
      body: 'No kickbacks or referral fees. Seller credits must be disclosed on the Closing Disclosure. We give information only, not loans.',
    },
  ]

  const callItems: V3QuietItem[] = [
    {
      label: `Call ${PHONE_LABEL}`,
      href: PHONE_HREF,
      lead: true,
      detail: 'A broker will help you structure the credit on the offer.',
    },
    { label: 'Fair housing', href: '/fair-housing' },
    { label: 'Homes for sale in Bend', href: '/homes-for-sale/bend' },
    {
      kind: 'prose',
      body: 'Equal Housing Opportunity. Ryan Realty helps every buyer. We follow federal, Oregon, and local fair housing law.',
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <ConcessionsJsonLd schemas={schemas} />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: listingsBrowsePath() },
            { label: 'Seller concessions' },
          ]}
        />

        <V3Instrument
          id="answer"
          level={1}
          eyebrow={v3Text('Bend · last 90 days')}
          headline={v3Text(HERO_HEADLINE)}
          note={v3Text(HERO_LEDE)}
          figures={heroFigures}
          source={v3Text(CONCESSION_SOURCE)}
          sourceName={v3Text('Oregon Data Share')}
          updated={v3Text(formatDate(CONCESSION_QUERY_RUN))}
          asOf={CONCESSION_WINDOW_END}
          action={{
            label: v3Text('Compare a price cut to a concession'),
            href: '#calculator',
          }}
        />

        <CalculatorSheet
          id="calculator"
          headingId="calculator-heading"
          eyebrow="Payment"
          heading="Price cut vs the same dollars as a concession"
          lede={CALCULATOR_INTRO}
        >
          <ConcessionsCalculator
            initialPrice={DEFAULT_COMPARE.price}
            initialDownPct={DEFAULT_COMPARE.downPct}
            initialRatePct={ratePct}
            initialDollars={LAST_90D.medianDollars}
            rateSourceLine={rateSourceLine}
          />
        </CalculatorSheet>

        <V3Instrument
          id="trend"
          level={2}
          eyebrow={v3Text('Bend · Oct 2024 to Sep 2026')}
          headline={v3Text(
            `The share of Bend sales with a seller concession rose from ${ON_SCREEN.sep2025ShareRounded}% in Sep 2025 to ${ON_SCREEN.sep2026ShareRounded}% in Sep 2026.`,
          )}
          figures={trendFigures}
          chart={buildConcessionShareChart()}
          chartFirst
          source={v3Text(
            `${CONCESSION_SOURCE} Monthly series omits Oct 2026 because that month is partial.`,
          )}
          sourceName={v3Text('Oregon Data Share')}
          asOf={CONCESSION_WINDOW_END}
        />

        <V3Quiet
          id="caps"
          heading="What the caps are"
          headingLevel={2}
          alert={{
            title: LENDER_LINE,
            description: RULES_REQUIRED_LINE,
          }}
          items={capItems}
          note={CAPS_INTRO}
          source="Fannie Mae Selling Guide B3-4.1-02 (fetched 2026-10-13). FHA HUD Handbook 4000.1, VA Lenders Handbook M26-7 ch.8, USDA HB-1-3555 ch.6, and RESPA 12 USC 2607 were not re-fetched this session; verify with your lender."
        />

        <ConcessionsAsk />

        <V3Quiet id="call" heading="Talk now" headingLevel={2} items={callItems} />
        <div className="concessions-fair">
          <EqualHousing />
        </div>
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

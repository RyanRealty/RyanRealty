/**
 * /buy/concessions: seller concessions for Bend buyers. Paid-ad destination.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Rhythm: Breadcrumb on
 * the media, Stage (Bend photograph, the H1, the three sourced figures on the
 * navy band, one action to the instrument), Compare (the ad's "Same $10,000"
 * as a live instrument: the seller dollars scrubbed, two outcomes rolling on
 * one drawn scale), Instrument (the two-year share chart), Quiet (caps), Ask
 * (lead), Quiet (phone, fair housing), Footer. No two adjacent patterns alike.
 *
 * 2026-10-14 (Matt: "these are supposed to be landing pages"). The page used
 * to open on a cream Instrument and a six-field calculator grid built from the
 * admin register. It now opens the way /sell and /buy do, on a photograph with
 * the figures on the band, and the calculator is V3Compare, a barrel primitive.
 * Does not edit /buy layout, /buy/leverage, or /buy/alerts.
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
  V3Stage,
  type V3InstrumentFigure,
  type V3QuietItem,
  type V3StageFigure,
} from '@/components/site/v3'
import { ConcessionsCompare } from './_v3/Compare.client'
import { ConcessionsAsk } from './_v3/Ask.client'
import { buildConcessionShareChart } from './_v3/chart'
import { ConcessionsJsonLd } from './_v3/JsonLd'
import {
  DESCRIPTION,
  HERO_HEADLINE,
  CAPS_INTRO,
  LENDER_LINE,
  PHONE_HREF,
  PHONE_LABEL,
  POSTER,
  ROUTE_PATH,
  RULES_REQUIRED_LINE,
  STAGE_EYEBROW,
  TITLE,
} from './_v3/constants'
import './_v3/concessions-page.css'

export const revalidate = 3600

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: ROUTE_PATH,
  ogImage: POSTER,
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

  // The three figures on the band, each a door to the section that explains it.
  // Same values, same source trace as the trend instrument below (§0).
  const stageFigures: V3StageFigure[] = [
    {
      // Non-breaking spaces: "1 in 2" is one numeral and must not wrap at 375
      // (TASTE.md: wrapped numerals are a tell). The window is the eyebrow's.
      value: ON_SCREEN.shareLabel.replace(/ /g, '\u00a0'),
      label: 'Bend sales with a seller credit',
      href: '#trend',
    },
    {
      value: formatPriceExact(ON_SCREEN.typicalDollars),
      label: 'typical credit',
      href: '#calculator',
    },
    {
      value: ON_SCREEN.typicalPctLabel,
      label: 'of the sale price',
      href: '#trend',
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
    { label: 'Where buyers have leverage', href: '/buy/leverage' },
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
          tone="on-media"
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: listingsBrowsePath() },
            { label: 'Seller concessions' },
          ]}
        />

        <V3Stage
          id="answer"
          headingLevel={1}
          eyebrow={STAGE_EYEBROW}
          headline={HERO_HEADLINE}
          posterSrc={POSTER}
          action={{ label: 'Compare a price cut to a concession', href: '#calculator' }}
          inventory={{
            figures: stageFigures,
            source: CONCESSION_SOURCE,
            sourceName: 'Oregon Data Share',
            updatedAt: CONCESSION_QUERY_RUN,
          }}
        />

        <ConcessionsCompare
          initialPrice={DEFAULT_COMPARE.price}
          initialDownPct={DEFAULT_COMPARE.downPct}
          initialRatePct={ratePct}
          initialDollars={LAST_90D.medianDollars}
          rateSourceLine={rateSourceLine}
        />

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

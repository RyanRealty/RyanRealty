/**
 * /buy/concessions: seller concessions for Bend buyers. Paid-ad destination.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Rhythm: Breadcrumb on
 * the media, Stage (Bend photograph, the H1, the three sourced figures on the
 * navy band, one action to the instrument), Compare (the ad's "Same $10,000"
 * as a live instrument: the seller dollars scrubbed, two outcomes rolling on
 * one drawn scale), Instrument (the two-year share chart), Quiet (caps), Ask
 * (lead), Quiet (phone, fair housing), Footer; the caps are Answers, one row
 * per loan family with its source. No two adjacent patterns alike.
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
  V3Answers,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  V3Stage,
  type V3Answer,
  type V3InstrumentFigure,
  type V3QuietItem,
  type V3StageFigure,
} from '@/components/site/v3'
import { ConcessionsCompare } from './_v3/Compare.client'
import { ConcessionsAsk } from './_v3/Ask.client'
import { buildConcessionShareChart } from './_v3/chart'
import { ConcessionsJsonLd } from './_v3/JsonLd'
import {
  CAP_ANSWERS,
  DESCRIPTION,
  HERO_HEADLINE,
  CAPS_INTRO,
  LENDER_LINE,
  PHONE_HREF,
  PHONE_LABEL,
  POSTER,
  ROUTE_PATH,
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

  const capAnswers: V3Answer[] = CAP_ANSWERS.map((cap, i) => ({
    question: cap.question,
    body: cap.body,
    source: cap.source,
    open: i === 0,
  }))

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

        {/* Compact with the band kept (the /buy form): the ad's two figures
            in the instrument below break the 1440 fold instead of a cream
            void under the photograph. The window is in the trace, so the band
            carries no separate stamp (a wrapped "· as of" line at 375). */}
        <V3Stage
          id="answer"
          headingLevel={1}
          height="compact"
          bandWhenCompact
          eyebrow={STAGE_EYEBROW}
          headline={HERO_HEADLINE}
          posterSrc={POSTER}
          action={{ label: 'Compare a price cut to a concession', href: '#calculator' }}
          inventory={{
            figures: stageFigures,
            source: `${CONCESSION_SOURCE} Query run ${CONCESSION_QUERY_RUN}.`,
            sourceName: 'Oregon Data Share',
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

        <V3Answers
          id="caps"
          eyebrow="By loan type"
          heading="What the caps are"
          questions={capAnswers}
          note={`${CAPS_INTRO} ${LENDER_LINE}`}
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

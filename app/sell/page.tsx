/**
 * /sell - Sell: value and list. Stage then the cream value field.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Sell opens Stage then
 * Sheet. The address field is the only job on the first screen. Market is one
 * sentence, one chart, and a few live figures. Extra product types live on
 * /housing-market.
 *
 * Capture contract unchanged: SellValueForm posts submitSellerLPForm with
 * pagePath="/sell" and formId get-value.
 */

import type { Metadata } from 'next'
import { getBrokerageTrackRecord, getPriceHistory, getSellBendMarket, getSurfaceImage } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverOrCacheMonthly,
  dropCurrentMonth,
} from '@/lib/data/market-truth/public-monthly'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { zonedDateKey } from '@/lib/format/date'
import { valuationPath } from '@/lib/slug'
import { CONTACT } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
import { buildYearSeries } from '@/lib/kb/year-series'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3Sheet,
  V3Stage,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { liveStamp } from '@/app/_v3/live-format'
import { SellCapture } from './_v3/SellCapture'
import { SellValueForm } from './_v3/SellValueForm'
import {
  sellBendChart,
  sellBendFigures,
  sellBendHeadline,
  sellBendHud,
  sellBendSentence,
  sellBendTrace,
} from './_v3/sell-market'
import './_v3/sell-stage.css'
import {
  FAQ_ITEMS,
  FORM_ANCHOR,
  PLAN_STEPS,
  ROUTE_PATH,
  SELL_POSTER,
  SELL_REVIEW_AUTHORS,
  SELL_STAGE_EYEBROW,
  TRACK_RECORD_TRACE,
} from './_v3/sell-constants'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Sell Your Home in Central Oregon',
    description:
      'List your Central Oregon home with Ryan Realty. The listing fee is 3% of the sale price, photos within 48 hours of signing, and a written report every week it is listed.',
    path: ROUTE_PATH,
    ogImage: SELL_POSTER,
    keywords: [
      'sell home Bend Oregon',
      'Central Oregon home valuation',
      'list home Bend',
      'Ryan Realty seller',
    ],
  })
}

export default async function SellPage() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [bend, heroSrc, trackRecord, publicPace, leftoverMonthly, priceHist] = await Promise.all([
    getSellBendMarket(),
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: ROUTE_PATH,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }).catch(() => EMPTY_PUBLIC_PACE),
    getPublicDetachedMonthly({
      geoType: 'city',
      geoSlug: 'bend',
      currentMonthKey,
    }).catch(() => []),
    getPriceHistory('city', 'bend', 'monthly', 60).catch(() => []),
  ])

  const hud = sellBendHud(bend, publicPace)
  const figures = sellBendFigures(hud)
  const [firstBendFigure, ...restBendFigures] = figures
  const hasVerdict = Boolean(bend && hud.monthsSupply != null && hud.monthsSupply > 0)
  const verdictSentence = sellBendSentence(bend?.mosLabel ?? null, bend?.verdictLabel ?? null)
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, dropCurrentMonth(priceHist, currentMonthKey))
  const medianChart = sellBendChart(buildYearSeries(chartMonths.months, 5))
  const bendTrace = sellBendTrace(hasVerdict)
  const leftoverStamp = bend?.computedAt ?? null

  const reviews = TESTIMONIALS.filter((t) =>
    (SELL_REVIEW_AUTHORS as readonly string[]).includes(t.author),
  )

  const quietItems: V3QuietItem[] = FAQ_ITEMS.map((item) => ({
    kind: 'prose' as const,
    term: item.question,
    body: item.answer,
  }))

  if (trackRecord) {
    const volume = formatPriceCompact(trackRecord.totalVolume)
    const avg = formatPrice(trackRecord.avgSalePrice)
    quietItems.push({
      kind: 'prose',
      term: 'Closed sales listed by Ryan Realty',
      body: `${trackRecord.homesSold.toLocaleString('en-US')} homes sold, ${volume} closed volume, ${avg} average sale price. ${TRACK_RECORD_TRACE}`,
    })
  }

  for (const review of reviews) {
    quietItems.push({
      kind: 'prose',
      term: `${review.author}, Google review`,
      body: review.quote,
    })
  }

  quietItems.push(
    { label: 'Value my home', href: FORM_ANCHOR },
    { label: 'Written valuation page', href: valuationPath() },
    { label: `Call ${CONTACT.phoneDirect}`, href: `tel:${CONTACT.phoneDirectTel}` },
    { label: 'The 3% listing plan', href: '#listing-plan' },
  )

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Sell', url: ROUTE_PATH },
      ],
    },
    {
      type: 'service',
      name: 'Value my home',
      serviceType: 'Comparative market analysis',
      description:
        'A written comparative market analysis for a Central Oregon home. Three closed comps, three active comps, and the list-price range those six support.',
      url: ROUTE_PATH,
      areaServed: 'Bend, Oregon',
      providerOrganization: true,
    },
    { type: 'faqPage', items: FAQ_ITEMS },
  ]
  if (bend != null) {
    schemas.push({
      type: 'dataset',
      name: 'Bend housing market snapshot',
      description:
        'Detached single-family homes whose MLS City is Bend. Active count, months of supply, and market verdict from the regional MLS through Oregon Data Share. Not the city-limits polygon.',
      url: ROUTE_PATH,
      dateModified: bend.computedAt,
      spatialCoverageName: 'Bend, Oregon',
      variableMeasured: [
        { name: 'Homes for sale', value: bend.activeCount },
        { name: 'Months of supply', value: bend.mosLabel, unitText: 'months' },
        { name: 'Market verdict', value: bend.verdictLabel },
      ],
    })
  }

  const posterSrc = heroSrc ?? SELL_POSTER

  return (
    <>
      <main className={`${V3_ROOT_CLASS} sell-page`}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />

        <V3Breadcrumb
          tone="on-media"
          trail={[{ label: 'Home', href: '/' }, { label: 'Sell' }]}
        />

        <V3Stage
          headingLevel={1}
          height="compact"
          className="sell-stage-poster"
          eyebrow={SELL_STAGE_EYEBROW}
          headline="Sell your home in Central Oregon"
          posterSrc={posterSrc}
          action={{ label: 'Value my home', href: FORM_ANCHOR, variant: 'ghost' }}
        />

        <SellCapture className="sell-value-sheet" eyebrow="Free. No listing agreement.">
          <SellValueForm pagePath={ROUTE_PATH} />
        </SellCapture>

        {firstBendFigure ? (
          <V3Instrument
            id="bend-market"
            level={2}
            eyebrow={v3Text('Bend, Oregon')}
            headline={sellBendHeadline(hasVerdict)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstBendFigure, ...restBendFigures]}
            source={v3Text(bendTrace)}
            chart={medianChart}
            chartFirst
            updated={liveStamp(leftoverStamp)}
            action={{
              label: v3Text('See condos, lots, farms, and businesses'),
              href: '/housing-market',
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Quiet
            id="bend-market"
            heading="How tight Bend is"
            items={[
              {
                kind: 'prose',
                body: 'Bend months of supply is not on this page right now. The number comes from live inventory divided by the six-month close pace. Value the house first.',
              },
              { label: 'Value my home', href: FORM_ANCHOR },
              { label: 'Months of supply, defined', href: '/months-of-supply' },
              { label: 'See condos, lots, farms, and businesses', href: '/housing-market' },
            ]}
          />
        )}

        <V3Sheet
          id="listing-plan"
          heading="The 3% listing plan"
          eyebrow="One plan. Enhanced inclusions. No add-on fees."
          steps={PLAN_STEPS}
          showEcho={false}
          showProgress={false}
        />

        <V3Quiet
          id="selling-questions"
          heading="Selling questions"
          items={quietItems}
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

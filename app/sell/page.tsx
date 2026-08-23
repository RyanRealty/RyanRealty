/**
 * /sell - the Sell destination, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Sell
 * destinations open Stage then Sheet. Four of the six patterns, no two adjacent
 * alike. Order, deletions, and per-section reasoning live in
 * design_system/ryan-realty/ui_kits/sell/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata (title "Sell Your Home in Central Oregon"), MetadataBlock
 * JSON-LD (BreadcrumbList + FAQPage), V3SectionTracker pageType="sell",
 * revalidate 300, route /sell, and the capture contract. SellValueForm
 * posts through submitSellerLPForm with pagePath="/sell" and formId get-value.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D11: visible CTA copy is "Value my home" once, on the address-field submit.
 * Title/meta keep search-demand language. Stage is poster + H1 + quiet 3%
 * eyebrow. The primitive still requires an action prop. The page hides it.
 *
 * One derivation for months of supply: marketVerdict reads the RAW value,
 * formatMonthsOfSupply prints it, and the Instrument source line carries
 * MOS_METHODOLOGY_CLAUSE + MOS_THRESHOLD_CLAUSE. Rounding before classifying
 * is what this ordering prevents.
 *
 * One filled primary in the first 390 viewport: the capture Sheet submit.
 * Chrome Value my home is off /sell (the field is the ask) and on /sell/* leaves.
 * Stage ghost is gone.
 * Stage is compact so the H1 clears chrome and the address step shares
 * the first viewport.
 */

import type { Metadata } from 'next'
import {
  getBrokerageTrackRecord,
  getSellBendMarket,
  getSurfaceImage,
} from '@/lib/data'
import { getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath, valuationPath } from '@/lib/slug'
import { CONTACT } from '@/lib/brand/contact'
import { TESTIMONIALS } from '@/lib/testimonials'
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
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SellCapture } from './_v3/SellCapture'
import { SellValueForm } from './_v3/SellValueForm'
import './_v3/sell-stage.css'
import {
  BEND_MARKET_TRACE_SCOPE,
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
  const [bend, heroSrc, trackRecord, publicPace] = await Promise.all([
    getSellBendMarket(),
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: ROUTE_PATH,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }),
  ])

  const bendFigures: V3InstrumentFigure[] = []
  if (bend?.medianListPrice != null) {
    bendFigures.push({
      value: v3Text(formatPrice(bend.medianListPrice)),
      label: v3Text('median list price'),
      href: '/housing-market/bend',
    })
  }
  if (bend != null) {
    bendFigures.push({
      value: v3Text(bend.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: listingsBrowsePath(),
    })
  }
  if (bend != null) {
    bendFigures.push({
      value: v3Text(bend.mosLabel),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  for (const item of publicPaceItems(publicPace)) {
    bendFigures.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  const [firstBendFigure, ...restBendFigures] = bendFigures

  const leftoverTrace =
    publicPaceItems(publicPace).length > 0
      ? ' Leftover pace stats are 12-month Market Truth cells except pending and inventory age, which are point-in-time.'
      : ''
  const bendTrace =
    bend != null
      ? `${BEND_MARKET_TRACE_SCOPE} ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}${leftoverTrace}`
      : BEND_MARKET_TRACE_SCOPE

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
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
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
        'Detached single-family homes whose MLS City is Bend. Active count, months of supply, and market verdict from Market Truth. Not the city-limits polygon.',
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
      <main className={V3_ROOT_CLASS}>
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

        <SellCapture eyebrow="Free. No listing agreement.">
          <SellValueForm pagePath={ROUTE_PATH} />
        </SellCapture>

        {bend && firstBendFigure ? (
          <V3Instrument
            id="bend-market"
            level={2}
            eyebrow={v3Text('Bend, Oregon')}
            headline={v3Text(`Bend housing market: a ${bend.verdictLabel}`)}
            figures={[firstBendFigure, ...restBendFigures]}
            source={v3Text(bendTrace)}
            updated={v3Text(formatDate(bend.computedAt))}
            action={{
              label: v3Text('Value my home'),
              href: FORM_ANCHOR,
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Quiet
            id="bend-market"
            heading="Bend supply"
            items={[
              {
                kind: 'prose',
                body: 'Bend months of supply is not on this page right now. The number comes from live inventory divided by the six-month close pace. Value the house first.',
              },
              { label: 'Value my home', href: FORM_ANCHOR },
              { label: 'Months of supply, defined', href: '/months-of-supply' },
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

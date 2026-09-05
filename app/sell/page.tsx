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
 * Stage is tall: the photograph carries the H1 and the address ask, so
 * the first viewport is the working surface, not a cream void under a still.
 */

import type { Metadata } from 'next'
import {
  getBrokerageTrackRecord,
  getReviews,
  getSellBendMarket,
  getSurfaceImage,
} from '@/lib/data'
import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import { getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments, publicSegmentItems } from '@/lib/data/market-truth/public-segments'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPrice, formatPriceExact, formatPriceCompact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath, valuationPath } from '@/lib/slug'
import { CONTACT } from '@/lib/brand/contact'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Proof,
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
  const [bend, heroSrc, trackRecord, publicPace, publicSegments, reviewSummary] = await Promise.all([
    getSellBendMarket(),
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: ROUTE_PATH,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }),
    getPublicPlaceSegments({ geoType: 'city', geoSlug: 'bend' }),
    getReviews(6).catch(() => null),
  ])

  const bendFigures: V3InstrumentFigure[] = []
  if (bend?.medianListPrice != null) {
    bendFigures.push({
      // formatPriceExact: the SAME median printed $939,900 on /, /cities and
      // /cities/bend and $940,000 here on the same day (2026-08-27 audit). One
      // statistic, one spelling, site-wide.
      value: v3Text(formatPriceExact(bend.medianListPrice)),
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
  for (const item of publicSegmentItems(publicSegments, 'bend')) {
    bendFigures.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
      href: item.href,
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
  const extraTrace =
    publicSegmentItems(publicSegments, 'bend').length > 0
      ? ' Extra product types are Market Truth, sample-gated.'
      : ''
  const bendTrace =
    bend != null
      ? `${BEND_MARKET_TRACE_SCOPE} ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}${leftoverTrace}${extraTrace}`
      : BEND_MARKET_TRACE_SCOPE

  const reviewQuotes = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewCount =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : reviewQuotes.length
  const reviewAverage =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const newestReview = reviewQuotes.find((q) => q.date)?.date ?? null

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
          height="tall"
          className="sell-stage-poster"
          eyebrow={SELL_STAGE_EYEBROW}
          headline="Sell your home in Central Oregon"
          posterSrc={posterSrc}
          action={{ label: 'Value my home', href: FORM_ANCHOR, variant: 'ghost' }}
        >
          <SellCapture eyebrow="Free. No listing agreement." placement="stage">
            <SellValueForm pagePath={ROUTE_PATH} />
          </SellCapture>
        </V3Stage>

        {bend && firstBendFigure ? (
          <V3Instrument
            id="bend-market"
            level={2}
            eyebrow={v3Text('Bend, Oregon')}
            headline={v3Text(`Bend housing market: a ${bend.verdictLabel}`)}
            note={v3Text(
              `${bend.activeCount.toLocaleString('en-US')} detached homes for sale. ${bend.mosLabel} months of supply is a ${bend.verdictLabel}.`,
            )}
            figures={[firstBendFigure, ...restBendFigures]}
            foldAfter={3}
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
          className="sell-plan"
          heading="The 3% listing plan"
          eyebrow="One plan. Enhanced inclusions. No add-on fees."
          steps={PLAN_STEPS}
          showEcho={false}
          showProgress={false}
        />

        {reviewQuotes.length > 0 ? (
          <V3Proof
            id="reviews"
            eyebrow="Ryan Realty · Google"
            headline={`${reviewCount} Google reviews`}
            headingLevel={2}
            claim={`${reviewAverage.toFixed(1)} of 5 across ${reviewCount} reviews. The newest four, in full, as written.`}
            figures={[
              { value: String(reviewCount), label: 'Google reviews' },
              { value: reviewAverage.toFixed(1), label: 'average of 5' },
              ...(newestReview
                ? [
                    {
                      value: formatDate(newestReview, {
                        month: 'short',
                        day: undefined,
                        year: 'numeric',
                      }),
                      label: 'newest',
                    },
                  ]
                : []),
            ]}
            quotes={reviewQuotes}
            source={{ label: 'Every review', href: '/reviews' }}
            record={false}
          />
        ) : null}

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

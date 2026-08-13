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
 * revalidate 300, route /sell, and the capture contract. SellerLPForm still
 * posts through submitSellerLPForm with pagePath="/sell" and formId get-value.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D11: visible CTA copy is "Value my home". The form's own heading is owned by
 * SellerLPForm (untouched this lease). Title/meta keep search-demand language.
 *
 * One derivation for months of supply: marketVerdict reads the RAW value,
 * formatMonthsOfSupply prints it, and the Instrument source line carries
 * MOS_METHODOLOGY_CLAUSE + MOS_THRESHOLD_CLAUSE. Rounding before classifying
 * is what this ordering prevents.
 *
 * One primary per viewport after chrome: the sticky header already carries a
 * filled valuation CTA, so the Instrument ask is ghost. V3Stage hardcodes
 * primary. That two-primary collision is chrome's, not a per-page workaround.
 */

import type { Metadata } from 'next'
import {
  getBrokerageTrackRecord,
  getMarketPulse,
  getSurfaceImage,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  marketVerdict,
  MOS_METHODOLOGY_CLAUSE,
  MOS_THRESHOLD_CLAUSE,
} from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
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
import SellerLPForm from '@/app/lp/seller-home-value/SellerLPForm'
import { SellCapture } from './_v3/SellCapture'
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
  const [pulse, heroSrc, trackRecord] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug: 'bend' }),
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: ROUTE_PATH,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
  ])

  const mosRaw =
    pulse?.monthsOfSupply != null && pulse.monthsOfSupply > 0 ? pulse.monthsOfSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw == null ? null : formatMonthsOfSupply(mosRaw)

  const bendFigures: V3InstrumentFigure[] = []
  if (pulse?.medianListPrice != null) {
    bendFigures.push({
      value: v3Text(formatPrice(pulse.medianListPrice)),
      label: v3Text('median list price'),
      href: '/housing-market/bend',
    })
  }
  if (pulse != null) {
    bendFigures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: listingsBrowsePath(),
    })
  }
  if (mosLabel != null) {
    bendFigures.push({
      value: v3Text(mosLabel),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  if (pulse?.medianDaysToPending != null) {
    bendFigures.push({
      value: v3Text(String(pulse.medianDaysToPending)),
      label: v3Text('median days to pending'),
      href: '/housing-market/bend',
    })
  }
  const [firstBendFigure, ...restBendFigures] = bendFigures

  const bendTrace =
    mosLabel != null
      ? `${BEND_MARKET_TRACE_SCOPE} ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`
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

  const posterSrc = heroSrc ?? SELL_POSTER

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker pageType="sell" />

        <V3Breadcrumb
          tone="on-media"
          trail={[{ label: 'Home', href: '/' }, { label: 'Sell' }]}
        />

        <V3Stage
          headingLevel={1}
          height="tall"
          eyebrow={SELL_STAGE_EYEBROW}
          headline="Sell your home in Central Oregon"
          posterSrc={posterSrc}
          action={{ label: 'Value my home', href: FORM_ANCHOR }}
        />

        <SellCapture eyebrow="Free. No listing agreement." ariaLabel="Get your home's value">
          <SellerLPForm knownVisitor={false} pagePath={ROUTE_PATH} />
        </SellCapture>

        {firstBendFigure ? (
          <V3Instrument
            id="bend-market"
            level={2}
            eyebrow={v3Text('Bend, Oregon')}
            headline={v3Text(
              verdict.kind === 'unknown'
                ? 'Bend housing market'
                : `Bend housing market: a ${verdict.label}`,
            )}
            figures={[firstBendFigure, ...restBendFigures]}
            source={v3Text(bendTrace)}
            updated={pulse?.refreshedAt ? v3Text(formatDate(pulse.refreshedAt)) : undefined}
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

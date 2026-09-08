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
  getBrokerageListings,
  getBrokerageTrackRecord,
  getBrokers,
  getProofBlock,
  getSellBendMarket,
  getSurfaceImage,
} from '@/lib/data'
import { applyDetachedOverlay } from '@/lib/data/market-truth/getSellBendMarket'
import { stickyAskVerdict } from '@/lib/sticky-ask'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { readAttributedAgentServer } from '@/app/actions/agent-attribution-read'
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
  V3Ledger,
  V3ProofBlock,
  V3Quiet,
  V3Sheet,
  V3Stage,
  V3StickyAsk,
  V3SectionTracker,
  proofBlockView,
  type V3InstrumentFigure,
  type V3ProofReach,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SellCapture } from './_v3/SellCapture'
import { SellValueForm } from './_v3/SellValueForm'
import { sellBendLedgerRows } from './_v3/sell-market-rows'
import { sellListingRows, OUR_LISTINGS_TRACE } from './_v3/sell-listings'
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
      'List your Central Oregon home with Ryan Realty. One 3% listing plan with everything included, professional photos within 48 hours of signing, and a written report every week you are on the market. Local experts, exceptional customer service.',
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
  const [
    bend,
    heroSrc,
    trackRecord,
    publicPace,
    publicSegments,
    listings,
    proof,
    brokers,
    attributed,
  ] = await Promise.all([
    getSellBendMarket(),
    getSurfaceImage('hero', {
      geoTags: ['central-oregon'],
      seed: ROUTE_PATH,
      fallback: SELL_POSTER,
    }),
    getBrokerageTrackRecord(),
    getPublicDetachedPace({ geoType: 'city', geoSlug: 'bend' }),
    getPublicPlaceSegments({ geoType: 'city', geoSlug: 'bend' }),
    getBrokerageListings().catch(() => []),
    getProofBlock({ geoType: 'city', geoSlug: 'bend', geoLabel: 'Bend' }).catch(() => null),
    getBrokers().catch(() => []),
    readAttributedAgentServer().catch(() => null),
  ])

  // SITE-05. The sticky control's tail must print the SAME months of supply the
  // Instrument below prints, or the page contradicts itself while both are on
  // screen (§0).
  //
  // So it is fed from getSellBendMarket — the one read this page already makes
  // — shaped into the pulse row stickyAskVerdict expects by applyDetachedOverlay,
  // the helper that exists to put Market Truth DETACHED figures onto a pulse-
  // shaped row. This page never reads the live pulse table at all: that is the
  // rule that stops /sell publishing the mixed-type bucket (488 active / 3.54
  // months) as if it were the detached market, and it is asserted in
  // lib/data/market-truth/getSellBendMarket.test.ts.
  const bendPulse = bend
    ? applyDetachedOverlay({ monthsOfSupply: null as number | null, refreshedAt: '' }, bend)
    : null
  const sellVerdict = stickyAskVerdict(bendPulse)

  // SITE-11. The reach strip carries the broker this page routes the lead to —
  // the attributed agent when an ad sent them, Matt otherwise — and its number
  // comes off the live roster through the DAL, never a literal (G38).
  const routedSlug = attributed?.broker ?? 'matt'
  const routedFace: AboutFace | null =
    brokers
      .map((b) => aboutFaceFromBroker(b))
      .find((face): face is AboutFace => face !== null && face.href.endsWith(`/${routedSlug}`)) ??
    brokers.map((b) => aboutFaceFromBroker(b)).find((face): face is AboutFace => face !== null) ??
    null
  const reach: V3ProofReach[] = routedFace
    ? [
        ...(routedFace.tel
          ? ([
              {
                key: 'call',
                kind: 'call',
                href: `tel:${routedFace.tel}`,
                label: `Call ${routedFace.name}`,
              },
              {
                key: 'text',
                kind: 'text',
                href: `sms:${routedFace.tel}`,
                label: `Text ${routedFace.name}`,
              },
            ] as V3ProofReach[])
          : []),
        ...(routedFace.bookHref
          ? ([
              { key: 'book', kind: 'book', href: routedFace.bookHref, label: 'Book a call' },
            ] as V3ProofReach[])
          : []),
      ]
    : []

  // MATT HAS NOT RULED on publishing the two outcome strips: our closings read
  // slower and lower than Bend's own median this window, and whether a seller
  // page leads with that is his call. showOutcomes:false ships the record, the
  // reviews and the reach now; the strips return by flipping this one prop.
  const proofView = proof
    ? proofBlockView({
        block: proof,
        id: 'proof',
        headingLevel: 2,
        attribution: { surface: 'sell', place: 'bend', source: 'proof_block' },
        reach,
        showOutcomes: false,
      })
    : null

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
  const [firstBendFigure, ...restBendFigures] = bendFigures
  const alsoRows = sellBendLedgerRows(publicSegments, publicPace)
  const [firstAlsoRow, ...restAlsoRows] = alsoRows

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
      ? `${BEND_MARKET_TRACE_SCOPE} ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}`
      : BEND_MARKET_TRACE_SCOPE

  const listingRows = sellListingRows(listings)
  const [firstListing, ...restListings] = listingRows

  // The reviews arrive inside the proof block now (getProofBlock reads the same
  // Google reviews getReviews did), so the page no longer pulls them twice.
  const proofReviewCount = proof?.reviews?.count ?? 0

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
    ...(proofReviewCount > 0
      ? [{ label: `All ${proofReviewCount} Google reviews`, href: '/reviews' }]
      : [{ label: 'Google reviews', href: '/reviews' }]),
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
          id="sell-hero"
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

        {proofView ? (
          <V3ProofBlock
            {...proofView}
            // The quiet form (strips off) has no drawing to fill the left
            // column. sell-answer.css collapses the body to one column for
            // this instance only; the class goes away when the strips come on.
            className={proofView.strips.length === 0 ? 'sell-proof--quiet' : undefined}
          />
        ) : null}

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

        {firstAlsoRow ? (
          <V3Ledger
            id="bend-also"
            eyebrow={v3Text('Bend, Oregon')}
            heading={v3Text('What else is listed, and how listings move')}
            rows={[firstAlsoRow, ...restAlsoRows]}
            encode="bar"
            source={v3Text(
              `${BEND_MARKET_TRACE_SCOPE}${leftoverTrace}${extraTrace}`.trim(),
            )}
            updated={bend ? v3Text(formatDate(bend.computedAt)) : undefined}
            action={{ label: v3Text('Full Bend market report'), href: '/housing-market/bend' }}
          />
        ) : null}

        <V3Sheet
          id="listing-plan"
          className="sell-plan"
          heading="The 3% listing plan"
          eyebrow="One plan. Enhanced inclusions. No add-on fees."
          steps={PLAN_STEPS}
          showEcho={false}
          showProgress={false}
        />

        {/* The reviews used to have their own V3Proof band here. V3ProofBlock
            now carries them, in full and as written, directly under the ask —
            which is where proof does its work on a seller page. Two reviews
            sections on one page is the "second way to show the same thing"
            TASTE.md calls how one site becomes two, so this one is gone rather
            than duplicated. The reviews door lives on in the Quiet block. */}
        {firstListing ? (
          <V3Ledger
            id="our-listings"
            eyebrow={v3Text('Ryan Realty')}
            heading={v3Text('Our listings')}
            rows={[firstListing, ...restListings]}
            source={v3Text(OUR_LISTINGS_TRACE)}
            action={{ label: v3Text('All office listings'), href: '/our-homes' }}
          />
        ) : (
          <V3Ledger
            id="our-listings"
            eyebrow={v3Text('Ryan Realty')}
            heading={v3Text('Our listings')}
            rows={[]}
            emptyMessage={v3Text(
              'No Ryan Realty office listing is on the market in this refresh.',
            )}
            action={{ label: v3Text('Homes for sale'), href: '/homes-for-sale' }}
          />
        )}

        <V3Quiet
          id="selling-questions"
          heading="Selling questions"
          items={quietItems}
        />

        {/* SITE-05. A direct child of main, never inside a hidden ancestor: the
            control watches #sell-hero and #get-value with IntersectionObserver,
            and an observer inside a display:none subtree reports nothing. It
            appears once the hero is fully past and retires whenever the address
            field it points at is on screen, so the page never carries three
            asks at once (PUBLIC_UI §1). */}
        <V3StickyAsk
          href={FORM_ANCHOR}
          label="Value my home"
          verdict={sellVerdict}
          place="Bend"
          surface="sell"
          sentinelId="sell-hero"
          targetId="get-value"
          focusId="get-value-address"
        />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

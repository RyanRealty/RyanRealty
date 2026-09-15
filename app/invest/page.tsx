/**
 * /invest — the investor door (Matt ruling 2026-09-01, decisions.md).
 *
 * HONEST BY CONSTRUCTION (§0): every figure is a live Market Truth segment
 * row (getPublicPlaceSegments, region grain) plus this week's 30-year fixed
 * off `market_history_weekly` (Freddie Mac PMMS30). No cash-flow, rent, or
 * yield: those need a live rent source this site does not publish.
 *
 * SITE-98: catalog demos install before house paint. The opening is still
 * the land-not-buildings finding (V3Pulse). beautifului-insight
 * (InsightPager + scrubber) pages the same counts. shadcn Table is the
 * segment board and the live listing inventory (price, address, beds /
 * baths / sqft or acres). V3Ledger keeps crawlable doors.
 *
 * Data ONLY through @/lib/data and @/app/actions.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildJsonLd } from '@/lib/site/json-ld'
import { formatDate, formatDateTime } from '@/lib/format/date'
import {
  publicSegmentNoun,
  publicSegmentDisplayBits,
  publicSegmentBrowseHref,
} from '@/lib/data/market-truth/public-segments'
import { INVEST_SEGMENTS } from '@/lib/invest/segments'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Ledger,
  V3Pulse,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { investListingFacts } from './_v3/invest-listings'
import { InvestAlertSheet } from './_v3/InvestAlertSheet.client'
import { InvestInsight } from './_v3/InvestInsight.client'
import { InvestTables } from './_v3/InvestTables.client'
import { loadInvestBoard } from './_v3/load-invest-board'

export const revalidate = 3600

const TITLE = 'Investment property in Central Oregon'
const DESCRIPTION =
  'Multi-family, commercial, and land listings across Central Oregon with live MLS counts. Rental math stays on the calculators — this page publishes no rent or yield.'

export async function generateMetadata(): Promise<Metadata> {
  const board = await loadInvestBoard()
  const total = board.insightPages.reduce((sum, page) => sum + page.count, 0)
  const description =
    total > 0
      ? `${total.toLocaleString('en-US')} income listings on the regional MLS right now — lots, commercial, two-to-four-unit buildings, farms. No rent or yield: that math needs a rent only you know.`
      : DESCRIPTION
  return pageMetadata({
    title: TITLE,
    description,
    path: '/invest',
  })
}

const SEGMENT_TRACE =
  'regional MLS through Oregon Data Share, read through the Market Truth metric layer: active listings per property type across Central Oregon. A figure the layer withheld is absent, not estimated'

export default async function InvestPage() {
  const board = await loadInvestBoard()
  const { segments, listings, insightPages, segmentRows, pulse, liveRate, listingsOk } = board
  const bySegment = new Map(segments.map((row) => [row.segment, row]))
  const typeDoorRows: V3LedgerFigureRow[] = INVEST_SEGMENTS.flatMap((key) => {
    const row = bySegment.get(key)
    if (!row || row.activeCount == null || row.activeCount <= 0) return []
    const count = row.activeCount
    const noun = publicSegmentNoun(row.segment, count)
    const bits = publicSegmentDisplayBits(row).slice(0, 2)
    return [
      {
        id: row.segment,
        href: publicSegmentBrowseHref(null, row.segment),
        what: v3Text(noun.charAt(0).toUpperCase() + noun.slice(1)),
        ...(bits.length > 0 ? { detail: v3Text(bits.join(' · ')) } : {}),
        value: v3Text(`${count.toLocaleString('en-US')} active`),
      },
    ]
  })
  const listingDoorRows: V3LedgerFigureRow[] = listings.map((row) => {
    const facts = investListingFacts(row)
    return {
      id: row.listingKey,
      href: row.href,
      what: v3Text(row.address),
      detail: v3Text([row.city, facts].filter(Boolean).join(' · ')),
      value: v3Text(row.price),
    }
  })
  const searchRows = listingDoorRows.length > 0 ? listingDoorRows : typeDoorRows
  const [firstSearchRow, ...restSearchRows] = searchRows

  const rateFact: V3QuietItem[] =
    liveRate != null
      ? [
          {
            kind: 'fact',
            term: 'A 30-year fixed, this week',
            value: `${liveRate.ratePct.toFixed(2)}%`,
            detail: `Freddie Mac PMMS · week of ${formatDate(liveRate.weekStart)}`,
          },
        ]
      : []

  const RATE_TRACE = liveRate
    ? `Freddie Mac Primary Mortgage Market Survey, the published 30-year fixed average for the week beginning ${formatDate(liveRate.weekStart)}, which is ${liveRate.ratePct.toFixed(2)}%. Read from market_history_weekly (geo national/us, metric mortgage_rate_30yr, source ${liveRate.source}) and captured by the weekly snapshot cron at ${formatDateTime(liveRate.capturedAt)}. It is a national owner-occupied average, not a quote and not an investor rate — investor terms run above it, and it is the floor your own math starts from. This page publishes no rent, no yield and no cash-flow figure: the rent side of that math has no live source here, so the calculators below take your own rent and your own terms.`
    : undefined

  const toolItems: V3QuietItem[] = [
    ...rateFact,
    {
      label: 'Rental property calculator',
      href: '/tools/rental-property-calculator',
      detail: 'Your rent, your rate, your expenses — the answer before the tour.',
      lead: true,
    },
    { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
    { label: 'Central Oregon market report', href: '/housing-market' },
    { label: 'Every city', href: '/cities' },
    { label: 'Talk to a broker', href: '/contact' },
  ]

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Invest', href: '/invest' },
  ]

  const listingListItems = listings.map((row) => ({
    name: `${row.address}, ${row.city} · ${row.price}`,
    url: row.href,
  }))
  const typeListItems = segmentRows.map((row) => ({
    name: `${row.type} · ${row.count}`,
    url: row.href,
  }))

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildJsonLd({
                type: 'breadcrumb',
                items: trail.map((t) => ({ name: t.label, url: t.href })),
              }),
            ),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildJsonLd({
                type: 'webPage',
                pageType: 'CollectionPage',
                name: TITLE,
                description: DESCRIPTION,
                url: '/invest',
              }),
            ),
          }}
        />
        {typeListItems.length > 0 || listingListItems.length > 0 ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(
                buildJsonLd({
                  type: 'itemList',
                  name: 'Central Oregon income property',
                  items: [...typeListItems, ...listingListItems],
                }),
              ),
            }}
          />
        ) : null}
        <V3Breadcrumb trail={trail} />

        {pulse ? (
          <V3Pulse {...pulse} />
        ) : (
          <V3Quiet
            id="place"
            heading="Investment property in Central Oregon"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                body: 'The live counts are not reading right now. Every multi-family, commercial, land, farm, and business listing on the regional MLS across Central Oregon is still browsable below.',
              },
              { label: 'Every home for sale', href: '/homes-for-sale?view=list' },
            ]}
          />
        )}

        {insightPages.length > 0 ? (
          <div id="place-insight">
            <InvestInsight pages={insightPages} />
          </div>
        ) : null}

        <InvestTables
          segments={segmentRows}
          listings={listingsOk ? listings : []}
          source={SEGMENT_TRACE}
        />

        {firstSearchRow ? (
          <V3Ledger
            id="searches"
            eyebrow={v3Text(listingDoorRows.length > 0 ? 'Central Oregon · Live inventory' : 'Central Oregon · By property type')}
            heading={v3Text(listingDoorRows.length > 0 ? 'Priced addresses on the income side' : 'What is for sale, and how it trades')}
            rows={[firstSearchRow, ...restSearchRows]}
            source={v3Text(SEGMENT_TRACE)}
            action={{ label: v3Text('Every home for sale'), href: '/homes-for-sale?view=list' }}
          />
        ) : null}

        <V3Quiet
          id="tools"
          heading="Run the numbers"
          items={toolItems}
          {...(RATE_TRACE ? { source: RATE_TRACE } : {})}
        />

        <InvestAlertSheet />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

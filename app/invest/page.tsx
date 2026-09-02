/**
 * /invest — the investor door (Matt ruling 2026-09-01, decisions.md).
 *
 * HONEST BY CONSTRUCTION (§0): every figure on this page is a live Market
 * Truth segment row (getPublicPlaceSegments, region grain) — the same numbers
 * the housing-market page and the search pages print, one source. The page
 * makes NO cash-flow promise: the DSCR analysis (2026-08, internal) showed
 * Bend does not cash-flow on long-term rentals at financing rates, so the
 * page's stance is "here is the inventory, here is the math, run your own
 * numbers" — search doors, the rental calculator, and the per-listing rental
 * analysis. Stale internal analysis numbers are NOT republished here.
 *
 * Patterns: Quiet #place (H1 + stance) → Instrument #market (income-market
 * figures) → Ledger #searches (live per-type doors) → Quiet #tools (the math
 * doors) → Sheet #alerts (income-property capture). No two adjacent share a
 * pattern. Section order is the parity contract at
 * design_system/ryan-realty/ui_kits/invest/parity.json.
 * Data ONLY through @/lib/data and @/app/actions.
 */

import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildJsonLd } from '@/lib/site/json-ld'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  getPublicPlaceSegments,
  publicSegmentNoun,
  publicSegmentDisplayBits,
  publicSegmentBrowseHref,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { formatIndexMedianUsd } from '@/lib/market/publish-index-median'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { InvestAlertSheet } from './_v3/InvestAlertSheet.client'

export const revalidate = 1800

const TITLE = 'Investment Property in Central Oregon | Multi-Family, Commercial, Land'
const DESCRIPTION =
  'Multi-family, commercial, and land listings across Central Oregon with live counts and market data from the regional MLS. Rental math on every eligible listing.'

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/invest',
})

/** The income-side segments, in door order. Detached is the buyer story, not this page's. */
const INVEST_SEGMENTS = ['multifamily_2_4', 'commercial_sale', 'land', 'farm', 'business'] as const

const SEGMENT_TRACE =
  'regional MLS through Oregon Data Share, read through the Market Truth metric layer: active listings per property type across Central Oregon. A figure the layer withheld is absent, not estimated'

export default async function InvestPage() {
  const segments = await withTimeoutFallback(
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
    [],
    4500,
    'invest:segments',
  )
  const bySegment = new Map(segments.map((row) => [row.segment, row]))
  const rows: PublicSegmentRow[] = INVEST_SEGMENTS.flatMap((key) => {
    const row = bySegment.get(key)
    return row && row.activeCount != null && row.activeCount > 0 ? [row] : []
  })

  const multi = bySegment.get('multifamily_2_4')
  const commercial = bySegment.get('commercial_sale')
  const figures: V3InstrumentFigure[] = []
  if (multi?.activeCount != null && multi.activeCount > 0) {
    figures.push({
      value: v3Text(multi.activeCount.toLocaleString('en-US')),
      label: v3Text('2-4 unit buildings for sale'),
    })
    const multiMedian = formatIndexMedianUsd(multi.medianList)
    if (multiMedian != null) {
      figures.push({
        value: v3Text(multiMedian),
        label: v3Text('median list, 2-4 units'),
      })
    }
  }
  if (commercial?.activeCount != null && commercial.activeCount > 0) {
    figures.push({
      value: v3Text(commercial.activeCount.toLocaleString('en-US')),
      label: v3Text('commercial properties for sale'),
    })
  }
  const [firstFigure, ...restFigures] = figures

  const searchRows: V3LedgerFigureRow[] = rows.map((row) => {
    const count = row.activeCount ?? 0
    const noun = publicSegmentNoun(row.segment, count)
    const bits = publicSegmentDisplayBits(row).slice(0, 2)
    return {
      id: row.segment,
      href: publicSegmentBrowseHref(null, row.segment),
      when: v3Text('Central Oregon'),
      what: v3Text(noun.charAt(0).toUpperCase() + noun.slice(1)),
      ...(bits.length > 0 ? { detail: v3Text(bits.join(' · ')) } : {}),
      value: v3Text(`${count.toLocaleString('en-US')} active`),
    }
  })
  const [firstSearchRow, ...restSearchRows] = searchRows

  const placeItems: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'What this page is',
      body: 'Every multi-family, commercial, land, farm, and business listing on the regional MLS across Central Oregon, with the market data beside it. The counts below are live.',
    },
    {
      kind: 'prose',
      term: 'How to underwrite here',
      body: 'Run the numbers before the tour. Every eligible listing page carries a rental analysis built on published fair-market rents, and the rental calculator takes your own rent, rate, and expense assumptions. Financing terms move the answer more than the list price does.',
    },
  ]

  const toolItems: V3QuietItem[] = [
    { label: 'Rental property calculator', href: '/tools/rental-property-calculator' },
    { label: 'Mortgage calculator', href: '/tools/mortgage-calculator' },
    { label: 'Central Oregon market report', href: '/housing-market' },
    { label: 'Every city', href: '/cities' },
    { label: 'Talk to a broker', href: '/contact' },
  ]

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Invest', href: '/invest' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        {/* Inline JSON-LD through the lib builder — the ratchet (ci:public-ui)
            admits no new page onto the legacy MetadataBlock register. */}
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
        <V3Breadcrumb trail={trail} />

        <V3Quiet
          id="place"
          heading="Investment property in Central Oregon"
          headingLevel={1}
          items={placeItems}
        />

        {firstFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text('Central Oregon · Income property')}
            headline={v3Text('The income-property market')}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(SEGMENT_TRACE)}
            action={{ label: v3Text('Full market report'), href: '/housing-market', variant: 'ghost' }}
          />
        ) : null}

        {firstSearchRow ? (
          <V3Ledger
            id="searches"
            eyebrow={v3Text('Central Oregon · By property type')}
            heading={v3Text('What is for sale, by type')}
            rows={[firstSearchRow, ...restSearchRows]}
            source={v3Text(SEGMENT_TRACE)}
            action={{ label: v3Text('Every home for sale'), href: '/homes-for-sale?view=list' }}
          />
        ) : null}

        <V3Quiet id="tools" heading="Run the numbers" items={toolItems} />

        <InvestAlertSheet />
      </main>

      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}

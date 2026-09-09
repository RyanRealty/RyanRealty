/**
 * /invest — the investor door (Matt ruling 2026-09-01, decisions.md).
 *
 * HONEST BY CONSTRUCTION (§0): every figure on this page is a live Market
 * Truth segment row (getPublicPlaceSegments, region grain) — the same numbers
 * the housing-market page and the search pages print, one source — plus this
 * week's 30-year fixed rate off `market_history_weekly` (Freddie Mac PMMS30),
 * which carries its own week and its own capture time. The page makes NO
 * cash-flow promise and prints no rent or yield: the only rent-bearing table
 * in the system is per-listing, frozen at a 2026-08-03 batch, and walled
 * behind admin auth for a stated MLS-display-obligation reason. A yield needs
 * a rent, a rent needs a live source, and §0 says an unverifiable figure does
 * not ship. So the page states the inventory and the cost of money, and hands
 * the reader a calculator for the rent only they know.
 *
 * THE OPENING (site queue SITE-50, 2026-09-09). It used to be two prose blocks
 * headed "What this page is" and "How to underwrite here" — documentation
 * headers describing the page to itself, with an empty column beside each and
 * no number on screen. The taste table scored it 25, last on the site: "a cover
 * memo, not a landing page". It now opens with the finding, drawn: the Central
 * Oregon income market is a LAND market, and the four largest populations are
 * a part-to-whole the reader can light one at a time. Composition and trace in
 * ./_v3/invest-pulse.ts.
 *
 * ONE FIGURE, ONE SECTION. The three data sections read the same segment rows
 * and each takes a different family off them, so no fact is printed twice:
 * Pulse takes the ACTIVE counts and their shares, Instrument takes what CLOSED
 * and how fast it went under contract, Ledger is the crawlable door per type.
 *
 * Patterns: Pulse #place (the finding, the H1) → Ledger #searches (live
 * per-type doors and how each one trades) → Quiet #tools (the cost of money +
 * the math doors) → Sheet #alerts (income-property capture). No two adjacent
 * share a pattern. Section order is the parity contract at
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
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'
import { formatDate, formatDateTime } from '@/lib/format/date'
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
import { composeInvestPulse } from './_v3/invest-pulse'
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


const SEGMENT_TRACE =
  'regional MLS through Oregon Data Share, read through the Market Truth metric layer: active listings per property type across Central Oregon. A figure the layer withheld is absent, not estimated'

export default async function InvestPage() {
  // Two independent reads, in parallel: the segment board this page has always
  // read, and this week's published 30-yr fixed. Neither blocks the other, and
  // either one coming back empty removes only its own section (§0).
  const [segments, liveRate] = await Promise.all([
    withTimeoutFallback(
      getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
      [],
      4500,
      'invest:segments',
    ),
    withTimeoutFallback(
      getLiveMortgageRate().catch(() => null),
      null,
      4500,
      'invest:rate',
    ),
  ])
  // The moment the read returned. Not a data fact and never presented as one —
  // the band prints it as "Read <when>", the same stamp buildPlaceAtlas takes
  // for the homepage band.
  const readStamp = formatDateTime(new Date())
  const bySegment = new Map(segments.map((row) => [row.segment, row]))
  const rows: PublicSegmentRow[] = INVEST_SEGMENTS.flatMap((key) => {
    const row = bySegment.get(key)
    return row && row.activeCount != null && row.activeCount > 0 ? [row] : []
  })

  // THE OPENING. The finding as the H1, the four largest populations as a
  // part-to-whole the reader lights one at a time, every figure an activeCount
  // off the rows above. Null when the read gave nothing worth publishing.
  const pulse = composeInvestPulse({ rows: segments, stamp: readStamp })

  const searchRows: V3LedgerFigureRow[] = rows.map((row) => {
    const count = row.activeCount ?? 0
    const noun = publicSegmentNoun(row.segment, count)
    const bits = publicSegmentDisplayBits(row).slice(0, 2)
    return {
      id: row.segment,
      href: publicSegmentBrowseHref(null, row.segment),
      // SITE-52: the eyebrow is already "Central Oregon · By property type" —
      // every row repeating 'Central Oregon' is the taste evaluator's OREGON
      // defect with the region name instead of the state.
      what: v3Text(noun.charAt(0).toUpperCase() + noun.slice(1)),
      ...(bits.length > 0 ? { detail: v3Text(bits.join(' · ')) } : {}),
      value: v3Text(`${count.toLocaleString('en-US')} active`),
    }
  })
  const [firstSearchRow, ...restSearchRows] = searchRows

  // THE COST OF MONEY. The one number that moves an investor's answer more than
  // the asking price does, and the only financing figure this site can read
  // live: market_history_weekly, national/us, mortgage_rate_30yr, published
  // weekly by Freddie Mac's PMMS. When the read comes back empty the row is
  // absent — the page does not fall back to a remembered rate (§0).
  //
  // WHAT IS NOT HERE ANY MORE. This block used to claim "every eligible listing
  // page carries a rental analysis built on published fair-market rents". That
  // feature was deleted from the codebase on 2026-09-09 (545e4e50, already on
  // main: RentalAnalysis.tsx and lib/hud-fmr.ts, confirmed by
  // listing-remainder-contract.test.ts), so the sentence was describing
  // something that no longer exists. A page may not advertise a surface the
  // site does not have.
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

  // THE TRACE OPENS WITH ITS SOURCE'S NAME, ON PURPOSE. V3SourceDisclosure
  // derives the one visible clause structurally — the shorter of the segment
  // before the first comma and the first sentence. A trace that opened
  // "6.71% is the 30-year fixed average…" folded to the visible word "6",
  // because "6" is the first sentence of "6.71". The name comes first and the
  // figures follow it.
  const RATE_TRACE = liveRate
    ? `Freddie Mac Primary Mortgage Market Survey, the published 30-year fixed average for the week beginning ${formatDate(liveRate.weekStart)}, which is ${liveRate.ratePct.toFixed(2)}%. Read from market_history_weekly (geo national/us, metric mortgage_rate_30yr, source ${liveRate.source}) and captured by the weekly snapshot cron at ${formatDateTime(liveRate.capturedAt)}. It is a national owner-occupied average, not a quote and not an investor rate — investor terms run above it, and it is the floor your own math starts from. This page publishes no rent, no yield and no cash-flow figure: the rent side of that math has no live source here, so the calculators below take your own rent and your own terms.`
    : undefined

  const toolItems: V3QuietItem[] = [
    ...rateFact,
    // SITE-40: the first door leads. The reader who got this far wants the
    // one calculator that takes their own numbers, not a list of four equals.
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

        {/* THE OPENING. The claim is the H1: on a live read it is the finding,
            and when the read gives nothing the page still opens with its own
            name and its doors rather than a half-drawn gauge. */}
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

        {firstSearchRow ? (
          <V3Ledger
            id="searches"
            eyebrow={v3Text('Central Oregon · By property type')}
            heading={v3Text('What is for sale, and how it trades')}
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

/**
 * /invest insight pages — one page per income type the Pulse draws.
 *
 * beautifului-insight is paged insights with a scrubber. Every figure is the
 * same `activeCount` the Pulse and the segment table already print, so the
 * three surfaces cannot disagree. A withheld count is absent, never a zero.
 */
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import {
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { INVEST_SEGMENTS } from '@/lib/invest/segments'
import { investCounts } from './invest-pulse'

const SHORT: Record<string, string> = {
  land: 'Lots',
  commercial_sale: 'Commercial',
  multifamily_2_4: '2–4 unit',
  farm: 'Farms',
  business: 'Businesses',
}

const DEFINITION: Record<string, string> = {
  land: 'Lots and acreage with no house on them. The largest income-property population in the region, and the one with the longest hold.',
  commercial_sale:
    'Commercial buildings and commercial condos offered for sale — retail, office, industrial, and mixed use. Leases are not counted here.',
  multifamily_2_4:
    'Duplexes, triplexes and fourplexes. Small enough to finance like a house, which is why so few of them sit on the market.',
  farm: 'Working farm and ranch property: irrigated ground, water rights, outbuildings. Priced on what the land produces as much as on what sits on it.',
  business:
    'Businesses offered for sale, sometimes with the real estate and sometimes without. The smallest population here.',
}

export type InvestInsightPage = {
  key: string
  /** Pager face — short, one or two words. */
  title: string
  figure: string
  noun: string
  count: number
  share: number
  shareLabel: string
  definition: string
  href: string
  hrefLabel: string
  trades: readonly string[]
}

function n(value: number): string {
  return value.toLocaleString('en-US')
}

export function composeInvestInsightPages(
  rows: readonly PublicSegmentRow[],
): InvestInsightPage[] {
  const counts = investCounts(rows)
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  if (total <= 0) return []
  const bySegment = new Map(rows.map((row) => [row.segment, row]))

  return counts.map((c) => {
    const row = bySegment.get(c.segment)
    const noun = publicSegmentNoun(c.segment, c.count)
    const share = c.count / total
    const pct = (share * 100).toFixed(1)
    const trades = row ? publicSegmentDisplayBits(row) : []
    return {
      key: c.segment,
      title: SHORT[c.segment] ?? noun,
      figure: n(c.count),
      noun,
      count: c.count,
      share,
      shareLabel: `${pct}% of ${n(total)} income listings`,
      definition: DEFINITION[c.segment] ?? `Active ${noun} on the regional MLS.`,
      href: publicSegmentBrowseHref(null, c.segment),
      hrefLabel: `See all ${n(c.count)} ${noun}`,
      trades,
    }
  })
}

export function investInsightChartPoints(pages: readonly InvestInsightPage[]): {
  value: number
  label: string
  tick: string
}[] {
  return pages.map((page) => ({
    value: page.count,
    label: `${page.figure} ${page.noun}`,
    tick: page.title,
  }))
}

export function isInvestSegment(key: string): boolean {
  return (INVEST_SEGMENTS as readonly string[]).includes(key)
}

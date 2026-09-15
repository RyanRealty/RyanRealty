/**
 * Segment rows for the shadcn Table on /invest.
 *
 * Same Market Truth rows as the Pulse. The table's job is "how each type
 * trades" — pending, sold-in-12-months, days to an offer — not a second
 * count of the Pulse figures. A withheld trade bit is absent, never a dash
 * that looks like a measured zero.
 */
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import {
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { investCounts } from './invest-pulse'

export type InvestSegmentTableRow = {
  key: string
  type: string
  count: string
  trades: string
  extra: string | null
  href: string
}

export function composeInvestSegmentRows(
  rows: readonly PublicSegmentRow[],
): InvestSegmentTableRow[] {
  const counts = investCounts(rows)
  const bySegment = new Map(rows.map((row) => [row.segment, row]))
  return counts.map((c) => {
    const row = bySegment.get(c.segment)
    const bits = row ? publicSegmentDisplayBits(row) : []
    const noun = publicSegmentNoun(c.segment, c.count)
    return {
      key: c.segment,
      type: noun.charAt(0).toUpperCase() + noun.slice(1),
      count: `${c.count.toLocaleString('en-US')} for sale`,
      trades: bits[0] ?? 'How it trades is not published at region grain',
      extra: bits.length > 1 ? bits.slice(1).join(' · ') : null,
      href: publicSegmentBrowseHref(null, c.segment),
    }
  })
}

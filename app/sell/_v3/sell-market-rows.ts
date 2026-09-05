/**
 * Bend leftover cells for the sell page, as ledger rows.
 *
 * The Instrument keeps three answers (median, homes for sale, months of
 * supply). Everything else is a scannable row: short name, one figure,
 * the rest of the sentence as detail. Display numerals for "3 businesses
 * for sale" was the 27-cell pile-up.
 */
import { v3Text, type V3LedgerRow } from '@/components/site/v3'
import {
  publicSegmentItems,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { publicPaceItems, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'

const BEND_MARKET_HREF = '/housing-market/bend'

function titleLine(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function splitWindow(label: string): { what: string; detail?: string } {
  const byDot = label.split(' · ')
  if (byDot.length >= 2) {
    return { what: titleLine(byDot.slice(0, -1).join(' · ')), detail: titleLine(byDot[byDot.length - 1]!) }
  }
  const byComma = label.split(', ')
  if (byComma.length >= 2) {
    return { what: titleLine(byComma.slice(0, -1).join(', ')), detail: titleLine(byComma[byComma.length - 1]!) }
  }
  return { what: titleLine(label) }
}

export function sellBendLedgerRows(
  segments: readonly PublicSegmentRow[],
  pace: PublicPaceRow,
): V3LedgerRow[] {
  const segs = publicSegmentItems(segments, 'bend')
  const maxN = Math.max(0, ...segs.map((s) => Number(s.value.replace(/,/g, '')) || 0))
  const typeRows: V3LedgerRow[] = segs.map((item) => {
    const n = Number(item.value.replace(/,/g, '')) || 0
    const bits = item.label.split(' · ').slice(1)
    const name = titleLine(item.noun)
    return {
      href: item.href,
      when: v3Text('For sale'),
      what: v3Text(name),
      value: v3Text(item.value),
      ...(bits.length > 0 ? { detail: v3Text(bits.join(' · ')) } : {}),
      ...(maxN > 0 ? { weight: n / maxN } : {}),
    }
  })

  const paceRows: V3LedgerRow[] = publicPaceItems(pace).map((item) => {
    const { what, detail } = splitWindow(item.label)
    return {
      href: BEND_MARKET_HREF,
      when: v3Text('Pace'),
      what: v3Text(what),
      value: v3Text(item.value),
      ...(detail ? { detail: v3Text(detail) } : {}),
    }
  })

  return [...typeRows, ...paceRows]
}

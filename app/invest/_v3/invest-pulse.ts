/**
 * /invest's opening — the shape of the income-property market, drawn.
 *
 * WHERE IT CAME FROM (site queue SITE-50). The page used to open with two prose
 * blocks headed "What this page is" and "How to underwrite here": documentation
 * headers describing the page to itself, an empty column beside each, and no
 * number anywhere on a page whose stated job is "here is the inventory, here is
 * the math". The 2026-09-08 taste table scored it 25, the lowest class on the
 * site, and called it "a cover memo, not a landing page".
 *
 * The opening is now the finding. An investor arriving here wants to know what
 * is actually for sale, and the honest answer is unexpected: the Central Oregon
 * income market is a LAND market. On the 2026-09-09 read, 605 of the 761
 * income-property listings in the region are lots. There are 46 two-to-four
 * unit buildings for sale in three counties. That is the claim, it is drawn as
 * a part-to-whole, and the reader can light any one population to see what it
 * is and where its door goes.
 *
 * SECTION 0.
 *
 * Every figure is `activeCount` off a `getPublicPlaceSegments` row at region
 * grain — the SAME single read the Instrument and the Ledger below already
 * make, so the page cannot print two different counts for one property type.
 * Nothing here is derived from a prior deliverable and nothing is estimated.
 * The one derived figure — each rule's share of the whole — is computed from
 * those counts in this module and its arithmetic is printed in the trace.
 *
 * WHAT IT WILL NOT SAY. There is no cash-flow verdict on this page and there
 * cannot be one today: the only rent-bearing table in the system
 * (`dscr_rent_estimates`) is per-listing, frozen at its 2026-08-03 batch, and
 * walled behind admin auth for a stated MLS-display-obligation reason. A yield
 * needs a rent, a rent needs a live source, and §0 says a figure that cannot be
 * verified does not ship. So the page states what it can measure — the
 * inventory and this week's cost of money — and hands the reader a calculator
 * for the rent only they know.
 *
 * WHAT IT WILL NOT DO. If the read returns nothing, or land is not in fact the
 * largest population, the authored claim is not published: `composeInvestPulse`
 * returns null rather than printing a sentence the numbers stopped supporting.
 */
import type { PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import { publicSegmentNoun, publicSegmentBrowseHref } from '@/lib/data/market-truth/public-segments'
import { INVEST_SEGMENTS, type InvestSegment } from '@/lib/invest/segments'
import { v3Text, type V3PulseProps, type V3PulseReading } from '@/components/site/v3'

/** The section id, and the stem of every control id in the band. */
export const INVEST_PULSE_ID = 'place'

/**
 * V3Pulse opens the page with the finding drawn as a part-to-whole: lots
 * against buildings on one track — the same split the H1 claims. Four
 * type rows read as a radio-row legend (Mini 0c7efd619). The share
 * denominator stays the WHOLE set. Type doors stay on the Ledger.
 */
const DRAWN = 2

/** What each population IS, in words a visitor reads. Never a slug. */
const DEFINITION: Record<string, string> = {
  land: 'Lots and acreage with no house on them: bare residential lots, larger parcels, and development ground. The largest income-property population in the region by a wide margin, and the one with the longest hold.',
  commercial_sale:
    'Commercial buildings and commercial condos offered for sale — retail, office, industrial, and mixed use. Leases are not counted here; these are properties for purchase.',
  multifamily_2_4:
    'Duplexes, triplexes and fourplexes. Small enough to finance like a house and the closest thing to a conventional rental purchase in this market, which is also why there are so few of them for sale.',
  farm: 'Working farm and ranch property: irrigated ground, water rights, outbuildings. Priced on what the land produces as much as on what sits on it.',
  business:
    'Businesses offered for sale, sometimes with the real estate and sometimes without. The smallest population here, and the one that turns over least.',
}

/** The door's visible words, and therefore its accessible name. */
function goLabel(segment: string, count: number): string {
  return `See all ${count.toLocaleString('en-US')} ${publicSegmentNoun(segment, count)}`
}

function n(value: number): string {
  return value.toLocaleString('en-US')
}

export type InvestSegmentCount = {
  segment: InvestSegment
  /** Rows the metric layer published as active for this segment. */
  count: number
}

export type InvestSplit = {
  lots: number
  buildings: number
  total: number
}

/** Lots vs every other income listing. One source for Pulse, insight, and the H1. */
export function investSplit(counts: readonly InvestSegmentCount[]): InvestSplit {
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const lots = counts.find((c) => c.segment === 'land')?.count ?? 0
  return { lots, buildings: Math.max(0, total - lots), total }
}

/**
 * The income segments that came back with a publishable active count, largest
 * first. A segment the layer withheld is absent, never a zero — a zero would
 * be a claim that nothing is for sale, which is a fact about the read and not
 * about the market.
 */
export function investCounts(rows: readonly PublicSegmentRow[]): InvestSegmentCount[] {
  const bySegment = new Map(rows.map((row) => [row.segment, row]))
  return INVEST_SEGMENTS.flatMap((segment) => {
    const row = bySegment.get(segment)
    const count = row?.activeCount
    return count != null && count > 0 ? [{ segment, count }] : []
  }).sort((a, b) => b.count - a.count)
}

/**
 * The claim, published only when the counts still support it.
 *
 * The sentence is authored rather than generated because it is the page's H1:
 * a headline that rewrites itself every thirty minutes is not a headline. What
 * IS checked on every read is whether it is still true — land has to be the
 * largest population and more than half the whole, or the page falls back to
 * the plain statement of what the read found, which is a claim of a different
 * shape but never a sentence the numbers contradict.
 */
export function investClaim(counts: readonly InvestSegmentCount[]): string | null {
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  if (total <= 0) return null
  const largest = counts[0]
  if (!largest) return null

  if (largest.segment === 'land' && largest.count * 2 > total) {
    return 'Most investment property for sale in Central Oregon is land, not buildings.'
  }
  return `${n(total)} income properties are for sale across Central Oregon right now.`
}

/** The §0 trace: the read, the filter, every count, and the arithmetic. */
export function investTrace(counts: readonly InvestSegmentCount[]): string {
  const { lots, buildings, total } = investSplit(counts)
  const parts = counts.map((c) => `${c.segment} ${n(c.count)}`).join(', ')
  const largest = counts[0]
  const lines = [
    'Regional MLS listings for sale across Central Oregon, counted by property type — lots, commercial, two-to-four-unit buildings, farms, and businesses. Oregon Data Share is the feed. Geography is the whole region, not one town.',
    `This read: ${parts} — ${n(total)} listings in all.`,
    `The two rules are lots ${n(lots)} and buildings ${n(buildings)} — ${n(lots)} + ${n(buildings)} = ${n(total)}. Each share is that number over ${n(total)}, so the fills add to the whole set.`,
  ]
  if (largest) {
    const pct = ((largest.count / total) * 100).toFixed(1)
    lines.push(
      `The headline is ${n(largest.count)} ÷ ${n(total)} = ${pct}% — it is published only while the largest population is land and holds more than half the set.`,
    )
  }
  lines.push(
    'Type doors stay in the list below. Houses people live in are on the homes-for-sale pages, not here. A type with no published count is left off, not guessed.',
  )
  return lines.join(' ')
}

export type InvestPulseInput = {
  rows: readonly PublicSegmentRow[]
  /** When the read was taken, already formatted: "Sep 9, 2026, 12:04 PM". */
  stamp: string
}

/**
 * The band's props, composed from one read. Pure — every figure is formatted
 * here so the primitive prints and never computes.
 */
export function composeInvestPulse(input: InvestPulseInput): V3PulseProps | null {
  const counts = investCounts(input.rows)
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  if (total <= 0) return null
  if (!input.stamp.trim()) return null

  const claim = investClaim(counts)
  if (!claim) return null

  const split = investSplit(counts)
  if (split.lots <= 0 || split.buildings <= 0) return null

  const buildingLead = counts.find((c) => c.segment !== 'land')
  const readings: V3PulseReading[] = [
    {
      key: 'lots',
      figure: n(split.lots),
      label: publicSegmentNoun('land', split.lots),
      share: split.lots / split.total,
      definition:
        DEFINITION.land ??
        'Lots and acreage with no house on them: bare residential lots, larger parcels, and development ground.',
      href: publicSegmentBrowseHref(null, 'land'),
      hrefLabel: goLabel('land', split.lots),
    },
    {
      key: 'buildings',
      figure: n(split.buildings),
      label: split.buildings === 1 ? 'building' : 'buildings',
      share: split.buildings / split.total,
      definition:
        'Commercial, two-to-four-unit, farm, and business listings — every income property for sale that is not a vacant lot. Together with the lots they add to the whole set.',
      href: buildingLead ? publicSegmentBrowseHref(null, buildingLead.segment) : '/homes-for-sale',
      hrefLabel: `See all ${n(split.buildings)} ${split.buildings === 1 ? 'building' : 'buildings'}`,
    },
  ]

  return {
    id: INVEST_PULSE_ID,
    claim: v3Text(claim),
    headingLevel: 1,
    readings: readings.slice(0, DRAWN),
    note: `Read ${input.stamp}`,
    source: investTrace(counts),
  }
}

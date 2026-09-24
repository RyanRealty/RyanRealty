/**
 * The place answer: what a visitor who typed their address on a place page sees before
 * any contact ask. Site queue SITE-01 (Matt 2026-09-07): verdict and pace only, never a
 * dollar figure on the page. The figure stays in the written CMA the email step delivers.
 *
 * This composes reads the place pages already make (Market Truth through
 * getDetachedOverlays and getPublicDetachedPace). It performs no table read of its own,
 * and every figure it returns carries the trace line the page prints beside it (§0).
 *
 * Grain: the resort community pages read Market Truth at the neighborhood grain with the
 * bare community slug (`brasada-ranch`), the same key app/communities/[slug]/page.tsx
 * uses for its own market section. City pages pass 'city'.
 */
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { marketVerdict, type MarketKind } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'

export type PlaceValueGeoType = 'neighborhood' | 'city'

export type PlaceValueAnswer = {
  geoType: PlaceValueGeoType
  geoSlug: string
  /** Buyer's / seller's / balanced, from the published months of supply. Null when MOS cannot publish at this grain. */
  verdict: { kind: MarketKind; label: string } | null
  monthsOfSupply: number | null
  /** Median days from list to pending, trailing 90 days. */
  daysToPending: number | null
  /** Share of closes paid in cash over the trailing year, 0..1. */
  cashShare: number | null
  /** Median sale-to-original-list ratio. */
  saleToOriginal: number | null
  activeCount: number | null
  closedCount: number | null
  /** ISO timestamp the headline metrics were computed. */
  asOf: string | null
  /** True when at least one of verdict, daysToPending, or cashShare is present. */
  hasFigures: boolean
  /** One line per figure: what it is, where it came from, when. */
  trace: string[]
}

/** "Tetherow", or the slug's words when the caller did not name the place. */
function placeLabelOf(label: string | null | undefined, geoSlug: string): string {
  const named = label?.trim()
  if (named) return named
  return geoSlug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** ", updated Sep 20, 2026", or nothing when the stamp does not parse. */
function updatedClause(asOf: string | null): string {
  if (!asOf) return ''
  const at = new Date(asOf)
  return Number.isNaN(at.getTime()) ? '' : `, updated ${formatDate(at)}`
}

export async function getPlaceValueAnswer(input: {
  geoType: PlaceValueGeoType
  geoSlug: string
  /** The place as a person says it ("Tetherow", "Bend"), for the trace a reader sees. */
  placeLabel?: string | null
}): Promise<PlaceValueAnswer> {
  const geoSlug = input.geoSlug.trim().toLowerCase()
  const key = `${input.geoType}:${geoSlug}`

  const [overlays, pace] = await Promise.all([
    getDetachedOverlays([{ geoType: input.geoType, geoSlug }]).catch(() => new Map()),
    getPublicDetachedPace({ geoType: input.geoType, geoSlug }).catch(() => null),
  ])
  const overlay = overlays.get(key) ?? null
  const headlines = overlay?.headlines ?? null

  const monthsOfSupply = headlines
    ? publishMonthsOfSupply({
        grain: input.geoType,
        source: 'market-truth',
        pulseMos: headlines.monthsOfSupply,
        pulseActiveCount: headlines.activeCount,
        displayedActiveCount: headlines.activeCount,
      })
    : null
  const verdict = monthsOfSupply != null ? marketVerdict(monthsOfSupply) : null

  const daysToPending = pace?.daysToPending90d ?? null
  const cashShare = pace?.cashShare ?? null
  const saleToOriginal = pace?.saleToOriginal ?? null
  const activeCount = headlines?.activeCount ?? overlay?.inventory?.activeCount ?? null
  const closedCount = pace?.closedCount ?? null
  const asOf = headlines?.computedAt ?? overlay?.inventory?.computedAt ?? null

  // THE TRACE IS PRINTED BESIDE THE FIGURE, SO IT IS IN THE READER'S WORDS
  // (SITE-193, 2026-09-24). It used to carry the cache key and the column
  // ("days to pending 42 — market_metric neighborhood:tetherow,
  // median_days_to_contract_90d"), and the community valuation answer printed
  // it verbatim under its pace rule; /sell had been translating the same lines
  // after the fact. The source, the population, the window and the date all
  // stay; the table and column become the words they mean. Each line still
  // opens with the figure's name ("months of supply", "days to pending"),
  // which is how the callers find it.
  const where = placeLabelOf(input.placeLabel, geoSlug)
  const feed = `regional MLS through Oregon Data Share, read through the Market Truth metrics for detached homes in ${where}`
  const updated = updatedClause(asOf)
  const trace: string[] = []
  if (monthsOfSupply != null) {
    const active = headlines?.activeCount
    trace.push(
      `months of supply ${formatMonthsOfSupply(monthsOfSupply)} (${verdict?.label ?? 'no verdict'}): ${feed}${
        active != null ? `, ${active.toLocaleString('en-US')} homes for sale` : ''
      } divided by the average number that closed each month over the last six months${updated}`,
    )
  }
  if (daysToPending != null) {
    trace.push(
      `days to pending ${Math.round(daysToPending)}: ${feed}, the median days from the listing date to a signed contract over the last 90 days${updated}`,
    )
  }
  if (cashShare != null) {
    trace.push(`cash share ${(cashShare * 100).toFixed(1)}%: ${feed}, closed sales paid in cash over the last 12 months${updated}`)
  }
  if (saleToOriginal != null) {
    trace.push(`sale to original list ${(saleToOriginal * 100).toFixed(1)}%: ${feed}, the median sale price as a share of the first list price${updated}`)
  }

  return {
    geoType: input.geoType,
    geoSlug,
    verdict,
    monthsOfSupply,
    daysToPending,
    cashShare,
    saleToOriginal,
    activeCount,
    closedCount,
    asOf,
    hasFigures: verdict != null || daysToPending != null || cashShare != null,
    trace,
  }
}

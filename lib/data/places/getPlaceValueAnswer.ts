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

export async function getPlaceValueAnswer(input: {
  geoType: PlaceValueGeoType
  geoSlug: string
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

  const trace: string[] = []
  if (monthsOfSupply != null) {
    trace.push(
      `months of supply ${formatMonthsOfSupply(monthsOfSupply)} (${verdict?.label ?? 'unknown'}) — market_metric ${key}, active ${headlines?.activeCount ?? '?'} over avg monthly closes, computed ${asOf ?? '?'}`,
    )
  }
  if (daysToPending != null) trace.push(`days to pending ${Math.round(daysToPending)} — market_metric ${key}, median_days_to_contract_90d`)
  if (cashShare != null) trace.push(`cash share ${(cashShare * 100).toFixed(1)}% — market_metric ${key}, trailing 12 months`)
  if (saleToOriginal != null) trace.push(`sale to original list ${(saleToOriginal * 100).toFixed(1)}% — market_metric ${key}`)

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

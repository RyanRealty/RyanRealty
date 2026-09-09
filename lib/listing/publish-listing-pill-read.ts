/**
 * The one plain sentence beside the status pills (site queue SITE-45).
 *
 * The taste evaluator's finding on the listing fold (2026-09-08): "three
 * bordered figures — Active, 103 days on market, $697/sqft — with no plain
 * sentence telling the reader what 103 days or $697/sqft means", the KPI-grid
 * tell in miniature. This publisher turns the two figures the pills already
 * carry into one sentence against the place's own record, from the SAME reads
 * the page's market instrument makes (leftoverHudKpis for days to contract,
 * the public pace row for the closed median $/sqft), so the fold and the
 * instrument further down cannot disagree.
 *
 * Section 0: every figure is one the caller read from Market Truth and
 * traces in `source`; nothing here estimates. A missing figure drops its
 * clause; no clause, no sentence.
 */

export type ListingPillReadInput = {
  /** Days this home has been listed, counted to today (daysLiveOnMarket). */
  daysLive: number | null | undefined
  /** The place's median days from listing to a signed contract, trailing 90 days. */
  daysToPending: number | null | undefined
  /** This home's published price per square foot. */
  ppsf: number | null | undefined
  /** The place's median closed $/sqft, trailing 12 months. */
  medianPpsf: number | null | undefined
  /** The place, as a person says it: "Bend", "Awbrey Butte". */
  placeName: string | null | undefined
  /** When the place figures were computed, already formatted; optional. */
  asOfLabel?: string | null
}

export type PublishedListingPillRead = {
  sentence: string
  /** The section-0 trace for the place figures the sentence leans on. */
  source: string
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function daysClause(daysLive: number, typical: number, place: string): string {
  const d = Math.round(daysLive)
  const t = Math.round(typical)
  if (t <= 0) return ''
  if (d <= t) {
    return `${d} ${d === 1 ? 'day' : 'days'} listed is inside the ${t} a typical ${place} home takes to go under contract`
  }
  const ratio = d / t
  const how = ratio >= 2 ? `about ${ratio.toFixed(1).replace(/\.0$/, '')} times` : 'longer than'
  return `${d} days listed is ${how} the ${t} a typical ${place} home takes to go under contract`
}

function ppsfClause(ppsf: number, median: number, place: string): string {
  if (!(median > 0) || !(ppsf > 0)) return ''
  const pct = ((ppsf - median) / median) * 100
  const tenths = Math.round(Math.abs(pct) * 10) / 10
  if (tenths === 0) return `${money(ppsf)} a square foot matches the ${place} closed median`
  const dir = pct > 0 ? 'over' : 'under'
  return `${money(ppsf)} a square foot is ${tenths.toFixed(1)}% ${dir} the ${place} closed median of ${money(median)}`
}

export function publishListingPillRead(input: ListingPillReadInput): PublishedListingPillRead | null {
  const place = (input.placeName ?? '').trim()
  if (!place) return null
  const clauses: string[] = []
  if (input.daysLive != null && Number.isFinite(input.daysLive) && input.daysLive >= 0 && input.daysToPending != null && Number.isFinite(input.daysToPending)) {
    const c = daysClause(input.daysLive, input.daysToPending, place)
    if (c) clauses.push(c)
  }
  if (input.ppsf != null && Number.isFinite(input.ppsf) && input.medianPpsf != null && Number.isFinite(input.medianPpsf)) {
    const c = ppsfClause(input.ppsf, input.medianPpsf, place)
    if (c) clauses.push(c)
  }
  if (clauses.length === 0) return null
  const sentence = `${clauses[0]!.charAt(0).toUpperCase()}${clauses[0]!.slice(1)}${clauses.length > 1 ? `; ${clauses[1]}` : ''}.`
  const parts = [
    clauses.length > 0 && input.daysToPending != null
      ? `median days from listing to contract, detached homes in ${place}, trailing 90 days`
      : null,
    input.medianPpsf != null && clauses.some((c) => c.includes('square foot'))
      ? `median closed price per square foot, detached homes in ${place}, trailing 12 months`
      : null,
  ].filter(Boolean)
  const source = `Market Truth (market_metric, detached): ${parts.join('; ')}${input.asOfLabel ? `, computed ${input.asOfLabel}` : ''}. Days listed counts from this home's on-market date to today; $/sqft is this home's price over its living area.`
  return { sentence, source }
}

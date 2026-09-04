/**
 * Comp-selection trace — the persisted, QUERYABLE record of why a document got
 * the comps it got.
 *
 * selectComps() has always built a human-readable `trace: string[]` for the
 * rendered citations. That prose is unqueryable: answering "how many documents
 * starved at the subdivision tier" meant re-deriving the ladder by hand for
 * every row. This module is the structured half — one object per build, stored
 * at `cmas.build_summary -> comp_selection`, holding the ladder actually
 * walked, per-tier candidates returned and comps added, every exclusion count
 * with its reason, and the tier each priced comp ended up coming from.
 *
 * Deliberately holds NO listing rows. Counts, bands, and tier names only, so a
 * 200-document corpus stays a few hundred KB of JSONB rather than tens of MB.
 *
 * Example queries this shape is designed for:
 *   -- documents whose ladder ended without reaching the target
 *   select slug, build_summary->'comp_selection'->>'starved_at'
 *   from cmas where (build_summary->'comp_selection'->>'starved')::bool;
 *
 *   -- how many documents had the subdivision tier run and yield nothing
 *   select count(*) from cmas, lateral jsonb_array_elements(
 *     build_summary->'comp_selection'->'ladder') t
 *   where t->>'tier' = 'subdivision-6mo'
 *     and (t->>'ran')::bool and (t->>'comps_added')::int = 0;
 *
 *   -- total comps lost to the product-type exclusion across the corpus
 *   select sum((build_summary->'comp_selection'->'excluded_totals'
 *     ->>'product_type')::int) from cmas;
 */

/** Every reason a candidate row can be dropped, counted per tier and in total. */
export interface CompExclusionCounts {
  /** A townhome / condo / manufactured / leased-land / co-op against a detached subject (or vice versa). */
  product_type: number
  /** Whole bathroom count does not match the subject. */
  bath_count: number
  /** Acreage vs in-town lot, or outside the acreage band. */
  lot_character: number
  resort_premium: number
  /** Outside the subject's GIS market-area polygon on a polygon-restricted tier. */
  market_area: number
  /** Comp sits on the other side of US-97 / Bend Parkway or the Deschutes. */
  crossed_divide: number
  /** Inside the tier's bounding box but outside its true mileage radius. */
  distance: number
  /** Already selected by an earlier (tighter) tier. */
  duplicate: number
  /** The subject's own listing, by ListingKey or by street address. */
  self: number
  /** Row lacks a close price, close date, ListingKey, or a usable sqft. */
  unusable_row: number
  /** Custom/new subject vs a different construction generation (1970s–2000 vs 2024). */
  year_quality: number
  /** Acreage remarks: irrigated / horse / barns vs a dry lot (or the reverse). */
  acreage_infrastructure: number
}

export function emptyExclusions(): CompExclusionCounts {
  return { product_type: 0, bath_count: 0, lot_character: 0, resort_premium: 0, market_area: 0, crossed_divide: 0, distance: 0, duplicate: 0, self: 0, unusable_row: 0, year_quality: 0, acreage_infrastructure: 0 }
}

export function addExclusions(into: CompExclusionCounts, from: CompExclusionCounts): void {
  for (const k of Object.keys(into) as Array<keyof CompExclusionCounts>) into[k] += from[k]
}

export function totalExclusions(x: CompExclusionCounts): number {
  return x.product_type + x.bath_count + x.lot_character + x.resort_premium + x.market_area + x.crossed_divide + x.distance + x.duplicate + x.self + x.unusable_row + x.year_quality + x.acreage_infrastructure
}

/** One rung of the ladder, whether it ran or was skipped. */
export interface CompTierTrace {
  tier: string
  /** False when the rung was skipped (no subdivision, no polygon, target already met). */
  ran: boolean
  skipped_reason: string | null
  months_back: number
  sqft_min: number | null
  sqft_max: number | null
  lot_min: number | null
  lot_max: number | null
  /** Plain-language geographic bound, e.g. "SubdivisionName ILIKE 'Kenwood', City ILIKE 'Bend'". */
  geography: string
  rows_returned: number
  comps_added: number
  /** Distinct comps held after this tier — the number the ladder tests against TARGET_COMPS. */
  running_total: number
  excluded: CompExclusionCounts
}

export interface CompSelectionDiagnostics {
  /** Display name of the subject's GIS market area, null when it sits outside every polygon. */
  market_area: string | null
  market_area_resolved: boolean
  /** Acreage subject outside every mapped polygon — the class the rural tiers exist for. */
  rural_acreage: boolean
  /** Which engine produced this set. Desk banners must not guess from tier names. */
  pricing_source: 'facts' | 'listings'
  /** True when year / NewConstructionYN / subtype / remarks put the subject in custom/new. */
  custom_or_new: boolean
  subject: {
    sqft: number | null
    lot_acres: number | null
    /** The subdivision actually used to query — null when the MLS value was a sentinel. */
    subdivision: string | null
    /** What the MLS row held, so a sentinel is visible rather than silently dropped. */
    subdivision_raw: string | null
    product_sub_type: string | null
  }
  ladder: CompTierTrace[]
  tiers_used: string[]
  reached_target: boolean
  /** True when the ladder was exhausted without reaching TARGET_COMPS. */
  starved: boolean
  /** The last tier that ran before the ladder ran out. Null when the target was reached. */
  starved_at: string | null
  /** Plain language naming WHICH constraint starved it — for the broker, not the engineer. */
  starved_reason: string | null
  target_comps: number
  min_comps: number
  /** Distinct comps held before the outlier drop and the MAX_COMPS cap. */
  candidates: number
  excluded_totals: CompExclusionCounts
  outliers_excluded: number
  /** Comps handed to pricing by selectComps (after outliers + cap). */
  final_count: number
  /** Tier -> count, over the comps that actually got priced. Filled by the builder. */
  final_tier_counts: Record<string, number>
  /** Every relaxation taken, in the words the report discloses them. */
  disclosures: string[]
}

const EXCLUSION_LABELS: Record<keyof CompExclusionCounts, string> = {
  product_type:
    'they are a different product (a townhome, condo, manufactured home, leased-land or co-op sale does not compete with a detached house)',
  bath_count: 'they have a different whole bathroom count than the subject',
  lot_character: 'their lot character does not match (acreage against an in-town lot, or far outside the acreage band)',
  resort_premium: 'they sit in a resort community the subject is not in (premium contamination, or the reverse)',
  market_area: "they sit outside the subject's neighborhood boundary",
  crossed_divide: 'they sit on the other side of US-97, the Bend Parkway, or the Deschutes River — a different buyer pool at any distance',
  distance: "they sit beyond the tier's distance bound",
  duplicate: 'a tighter tier had already selected them',
  self: "they are the subject's own listing",
  unusable_row: 'their MLS row is missing a close price, close date, or living area',
  year_quality:
    'they are a different construction generation or quality tier than a custom or new-construction subject (a 1970s–2000 ranch does not price a 2024 custom)',
  acreage_infrastructure:
    'their remarks describe different acreage infrastructure (irrigated land, horse property, or barns against a dry lot, or the reverse)',
}

function band(d: CompSelectionDiagnostics): string {
  const ran = d.ladder.filter((t) => t.ran)
  const s = ran.find((t) => t.sqft_min != null)
  const parts: string[] = []
  if (s?.sqft_min != null) parts.push(`${s.sqft_min.toLocaleString()}-${s.sqft_max!.toLocaleString()} sqft`)
  const l = ran.find((t) => t.lot_min != null)
  if (l?.lot_min != null) parts.push(`${l.lot_min}-${l.lot_max} acres`)
  const widest = ran[ran.length - 1]
  if (widest) parts.push(`${widest.geography}`, `sold within ${widest.months_back} months`)
  return parts.join(', ')
}

/**
 * Name the constraint that starved the selection, in language a broker can act
 * on. A bare "only 2 qualifying comps found" tells the reader nothing about
 * whether the subject is genuinely unpriceable or the search was too narrow.
 */
export function diagnoseStarvation(d: CompSelectionDiagnostics): string | null {
  if (!d.starved) return null
  const path =
    d.pricing_source === 'facts'
      ? 'facts path'
      : d.custom_or_new
        ? 'listings path (custom/new should never land here)'
        : 'listings path'
  const ran = d.ladder.filter((t) => t.ran)
  if (ran.length === 0) {
    const why = d.ladder.map((t) => t.skipped_reason).find(Boolean)
    return `${path}: no comp search could run for this subject${why ? `, because ${why}` : ''}.`
  }
  const rows = ran.reduce((a, t) => a + t.rows_returned, 0)
  const held = d.candidates
  if (rows === 0) {
    return `${path}: no closed sale anywhere in the database matched the search at any of the ${ran.length} tier(s) walked. The binding constraints were ${band(d)}. This subject has no comparable sales on record. It is not a search problem.`
  }
  const ranked = (Object.keys(d.excluded_totals) as Array<keyof CompExclusionCounts>)
    .map((k) => ({ k, n: d.excluded_totals[k] }))
    .filter((e) => e.n > 0 && e.k !== 'duplicate' && e.k !== 'self')
    .sort((a, b) => b.n - a.n)
  const top = ranked[0]
  const scarcity = `${path}: the widest tier walked (${ran[ran.length - 1]!.geography}, sold within ${ran[ran.length - 1]!.months_back} months) returned ${rows} candidate row(s) in total`
  if (!top) {
    return `${scarcity}, and ${held} survived. The market simply has too few sales matching ${band(d)}. This subject has no comparable sales on record.`
  }
  const listed = ranked
    .slice(0, 3)
    .map((e) => `${e.n} on ${e.k.replace(/_/g, ' ')}, because ${EXCLUSION_LABELS[e.k]}`)
    .join('. ')
  return `${scarcity}, and ${held} survived. The comps that were dropped went out as follows: ${listed}. The single largest constraint was ${top.k.replace(/_/g, ' ')}.`
}

/** Tier -> count over a priced comp set, for `final_tier_counts`. */
export function countByTier(comps: Array<{ selectionTier?: string | null }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of comps) {
    const t = c.selectionTier || 'unknown'
    out[t] = (out[t] ?? 0) + 1
  }
  return out
}

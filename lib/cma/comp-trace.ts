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
  /** Rural: farm/forest zoning against rural residential (county GIS or MLS zone). */
  zoning_class: number
  /** Rural: a shop, barn, or arena on one side and none on the other. */
  outbuildings: number
  /** Rural: usable ground on one side, rock, slope, or wetland on the other. */
  terrain: number
  /** A sale whose $/sqft sits outside the subject's own price tier. */
  price_tier: number
  /**
   * A sale that passed the rung's walls and does not set the price (rule 20:
   * another community, or a clearly different size or product). It does not
   * count toward the five price-setting sales (Matt 2026-10-07).
   */
  not_price_setting: number
  /**
   * A sale whose public remarks state an ADU, guest house or other second
   * living unit, against a subject whose remarks state none (Matt 2026-10-08,
   * "ADU sale skips", aduSaleRefused in lib/pricing/classes.ts). Absent on a
   * row stored before that ruling; readers treat absent as zero.
   */
  adu_sale: number
  /**
   * Listings ladder, touching-plat rung: a row the rung read whose recorded
   * plat is not one of the plats touching the subject's. It says nothing about
   * the neighborhood; until 2026-10-08 these were counted as market_area,
   * which printed "400 outside the subject's neighborhood boundary" for rows
   * that were mostly inside it. Absent on a row stored before then.
   */
  not_touching_plat: number
  /**
   * Listings ladder, pocket rung: a row inside the quarter-mile read that is
   * neither on a pocket street nor in a pocket subdivision. Counted as
   * market_area until 2026-10-08. Absent on a row stored before then.
   */
  not_in_pocket: number
  /**
   * Listings ladder, own-plat rung: a row the MLS-name read returned whose
   * recorded plat polygon is another subdivision's, not the subject's plat or
   * its family (reader review 2026-10-08, lib/pricing/plat-ground.ts). The
   * polygon decides, as on the facts walk. Absent on a row stored before then.
   */
  not_own_plat?: number
}

export function emptyExclusions(): CompExclusionCounts {
  return { product_type: 0, bath_count: 0, lot_character: 0, resort_premium: 0, market_area: 0, crossed_divide: 0, distance: 0, duplicate: 0, self: 0, unusable_row: 0, year_quality: 0, acreage_infrastructure: 0, zoning_class: 0, outbuildings: 0, terrain: 0, price_tier: 0, not_price_setting: 0, adu_sale: 0, not_touching_plat: 0, not_in_pocket: 0, not_own_plat: 0 }
}

export function addExclusions(into: CompExclusionCounts, from: CompExclusionCounts): void {
  for (const k of Object.keys(into) as Array<keyof CompExclusionCounts>) into[k] = (into[k] ?? 0) + (from[k] ?? 0)
}

export function totalExclusions(x: CompExclusionCounts): number {
  return x.product_type + x.bath_count + x.lot_character + x.resort_premium + x.market_area + x.crossed_divide + x.distance + x.duplicate + x.self + x.unusable_row + x.year_quality + x.acreage_infrastructure + x.zoning_class + x.outbuildings + x.terrain + x.price_tier + x.not_price_setting + (x.adu_sale ?? 0) + (x.not_touching_plat ?? 0) + (x.not_in_pocket ?? 0) + (x.not_own_plat ?? 0)
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
  /** Distinct price-setting comps held after this tier — the number the ladder tests against TARGET_COMPS. */
  running_total: number
  excluded: CompExclusionCounts
  /**
   * Facts ladder only: sales that passed this rung and do not set the price
   * (PricingLadderRung.notSetting). Null on the listings path, which counts
   * the same refusal in `excluded.not_price_setting`.
   */
  not_setting?: number | null
}

/**
 * What the facts walk held, kept on a selection the listings ladder returned
 * (2026-10-08). selectCompsPreferringFacts walks the facts ladder first and,
 * under five price-setting sales, falls back to the listings ladder. Before
 * this the facts result was thrown away, so a shortage message described only
 * the weaker listings search ("Only 0 qualifying closed comps found ...")
 * while the facts walk held sales of its own. The shortage sentences
 * (diagnoseStarvation, brokerCompRefusal) lead with whichever path held more.
 */
export interface FactsPathHold {
  /** Price-setting sales the facts walk seated. */
  held: number
  /** Their street addresses, newest close first. */
  sales: string[]
  tiers_used: string[]
  /** Sales that passed a rung and did not set the price (rule 20), over the walk. */
  not_setting: number
  /** Why the walk stopped short of five, in plain words. Null when it reached five. */
  stop_reason: string | null
}

export interface CompSelectionDiagnostics {
  /** Display name of the subject's GIS market area, null when it sits outside every polygon. */
  market_area: string | null
  /**
   * The price tier this build graded comps against: the median $/sqft of sales
   * in the narrowest place around the subject that held enough of them (its
   * plat, its subdivision family, its MLS subdivision, its community, its
   * neighborhood, a ring around it, its city: lib/pricing/price-anchor.ts),
   * and how many sales that median came from. Null when no level could supply
   * enough sales to state one, in which case no price cut ran.
   */
  price_anchor?: {
    ppsf: number
    n: number
    /** The level that held the median (PriceAnchorSource), absent on rows stored before 2026-10-08. */
    level?: string
    /** Where it was read, as the trace says it: "in Westside Meadows", "within 1 mile". */
    where?: string
  } | null
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
  /**
   * Sales that passed a rung and do not set the price, over the whole walk
   * (the sum of rung.notSetting on facts; excluded_totals.not_price_setting
   * on listings). They never counted toward the five (Matt 2026-10-07).
   */
  not_price_setting: number
  /** Comps handed to pricing by selectComps (after outliers + cap). */
  final_count: number
  /** Tier -> count, over the comps that actually got priced. Filled by the builder. */
  final_tier_counts: Record<string, number>
  /** Every relaxation taken, in the words the report discloses them. */
  disclosures: string[]
  /**
   * The facts walk's result when this selection came from the listings
   * fallback, or the facts walk itself. Absent on a broker-picked set and on
   * rows stored before 2026-10-08.
   */
  facts_path?: FactsPathHold
  /**
   * The rung that reached five, whether it widened the area, and how many
   * qualifying sales it still held past the seats (Matt 2026-10-08, refill
   * from the same rung; lib/cma/review-refill.ts). Absent on a broker-picked set.
   */
  refill_bench?: { rung: string | null; widening: boolean; held: number }
  /**
   * How many homes sold on the subject's own ground (its plat, phases and
   * family, or its MLS name off any polygon) over the widest own-subdivision
   * window, any size and any residential type (lib/cma/own-ground-sold.ts).
   * Read only when the own-subdivision rungs found nothing, so the comp story
   * can say "No home sold in X" or "No sale inside X matched your home"
   * truthfully (reader review 2026-10-09, 915 Saginaw). Absent otherwise, and
   * on rows stored before then.
   */
  own_ground_sold?: { months: number; since: string; n: number; capped: boolean; source: string } | null
  /**
   * What the comparability review refilled, round by round, and how many
   * bench sales were left. Absent when nothing was refilled.
   */
  review_refill?: {
    rung: string
    rounds: Array<{ round: number; reason: 'excluded' | 'split'; dropped: string[]; refilled: string[] }>
    bench_left: number
  }
}

const EXCLUSION_LABELS: Record<keyof CompExclusionCounts, string> = {
  product_type:
    'they are a different product (a townhome, condo, manufactured home, leased-land or co-op sale does not compete with a detached house)',
  bath_count:
    "they are two or more rooms away from the subject, or one room away and outside this home's own plat, neighborhood and street",
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
  zoning_class: 'their zoning class differs (farm or forest land against rural residential)',
  outbuildings: 'their outbuildings differ (a shop, barn, or arena on one side and none on the other)',
  terrain: 'their land differs (usable ground on one side, rock, slope, or wetland on the other)',
  price_tier: 'their price per square foot sits outside the tier this home\'s own area sells in',
  not_price_setting:
    'they sit in a different community, or are a clearly different size or product, so they do not set the price and do not count toward the five',
  adu_sale:
    "their remarks state an ADU, guest house or other second living unit and this home's remarks state none, so their price carries a unit this home lacks",
  not_touching_plat:
    "the touching-plat step read them and their recorded plat does not touch this home's plat (they may still sit inside the neighborhood)",
  not_in_pocket: "the quarter-mile pocket step read them and they sit on no pocket street and in no pocket subdivision",
  not_own_plat:
    "the own-subdivision step read them by their MLS name and their recorded plat is another subdivision's, not this home's plat",
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
 *
 * When the selection carries the facts walk (facts_path) and it came from the
 * listings fallback, the path that held more price-setting sales leads, named
 * with its sales (2026-10-08). Facts leads on a tie: it is the primary path.
 */
export function diagnoseStarvation(d: CompSelectionDiagnostics): string | null {
  if (!d.starved) return null
  const own = diagnoseOwnPath(d)
  const facts = d.facts_path
  if (!facts || d.pricing_source === 'facts') return own
  const factsLine = `facts path: ${facts.held} price-setting sale(s)${
    facts.sales.length > 0 ? ` (${facts.sales.join(', ')})` : ''
  }, short of ${d.min_comps}${facts.stop_reason ? `; it stopped because ${facts.stop_reason}` : ''}.`
  return facts.held >= d.candidates ? `${factsLine} ${own}` : `${own} ${factsLine}`
}

function diagnoseOwnPath(d: CompSelectionDiagnostics): string {
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
    .map((k) => ({ k, n: d.excluded_totals[k] ?? 0 }))
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

/**
 * Why the facts walk stopped short of five, in plain words and without rung
 * names: the most common reason the rungs after the last one that ran were
 * skipped (the first such reason on a tie). Null when the walk reached five.
 */
export function factsStopReason(
  rungs: ReadonlyArray<{ ran: boolean; skippedReason: string | null }>,
  reachedTarget: boolean,
): string | null {
  if (reachedTarget) return null
  let lastRan = -1
  rungs.forEach((r, i) => {
    if (r.ran) lastRan = i
  })
  if (lastRan === -1) {
    return rungs.map((r) => r.skippedReason).find(Boolean) ?? 'no step of the search could run'
  }
  const counts = new Map<string, number>()
  for (const r of rungs.slice(lastRan + 1)) {
    if (!r.ran && r.skippedReason) counts.set(r.skippedReason, (counts.get(r.skippedReason) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [reason, n] of counts) {
    if (n > bestN) {
      best = reason
      bestN = n
    }
  }
  return best ?? 'every step of the search ran and no other sale qualified'
}

/**
 * The shortage sentence's lead: the count the best path held, the sales by
 * address, and the five (2026-10-08). "The search in River West found 3
 * price-setting sales (1501 Newport, 1411 Newport, 1367 Milwaukee); 5 are
 * needed."
 */
export function shortageLead(args: {
  marketArea: string | null
  held: number
  sales: readonly string[]
  minComps: number
}): string {
  const place = args.marketArea ? `The search in ${args.marketArea}` : 'The search'
  const names = args.sales.filter((a) => a.trim()).join(', ')
  const count =
    args.held === 0
      ? 'no price-setting sales'
      : `${args.held} price-setting sale${args.held === 1 ? '' : 's'}${names ? ` (${names})` : ''}`
  return `${place} found ${count}; ${args.minComps} are needed.`
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

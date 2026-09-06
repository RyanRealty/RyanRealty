/**
 * Land pricing — the two land products price differently, so they get two methods.
 *
 * Matt 2026-08-27: "Do lots as their own separate animal, and then do the more
 * rural acreage. Try to figure out a way to do them both. Acreage will be a
 * one-off. We need to look at things like existing infrastructure, etc."
 *
 *   LOTS — a platted lot inside a recorded subdivision is close to a fungible
 *   unit: same street, same utilities, same setbacks. That is a real
 *   statistical market, and it prices the way a house does, with $/acre
 *   standing in for $/sqft.
 *
 *   ACREAGE — raw dirt is the smaller half of the number. A drilled well with a
 *   log, an approved septic site, mapped irrigation with a priority date, and a
 *   dwelling entitlement each move a rural parcel more than the acre count
 *   does, and no two parcels carry the same set. So acreage returns a
 *   comps-derived band for the DIRT and an itemized schedule of the
 *   infrastructure OF RECORD, and it always routes to broker review.
 *
 * On why the infrastructure schedule carries no dollar figures (§0): a
 * contributory value per well or per irrigated acre is an appraisal judgment,
 * not a query result. Inventing one here would put an unsourced number into a
 * document a client reads. The schedule states what the record shows and lets
 * the broker price it, which is what "a one-off" means.
 *
 * Everything returns the shared CmaPricing shape, so the render, the audit and
 * the accuracy contract treat a land document like any other.
 */
import type {
  CmaAdjustedComp,
  CmaComp,
  CmaMarketContext,
  CmaPricing,
  CmaSubject,
} from '@/lib/cma/types'
import type { CmaSiteData } from '@/lib/cma/county'
import { productClass } from '@/lib/cma/market-area'

const MS_PER_MONTH = 30.44 * 86_400_000
/** Same cap the home engine uses: no single old sale drives the estimate. */
const TIME_ADJ_CAP_FRACTION = 0.2
/**
 * Marginal acreage is worth less than average acreage, and much less than
 * marginal square footage is — a second acre on a 40-acre parcel changes the
 * price far less than the first. The home engine's 0.5 is too hot for dirt.
 */
const ACRE_ADJ_FACTOR = 0.25
/** Above this, the "comparable" lots are not one market. Mirrors the home CV rail. */
const LAND_CV_REVIEW_THRESHOLD = 0.25
/** Matches lotCharacterCompatible — the line between a lot and acreage. */
export const ACREAGE_THRESHOLD_ACRES = 1
/** Living area at or above this means a dwelling — see landProduct. */
const DWELLING_SQFT_FLOOR = 400

export type LandProduct = 'lots' | 'acreage'

/** Product classes that are land. A home on 5 acres is NOT land — it is a home. */
const LAND_CLASSES = new Set(['lots', 'recreational', 'agriculture', 'rangeland'])

/**
 * Which land method a subject takes, or null when the subject is not land.
 * Driven by product class first: acreage alone never makes a parcel land,
 * because a house on 20 acres is priced as a house.
 */
export function landProduct(subject: {
  propertySubType: string | null
  lotAcres: number | null
  sqft?: number | null
}): LandProduct | null {
  const cls = productClass(subject.propertySubType)
  if (!cls || !LAND_CLASSES.has(cls)) return null
  // A dwelling means improved property, whatever the subtype says. Of the 4,150
  // PropertyType='E' farm rows, 2,817 carry a dwelling and 1,016 closed sales
  // have beds and >=400 sqft (docs/plans/MARKET_TRUTH/REGISTRY.md §1). Pricing
  // one of those per acre would value the house at zero. The 400 sqft floor is
  // the registry's own dwelling test, so a shop or shed recorded as area does
  // not flip a bare parcel into improved property.
  if ((subject.sqft ?? 0) >= DWELLING_SQFT_FLOOR) return null
  // Rangeland and agriculture are acreage by nature whatever the parcel size.
  if (cls === 'agriculture' || cls === 'rangeland') return 'acreage'
  const acres = subject.lotAcres
  if (acres == null) return 'lots'
  return acres >= ACREAGE_THRESHOLD_ACRES ? 'acreage' : 'lots'
}

/**
 * What the document should call the subject. A CMA for a vacant parcel titled
 * "The house" tells the client we did not read their property.
 */
export function subjectNoun(subject: {
  propertySubType: string | null
  lotAcres: number | null
  sqft?: number | null
}): 'lot' | 'land' | 'home' {
  const product = landProduct(subject)
  if (!product) return 'home'
  return product === 'lots' ? 'lot' : 'land'
}

/**
 * The possessive the document uses for the subject: "as your house" / "as your
 * lot" / "as your land". Land reports said "house" 37 times before this.
 */
export function subjectPossessive(subject: {
  propertySubType: string | null
  lotAcres: number | null
  sqft?: number | null
}): 'house' | 'lot' | 'land' {
  const noun = subjectNoun(subject)
  return noun === 'home' ? 'house' : noun
}

/** Section title for the subject page: home location, or the lot / land. */
export function subjectSectionTitle(subject: {
  propertySubType: string | null
  lotAcres: number | null
  sqft?: number | null
}): string {
  const noun = subjectNoun(subject)
  return noun === 'home' ? 'Home location' : noun === 'lot' ? 'The lot' : 'The land'
}

export type LandAdjustedComp = {
  comp: CmaComp
  acres: number
  monthsSinceClose: number
  timeAdjustment: number
  timeAdjustedPrice: number
  /** Time-adjusted price per acre — land's unit rate. */
  pricePerAcre: number
  /** Marginal-acreage correction toward the subject's size. */
  sizeAdjustment: number
  adjustedPrice: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! * (1 - (idx - lo)) + sorted[hi]! * (idx - lo)
}

function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5)
}

function round1000(n: number): number {
  return Math.round(n / 1000) * 1000
}

/**
 * Time + acreage adjustments on land comps. Comps with no usable acreage are
 * dropped rather than defaulted: a $/acre computed from a missing lot size is
 * the divide-by-zero that made land unpriceable in the first place.
 */
export function adjustLandComps(
  subjectAcres: number,
  comps: CmaComp[],
  market: CmaMarketContext | null,
  asOfMs: number = Date.now(),
): LandAdjustedComp[] {
  const yoyPct = market?.yoyMedianPriceDeltaPct ?? null
  const out: LandAdjustedComp[] = []
  for (const comp of comps) {
    const acres = comp.lotAcres
    if (acres == null || !Number.isFinite(acres) || acres <= 0) continue
    if (!Number.isFinite(comp.closePrice) || comp.closePrice <= 0) continue

    const monthsSinceClose = Math.max(
      0,
      (asOfMs - new Date(comp.closeDate).getTime()) / MS_PER_MONTH,
    )
    const rawTimeAdj =
      yoyPct == null ? 0 : Math.round(comp.closePrice * (yoyPct / 100) * (monthsSinceClose / 12))
    const cap = Math.round(comp.closePrice * TIME_ADJ_CAP_FRACTION)
    const timeAdjustment = Math.max(-cap, Math.min(cap, rawTimeAdj))
    const timeAdjustedPrice = comp.closePrice + timeAdjustment
    const pricePerAcre = timeAdjustedPrice / acres
    const sizeAdjustment =
      subjectAcres > 0 ? Math.round((subjectAcres - acres) * pricePerAcre * ACRE_ADJ_FACTOR) : 0

    out.push({
      comp,
      acres,
      monthsSinceClose,
      timeAdjustment,
      timeAdjustedPrice,
      pricePerAcre,
      sizeAdjustment,
      adjustedPrice: timeAdjustedPrice + sizeAdjustment,
    })
  }
  return out
}

/** Coefficient of variation of the comps' $/acre — land's dispersion metric. */
function pricePerAcreCv(rows: LandAdjustedComp[]): number {
  if (rows.length < 2) return 0
  const rates = rows.map((r) => r.pricePerAcre)
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length
  if (mean <= 0) return 0
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length
  return Math.sqrt(variance) / mean
}

/**
 * The infrastructure of record, as line items. States what the record shows —
 * never a contributory dollar value, which is the broker's call (§0).
 */
export function infrastructureSchedule(site: CmaSiteData | null): string[] {
  if (!site) return []
  const lines: string[] = []

  const w = site.water
  if (w.wellLog) {
    const l = w.wellLog
    const parts = [
      l.wellNumber ? `well log ${l.wellNumber}` : 'a well log of record',
      l.completedDepthFt != null ? `${l.completedDepthFt} ft` : null,
      l.firstWaterFt != null ? `first water ${l.firstWaterFt} ft` : null,
      l.completedDate ? `completed ${l.completedDate}` : null,
    ].filter(Boolean)
    lines.push(`Water: ${parts.join(', ')}.`)
  } else if (w.providerName) {
    lines.push(`Water: ${w.providerName}, not a private well.`)
  } else if (w.source === 'well') {
    lines.push('Water: the record indicates a private well. No log matched, so depth and yield are unverified.')
  } else {
    lines.push('Water: no well log and no named supplier of record.')
  }

  if (w.mappedIrrigationAcres != null && w.mappedIrrigationAcres > 0) {
    const tail = [
      w.primaryIrrigationPriorityDate ? `priority ${w.primaryIrrigationPriorityDate}` : null,
      w.irrigationDistrict,
    ].filter(Boolean)
    lines.push(
      `Irrigation: ${w.mappedIrrigationAcres} mapped irrigated acres${tail.length > 0 ? `, ${tail.join(', ')}` : ''}.`,
    )
  } else if (w.rightsQueryOk) {
    lines.push(
      `No perfected primary irrigation right maps to this parcel${w.rightsUsedPolygon ? '.' : ', on a point check rather than the full parcel polygon.'}`,
    )
  } else {
    lines.push('Irrigation: the water-rights query did not complete. Absence is not established — verify with OWRD.')
  }

  const SEPTIC: Record<string, string> = {
    installed: 'Septic: installed system of record',
    'site-evaluation-only': 'Septic: site evaluation on file, no system installed',
    'municipal-sewer': 'Sewer: on a municipal system',
    'none-found': 'Septic: no onsite record found',
    unknown: 'Septic: no onsite record matched',
  }
  // A permit IS a record, so never pair one with "no record found" — an
  // unmapped status alongside a real permit number reads as a contradiction.
  const septicPermit = site.septic.permit
  const septicLead =
    septicPermit && (site.septic.status === 'unknown' || site.septic.status === 'none-found')
      ? 'Septic: permit of record'
      : (SEPTIC[site.septic.status] ?? SEPTIC.unknown)
  lines.push(`${septicLead}${septicPermit ? ` (permit ${septicPermit})` : ''}.`)

  if (site.entitlement) {
    lines.push(
      `Dwelling entitlement: ${site.entitlement.pathway}${site.entitlement.conditional ? ', conditional and unverified' : ''}.`,
    )
  } else if (site.zone) {
    lines.push(`Dwelling entitlement: no pathway resolved for zone ${site.zone}.`)
  }

  if (site.zone) {
    lines.push(`Zoning: ${site.zone}${site.zoneOverlays.length > 0 ? ` with ${site.zoneOverlays.join('; ')}` : ''}.`)
  }
  if (site.flood.inSFHA === true) {
    lines.push(`Flood: inside a Special Flood Hazard Area${site.flood.zone ? `, zone ${site.flood.zone}` : ''}.`)
  }
  if (site.wildfireHazard === true) lines.push('Wildfire: mapped hazard designation.')
  return lines
}

/**
 * Price a land subject. Returns the shared CmaPricing shape so every downstream
 * consumer is unchanged, or null when the comp set cannot support a number.
 */
export function priceLandSubject(args: {
  subject: CmaSubject
  comps: CmaComp[]
  market: CmaMarketContext | null
  site?: CmaSiteData | null
  minComps: number
  asOfMs?: number
  priceOverride?: number | null
}): CmaPricing | null {
  const { subject, comps, market, minComps } = args
  const product = landProduct(subject)
  if (!product) return null

  const subjectAcres = subject.lotAcres
  if (subjectAcres == null || !Number.isFinite(subjectAcres) || subjectAcres <= 0) return null

  const rows = adjustLandComps(subjectAcres, comps, market, args.asOfMs ?? Date.now())
  if (rows.length < minComps) return null

  const notes: string[] = []
  const capped = rows.filter(
    (r) => Math.abs(r.timeAdjustment) >= Math.round(r.comp.closePrice * TIME_ADJ_CAP_FRACTION),
  ).length
  if (capped > 0) {
    notes.push(
      `${capped} comparable${capped > 1 ? 's had their' : ' had its'} market-conditions adjustment capped at ${Math.round(
        TIME_ADJ_CAP_FRACTION * 100,
      )}% of the sale price.`,
    )
  }

  // Method 1 — tiered $/acre applied to the subject's acreage.
  const rateSorted = rows.map((r) => r.pricePerAcre).sort((a, b) => a - b)
  const method1Low = round1000(percentile(rateSorted, 0.25) * subjectAcres)
  const method1Mid = round1000(percentile(rateSorted, 0.5) * subjectAcres)
  const method1High = round1000(percentile(rateSorted, 0.75) * subjectAcres)

  // Method 2 — the whole-parcel method. Inside a platted subdivision the LOT is
  // the unit buyers shop, and a $/acre rate over-reacts to small size deltas, so
  // take the median adjusted price of the three closest-in-size sales.
  const bySize = [...rows].sort(
    (a, b) => Math.abs(a.acres - subjectAcres) - Math.abs(b.acres - subjectAcres),
  )
  const method2 = rows.length >= 3 ? round1000(median(bySize.slice(0, 3).map((r) => r.adjustedPrice))) : null

  // Method 3 — reconciliation across every adjusted sale.
  const method3 = round1000(median(rows.map((r) => r.adjustedPrice)))

  const candidates = [method1Mid, method2, method3].filter(
    (n): n is number => n != null && Number.isFinite(n) && n > 0,
  )
  const spreadPct =
    candidates.length > 1
      ? Math.round(((Math.max(...candidates) - Math.min(...candidates)) / Math.min(...candidates)) * 100)
      : null
  const converged = spreadPct != null ? spreadPct <= 5 : true
  if (!converged && spreadPct != null) {
    notes.push(
      `The methods land ${spreadPct}% apart. Method 3 governs the recommendation because it carries both the time and acreage corrections.`,
    )
  }

  // Band convention mirrors the home engine exactly (lib/cma/pricing.ts): the
  // floor is the comp evidence, the ceiling is CAPPED at +8% of the
  // recommendation, and valueLow/valueHigh ARE conservative/highEnd rather than
  // a second pair of numbers. A land document that reported the range a
  // different way from every other document would read as a different product.
  let recommended = args.priceOverride ?? method3
  const cMin = Math.min(...candidates)
  const cMax = Math.max(...candidates)
  let conservative = round1000(Math.min(method1Low, cMin))
  let highEnd = round1000(Math.min(Math.max(method1High, cMax), recommended * 1.08))

  // Same collapse guard: when the floor would land above the recommendation,
  // move the recommendation to the band midpoint instead of pinning it to the
  // floor. Never touches a broker's explicit override.
  if (conservative > recommended && args.priceOverride == null) {
    const bandMid = round1000((conservative + highEnd) / 2)
    recommended = Math.min(Math.max(bandMid, conservative), highEnd)
    notes.push(
      'The recommendation sits at the midpoint of the comp-supported range rather than its floor.',
    )
  }
  if (conservative > recommended) conservative = recommended
  if (highEnd < recommended) highEnd = recommended

  const cv = pricePerAcreCv(rows)
  const valueLow = conservative
  const valueHigh = highEnd

  const isAcreage = product === 'acreage'
  const schedule = isAcreage ? infrastructureSchedule(args.site ?? null) : []
  if (isAcreage) {
    notes.push(
      'The comparable sales price the dirt. What follows is the infrastructure of record, as findings rather than dollar adjustments — the broker prices each one against this parcel.',
    )
    notes.push(...schedule)
  }

  const rateLo = Math.round(percentile(rateSorted, 0.25))
  const rateHi = Math.round(percentile(rateSorted, 0.75))
  const cvWide = cv > LAND_CV_REVIEW_THRESHOLD
  const needsReview = isAcreage || cvWide
  const reviewReason = isAcreage
    ? 'Rural acreage is priced one parcel at a time: the well, the septic approval, the water right and the dwelling entitlement each move the number more than the acre count does. A broker sets the final figure against the schedule of record.'
    : cvWide
      ? `Comparable lots span a wide per-acre range ($${rateLo.toLocaleString()} to $${rateHi.toLocaleString()}/acre, ${Math.round(
          cv * 100,
        )}% coefficient of variation), which means they are not one market.`
      : null

  const confidence: CmaPricing['confidence'] = isAcreage
    ? 'Supportable'
    : cvWide || !converged
      ? 'Moderate'
      : rows.length >= 5
        ? 'High'
        : 'Moderate'
  const confidenceReason = isAcreage
    ? `${rows.length} acreage sales set the land rate. The parcel's own infrastructure decides where inside the range it sits.`
    : `${rows.length} comparable lot sales, ${Math.round(cv * 100)}% spread in per-acre rate.`

  return {
    method1Low,
    method1Mid,
    method1High,
    method2,
    method3,
    convergenceSpreadPct: spreadPct,
    converged,
    conservative,
    recommended,
    highEnd,
    valueLow,
    valueHigh,
    confidence,
    confidenceReason,
    needsReview,
    reviewReason,
    compPpsfCv: cv,
    priceOverride: args.priceOverride ?? null,
    improvementsValueAdd: null,
    notes,
  }
}

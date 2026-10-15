/**
 * WHAT AN ACCESSORY DWELLING UNIT ADDS (Matt 2026-10-14, second call).
 *
 * A house with a recorded ADU prices from plain comparable sales (the
 * ordinary set, or the ADU set only when it is as tight; the tightness rule in
 * lib/pricing/adu-preference.ts), and the unit is then valued on its own from
 * the sales that show what buyers paid for one: closed sales of homes with an
 * ADU near the subject, each read against plain sales near it (no ADU, the
 * same era, the same size band). The sale price less the main home at the
 * plain price per square foot is what the unit added; over the sale's
 * recorded ADU area that is a rate per ADU square foot. Five or more such
 * pairs within a mile (two miles when a mile holds fewer) give the letter a
 * rate, and the lower quartile of those rates times the subject's own ADU
 * area is the dollar figure added to the price. Fewer than five pairs add
 * nothing, and the letter says so.
 *
 * Why the lower quartile: the study behind this (429 Irving, 2026-10-14) read
 * twenty pairs within two miles of Midtown Bend, and the implied rate ran from
 * below zero to $1,800 a foot, because the plain-comp baseline absorbs
 * condition, views, new construction and short-term-rental licenses along
 * with the unit. The lower quartile is the part of that spread a seller can
 * be told to count on. Negative pairs stay in the set: they pull the quartile
 * down, which is the conservative side.
 *
 * No rent. The MLS carries no recorded rent on these sales (checked on the
 * five duplex comps of 429 Irving) and the only rent figures in the shop are
 * third-party estimates, so no income reading is made (§0).
 *
 * The ADU sale's living area is read as the main home: on the records that
 * carry the ADU SqFt field the total lists the main home alone (429 Irving's
 * 2026 record: 1,629 with a 520 sq ft ADU field). A record that folded the
 * unit into its total overstates the main home and understates the unit,
 * which again lands on the conservative side.
 */
import { isAduSale } from '@/lib/pricing/classes'
import type { PricingSale } from '@/lib/pricing/match'

export const ADU_VALUE_MIN_PAIRS = 5
/** The pairing radius, then the one tried when the first holds fewer than five pairs. */
export const ADU_VALUE_RADII_MILES: readonly number[] = [1, 2]
/** The closes read, months before the as-of date. */
export const ADU_VALUE_MONTHS = 24
/** The pool reader's row cap for the two-mile box; the trace says when it is reached. */
const POOL_MAX_ROWS = 3000
/** A unit under this is a room, over it a second house; neither is the ADU the rate describes. */
const ADU_SQFT_MIN = 150
const ADU_SQFT_MAX = 1200
const BASELINE_MIN_COMPS = 5
/** The plain sales a pair is read against: near the ADU sale, its era, its size band; widened once when five are not there. */
const BASELINE_STEPS: readonly { miles: number; years: number; sqftPct: number }[] = [
  { miles: 0.75, years: 15, sqftPct: 0.25 },
  { miles: 1.5, years: 25, sqftPct: 0.3 },
]
const MAX_PAIRS_PRINTED = 12

export type AduValueSale = Pick<
  PricingSale,
  'listingKey' | 'address' | 'subdivision' | 'latitude' | 'longitude' | 'sqft' | 'yearBuilt' | 'closePrice' | 'closeDate' | 'closePpsf' | 'productClass' | 'publicRemarks'
> & {
  /** MLS Accessory Dwelling Unit YN when the field is filled. */
  aduYn?: boolean | null
  /** The ADU area: the MLS field first, else the remarks' figure. */
  aduSqft?: number | null
  aduSqftSource?: 'mls' | 'remarks' | null
  /**
   * The main home's area when the recorded living area includes the unit:
   * the remarks state both and they add up to the record (513 Irving, Bend:
   * "Main house ... 1040 Sq Feet. ADU ... 572 Sq. Feet", 1,612 on record).
   * Null when the record's area is read as the main home.
   */
  mainSqft?: number | null
}

export type AduValuePair = {
  listingKey: string
  address: string
  subdivision: string | null
  closeDate: string
  closePrice: number
  /** The sale's living area, read as the main home. */
  mainSqft: number
  yearBuilt: number | null
  /** Miles from the subject. */
  miles: number
  aduSqft: number
  aduSqftSource: 'mls' | 'remarks'
  /** The plain sales the main home was read against. */
  plainComps: number
  plainPpsf: number
  plainBasis: string
  mainValue: number
  /** The sale price less the main home at the plain rate: what the unit added, negative when the baseline overshot. */
  aduDollars: number
  aduPerSqft: number
}

export type AduValueRate = { lowerQuartile: number; median: number; upperQuartile: number }

export type AduValue = {
  subjectAduSqft: number
  /** The radius the pairs came from: the first that reached five, else the widest tried. */
  radiusMiles: number
  /** ADU sales within that radius, before pairing. */
  aduSalesSeen: number
  /** ADU sales within the radius that no plain baseline could be read for. */
  unpaired: number
  /** The pairs the rate was read over, nearest first, capped at twelve for the letter. */
  pairs: AduValuePair[]
  /** How many pairs the rate was read over, before that cap. */
  pairsCounted: number
  minimumPairs: number
  /** Per-ADU-square-foot rate quartiles over the pairs; null under the minimum. */
  rate: AduValueRate | null
  /** The least and the most a unit brought per square foot, over every pair (the printed list is capped). */
  perSqftLow: number | null
  perSqftHigh: number | null
  /** The dollars added to the price: the lower-quartile rate times the subject's ADU area, to the hundred. Null under five pairs, and null when the lower quartile is at or below zero. */
  dollars: number | null
  /** The months of closed sales the read covered, for the letter's sentence. Null when the caller passed a pool of its own. */
  windowMonths?: number | null
  trace: string[]
}

const MILES_PER_LAT_DEGREE = 69

export function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const cos = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180))
  return Math.hypot((aLat - bLat) * MILES_PER_LAT_DEGREE, (aLng - bLng) * MILES_PER_LAT_DEGREE * cos)
}

/**
 * The ADU area a sale's remarks state, when they do: "a 520 sq ft ADU",
 * "750 sf detached ADU", "ADU (484 sq. ft.)", "guest house of 600 square
 * feet". Null when no figure sits within a few words of the unit.
 */
/**
 * The remarks with one space between words and the periods of the usual
 * abbreviations removed ("1 bed., 1 bath. 572 Sq. Feet" reads "1 bed, 1 bath
 * 572 Sq Feet"), so a figure stays inside the sentence that names the unit.
 */
function remarksForAreas(remarks: string): string {
  return remarks
    .replace(/\s+/g, ' ')
    .replace(/\b(bed|beds|bdrm|bdrms|bd|bath|baths|ba|br|sq|ft|sf|st|nd|rd|th|approx)\./gi, '$1')
}

const UNIT_WORD = '(?:adu|accessory dwelling(?: unit)?|guest (?:house|quarters|cottage|suite)|casita|carriage house)'
/** A figure of its own, not the tail of a comma-grouped one (the 915 of 1,915), with its unit of area. */
const AREA_FIGURE = '(?<![\\d,])(\\d{3,4})\\s*(?:sq\\s*(?:ft|feet)\\b|sf\\b|square\\s*f(?:ee|oo)t)'
/** A main-home figure, comma-grouped or not. */
const MAIN_FIGURE = '(?<![\\d,])(\\d{1,2},?\\d{3})\\s*(?:sq\\s*(?:ft|feet)\\b|sf\\b|square\\s*f(?:ee|oo)t)'

/** Nouns that carry an area of their own: a figure beside one measures that, not the unit. */
const AREA_NOUN = /\b(?:home|homes|house|houses|residence|bungalow|cabin|lot|lots|parcel|acre|acres|shop|workshop|garage|barn|outbuilding|basement|deck|patio|rv|footprint)\b/i
const UNIT_RE = new RegExp(`\\b${UNIT_WORD}\\b`, 'gi')
const AREA_RE = new RegExp(AREA_FIGURE, 'gi')
const AREA_ONCE = new RegExp(AREA_FIGURE, 'i')
/** How far a figure may sit from the unit word: before it ("a 520 sq ft ADU"), after it ("ADU is 1 bed, 1 bath 572 Sq Feet"). */
const BEFORE_WINDOW = 40
const AFTER_WINDOW = 60

/**
 * The ADU area a sale's remarks state, when they do: the figure NEAREST the
 * unit word, inside the same sentence, with no other area and no area noun
 * (home, lot, shop, garage, ...) between them, and not a figure whose own next
 * word names something else ("1120 sq ft shop", "7500 sq ft lot"). Null when
 * no figure qualifies. Review 2026-10-15: the leftmost figure read "1800 sq ft
 * main home with a 500 sq ft ADU" as 1,800 and a 7,000 sq ft lot as the unit.
 */
export function aduSqftFromRemarks(remarks: string | null | undefined): number | null {
  if (!remarks) return null
  const r = remarksForAreas(remarks)
  const units = [...r.matchAll(UNIT_RE)]
  if (units.length === 0) return null
  let best: { n: number; distance: number } | null = null
  for (const f of r.matchAll(AREA_RE)) {
    const n = Number(f[1])
    if (!Number.isFinite(n) || n <= 0) continue
    const fStart = f.index ?? 0
    const fEnd = fStart + f[0].length
    const nextWord = /^\s*\)?[\s,]*([a-z/]+)/i.exec(r.slice(fEnd))?.[1] ?? ''
    if (AREA_NOUN.test(nextWord)) continue
    for (const u of units) {
      const uStart = u.index ?? 0
      const uEnd = uStart + u[0].length
      let between: string | null = null
      let distance = 0
      if (fEnd <= uStart && uStart - fEnd <= BEFORE_WINDOW) {
        between = r.slice(fEnd, uStart)
        distance = uStart - fEnd
      } else if (uEnd <= fStart && fStart - uEnd <= AFTER_WINDOW) {
        between = r.slice(uEnd, fStart)
        distance = fStart - uEnd
      }
      if (between == null || /[.;]/.test(between) || AREA_NOUN.test(between) || AREA_ONCE.test(between)) continue
      if (!best || distance < best.distance) best = { n, distance }
    }
  }
  return best?.n ?? null
}

/**
 * The main home's area the remarks state, when they do: "Main house is 2 bed,
 * 1 bath. 1040 Sq Feet", "the main home offers 1,900 sq ft". Null when no
 * figure sits inside the sentence that names the main home.
 */
export function mainSqftFromRemarks(remarks: string | null | undefined): number | null {
  if (!remarks) return null
  const r = remarksForAreas(remarks)
  const hit = new RegExp(`\\b(?:main|primary) (?:house|home|residence|dwelling|unit|level)\\b[^.;]{0,60}?${MAIN_FIGURE}`, 'i').exec(r)
  if (!hit) return null
  const n = Number(hit[1]!.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** How far the remarks' two areas may miss the record and still be its parts. */
export const MAIN_AREA_TOLERANCE_SHARE = 0.03
export const MAIN_AREA_TOLERANCE_SQFT = 25

/**
 * THE RECORDED AREA THAT INCLUDES THE UNIT. A listing agent enters one living
 * area; on some ADU sales it is the main home, on others both units (513
 * Irving, Bend: 1,612 on record, "Main house ... 1040 Sq Feet ... ADU ...
 * 572 Sq. Feet"). The main home's area is taken from the remarks only when
 * it and the unit's area add up to the record, within 3 percent or 25 sq ft,
 * so the arithmetic itself proves the record counted both. Otherwise the
 * record's area is read as the main home, as before.
 */
export function reconciledMainSqft(args: {
  recordedSqft: number | null | undefined
  aduSqft: number | null | undefined
  mainSqft: number | null | undefined
}): number | null {
  const { recordedSqft, aduSqft, mainSqft } = args
  if (recordedSqft == null || !(recordedSqft > 0) || aduSqft == null || !(aduSqft > 0) || mainSqft == null || !(mainSqft > 0)) return null
  if (mainSqft >= recordedSqft) return null
  const miss = Math.abs(mainSqft + aduSqft - recordedSqft)
  return miss <= Math.max(MAIN_AREA_TOLERANCE_SQFT, recordedSqft * MAIN_AREA_TOLERANCE_SHARE) ? mainSqft : null
}

function median(values: readonly number[]): number {
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2
}

/** Nearest-rank quartiles over at least two values: the lower one rounds down, the upper rounds up. */
export function quartiles(values: readonly number[]): AduValueRate | null {
  if (values.length < 2) return null
  const v = [...values].sort((a, b) => a - b)
  const last = v.length - 1
  return {
    lowerQuartile: v[Math.floor(last * 0.25)]!,
    median: median(v),
    upperQuartile: v[Math.ceil(last * 0.75)]!,
  }
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The plain baseline for one ADU sale: the median price per square foot of
 * plain sales near it, in its era and size band, at the first step that
 * holds five. Null when neither step does.
 */
function baselineFor(sale: AduValueSale, plain: readonly AduValueSale[]): { comps: number; ppsf: number; basis: string } | null {
  if (sale.latitude == null || sale.longitude == null) return null
  for (const step of BASELINE_STEPS) {
    const comps = plain.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false
      if (milesBetween(sale.latitude!, sale.longitude!, p.latitude, p.longitude) > step.miles) return false
      if (sale.yearBuilt != null && p.yearBuilt != null && Math.abs(sale.yearBuilt - p.yearBuilt) > step.years) return false
      if (sale.yearBuilt != null && p.yearBuilt == null) return false
      return p.sqft >= sale.sqft * (1 - step.sqftPct) && p.sqft <= sale.sqft * (1 + step.sqftPct)
    })
    if (comps.length >= BASELINE_MIN_COMPS) {
      return {
        comps: comps.length,
        ppsf: median(comps.map((p) => p.closePpsf)),
        basis: `${step.miles} mi, ${step.years} years either side, ${Math.round(step.sqftPct * 100)}% of its size`,
      }
    }
  }
  return null
}

/**
 * Pair the ADU sales near the subject with plain baselines and read the rate.
 * Pure: the sales are given. `sales` are closed detached sales within the
 * widest radius; the subject's own sale is dropped by key.
 */
/** One home, however its address is spelled or keyed. */
function homeKey(address: string | null | undefined): string {
  return (address ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function aduContributoryValue(args: {
  subject: { latitude: number; longitude: number; aduSqft: number; listingKey?: string | null; streetAddress?: string | null }
  sales: readonly AduValueSale[]
  minimumPairs?: number
  radiiMiles?: readonly number[]
  /** The months the sales pool covers, carried onto the result for the letter. */
  windowMonths?: number | null
}): AduValue {
  const minimumPairs = args.minimumPairs ?? ADU_VALUE_MIN_PAIRS
  const radii = args.radiiMiles ?? ADU_VALUE_RADII_MILES
  const trace: string[] = []
  const own = args.subject.listingKey ?? null
  // The subject's own earlier sales are never pairs, whatever key they carry.
  const ownHome = args.subject.streetAddress ? homeKey(args.subject.streetAddress) : null
  const detached = args.sales.filter(
    (s) => s.productClass === 'detached' && s.listingKey !== own && (ownHome == null || homeKey(s.address) !== ownHome) && s.sqft > 0 && s.closePrice > 0,
  )
  const withMiles = detached
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ sale: s, miles: milesBetween(args.subject.latitude, args.subject.longitude, s.latitude!, s.longitude!) }))
  // A sale is an ADU sale when its field or its remarks say so; a field that says No drops it inside the loop, on the trace.
  const aduFlag = (s: AduValueSale) => s.aduYn === true || isAduSale(s)
  const plain = withMiles.filter((x) => x.sale.aduYn !== true && !isAduSale(x.sale)).map((x) => x.sale)
  trace.push(
    `ADU value: ${detached.length} closed detached sale(s) in the ${radii[radii.length - 1]} mi search box over ${args.windowMonths ?? ADU_VALUE_MONTHS} months; ${withMiles.filter((x) => aduFlag(x.sale)).length} state an ADU, ${plain.length} do not (the plain baselines).`,
  )

  let chosen: { radius: number; pairs: AduValuePair[]; seen: number; unpaired: number } | null = null
  for (const radius of radii) {
    const inside = withMiles.filter((x) => x.miles <= radius && aduFlag(x.sale))
    const pairs: AduValuePair[] = []
    let unpaired = 0
    const dropped: string[] = []
    for (const { sale, miles } of inside) {
      if (sale.aduYn === false) {
        dropped.push(`${sale.address}: the MLS field says no ADU`)
        continue
      }
      const aduSqft = sale.aduSqft ?? null
      const source = sale.aduSqftSource ?? (sale.aduSqft != null ? 'mls' : null)
      if (aduSqft == null || source == null) {
        dropped.push(`${sale.address}: no ADU area on record or in the remarks`)
        continue
      }
      // The main home: the record's area, or the remarks' main figure when the
      // record counted both units (reconciledMainSqft).
      const mainSqft = sale.mainSqft != null && sale.mainSqft > 0 ? sale.mainSqft : sale.sqft
      if (aduSqft < ADU_SQFT_MIN || aduSqft > ADU_SQFT_MAX || aduSqft >= mainSqft) {
        dropped.push(`${sale.address}: ADU area ${aduSqft} sq ft is outside ${ADU_SQFT_MIN}-${ADU_SQFT_MAX} or not under the main home's ${mainSqft}`)
        continue
      }
      const base = baselineFor({ ...sale, sqft: mainSqft }, plain)
      if (!base) {
        unpaired += 1
        dropped.push(`${sale.address}: fewer than ${BASELINE_MIN_COMPS} plain sales near it in its era and size band`)
        continue
      }
      const mainValue = base.ppsf * mainSqft
      const aduDollars = sale.closePrice - mainValue
      pairs.push({
        listingKey: sale.listingKey,
        address: sale.address,
        subdivision: sale.subdivision ?? null,
        closeDate: sale.closeDate,
        closePrice: sale.closePrice,
        mainSqft,
        yearBuilt: sale.yearBuilt ?? null,
        miles: +miles.toFixed(2),
        aduSqft,
        aduSqftSource: source,
        plainComps: base.comps,
        plainPpsf: Math.round(base.ppsf),
        plainBasis: base.basis,
        mainValue: Math.round(mainValue),
        aduDollars: Math.round(aduDollars),
        aduPerSqft: Math.round(aduDollars / aduSqft),
      })
    }
    // ONE PAIR PER HOME. A home that sold twice in the window is one unit, not
    // two votes in the quartile: its latest sale is the pair (513 Irving, Bend,
    // sold 2025-03-31 and again 2026-05-21; the earlier pair read $128 a foot
    // and pulled the lower quartile under the home's own resale, 2026-10-15).
    const latestByHome = new Map<string, AduValuePair>()
    for (const pair of pairs) {
      const home = homeKey(pair.address)
      const held = latestByHome.get(home)
      if (!held || pair.closeDate > held.closeDate || (pair.closeDate === held.closeDate && pair.listingKey > held.listingKey)) latestByHome.set(home, pair)
    }
    const kept = new Set([...latestByHome.values()].map((pair) => pair.listingKey))
    const resold = pairs.filter((pair) => !kept.has(pair.listingKey))
    for (const pair of resold) dropped.push(`${pair.address}: sold again ${latestByHome.get(homeKey(pair.address))!.closeDate}, so its ${pair.closeDate} sale is not a second pair`)
    const onePerHome = pairs.filter((pair) => kept.has(pair.listingKey))
    onePerHome.sort((a, b) => a.miles - b.miles)
    trace.push(`ADU value: within ${radius} mi, ${inside.length} ADU sale(s), ${onePerHome.length} paired with a plain baseline${dropped.length ? ` (${dropped.length} not paired: ${dropped.slice(0, 6).join('; ')}${dropped.length > 6 ? '; ...' : ''})` : ''}.`)
    // Homes seen: one per address, leaving out a record whose field says no ADU.
    const seen = new Set(inside.filter((x) => x.sale.aduYn !== false).map((x) => homeKey(x.sale.address))).size
    chosen = { radius, pairs: onePerHome, seen, unpaired }
    if (onePerHome.length >= minimumPairs) break
  }
  const pairs = chosen?.pairs ?? []
  const rate = pairs.length >= minimumPairs ? quartiles(pairs.map((p) => p.aduPerSqft)) : null
  // A lower quartile at or below zero adds nothing: the unit is never the
  // reason a price is low, and a negative line would read as one (review 2026-10-15).
  const dollars = rate && rate.lowerQuartile > 0 ? Math.round((rate.lowerQuartile * args.subject.aduSqft) / 100) * 100 : null
  const perSqft = pairs.map((p) => p.aduPerSqft)
  const perSqftLow = perSqft.length ? Math.min(...perSqft) : null
  const perSqftHigh = perSqft.length ? Math.max(...perSqft) : null
  if (rate && dollars == null) {
    trace.push(`ADU value: ${pairs.length} pairs within ${chosen!.radius} mi, but the lower quartile of what the units brought is ${usd(rate.lowerQuartile)} a foot, at or below zero, so the unit adds no dollars and the letter says so.`)
  } else if (rate && dollars != null) {
    trace.push(
      `ADU value: ${pairs.length} pairs within ${chosen!.radius} mi; the unit added ${usd(Math.min(...pairs.map((p) => p.aduDollars)))} to ${usd(Math.max(...pairs.map((p) => p.aduDollars)))}, ${usd(rate.lowerQuartile)} to ${usd(rate.upperQuartile)} per ADU square foot across the middle half (median ${usd(rate.median)}). The lower quartile, ${usd(rate.lowerQuartile)} a foot, times the subject's ${args.subject.aduSqft} sq ft ADU adds ${usd(dollars)} to the price (Matt 2026-10-14).`,
    )
  } else {
    trace.push(`ADU value: ${pairs.length} pair(s) within ${chosen?.radius ?? radii[radii.length - 1]} mi, under the ${minimumPairs} the rule needs, so the unit adds no dollars and the letter says so (Matt 2026-10-14).`)
  }
  return {
    subjectAduSqft: args.subject.aduSqft,
    radiusMiles: chosen?.radius ?? radii[radii.length - 1]!,
    aduSalesSeen: chosen?.seen ?? 0,
    unpaired: chosen?.unpaired ?? 0,
    pairs: pairs.slice(0, MAX_PAIRS_PRINTED),
    pairsCounted: pairs.length,
    minimumPairs,
    windowMonths: args.windowMonths ?? null,
    rate,
    perSqftLow,
    perSqftHigh,
    dollars,
    trace,
  }
}

/** The calendar day `months` before an ISO date. */
function monthsBefore(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

/**
 * Read the ADU value for a subject from the live facts pool: closed sales
 * within the widest radius over the window, the MLS ADU fields on the ones
 * that state an ADU, the remarks' figure where the field is blank. Null when
 * the subject has no recorded ADU area or no position. Never throws: a read
 * failure returns the no-pairs result with the error on the trace.
 */
export async function readAduValue(args: {
  subject: { latitude: number | null; longitude: number | null; aduSqft: number | null; listingKey?: string | null; streetAddress?: string | null }
  asOf: string
}): Promise<AduValue | null> {
  const { latitude, longitude, aduSqft } = args.subject
  if (latitude == null || longitude == null || aduSqft == null || aduSqft <= 0) return null
  const widest = ADU_VALUE_RADII_MILES[ADU_VALUE_RADII_MILES.length - 1]!
  try {
    const { selectPricingFactsNear } = await import('@/lib/data/pricing/facts')
    const { getAduFacts } = await import('@/lib/data/listings/getAduFacts')
    const sales = await selectPricingFactsNear({
      latitude,
      longitude,
      radiusMiles: widest,
      closeAfter: monthsBefore(args.asOf, ADU_VALUE_MONTHS),
      closeBefore: args.asOf,
      sqftMin: 600,
      sqftMax: 4500,
      productClass: 'detached',
      maxRows: POOL_MAX_ROWS,
    })
    // The MLS field is read for the sales the remarks flag; a sale whose field
    // says Yes with silent remarks sits among the plain baselines (the field
    // is filled on recent records only, and the reader is capped at 600 keys).
    const flagged = sales.filter((s) => isAduSale(s))
    const facts = await getAduFacts(flagged.map((s) => s.listingKey))
    const enriched: AduValueSale[] = sales.map((s) => {
      const f = facts[s.listingKey]
      const fromRemarks = aduSqftFromRemarks(s.publicRemarks)
      const aduSqft = f?.aduSqft ?? fromRemarks ?? null
      return {
        ...s,
        aduYn: f?.aduYn ?? null,
        aduSqft,
        aduSqftSource: f?.aduSqft != null ? 'mls' : fromRemarks != null ? 'remarks' : null,
        mainSqft: reconciledMainSqft({ recordedSqft: s.sqft, aduSqft, mainSqft: mainSqftFromRemarks(s.publicRemarks) }),
      }
    })
    const value = aduContributoryValue({
      subject: { latitude, longitude, aduSqft, listingKey: args.subject.listingKey ?? null, streetAddress: args.subject.streetAddress ?? null },
      sales: enriched,
      windowMonths: ADU_VALUE_MONTHS,
    })
    if (sales.length >= POOL_MAX_ROWS) {
      value.trace.push(`ADU value: the pool reader returned its cap of ${POOL_MAX_ROWS} rows, newest first, so the oldest closes in the ${ADU_VALUE_MONTHS}-month window may be missing.`)
    }
    return value
  } catch (e) {
    return {
      subjectAduSqft: aduSqft,
      radiusMiles: widest,
      aduSalesSeen: 0,
      unpaired: 0,
      pairs: [],
      pairsCounted: 0,
      minimumPairs: ADU_VALUE_MIN_PAIRS,
      rate: null,
      perSqftLow: null,
      perSqftHigh: null,
      dollars: null,
      windowMonths: ADU_VALUE_MONTHS,
      trace: [`ADU value: the read failed (${e instanceof Error ? e.message : String(e)}), so the unit adds no dollars.`],
    }
  }
}

/** What a comparable sale states about its own ADU: the MLS field where filled, else the remarks. */
export type CompAduFacts = {
  isAdu: boolean
  aduSqft: number | null
  source: 'mls' | 'remarks' | null
  /** The main home's area when the sale's recorded living area includes its unit (reconciledMainSqft); else null. */
  mainSqft: number | null
}

/**
 * The ADU facts of each comparable sale, for the grid line: the MLS field
 * (getAduFacts) where it is filled, the remarks' figure where it is not. A
 * field that says No reads as no ADU whatever the remarks say. Never throws.
 */
export async function compAduFacts(
  comps: readonly { listingKey: string; publicRemarks?: string | null; sqft?: number | null }[],
): Promise<Map<string, CompAduFacts>> {
  const out = new Map<string, CompAduFacts>()
  let facts: Record<string, { aduYn: boolean | null; aduSqft: number | null }> = {}
  try {
    const { getAduFacts } = await import('@/lib/data/listings/getAduFacts')
    facts = await getAduFacts(comps.map((c) => c.listingKey))
  } catch {
    facts = {}
  }
  for (const c of comps) {
    const f = facts[c.listingKey]
    const fromRemarks = aduSqftFromRemarks(c.publicRemarks)
    const isAdu = f?.aduYn === true || (f?.aduYn !== false && isAduSale(c))
    const stated = isAdu ? (f?.aduSqft ?? fromRemarks ?? null) : null
    // The same bounds the pairing holds: a unit of 150 to 1,200 sq ft and under
    // the sale's own area. Outside them the area is unrecorded and the line is $0.
    const aduSqft =
      stated != null && stated >= ADU_SQFT_MIN && stated <= ADU_SQFT_MAX && (c.sqft == null || !(c.sqft > 0) || stated < c.sqft) ? stated : null
    out.set(c.listingKey, {
      isAdu,
      aduSqft,
      source: aduSqft != null ? (f?.aduSqft != null ? 'mls' : 'remarks') : null,
      mainSqft: isAdu ? reconciledMainSqft({ recordedSqft: c.sqft, aduSqft, mainSqft: mainSqftFromRemarks(c.publicRemarks) }) : null,
    })
  }
  return out
}

/**
 * The sales with the main home's area stamped where the record counted both
 * units, so the size line (lib/pricing/size-adjustment.ts) compares main home
 * to main home. The recorded area stays on `sqft` for the grid.
 */
export function withMainSqft<T extends { listingKey: string }>(items: readonly T[], compAdu: ReadonlyMap<string, CompAduFacts> | null | undefined): T[] {
  if (!compAdu) return [...items]
  return items.map((item) => {
    const main = compAdu.get(item.listingKey)?.mainSqft
    return main != null && main > 0 ? { ...item, mainSqft: main } : item
  })
}

/**
 * THE ADU LINE ON EVERY SALE. A sale without a unit moves up by what the
 * subject's unit adds (the lower-quartile rate times the subject's ADU area,
 * the same figure the letter's ADU chapter prints); a sale that states a unit
 * of recorded area moves by the difference in area at that rate, either way;
 * a sale that states a unit of unrecorded area is not moved, and the line
 * says so. The adjusted price carries the line, so the weighted price, the
 * range, the failed-ask ceiling and the net sheet all read the whole home.
 */
export function applyAduAdjustments<T extends { listingKey: string; adjustedPrice: number; aduAdjustment?: number; aduAdjustmentBasis?: string | null }>(
  comps: readonly T[],
  args: { value: AduValue; subjectAduSqft: number; compAdu: ReadonlyMap<string, CompAduFacts> },
): T[] {
  const rate = args.value.rate?.lowerQuartile
  if (rate == null || args.value.dollars == null) return [...comps]
  const toHundred = (n: number) => Math.round(n / 100) * 100
  return comps.map((c) => {
    const f = args.compAdu.get(c.listingKey)
    let aduAdjustment: number
    let basis: string
    if (f?.isAdu && f.aduSqft != null && f.aduSqft > 0) {
      const diff = args.subjectAduSqft - f.aduSqft
      aduAdjustment = toHundred(diff * rate)
      const n = (v: number) => v.toLocaleString('en-US')
      const counted = f.mainSqft != null && f.mainSqft > 0 ? ` inside its living area on record, so the size line compares its ${n(f.mainSqft)} sq ft main home` : ''
      basis =
        diff === 0
          ? `states a ${n(f.aduSqft)} sq ft ADU${counted}, the same unit area as yours: not moved for the unit`
          : `states a ${n(f.aduSqft)} sq ft ADU${counted}: moved for the ${n(Math.abs(diff))} sq ft it has ${diff > 0 ? 'less' : 'more'} than yours at $${n(rate)} a foot`
    } else if (f?.isAdu) {
      aduAdjustment = 0
      basis = 'states an ADU of unrecorded area: not moved for the unit'
    } else {
      aduAdjustment = args.value.dollars!
      basis = `no ADU: moved up by what yours adds, ${args.subjectAduSqft.toLocaleString('en-US')} sq ft at $${rate.toLocaleString('en-US')} a foot`
    }
    return { ...c, aduAdjustment, aduAdjustmentBasis: basis, adjustedPrice: Math.round(c.adjustedPrice + aduAdjustment) }
  })
}

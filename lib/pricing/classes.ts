/**
 * Pricing-moat classifiers — the apples-to-apples keys every future CMA / BPO
 * / expired estimate uses.
 *
 * Measured 2026-08-14 on 8,000 closed SFR (PropertyType='A'), Central Oregon,
 * CloseDate 2024-01-01+, typed columns only (docs/DATABASE_FOR_AI_AGENTS.md §4):
 *
 *   one-story vs two-story, 1600–2200 sqft: $369 vs $325 /sqft (+13.5%)
 *   HOA vs no HOA: $360 vs $363 (not a dollar adjustment; still a buyer pool)
 *   septic vs public sewer: $387 vs $352 (confounded with acreage — match, do
 *     not stack a septic premium on top of the lot split)
 *   lot <0.4 $346 · 0.4–1 $404 · 1–5 $385 · 5+ $452
 *   Bend subdivision median $/sqft: Tetherow $749 … Desert Skies $233
 *     (median-of-medians $400). A 30% band around the subject's subdivision
 *     median is the "obviously different / gated-expensive" cut.
 *   Age is NOT linear depreciation here: 0–5 yrs $333, 31–50 yrs $397. Older
 *     in-town westside trades higher. Age is a match band, never a %/year cut.
 *   Extra bedrooms in the same GLA band LOWER $/sqft (3bd $349, 4bd $310).
 *     Beds/baths are absorbed by the GLA adjustment — filter, do not dollar-add.
 *
 * `stories_total` is unused (0/8000 populated). Story comes from `levels`.
 * Typed `water` is unused on 2023+ closes (17,231/17,231 null). Water class
 * comes from PK-bounded `details.WaterSource` at facts-refresh time. Private
 * alone is unknown — Caldera community water and a ranch well share that flag.
 */

export type WaterClass = 'well' | 'public' | 'unknown'
export type SewerClass = 'septic' | 'public' | 'private' | 'unknown'
export type HoaClass = 'hoa' | 'no_hoa' | 'unknown'
export type LotClass = 'in_town' | 'large_lot' | 'acreage' | 'ranch' | 'unknown'
export type StoryClass = 'one' | 'two' | 'three_plus' | 'unknown'
export type AgeBand = 'new' | 'mid' | 'established' | 'vintage' | 'historic' | 'unknown'
export type ProductKey =
  | 'detached'
  | 'townhouse'
  | 'condo'
  | 'attached'
  | 'manufactured'
  | 'leased-land'
  | 'coop'
  | 'unknown'

const SUBDIVISION_SENTINEL =
  /^(n\.?\/?a\.?|none|no|null|other|unknown|tbd|not\s+(in\s+)?(a\s+)?(sub)?division|[-.*]+)$/i

export function flattenUtility(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v === true || v === 'true' || v === 1 || v === '1')
      .map(([k]) => k)
      .join(' ')
  }
  return String(raw)
}

export function classifyWater(raw: unknown): WaterClass {
  const s = flattenUtility(raw).toLowerCase()
  if (!s.trim()) return 'unknown'
  if (/\bwell\b/.test(s)) return 'well'
  if (/\bpublic\b|\bcity\b|\bmunicipal\b|\bcommunity\b|\bwater meter\b/.test(s)) return 'public'
  // Private alone is not a class. Caldera community water and a ranch well
  // both arrive as { Private: true }. Guessing either way invents a product.
  if (/\bprivate\b/.test(s)) return 'unknown'
  return 'unknown'
}

export function classifySewer(raw: unknown): SewerClass {
  const s = flattenUtility(raw).toLowerCase()
  if (!s.trim()) return 'unknown'
  // MLS "Septic Needed" / "needs septic" is a to-be-built or lot checkbox —
  // not an installed system. Live Rim View (Canceled new construction) ships
  // sewer='Septic Needed' while Perspective-class peers are public sewer;
  // treating the checkbox as hard septic starved the facts path after a8ab9ded.
  if (/septic\s+needed|needs?\s+(?:a\s+)?septic|septic\s+required/.test(s)) {
    return 'unknown'
  }
  if (/septic|leach|sand filter|capping fill|holding tank|alternative treatment/.test(s)) {
    return 'septic'
  }
  if (/public sewer|\bdistrict\b/.test(s)) return 'public'
  if (/private sewer/.test(s)) return 'private'
  if (/\bpublic\b/.test(s)) return 'public'
  return 'unknown'
}

export function classifyHoa(yn: boolean | null | undefined, fee: number | null | undefined): HoaClass {
  if (yn === true || (fee != null && fee > 0)) return 'hoa'
  if (yn === false && (fee == null || fee <= 0)) return 'no_hoa'
  if (yn === false) return 'no_hoa'
  return 'unknown'
}

export function classifyLot(acres: number | null | undefined): LotClass {
  if (acres == null || !Number.isFinite(acres) || acres < 0) return 'unknown'
  if (acres >= 5) return 'ranch'
  if (acres >= 1) return 'acreage'
  if (acres >= 0.4) return 'large_lot'
  return 'in_town'
}

export function classifyStory(levels: unknown, storiesTotal?: number | null): StoryClass {
  if (storiesTotal != null && Number.isFinite(storiesTotal)) {
    if (storiesTotal >= 3) return 'three_plus'
    if (storiesTotal === 2) return 'two'
    if (storiesTotal === 1) return 'one'
  }
  const s = flattenUtility(levels).toLowerCase()
  if (!s.trim()) return 'unknown'
  if (/three|tri/.test(s)) return 'three_plus'
  if (/\btwo\b/.test(s)) return 'two'
  if (/\bone\b|single/.test(s)) return 'one'
  if (/multi|split/.test(s)) return 'two'
  return 'unknown'
}

export function classifyAgeBand(yearBuilt: number | null | undefined, asOfYear: number): AgeBand {
  if (yearBuilt == null || yearBuilt < 1850 || yearBuilt > asOfYear + 2) return 'unknown'
  const age = asOfYear - yearBuilt
  if (age <= 5) return 'new'
  if (age <= 15) return 'mid'
  if (age <= 30) return 'established'
  if (age <= 50) return 'vintage'
  return 'historic'
}

export function classifyProduct(subType: string | null | undefined): ProductKey {
  if (!subType?.trim()) return 'unknown'
  const s = subType.toLowerCase()
  if (s.includes('leased land')) return 'leased-land'
  if (s.includes('cooperative') || s.includes('co-op')) return 'coop'
  if (s.includes('manufactured') || s.includes('mobile')) return 'manufactured'
  if (s.includes('town')) return 'townhouse'
  if (s.includes('condo')) return 'condo'
  if (s.includes('tenancy') || s.includes('attached')) return 'attached'
  if (s.includes('single family') || s.includes('detached') || s.includes('residence')) return 'detached'
  return 'unknown'
}

export function realSubdivisionName(value: string | null | undefined): string | null {
  const s = typeof value === 'string' ? value.trim() : null
  if (!s || SUBDIVISION_SENTINEL.test(s)) return null
  return s
}

export function normSubdivision(value: string | null | undefined): string | null {
  const s = realSubdivisionName(value)
  return s ? s.toLowerCase() : null
}

export function citySlug(city: string | null | undefined): string {
  const s = (city ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'unknown'
}

/** Same buyer-pool utilities. Unknown fails open so missing data does not drop a good sale. */
export function waterCompatible(a: WaterClass, b: WaterClass): boolean {
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

export function sewerCompatible(a: SewerClass, b: SewerClass): boolean {
  if (a === 'unknown' || b === 'unknown') return true
  if (a === b) return true
  // Private sewer and septic are both off-grid; public is the city system.
  if ((a === 'septic' && b === 'private') || (a === 'private' && b === 'septic')) return true
  return false
}

export function hoaCompatible(a: HoaClass, b: HoaClass): boolean {
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

/**
 * Rural/urban + acreage band. Mirrors lib/cma/market-area lotCharacterCompatible
 * so the two engines cannot disagree: 1 acre is the hard split; within acreage
 * the 0.4×–2.5× band still applies.
 */
export function lotCompatible(subjectAcres: number | null, compAcres: number | null): boolean {
  if (subjectAcres == null || compAcres == null) return true
  const subjectIsAcreage = subjectAcres >= 1
  const compIsAcreage = compAcres >= 1
  if (subjectIsAcreage !== compIsAcreage) return false
  if (!subjectIsAcreage) return true
  return compAcres >= subjectAcres * 0.4 && compAcres <= subjectAcres * 2.5
}
/**
 * Custom/new: keep the acreage vs in-town split, drop the 0.4×–2.5× band.
 * Live Rim View (~2 acres) vs Perspective (1.19) is inside the ordinary band,
 * but larger North Rim customs vs ~1-acre Awbrey peers were starving the set
 * on lot-character while baths/divides were already fixed.
 */
export function customLotCompatible(subjectAcres: number | null, compAcres: number | null): boolean {
  if (subjectAcres == null || compAcres == null) return true
  const subjectIsAcreage = subjectAcres >= 1
  const compIsAcreage = compAcres >= 1
  return subjectIsAcreage === compIsAcreage
}



/** Close under 10% of last ask, or over 10× last ask, is a facts bug. */
export const IMPLAUSIBLE_CLOSE_RATIO = 0.1
export const IMPLAUSIBLE_CLOSE_RATIO_HIGH = 10

export function plausibleListedClose(closePrice: number, lastAsk: number | null | undefined): boolean {
  if (!(closePrice > 0)) return false
  if (lastAsk == null || !(lastAsk > 0)) return true
  return (
    closePrice >= lastAsk * IMPLAUSIBLE_CLOSE_RATIO &&
    closePrice <= lastAsk * IMPLAUSIBLE_CLOSE_RATIO_HIGH
  )
}

/** 0–2 years from as-of wins over NewConstructionYN=false. Null year and no flag stay unknown. */
export function isNewBuild(
  yearBuilt: number | null | undefined,
  asOfYear: number,
  flag?: boolean | null,
): boolean | null {
  const byYear =
    yearBuilt != null && yearBuilt >= 1850 ? asOfYear - yearBuilt <= 2 : null
  if (byYear === true) return true
  if (flag === true) return true
  if (flag === false) return false
  return byYear
}

export function newConstructionCompatible(a: boolean | null, b: boolean | null): boolean {
  if (a == null || b == null) return true
  return a === b
}

export function productCompatible(a: ProductKey, b: ProductKey): boolean {
  if (a === 'unknown' || b === 'unknown') return false
  return a === b
}

/**
 * Custom / new peers often differ by one whole bath (3 vs 4) without leaving
 * the buyer pool. Ordinary subjects still use exact whole-bath matching via
 * bathCountCompatible in market-area.ts.
 */
export function customBathCompatible(subjectBaths: number | null, compBaths: number | null): boolean {
  if (subjectBaths == null || !Number.isFinite(subjectBaths) || subjectBaths <= 0) return true
  if (compBaths == null || !Number.isFinite(compBaths) || compBaths <= 0) return false
  return Math.abs(Math.floor(subjectBaths) - Math.floor(compBaths)) <= 1
}

/**
 * Subdivision price-tier. A 30% gap in median $/sqft is the "Tetherow vs
 * Stone Creek" / gated-expensive cut measured 2026-08-14. Thin cells (n < 5)
 * fail open — excluding on a four-sale sample invents a market.
 */
export const SUBDIVISION_TIER_RATIO = 1.3
/** Same GIS neighborhood: tract vs custom (Awbrey Woods $382 vs Awbrey Butte $457). */
export const SAME_NEIGHBORHOOD_TIER_RATIO = 1.15
export const SUBDIVISION_TIER_MIN_N = 5

export function similarPerformingSubdivision(
  subjectMedianPpsf: number | null,
  subjectN: number,
  compMedianPpsf: number | null,
  compN: number,
  ratio: number = SUBDIVISION_TIER_RATIO,
): boolean {
  if (
    subjectMedianPpsf == null ||
    compMedianPpsf == null ||
    subjectMedianPpsf <= 0 ||
    compMedianPpsf <= 0 ||
    subjectN < SUBDIVISION_TIER_MIN_N ||
    compN < SUBDIVISION_TIER_MIN_N
  ) {
    return true
  }
  const gap = compMedianPpsf / subjectMedianPpsf
  return gap >= 1 / ratio && gap <= ratio
}

export type RemarkFlags = {
  newRoof: boolean
  newRoofPhrase: string | null
  remodeled: boolean
  remodeledPhrase: string | null
  updatedKitchen: boolean
  updatedKitchenPhrase: string | null
  newConstruction: boolean
  newConstructionPhrase: string | null
  distressed: boolean
  distressedPhrase: string | null
  irrigated: boolean
  irrigatedPhrase: string | null
  dry: boolean
  dryPhrase: string | null
  horseProperty: boolean
  horsePropertyPhrase: string | null
  barn: boolean
  barnPhrase: string | null
  customQuality: boolean
  customQualityPhrase: string | null
}

type RemarkBoolKey =
  | 'newRoof'
  | 'remodeled'
  | 'updatedKitchen'
  | 'newConstruction'
  | 'distressed'
  | 'irrigated'
  | 'dry'
  | 'horseProperty'
  | 'barn'
  | 'customQuality'

const REMARK_RULES: Array<{ key: RemarkBoolKey; phrase: keyof RemarkFlags; re: RegExp }> = [
  {
    key: 'newRoof',
    phrase: 'newRoofPhrase',
    re: /\b(?:new roof|roof(?:ing)?\s+(?:was\s+)?(?:replaced|new|installed)|roof(?:ing)?\s+(?:in|replaced in|updated in)\s+20\d{2})\b/i,
  },
  { key: 'remodeled', phrase: 'remodeledPhrase', re: /\b(?:fully\s+)?remodel(?:ed|ing)?\b|\bupdated throughout\b/i },
  { key: 'updatedKitchen', phrase: 'updatedKitchenPhrase', re: /\b(?:updated|new|remodeled)\s+kitchen\b|\bkitchen\s+remodel/i },
  {
    key: 'newConstruction',
    phrase: 'newConstructionPhrase',
    // Belt with customQuality: live Rim remarks say to-be-built / brand-new without
    // the literal phrase "new construction".
    re: /\bnew construction\b|\bto[\s-]+be[\s-]+built\b|\bbrand[\s-]+new\b|\bnever[\s-]+lived[\s-]+in\b|\bspec(?:ulative)?[\s-]+home\b/i,
  },
  {
    key: 'distressed',
    phrase: 'distressedPhrase',
    re: /\bas[\s-]is\b|\bfixer\b|\bestate sale\b|\bforeclosure\b|\bshort sale\b|\bneeds work\b/i,
  },
  {
    key: 'dry',
    phrase: 'dryPhrase',
    re: /\bno[\s-]+(?:irrigation|water[\s-]+rights?)\b|\bnon[\s-]+irrigat(?:ed|ion)\b|\bdry[\s-]+(?:lot|acreage|land|parcel)\b/i,
  },
  {
    key: 'irrigated',
    phrase: 'irrigatedPhrase',
    re: /\birrigat(?:ed|ion|es|ing)?\b|\bwater[\s-]+rights?\b|\bditch\s+water\b/i,
  },
  {
    key: 'horseProperty',
    phrase: 'horsePropertyPhrase',
    re: /\bhorse[\s-]+propert(?:y|ies)\b|\bdesignated\s+horse\b|\bequestrian\b|\bhorse[\s-]+(?:barn|facilit|setup|allowed|ready)\b|\bstables?\b|\barena\b/i,
  },
  { key: 'barn', phrase: 'barnPhrase', re: /\bbarns?\b|\bstables?\b/i },
  {
    key: 'customQuality',
    phrase: 'customQualityPhrase',
    // Live Rim View canceled remarks say "mid-century modern" / never "custom built".
    // To-be-built / under construction also mark the new/custom buyer pool.
    re: /\bcustom[\s-]+(?:built|home|house|residence|construction|designed|estate|modern)\b|\bmodern[\s-]+custom\b|\barchitect(?:urally)?[\s-]*designed\b|\bmid[\s-]?century(?:\s+modern)?\b|\bto[\s-]?be[\s-]?built\b|\bunder\s+construction\b/i,
  },
]

function emptyRemarkFlags(): RemarkFlags {
  return {
    newRoof: false,
    newRoofPhrase: null,
    remodeled: false,
    remodeledPhrase: null,
    updatedKitchen: false,
    updatedKitchenPhrase: null,
    newConstruction: false,
    newConstructionPhrase: null,
    distressed: false,
    distressedPhrase: null,
    irrigated: false,
    irrigatedPhrase: null,
    dry: false,
    dryPhrase: null,
    horseProperty: false,
    horsePropertyPhrase: null,
    barn: false,
    barnPhrase: null,
    customQuality: false,
    customQualityPhrase: null,
  }
}

export function extractRemarkFlags(text: string | null | undefined): RemarkFlags {
  const empty = emptyRemarkFlags()
  if (!text?.trim()) return empty
  const out = { ...empty }
  for (const rule of REMARK_RULES) {
    const m = text.match(rule.re)
    if (m?.[0]) {
      out[rule.key] = true
      ;(out[rule.phrase] as string | null) = m[0].slice(0, 80)
    }
  }
  // Dry / non-irrigated wins over a bare "irrigation" mention in the same blurb
  // ("no irrigation" also matches the irrigated regex).
  if (out.dry) {
    out.irrigated = false
    out.irrigatedPhrase = null
  }
  return out
}

/** Irrigated and dry are two different properties. Unknown fails open. */
export type IrrigationClass = 'irrigated' | 'dry' | 'unknown'

export type OwrdIrrigationSignal = {
  mappedIrrigationAcres?: number | null
  hasPrivateAppurtenant?: boolean | null
}

export function irrigationClassFromRemarks(text: string | null | undefined): IrrigationClass {
  const flags = extractRemarkFlags(text)
  if (flags.dry) return 'dry'
  if (flags.irrigated) return 'irrigated'
  return 'unknown'
}

/**
 * OWRD maps irrigation onto the subject parcel. Presence of mapped perfected
 * acres or a private appurtenant right is irrigated. Absence is NOT dry —
 * a failed query or a district boundary is not a dryness proof.
 */
export function irrigationClassFromOwrd(owrd: OwrdIrrigationSignal | null | undefined): IrrigationClass {
  if (!owrd) return 'unknown'
  if ((owrd.mappedIrrigationAcres ?? 0) > 0 || owrd.hasPrivateAppurtenant === true) return 'irrigated'
  return 'unknown'
}

export function resolveIrrigationClass(
  remarks: string | null | undefined,
  owrd?: OwrdIrrigationSignal | null,
  known?: IrrigationClass | null,
): IrrigationClass {
  if (known === 'irrigated' || known === 'dry') return known
  const fromOwrd = irrigationClassFromOwrd(owrd)
  if (fromOwrd !== 'unknown') return fromOwrd
  return irrigationClassFromRemarks(remarks)
}

export function irrigationCompatible(a: IrrigationClass, b: IrrigationClass): boolean {
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

/**
 * Horse barns / designated horse property. Empty remarks fail open. A subject
 * that names horse infrastructure does not keep a sale whose remarks name none.
 */
export function horseInfrastructureCompatible(
  subjectRemarks: string | null | undefined,
  saleRemarks: string | null | undefined,
): boolean {
  const subjectText = subjectRemarks?.trim() ?? ''
  const saleText = saleRemarks?.trim() ?? ''
  if (!subjectText || !saleText) return true
  const subject = extractRemarkFlags(subjectText)
  const sale = extractRemarkFlags(saleText)
  if ((subject.horseProperty || subject.barn) && !sale.horseProperty && !sale.barn) return false
  if ((sale.horseProperty || sale.barn) && !subject.horseProperty && !subject.barn) return false
  return true
}

/** One construction generation — the tight ageYears band on the subdivision rungs. */
export const CUSTOM_NEW_YEAR_BAND = 15

export type YearQualityInput = {
  yearBuilt: number | null | undefined
  newConstructionYn?: boolean | null
  remarks?: string | null
  /** MLS property_sub_type — "New Construction" is its own class even when YN is null. */
  propertySubType?: string | null
  /** MLS StandardStatus — live-shape callers pass it; does not alone classify. */
  standardStatus?: string | null
}

function asOfYearOrNow(asOfYear?: number): number {
  return asOfYear ?? new Date().getFullYear()
}

export function remarksMarkCustomOrNew(remarks: string | null | undefined): boolean {
  if (!remarks?.trim()) return false
  const flags = extractRemarkFlags(remarks)
  return flags.customQuality || flags.newConstruction
}

/** MLS PropertySubType / property_sub_type that names new construction. */
export function subtypeMarksCustomOrNew(propertySubType: string | null | undefined): boolean {
  if (!propertySubType?.trim()) return false
  return /\bnew\s+construction\b/i.test(propertySubType)
}

/** True when year, NewConstructionYN, subtype, or remarks put the subject in the custom/new class. */
export function isCustomOrNewSubject(input: YearQualityInput, asOfYear?: number): boolean {
  const asOf = asOfYearOrNow(asOfYear)
  if (input.newConstructionYn === true) return true
  if (subtypeMarksCustomOrNew(input.propertySubType)) return true
  if (isNewBuild(input.yearBuilt, asOf, input.newConstructionYn) === true) return true
  const year = input.yearBuilt
  if (year != null && year >= 1850 && year <= asOf + 2 && asOf - year <= 5) return true
  // Live canceled Rim View: remarks carry "mid-century modern" / "to-be-built" without
  // the words "custom built". Without this, a subject that somehow lost year/YN
  // falls to listings and re-applies unmappedCrossesKnownBank + exact baths/lot.
  return remarksMarkCustomOrNew(input.remarks)
}

/**
 * Custom / new subjects do not take a different construction generation.
 * Unknown year on that class fails CLOSED when the sale cannot prove it is
 * also custom/new. Ordinary resale subjects skip this rule.
 */
export function yearQualityCompatible(
  subject: YearQualityInput,
  comp: YearQualityInput,
  asOfYear?: number,
): boolean {
  const asOf = asOfYearOrNow(asOfYear)
  if (!isCustomOrNewSubject(subject, asOf)) return true
  const subjectYear = subject.yearBuilt
  const compYear = comp.yearBuilt
  if (subjectYear != null && subjectYear >= 1850 && (compYear == null || compYear < 1850)) {
    return isCustomOrNewSubject(comp, asOf)
  }
  if (subjectYear != null && compYear != null && subjectYear >= 1850 && compYear >= 1850) {
    return Math.abs(subjectYear - compYear) <= CUSTOM_NEW_YEAR_BAND
  }
  return isCustomOrNewSubject(comp, asOf)
}

export type AcreageInfrastructureFlags = {
  irrigated: boolean
  horse: boolean
  barns: boolean
}

export function acreageInfrastructureFlags(remarks: string | null | undefined): AcreageInfrastructureFlags {
  const flags = extractRemarkFlags(remarks)
  return {
    irrigated: flags.irrigated && !flags.dry,
    horse: flags.horseProperty,
    barns: flags.barn,
  }
}

/**
 * Acreage infrastructure: irrigation is a hard split (remarks and/or OWRD).
 * Horse / barn require remarks on both sides; empty remarks fail open there.
 */
export function acreageInfrastructureCompatible(
  subject: {
    lotAcres: number | null | undefined
    remarks?: string | null
    irrigationClass?: IrrigationClass | null
  },
  comp: { lotAcres: number | null | undefined; remarks?: string | null },
): boolean {
  const subjectIrr = resolveIrrigationClass(subject.remarks, null, subject.irrigationClass)
  const compIrr = irrigationClassFromRemarks(comp.remarks)
  if (!irrigationCompatible(subjectIrr, compIrr)) return false
  if ((subject.lotAcres ?? 0) < 1) return true
  return horseInfrastructureCompatible(subject.remarks, comp.remarks)
}

/** Measured one-story premium vs two-story, same 1600–2200 GLA band, 2024+ CO SFR. */
export const ONE_STORY_PREMIUM = 0.135

/**
 * Dollar story adjustment AFTER time + GLA. Same story = 0. Unknown = 0.
 * Subject one / comp two → add the premium (comp understates a ranch).
 */
export function storyAdjustment(subject: StoryClass, comp: StoryClass, timeAdjustedPrice: number): number {
  if (subject === 'unknown' || comp === 'unknown' || subject === comp) return 0
  if (subject === 'one' && (comp === 'two' || comp === 'three_plus')) {
    return Math.round(timeAdjustedPrice * ONE_STORY_PREMIUM)
  }
  if ((subject === 'two' || subject === 'three_plus') && comp === 'one') {
    return Math.round(-timeAdjustedPrice * ONE_STORY_PREMIUM)
  }
  return 0
}

export const CENTRAL_OREGON_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Powell Butte',
  'Culver',
  'Tumalo',
  'Black Butte Ranch',
  'Camp Sherman',
  'Crooked River Ranch',
] as const

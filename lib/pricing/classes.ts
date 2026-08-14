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
export type ProductKey = 'detached' | 'attached' | 'manufactured' | 'leased-land' | 'coop' | 'unknown'

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
  if (s.includes('town') || s.includes('condo') || s.includes('tenancy') || s.includes('attached')) {
    return 'attached'
  }
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

/** Close under 10% of last ask is a facts bug, not a distressed sale. */
export const IMPLAUSIBLE_CLOSE_RATIO = 0.1

export function plausibleListedClose(closePrice: number, lastAsk: number | null | undefined): boolean {
  if (!(closePrice > 0)) return false
  if (lastAsk == null || !(lastAsk > 0)) return true
  return closePrice >= lastAsk * IMPLAUSIBLE_CLOSE_RATIO
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
  if (a === 'unknown' || b === 'unknown') return true
  return a === b
}

/**
 * Subdivision price-tier. A 30% gap in median $/sqft is the "Tetherow vs
 * Stone Creek" / gated-expensive cut measured 2026-08-14. Thin cells (n < 5)
 * fail open — excluding on a four-sale sample invents a market.
 */
export const SUBDIVISION_TIER_RATIO = 1.3
export const SUBDIVISION_TIER_MIN_N = 5

export function similarPerformingSubdivision(
  subjectMedianPpsf: number | null,
  subjectN: number,
  compMedianPpsf: number | null,
  compN: number,
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
  const ratio = compMedianPpsf / subjectMedianPpsf
  return ratio >= 1 / SUBDIVISION_TIER_RATIO && ratio <= SUBDIVISION_TIER_RATIO
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
}

const REMARK_RULES: Array<{ key: keyof Pick<RemarkFlags, 'newRoof' | 'remodeled' | 'updatedKitchen' | 'newConstruction' | 'distressed'>; phrase: keyof RemarkFlags; re: RegExp }> = [
  {
    key: 'newRoof',
    phrase: 'newRoofPhrase',
    re: /\b(?:new roof|roof(?:ing)?\s+(?:was\s+)?(?:replaced|new|installed)|roof(?:ing)?\s+(?:in|replaced in|updated in)\s+20\d{2})\b/i,
  },
  { key: 'remodeled', phrase: 'remodeledPhrase', re: /\b(?:fully\s+)?remodel(?:ed|ing)?\b|\bupdated throughout\b/i },
  { key: 'updatedKitchen', phrase: 'updatedKitchenPhrase', re: /\b(?:updated|new|remodeled)\s+kitchen\b|\bkitchen\s+remodel/i },
  { key: 'newConstruction', phrase: 'newConstructionPhrase', re: /\bnew construction\b/i },
  {
    key: 'distressed',
    phrase: 'distressedPhrase',
    re: /\bas[\s-]is\b|\bfixer\b|\bestate sale\b|\bforeclosure\b|\bshort sale\b|\bneeds work\b/i,
  },
]

export function extractRemarkFlags(text: string | null | undefined): RemarkFlags {
  const empty: RemarkFlags = {
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
  }
  if (!text?.trim()) return empty
  const out = { ...empty }
  for (const rule of REMARK_RULES) {
    const m = text.match(rule.re)
    if (m?.[0]) {
      out[rule.key] = true
      ;(out[rule.phrase] as string | null) = m[0].slice(0, 80)
    }
  }
  return out
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

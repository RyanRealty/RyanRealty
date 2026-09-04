/**
 * CMA comparability judgment — the self-consistency mechanism.
 *
 * lib/cma/judge.ts owns the orchestration (prompt, model call, repair turn,
 * deterministic resolution). This module owns the thing that makes any of that
 * enforceable: the pure check that reads a judgment back against its OWN stated
 * rule and reports every place the two disagree.
 *
 * WHY (2026-07-30). The adversarial auditor's most frequent real catch was the
 * judge applying its own exclusion criteria unevenly. On cma-922-ogden it
 * excluded closed sales at $676-801/sqft as a premium tier, then kept one at
 * $631/sqft while the rest of the retained set sat at $446-544/sqft. $631 is
 * closer to the sales it threw out than to the ones it kept, so the rule was
 * applied to some candidates and not others. That is indefensible in front of a
 * seller, and no amount of prompt prose fixes it — an LLM asked to be
 * consistent is still only as consistent as its sampling.
 *
 * So the criterion stops being a vibe and becomes two numbers. The model
 * DECLARES ppsfFloor and ppsfCeiling, and code holds it to them:
 *
 *   V1 band   a kept comp outside [floor, ceiling] — the declared rule does not
 *             cover the set it produced.
 *   V2 band   a price-tier exclusion INSIDE [floor, ceiling] — the same number
 *             both keeps and excludes.
 *   V3 strand a kept comp separated from the retained cluster by a bigger gap
 *             than the gap to the nearest price-tier exclusion. This is the 922
 *             Ogden defect exactly: retained $446-544 plus one at $631, excluded
 *             from $676. $631 belongs with the excluded group.
 *   V4 prose  the narrative calls a kept comp excluded, or an excluded comp kept.
 *   V5 cover  a candidate with no verdict at all, which the caller would drop
 *             from the priced set with no reason on record.
 *
 * Measured on the live corpus 2026-07-30: 66 of 183 draft documents (36%) whose
 * stored judgment carried at least one of these contradictions.
 *
 * Everything here is pure and synchronous. No I/O, no model call, no throw.
 */

import type { CmaComp } from '@/lib/cma/types'
import {
  isCustomOrNewSubject,
  yearQualityCompatible,
  type YearQualityInput,
} from '@/lib/pricing/classes'

export type CompTier = 'strong' | 'weak' | 'exclude'

/** The criterion an exclusion rests on. Only `price-tier` is code-enforced,
 *  because only a price tier is a pure number the model can state and then
 *  contradict. */
export type ExclusionBasis =
  | 'price-tier'
  | 'condition'
  | 'size'
  | 'vintage'
  | 'lot'
  | 'location'
  | 'structure-type'
  | 'recency'
  | 'other'

export const EXCLUSION_BASES: ExclusionBasis[] = [
  'price-tier',
  'condition',
  'size',
  'vintage',
  'lot',
  'location',
  'structure-type',
  'recency',
  'other',
]

export interface CompVerdict {
  listingKey: string
  tier: CompTier
  reason: string
  /** Present on exclusions. Which criterion the exclusion rests on. */
  basis?: ExclusionBasis
}

export interface ConsistencyCheck {
  violations: string[]
  /** Kept listingKeys that sit outside the declared band or are stranded above
   *  or below the retained cluster. The caller excludes these if repair fails. */
  offendingKeptKeys: string[]
}

/** Closed $/sqft, rounded. 0 when the sale carries no living area. */
export function ppsf(c: CmaComp): number {
  return c.sqft > 0 ? Math.round(c.closePrice / c.sqft) : 0
}

/** Reason text that betrays a price-tier exclusion even when `basis` says
 *  otherwise — the auditor reads the reason, not the enum. */
const PRICE_TIER_REASON_RE =
  /(price (tier|point|range|band|level))|(\$\s?\d[\d,]*\s*\/\s*sq)|(per square foot)|(\/sqft)|(premium tier)|(luxury tier)|(higher price)|(price segment)/i

export function isPriceTierExclusion(v: CompVerdict): boolean {
  if (v.tier !== 'exclude') return false
  if (v.basis === 'price-tier') return true
  if (v.basis && v.basis !== 'other') return false
  return PRICE_TIER_REASON_RE.test(v.reason)
}

const STREET_SUFFIX_RE =
  /\b(ave|avenue|st|street|rd|road|dr|drive|ln|lane|ct|court|way|pl|place|blvd|boulevard|ter|terrace|cir|circle|loop|hwy|highway|trl|trail|pkwy|parkway|n|s|e|w|ne|nw|se|sw|north|south|east|west|unit|apt)\b/gi

/** The distinctive street-name token of an address, for narrative matching.
 *  "1223 NW Fresno Ave, Bend" -> "fresno". Null when nothing distinctive is
 *  left (the check then skips that comp rather than guessing). */
export function streetToken(address: string): string | null {
  const head = address.split(',')[0] ?? ''
  const words = head
    .replace(/\d+/g, ' ')
    .replace(STREET_SUFFIX_RE, ' ')
    .replace(/[^A-Za-z\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
  if (words.length === 0) return null
  return words[0]!.toLowerCase()
}

const EXCLUSION_VERB_RE = /\b(exclud\w*|dropp?ed|removed|omitted|discarded|set aside|disregard\w*|left out|not used|no longer)\b/i
const RETENTION_VERB_RE = /\b(kept|retain\w*|included|anchor\w*|relied on|form the|carry the)\b/i

/**
 * Seller notes append the judge narrative to the priced set. If the model
 * called a kept sale excluded, that sentence cannot print. Treat every priced
 * address as kept and drop the contradicting sentences.
 */
export function alignNarrativeToPricedSet(
  priced: ReadonlyArray<{ listingKey: string; address: string }>,
  narrative: string,
): string {
  if (!narrative.trim() || priced.length === 0) return narrative
  const comps = priced.map((c) => ({ listingKey: c.listingKey, address: c.address })) as CmaComp[]
  const verdictByKey = new Map(
    priced.map((c) => [c.listingKey, { listingKey: c.listingKey, tier: 'strong' as const, reason: 'priced' }]),
  )
  // Fix the stated count against the set that actually priced BEFORE excising
  // sentences — the count describes the whole set, not the sentence it sits in.
  const counted = repairRetainedCount(narrative, priced.length)
  const sentences = splitSentences(counted)
  const cleaned = sentences.filter((s) => narrativeMismatches(comps, verdictByKey, s).length === 0)
  if (cleaned.length === 0) return ''
  return cleaned.join(' ')
}

/**
 * V6 support — the count the narrative claims it kept.
 *
 * The single most common real audit failure on the live corpus (2026-09-04):
 * the prose opens "Three closed sales were retained" while the priced set holds
 * four. The judge writes the sentence before the deterministic layer finishes
 * dropping comps, so a later exclusion leaves the number stale. An auditor
 * reading the document sees the narrative contradict the table directly beneath
 * it and calls it fabricated evidence, which is the correct read: a seller
 * would see the same thing.
 *
 * The count is not an opinion, so it is not left to the model. It is parsed,
 * compared, and rewritten from the set that actually priced.
 */
const NUMBER_WORDS: ReadonlyArray<string> = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
]

/** "Three closed sales were retained" / "9 comparable sales were retained". */
const RETAINED_COUNT_RE =
  /\b(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b(\s+(?:closed|comparable|nearby|recent)){0,2}\s+sales\s+were\s+retained/i

function wordToInt(token: string): number | null {
  const t = token.trim().toLowerCase()
  if (/^\d{1,2}$/.test(t)) return Number(t)
  const i = NUMBER_WORDS.indexOf(t)
  return i >= 0 ? i : null
}

function intToWord(n: number): string {
  return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n]! : String(n)
}

/** Match the casing of the token being replaced, so a sentence-opening word stays capitalised. */
function matchCase(sample: string, replacement: string): string {
  if (/^[A-Z]/.test(sample)) return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  return replacement
}

/** The retained count the narrative states, or null when it does not state one. */
export function statedRetainedCount(narrative: string): number | null {
  const m = RETAINED_COUNT_RE.exec(narrative ?? '')
  if (!m) return null
  return wordToInt(m[1] ?? '')
}

/**
 * Rewrite the stated retained count to `actual`. Returns the narrative
 * unchanged when it states no count, or already states the right one.
 */
export function repairRetainedCount(narrative: string, actual: number): string {
  const text = narrative ?? ''
  const m = RETAINED_COUNT_RE.exec(text)
  if (!m) return text
  const token = m[1] ?? ''
  const stated = wordToInt(token)
  if (stated == null || stated === actual) return text
  const replacement = /^\d{1,2}$/.test(token.trim()) ? String(actual) : matchCase(token, intToWord(actual))
  const at = m.index + m[0].indexOf(token)
  return text.slice(0, at) + replacement + text.slice(at + token.length)
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Sentences in `narrative` that describe a comp the opposite way to its verdict.
 * Exported so the caller can re-run it per sentence when it has to excise one.
 */
export function narrativeMismatches(
  comps: CmaComp[],
  verdictByKey: Map<string, CompVerdict>,
  narrative: string,
): string[] {
  if (!narrative.trim()) return []
  const out: string[] = []
  // Skip tokens shared by more than one comp — a shared street name cannot be
  // attributed to a single verdict.
  const tokenCounts = new Map<string, number>()
  const tokenByKey = new Map<string, string>()
  for (const c of comps) {
    const t = streetToken(c.address)
    if (!t) continue
    tokenByKey.set(c.listingKey, t)
    tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1)
  }
  const sentences = splitSentences(narrative)
  for (const [key, token] of tokenByKey) {
    if ((tokenCounts.get(token) ?? 0) > 1) continue
    const verdict = verdictByKey.get(key)
    if (!verdict) continue
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    for (const s of sentences) {
      if (!re.test(s)) continue
      const saysExcluded = EXCLUSION_VERB_RE.test(s)
      const saysKept = RETENTION_VERB_RE.test(s)
      if (verdict.tier === 'exclude' && saysKept && !saysExcluded) {
        out.push(`The narrative presents ${token} as retained, but its verdict is exclude. Fix one of the two.`)
      } else if (verdict.tier !== 'exclude' && saysExcluded && !saysKept) {
        out.push(`The narrative presents ${token} as excluded, but its verdict is ${verdict.tier} and it stays in the priced set. Fix one of the two.`)
      }
    }
  }
  return [...new Set(out)]
}

/**
 * Check a judgment against its own declared rule. Pure. See the module header
 * for what V1 through V5 mean and why each one exists.
 *
 * Every violation string is written to be handed straight back to the model as
 * the repair instruction, so it names the comp, both numbers, and the choice
 * the model has to make.
 */
export function checkJudgmentConsistency(args: {
  comps: CmaComp[]
  verdicts: CompVerdict[]
  ppsfFloor: number
  ppsfCeiling: number
  narrative: string
}): ConsistencyCheck {
  const { comps, verdicts, ppsfFloor, ppsfCeiling, narrative } = args
  const violations: string[] = []
  const offending = new Set<string>()
  const byKey = new Map(comps.map((c) => [c.listingKey, c]))
  const verdictByKey = new Map(verdicts.map((v) => [v.listingKey, v]))

  const keptPpsf = verdicts
    .filter((v) => v.tier !== 'exclude')
    .map((v) => ({ key: v.listingKey, p: byKey.get(v.listingKey) ? ppsf(byKey.get(v.listingKey)!) : 0 }))
    .filter((x) => x.p > 0)
    .sort((a, b) => a.p - b.p)

  const priceExclusions = verdicts
    .filter(isPriceTierExclusion)
    .map((v) => ({ key: v.listingKey, p: byKey.get(v.listingKey) ? ppsf(byKey.get(v.listingKey)!) : 0 }))
    .filter((x) => x.p > 0)

  const bandOk = Number.isFinite(ppsfFloor) && Number.isFinite(ppsfCeiling) && ppsfCeiling > ppsfFloor && ppsfFloor > 0

  if (bandOk) {
    // V1 — kept outside the declared band.
    for (const k of keptPpsf) {
      if (k.p < ppsfFloor || k.p > ppsfCeiling) {
        offending.add(k.key)
        violations.push(
          `Comp ${k.key} is KEPT at $${k.p}/sqft but your declared band is $${ppsfFloor} to $${ppsfCeiling}/sqft. Either the band is wrong or this comp does not belong.`,
        )
      }
    }
    // V2 — price-tier exclusion inside the declared band.
    for (const e of priceExclusions) {
      if (e.p >= ppsfFloor && e.p <= ppsfCeiling) {
        violations.push(
          `Comp ${e.key} is EXCLUDED on price tier at $${e.p}/sqft, but that is inside your own declared band of $${ppsfFloor} to $${ppsfCeiling}/sqft. Give a real non-price reason or keep it.`,
        )
      }
    }
  } else {
    violations.push(
      `No usable $/sqft band was declared (floor $${ppsfFloor}, ceiling $${ppsfCeiling}). State the band you priced the subject in.`,
    )
  }

  // V3 — a stranded kept comp, high side and low side.
  for (const v of strandViolations(keptPpsf, priceExclusions)) {
    violations.push(v.message)
    for (const k of v.keys) offending.add(k)
  }

  // V4 — the narrative contradicts the verdicts.
  for (const mismatch of narrativeMismatches(comps, verdictByKey, narrative)) violations.push(mismatch)

  // V6 — the narrative states a retained count that is not the retained count.
  const statedCount = statedRetainedCount(narrative)
  const actualKept = verdicts.filter((v) => v.tier !== 'exclude').length
  if (statedCount != null && statedCount !== actualKept) {
    violations.push(
      `The narrative says ${statedCount} sales were retained, but ${actualKept} carry a non-exclude verdict. Say the number you actually kept.`,
    )
  }

  // V5 — a candidate with no verdict is dropped with no reason on record.
  const missing = comps.filter((c) => !verdictByKey.has(c.listingKey))
  if (missing.length > 0) {
    violations.push(
      `${missing.length} candidate comp(s) got no verdict (${missing.map((c) => c.listingKey).join(', ')}). Every candidate needs one, or it is dropped with no reason on record.`,
    )
  }

  return { violations, offendingKeptKeys: [...offending] }
}

type PpsfPoint = { key: string; p: number }

/**
 * V3. A kept sale is "stranded" when the gap separating it from the rest of the
 * retained cluster is WIDER than the gap separating it from the nearest sale
 * excluded on price tier. By the analysis's own arithmetic it sits with the
 * group that was thrown out.
 *
 * Only fires when the analysis actually used price tier as an exclusion
 * criterion (otherwise there is no rule to be inconsistent with) and only when
 * the internal gap is material (10% of the retained median), so a merely
 * dispersed but continuous set is left alone.
 */
function strandViolations(
  keptPpsf: PpsfPoint[],
  priceExclusions: PpsfPoint[],
): Array<{ message: string; keys: string[] }> {
  if (keptPpsf.length < 3 || priceExclusions.length === 0) return []
  const out: Array<{ message: string; keys: string[] }> = []
  const median = keptPpsf[Math.floor(keptPpsf.length / 2)]!.p
  const minGap = Math.max(1, Math.round(median * 0.1))

  const highExclusions = priceExclusions.filter((e) => e.p > keptPpsf[keptPpsf.length - 1]!.p)
  if (highExclusions.length > 0) {
    const nearestHigh = Math.min(...highExclusions.map((e) => e.p))
    for (let i = keptPpsf.length - 1; i >= 1; i--) {
      const gapBelow = keptPpsf[i]!.p - keptPpsf[i - 1]!.p
      const gapToExcluded = nearestHigh - keptPpsf[i]!.p
      if (gapBelow >= minGap && gapBelow > gapToExcluded) {
        out.push({
          keys: keptPpsf.slice(i).map((k) => k.key),
          message: `Comp ${keptPpsf[i]!.key} is KEPT at $${keptPpsf[i]!.p}/sqft, $${gapBelow}/sqft above the rest of the retained set but only $${gapToExcluded}/sqft below the cheapest sale you excluded on price tier ($${nearestHigh}/sqft). It sits with the excluded group, not the kept one.`,
        })
        break
      }
    }
  }

  const lowExclusions = priceExclusions.filter((e) => e.p < keptPpsf[0]!.p)
  if (lowExclusions.length > 0) {
    const nearestLow = Math.max(...lowExclusions.map((e) => e.p))
    for (let i = 0; i < keptPpsf.length - 1; i++) {
      const gapAbove = keptPpsf[i + 1]!.p - keptPpsf[i]!.p
      const gapToExcluded = keptPpsf[i]!.p - nearestLow
      if (gapAbove >= minGap && gapAbove > gapToExcluded) {
        out.push({
          keys: keptPpsf.slice(0, i + 1).map((k) => k.key),
          message: `Comp ${keptPpsf[i]!.key} is KEPT at $${keptPpsf[i]!.p}/sqft, $${gapAbove}/sqft below the rest of the retained set but only $${gapToExcluded}/sqft above the priciest sale you excluded on price tier ($${nearestLow}/sqft). It sits with the excluded group, not the kept one.`,
        })
        break
      }
    }
  }
  return out
}

const LUXURY_REASON_RE =
  /luxury|too expensive|premium tier|higher price|price segment|gated.?expensive|amenity.?bearing/i

export function isLuxuryOrPriceExclusion(v: CompVerdict): boolean {
  if (v.tier !== 'exclude') return false
  if (isPriceTierExclusion(v)) return true
  return LUXURY_REASON_RE.test(v.reason)
}

/**
 * Custom/new year-quality peers must not be tossed as too luxury / too expensive.
 * Restores those exclusions to weak and names the keys so band repair cannot
 * drop them again.
 */
export function restoreCustomYearQualityPeers(args: {
  subject: YearQualityInput
  comps: ReadonlyArray<Pick<CmaComp, 'listingKey' | 'yearBuilt' | 'publicRemarks'>>
  verdicts: CompVerdict[]
  asOfYear?: number
}): { verdicts: CompVerdict[]; restoredKeys: string[] } {
  if (!isCustomOrNewSubject(args.subject, args.asOfYear)) {
    return { verdicts: args.verdicts, restoredKeys: [] }
  }
  const byKey = new Map(args.comps.map((c) => [c.listingKey, c]))
  const restoredKeys: string[] = []
  const verdicts = args.verdicts.map((v) => {
    if (!isLuxuryOrPriceExclusion(v)) return v
    const c = byKey.get(v.listingKey)
    if (!c) return v
    if (
      !yearQualityCompatible(
        args.subject,
        { yearBuilt: c.yearBuilt, remarks: c.publicRemarks },
        args.asOfYear,
      )
    ) {
      return v
    }
    restoredKeys.push(v.listingKey)
    return {
      ...v,
      tier: 'weak' as const,
      basis: undefined,
      reason:
        'Kept as a custom/new year-and-quality peer. Price tier alone does not drop a same-generation sale.',
    }
  })
  return { verdicts, restoredKeys }
}

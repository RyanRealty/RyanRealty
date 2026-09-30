/**
 * AGE-RESTRICTED HOUSING IS A DIFFERENT PRODUCT.
 *
 * A home in a 55-and-older community sells to a buyer pool the law narrows by
 * age, under CC&Rs an ordinary resale does not carry. It does not price a home
 * a family can buy, and the reverse holds too. The 2026-09-29 expired batch
 * priced two ordinary homes off one: cma-1733-hemlock-redmond-97756 took 2933
 * Hemlock ("55+ community in NW Redmond", Waverly) off its own street rung, and
 * cma-2681-moonlight took 2221 Indigo ("a meticulously maintained 55+
 * community", Holliday Park) off its pocket rung. The judge excluded both; the
 * grounding pass could not verify the reason and kept them at half weight.
 *
 * So this is a wall in code, next to the other hard product walls, and not a
 * judgment the model is trusted to hold. An age-restricted sale may price the
 * subject only when the subject is in an age-restricted community too, which
 * is true when EITHER its own remarks or subdivision name say so, OR most of
 * the sales in its own plat do. The second half matters: of the 311 expired
 * documents on file (2026-09-30) two subjects sat in The Pines at Sisters,
 * every comp they priced off was a Pines 55+ sale, and neither subject's
 * remarks said "55+". A plat that is a 55+ community is the subject's community
 * whether or not the listing agent wrote it down.
 *
 * "Most" is measured over the plat, not over the handful of candidates, and it
 * is why the rule holds at Eagle Crest: The Falls, its 55+ section, shares the
 * Eagle Crest MLS name, and three of the five candidates on cma-387-goshawk
 * were Falls sales pricing an ordinary Eagle Crest home. Over the plat's own
 * sales the Falls are a minority, so the subject is not 55+ and the Falls sales
 * are walled out.
 *
 *   · lib/pricing/match.ts applesOk (every rung and the bracket swap) grades
 *     against the share the facts ladder measures over its whole pool.
 *   · The listings ladder in lib/cma/comps.ts measures it over its own-plat
 *     rung's rows before it grades a sale, and lets an own-plat sale through
 *     while it cannot see the plat yet.
 *   · pricingCompsAfterJudgment in lib/cma/judgment-prune.ts is the backstop
 *     for anything that reached the candidate set another way.
 *
 * DETECTION. Remarks and the subdivision name, never a guess. Measured on
 * 2026-09-30 against closed MLS remarks carrying each phrase, the near misses
 * the patterns and guards below exist for:
 *
 *   · a decimal, thousands or plus-minus tail: "55 +/- acres", ".55 + acre lot",
 *     "19.55 +/-", "65,755 +/- SF", "2,455 +/- sq ft", "over 55 acres",
 *     "over 550 sq ft", "in over 55+ yrs", "Over 55/100 Of An Acre";
 *   · a negation: "Not a 55 + community", "No age restrictions", "without any
 *     age restrictions", "not a 55 and over community";
 *   · proximity: "near ... Twin Creeks Retirement Community";
 *   · marketing to an age group: "an excellent option for 55+ buyers", "perfect
 *     for the 55 & over crowd", "a must see for the 55 & over home seekers",
 *     "great location for the golfer, active adult, or equestrian lover";
 *   · "62+" is acreage or square feet in every sample, so it is not a signal;
 *   · "Acreage restricted to 1 home" contains "age restrict" without the word.
 *
 * Pure and synchronous. No I/O.
 */

export type AgeRestrictionEvidence = {
  publicRemarks?: string | null
  subdivision?: string | null
}

/** Units that mean the number is a measurement, not an age. */
const MEASURE_AFTER = String.raw`(?:acres?|ac\b|sq|sf\b|ft\b|square|feet|yrs?\b|years?\s+(?:old|young|ago))`

type AgePattern = {
  re: RegExp
  /**
   * How far back in the clause a proximity phrase suppresses the match. Named
   * institutions ("Twin Creeks Retirement Community") turn up in lists of what
   * is nearby, so their window is long. A "55+" phrase almost never does, and a
   * long window there would drop "close to shopping, this home in a 55+
   * community", so its window is a few words.
   */
  nearbyChars: number
}

const TIGHT = 20
const WIDE = 150

const PATTERNS: AgePattern[] = [
  // "55+", "55 +", "55-plus", "55 plus". Not the tail of a decimal or a
  // thousands figure, not a plus-minus, not followed by a unit.
  {
    re: new RegExp(
      String.raw`(?<![\d.,$])\b55\s*(?:\+|-?\s*plus\b)(?!\s*\/\s*[-_])(?!\s*-)(?!\s*${MEASURE_AFTER})`,
      'gi',
    ),
    nearbyChars: TIGHT,
  },
  // "55 and over", "55 & older", "55 or older", "55 and up", "55 or better".
  { re: /(?<![\d.,$])\b55\s*(?:and|&|or)\s*(?:over|older|up|above|better)\b/gi, nearbyChars: TIGHT },
  // "over 55" / "over the age of 55" as an age rule.
  {
    re: new RegExp(
      String.raw`\bover\s+(?:the\s+age\s+of\s+)?55\b(?!\s*[+/%,.]?\s*${MEASURE_AFTER})(?!\s*\/)(?!\s*,\s*or\b)`,
      'gi',
    ),
    nearbyChars: TIGHT,
  },
  { re: /\bage[- ]?(?:restricted|restriction|restrictions|qualified|requirement)\b/gi, nearbyChars: TIGHT },
  // "Active Adult Community" and its typos. Bare "active adult" is marketing.
  {
    re: /\bactive[- ]adults?\s+(?:com+\w*unit\w*|living\s+com+\w*unit\w*|neighborhood|development|subdivision|resort|village|park)\b/gi,
    nearbyChars: WIDE,
  },
  {
    re: /\bsenior\s+(?:com+\w*unit\w*|housing|park|mobile\s+home\s+park|citizens?\s+com+\w*unit\w*)\b/gi,
    nearbyChars: WIDE,
  },
  // "senior living" alone is as often a use ("great for senior living", "a
  // senior living facility is a conditional use") as a restriction. Only the
  // community forms count.
  {
    re: /\bsenior\s+living\s+(?:com+\w*unit\w*|park|environment|development|(?:\w+\s+){0,2}(?:mobile|manufactured)\s+home\s+park)\b/gi,
    nearbyChars: WIDE,
  },
  { re: /\bpark\s+type:?\s*seniors?\b/gi, nearbyChars: TIGHT },
  { re: /\bretirement\s+(?:com+\w*unit\w*|village|resort)\b/gi, nearbyChars: WIDE },
]

const CLAUSE_END = /[.;!?]/

/** Text of the clause before `at`, from the last sentence or clause break. */
function clauseBefore(text: string, at: number): string {
  let i = at - 1
  while (i >= 0 && !CLAUSE_END.test(text[i]!)) i--
  return text.slice(i + 1, at)
}

const NEGATED = /\b(?:no|not|non|isn'?t|aren'?t|without|never|nor)\b[^.;!?]{0,25}$/i
const NEARBY_WORD =
  String.raw`\b(?:near|nearby|close\s+to|minutes?\s+(?:from|to)|walk(?:ing)?\s+distance\s+(?:to|from)|next\s+to|across\s+(?:the\s+street\s+)?from|adjacent\s+to|blocks?\s+(?:from|to)|down\s+the\s+street\s+from)\b`
const MARKETED_AFTER = /^\W{0,3}(?:buyers?|crowd|home\s*seekers?|seekers?|folks|people|retirees|set)\b/i

/**
 * True when the text states an age restriction on the home's community. Any
 * one clause that states it, un-negated, not about somewhere nearby, and not a
 * pitch to an age group, is enough.
 */
export function isAgeRestrictedText(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  for (const pattern of PATTERNS) {
    const nearby = new RegExp(`${NEARBY_WORD}[^.;!?]{0,${pattern.nearbyChars}}$`, 'i')
    for (const m of t.matchAll(pattern.re)) {
      const at = m.index ?? 0
      const before = clauseBefore(t, at)
      if (NEGATED.test(before)) continue
      if (nearby.test(before)) continue
      if (MARKETED_AFTER.test(t.slice(at + m[0].length))) continue
      return true
    }
  }
  return false
}

/** True when the sale's own remarks or subdivision name say it is age-restricted. */
export function isAgeRestricted(x: AgeRestrictionEvidence | null | undefined): boolean {
  if (!x) return false
  return isAgeRestrictedText(x.publicRemarks) || isAgeRestrictedText(x.subdivision)
}

/**
 * A plat counts as an age-restricted community when MOST of its candidate sales
 * say so. One 55+ section inside a larger plat name (The Falls inside Eagle
 * Crest) does not make every Eagle Crest home age-restricted.
 */
export const AGE_RESTRICTED_PLAT_SHARE = 0.5

export function ownPlatAgeRestrictedShare(ownPlatSales: readonly AgeRestrictionEvidence[]): number | null {
  if (ownPlatSales.length === 0) return null
  const restricted = ownPlatSales.filter((s) => isAgeRestricted(s)).length
  return restricted / ownPlatSales.length
}

/** True when the subject is in an age-restricted community by its own words or by its plat. */
export function subjectAgeRestricted(
  subject: AgeRestrictionEvidence,
  ownPlatShare: number | null | undefined,
): boolean {
  if (isAgeRestricted(subject)) return true
  return ownPlatShare != null && ownPlatShare > AGE_RESTRICTED_PLAT_SHARE
}

/**
 * THE WALL. True when `sale` is age-restricted housing and the subject is not
 * in an age-restricted community, so the sale may not price the subject.
 *
 * `ownPlatShare` is the share of the subject's own-plat sales that are
 * age-restricted. Undefined means the caller cannot see the plat yet (the
 * listings ladder before its own-plat rung ran): a sale in the subject's own
 * plat is then let through, and the backstop decides once the plat is known.
 */
export function ageRestrictedMismatch(args: {
  subject: AgeRestrictionEvidence
  sale: AgeRestrictionEvidence
  /** The selector's own-plat decision for this sale. */
  saleInOwnPlat?: boolean | null
  ownPlatShare?: number | null
}): boolean {
  if (!isAgeRestricted(args.sale)) return false
  if (subjectAgeRestricted(args.subject, args.ownPlatShare)) return false
  if (args.saleInOwnPlat && args.ownPlatShare === undefined) return false
  return true
}

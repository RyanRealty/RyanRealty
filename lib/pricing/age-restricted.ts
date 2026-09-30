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
 * is true when EITHER its own evidence says so, OR most of the sales in its own
 * plat do. The second half matters: of the 311 expired documents on file
 * (2026-09-30) two subjects sat in The Pines at Sisters, every comp they priced
 * off was a Pines 55+ sale, and neither subject's remarks said "55+". A plat
 * that is a 55+ community is the subject's community whether or not the
 * listing agent wrote it down.
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
 * THE EVIDENCE, three kinds, any one enough:
 *
 *   1. The MLS SeniorCommunityYN field (listings.senior_community_yn) when it
 *      is TRUE. False or null is not evidence against: agents leave the field
 *      at its default, so a 55+ sale often carries false.
 *   2. The subdivision name, when it names an age restriction ("... 55+").
 *   3. The remarks, when they state a restriction. A "55" is an age only in an
 *      age form ("55+", "55 and older", "over-55", "55 years of age or older"),
 *      and even then it counts only with restriction evidence attached to it:
 *      a community word after it ("a 55+ gated community", "55-and-older
 *      neighborhood", "a 55+ enclave"), a rule before it ("at least one
 *      resident must be", "the HOA requires", "age-restricted", "restricted
 *      to"), a community before it ("a community for those 55 and older", "the
 *      HOA is 55+"), or the 55+ section named in place ("in The Falls 55+").
 *      HOPA, and the fixed restriction phrases ("age-restricted community",
 *      "active adult community", "senior community", "retirement community"),
 *      count on their own.
 *
 * WHAT DOES NOT COUNT, each a false positive the 2026-09-30 review reproduced
 * on the first version (which read any un-negated "55+" as a restriction):
 *
 *   · marketing to an age group: "ideal for 55+ living", "Great for anyone
 *     55+", "perfect for 55+ or first-time buyers", "Ideal for those 55 and
 *     older looking to downsize", "55+ buyers", "the 55 & over crowd";
 *   · a number that is not an age: "over 55 years", "over 55 miles of trails",
 *     "over 55 homes", "over 55,000 sq ft", "55 +/- acres", "2,455 +/- sq ft",
 *     "Homesite #55", "2.55%", "1955";
 *   · a negation: "Not a 55 + community", "No age restrictions", "without any
 *     age restrictions";
 *   · somewhere nearby: "near ... Twin Creeks Retirement Community", "across
 *     from the 55+ Mountain Meadows Retirement community", "the Senior
 *     Community Center".
 *
 * Measured on 2026-09-30 against every closed single-family sale in the ten
 * Central Oregon cities over 24 months whose remarks carry a 55 (136 rows, 53
 * restricted by hand, all hand-classified) and the wider samples in
 * age-restricted.test.ts.
 *
 * Pure and synchronous. No I/O.
 */

export type AgeRestrictionEvidence = {
  publicRemarks?: string | null
  subdivision?: string | null
  /**
   * The MLS SeniorCommunityYN field. True is evidence the sale is in an
   * age-restricted community. False and null are not evidence either way.
   */
  seniorCommunityYn?: boolean | null
  /**
   * The sale's ListingKey, when the caller has it. It keys the memo, so a sale
   * every rung of a ladder grades is read once (isAgeRestricted).
   */
  listingKey?: string | null
}


// ─── the age forms of 55 ───────────────────────────────────────────────────

/**
 * "55+", "55 +", "55-plus", "55 plus", "55 + older", "55 and over",
 * "55-and-older", "55 & older", "55 or older", "55 or better", "55 years of age
 * or older", "55 year and older", "over 55", "over-55", "over the age of 55",
 * "age 55", "aged 55". Never the tail of a larger number, a decimal, a price,
 * a lot number or a range ("1-55").
 */
const MARKER = new RegExp(
  [
    String.raw`(?<![\w.,$#/])(?<!\d-)55\s*(?:\+|-?\s*plus\b)(?:\s*(?:and\s+)?(?:older|over|up)\b)?`,
    String.raw`(?<![\w.,$#/])(?<!\d-)55\s*-?\s*(?:and|&|or)\s*-?\s*(?:over|older|up|above|better)\b`,
    String.raw`(?<![\w.,$#/])(?<!\d-)55\s+(?:years?|yrs?)\s+(?:of\s+age\s+)?(?:or|and|&)\s+(?:older|over|up)\b`,
    String.raw`(?<![\w.,$#/])(?<!\d-)55\s+years?\s+of\s+age\b`,
    String.raw`\bover[\s-]+(?:the\s+age\s+of\s+)?55(?![\d])(?:\s*\+)?`,
    String.raw`\bage[sd]?\s+(?:of\s+)?55(?![\d])(?:\s*\+|\s*(?:and|&|or)\s*(?:over|older|up)\b)?`,
  ].join('|'),
  'gi',
)

/** A unit after the marker that makes it a measurement or a count, not an age. */
const UNIT = String.raw`(?:acres?|ac\b|sq|sf\b|ft\b|square|feet|foot|%|percent|miles?\b|mi\b|homes\b|houses\b|homesites?\b|lots?\b|units?\b|sites?\b|spaces?\b|trees?\b|minutes?\b|mins?\b|degrees?\b|gpm\b|varieties\b)`
/** "over 55 years" is a duration unless the years are "of age" or "old". */
const DURATION = String.raw`(?:yrs?\b|years?\b(?!\s+(?:of\s+age|old)\b))`
const NOT_AN_AGE_AFTER = new RegExp(
  String.raw`^(?:\s*[.,]\d|\s*\/\s*[-_\d]|\s*(?:[+\/-]\s*)*(?:${UNIT}|${DURATION}))`,
  'i',
)
const MEASURE_AFTER = new RegExp(String.raw`^(?:\s*[.,]\d|\s*\/\s*[-_\d]|\s*(?:[+\/-]\s*)*${UNIT})`, 'i')

// ─── the place a restriction governs ──────────────────────────────────────

/**
 * The words that make an age a rule on a place. Typo-tolerant for "community"
 * ("cummunity", "coummunity", "Comminity", "Communit", "Comm'ty", "Comm",
 * "Commun."), which the MLS carries often enough to matter.
 */
const PLACE = String.raw`(?:c(?:o|ou|u)m+u?n?i?\w*t(?:y|ies)|communit|comm['’]?ty|commun|comm|neighbou?rhoods?|developments?|parks?|pks?|subdivisions?|additions?|resorts?|villages?|villas?|enclaves?|estates|hoa|associations?|complex|condominiums?|co-?ops?|sections?|areas?|projects?|facilit(?:y|ies)|mh[pc]s?)`
const PLACE_RE = new RegExp(String.raw`^${PLACE}$`, 'i')

/** Words that end the chain from a marker to a place: a pitch, a preposition that moves it elsewhere, a verb. */
const CHAIN_STOP = String.raw`(?:or|for|to|at|of|who|that|which|looking|loves?|will|would|can|with|w\/|near|nearby|close|across|minutes?|walking|next|adjacent|buyers?|crowd|folks|people|retirees|seekers?|you|your|we|our)`

/**
 * "a 55+ gated community", ", private and gated community", "55-and-older
 * neighborhood", "55+ only", "55+ Snowberry Village", "55+ mature living
 * community", "55 plus Cascade Village 5 Star Community", "55+, very quiet,
 * community", "(55+) communities", "55+ Adult Living In Gated Community". Up to
 * six words, none of them a pitch or a preposition that moves the place, then
 * the place.
 */
const PLACE_AFTER = new RegExp(
  String.raw`^\s*[)\]]?\s*[-–—:(,]?\s*(?:(?!${CHAIN_STOP}\b)\(?[\w'’&.]+\)?(?:['’]{2})?(?:\s*,\s*|\s+and\s+|\s*-\s*|\s+)){0,6}?(?:${PLACE}\b|age[- ]?restrict\w*|age[- ]?requirements?\b|only\b(?!\s*\d))`,
  'i',
)

/** "55+ yrs. park", "55+years park", "55 Year and older trailer park": an age-years park, not a duration. */
const YEARS_PLACE_AFTER = new RegExp(
  String.raw`^\s*(?:yrs?|years?)\.?\s*(?:old\s+|and\s+(?:older|over)\s+)?(?:\w+\s+){0,2}${PLACE}\b`,
  'i',
)

/** A place right before the marker: "Suntree Village 55+", "mobile home park, 55 and over", "MH park (55 or older)", "MHP 55+ years". */
const PLACE_RIGHT_BEFORE = new RegExp(String.raw`\b${PLACE}\s*[-–(,]?\s*$`, 'i')

/** A rule before the marker: "at least one resident must be", "the HOA requires one owner to be", "restricted to". */
const RULE_BEFORE =
  /\b(?:age[- ]?restrict\w*|restricted\s+(?:to|for)|limited\s+to|must\s+be|required\s+to\s+be|requires?|requirements?|at\s+least\s+one\s+(?:\w+\s+){0,2}(?:occupants?|residents?|owners?|persons?|buyers?|members?)|(?:residents?|occupants?|owners?|buyers?)\s+(?:must|are\s+required|shall)|deed[- ]restricted|hopa)\b[^.;!?]{0,40}$/i

/**
 * A place before the marker that the age governs: "a community for those 55
 * and older", "a community designed specifically for active adults over the
 * age of 55", "The community for active 55+". Not "a community that serves
 * 55+ active adults" or "catering to the 55+ community": serving or catering
 * to an age group says who the place is for in the market, not who may buy.
 */
const PLACE_FOR_BEFORE = new RegExp(
  String.raw`\b${PLACE}\s+(?:(?:is|are|was)\s+)?(?:(?:an?|the)\s+)?(?:(?:designed|built|reserved|intended|restricted|exclusively|specifically|only)\s+){0,3}(?:for|of)\s+(?:(?:those|residents?|people|persons|homeowners|owners|seniors|individuals|households?|active|adults)\s+){0,2}(?:(?:aged?|ages)\s+)?$`,
  'i',
)

/** A place whose people carry the age: "Secure Neighborhood W/ Friendly, Active People Age 55+". */
const PLACE_WITH_PEOPLE_BEFORE = new RegExp(
  String.raw`\b${PLACE}\s+(?:w\/|with)\s+(?:[\w'’]+,?\s+){0,3}(?:people|residents|neighbors|homeowners|adults)\s+$`,
  'i',
)

/** A place that IS the marker: "the HOA is 55+", "Park is now 55 and older", "park which is 55+". */
const PLACE_IS_BEFORE = new RegExp(
  String.raw`\b${PLACE}\s+(?:(?:which|that)\s+)?(?:is|are)\s+(?:(?:now|currently|strictly)\s+)?(?:(?:an?|the)\s+)?(?:(?:age[- ]?restricted|gated|private)\s+)*$`,
  'i',
)

/** The 55+ section named in place: "in The Falls 55+", "in the Falls 55+ at Eagle Crest", "The Falls (55+)", "The Falls, 55+ at Eagle Crest". */
const NAMED_SECTION_BEFORE = /\b(?:in|at|within|inside|of)\s+([Tt]he(?:\s+[A-Z][\w'’&.-]*){1,3})\s*[,(-]?\s*$/

/** "Hard to find 55+ in Suntree Village", "55+ in Beautiful Snowberry Village": the 55+ place named right after. */
const NAMED_PLACE_AFTER = /^\s+(?:in|at)\s+(?:the\s+)?((?:[A-Z][\w'’]*\s+){1,4})(\w+)/

/**
 * "home in 55+.", "Great community in 55+.", "in 55+ Ni La Sha", "corner of 55+
 * Suntree", "Phase 1 of gated 55+ Dry Canyon": the home is IN the 55+ place.
 */
const IN_BEFORE =
  /\b(?:in|at|within|of)\s+(?:(?:the|a|an|beautiful|desirable|popular|premier|lovely|quiet|gated|sought[- ]after|highly|desired)\s+){0,3}$/i

/** Words that make a capitalized run a pitch in Title Case, not a place name. */
const NOT_A_NAME = new Set([
  'for', 'anyone', 'those', 'buyers', 'buyer', 'ideal', 'perfect', 'great', 'living', 'home', 'homes', 'condition',
  'retirees', 'seniors', 'folks', 'people', 'and', 'or', 'with', 'good', 'excellent', 'wonderful', 'lifestyle', 'in',
  'at', 'to', 'on', 'the', 'a', 'an', 'is', 'are', 'welcome', 'only',
])

/**
 * Marketing to an age group, right before the marker: "ideal for", "perfect
 * for", "great for anyone", "those", "if you are", "catering to the", "serves".
 * A pitch says who might like the home; it never says who may buy it.
 */
const PITCH_BEFORE =
  /(?:\b(?:ideal|perfect|great|wonderful|excellent|terrific|fantastic|suited|suitable|designed|made|appeal\w*|attractive|good|nice|built|option)\s+(?:[\w'’-]+\s+){0,2}for\s+(?:(?:the|a|an|any|those|anyone|folks|buyers?|people|someone|retirees|couples?|active|adults?|seniors?|empty|nesters?)\s+){0,3}|\b(?:anyone|those|folks|buyers?|retirees|people|someone|couples?)\s+(?:who\s+(?:are|is)\s+)?(?:(?:aged?|ages)\s+)?|\bif\s+you(?:['’]re|\s+are)\s+|\b(?:cater(?:s|ed|ing)?|serv(?:es|ed|ing|e))\s+to\s+(?:the\s+)?|\bserv(?:es|ed|ing|e)\s+(?:the\s+)?)$/i

/** Marketing after the marker: "55+ buyers", "the 55 & over crowd", "55+ living at its finest", "55+ or first-time buyers". */
const PITCH_AFTER =
  /^\s*[)\],]?\s*(?:buyers?|crowd|home\s*seekers?|seekers?|folks|people|retirees|set|living|lifestyle|friendly|or\b|looking|downsizers?|welcome)\b/i
/** "55+ living community", "55+ lifestyle community": a pitch word that is part of the place name. */
const PITCH_WORD_THEN_PLACE = new RegExp(String.raw`^\s*[)\]]?\s*(?:living|lifestyle)\s+${PLACE}\b`, 'i')

// ─── the fixed restriction phrases (no 55 needed) ─────────────────────────

type Phrase = {
  re: RegExp
  /** How far back a proximity phrase suppresses the match (chars): TIGHT or WIDE. */
  nearbyChars: 20 | 150
}

const TIGHT = 20 as const
const WIDE = 150 as const

const PHRASES: Phrase[] = [
  { re: /\bHOPA\b|\bhousing\s+for\s+older\s+persons\b/gi, nearbyChars: TIGHT },
  { re: /\bage[- ]?(?:restricted|restriction|restrictions|qualified|requirements?)\b/gi, nearbyChars: TIGHT },
  // "Active Adult Community" and its typos and fillers ("Active adult lifestyle
  // community", "active adult (55+) communities", "Active Adult 55 Community").
  // Bare "active adult" is marketing.
  {
    re: new RegExp(
      String.raw`\bactive[- ]adults?['’]*\s+(?:\(?(?:lifestyle|living|resort|golf|retirement|55\+?)\)?\W+){0,2}(?:c(?:o|ou|u)m+u?n?i?\w*t(?:y|ies)\b|communit\b|comm['’]?ty\b|commun\b|neighborhood|development|subdivision|resort|village|park)\b`,
      'gi',
    ),
    nearbyChars: WIDE,
  },
  // Not the "Senior Community Center", which is a building.
  {
    re: /\bsenior\s+(?:com+\w*unit\w*|housing|park|mobile\s+home\s+park|citizens?\s+com+\w*unit\w*)\b(?!\s+cent(?:er|re))/gi,
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

// ─── clauses ───────────────────────────────────────────────────────────────

/** Abbreviations whose period does not end a clause: "Mt. View MH Park", "55+ yrs. park". */
const ABBREVIATION = /\b(?:mt|st|dr|ave|rd|ln|ct|co|no|ste|apt|jr|sr|inc|apx|approx|sq|ft|yrs?|mo|w)$/i

function isClauseEnd(text: string, i: number): boolean {
  const c = text[i]!
  if (c === ';' || c === '!' || c === '?') return true
  if (c !== '.') return false
  if (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) return false
  return !ABBREVIATION.test(text.slice(Math.max(0, i - 6), i))
}

/** Text of the clause before `at`, from the last sentence or clause break. */
function clauseBefore(text: string, at: number): string {
  let i = at - 1
  while (i >= 0 && !isClauseEnd(text, i)) i--
  return text.slice(i + 1, at)
}

/** Text of the clause after `at`, to the next sentence or clause break. */
function clauseAfter(text: string, at: number): { text: string; endsWith: string } {
  let i = at
  while (i < text.length && !isClauseEnd(text, i)) i++
  return { text: text.slice(at, i), endsWith: text[i] ?? '' }
}

/**
 * A negation governing the phrase: "not a", "no", "non-", "isn't an",
 * "without any", "no longer a", within two words. Tight on purpose: "Not in a
 * flood zone, 55+ community" is not a negated 55+ community.
 */
const NEGATED = /\b(?:no|not|non|isn'?t|aren'?t|without|never|nor)\b(?:[\s-]+[\w&]+){0,2}[\s-]*$/i
const NEARBY_WORD =
  String.raw`\b(?:near|nearby|close\s+to|minutes?\s+(?:from|to)|walk(?:ing)?\s+distance\s+(?:to|from)|next\s+to|across\s+(?:the\s+street\s+)?from|adjacent\s+to|blocks?\s+(?:from|to)|down\s+the\s+street\s+from)\b`
/** "a 55+ community nearby", "the 55+ park next door", "a 55+ community going in down the road": right after the place word. */
const NEARBY_AFTER = /^\s*(?:nearby|next\s+door|close\s+by|down\s+the\s+(?:street|road)|across\s+the\s+street|going\s+in)\b/i

// Compiled once, at the two reaches the rules use: a phrase or marker right
// after "near" (TIGHT) and a place phrase a clause after it (WIDE).
const NEARBY_TIGHT = new RegExp(`${NEARBY_WORD}[^.;!?]{0,${TIGHT}}$`, 'i')
const NEARBY_WIDE = new RegExp(`${NEARBY_WORD}[^.;!?]{0,${WIDE}}$`, 'i')

function nearbyBefore(before: string, reach: typeof TIGHT | typeof WIDE): boolean {
  return (reach === TIGHT ? NEARBY_TIGHT : NEARBY_WIDE).test(before)
}

function nameRunIsPlace(run: string): boolean {
  const words = run.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 && !words.some((w) => NOT_A_NAME.has(w.toLowerCase()))
}

const WORD_CHAR = /[A-Za-z0-9_]/
/** `after` opens, past some space, on `head` as a whole word, any case: /^\s+head\b/i without compiling it per marker. */
function headFollows(after: string, head: string): boolean {
  if (!/^\s/.test(after)) return false
  const rest = after.trimStart()
  if (rest.slice(0, head.length).toLowerCase() !== head.toLowerCase()) return false
  return WORD_CHAR.test(head.charAt(head.length - 1)) !== WORD_CHAR.test(rest.charAt(head.length))
}
/** A clause that opens on "55+" but leads somewhere else: "55+ and ...", "55+ close to town". */
const OPENS_ELSEWHERE = new RegExp(String.raw`^\s*(?:and|in|${CHAIN_STOP})\b`, 'i')

/** First distinctive word of a subdivision name, for "55+ Suntree," on a Suntree Village sale. */
function subdivisionHead(subdivision: string | null | undefined): string | null {
  const w = (subdivision ?? '').trim().split(/\s+/)[0] ?? ''
  return /^[A-Za-z][A-Za-z'’-]{3,}$/.test(w) && !NOT_A_NAME.has(w.toLowerCase()) ? w : null
}

/** True when this one marker carries restriction evidence. */
function markerIsRestriction(text: string, start: number, end: number, subdivision: string | null | undefined): boolean {
  const before = clauseBefore(text, start)
  const { text: after, endsWith } = clauseAfter(text, end)
  if (NEGATED.test(before)) return false
  if (nearbyBefore(before, TIGHT)) return false
  const pitchAfter = PITCH_AFTER.test(after) && !PITCH_WORD_THEN_PLACE.test(after)
  // A place labeled with the age: "Suntree Village 55+ w/ 3 car garage",
  // "mobile home park, 55 and over", "MHP 55+ years".
  if (PLACE_RIGHT_BEFORE.test(before) && !MEASURE_AFTER.test(after) && !pitchAfter) return true
  if (YEARS_PLACE_AFTER.test(text.slice(end))) return true
  if (NOT_AN_AGE_AFTER.test(after)) return false
  // A rule or a place that governs the age comes first: "a community designed
  // for active adults over the age of 55" is a restriction even though
  // "designed for" also opens a pitch.
  if (
    RULE_BEFORE.test(before) ||
    PLACE_FOR_BEFORE.test(before) ||
    PLACE_IS_BEFORE.test(before) ||
    PLACE_WITH_PEOPLE_BEFORE.test(before)
  ) {
    return true
  }
  if (PITCH_BEFORE.test(before)) return false
  if (pitchAfter) return false
  const placeAfter = PLACE_AFTER.exec(after)
  if (placeAfter) return !NEARBY_AFTER.test(after.slice(placeAfter[0].length))
  // "Over 55? This home is for you!" is a question put to a buyer.
  if (endsWith === '?') return false
  const named = NAMED_PLACE_AFTER.exec(after)
  if (named && nameRunIsPlace(named[1]!) && PLACE_RE.test(named[2]!)) return true
  const section = NAMED_SECTION_BEFORE.exec(before)
  if (section && nameRunIsPlace(section[1]!.replace(/^[Tt]he\s+/, ''))) return true
  if (IN_BEFORE.test(before)) {
    if (!after.trim()) return true
    const run = /^\s+([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,3})/.exec(after)
    if (run && nameRunIsPlace(run[1]!)) return true
  }
  const head = subdivisionHead(subdivision)
  if (head && headFollows(after, head)) return true
  // A clause that opens on "55+" or "55 and older" states it: "55 and older.",
  // "55+ well kept, move in ready", "55+ Some pets allowed". Not "Over 55 and
  // looking to downsize", which opens a pitch, and not a clause whose next word
  // leads somewhere else ("55+ and ...", "55+ close to town").
  const opens = !/[A-Za-z0-9]/.test(before) && /^55/.test(text.slice(start, end))
  if (opens && !after.trim()) return true
  if (opens && /^\s*[A-Za-z]/.test(after) && !OPENS_ELSEWHERE.test(after)) return true
  return false
}

/**
 * True when the text states an age restriction on the home's community: a
 * fixed restriction phrase, or an age form of 55 with restriction evidence
 * attached. Un-negated, and not about somewhere nearby. `subdivision` lets
 * "the NW corner of 55+ Suntree" read on a Suntree Village sale.
 */
export function isAgeRestrictedText(
  text: string | null | undefined,
  opts: { subdivision?: string | null } = {},
): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  for (const m of t.matchAll(MARKER)) {
    const start = m.index ?? 0
    if (markerIsRestriction(t, start, start + m[0].length, opts.subdivision)) return true
  }
  for (const phrase of PHRASES) {
    for (const m of t.matchAll(phrase.re)) {
      const at = m.index ?? 0
      const before = clauseBefore(t, at)
      if (NEGATED.test(before)) continue
      if (nearbyBefore(before, phrase.nearbyChars)) continue
      return true
    }
  }
  return false
}

/**
 * True when a subdivision NAME names an age restriction ("The Falls 55+",
 * "Pine Meadow Senior Village"). A plat is named for what it is, so the age
 * form alone is enough here; it still has to be an age and not a number.
 */
export function isAgeRestrictedName(name: string | null | undefined): boolean {
  const t = (name ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  for (const m of t.matchAll(MARKER)) {
    const end = (m.index ?? 0) + m[0].length
    if (!NOT_AN_AGE_AFTER.test(t.slice(end))) return true
  }
  return /\b(?:senior|retirement|active\s+adult|age[- ]?restricted)\b/i.test(t)
}

/**
 * ONE READ PER SALE, WHATEVER THE NUMBER OF RUNGS THAT GRADE IT (second review
 * of da8dce6, 2026-09-30). The facts ladder grades every pool sale on every
 * rung and the listings ladder on every row, each time against the same
 * subject, so the remarks were re-read pool x rungs times. The verdict is a
 * pure function of the three fields, so it is kept per ListingKey (or, with no
 * key, per evidence object) with the fields it was read from, and a record
 * whose fields changed is read again.
 */
type AgeMemo = {
  remarks: string | null | undefined
  subdivision: string | null | undefined
  flag: boolean | null | undefined
  value: boolean
}
const MEMO_BY_KEY = new Map<string, AgeMemo>()
const MEMO_BY_OBJECT = new WeakMap<object, AgeMemo>()
/** Bound on the keyed memo: a full ladder pool is a few thousand sales. */
const MEMO_MAX = 20_000
/** How many times the remarks and name were actually read. For the memo's tests. */
export const ageRestrictionReads = { count: 0 }

function readAgeRestricted(x: AgeRestrictionEvidence): boolean {
  ageRestrictionReads.count++
  return isAgeRestrictedName(x.subdivision) || isAgeRestrictedText(x.publicRemarks, { subdivision: x.subdivision })
}

/** True when the sale's MLS flag, subdivision name or remarks say it is age-restricted. */
export function isAgeRestricted(x: AgeRestrictionEvidence | null | undefined): boolean {
  if (!x) return false
  if (x.seniorCommunityYn === true) return true
  const key = x.listingKey || null
  const hit = key ? MEMO_BY_KEY.get(key) : MEMO_BY_OBJECT.get(x)
  if (hit && hit.remarks === x.publicRemarks && hit.subdivision === x.subdivision && hit.flag === x.seniorCommunityYn) {
    return hit.value
  }
  const value = readAgeRestricted(x)
  const memo: AgeMemo = { remarks: x.publicRemarks, subdivision: x.subdivision, flag: x.seniorCommunityYn, value }
  if (key) {
    if (MEMO_BY_KEY.size >= MEMO_MAX) MEMO_BY_KEY.clear()
    MEMO_BY_KEY.set(key, memo)
  } else {
    MEMO_BY_OBJECT.set(x, memo)
  }
  return value
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

/** True when the subject is in an age-restricted community by its own evidence or by its plat. */
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

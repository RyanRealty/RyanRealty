/**
 * Deterministic narrative-integrity check for the CMA adversarial audit.
 *
 * Extracted from lib/cma/audit.ts so both stay under the file-size budget.
 * auditCma() calls checkNarrativeIntegrity() on the LLM's output and appends
 * whatever it returns to the findings, so a fabricated citation lands as
 * critical + data-integrity regardless of how the model labelled it.
 */

import { sanitizeClientProse } from '@/lib/cma/voice-sanitize'
import type { AuditFinding } from '@/lib/cma/audit'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

// ─── Deterministic narrative-integrity check ────────────────────────────────
//
// WHY THIS IS CODE AND NOT A PROMPT LINE. The publish gate is keyed to
// severity: `critical` blocks, `major` does not. So the LLM's severity label is
// load-bearing, and its calibration reserves `critical` for "the recommendation
// is wrong" — which let a narrative that cites comps THAT DO NOT EXIST ship as
// `major`. Four live documents did exactly that (cma-52174-foxtail claimed "six
// strong comps remain" over a 3-comp set and bracketed to $1.2M with no such
// sale; cma-17894-red-cedar cited a "Poplar"; cma-57522-tamarack cited "Lupine"
// and "Sandhill"; cma-3415-marys-grace cited "Brooklyn"). That is fabricated
// evidence under §0 whether or not the price moves, and the narrative reaches
// the consumer: it renders into pricing.notes, and resolveCmaDocumentByToken
// serves the full html_content to a registrant.
//
// The comp set is DATA, so the claim is mechanically checkable. Three checks,
// each emitting critical + data-integrity (which computeAuditVerdict already
// maps to `fail`):
//
//   1. a street/place cited AS A COMP that matches no priced comp, no comp
//      subdivision, no comp city, and not the subject or the market geography;
//   2. a whole-set count claim that OVER-states the priced set ("All five
//      comps..." over four);
//   3. a stated sold-price bracket whose endpoint falls outside the priced
//      comps' actual close-price range.
//
// PRECISION IS THE POINT — a false positive blocks a good document. Three
// guards do the work, measured 2026-07-30 against every live CMA narrative
// (187 documents): 26 flagged, 0 false positives on hand review of all 26, of
// which only 7 were not already blocked by an existing critical finding.
//
//   · CITATION FRAMES. Only a name in a syntactic frame that CITES a comp is
//     tested ("Hawkview at $303/sqft", "Shag Bark ($430/sqft)", "the Ward
//     property", "comps on Star Ridge, De Haviland, and Lupine", a list after
//     "comps remain:"). Prose that merely sits near a dollar figure is not a
//     citation, so builders ("Pahlisch Homes"), styles ("Craftsman"),
//     certifications ("Earth Advantage") and plan names do not match.
//   · EXCLUSION CONTEXT. Naming a candidate the report deliberately did NOT
//     use is honest analysis, not fabrication — and the excluded list reaching
//     this function carries listing keys only, never addresses, so an excluded
//     comp's street can never resolve. Any name governed by an exclusion clause
//     is skipped, including one sentence past a bulk exclusion ("All six
//     candidate comps were excluded because...").
//   · A GENEROUS UNIVERSE. Street words, subdivisions, cities, the subject, the
//     market label and the judge's exclusion reasons all count as known, matched
//     on contiguous WORD RUNS so a shortened or re-spaced form ("Wildriver" for
//     "Wild River Loop") resolves. Runs, not raw substrings: plain `includes`
//     let "Ward" resolve against "Woodward Highlands" and swallowed a real
//     fabrication on cma-18025-cascade-estates.
//
// Known limits, stated honestly: recall is partial. A name introduced with a
// long descriptor before its noun ("the Sandy riverfront custom log home
// ($950k)") is not in a frame and is missed; so is a phantom comp the
// narrative never prices. Under-counting ("four comps remain" over five) is NOT
// flagged — it asserts no absent evidence, so it stays the LLM's `major`.

const NAME_STOP = new Set(
  (
    'the a an and or but for nor so yet of in on at to from with without by as is are was were be been being ' +
    'this that these those there here it its his her their our your my one two three four five six seven eight ' +
    'nine ten eleven twelve all both each every few many most other some such no not only own same than too very ' +
    'after before while when where which who whom whose what how why if then else also however though although ' +
    'because since until unless whereas within across between among about above below under over into onto plus minus ' +
    'you yours we us they them he she i subject property home homes house houses sale sales sold selling closed close ' +
    'comp comps comparable comparables candidate candidates listing listings market markets set sets range ranges ' +
    'price prices pricing value values median average tier tiers vintage condition quality size lot lots acre acres ' +
    'sqft square feet foot bed beds bedroom bedrooms bath baths bathroom bathrooms garage shop shops build builds ' +
    'built construction custom luxury premium standard updated remodeled renovated new newer older recent recently ' +
    'strong weak core retained kept excluded excluding exclusion additional bracketing bracket brackets zero none ' +
    'north south east west northeast northwest southeast southwest downtown midtown westside eastside uptown ' +
    'january february march april may june july august september october november december ' +
    'monday tuesday wednesday thursday friday saturday sunday ' +
    'hoa mls cma dom adu str sfr efu owrd fema oref ors oar llc inc usda fha va ' +
    // Central Oregon geography: a real place, never a comp identifier.
    'oregon deschutes crook jefferson central cascade cascades lakes mountain mountains butte buttes ' +
    'bend redmond sisters lapine prineville madras culver terrebonne tumalo sunriver alfalfa powell ' +
    'national forest river creek canyon ridge highway hwy ' +
    // builder / product / certification vocabulary that reads like a proper noun
    'pahlisch hayden builder builders collection certification plan floorplan model models phase ' +
    'craftsman contemporary modern traditional ranch farmhouse cabin lodge townhome condo ' +
    'street st avenue ave road rd drive dr lane ln court ct place pl way loop terrace circle trail boulevard blvd ' +
    'confidence analysis data evidence report narrative broker seller buyer earth advantage energy star'
  ).split(/\s+/),
)

const STREET_SUFFIX = new Set(['street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln', 'court', 'ct', 'place', 'pl', 'way', 'loop', 'terrace', 'circle', 'trail', 'boulevard', 'blvd'])

const CARDINAL: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const NUM = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,2}'

// ONLY an explicit statement that a sale was not used suppresses. "X sits in a
// higher quality tier" is a comparability remark, not an exclusion: the report
// never says X is absent, so a reader takes X as evidence on the page. That
// distinction is what keeps cma-57522-tamarack's Lupine and Sandhill citations
// flagged while cma-17894-red-cedar's "Cherrywood was excluded" stays clean.
const EXCL_SRC =
  '\\b(?:exclud\\w*|omitt?\\w*|dropped|removed|disregard\\w*|screened out|' +
  'not (?:used|retained|counted)|(?:different|separate)\\s+(?:\\w+\\s+)?(?:segments?|products?))\\b'
const RET_SRC =
  '\\b(?:remain\\w*|retain\\w*|kept|anchor\\w*|form the|forms? a|core (?:tier|comps?)|' +
  'strong comps?|strong comparables?|the (?:remaining|retained))\\b'
const BULK_EXCL = new RegExp(
  `\\b(?:all\\s+)?(?:${NUM})\\s+(?:candidate\\s+)?(?:comps?|comparables?|sales)\\b[^.]{0,80}?${EXCL_SRC}`,
  'i',
)
const SPAN = "[A-Z][a-zA-Z'’]*(?:\\s+[A-Z][a-zA-Z'’]*)*"

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** "The Elm Avenue" -> "Elm"; "62719 Hawkview" -> "Hawkview". */
function coreName(raw: string): string {
  const words = raw
    .replace(/^\s*(?:the|a|an)\s+/i, '')
    .replace(/^\s*\d+[A-Za-z]?\s+/, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  while (words.length > 1 && STREET_SUFFIX.has(words[words.length - 1].toLowerCase())) words.pop()
  return words.join(' ')
}

function markerOffsets(src: string, s: string): number[] {
  const re = new RegExp(src, 'gi')
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push(m.index)
  return out
}

/** Sentence split that survives "$1.025M" and "Mt. Baker". */
function splitSentences(t: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '.' && t[i] !== '!' && t[i] !== '?') continue
    const prev = t[i - 1] ?? ''
    const next = t[i + 1] ?? ' '
    if (/\d/.test(prev) && /\d/.test(next)) continue
    if (!/\s|$/.test(next)) continue
    if (/\b(?:Mt|St|Dr|Ave|Rd|Ln|Ct|Jr|Sr|No)$/i.test(t.slice(Math.max(0, i - 4), i).trim())) continue
    if (t.slice(start, i + 1).trim()) out.push(t.slice(start, i + 1))
    start = i + 1
  }
  if (t.slice(start).trim()) out.push(t.slice(start))
  return out
}

/** Every span this sentence cites AS A COMP, with its offset. */
function citedSpans(sentence: string): Array<{ span: string; at: number }> {
  const hits = new Map<number, string>()
  const push = (at: number, span: string) => { if (span.trim()) hits.set(at, span.trim()) }

  // "Hawkview at $303/sqft" · "Shag Bark ($430/sqft)" · "Choctaw $288/sqft",
  // allowing one "in <Subdivision>" ("Brooklyn in Mirada at $309/sqft").
  for (const m of sentence.matchAll(new RegExp(`(${SPAN})(?:\\s+(?:in|on)\\s+${SPAN})?\\s*(?:at\\s+\\$|\\(\\s*\\$|\\s\\$\\d)`, 'g'))) {
    push(m.index!, m[1])
  }
  // "the Ward property" · "The Badger comp"
  for (const m of sentence.matchAll(
    new RegExp(`\\b(?:the|The)\\s+(?:[\\w,.'’-]+\\s+)?(${SPAN})\\s+(?:sale|comp|comparable|home|property|listing|residence)\\b`, 'g'),
  )) {
    push(m.index! + m[0].indexOf(m[1]), m[1])
  }
  const listRuns: Array<{ at: number; text: string }> = []
  // "comps on Star Ridge, De Haviland, Jonahs, and Lupine" — but only when the
  // clause is about comps, else "on" names the SUBJECT's own street.
  for (const m of sentence.matchAll(/\bon\s+/g)) {
    if (!/\b(?:comps?|comparables?|sales?|sold)\b/i.test(sentence.slice(0, m.index!))) continue
    listRuns.push({ at: m.index! + m[0].length, text: sentence.slice(m.index! + m[0].length) })
  }
  // "six strong comps remain: Judd, Green Heart, ..."
  for (const m of sentence.matchAll(/\b(?:comps?|comparables?|sales)\b[^:]*:\s*/g)) {
    listRuns.push({ at: m.index! + m[0].length, text: sentence.slice(m.index! + m[0].length) })
  }
  // "(Stage Stop, Wood Duck, Canvasback, Snow Goose, and Gross)" — a bare list
  // of names. Skipped after a geography noun, where it lists places not comps.
  for (const m of sentence.matchAll(/\(([^)]{4,120})\)/g)) {
    if (!/,/.test(m[1])) continue
    if (/\b(?:locations?|subdivisions?|neighborhoods?|communities|community|areas?|streets?)\s*$/i.test(sentence.slice(0, m.index!))) continue
    const items = m[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).map((s) => s.trim()).filter(Boolean)
    if (items.length < 2 || !items.every((it) => new RegExp(`^${SPAN}$`).test(it))) continue
    let off = m.index! + 1
    for (const it of items) {
      const j = sentence.indexOf(it, off)
      if (j >= 0) { push(j, it); off = j + it.length }
    }
  }
  for (const run of listRuns) {
    const m = new RegExp(`^(${SPAN})(?:\\s*(?:,\\s*(?:and\\s+)?|\\s+and\\s+)(${SPAN}))*`).exec(run.text)
    if (!m) continue
    let off = 0
    for (const im of m[0].matchAll(new RegExp(SPAN, 'g'))) {
      const j = m[0].indexOf(im[0], off)
      push(run.at + j, im[0])
      off = j + im[0].length
    }
  }
  return [...hits.entries()].map(([at, span]) => ({ at, span })).sort((a, b) => a.at - b.at)
}

function moneyValue(s: string): number | null {
  const m = /^\$?([\d,.]+)\s*([kKmM])?/.exec(s.trim())
  if (!m) return null
  let v = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(v)) return null
  if (m[2]?.toLowerCase() === 'k') v *= 1_000
  if (m[2]?.toLowerCase() === 'm') v *= 1_000_000
  return v
}

/**
 * Cross-reference the builder's comparability narrative against the comp set
 * the report actually prices. Returns critical data-integrity findings — never
 * throws, and returns [] when there is nothing to check.
 *
 * Exported for the unit test: the fixtures are the whole point of this being
 * code rather than prompt wording.
 */
export function checkNarrativeIntegrity(args: {
  narrative: string | null | undefined
  comps: CmaAdjustedComp[]
  excluded: Array<{ listingKey: string; reason: string }>
  subject: Pick<CmaSubject, 'streetAddress' | 'city' | 'subdivision'>
  market: Pick<CmaMarketContext, 'geoLabel'> | null
}): AuditFinding[] {
  const narrative = args.narrative?.trim()
  // The cap is insurance, not a real limit: a comparability narrative runs a few
  // hundred characters, and the name-list frames nest quantifiers, so an absurd
  // input is refused rather than backtracked over.
  if (!narrative || narrative.length > 8000 || !args.comps.length) return []
  const addresses = args.comps.map((c) => c.address).filter(Boolean).join(', ')
  const findings: AuditFinding[] = []
  const emit = (claim: string, evidence: string) =>
    findings.push({
      severity: 'critical',
      category: 'data-integrity',
      claim: sanitizeClientProse(claim),
      evidence: sanitizeClientProse(evidence),
      compListingKey: null,
    })

  // ── universe of names the report legitimately surfaces ────────────────────
  //
  // Every CONTIGUOUS WORD RUN of every known name, normalized. Runs (not raw
  // substrings) so a re-spaced or shortened form still resolves ("Wildriver"
  // matches "Wild River Loop") while an accidental substring does not — plain
  // `includes` let "Ward" resolve against "Woodward Highlands" and swallowed a
  // real fabrication on cma-18025-cascade-estates.
  const knownRuns = new Set<string>()
  const runsOf = (raw: string): string[] => {
    const parts = coreName(raw).split(/[^A-Za-z0-9]+/).map(normName).filter(Boolean)
    const out: string[] = []
    for (let i = 0; i < parts.length; i++) {
      let acc = ''
      for (let j = i; j < parts.length; j++) {
        acc += parts[j]
        if (acc.length >= 3) out.push(acc)
      }
    }
    return out
  }
  const learn = (raw: string | null | undefined) => {
    if (raw) for (const r of runsOf(String(raw))) knownRuns.add(r)
  }
  for (const c of args.comps) { learn(c.address); learn(c.subdivision); learn(c.city) }
  learn(args.subject.streetAddress); learn(args.subject.city); learn(args.subject.subdivision)
  learn(args.market?.geoLabel ?? null)
  for (const e of args.excluded) learn(e.reason)
  const known = (span: string): boolean => {
    const runs = runsOf(span)
    if (!runs.length) return true
    return runs.some((r) => knownRuns.has(r))
  }

  // ── 1. cited comps that are not in the set ────────────────────────────────
  const phantom = new Map<string, string>()
  let carried = false
  for (const sentence of splitSentences(narrative)) {
    const excl = markerOffsets(EXCL_SRC, sentence)
    const ret = markerOffsets(RET_SRC, sentence)
    if (carried) excl.unshift(-1)
    carried = BULK_EXCL.test(sentence)
    for (const { span, at } of citedSpans(sentence)) {
      const parts = span.split(/\s+/).filter(Boolean)
      if (!parts.length || parts.every((w) => NAME_STOP.has(w.toLowerCase().replace(/[^a-z]/g, '')))) continue
      if (normName(coreName(span)).length < 3) continue
      const retBetween = (lo: number, hi: number) => ret.some((r) => r > lo && r < hi)
      const before = excl.filter((i) => i < at)
      const after = excl.filter((i) => i > at)
      if (before.length && !retBetween(Math.max(...before), at)) continue
      if (after.length && !retBetween(at, Math.min(...after))) continue
      if (known(span)) continue
      const key = normName(coreName(span))
      if (!phantom.has(key)) phantom.set(key, coreName(span))
    }
  }
  if (phantom.size) {
    const names = [...phantom.values()]
    emit(
      `The comparability narrative presents ${names.length === 1 ? 'a comparable sale' : 'comparable sales'} that ${
        names.length === 1 ? 'does' : 'do'
      } not exist in this report: ${names.join(', ')}.`,
      `${names.map((n) => `"${n}"`).join(', ')} ${names.length === 1 ? 'is' : 'are'} cited as comparable evidence, but ` +
        `no priced comp matches ${names.length === 1 ? 'it' : 'them'}. The ${args.comps.length} priced comps are ` +
        `${addresses}.`,
    )
  }

  // ── 2. a whole-set count that over-states the priced set ──────────────────
  const total = args.comps.length
  const counted = new Set<string>()
  const countClaim = (phrase: string, claimed: number) => {
    if (!Number.isFinite(claimed) || claimed <= total) return
    if (counted.has(phrase.toLowerCase())) return
    counted.add(phrase.toLowerCase())
    emit(
      `The comparability narrative says "${phrase}" but this report prices ${total} comparable ${total === 1 ? 'sale' : 'sales'}.`,
      `Stated count ${claimed}, actual priced comps ${total}: ${addresses}.`,
    )
  }
  for (const m of narrative.matchAll(new RegExp(`\\bAll\\s+(${NUM})\\s+(?:comps?|comparables?)\\b`, 'gi'))) {
    countClaim(m[0].trim(), CARDINAL[m[1].toLowerCase()] ?? Number(m[1]))
  }
  for (const m of narrative.matchAll(
    new RegExp(`\\b(${NUM})\\s+(?:strong\\s+)?(?:comps?|comparables?)\\s+(?:remain|form)\\w*`, 'gi'),
  )) {
    countClaim(m[0].trim(), CARDINAL[m[1].toLowerCase()] ?? Number(m[1]))
  }

  // ── 3. a sold-price bracket the priced set does not reach ─────────────────
  const lo = Math.min(...args.comps.map((c) => c.closePrice))
  const hi = Math.max(...args.comps.map((c) => c.closePrice))
  for (const m of narrative.matchAll(
    /\b(?:sold|selling|sell|sales?|closed)\s+(?:between|from|for)\s+(\$[\d,.]+\s*[kKmM]?)\s*(?:and|to|,|-|through)\s*(\$[\d,.]+\s*[kKmM]?)/gi,
  )) {
    const a = moneyValue(m[1])
    const b = moneyValue(m[2])
    // Under $10,000 the pair is a $/sqft band, not a sale price.
    if (a == null || b == null || a < 10_000 || b < 10_000) continue
    const claimHi = Math.max(a, b)
    const claimLo = Math.min(a, b)
    const bad = claimHi > hi * 1.03 ? `high end $${claimHi.toLocaleString()}` : claimLo < lo * 0.97 ? `low end $${claimLo.toLocaleString()}` : null
    if (!bad) continue
    emit(
      `The comparability narrative brackets the subject with a sale price no priced comp reaches: "${m[0].trim()}".`,
      `Stated ${bad}. The priced comps closed between $${lo.toLocaleString()} and $${hi.toLocaleString()}.`,
    )
    break
  }

  return findings
}

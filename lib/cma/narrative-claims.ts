/**
 * DOES THE COMPARABILITY NARRATIVE DESCRIBE THE SALES THAT ACTUALLY PRICED?
 *
 * The judge (lib/cma/judge.ts) writes its narrative about its OWN cut, before
 * the deterministic layers finish: grounding keeps an exclusion it cannot
 * verify, the resolver restores a same-street or own-plat sale, a product wall
 * drops a sale the judge kept, the audit repair drops another. Until 2026-09-30
 * nothing read the final narrative against the final priced set, and 12 of 20
 * expired CMAs about to reach homeowners carried contradictions inside the
 * document ("three closed sales were kept" over five priced, "Prairie Crossing
 * was dropped" beside the Prairie Crossing sale in the grid, "None were
 * excluded" beside an exclusion). The adversarial auditor saw them and filed
 * them as advisory narrative majors, so the verdicts read "pass".
 *
 * Four checks, each a claim the priced set can confirm or refute:
 *
 *   count      a stated kept or retained count ("Three closed sales were kept",
 *              "Four Triple Ridge sales were kept") that is not the number of
 *              priced sales the claim covers, in either direction; and a stated
 *              excluded count ("None were excluded", "2 candidate sales were
 *              excluded") the candidates-versus-priced gap does not match.
 *   dropped    a sale named in a drop, exclude or set-aside clause that IS priced;
 *              and a sale named as kept that is NOT priced.
 *   weight     "full weight" on a priced sale carried at half, or "half weight"
 *              on one carried at full.
 *   lot        a lot-size or acreage figure about the kept sales that the priced
 *              sales' own lot data does not support, including a sale with no
 *              lot size on record.
 *
 * PRECISION IS THE POINT. A false positive strips a true sentence or fails a
 * good document. The guards, each from a real narrative in the 2026-09-29 and
 * earlier expired corpus:
 *
 *   · A name resolves to the SET of candidates it can mean (an address to one
 *     sale, a street to every sale on it, a subdivision to every sale in it).
 *     "Dropped" is flagged only when every sale the name can mean is priced,
 *     "kept" only when none is. "Widgeon is Ridge At Eagle Crest and was
 *     dropped" names a subdivision other priced sales share, and Widgeon
 *     itself is in it, so it is not a contradiction.
 *   · A name after "outside", "not in", "other than", "unlike", "versus" or
 *     "than" is the other side of the rule ("Sales outside Summer Creek were
 *     dropped"), never the sale dropped.
 *   · A clause that says both kept and dropped is ambiguous and skipped. Only
 *     ", and", "; ", ", but", "while" split a sentence into clauses.
 *   · A count qualified by a proper noun is a subset count ("Four Triple Ridge
 *     sales" beside a fifth sale in Prairie Crossing). It is checked against
 *     the priced sales that noun covers, and passes when it matches either the
 *     exact subdivision or every subdivision carrying that name ("Five Eagle
 *     Crest custom sales" over two in Eagle Crest and three in Ridge At Eagle
 *     Crest). A noun that resolves to no candidate at all (a builder, a plan
 *     name) leaves the count unchecked.
 *   · The drop, keep and excluded-count checks need the candidates the review
 *     saw. Without them they stay quiet: an unpriced sale that is not in the
 *     list cannot be told from a phantom.
 *   · A lot figure is read as a claim about the kept sales only when the
 *     sentence names priced sales or refers to the kept set ("kept sales",
 *     "They", "Those sales", "All five"). A figure after "versus", "against" or
 *     "compared" is the subject's. A drop clause's figure is a threshold.
 *     "About", "near", "roughly" widen the tolerance to a quarter.
 *
 * Pure and synchronous. No I/O, no model call, never throws on text.
 */

import { realSubdivisionName } from '@/lib/pricing/classes'

export type ClaimComp = {
  listingKey: string
  address: string
  subdivision: string | null
  lotAcres: number | null
  /**
   * Priced sales only: the reconciliation tier. strong prices at full weight,
   * weak at half. Null or absent when no judgment tiered the set.
   */
  tier?: 'strong' | 'weak' | null
}

export type ClaimKind = 'count' | 'excluded-count' | 'dropped-but-priced' | 'kept-not-priced' | 'weight' | 'lot'

export type ClaimFinding = {
  kind: ClaimKind
  /** The sentence that makes the claim, as written. */
  sentence: string
  claim: string
  evidence: string
}

export type NarrativeClaimArgs = {
  narrative: string | null | undefined
  /** The sales that priced this document. */
  priced: readonly ClaimComp[]
  /**
   * Every candidate the comparability review saw, priced or not. Omit when the
   * caller does not have it; the drop, keep and excluded-count checks then stay
   * quiet rather than guess.
   */
  candidates?: readonly ClaimComp[] | null
  subject: { streetAddress: string | null | undefined; lotAcres?: number | null }
}

// ─── sentences and clauses ──────────────────────────────────────────────────

/** Sentence split that survives "$1.025M", "0.55 acres" and "Mt. Baker". */
export function splitNarrativeSentences(t: string): string[] {
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
  return out.map((s) => s.trim()).filter(Boolean)
}

const CLAUSE_SPLIT = /;\s*|,\s+(?:and|but|while|whereas)\s+|\s+(?:but|while|whereas)\s+/g

function clauses(sentence: string): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = []
  let last = 0
  for (const m of sentence.matchAll(CLAUSE_SPLIT)) {
    out.push({ text: sentence.slice(last, m.index), at: last })
    last = m.index! + m[0].length
  }
  out.push({ text: sentence.slice(last), at: last })
  return out.filter((c) => c.text.trim())
}

const DROP_RE =
  /\b(?:dropped|excluded|exclude[sd]?|excluding|removed|set aside|left out|omitted|discarded|screened out|disregarded|thrown out|not (?:used|kept|retained|priced|counted)|(?:was|were) cut)\b/i
const KEEP_RE =
  /\b(?:kept|retained|retains?|remain(?:s|ed)?|used|priced|anchor(?:s|ed)?|carr(?:y|ies|ied)|stay(?:s|ed)?\s+at|relied on|included|form(?:s)? the)\b/i

// ─── names ──────────────────────────────────────────────────────────────────

const NUM_WORDS: Record<string, number> = {
  zero: 0, no: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
}
const NUM = String.raw`(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d{1,2})`

function numOf(token: string): number | null {
  const t = token.trim().toLowerCase()
  if (/^\d{1,2}$/.test(t)) return Number(t)
  return t in NUM_WORDS ? NUM_WORDS[t]! : null
}

const DIRECTIONAL = /^(?:n|s|e|w|ne|nw|se|sw|north|south|east|west)\.?$/i
const SUFFIX =
  /^(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|blvd|boulevard|loop|cir|circle|ter|terrace|hwy|highway|trl|trail|pkwy|parkway)\.?$/i

/** "2173 Kingwood" -> { number: '2173', street: 'Kingwood' }; "1223 NW Fresno Ave, Bend" -> Fresno. */
export function parseAddress(address: string | null | undefined): { number: string | null; street: string | null } {
  const head = (address ?? '').split(',')[0]!.replace(/\s+#\s*\S+$|\s+(?:unit|apt|ste)\s+\S+$/i, '').trim()
  const m = /^(\d+[A-Za-z]?)\s+(.+)$/.exec(head)
  const words = (m ? m[2]! : head).split(/\s+/).filter(Boolean)
  while (words.length > 1 && DIRECTIONAL.test(words[0]!)) words.shift()
  while (words.length > 1 && SUFFIX.test(words[words.length - 1]!)) words.pop()
  const street = words.join(' ').trim()
  return { number: m ? m[1]! : null, street: street || null }
}

/**
 * Words that are too ordinary, or too much a place, to be read as a single-word
 * street or subdivision name on their own. They still resolve with a house
 * number, after "on", or before "sale".
 */
const COMMON_NAME = new Set(
  (
    'park south north east west day rim pine pines cascade cascades ridge view main center river lake hill hills creek ' +
    'butte canyon meadow meadows crest summit forest valley spring springs oak elm cedar aspen juniper sage sun sunrise ' +
    'sunset holiday college church market bridge bridges mill quartz granite star high mountain village estates ' +
    'bend redmond sisters tumalo sunriver prineville madras terrebonne powell crooked deschutes oregon la pine the ' +
    'subdivision plat none other'
  ).split(/\s+/),
)

type Ident = { kind: 'address' | 'street' | 'subdivision'; name: string; keys: Set<string>; re: RegExp }

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildIdents(comps: readonly ClaimComp[]): Ident[] {
  const byAddress = new Map<string, Ident>()
  const byStreet = new Map<string, Ident>()
  const bySub = new Map<string, Ident>()
  for (const c of comps) {
    const { number, street } = parseAddress(c.address)
    if (number && street) {
      const k = `${number} ${street}`.toLowerCase()
      const ident = byAddress.get(k) ?? {
        kind: 'address' as const,
        name: `${number} ${street}`,
        keys: new Set<string>(),
        re: new RegExp(String.raw`\b${esc(number)}\s+(?:(?:N|S|E|W|NE|NW|SE|SW)\.?\s+)?${esc(street)}\b`, 'gi'),
      }
      ident.keys.add(c.listingKey)
      byAddress.set(k, ident)
    }
    if (street) {
      const k = street.toLowerCase()
      const ordinal = /^\d+(?:st|nd|rd|th)$/i.test(street)
      const common = !street.includes(' ') && COMMON_NAME.has(k)
      const ident = byStreet.get(k) ?? {
        kind: 'street' as const,
        name: street,
        keys: new Set<string>(),
        // An ordinal or an ordinary word is only a street after "on" or before a
        // sale noun. Otherwise a capitalized run of the name as written.
        re:
          ordinal || common
            ? new RegExp(
                String.raw`(?:\bon\s+(?:the\s+)?)${esc(street)}\b|\b${esc(street)}(?=\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Way|sales?|homes?|comps?|comparables?)\b)`,
                'gi',
              )
            : new RegExp(String.raw`\b${esc(street)}\b`, 'g'),
      }
      ident.keys.add(c.listingKey)
      byStreet.set(k, ident)
    }
    const sub = realSubdivisionName(c.subdivision)
    if (sub) {
      const k = sub.toLowerCase()
      if (!(!sub.includes(' ') && COMMON_NAME.has(k))) {
        const ident = bySub.get(k) ?? {
          kind: 'subdivision' as const,
          name: sub,
          keys: new Set<string>(),
          re: new RegExp(String.raw`\b${esc(sub)}\b`, 'gi'),
        }
        ident.keys.add(c.listingKey)
        bySub.set(k, ident)
      }
    }
  }
  return [...byAddress.values(), ...byStreet.values(), ...bySub.values()]
}

type Mention = {
  start: number
  end: number
  text: string
  kind: Ident['kind']
  /** Every candidate the words can mean. */
  keys: Set<string>
  /**
   * The same words name a street AND a subdivision that cover different sales
   * ("Providence" is 653 Providence and the Providence plat). The drop and keep
   * checks read the union; the weight and lot checks, which need to know which
   * sale is meant, skip it.
   */
  ambiguous: boolean
  /**
   * A subdivision named only to place a sale already named ("1358 Linda and
   * 149218 Auderine are in River Pine Estates", "Garrison in River Rim"). It is
   * not itself the subject of the clause.
   */
  descriptor: boolean
}

const DESCRIPTOR_BEFORE = /\b(?:in|at|within|inside|is|are|was|were)\s+(?:the\s+)?$/i

/** Every identifier occurrence, longest first where two overlap. */
function findMentions(text: string, idents: readonly Ident[]): Mention[] {
  const all: Array<{ start: number; end: number; text: string; ident: Ident }> = []
  for (const ident of idents) {
    for (const m of text.matchAll(ident.re)) {
      const raw = m[0]
      // The name itself, without a leading "on the ".
      const lead = /^on\s+(?:the\s+)?/i.exec(raw)?.[0].length ?? 0
      const start = m.index! + lead
      const name = raw.slice(lead)
      // Proper-noun use only: a subdivision or street written in lower case is
      // an ordinary word ("the canyon rim"), not the plat.
      if (ident.kind !== 'address' && !/^[A-Z0-9]/.test(name)) continue
      all.push({ start, end: start + name.length, text: name, ident })
    }
  }
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const out: Mention[] = []
  let reach = -1
  for (const m of all) {
    if (m.start < reach) {
      // The same span under a second identifier: one mention, both meanings.
      const last = out[out.length - 1]
      if (last && last.start === m.start && last.end === m.end) {
        const before = last.keys.size
        for (const k of m.ident.keys) last.keys.add(k)
        if (last.keys.size !== before || m.ident.keys.size !== before) last.ambiguous = true
      }
      continue
    }
    const previous = out[out.length - 1]
    const placesPrevious =
      m.ident.kind === 'subdivision' &&
      previous != null &&
      m.start - previous.end < 40 &&
      DESCRIPTOR_BEFORE.test(text.slice(0, m.start))
    out.push({
      start: m.start,
      end: m.end,
      text: m.text,
      kind: m.ident.kind,
      keys: new Set(m.ident.keys),
      ambiguous: false,
      descriptor: placesPrevious,
    })
    reach = m.end
  }
  return out
}

const INVERSE_BEFORE =
  /\b(?:outside(?:\s+of)?|not\s+in|other\s+than|except(?:\s+for)?|besides|unlike|versus|vs\.?|against|than|beyond|away\s+from|instead\s+of)\s+(?:the\s+)?(?:[\w'’.$-]+\s+){0,3}$/i

// ─── the checks ─────────────────────────────────────────────────────────────

function fmtKeys(keys: Iterable<string>, byKey: Map<string, ClaimComp>): string {
  return [...keys].map((k) => byKey.get(k)?.address ?? k).join(', ')
}

const SALE_NOUN = String.raw`(?:sales?|comps?|comparables?|homes?|townhomes?|houses?|candidates?)`

/** "Four Triple Ridge sales were kept", "Zero of five closed sales were kept". */
const COUNT_RE = new RegExp(
  String.raw`\b(${NUM})(?:\s+of\s+(?:the\s+)?(${NUM}))?((?:\s+(?!(?:were|was|are|is)\b)[\w'’&./+-]+){0,6}?)\s+${SALE_NOUN}\b([^.;:]{0,90}?)\s+(?:were|was|are|is)\s+(?:kept|retained)\b`,
  'gi',
)

/** A proper-noun run: "Triple Ridge", "Ridge At Eagle Crest", "Discovery West Phase 4". */
const PROPER_RUN = /[A-Z][\w'’.-]*(?:\s+(?:(?:at|of|the|At|Of|The)\s+)?[A-Z0-9][\w'’.-]*)*/g
const GENERIC_CAPS = new Set(['closed', 'sales', 'sale', 'kept', 'retained', 'comparable', 'recent', 'all', 'the'])

/**
 * How many priced sales a proper-noun qualifier can cover. A run can name a
 * street, a subdivision, or both ("Petrosa" is a street inside the Petrosa
 * plat), and several runs can be a list ("on Purcell and Victor") or a
 * narrowing ("Eagle Crest townhomes on Golden Pheasant"). Every reading is
 * counted; the claim stands if it matches any of them. Null when a run names
 * no candidate at all, so the count cannot be checked.
 */
function subsetCounts(
  runs: string[],
  priced: readonly ClaimComp[],
  candidates: readonly ClaimComp[],
): number[] | null {
  const streetOf = (c: ClaimComp) => (parseAddress(c.address).street ?? '').toLowerCase()
  const subOf = (c: ClaimComp) => (realSubdivisionName(c.subdivision) ?? '').toLowerCase()
  const within = (r: string, sub: string) => new RegExp(`\\b${esc(r)}\\b`).test(sub)
  const preds: Array<{ exact: (c: ClaimComp) => boolean; wide: (c: ClaimComp) => boolean }> = []
  for (const run of runs) {
    // "The Pines" is also read as "Pines": the MLS carries it as "Pines At Sisters".
    const variants = [run.toLowerCase(), ...(/^the\s+/i.test(run) ? [run.replace(/^the\s+/i, '').toLowerCase()] : [])]
    const readings = variants
      .map((r) => ({
        r,
        isStreet: candidates.some((c) => streetOf(c) === r),
        isSub: candidates.some((c) => within(r, subOf(c))),
      }))
      .filter((v) => v.isStreet || v.isSub)
    if (readings.length === 0) return null
    preds.push({
      exact: (c) => readings.some((v) => (v.isStreet && streetOf(c) === v.r) || (v.isSub && subOf(c) === v.r)),
      wide: (c) => readings.some((v) => (v.isStreet && streetOf(c) === v.r) || (v.isSub && within(v.r, subOf(c)))),
    })
  }
  if (preds.length === 0) return null
  const counts = new Set<number>()
  for (const mode of ['exact', 'wide'] as const) {
    counts.add(priced.filter((c) => preds.some((p) => p[mode](c))).length)
    counts.add(priced.filter((c) => preds.every((p) => p[mode](c))).length)
  }
  return [...counts].sort((a, b) => a - b)
}

function countFindings(sentence: string, args: NarrativeClaimArgs, all: readonly ClaimComp[]): ClaimFinding[] {
  const out: ClaimFinding[] = []
  const total = args.priced.length
  for (const m of sentence.matchAll(COUNT_RE)) {
    const claimed = numOf(m[1]!)
    if (claimed == null) continue
    // "3 bed 2 bath homes were kept": the number counts rooms, not sales.
    if (/^[\s-]*(?:bed|beds|bd|br|bath|baths|ba|bedroom|bedrooms|story|stories|car|level)\b/i.test(m[3] ?? '')) continue
    const qualifier = `${m[3] ?? ''} ${m[4] ?? ''}`
    const runs = [...qualifier.matchAll(PROPER_RUN)]
      .map((r) => r[0].trim())
      .filter((r) => r && !GENERIC_CAPS.has(r.toLowerCase()) && !/^\d/.test(r))
    if (runs.length === 0) {
      if (claimed !== total) {
        out.push({
          kind: 'count',
          sentence,
          claim: `The comparability narrative says "${m[0].trim()}" but this report prices ${total} comparable ${total === 1 ? 'sale' : 'sales'}.`,
          evidence: `Stated ${claimed}, priced ${total}: ${args.priced.map((c) => c.address).join(', ')}.`,
        })
      }
      continue
    }
    const counts = subsetCounts(runs, args.priced, all)
    if (!counts || counts.includes(claimed)) continue
    const said = counts.length === 1 ? String(counts[0]) : `${counts[0]} to ${counts[counts.length - 1]}`
    out.push({
      kind: 'count',
      sentence,
      claim: `The comparability narrative says "${m[0].trim()}" but ${said} priced ${said === '1' ? 'sale matches' : 'sales match'} ${runs.join(' and ')}.`,
      evidence: `Priced sales: ${args.priced.map((c) => `${c.address}${c.subdivision ? ` (${c.subdivision})` : ''}`).join(', ')}.`,
    })
  }
  return out
}

/** "None were excluded", "No sale was dropped", "2 candidate sales were excluded as a different market segment". */
const NONE_EXCLUDED_RE =
  /\b(?:none|no\s+(?:sale|sales|comp|comps|candidate|candidates))\b(?:\s+in\s+this\s+set)?\s+(?:were|was)\s+(?:excluded|dropped|removed|set\s+aside)\b/i
const TOTAL_EXCLUDED_RE = new RegExp(
  String.raw`\b(${NUM})\s+candidate\s+sales?\s+(?:was|were)\s+excluded\s+as\s+a\s+different\s+market\s+segment\b|\ball\s+(${NUM})\s+(?:candidates?\s+|sales?\s+)?(?:were|was)\s+(?:excluded|dropped)\b`,
  'i',
)
const SOME_EXCLUDED_RE = new RegExp(
  String.raw`\b(${NUM})\s+(?:candidate\s+)?(?:candidates|sales?)\s+(?:was|were)\s+(?:excluded|dropped|removed|set\s+aside)\b`,
  'i',
)

function excludedCountFindings(sentence: string, args: NarrativeClaimArgs, excludedCount: number): ClaimFinding[] {
  const evidence = `${excludedCount} of the candidate sales the review saw ${excludedCount === 1 ? 'is' : 'are'} not priced.`
  if (NONE_EXCLUDED_RE.test(sentence)) {
    if (excludedCount > 0) {
      return [
        {
          kind: 'excluded-count',
          sentence,
          claim: `The comparability narrative says no sale was excluded, but ${excludedCount} candidate ${excludedCount === 1 ? 'sale was' : 'sales were'} left out of the priced set.`,
          evidence,
        },
      ]
    }
    return []
  }
  const total = TOTAL_EXCLUDED_RE.exec(sentence)
  if (total) {
    const n = numOf(total[1] ?? total[2] ?? '')
    if (n != null && n !== excludedCount) {
      return [
        {
          kind: 'excluded-count',
          sentence,
          claim: `The comparability narrative says "${total[0].trim()}" but ${excludedCount} candidate ${excludedCount === 1 ? 'sale is' : 'sales are'} not priced.`,
          evidence,
        },
      ]
    }
    return []
  }
  const some = SOME_EXCLUDED_RE.exec(sentence)
  if (some) {
    const n = numOf(some[1]!)
    // A partial count ("Two candidates were dropped because...") can be one
    // reason among several, so only a count ABOVE the gap contradicts it.
    if (n != null && n > excludedCount) {
      return [
        {
          kind: 'excluded-count',
          sentence,
          claim: `The comparability narrative says "${some[0].trim()}" but only ${excludedCount} candidate ${excludedCount === 1 ? 'sale is' : 'sales are'} not priced.`,
          evidence,
        },
      ]
    }
  }
  return []
}

function nameFindings(
  sentence: string,
  idents: readonly Ident[],
  pricedKeys: Set<string>,
  byKey: Map<string, ClaimComp>,
  subjectAddress: { number: string | null; street: string | null },
): ClaimFinding[] {
  const out: ClaimFinding[] = []
  for (const clause of clauses(sentence)) {
    const drops = DROP_RE.test(clause.text)
    // "not used" is a drop, not a keep that also says "used".
    const keeps = KEEP_RE.test(clause.text.replace(/\bnot\s+(?:used|kept|retained|priced|counted)\b/gi, ' '))
    if (drops === keeps) continue
    for (const m of findMentions(clause.text, idents)) {
      if (m.descriptor) continue
      if (INVERSE_BEFORE.test(clause.text.slice(0, m.start))) continue
      if (
        m.kind === 'address' &&
        subjectAddress.number &&
        subjectAddress.street &&
        parseAddress(m.text).number === subjectAddress.number &&
        parseAddress(m.text).street?.toLowerCase() === subjectAddress.street.toLowerCase()
      ) {
        continue
      }
      const keys = [...m.keys]
      const priced = keys.filter((k) => pricedKeys.has(k))
      if (drops && priced.length === keys.length) {
        out.push({
          kind: 'dropped-but-priced',
          sentence,
          claim: `The comparability narrative says ${m.text} was left out, but ${keys.length === 1 ? 'that sale is' : 'every sale it can mean is'} in the priced set.`,
          evidence: `Priced: ${fmtKeys(priced, byKey)}.`,
        })
      } else if (keeps && priced.length === 0) {
        out.push({
          kind: 'kept-not-priced',
          sentence,
          claim: `The comparability narrative presents ${m.text} as kept, but no sale it can mean is in the priced set.`,
          evidence: `Not priced: ${fmtKeys(keys, byKey)}.`,
        })
      }
    }
  }
  return out
}

const WEIGHT_RE =
  /\b(full)[ -]weight\b|\b(half)[ -]weight\b|\b(down-?weighted)\b|\b(?:(reduced|lower|less|lesser)\s+weight)\b|\b(bracket(?:ing)?\s+only)\b/gi

function weightFindings(
  sentence: string,
  idents: readonly Ident[],
  pricedByKey: Map<string, ClaimComp>,
): ClaimFinding[] {
  const kinds = new Set<'strong' | 'weak'>()
  for (const m of sentence.matchAll(WEIGHT_RE)) kinds.add(m[1] ? 'strong' : 'weak')
  if (kinds.size === 0) return []
  const out: ClaimFinding[] = []
  // A sentence stating both weights is split at its clauses, and a clause that
  // still states both is skipped.
  const parts = kinds.size === 1 ? [{ text: sentence, at: 0 }] : clauses(sentence)
  for (const part of parts) {
    const claimed = new Set<'strong' | 'weak'>()
    for (const m of part.text.matchAll(WEIGHT_RE)) claimed.add(m[1] ? 'strong' : 'weak')
    if (claimed.size !== 1) continue
    const want = [...claimed][0]!
    for (const m of findMentions(part.text, idents)) {
      if (m.ambiguous || m.descriptor) continue
      if (INVERSE_BEFORE.test(part.text.slice(0, m.start))) continue
      const tiers = [...m.keys].map((k) => pricedByKey.get(k)?.tier ?? null).filter((t): t is 'strong' | 'weak' => t != null)
      if (tiers.length === 0) continue
      // Mixed tiers under one street or plat name: the sentence may mean only
      // some of them, so it is not read as a claim about all.
      if (!tiers.every((t) => t === tiers[0])) continue
      if (tiers[0] === want) continue
      out.push({
        kind: 'weight',
        sentence,
        claim: `The comparability narrative puts ${m.text} at ${want === 'strong' ? 'full' : 'half'} weight, but the priced set carries it at ${tiers[0] === 'strong' ? 'full' : 'half'} weight.`,
        evidence: `${m.text} is tier ${tiers[0]} in the reconciliation.`,
      })
    }
  }
  return out
}

const ACRE_NUM = String.raw`(\d+(?:\.\d+)?|\.\d+|an?|one)`
const ACRE_UNIT = String.raw`(?:acres?|ac)\b`
/** "0.55 to 0.86 acres", "0.24ac to 0.28ac", "0.27-0.44 acre lots", "about 1 acre", "an acre", "one-acre". */
const ACRE_RE = new RegExp(
  String.raw`\b(about|near|nearly|roughly|around|approximately|close\s+to)?\s*${ACRE_NUM}\s*-?\s*(?:${ACRE_UNIT}\s*)?(?:(?:to|-|–|and)\s*${ACRE_NUM}\s*-?\s*)?${ACRE_UNIT}`,
  'gi',
)
const KEPT_SET_REF =
  /\b(?:kept|retained|remaining)\s+(?:sales|set|comps|homes)\b|^\s*(?:they|those|these|both|each|all\s+(?:\w+\s+)?(?:sales|homes|kept)?|all\s+(?:two|three|four|five|six|seven|eight|nine|ten))\b|^\s*the\s+(?:two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:closed\s+)?(?:sales|homes|comps)\b|\bthe\s+(?:kept|retained)\b|\blot\s+sizes?\s+on\s+the\s+kept\b/i
const SUBJECT_SIDE = /\b(?:versus|vs\.?|against|compared\s+(?:to|with))\s+(?:the\s+subject'?s?\s+|a\s+|an\s+)?$/i

function acres(token: string): number | null {
  const t = token.trim().toLowerCase()
  if (t === 'a' || t === 'an' || t === 'one') return 1
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function lotFindings(
  sentence: string,
  idents: readonly Ident[],
  priced: readonly ClaimComp[],
  byKey: Map<string, ClaimComp>,
  subjectLot: number | null,
): ClaimFinding[] {
  if (DROP_RE.test(sentence)) return []
  const out: ClaimFinding[] = []
  const all = findMentions(sentence, idents).filter(
    (m) => !m.descriptor && !INVERSE_BEFORE.test(sentence.slice(0, m.start)),
  )
  // A name that can mean two different sets of sales cannot say whose lot it is.
  if (all.some((m) => m.ambiguous)) return []
  const mentions = all
  const pricedKeys = new Set(priced.map((c) => c.listingKey))
  const named = [...new Set(mentions.flatMap((m) => [...m.keys]))]
  let referents: ClaimComp[]
  if (named.length > 0) {
    // Only the named sales that priced: a claim about an unpriced sale is not a
    // claim about the kept set.
    referents = named.filter((k) => pricedKeys.has(k)).map((k) => byKey.get(k)!).filter(Boolean)
    if (referents.length === 0) return []
  } else if (KEPT_SET_REF.test(sentence)) {
    referents = [...priced]
  } else {
    return []
  }
  for (const m of sentence.matchAll(ACRE_RE)) {
    const at = (m.index ?? 0) + (m[0].length - m[0].trimStart().length)
    if (SUBJECT_SIDE.test(sentence.slice(0, at))) continue
    const lo = acres(m[2]!)
    const hi = m[3] != null ? acres(m[3]) : lo
    if (lo == null || hi == null) continue
    const a = Math.min(lo, hi)
    const b = Math.max(lo, hi)
    const approx = Boolean(m[1])
    const tol = (x: number) => Math.max(approx ? 0.25 * x : 0.03 * x, approx ? 0.05 : 0.011)
    // A single figure equal to the subject's lot is read as the subject's
    // ("Clarion matches the 3-bed 0.1 ac 2005-era profile").
    if (a === b && subjectLot != null && Math.abs(a - subjectLot) <= tol(a)) continue
    const missing = referents.filter((c) => c.lotAcres == null)
    const outside = referents.filter(
      (c) => c.lotAcres != null && (c.lotAcres < a - tol(a) || c.lotAcres > b + tol(b)),
    )
    if (missing.length === 0 && outside.length === 0) continue
    const said = m[0].trim()
    out.push({
      kind: 'lot',
      sentence,
      claim: `The comparability narrative says the kept sales sit on ${said}, which the priced sales' own lot data does not support.`,
      evidence: [
        outside.length ? `Outside that: ${outside.map((c) => `${c.address} on ${c.lotAcres} acres`).join(', ')}.` : null,
        missing.length ? `No lot size on record: ${missing.map((c) => c.address).join(', ')}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    })
  }
  return out
}

/**
 * Every claim in the narrative the priced set refutes, one finding per claim,
 * with the sentence that makes it. Empty when there is nothing to check.
 */
export function narrativeClaimFindings(args: NarrativeClaimArgs): ClaimFinding[] {
  const narrative = (args.narrative ?? '').replace(/\s+/g, ' ').trim()
  if (!narrative || narrative.length > 8000 || args.priced.length === 0) return []
  const known = args.candidates && args.candidates.length > 0
  const byKey = new Map<string, ClaimComp>()
  for (const c of args.candidates ?? []) byKey.set(c.listingKey, c)
  for (const c of args.priced) byKey.set(c.listingKey, { ...byKey.get(c.listingKey), ...c })
  const all = [...byKey.values()]
  const pricedKeys = new Set(args.priced.map((c) => c.listingKey))
  const pricedByKey = new Map(args.priced.map((c) => [c.listingKey, c]))
  const idents = buildIdents(all)
  const subjectAddress = parseAddress(args.subject.streetAddress)
  const excludedCount = all.filter((c) => !pricedKeys.has(c.listingKey)).length
  const out: ClaimFinding[] = []
  for (const sentence of splitNarrativeSentences(narrative)) {
    out.push(...countFindings(sentence, args, all))
    if (known) {
      out.push(...excludedCountFindings(sentence, args, excludedCount))
      out.push(...nameFindings(sentence, idents, pricedKeys, byKey, subjectAddress))
    }
    out.push(...weightFindings(sentence, idents, pricedByKey))
    out.push(...lotFindings(sentence, idents, args.priced, byKey, args.subject.lotAcres ?? null))
  }
  return out
}

/**
 * The narrative with every sentence that makes a refuted claim taken out. The
 * caller decides what to do when nothing true is left.
 */
export function stripRefutedSentences(args: NarrativeClaimArgs): { narrative: string; removed: ClaimFinding[] } {
  const narrative = (args.narrative ?? '').replace(/\s+/g, ' ').trim()
  const findings = narrativeClaimFindings({ ...args, narrative })
  if (findings.length === 0) return { narrative, removed: [] }
  const bad = new Set(findings.map((f) => f.sentence))
  const kept = splitNarrativeSentences(narrative).filter((s) => !bad.has(s))
  return { narrative: kept.join(' '), removed: findings }
}

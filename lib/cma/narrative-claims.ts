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

import { reviewWeightFactor } from '@/lib/cma/review-weight'
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
  /** Close price and living area, for the $/sqft band a narrative states. */
  closePrice?: number | null
  sqft?: number | null
  /** Year built, for a count qualified by build years ("Four closed sales from 1917 to 1930"). */
  yearBuilt?: number | null
}

/**
 * THE ONE MAPPER from a comp to the shape these checks read (review of
 * da8dce6, 2026-09-30). The judge, the integrity check, the final-set gate and
 * both builders call it, so a field added to ClaimComp reaches every path at
 * once instead of silently leaving one check blind on one of them (the $/sqft
 * band check was blind on three of the four copies this replaced).
 *
 * `tier` is the review's verdict on the sale. Its weight class is the weight
 * the reconciliation actually applied, reviewWeightFactor(tier)
 * (lib/cma/review-weight.ts): half is 'weak', full is 'strong'. It is not a
 * second copy of that rule, so a sale carrying an exclude verdict that prices
 * anyway on a broker-picked set reads as the full weight it carried. No verdict
 * reads as no tier.
 */
export function claimCompOf(
  c: {
    listingKey: string
    address: string
    subdivision: string | null
    lotAcres: number | null
    closePrice?: number | null
    sqft?: number | null
    yearBuilt?: number | null
  },
  tier: string | null | undefined,
): ClaimComp {
  return {
    listingKey: c.listingKey,
    address: c.address,
    subdivision: c.subdivision,
    lotAcres: c.lotAcres,
    tier: tier == null ? null : reviewWeightFactor(tier) < 1 ? 'weak' : 'strong',
    closePrice: c.closePrice ?? null,
    sqft: c.sqft ?? null,
    yearBuilt: c.yearBuilt ?? null,
  }
}

export type ClaimKind =
  | 'count'
  | 'excluded-count'
  | 'dropped-but-priced'
  | 'kept-not-priced'
  | 'weight'
  | 'lot'
  | 'band'

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
 * The priced sales a proper-noun qualifier can cover. A run can name a street,
 * a subdivision, or both ("Petrosa" is a street inside the Petrosa plat), and
 * several runs can be a list ("on Purcell and Victor") or a narrowing ("Eagle
 * Crest townhomes on Golden Pheasant"). Every reading is returned; a claim
 * stands if it matches any of them. Null when a run names no candidate at all,
 * so the claim cannot be checked.
 */
function subsetReadings(
  runs: string[],
  priced: readonly ClaimComp[],
  candidates: readonly ClaimComp[],
): ClaimComp[][] | null {
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
  const seen = new Set<string>()
  const out: ClaimComp[][] = []
  for (const mode of ['exact', 'wide'] as const) {
    for (const set of [priced.filter((c) => preds.some((p) => p[mode](c))), priced.filter((c) => preds.every((p) => p[mode](c)))]) {
      const key = set.map((c) => c.listingKey).sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(set)
    }
  }
  return out
}

/** The proper-noun runs in a qualifier: "Triple Ridge", "The Pines". */
function properRuns(qualifier: string): string[] {
  return [...qualifier.matchAll(PROPER_RUN)]
    .map((r) => r[0].trim())
    .filter((r) => r && !GENERIC_CAPS.has(r.toLowerCase()) && !/^\d/.test(r))
}

/** Qualifier words that do not narrow the kept set: "closed", "comparable", "remaining". */
const GENERIC_QUALIFIER = new Set([
  'closed', 'comparable', 'comparables', 'comp', 'comps', 'sold', 'remaining', 'total', 'qualifying', 'candidate',
  'arm', "arm's", 'arms', 'length', "arm's-length", 'arms-length', 'the', 'all', 'of', 'these', 'those',
  // The sale noun itself. In "Zero of three candidate sales were kept" the
  // pattern takes "candidate" as the noun and leaves "sales" in the qualifier,
  // which read as a narrowing word and turned a refuted count into a ceiling.
  'sale', 'sales', 'candidates', 'home', 'homes', 'house', 'houses', 'townhome', 'townhomes', 'property', 'properties',
])
const TIER_WORD = /^(?:strong|full|weak|half|weight|down-?weighted|bracketing)$/
const TIER_STRONG = /\b(?:strong|full[ -]weight)\b/i
const TIER_WEAK = /\b(?:weak|half[ -]weight|down-?weighted|bracketing)\b/i
/** The weight a count carries right after its verb: "were retained at full weight", "were kept at half weight to bracket". */
const TIER_AFTER =
  /^\s*,?\s*(?:(?:at|with|as|carrying)\s+)?(?:(full)[ -]weight|(half)[ -]weight|(strong)\b|(weak)\b|(down-?weighted|halved)\b|to\s+(bracket))/i

/** Which review weight a count claims, if any: from its qualifier or the words right after its verb. */
function countTier(qualifier: string, after: string): 'strong' | 'weak' | 'mixed' | null {
  const kinds = new Set<'strong' | 'weak'>()
  if (TIER_STRONG.test(qualifier)) kinds.add('strong')
  if (TIER_WEAK.test(qualifier)) kinds.add('weak')
  const a = TIER_AFTER.exec(after)
  if (a) kinds.add(a[1] || a[3] ? 'strong' : 'weak')
  if (kinds.size === 0) return null
  return kinds.size > 1 ? 'mixed' : [...kinds][0]!
}

/** A lowercase qualifier that narrows the set without naming it: "older", "recent", "additional", "lower-priced". */
function narrowingQualifier(qualifier: string): boolean {
  // A year or a dollar figure the priced set could not resolve still names a
  // subset ("Four 2025 sales were kept": a close year, not a build year).
  if (/\b(?:1[89]|20)\d{2}\b|\$\s?\d/.test(qualifier)) return true
  const words = qualifier.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []
  return words.some((w) => !GENERIC_QUALIFIER.has(w) && !TIER_WORD.test(w))
}

const ROOM_WORDS = /^[\s-]*(?:bed|beds|bd|br|bath|baths|ba|bedroom|bedrooms|story|stories|car|level)\b/i

/**
 * A stated kept or retained count against the priced set. How it is read
 * depends on what qualifies it (the review of da8dce6, 2026-09-30):
 *
 *   · a proper noun ("Four Triple Ridge sales") is EXACT against the priced
 *     sales that noun covers;
 *   · a review weight ("Three strong sales", "were retained at full weight",
 *     "two sales at half weight to bracket") is EXACT against the priced sales
 *     carrying that weight, and a CEILING when another word narrows it too
 *     ("Two recent sales were retained at half weight");
 *   · any other lowercase qualifier ("older", "recent", "additional",
 *     "lower-priced") is a CEILING: it names a subset, so it may be smaller
 *     than the set but never larger;
 *   · no qualifier, or only "closed", "comparable", "remaining", is EXACT
 *     against the whole priced set.
 */
function countFindings(sentence: string, args: NarrativeClaimArgs, all: readonly ClaimComp[]): ClaimFinding[] {
  const out: ClaimFinding[] = []
  const total = args.priced.length
  const tiered = total > 0 && args.priced.every((c) => c.tier === 'strong' || c.tier === 'weak')
  for (const m of sentence.matchAll(COUNT_RE)) {
    const claimed = numOf(m[1]!)
    if (claimed == null) continue
    // "3 bed 2 bath homes were kept": the number counts rooms, not sales.
    if (ROOM_WORDS.test(m[3] ?? '')) continue
    const qualifier = `${m[3] ?? ''} ${m[4] ?? ''}`
    const runs = properRuns(qualifier)
    if (runs.length === 0) {
      const after = sentence.slice((m.index ?? 0) + m[0].length)
      const tier = countTier(qualifier, after)
      // A $/sqft band or build years in the count's own words name a subset
      // the priced set can resolve, so the count is exact against it, the way
      // a proper noun is ("Four closed sales from $242 to $271 per square foot
      // were kept" over five priced sales that all sit in that band).
      const resolved = resolveRangeQualifier(qualifier, args.priced)
      const base = resolved ? resolved.subset : args.priced
      const narrowed = narrowingQualifier(resolved ? resolved.rest : qualifier)
      let limit = base.length
      let exact = !narrowed
      let what = resolved
        ? `${limit} priced ${limit === 1 ? 'sale matches' : 'sales match'} ${resolved.label}`
        : `this report prices ${total} comparable ${total === 1 ? 'sale' : 'sales'}`
      let evidence = resolved
        ? `Priced sales: ${args.priced.map(describeForRange).join(', ')}.`
        : `Stated ${claimed}, priced ${total}: ${args.priced.map((c) => c.address).join(', ')}.`
      if (tier === 'strong' || tier === 'weak') {
        if (!tiered) continue
        const inTier = base.filter((c) => c.tier === tier)
        limit = inTier.length
        const weight = tier === 'strong' ? 'full' : 'half'
        what = `${limit} priced ${limit === 1 ? 'sale carries' : 'sales carry'} ${weight} weight${resolved ? ` among those matching ${resolved.label}` : ''}`
        evidence = `At ${weight} weight: ${inTier.map((c) => c.address).join(', ') || 'none'}.`
      } else if (tier === 'mixed') {
        exact = false
      }
      const refuted = exact ? claimed !== limit : claimed > limit
      if (refuted) {
        out.push({
          kind: 'count',
          sentence,
          claim: `The comparability narrative says "${m[0].trim()}" but ${what}.`,
          evidence,
        })
      }
      continue
    }
    const readings = subsetReadings(runs, args.priced, all)
    const counts = readings ? [...new Set(readings.map((r) => r.length))].sort((a, b) => a - b) : null
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
/**
 * "Two candidates were dropped", "One lower-priced sale was set aside as a
 * different price tier". Qualified or not, a partial exclusion count is a
 * CEILING on the candidates the priced set leaves out: it may be one reason
 * among several, but it cannot name more sales than are out.
 */
const SOME_EXCLUDED_RE = new RegExp(
  String.raw`\b(${NUM})((?:\s+(?!(?:were|was)\b)[\w'’&./+-]+){0,4}?)\s+(?:candidate\s+)?(?:candidates|sales?|comps?|comparables?|homes?|houses?)\s+(?:was|were)\s+(?:excluded|dropped|removed|set\s+aside|left\s+out|not\s+used|cut)\b`,
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
  if (some && !ROOM_WORDS.test(some[2] ?? '')) {
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

/** A lot figure: a decimal, a fraction ("1/2"), a word ("half", "a quarter", "an", "one"). */
const ACRE_NUM = String.raw`(?:\d+(?:\.\d+)?\s*\/\s*\d+|\d+(?:\.\d+)?|\.\d+|an?\s+half|one[- ]half|half|an?\s+quarter|one[- ]quarter|quarter|three[- ]quarters?|an?\s+third|one[- ]third|an?|one|two|three|four|five|ten)`
const ACRE_UNIT = String.raw`(?:acres?|ac)\b`
/** The comparative or approximation before a figure. */
const ACRE_CMP = String.raw`(less\s+than|under|below|up\s+to|no\s+more\s+than|at\s+most|smaller\s+than|more\s+than|over|above|at\s+least|no\s+less\s+than|greater\s+than|larger\s+than|about|near|nearly|almost|roughly|around|approximately|close\s+to|just\s+under|just\s+over|~)`
/**
 * "0.55 to 0.86 acres", "0.24ac to 0.28ac", "0.27-0.44 acre lots", "about 1
 * acre", "an acre", "one-acre", "less than an acre", "about half an acre",
 * "under 0.5 acres", "at least 0.45", "1/2 acre", "quarter-acre", "an acre or
 * more". Groups: 1 comparative, 2 first figure, 3 second figure, 4 the unit
 * as written, 5 a trailing "or less" / "or more" / "+".
 */
const ACRE_RE = new RegExp(
  String.raw`(?:\b${ACRE_CMP}\s+)?(?:between\s+)?(${ACRE_NUM})(?:\s+an)?\s*-?\s*(?:${ACRE_UNIT}\s*)?(?:(?:to|-|–|and)\s*(${ACRE_NUM})(?:\s+an)?\s*-?\s*)?(${ACRE_UNIT})(\s+or\s+(?:less|smaller|under|more|larger|greater|bigger)\b|\s*\+|\s+plus\b)?`,
  'gi',
)
const KEPT_SET_REF =
  /\b(?:kept|retained|remaining)\s+(?:sales|set|comps|homes)\b|^\s*(?:they|those|these|both|each|all\s+(?:\w+\s+)?(?:sales|homes|kept)?|all\s+(?:two|three|four|five|six|seven|eight|nine|ten))\b|^\s*the\s+(?:two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(?:closed\s+)?(?:sales|homes|comps)\b|\bthe\s+(?:kept|retained)\b|\blot\s+sizes?\s+on\s+the\s+kept\b/i
const SUBJECT_SIDE = /\b(?:versus|vs\.?|against|compared\s+(?:to|with))\s+(?:the\s+subject'?s?\s+|a\s+|an\s+)?$/i

const WORD_ACRES: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 }

function acres(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/\s+/g, ' ')
  const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+)$/.exec(t)
  if (frac) return Number(frac[2]) > 0 ? Number(frac[1]) / Number(frac[2]) : null
  if (/^(?:an? )?half$|^one[- ]half$/.test(t)) return 0.5
  if (/^(?:an? )?quarter$|^one[- ]quarter$/.test(t)) return 0.25
  if (/^three[- ]quarters?$/.test(t)) return 0.75
  if (/^(?:an? )?third$|^one[- ]third$/.test(t)) return 1 / 3
  if (t in WORD_ACRES) return WORD_ACRES[t]!
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type LotBound = 'range' | 'max' | 'min'

/** How a figure bounds the lots it describes, from its comparative. */
function lotBound(cmp: string | undefined, post: string | undefined): { bound: LotBound; approx: boolean } {
  const c = (cmp ?? '').toLowerCase().replace(/\s+/g, ' ')
  const tail = (post ?? '').toLowerCase()
  if (/^(?:less than|under|below|up to|no more than|at most|smaller than)$/.test(c) || /or (?:less|smaller|under)/.test(tail)) {
    return { bound: 'max', approx: false }
  }
  if (/^(?:more than|over|above|at least|no less than|greater than|larger than)$/.test(c) || /or (?:more|larger|greater|bigger)|\+|plus/.test(tail)) {
    return { bound: 'min', approx: false }
  }
  return { bound: 'range', approx: c !== '' }
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
    // "Four Acres Estates" is a name, not a lot figure.
    if (/^[A-Z]/.test(m[4] ?? '') && /^[a-z]/i.test(m[2] ?? '') && !/^\d/.test(m[2] ?? '')) continue
    const lo = acres(m[2]!)
    const hi = m[3] != null ? acres(m[3]) : lo
    if (lo == null || hi == null) continue
    const a = Math.min(lo, hi)
    const b = Math.max(lo, hi)
    const { bound, approx } = lotBound(m[1], m[5])
    const tol = (x: number) => Math.max(approx ? 0.25 * x : 0.03 * x, approx ? 0.05 : 0.011)
    // A single exact figure equal to the subject's lot is read as the
    // subject's ("Clarion matches the 3-bed 0.1 ac 2005-era profile").
    if (bound === 'range' && a === b && subjectLot != null && Math.abs(a - subjectLot) <= tol(a)) continue
    const missing = referents.filter((c) => c.lotAcres == null)
    const outside = referents.filter((c) => {
      if (c.lotAcres == null) return false
      if (bound === 'max') return c.lotAcres > b + tol(b)
      if (bound === 'min') return c.lotAcres < a - tol(a)
      return c.lotAcres < a - tol(a) || c.lotAcres > b + tol(b)
    })
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

const PPSF_UNIT = String.raw`(?:\s*\/\s*(?:sq\.?\s*ft\.?|sqft|sf)\b|\s+(?:per|a)\s+(?:sq\.?\s*ft\.?|sqft|square\s+(?:foot|feet))\b)`
/** "$309 to $318 per square foot", "$236 and $256/sqft", "$350-$420 per sq ft". */
const BAND_RE = new RegExp(
  String.raw`\$\s?(\d{2,4}(?:\.\d+)?)${PPSF_UNIT}?\s*(?:to|-|–|and|through)\s*\$\s?(\d{2,4}(?:\.\d+)?)${PPSF_UNIT}`,
  'gi',
)
/** A clause that states the band of the sales that price: kept, retained, priced on, the remaining set. */
const BAND_KEEP =
  /\b(?:kept|retained|remaining|priced\s+(?:on|from|at|between)|(?:the\s+)?(?:kept|retained|priced)\s+(?:closed\s+)?(?:sales|set|comps|comparables|homes))\b/i
/** "Priced on Canyon Rim Village closed sales from $277 to $320": the words that qualify "sales" after "priced on". */
const PRICED_ON_RE = /\bpriced\s+on\s+((?:[\w'’&.-]+\s+){0,6}?)(?:closed\s+)?(?:sales|comps|comparables|homes)\b/i

function ppsfOf(c: ClaimComp): number | null {
  return c.closePrice != null && c.sqft != null && c.closePrice > 0 && c.sqft > 0 ? c.closePrice / c.sqft : null
}

/** One $/sqft band inside a count's own words: "Four closed sales from $242 to $271 per square foot". */
const QUALIFIER_BAND_RE = new RegExp(
  String.raw`\$\s?(\d{2,4}(?:\.\d+)?)${PPSF_UNIT}?\s*(?:to|-|–|and|through)\s*\$\s?(\d{2,4}(?:\.\d+)?)${PPSF_UNIT}`,
  'i',
)
/** Build years in a count's own words: "from 1917 to 1930", "2017-2018", "2003". Never a square footage. */
const QUALIFIER_YEAR_RE =
  /(?<![$\d,.])\b(1[89]\d{2}|20\d{2})(?:\s*(?:to|-|–|through|and)\s*(1[89]\d{2}|20\d{2}))?\b(?!\s*-?\s*(?:sq|square|sf|sqft|feet|ft)\b)/i
const BUILT_WORD = /\b(?:built|construction|vintage|era)\b/i
/**
 * A year this recent can be a close year ("Four 2025 sales were kept"), so it
 * resolves as a build year only when the words say "built". No priced sale
 * closed this long ago: the widest ladder rung looks back 24 months.
 */
const CLOSE_YEARS_BACK = 6
const RANGE_CONNECTORS = /\b(?:from|to|between|and|at|per|square|foot|feet|sq|ft|sqft|built|in|of|through|during|construction|vintage|era)\b/gi

/**
 * The priced sales a count's range words name: a $/sqft band (every sale
 * within whole-dollar rounding of it) and build years. Null when the words
 * name no range, or name one the priced set cannot resolve (a sale with no
 * living area or no year built, a year that could be a close year). `rest` is
 * the qualifier with the range words taken out, so a word that narrows further
 * ("older", "additional") still makes the count a ceiling on the subset.
 */
function resolveRangeQualifier(
  qualifier: string,
  priced: readonly ClaimComp[],
): { subset: ClaimComp[]; rest: string; label: string } | null {
  let rest = qualifier
  let subset: ClaimComp[] | null = null
  const labels: string[] = []
  const band = QUALIFIER_BAND_RE.exec(rest)
  if (band) {
    if (priced.some((c) => ppsfOf(c) == null)) return null
    const lo = Math.min(Number(band[1]), Number(band[2]))
    const hi = Math.max(Number(band[1]), Number(band[2]))
    subset = priced.filter((c) => {
      const v = ppsfOf(c)!
      return v > lo - 1 && v < hi + 1
    })
    labels.push(`$${lo} to $${hi} per square foot`)
    rest = rest.replace(band[0], ' ')
  }
  const year = QUALIFIER_YEAR_RE.exec(rest)
  if (year) {
    const y1 = Number(year[1])
    const y2 = year[2] ? Number(year[2]) : y1
    const recent = Math.max(y1, y2) > new Date().getUTCFullYear() - CLOSE_YEARS_BACK
    if ((!recent || BUILT_WORD.test(rest)) && priced.every((c) => c.yearBuilt != null && c.yearBuilt > 0)) {
      const lo = Math.min(y1, y2)
      const hi = Math.max(y1, y2)
      subset = (subset ?? [...priced]).filter((c) => c.yearBuilt! >= lo && c.yearBuilt! <= hi)
      labels.push(lo === hi ? `built in ${lo}` : `built ${lo} to ${hi}`)
      rest = rest.replace(year[0], ' ')
    }
  }
  if (!subset) return null
  return { subset, rest: rest.replace(RANGE_CONNECTORS, ' '), label: labels.join(' and ') }
}

function describeForRange(c: ClaimComp): string {
  const v = ppsfOf(c)
  return `${c.address}${v != null ? ` at $${Math.round(v)}` : ''}${c.yearBuilt ? ` (built ${c.yearBuilt})` : ''}`
}

/**
 * Window wording: the sales sit inside the band, which is not a claim about
 * its ends. "Three closed sales were kept between $230 and $270 per square
 * foot" over sales at $236, $257 and $268 is true (cma-51599-ash, the judge
 * quoting its declared band); "from $350 to $420" is a range, whose ends must
 * be the sales' own.
 */
const WINDOW_BEFORE = /\b(?:between|inside(?:\s+of)?|within|in(?:\s+(?:the|a|an))?)\s+$/i
const WINDOW_AFTER = /^\s*(?:band|window|bracket)\b/i

/**
 * A $/sqft range stated for the kept or priced sales must be the priced
 * sales' own lowest and highest closed $/sqft, within whole-dollar rounding
 * either way. The judge declares its band before grounding and the
 * restorations move the set, so the band it wrote can describe sales that no
 * longer price, or leave out the one that came back ("Priced on closed sales
 * from $350 to $420 per square foot" over a restored own-plat sale at $278).
 * A band for a subset is checked against that subset when the words resolve it
 * (a plat or street name, a review weight), and left alone when they do not
 * ("the strongest comps", "the older sales"). A drop clause's range is a
 * threshold, not the kept set.
 */
function bandFindings(
  sentence: string,
  args: NarrativeClaimArgs,
  all: readonly ClaimComp[],
  idents: readonly Ident[],
): ClaimFinding[] {
  const out: ClaimFinding[] = []
  const pricedKeys = new Set(args.priced.map((c) => c.listingKey))
  // The priced sales the sentence names by address or street: "Two closed
  // sales were kept, Coe and Yosemite, from $412 to $468", "Three sales were
  // kept at $363 to $390: 10990 Desert Sky, 8685 Red Wing, and 8665 Red Wing".
  // A name that is a street and a plat at once ("Quiet Canyon") counts with
  // both meanings; the reading is used only when the names come to exactly the
  // count the sentence states, which is what keeps the union honest.
  const named = new Set<string>()
  for (const mention of findMentions(sentence, idents)) {
    if (mention.kind === 'subdivision' && !mention.ambiguous) continue
    for (const k of mention.keys) if (pricedKeys.has(k)) named.add(k)
  }
  for (const clause of clauses(sentence)) {
    if (DROP_RE.test(clause.text) || !BAND_KEEP.test(clause.text)) continue
    for (const m of clause.text.matchAll(BAND_RE)) {
      const lo = Math.min(Number(m[1]), Number(m[2]))
      const hi = Math.max(Number(m[1]), Number(m[2]))
      if (!(lo > 0) || !(hi > 0)) continue
      const head = clause.text.slice(0, m.index ?? 0)
      const window = WINDOW_BEFORE.test(head) || WINDOW_AFTER.test(clause.text.slice((m.index ?? 0) + m[0].length))
      let qualifier: string | null = null
      const count = [...head.matchAll(COUNT_RE)][0] ?? [...clause.text.matchAll(COUNT_RE)][0]
      if (count) qualifier = `${count[3] ?? ''} ${count[4] ?? ''}`
      else {
        const pricedOn = PRICED_ON_RE.exec(clause.text)
        if (pricedOn) qualifier = pricedOn[1] ?? ''
        else if (/\b(?:the\s+)?(?:kept|retained|remaining|priced)\s+(?:closed\s+)?(?:sales|set|comps|comparables|homes)\b/i.test(head)) qualifier = ''
      }
      if (qualifier == null) continue
      let readings: ClaimComp[][]
      const runs = properRuns(qualifier)
      if (runs.length > 0) {
        const r = subsetReadings(runs, args.priced, all)
        if (!r) continue
        readings = r
      } else {
        // The weight the count's verb states counts too: "were kept at full weight".
        const tier = countTier(qualifier, count ? clause.text.slice((count.index ?? 0) + count[0].length) : '')
        const resolved = resolveRangeQualifier(qualifier, args.priced)
        const base = resolved ? resolved.subset : [...args.priced]
        if (tier === 'mixed') continue
        if (tier === 'strong' || tier === 'weak') {
          if (!args.priced.every((c) => c.tier === 'strong' || c.tier === 'weak')) continue
          readings = [base.filter((c) => c.tier === tier)]
        } else if (narrowingQualifier(resolved ? resolved.rest : qualifier)) {
          continue
        } else {
          readings = [base]
        }
      }
      // A list of named sales as long as the count it follows is the set the
      // band describes, as well as whatever the qualifier reads as.
      const stated = count ? numOf(count[1]!) : null
      if (stated != null && named.size === stated) readings.push(args.priced.filter((c) => named.has(c.listingKey)))
      let described: { min: number; max: number; set: ClaimComp[] } | null = null
      let supported = false
      for (const set of readings) {
        if (set.length === 0) continue
        const values = set.map(ppsfOf)
        if (values.some((v) => v == null)) continue
        const vs = values as number[]
        const min = Math.min(...vs)
        const max = Math.max(...vs)
        described ??= { min, max, set }
        const fits = window
          ? vs.every((v) => v > lo - 1 && v < hi + 1)
          : Math.abs(lo - min) < 1 && Math.abs(hi - max) < 1
        if (fits) supported = true
      }
      if (supported || !described) continue
      out.push({
        kind: 'band',
        sentence,
        claim: window
          ? `The comparability narrative places the sales that price inside $${lo} to $${hi} per square foot, but they run $${Math.round(described.min)} to $${Math.round(described.max)}.`
          : `The comparability narrative states a $${lo} to $${hi} per square foot range for the sales that price, but they run $${Math.round(described.min)} to $${Math.round(described.max)}.`,
        evidence: `Closed $/sqft: ${described.set.map((c) => `${c.address} at $${Math.round(ppsfOf(c)!)}`).join(', ')}.`,
      })
    }
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
    out.push(...bandFindings(sentence, args, all, idents))
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

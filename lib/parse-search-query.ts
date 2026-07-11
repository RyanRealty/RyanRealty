/**
 * parse-search-query — the "speak plainly" translation layer.
 *
 * Registry-driven per CONTRACT-search-field-exposure (2026-07-11): phrase
 * matchers compile at module load from `lib/search/field-registry` voice +
 * voiceValues (word-boundary regex, longest-phrase-first), and every matched
 * span is consumed from the residual string so one phrase can't claim two
 * filters. Leftover words fall back to keywords. Deterministic,
 * dependency-free — not a semantic embedding engine.
 *
 *   "3-bedroom with mountain views under $600k in Bend"
 *     -> { beds: '3', hasView: '1', viewTypes: 'Mountain(s)', maxPrice: '600000', city: 'Bend' }
 *   "three bed under 800k in bend with a fireplace and a shop"
 *     -> { beds: '3', maxPrice: '800000', city: 'Bend', hasFireplace: '1', shop: '1' }
 *   "modern farmhouse"                 -> { keywords: 'modern farmhouse' }
 *   "redmond"                          -> { city: 'Redmond' }
 *
 * Returns a flat string map ready for `new URLSearchParams(...)`. Multi-select
 * values are CSV of canonical DB strings (the registry's option spellings).
 */

import { SEARCH_FIELDS } from '@/lib/search/field-registry'

export type ParsedSearch = Record<string, string>

// Central Oregon cities the structured filter understands (by display name).
// Longer/compound names first so "la pine" wins before a bare token match.
const CITY_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bla[\s-]?pine\b/i, 'La Pine'],
  [/\bpowell\s?butte\b/i, 'Powell Butte'],
  [/\bblack\s?butte\b/i, 'Sisters'],
  [/\bbend\b/i, 'Bend'],
  [/\bredmond\b/i, 'Redmond'],
  [/\bsisters\b/i, 'Sisters'],
  [/\bsunriver\b/i, 'Sunriver'],
  [/\bterrebonne\b/i, 'Terrebonne'],
  [/\bprineville\b/i, 'Prineville'],
  [/\bmadras\b/i, 'Madras'],
  [/\btumalo\b/i, 'Tumalo'],
  [/\bculver\b/i, 'Culver'],
]

// ---------------------------------------------------------------------------
// Phrase matchers compiled from the field registry
// ---------------------------------------------------------------------------

type PhraseAction =
  | { kind: 'boolean'; key: string }
  | { kind: 'multiValue'; key: string; value: string }
  | { kind: 'params'; params: Readonly<Record<string, string>> }

type CompiledMatcher = { phrase: string; re: RegExp; action: PhraseAction }

// Registry range-field voice entries with no `n` number slot compile to fixed
// values. The registry documents the phrase; the parser owns what it means.
const LITERAL_RANGE_PHRASE_PARAMS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'new this week': { daysOnMarket: '7' },
  'listed this month': { daysOnMarket: '30' },
  'low hoa': { hoaMonthlyMax: '150' },
}

// Grammar the contract adds beyond registry voice: sale status and property
// type words. 'manufactured' is deliberately absent — the registry's
// structureTypes voiceValues already claims it (-> Manufactured House).
const GRAMMAR_PHRASES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ['sold', { statusFilter: 'closed' }],
  ['pending', { statusFilter: 'pending' }],
  ['condo', { propertySubType: 'Condominium' }],
  ['condominium', { propertySubType: 'Condominium' }],
  ['townhome', { propertySubType: 'Townhouse' }],
  ['town home', { propertySubType: 'Townhouse' }],
  ['townhouse', { propertySubType: 'Townhouse' }],
  ['land', { propertyType: 'Land' }],
  ['house', { propertyType: 'Residential' }],
]

const ARTICLES = new Set(['a', 'an', 'the'])

/**
 * Compile a lowercase voice phrase to a word-boundary regex. Interior
 * articles are optional ("on a well" also matches "on well"), separators
 * accept hyphens ("walk in closet" matches "walk-in closet"), and the final
 * word tolerates a plural 's'.
 */
function phraseToRegex(phrase: string): RegExp {
  const words = phrase.split(/\s+/)
  const last = words.length - 1
  const parts = words.map((word, i) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (i > 0 && i < last && ARTICLES.has(word)) return `(?:${escaped}[\\s-]+)?`
    const body = i === last && !word.endsWith('s') ? `${escaped}s?` : escaped
    return i < last ? `${body}[\\s-]+` : body
  })
  return new RegExp(`\\b${parts.join('')}\\b`, 'g')
}

function buildMatchers(): CompiledMatcher[] {
  const matchers: CompiledMatcher[] = []
  const claimed = new Set<string>()

  // First registration wins a duplicate phrase (registry order), so e.g.
  // 'hot tub' resolves to interiorFeatures, not exteriorFeatures.
  const add = (rawPhrase: string, action: PhraseAction) => {
    const phrase = rawPhrase.trim().toLowerCase()
    if (!phrase || claimed.has(phrase)) return
    claimed.add(phrase)
    matchers.push({ phrase, re: phraseToRegex(phrase), action })
  }

  for (const field of SEARCH_FIELDS) {
    if (field.kind === 'boolean') {
      for (const phrase of field.voice ?? []) add(phrase, { kind: 'boolean', key: field.key })
    } else if (field.kind === 'multi') {
      // Field-level voice on a multi (e.g. accessibilityFeatures 'accessible')
      // has no option target, so it intentionally falls through to keywords.
      for (const [option, synonyms] of Object.entries(field.voiceValues ?? {})) {
        for (const phrase of synonyms) add(phrase, { kind: 'multiValue', key: field.key, value: option })
      }
    } else if (field.kind === 'range') {
      for (const phrase of field.voice ?? []) {
        if (/\bn\b/.test(phrase)) continue // number-slot grammar runs in the numeric pass
        const params = LITERAL_RANGE_PHRASE_PARAMS[phrase]
        if (params) add(phrase, { kind: 'params', params })
      }
    }
  }
  for (const [phrase, params] of GRAMMAR_PHRASES) add(phrase, { kind: 'params', params })

  // Longest phrase first: 'on the golf course' beats 'golf course' beats 'golf'.
  return matchers.sort((a, b) => b.phrase.length - a.phrase.length)
}

const MATCHERS = buildMatchers()

// ---------------------------------------------------------------------------
// Spoken numbers -> digits ("three bed", "eight hundred k")
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const MULTIPLIER_WORDS: Readonly<Record<string, number>> = {
  hundred: 100, thousand: 1_000, million: 1_000_000,
}

const NUMBER_RUN_RE = new RegExp(
  `\\b(?:(?:${[...Object.keys(NUMBER_WORDS), ...Object.keys(MULTIPLIER_WORDS)].join('|')})\\b[\\s-]*)+`,
  'g',
)

function evaluateNumberRun(run: string): number {
  let total = 0
  let current = 0
  for (const token of run.split(/[\s-]+/).filter(Boolean)) {
    const n = NUMBER_WORDS[token]
    if (n != null) {
      current += n
      continue
    }
    const mult = MULTIPLIER_WORDS[token]
    if (mult === 100) current = (current || 1) * 100
    else if (mult != null) {
      total += (current || 1) * mult
      current = 0
    }
  }
  return total + current
}

function numberWordsToDigits(text: string): string {
  return text.replace(NUMBER_RUN_RE, (run) => {
    const trailing = run.match(/[\s-]*$/)?.[0] ?? ''
    return `${evaluateNumberRun(run)}${trailing || ' '}`
  })
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

const MONEY_UNIT = '(k|m|thousand|million|grand)'

function parseMoney(numStr: string, unit?: string): number | null {
  const n0 = parseFloat(numStr.replace(/[,$\s]/g, ''))
  if (!Number.isFinite(n0)) return null
  let n = n0
  const u = (unit || '').toLowerCase()
  if (u === 'k' || u === 'thousand' || u === 'grand') n *= 1_000
  else if (u === 'm' || u === 'million') n *= 1_000_000
  else if (n < 10_000) n *= 1_000 // bare "800" in a price context means $800k
  return Math.round(n)
}

/** Plain dollar amount — no bare-thousands heuristic (HOA dues, taxes, monthly payment). */
function parseAmount(numStr: string, unit?: string): number | null {
  const n0 = parseFloat(numStr.replace(/[,$\s]/g, ''))
  if (!Number.isFinite(n0)) return null
  const u = (unit || '').toLowerCase()
  const n = u === 'k' || u === 'thousand' ? n0 * 1_000 : n0
  return Math.round(n)
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

type WorkState = { work: string }

/** Run a regex once against the working string, consume the span, apply groups. */
function take(state: WorkState, re: RegExp, apply: (m: RegExpMatchArray) => void): void {
  const m = state.work.match(re)
  if (!m || m.index == null) return
  apply(m)
  state.work =
    state.work.slice(0, m.index) + ' '.repeat(m[0].length) + state.work.slice(m.index + m[0].length)
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'by', 'for', 'from', 'has', 'have', 'home', 'homes',
  'i', 'in', 'is', 'it', 'looking', 'me', 'my', 'near', 'need', 'of', 'on', 'or',
  'over', 'please', 'show', 'that', 'the', 'to', 'under', 'want', 'we', 'with',
])

export function parseSearchQuery(raw: string): ParsedSearch {
  const q = (raw || '').trim()
  const out: ParsedSearch = {}
  if (!q) return out

  const state: WorkState = { work: q.toLowerCase() }
  const multiValues = new Map<string, string[]>()

  // "55+" has no trailing word boundary after '+', so the phrase matcher can
  // never fire on it — rewrite to the word form the registry synonym matches
  // (attack finding 2026-07-11).
  state.work = state.work.replace(/\b55\s*\+/g, '55 plus')

  // Pass 1 — registry phrases, longest first, consuming matched spans. Runs
  // before number normalization so 'one level' / 'two story' stay phrases.
  for (const { re, action } of MATCHERS) {
    let matched = false
    re.lastIndex = 0
    state.work = state.work.replace(re, (m) => {
      matched = true
      return ' '.repeat(m.length)
    })
    if (!matched) continue
    if (action.kind === 'boolean') {
      out[action.key] = '1'
    } else if (action.kind === 'multiValue') {
      const values = multiValues.get(action.key) ?? []
      if (!values.includes(action.value)) values.push(action.value)
      multiValues.set(action.key, values)
      // A specific view type implies a view — keeps 'mountain views' working
      // for the broader hasView filter alongside the viewTypes narrowing.
      if (action.key === 'viewTypes') out.hasView = '1'
    } else {
      Object.assign(out, action.params)
    }
  }

  // Pass 2 — spoken numbers become digits ("three bed" -> "3 bed").
  const MULT = (u: string) => (u === 'million' ? 1_000_000 : u === 'hundred' ? 100 : 1_000)
  // "between X and Y <unit>" — the unit trails Y but governs BOTH bounds, so
  // scale them together BEFORE the generic pass collapses only Y ("between 1
  // and 2 million" would otherwise leave "1" bare -> $1,000; attack finding
  // 2026-07-11).
  state.work = state.work.replace(
    /\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)[\s-]+(million|thousand|hundred|grand)\b/g,
    (_m, lo: string, hi: string, unit: string) => {
      const l = Number(lo), h = Number(hi)
      if (!Number.isFinite(l) || !Number.isFinite(h)) return _m
      return `between ${Math.round(l * MULT(unit))} and ${Math.round(h * MULT(unit))}`
    }
  )
  // Digit + multiplier word collapses FIRST ("1.5 million" -> "1500000");
  // otherwise the word-number pass rewrites the bare multiplier on its own and
  // the money grammar reads "1.5" as $1,500 (review finding 2026-07-11).
  state.work = state.work.replace(
    /(\d+(?:\.\d+)?)[\s-]+(million|thousand|hundred|grand)\b/g,
    (_m, num: string, unit: string) => {
      const n = Number(num)
      if (!Number.isFinite(n)) return _m
      return String(Math.round(n * MULT(unit)))
    }
  )
  // "a million" / "half a million" have no leading digit.
  state.work = state.work
    .replace(/\bhalf\s+a\s+million\b/g, '500000')
    .replace(/\ba\s+million\b/g, '1000000')
  state.work = numberWordsToDigits(state.work)

  // Pass 3 — unit-anchored numeric grammar (must run before the bare price
  // qualifiers so "over 2000 square feet" never reads as a $2M floor).
  take(state, /(\d+)\s*-?\s*\+?\s*(?:bedrooms?|beds?|bd|br)\b/, (m) => {
    out.beds = m[1]
  })
  take(state, /(\d+(?:\.\d)?)\s*-?\s*\+?\s*(?:bathrooms?|baths?|ba)\b/, (m) => {
    out.baths = String(Math.max(1, Math.floor(parseFloat(m[1]))))
  })
  take(state, /(\d+)\s*\+?\s*car\s*garage/, (m) => {
    out.garageMin = m[1]
  })
  // Loop so BOTH bounds get consumed ("over 2000 sqft under 3000 sqft"); a
  // single take() would leave "under 3000 sqft" for the price pass to misread
  // as $3,000,000 (attack finding 2026-07-11).
  {
    const sqftRe = /(?:(under|below|less than|up to|over|above|more than|at least)\s+)?([\d,]+)\s*\+?\s*(?:square\s*(?:feet|foot|ft)|sq\.?\s*ft\.?|sqft)\b/
    for (let i = 0; i < 2 && sqftRe.test(state.work); i++) {
      take(state, sqftRe, (m) => {
        const v = String(parseInt(m[2].replace(/,/g, ''), 10))
        if (m[1] && /^(under|below|less than|up to)$/.test(m[1])) out.maxSqFt = v
        else out.minSqFt = v
      })
    }
  }
  take(
    state,
    /(?:(under|below|less than|up to|over|above|more than|at least)\s+)?(\d+(?:\.\d+)?)\s*\+?\s*acres?\b/,
    (m) => {
      if (m[1] && /^(under|below|less than|up to)$/.test(m[1])) out.lotAcresMax = m[2]
      else out.lotAcresMin = m[2]
    },
  )
  take(state, /\bbuilt\s+(?:after|since)\s+(\d{4})\b/, (m) => {
    out.yearBuiltMin = m[1]
  })
  take(state, /\bbuilt\s+before\s+(\d{4})\b/, (m) => {
    out.yearBuiltMax = m[1]
  })
  take(state, /\bnewer\s+than\s+(\d{4})\b/, (m) => {
    out.yearBuiltMin = m[1]
  })
  take(state, /\b(\d{4})\s+or\s+newer\b/, (m) => {
    out.yearBuiltMin = m[1]
  })
  take(
    state,
    /\bhoa\s+(?:dues\s+|fees?\s+)?(?:under|below|less than|max)\s+\$?\s*([\d,]+)(?:\s*(?:a|per)\s+month)?\b/,
    (m) => {
      const v = parseAmount(m[1])
      if (v) out.hoaMonthlyMax = String(v)
    },
  )
  take(
    state,
    new RegExp(
      `\\b(?:property\\s+)?tax(?:es)?\\s+(?:under|below|less than)\\s+\\$?\\s*([\\d,]+)\\s*${MONEY_UNIT}?(?:\\s*(?:a|per)\\s+year)?\\b`,
    ),
    (m) => {
      const v = parseAmount(m[1], m[2])
      if (v) out.taxAnnualMax = String(v)
    },
  )
  take(
    state,
    /\b(?:(?:monthly\s+)?payments?\s+)?(?:under|below|less than|afford)\s+\$?\s*([\d,]+)\s*(?:a|per)\s+month\b/,
    (m) => {
      const v = parseAmount(m[1])
      if (v) out.monthlyPaymentMax = String(v)
    },
  )

  // Pass 4 — price (between, then max, then min).
  take(
    state,
    new RegExp(`\\bbetween\\s+\\$?\\s*([\\d,.]+)\\s*${MONEY_UNIT}?\\s+and\\s+\\$?\\s*([\\d,.]+)\\s*${MONEY_UNIT}?\\b`),
    (m) => {
      // "between 1 and 2 million" — the low bound has no unit; inherit the
      // high bound's so it is not read as $1,000 (attack finding 2026-07-11).
      const loUnit = m[2] || m[4]
      const lo = parseMoney(m[1], loUnit)
      const hi = parseMoney(m[3], m[4])
      if (lo) out.minPrice = String(lo)
      if (hi) out.maxPrice = String(hi)
    },
  )
  take(
    state,
    new RegExp(`(?:under|below|less than|up to|max|cheaper than|<)\\s*\\$?\\s*([\\d,.]+)\\s*${MONEY_UNIT}?\\b`),
    (m) => {
      const v = parseMoney(m[1], m[2])
      if (v) out.maxPrice = String(v)
    },
  )
  take(
    state,
    new RegExp(`(?:over|above|more than|at least|starting at|from|min|>)\\s*\\$?\\s*([\\d,.]+)\\s*${MONEY_UNIT}?\\b`),
    (m) => {
      const v = parseMoney(m[1], m[2])
      if (v) out.minPrice = String(v)
    },
  )

  // Pass 5 — city.
  for (const [re, name] of CITY_PATTERNS) {
    let matched = false
    state.work = state.work.replace(re, (m) => {
      matched = true
      return ' '.repeat(m.length)
    })
    if (matched) {
      out.city = name
      break
    }
  }

  // Inverted ranges make a search match nothing forever ("over 500k under
  // 400k"). Drop the smaller-than-floor ceiling rather than emit a dead
  // search (attack finding 2026-07-11).
  const rangePairs: [string, string][] = [
    ['minPrice', 'maxPrice'], ['beds', 'maxBeds'], ['baths', 'maxBaths'],
    ['minSqFt', 'maxSqFt'], ['lotAcresMin', 'lotAcresMax'],
    ['yearBuiltMin', 'yearBuiltMax'],
  ]
  for (const [lo, hi] of rangePairs) {
    if (out[lo] != null && out[hi] != null && Number(out[lo]) > Number(out[hi])) {
      delete out[hi]
    }
  }

  // Merge multi-select values as CSV of canonical DB strings.
  for (const [key, values] of multiValues) out[key] = values.join(',')

  // Residual — leftover meaningful words become a keyword text match
  // ('remodeled' and 'acreage' stay keyword-able by design).
  const structured = Object.keys(out).some((k) => k !== 'keywords')
  if (structured) {
    const residual = state.work.split(/[^a-z0-9']+/).filter((t) => t && !STOP_WORDS.has(t))
    if (residual.length) out.keywords = residual.join(' ')
  } else {
    // Nothing structured matched — send the raw query for a text match
    // instead of returning the entire unfiltered inventory.
    out.keywords = q
  }

  return out
}

// ---------------------------------------------------------------------------
// Human-readable summary chips (voice confirmation UI)
// ---------------------------------------------------------------------------

function usd(value: string): string {
  const n = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? `$${n.toLocaleString('en-US')}` : `$${value}`
}

function int(value: string): string {
  const n = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n.toLocaleString('en-US') : value
}

/** Summary chips for a parsed query: 'Fireplace', 'Under $800,000', 'Bend'. */
export function describeParsedSearch(parsed: ParsedSearch): string[] {
  const chips: string[] = []

  // Registry booleans and multis, in registry order.
  for (const field of SEARCH_FIELDS) {
    if (field.kind === 'boolean' && parsed[field.key] === '1') {
      // A named view type already implies the broader view chip.
      if (field.key === 'hasView' && parsed.viewTypes) continue
      chips.push(field.label)
    } else if (field.kind === 'multi' && parsed[field.key]) {
      for (const value of parsed[field.key].split(',').filter(Boolean)) chips.push(value)
    }
  }

  if (parsed.beds) chips.push(`${parsed.beds}+ beds`)
  if (parsed.maxBeds) chips.push(`Up to ${parsed.maxBeds} beds`)
  if (parsed.baths) chips.push(`${parsed.baths}+ baths`)
  if (parsed.maxBaths) chips.push(`Up to ${parsed.maxBaths} baths`)
  if (parsed.minPrice && parsed.maxPrice) chips.push(`${usd(parsed.minPrice)} to ${usd(parsed.maxPrice)}`)
  else if (parsed.maxPrice) chips.push(`Under ${usd(parsed.maxPrice)}`)
  else if (parsed.minPrice) chips.push(`Over ${usd(parsed.minPrice)}`)
  if (parsed.minSqFt && parsed.maxSqFt) chips.push(`${int(parsed.minSqFt)} to ${int(parsed.maxSqFt)} sqft`)
  else if (parsed.minSqFt) chips.push(`${int(parsed.minSqFt)}+ sqft`)
  else if (parsed.maxSqFt) chips.push(`Under ${int(parsed.maxSqFt)} sqft`)
  if (parsed.lotAcresMin) chips.push(`${parsed.lotAcresMin}+ acres`)
  if (parsed.lotAcresMax) chips.push(`Under ${parsed.lotAcresMax} acres`)
  if (parsed.yearBuiltMin) chips.push(`Built after ${parsed.yearBuiltMin}`)
  if (parsed.yearBuiltMax) chips.push(`Built before ${parsed.yearBuiltMax}`)
  if (parsed.garageMin) chips.push(`${parsed.garageMin}+ car garage`)
  if (parsed.hoaMonthlyMax) chips.push(`HOA under ${usd(parsed.hoaMonthlyMax)} a month`)
  if (parsed.taxAnnualMax) chips.push(`Taxes under ${usd(parsed.taxAnnualMax)} a year`)
  if (parsed.monthlyPaymentMax) chips.push(`Under ${usd(parsed.monthlyPaymentMax)} a month`)
  if (parsed.daysOnMarket) chips.push(`Listed in the last ${parsed.daysOnMarket} days`)

  if (parsed.statusFilter === 'closed') chips.push('Sold')
  else if (parsed.statusFilter === 'pending') chips.push('Pending')
  if (parsed.propertySubType) chips.push(parsed.propertySubType)
  if (parsed.propertyType) chips.push(parsed.propertyType)
  if (parsed.city) chips.push(parsed.city)
  if (parsed.keywords) chips.push(parsed.keywords)

  return chips
}

/** Build the /homes-for-sale URL for a plain-language query. */
export function searchHrefForQuery(raw: string): string {
  const parsed = parseSearchQuery(raw)
  // /homes-for-sale speaks status=Active|Pending|Sold; the parser's canonical
  // statusFilter vocab would be silently ignored there ("sold homes in bend"
  // showing active homes — review finding 2026-07-11).
  const { statusFilter, ...rest } = parsed
  if (statusFilter === 'closed') rest.status = 'Sold'
  else if (statusFilter === 'pending') rest.status = 'Pending'
  const params = new URLSearchParams(rest)
  const qs = params.toString()
  return qs ? `/homes-for-sale?${qs}` : '/homes-for-sale'
}

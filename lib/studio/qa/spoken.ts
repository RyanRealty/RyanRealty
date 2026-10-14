/**
 * lib/studio/qa/spoken.ts - pure text helpers for the caption and number checks.
 *
 * Captions show digits ("63% CUT") while an ElevenLabs v3 script spells numbers
 * out ("sixty three percent"), so check 8 cannot compare strings. It aligns the
 * caption's tokens to the spoken words, and a number token matches only when the
 * spoken number words really parse to the same value. A caption that says 63%
 * over a voice that says sixty four percent fails.
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const SCALES: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 }
const PERCENT_WORDS = new Set(['percent'])
const DOLLAR_WORDS = new Set(['dollar', 'dollars'])

/**
 * "and a half" closes a spoken number ("three and a half" is 3.5), so "a" and
 * "half" may sit inside a run of number words. They parse only in that tail.
 */
const HALF_TAIL = ['and', 'a', 'half'] as const

/**
 * Quantity words (F4, 2026-10-14): a ratio, a fraction or a dozen said in words
 * is a figure too. Each maps to a value ("doubled" is 2 times, "a quarter" is
 * one in four, "a dozen" is 12) that must be shown as a sourced figure, or is a
 * quantity with no single figure ("most", "dozens", "hundreds of") and refused.
 */
const RATIO_WORDS: Record<string, number> = {
  doubled: 2, doubling: 2, twice: 2, tripled: 3, tripling: 3, thrice: 3, quadrupled: 4, halved: 0.5, halving: 0.5,
}
const FRACTION_WORDS: Record<string, number> = { half: 2, halves: 2, third: 3, thirds: 3, quarter: 4, quarters: 4 }
const DOZEN_WORDS = new Set(['dozen'])
const VAGUE_WORDS = new Set(['dozens', 'hundreds', 'thousands', 'millions', 'most', 'majority'])
const QUANTITY_WORDS = new Set([...Object.keys(RATIO_WORDS), ...Object.keys(FRACTION_WORDS), ...DOZEN_WORDS, ...VAGUE_WORDS])

const NUMBER_WORDS = new Set([
  ...Object.keys(UNITS), ...Object.keys(TEENS), ...Object.keys(TENS), ...Object.keys(SCALES),
  'hundred', 'point', 'and', 'a', 'half', ...PERCENT_WORDS, ...DOLLAR_WORDS, ...QUANTITY_WORDS,
])

export function isNumberWord(token: string): boolean {
  return NUMBER_WORDS.has(token)
}

/**
 * Lowercase word tokens. Curly apostrophes become straight, hyphens split a
 * word ("sixty-three" is two tokens), and anything but letters, digits and the
 * characters % $ . , ' is dropped. Edge punctuation is trimmed.
 */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[-\u2010\u2011\u2013\u2014]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9%$.,']/g, '').replace(/^[.,']+|[.,']+$/g, ''))
    .filter((t) => t.length > 0)
}

type Kind = 'start' | 'unit' | 'teen' | 'tens' | 'hundred' | 'scale'

/** Parse spoken whole-number words ("four hundred seventy five thousand"). Null when it is not one. */
function parseCardinal(tokens: string[]): number | null {
  if (tokens.length === 0) return null
  let total = 0
  let group = 0
  let prev: Kind = 'start'
  for (const t of tokens) {
    if (t === 'and') {
      if (prev !== 'hundred' && prev !== 'scale') return null
      continue
    }
    if (t in UNITS) {
      if (prev === 'unit' || prev === 'teen') return null
      if (UNITS[t] === 0 && tokens.length > 1) return null
      group += UNITS[t]
      prev = 'unit'
    } else if (t in TEENS) {
      if (prev === 'unit' || prev === 'teen' || prev === 'tens') return null
      group += TEENS[t]
      prev = 'teen'
    } else if (t in TENS) {
      if (prev === 'unit' || prev === 'teen' || prev === 'tens') return null
      group += TENS[t]
      prev = 'tens'
    } else if (t === 'hundred') {
      if (prev !== 'unit' && prev !== 'teen') return null
      group *= 100
      prev = 'hundred'
    } else if (t in SCALES) {
      if (group === 0) return null
      total += group * SCALES[t]
      group = 0
      prev = 'scale'
    } else {
      return null
    }
  }
  return total + group
}

/** "twenty twenty six" is 2026. First chunk 19 or 20, second chunk 10 to 99. */
function parseYear(tokens: string[]): number | null {
  for (let split = 1; split < tokens.length; split++) {
    const a = parseCardinal(tokens.slice(0, split))
    const b = parseCardinal(tokens.slice(split))
    if ((a === 19 || a === 20) && b !== null && b >= 10 && b <= 99) return a * 100 + b
  }
  return null
}

/** "ratio": a multiple or a fraction said in words ("doubled" is 2, "a quarter" is 0.25). */
export type NumberUnit = 'percent' | 'dollar' | 'ratio' | null

export interface SpokenNumber {
  /** Every reading that fits (a plain count, or a spoken year). Empty for a vague quantity. */
  values: number[]
  unit: NumberUnit
  /** A quantity with no single figure ("most", "dozens", "hundreds of"): never shown as a figure. */
  vague?: true
}

/** A quantity phrase: a ratio word, a fraction ("a third", "two thirds"), a dozen, or a vague quantity. Null otherwise. */
function parseQuantity(tokens: string[]): SpokenNumber | null {
  if (tokens.length === 1) {
    const [t] = tokens
    if (t in RATIO_WORDS) return { values: [RATIO_WORDS[t]], unit: 'ratio' }
    if (VAGUE_WORDS.has(t)) return { values: [], unit: null, vague: true }
    if (t === 'half') return { values: [0.5], unit: 'ratio' }
    if (t === 'dozen') return { values: [12], unit: null }
    return null
  }
  if (tokens.length === 2 && tokens[0] === 'a' && tokens[1] === 'majority') return { values: [], unit: null, vague: true }
  const last = tokens[tokens.length - 1]
  const head = tokens.slice(0, -1)
  const count = head.length === 1 && (head[0] === 'a' || head[0] === 'an') ? 1 : parseCardinal(head)
  if (count === null || count <= 0) return null
  if (last === 'dozen') return { values: [count * 12], unit: null }
  if (last in FRACTION_WORDS) {
    const plural = last.endsWith('s')
    if (plural !== count > 1) return null
    return { values: [Math.round((count / FRACTION_WORDS[last]) * 1e6) / 1e6], unit: 'ratio' }
  }
  return null
}

/** Parse a run of spoken number words, with an optional trailing percent or dollars, or a quantity phrase. */
export function parseSpokenNumber(tokens: string[]): SpokenNumber | null {
  const quantity = parseQuantity(tokens)
  if (quantity) return quantity
  if (tokens.some((t) => QUANTITY_WORDS.has(t) && t !== 'half')) return null
  let body = tokens
  let unit: NumberUnit = null
  const last = tokens[tokens.length - 1]
  if (last !== undefined && PERCENT_WORDS.has(last)) {
    unit = 'percent'
    body = tokens.slice(0, -1)
  } else if (last !== undefined && DOLLAR_WORDS.has(last)) {
    unit = 'dollar'
    body = tokens.slice(0, -1)
  }
  if (body.length === 0) return null
  // "<number> and a half": the number plus one half, nothing else.
  const n = body.length
  if (n > HALF_TAIL.length && HALF_TAIL.every((w, i) => body[n - HALF_TAIL.length + i] === w)) {
    const whole = parseCardinal(body.slice(0, n - HALF_TAIL.length))
    return whole === null ? null : { values: [whole + 0.5], unit }
  }
  const point = body.indexOf('point')
  if (point >= 0) {
    const whole = point === 0 ? 0 : parseCardinal(body.slice(0, point))
    let rest = body.slice(point + 1)
    let scale = 1
    const tail = rest[rest.length - 1]
    if (tail !== undefined && tail in SCALES) {
      scale = SCALES[tail]
      rest = rest.slice(0, -1)
    }
    if (whole === null || rest.length === 0 || !rest.every((t) => t in UNITS)) return null
    const frac = Number('0.' + rest.map((t) => UNITS[t]).join(''))
    return { values: [Math.round((whole + frac) * scale * 1e6) / 1e6], unit }
  }
  const values: number[] = []
  const card = parseCardinal(body)
  if (card !== null) values.push(card)
  const year = parseYear(body)
  if (year !== null) values.push(year)
  return values.length > 0 ? { values, unit } : null
}

export interface CaptionNumber {
  value: number
  unit: NumberUnit
  /** Decimal places as shown ("33%" has 0), so a fraction said in words may round to it. */
  decimals: number
}

/** "$475K" gives 475000 dollars; "63%" gives 63 percent; "2x" gives a ratio of 2; "1,250" gives 1250. Null when not numeric. */
export function parseCaptionNumber(token: string): CaptionNumber | null {
  const m = /^(\$)?(\d[\d,]*(?:\.(\d+))?)(%|k|m|x)?$/i.exec(token)
  if (!m) return null
  let value = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  const suffix = (m[4] ?? '').toLowerCase()
  if (suffix === 'k') value *= 1e3
  if (suffix === 'm') value *= 1e6
  value = Math.round(value * 1e6) / 1e6
  const unit: NumberUnit = suffix === '%' ? 'percent' : suffix === 'x' ? 'ratio' : m[1] ? 'dollar' : null
  return { value, unit, decimals: suffix === 'k' || suffix === 'm' ? 6 : (m[3] ?? '').length }
}

/**
 * Does a shown figure say this spoken number? The same value in the same unit;
 * a ratio said in words ("doubled", "a third") may also be shown as a percent,
 * rounded as shown: a share (a third as "33%") or, above 1, a change ("doubled"
 * as "100%"). A vague quantity is never shown by a figure.
 */
export function shownSays(shown: CaptionNumber, spoken: Pick<SpokenNumber, 'values' | 'unit' | 'vague'>): boolean {
  if (spoken.vague) return false
  const tol = Math.max(1e-6, 0.5 * 10 ** -shown.decimals)
  const near = (v: number) => Math.abs(v - shown.value) <= tol + 1e-9
  if (shown.unit === spoken.unit) return spoken.values.some((v) => (spoken.unit === 'ratio' ? near(v) : sameValue(v, shown.value)))
  if (spoken.unit === 'ratio' && shown.unit === 'percent') return spoken.values.some((v) => near(v * 100) || (v > 1 && near((v - 1) * 100)))
  return false
}

export interface AlignResult {
  ok: boolean
  detail: string
}

/**
 * Does the caption show exactly the spoken words? Plain words must equal. A
 * number token must equal the same token spoken as digits, or the spoken number
 * words that parse to its value and unit.
 */
export function alignCaption(captionText: string, spokenWords: string[]): AlignResult {
  const cap = tokenizeWords(captionText)
  const spoken = spokenWords.flatMap((w) => tokenizeWords(w))
  let j = 0
  for (const ct of cap) {
    if (spoken[j] === ct) {
      j++
      continue
    }
    const want = /\d/.test(ct) ? parseCaptionNumber(ct) : null
    if (!want) return { ok: false, detail: `caption word "${ct}" does not match spoken "${spoken[j] ?? '(nothing left)'}"` }
    let run = 0
    while (j + run < spoken.length && isNumberWord(spoken[j + run])) run++
    let matched = 0
    for (let k = run; k >= 1; k--) {
      const got = parseSpokenNumber(spoken.slice(j, j + k))
      if (got && shownSays(want, got)) {
        matched = k
        break
      }
    }
    if (matched === 0) {
      return { ok: false, detail: `caption figure "${ct}" is not what is spoken ("${spoken.slice(j, j + Math.max(run, 1)).join(' ') || '(nothing left)'}")` }
    }
    j += matched
  }
  if (j < spoken.length) return { ok: false, detail: `spoken "${spoken.slice(j).join(' ')}" is not in the caption` }
  return { ok: true, detail: '' }
}

// ---------------------------------------------------------------------------
// Number tokens on screen (check 9)

const LOCKED_PHONE = /(?:\+?1[\s.-]*)?\(?541\)?[\s.-]*703[\s.-]*3095/g

/**
 * Unit words a figure carries, each with the one form two figures compare by
 * (F3, 2026-10-14): "3.5 days" is not "3.5 months", "4 homes" is not "4 sales".
 * Plurals and abbreviations fold together ("month", "months", "mo" are "mo").
 */
const UNIT_FORMS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['%', ['percent', 'per cent', 'pct']],
  ['mo', ['months', 'month', 'mos', 'mo']],
  ['days', ['days', 'day']],
  ['weeks', ['weeks', 'week', 'wks', 'wk']],
  ['years', ['years', 'year', 'yrs', 'yr']],
  ['hours', ['hours', 'hour', 'hrs', 'hr']],
  ['minutes', ['minutes', 'minute', 'mins', 'min']],
  ['homes', ['homes', 'home', 'houses', 'house', 'properties', 'property', 'condos', 'condo', 'townhomes', 'townhome']],
  ['sales', ['sales', 'sale', 'closings', 'closing']],
  ['listings', ['listings', 'listing']],
  ['offers', ['offers', 'offer']],
  ['showings', ['showings', 'showing']],
  ['buyers', ['buyers', 'buyer']],
  ['sellers', ['sellers', 'seller']],
  ['people', ['people', 'persons', 'person', 'residents', 'resident']],
  ['cuts', ['price cuts', 'price cut', 'cuts', 'reductions', 'reduction']],
  ['beds', ['bedrooms', 'bedroom', 'beds', 'bed', 'bds', 'bd', 'br']],
  ['baths', ['bathrooms', 'bathroom', 'baths', 'bath', 'ba']],
  ['sqft', ['square feet', 'square foot', 'sq ft', 'sq. ft.', 'sq. ft', 'sqft', 'sf']],
  ['acres', ['acres', 'acre', 'ac']],
  ['miles', ['miles', 'mile', 'mi']],
  ['lots', ['lots', 'lot']],
  ['units', ['units', 'unit']],
  ['permits', ['permits', 'permit']],
  ['jobs', ['jobs', 'job']],
  ['neighborhoods', ['neighborhoods', 'neighborhood', 'subdivisions', 'subdivision']],
  ['points', ['basis points', 'points', 'point', 'pts', 'bps']],
  ['times', ['times', 'x']],
]
const UNIT_OF = new Map<string, string>()
for (const [form, words] of UNIT_FORMS) for (const w of words) UNIT_OF.set(w, form)
const UNIT_ALTERNATION = [...UNIT_OF.keys()]
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.]/g, '\\.').replace(/ /g, '\\s+'))
  .join('|')
/** One describing word may sit between a figure and its unit ("714 active listings", "4 more days"). */
const BETWEEN = ['active', 'new', 'pending', 'closed', 'sold', 'more', 'fewer', 'less', 'straight', 'consecutive', 'total', 'open', 'whole', 'full', 'single-family', 'detached', 'local']
const UNIT_AFTER = new RegExp(`^(?:\\s*%|\\s*(?:(?:${BETWEEN.join('|')})\\s+)?(${UNIT_ALTERNATION})(?![A-Za-z0-9]))`, 'i')
const GLUED_UNIT = /^(mos?|x)(?![A-Za-z0-9])/i
const FIGURE_CORE = /(?<![A-Za-z0-9$#])(?<!\d[.,])([#$]?)(\d[\d,]*(?:\.\d+)?)([KkMm](?![A-Za-z]))?/g

/** The one form of a unit word ("Months" is "mo"), or null when it is not one. */
export function unitForm(word: string): string | null {
  return UNIT_OF.get(word.toLowerCase().replace(/\s+/g, ' ')) ?? null
}

/** The first unit word in a piece of prose (a row's definition), as its one form, or null. */
export function firstUnitIn(text: string): string | null {
  const m = new RegExp(`(?<![A-Za-z0-9])(${UNIT_ALTERNATION})(?![A-Za-z0-9])`, 'i').exec(normalizeDigits(text).replace(/[-\u2010\u2011]/g, ' '))
  return m ? unitForm(m[1]) : null
}

/** Fullwidth and other compatibility digits ("１２％") read as the digits they are. */
export function normalizeDigits(text: string): string {
  return text.normalize('NFKC')
}

/**
 * Number tokens in a string, each WITH its own unit, in one form, so a row
 * covers a token only when they are the same figure in the same unit: "$475K"
 * is not "$475", "4 mo" is not "4", "3.5 days" is not "3.5 mo". A token is
 * digits with an optional leading $ or # (a rank: "#1"), thousands commas, a
 * decimal part and K or M, then its unit: "%" or a unit word (UNIT_FORMS),
 * with at most one describing word between ("714 active listings" is
 * "714 listings"). Fullwidth digits count. The locked end card phone number is
 * not a figure and is skipped. A digit glued to a letter on its left (Q3, H2)
 * is part of a word, not a figure; a digit after punctuation glued to a word
 * ("fell,12%") is a figure.
 */
export function extractNumberTokens(text: string): string[] {
  const cleaned = normalizeDigits(text).replace(LOCKED_PHONE, ' ')
  const out: string[] = []
  for (const m of cleaned.matchAll(FIGURE_CORE)) {
    const number = m[2].replace(/[.,]+$/, '')
    const core = `${m[1]}${number}${m[3] ?? ''}`
    const rest = cleaned.slice(m.index! + m[0].length)
    let unit = ''
    const glued = m[3] ? null : GLUED_UNIT.exec(rest)
    const after = UNIT_AFTER.exec(rest)
    if (glued) unit = unitForm(glued[1]) ?? ''
    else if (after) unit = after[1] ? (unitForm(after[1]) ?? '') : '%'
    out.push(unit === '%' ? `${core}%` : unit ? `${core} ${unit}` : core)
  }
  return out
}

/** A figure token split into its number ("$475K", "#1", "3.5") and its unit ("%", "mo", or ""). */
export function splitFigure(token: string): { num: string; unit: string } {
  const m = /^([#$]?\d[\d,]*(?:\.\d+)?(?:[KkMm])?)(%|\s+(.+))?$/.exec(token.trim())
  if (!m) return { num: token.trim(), unit: '' }
  return { num: m[1], unit: m[2] === '%' ? '%' : (m[3] ?? '').toLowerCase() }
}

/** Case and space insensitive form of a figure token: two tokens cover each other only when these are equal. */
export function squash(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

// ---------------------------------------------------------------------------
// Spoken figures (check 9): a number said in words is a figure too

/**
 * Ordinal words are figures too ("the third month in a row"). "first" and
 * "second" are not read as figures: "first" is on the allowlist below and
 * "second" is far more often the unit of time ("give it a second").
 */
const ORDINALS: Record<string, number> = {
  third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
  seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, fortieth: 40,
  fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90, hundredth: 100,
}

/**
 * Number words that are not a statistic, each with the words around it that
 * make it so. Kept short on purpose: anything else said as a number must be
 * shown as a sourced figure. Each entry has its own test (spoken.test.ts).
 *  - "one of", "one more": a member of a set, not a count.
 *  - "this one", "the one", "no one", "that one": a pronoun.
 *  - "the most", "at most" (and "Bend's most"): a superlative, not a share.
 *  - "last quarter", "this quarter": a stretch of the year, not a fraction.
 *  - "first" and "second" are never read as figures (see ORDINALS).
 */
export const NON_STATISTICAL_SPOKEN: ReadonlyArray<{ word: string; before?: readonly string[]; after?: readonly string[] }> = [
  { word: 'one', after: ['of', 'more'] },
  { word: 'one', before: ['this', 'the', 'no', 'that'] },
  // "the most popular", "at most": a superlative, not a share.
  { word: 'most', before: ['the', 'at'] },
  // "last quarter", "this quarter": a stretch of the year, not a fraction.
  { word: 'quarter', before: ['last', 'this', 'next', 'the', 'each', 'per', 'every', 'first', 'second', 'third', 'fourth', 'fiscal'] },
]

export interface SpokenFigure {
  /** Indices into the words given, first and last. */
  first: number
  last: number
  /** The words as said ("twelve percent"). */
  said: string
  /** Every value the words can mean (a count, or a spoken year). Empty for a vague quantity. */
  values: number[]
  unit: NumberUnit
  /** A quantity with no single figure ("most", "dozens", "hundreds of"): refused, never shown. */
  vague?: true
}

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

/** Where the locked phone, read out digit by digit, sits in a run of number words: [from, to) or null. */
function phoneSpan(tokens: readonly string[]): [number, number] | null {
  const at = tokens.map((t) => DIGIT_WORDS[t] ?? '-').join('').indexOf('5417033095')
  return at < 0 ? null : [at, at + 10]
}

/** Words "a" may lead as one quantity ("a quarter", "a third", "a dozen", "a half", "a majority"). */
const LEADS_QUANTITY = new Set(['half', 'third', 'quarter', 'dozen', 'majority'])

/** Words that may not start a figure: they only join or close one. */
const NOT_A_START = new Set(['and', 'a', 'point', 'half', 'oh', ...PERCENT_WORDS, ...DOLLAR_WORDS])

/**
 * Every number said in words, with the word indices that say it. A word such
 * as "sixty-three" is two tokens of one word. Runs of number words are read
 * greedily, longest first ("three and a half months" is one figure, 3.5); "a"
 * counts as one only before hundred or a scale ("a hundred homes"). An ordinal
 * from "third" up is a figure. The locked phone read out digit by digit, and
 * the short allowlist above, are not figures.
 */
export function spokenFigures(words: readonly string[]): SpokenFigure[] {
  const tokens: string[] = []
  const owner: number[] = []
  words.forEach((w, wi) => {
    for (const t of tokenizeWords(w)) {
      tokens.push(t)
      owner.push(wi)
    }
  })
  const out: SpokenFigure[] = []
  const push = (from: number, to: number, values: number[], unit: NumberUnit, vague?: true) => {
    const first = owner[from]
    const last = owner[to]
    out.push({ first, last, said: words.slice(first, last + 1).join(' '), values, unit, ...(vague ? { vague } : {}) })
  }
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok in ORDINALS) {
      push(i, i, [ORDINALS[tok]], null)
      i++
      continue
    }
    // "a" counts as one before hundred or a scale ("a hundred homes"), and leads a quantity ("a quarter", "a dozen").
    const leadsScale = tok === 'a' && (tokens[i + 1] === 'hundred' || tokens[i + 1] in SCALES || LEADS_QUANTITY.has(tokens[i + 1]))
    if (!isNumberWord(tok) || (NOT_A_START.has(tok) && !leadsScale && !parseQuantity([tok]))) {
      i++
      continue
    }
    let end = i
    while (end < tokens.length && (isNumberWord(tokens[end]) || tokens[end] === 'oh')) end++
    const run = tokens.slice(i, end)
    // The locked phone read out is not a figure; the words around it still are.
    const phone = phoneSpan(run)
    let p = 0
    while (p < run.length) {
      if (phone && p >= phone[0] && p < phone[1]) {
        p = phone[1]
        continue
      }
      const stop = phone && p < phone[0] ? phone[0] : run.length
      let taken = 0
      for (let k = stop - p; k >= 1; k--) {
        const piece = run.slice(p, p + k).map((t, n) => (t === 'a' && n === 0 && (run[p + 1] === 'hundred' || run[p + 1] in SCALES) ? 'one' : t))
        // A figure starts on a number, never on a joining word or a unit word (a quantity phrase is one).
        const quantity = parseQuantity(piece)
        if (NOT_A_START.has(run[p]) && piece[0] !== 'one' && !quantity) continue
        const got = quantity ?? parseSpokenNumber(piece)
        if (!got) continue
        const from = i + p
        const to = i + p + k - 1
        const before = tokens[from - 1]
        const after = tokens[to + 1]
        const allowed =
          k === 1 &&
          (NON_STATISTICAL_SPOKEN.some(
            (rule) =>
              rule.word === piece[0] &&
              ((rule.after !== undefined && after !== undefined && rule.after.includes(after)) ||
                (rule.before !== undefined && before !== undefined && rule.before.includes(before))),
          ) ||
            (piece[0] === 'most' && before !== undefined && /'s$/.test(before)))
        if (!allowed) push(from, to, got.values, got.unit, got.vague)
        taken = k
        break
      }
      p += taken || 1
    }
    i = end
  }
  return out
}

/** Two values are the same figure (to a millionth of the larger). */
export function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Does a figure token ("12%", "$475K", "3.5") show this spoken figure? Same value and same unit. */
export function tokenShowsSpoken(token: string, figure: Pick<SpokenFigure, 'values' | 'unit' | 'vague'>): boolean {
  const { num, unit } = splitFigure(token)
  const n = parseCaptionNumber(unit === '%' ? `${num}%` : unit === 'times' ? `${num}x` : num)
  return n !== null && shownSays(n, figure)
}

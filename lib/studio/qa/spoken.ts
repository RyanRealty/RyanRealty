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

const NUMBER_WORDS = new Set([
  ...Object.keys(UNITS), ...Object.keys(TEENS), ...Object.keys(TENS), ...Object.keys(SCALES),
  'hundred', 'point', 'and', 'a', 'half', ...PERCENT_WORDS, ...DOLLAR_WORDS,
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

export type NumberUnit = 'percent' | 'dollar' | null

export interface SpokenNumber {
  /** Every reading that fits (a plain count, or a spoken year). */
  values: number[]
  unit: NumberUnit
}

/** Parse a run of spoken number words, with an optional trailing percent or dollars. */
export function parseSpokenNumber(tokens: string[]): SpokenNumber | null {
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
}

/** "$475K" gives 475000 dollars; "63%" gives 63 percent; "1,250" gives 1250. Null when not numeric. */
export function parseCaptionNumber(token: string): CaptionNumber | null {
  const m = /^(\$)?(\d[\d,]*(?:\.\d+)?)(%|k|m)?$/i.exec(token)
  if (!m) return null
  let value = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(value)) return null
  const suffix = (m[3] ?? '').toLowerCase()
  if (suffix === 'k') value *= 1e3
  if (suffix === 'm') value *= 1e6
  value = Math.round(value * 1e6) / 1e6
  const unit: NumberUnit = suffix === '%' ? 'percent' : m[1] ? 'dollar' : null
  return { value, unit }
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
      if (got && got.unit === want.unit && got.values.some((v) => Math.abs(v - want.value) <= 1e-6 * Math.max(1, Math.abs(want.value)))) {
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
 * Number tokens in a string, each WITH its own unit or prefix, so a row covers a
 * token only when they are the same figure: "$475K" is not "$475", "4 mo" is not
 * "4". A token is digits with an optional leading $ or # (a rank: "#1"),
 * thousands commas, a decimal part, and a trailing %, K, M or " mo". The locked
 * end card phone number is not a figure and is skipped. A digit glued to a
 * letter on its left (Q3, H2) is part of a word, not a figure; a digit after
 * punctuation glued to a word ("fell,12%") is a figure.
 */
export function extractNumberTokens(text: string): string[] {
  const cleaned = text.replace(LOCKED_PHONE, ' ')
  const re = /(?<![A-Za-z0-9$#])(?<!\d[.,])[#$]?\d[\d,]*(?:\.\d+)?(?:%|[KkMm](?![A-Za-z])|\s?[Mm][Oo]\b)?/g
  return [...cleaned.matchAll(re)].map((m) => m[0].replace(/[.,]+$/, ''))
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
 *  - "first" and "second" are never read as figures (see ORDINALS).
 */
export const NON_STATISTICAL_SPOKEN: ReadonlyArray<{ word: string; before?: readonly string[]; after?: readonly string[] }> = [
  { word: 'one', after: ['of', 'more'] },
  { word: 'one', before: ['this', 'the', 'no', 'that'] },
]

export interface SpokenFigure {
  /** Indices into the words given, first and last. */
  first: number
  last: number
  /** The words as said ("twelve percent"). */
  said: string
  /** Every value the words can mean (a count, or a spoken year). */
  values: number[]
  unit: NumberUnit
}

const DIGIT_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

/** Where the locked phone, read out digit by digit, sits in a run of number words: [from, to) or null. */
function phoneSpan(tokens: readonly string[]): [number, number] | null {
  const at = tokens.map((t) => DIGIT_WORDS[t] ?? '-').join('').indexOf('5417033095')
  return at < 0 ? null : [at, at + 10]
}

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
  const push = (from: number, to: number, values: number[], unit: NumberUnit) => {
    const first = owner[from]
    const last = owner[to]
    out.push({ first, last, said: words.slice(first, last + 1).join(' '), values, unit })
  }
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok in ORDINALS) {
      push(i, i, [ORDINALS[tok]], null)
      i++
      continue
    }
    const leadsScale = tok === 'a' && (tokens[i + 1] === 'hundred' || tokens[i + 1] in SCALES)
    if (!isNumberWord(tok) || (NOT_A_START.has(tok) && !leadsScale)) {
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
        // A figure starts on a number, never on a joining word or a unit word.
        if (NOT_A_START.has(run[p]) && piece[0] !== 'one') continue
        const got = parseSpokenNumber(piece)
        if (!got) continue
        const from = i + p
        const to = i + p + k - 1
        const before = tokens[from - 1]
        const after = tokens[to + 1]
        const allowed =
          k === 1 &&
          NON_STATISTICAL_SPOKEN.some(
            (rule) =>
              rule.word === piece[0] &&
              ((rule.after !== undefined && after !== undefined && rule.after.includes(after)) ||
                (rule.before !== undefined && before !== undefined && rule.before.includes(before))),
          )
        if (!allowed) push(from, to, got.values, got.unit)
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
export function tokenShowsSpoken(token: string, figure: Pick<SpokenFigure, 'values' | 'unit'>): boolean {
  const n = parseCaptionNumber(token)
  return n !== null && n.unit === figure.unit && figure.values.some((v) => sameValue(v, n.value))
}

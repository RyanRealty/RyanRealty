/**
 * lib/studio/voice/captions.ts: TikTok-style caption cards from word timings.
 *
 * The rules (AGENTS.md "Ad copy, voiceover and captions" 4,
 * docs/ai-voiceover-scripts.md 4, STUDIO_ONE_FACTORY.md check #8):
 *
 *  - 1 to 4 words per card, broken where a person pauses: after sentence
 *    punctuation, after a pause between words of 0.25 s or more, preferably
 *    after a comma. A number is never split from its unit ("a hundred
 *    sixty-nine dollars", "$169 a month", "63%"), where the card size allows.
 *  - A card starts at its first word's start, exactly: the engine's timestamp
 *    of the FINAL audio, never an estimate.
 *  - A card stays up at least 0.4 s. A short word is held into the silence
 *    after it, never past the next card's start (cards never overlap). When
 *    there is no silence to borrow, the card takes more words instead.
 *  - Every spoken word is in exactly one card, in order, and the card text is
 *    the spoken words as the engine said them. The one permitted change is the
 *    approved display map: spoken money, percent and count words shown as the
 *    brief's figure ("sixty-three percent" -> "63%"). The map is explicit and
 *    passed in; this module never writes a digit of its own.
 *
 * How: the words (with display replacements applied as single units) are cut
 * into cards by dynamic programming over a cost, the way a typesetter breaks
 * lines. The cost prefers 2 to 4 words, breaks at punctuation and pauses, keeps
 * a number with its unit, and treats a card that cannot stay up 0.4 s as
 * nearly forbidden. Same input, same cards.
 *
 * Pure: no clock, no network, no randomness.
 */
import type { CaptionCard, SpokenWord } from './types'

export const MAX_CARD_WORDS = 4
export const MIN_CARD_SECONDS = 0.4
/** A silence between two words at least this long is a phrase boundary. */
export const PAUSE_BREAK_SECONDS = 0.25
/** A card's end is carried to the next card's start when the silence between is this short, so the line does not flicker. */
export const BRIDGE_GAP_SECONDS = 0.12

export type CaptionOptions = {
  /**
   * Spoken phrase -> the approved on-screen figure, e.g.
   * { 'sixty-three percent': '63%', 'a hundred sixty-nine dollars': '$169' }.
   * Keys match the spoken words ignoring case, punctuation and hyphens, so
   * "sixty-three percent" matches "Sixty three percent." too. The value is
   * shown verbatim, plus the spoken words' trailing punctuation.
   */
  display?: Record<string, string>
  maxWords?: number
  minCardSeconds?: number
  pauseBreakSeconds?: number
  bridgeGapSeconds?: number
  /** The end of the audio or the film: the last card is never held past it. */
  endLimitSeconds?: number
}

export type CaptionPlan = {
  cards: CaptionCard[]
  /** Rule breaks the cards still carry (a card under 0.4 s with no silence to borrow). Empty means every rule holds. */
  violations: string[]
  /** Not rule breaks: a display rule that matched no spoken words. */
  warnings: string[]
}

/** Thrown by buildCaptions when the best cards still break a rule. */
export class CaptionRuleError extends Error {
  readonly violations: string[]
  constructor(violations: string[]) {
    super(`captions break the rules: ${violations.join('; ')}`)
    this.name = 'CaptionRuleError'
    this.violations = violations
  }
}

// ---------------------------------------------------------------------------
// Words to units (display map applied)
// ---------------------------------------------------------------------------

const DASHES = /[\u2012\u2013\u2014\u2015]/

/** Lowercase, hyphens and dashes as spaces, everything but letters and digits dropped. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-\u2010-\u2015]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Unit = {
  text: string
  tokens: number
  first: number
  last: number
  start: number
  /** Normalised spoken tokens of the unit's words. */
  core: string[]
  /** True when the text is a display-map replacement. */
  mapped: boolean
}

type Rule = { spoken: string; key: string; show: string; tokens: number; used: boolean }

function compileRules(display: Record<string, string> | undefined, maxWords: number): Map<string, Rule> {
  const rules = new Map<string, Rule>()
  for (const [spoken, show] of Object.entries(display ?? {})) {
    const key = normalise(spoken)
    if (key === '') throw new RangeError(`display rule "${spoken}" has no spoken words in it`)
    const shown = show.trim()
    if (shown === '') throw new RangeError(`display rule "${spoken}" shows nothing`)
    if (DASHES.test(shown)) throw new RangeError(`display rule "${spoken}" shows a dash (no em or en dashes in public copy)`)
    const tokens = shown.split(/\s+/).length
    if (tokens > maxWords) throw new RangeError(`display rule "${spoken}" shows ${tokens} words, over the ${maxWords}-word card`)
    if (rules.has(key)) throw new RangeError(`display rule "${spoken}" duplicates another rule`)
    rules.set(key, { spoken, key, show: shown, tokens, used: false })
  }
  return rules
}

/** The trailing sentence punctuation of a spoken word, kept on a replaced figure. */
function trailingPunctuation(word: string): string {
  const m = /([.,!?;:]+)["'\u201d\u2019)\]]*$/.exec(word)
  return m ? m[1] : ''
}

function buildUnits(words: SpokenWord[], rules: Map<string, Rule>): Unit[] {
  const maxKeyTokens = Math.max(0, ...Array.from(rules.values(), (r) => r.key.split(' ').length))
  const units: Unit[] = []
  let i = 0
  while (i < words.length) {
    let matched: { rule: Rule; length: number } | null = null
    for (let length = Math.min(maxKeyTokens, words.length - i); length >= 1 && !matched; length--) {
      const key = words
        .slice(i, i + length)
        .map((w) => normalise(w.word))
        .filter(Boolean)
        .join(' ')
      const rule = rules.get(key)
      if (rule) matched = { rule, length }
    }
    if (matched) {
      const last = i + matched.length - 1
      const punct = trailingPunctuation(words[last].word)
      const shown = punct && !/[.,!?;:]$/.test(matched.rule.show) ? matched.rule.show + punct : matched.rule.show
      matched.rule.used = true
      units.push({
        text: shown,
        tokens: matched.rule.tokens,
        first: i,
        last,
        start: words[i].start,
        core: words.slice(i, last + 1).flatMap((w) => normalise(w.word).split(' ').filter(Boolean)),
        mapped: true,
      })
      i = last + 1
    } else {
      units.push({
        text: words[i].word,
        tokens: 1,
        first: i,
        last: i,
        start: words[i].start,
        core: normalise(words[i].word).split(' ').filter(Boolean),
        mapped: false,
      })
      i++
    }
  }
  return units
}

// ---------------------------------------------------------------------------
// Number and unit glue
// ---------------------------------------------------------------------------

const NUMBER_WORDS = new Set(
  (
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen ' +
    'eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion'
  ).split(' '),
)
const BIG_NUMBER_WORDS = new Set(['hundred', 'thousand', 'million', 'billion'])
/** What a count or amount is of: it reads with the number before it. */
const MEASURES = new Set(
  (
    'dollars dollar bucks percent months month years year days day weeks week hours hour minutes minute miles mile ' +
    'acres acre bedrooms bedroom bathrooms bathroom beds bed baths bath feet foot sqft square homes houses listings ' +
    'sales offers units lots k grand'
  ).split(' '),
)
const PERIODS = new Set('month year day week hour mo yr'.split(' '))
const PER_WORDS = new Set(['a', 'an', 'per', 'every', 'each'])

const STRONG_GLUE = 10
const WEAK_GLUE = 3

function isNumberWords(u: Unit): boolean {
  return !u.mapped && u.core.length > 0 && u.core.every((t) => NUMBER_WORDS.has(t))
}
/** A figure: spoken number words, a digit in the words, or a mapped figure. */
function isFigure(u: Unit): boolean {
  return isNumberWords(u) || /\d/.test(u.text)
}
/** A mapped figure that carries its own unit ("63%", "$169"). */
function isComplete(u: Unit): boolean {
  return u.mapped && /^[$]|%$/.test(u.text.replace(/[.,!?;:]+$/, ''))
}
function isMeasure(u: Unit): boolean {
  return !u.mapped && u.core.length === 1 && MEASURES.has(u.core[0])
}

/** How badly a card boundary after unit k would hurt a number and its unit: 0, WEAK_GLUE or STRONG_GLUE. */
function glue(units: Unit[], k: number): number {
  const a = units[k]
  const b = units[k + 1]
  if (!b) return 0
  if (isNumberWords(a) && isNumberWords(b)) return STRONG_GLUE
  if (!a.mapped && a.core.length === 1 && (a.core[0] === 'a' || a.core[0] === 'an') && !b.mapped && BIG_NUMBER_WORDS.has(b.core[0])) {
    return STRONG_GLUE
  }
  if (isFigure(a) && !isComplete(a) && isMeasure(b)) return STRONG_GLUE
  if (!a.mapped && a.core[0] === 'square' && !b.mapped && b.core[0] === 'feet') return STRONG_GLUE
  if (!a.mapped && a.core.length === 1 && PER_WORDS.has(a.core[0]) && !b.mapped && b.core.length === 1 && PERIODS.has(b.core[0])) {
    return STRONG_GLUE
  }
  // "$169" or "dollars" with the "a month" that follows it.
  const c = units[k + 2]
  if (
    (isFigure(a) || isMeasure(a)) &&
    !b.mapped &&
    b.core.length === 1 &&
    PER_WORDS.has(b.core[0]) &&
    c &&
    !c.mapped &&
    c.core.length === 1 &&
    PERIODS.has(c.core[0])
  ) {
    return WEAK_GLUE
  }
  return 0
}

// ---------------------------------------------------------------------------
// Where a person pauses
// ---------------------------------------------------------------------------

/** Cost of keeping two neighbouring units on one card across their boundary. */
function joinPenalty(words: SpokenWord[], units: Unit[], k: number, pauseBreak: number): number {
  const a = units[k]
  const b = units[k + 1]
  const spoken = words[a.last].word.replace(/["'\u201d\u2019)\]]+$/, '')
  const gap = Math.max(0, words[b.first].start - words[a.last].end)
  let punctuation = 0
  const last = spoken.at(-1)
  if (last === '.' || last === '!' || last === '?') punctuation = 50
  else if (last === ';' || last === ':') punctuation = 8
  else if (last === ',') punctuation = 2
  const pause = gap >= pauseBreak ? 20 : 0
  // A longer silence is a better place to cut, whatever the punctuation says.
  return Math.max(punctuation, pause) + Math.min(gap, 0.5) * 10
}

const SIZE_COST = [Infinity, 1.5, 0.4, 0, 0.3]
/** Past this much speech on one card it is a held slide, not a caption. */
const LONG_CARD_SECONDS = 1.5
/** A card that cannot stay up its minimum: nearly forbidden, never impossible (so a plan always exists). */
const SHORT_CARD_PENALTY = 1000

function planUnits(words: SpokenWord[], units: Unit[], maxWords: number, minCard: number, pauseBreak: number): Array<[number, number]> {
  const n = units.length
  const join = Array.from({ length: Math.max(0, n - 1) }, (_, k) => joinPenalty(words, units, k, pauseBreak))
  const split = Array.from({ length: Math.max(0, n - 1) }, (_, k) => glue(units, k))
  const best = new Array<number>(n + 1).fill(Infinity)
  const from = new Array<number>(n + 1).fill(-1)
  best[0] = 0
  for (let j = 1; j <= n; j++) {
    let tokens = 0
    let joins = 0
    for (let i = j - 1; i >= 0; i--) {
      tokens += units[i].tokens
      if (tokens > maxWords && i < j - 1) break
      if (i < j - 1) joins += join[i]
      if (!Number.isFinite(best[i])) continue
      const size = tokens <= maxWords ? (SIZE_COST[tokens] ?? 0.3) : 100
      let cost = best[i] + size + joins
      if (j < n) {
        cost += split[j - 1]
        const available = units[j].start - units[i].start
        if (available < minCard - 1e-9) cost += SHORT_CARD_PENALTY + (minCard - available) * 1000
      }
      const span = words[units[j - 1].last].end - units[i].start
      if (span > LONG_CARD_SECONDS) cost += (span - LONG_CARD_SECONDS) * 4
      if (cost < best[j]) {
        best[j] = cost
        from[j] = i
      }
    }
  }
  const cuts: Array<[number, number]> = []
  for (let j = n; j > 0; j = from[j]) cuts.push([from[j], j - 1])
  return cuts.reverse()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function tokenCount(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/**
 * Check cards against the rules and the words they were made from. Returns one
 * line per break; empty means the cards are good. The same list the
 * manifest check (#8) measures, plus overlap.
 */
export function validateCaptions(
  cards: CaptionCard[],
  words: SpokenWord[],
  options: Pick<CaptionOptions, 'maxWords' | 'minCardSeconds'> = {},
): string[] {
  const maxWords = options.maxWords ?? MAX_CARD_WORDS
  const minCard = options.minCardSeconds ?? MIN_CARD_SECONDS
  const out: string[] = []
  const seen = new Array<number>(words.length).fill(0)
  cards.forEach((card, c) => {
    const label = `card ${c} "${card.text}"`
    const count = tokenCount(card.text)
    if (count < 1 || count > maxWords) out.push(`${label} has ${count} words (1 to ${maxWords})`)
    if (DASHES.test(card.text)) out.push(`${label} has an em or en dash`)
    if (card.end - card.start < minCard - 1e-9) {
      out.push(`${label} is up ${(card.end - card.start).toFixed(3)} s (under ${minCard} s)`)
    }
    if (card.words.length === 0) out.push(`${label} shows no spoken word`)
    else if (card.start !== words[card.words[0]]?.start) {
      out.push(`${label} starts at ${card.start}, not at its first word's ${words[card.words[0]]?.start}`)
    }
    const next = cards[c + 1]
    if (next && card.end > next.start + 1e-9) out.push(`${label} overlaps the next card`)
    if (next && next.start < card.start) out.push(`${label} is out of order`)
    card.words.forEach((w, k) => {
      if (!(w >= 0 && w < words.length)) out.push(`${label} points at word ${w}, which does not exist`)
      else {
        seen[w]++
        if (k > 0 && w !== card.words[k - 1] + 1) out.push(`${label} skips a word`)
      }
    })
  })
  seen.forEach((count, w) => {
    if (count === 0) out.push(`spoken word ${w} "${words[w].word}" is in no card`)
    else if (count > 1) out.push(`spoken word ${w} "${words[w].word}" is in ${count} cards`)
  })
  return out
}

/** Cards, plus the rule breaks they still carry and any display rule that matched nothing. Never throws on a rule break. */
export function planCaptions(words: SpokenWord[], options: CaptionOptions = {}): CaptionPlan {
  const maxWords = options.maxWords ?? MAX_CARD_WORDS
  const minCard = options.minCardSeconds ?? MIN_CARD_SECONDS
  const pauseBreak = options.pauseBreakSeconds ?? PAUSE_BREAK_SECONDS
  const bridge = options.bridgeGapSeconds ?? BRIDGE_GAP_SECONDS
  const rules = compileRules(options.display, maxWords)
  const units = buildUnits(words, rules)
  const warnings = Array.from(rules.values())
    .filter((r) => !r.used)
    .map((r) => `display rule "${r.spoken}" matched no spoken words`)
  if (units.length === 0) return { cards: [], violations: [], warnings }

  const cuts = planUnits(words, units, maxWords, minCard, pauseBreak)
  const cards: CaptionCard[] = cuts.map(([a, b]) => {
    const indices: number[] = []
    for (let w = units[a].first; w <= units[b].last; w++) indices.push(w)
    return {
      text: units
        .slice(a, b + 1)
        .map((u) => u.text)
        .join(' '),
      start: units[a].start,
      end: words[units[b].last].end,
      words: indices,
    }
  })
  cards.forEach((card, c) => {
    const nextStart = cards[c + 1]?.start ?? options.endLimitSeconds ?? Infinity
    let end = card.end
    if (end - card.start < minCard) end = card.start + minCard
    if (cards[c + 1] && nextStart - end <= bridge) end = nextStart
    card.end = Math.max(card.start, Math.min(end, nextStart))
  })
  return { cards, violations: validateCaptions(cards, words, { maxWords, minCardSeconds: minCard }), warnings }
}

/**
 * The caption cards for these words: `{ text, start, end, words }`, the
 * manifest's `captions` shape. Throws CaptionRuleError when the best cards
 * still break a rule (speech too fast to hold 0.4 s a card), so a bad caption
 * track never goes quietly downstream.
 */
export function buildCaptions(words: SpokenWord[], options: CaptionOptions = {}): CaptionCard[] {
  const plan = planCaptions(words, options)
  if (plan.violations.length > 0) throw new CaptionRuleError(plan.violations)
  return plan.cards
}

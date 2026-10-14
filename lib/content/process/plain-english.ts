/**
 * lib/content/process/plain-english.ts - step 0, the whiteboard, and the
 * plain-English rules (Matt 2026-10-14).
 *
 * Matt, on the buyer ad draft: "'Sellers are paying to close.' ... You jump right
 * into the middle of a concept when you really don't explain it. It needs to be
 * explained so that a 75-year-old person can understand it. We're not going to
 * pander, but we need to explain it in simple, plain English." And: "We need to
 * start with a bigger context." And: "Actual dollar amounts versus percentages
 * will always land better because people don't really want to do the math."
 *
 * So before anyone builds, the ad-strategist (.claude/agents/ad-strategist.md)
 * writes whiteboard.json in the brief's own folder: who it is for, what is
 * happening in plain words, the insight, the contrast (only with figures behind
 * it), why now, why us, one ask, and the read-aloud script. The brief step
 * (steps/brief.ts) refuses a brief without one, then holds the whiteboard's
 * script AND every word the brief ships to the rules here (rules.ts R-186 to
 * R-191):
 *  - the whiteboard is filled, by the ad-strategist, with four killed takes;
 *  - its figures are figure IDs with rows in brief.numbers, never typed numbers;
 *  - no insider term unless the same line explains it in everyday words;
 *  - in an ad, dollars: no percentage, "percent", or "N in 10" fraction;
 *  - the voiceover and on-screen words read at or under a Flesch-Kincaid grade;
 *  - in an ad, the opening names who it is for or what is happening.
 * Every number and list a rule holds is read by the ratchet through
 * plainEnglishThresholds() (qa:plain_english.*), so loosening one needs Matt
 * (scripts/check-rule-loosening.mjs) and tightening does not.
 *
 * Why these limits: docs/research/ad-message-strategy-2026-10-14.md.
 *
 * Plain TypeScript with no imports: scripts/check-content-rules.mjs reads this
 * file through tsx (CI runs it on Node 20), so keep it free of imports and of
 * syntax that needs a build step beyond type erasure.
 */

// ---------------------------------------------------------------------------
// The numbers and lists the rules hold

export const PLAIN_ENGLISH = Object.freeze({
  /** A brief is refused without a whiteboard beside it (R-186). Turning this off is a loosening. */
  requireWhiteboard: true,
  /** The strategist writes five takes and kills four, one line each (creative-brain law; R-186). */
  takesKilled: 4,
  /** A killed take's reason is one line of at most this many characters (R-186). */
  maxReasonChars: 200,
  /**
   * The highest Flesch-Kincaid grade the voiceover and on-screen words may read at, together
   * (R-190). Grade 6: MedlinePlus puts easy-to-read material at grade 5 to 8, Gallup's
   * PIAAC analysis puts 54% of US adults 16 to 74 below a sixth-grade level, and an ad is heard
   * once, without rereading (the research doc, "Readability").
   */
  maxGrade: 6,
  /** The opening must share at least this many content words with the whiteboard's audience or context (R-191). */
  contextMinSharedWords: 2,
  /** Video types that are ads by type (R-189, R-191). A seller ad joins by its Housing category below. */
  adTypes: Object.freeze(['buyer_ad']) as readonly string[],
  /** Every brief that declares a special_ad_category or use "ads" is an ad too (R-189, R-191). */
  everyHousingAd: true,
})

export const WHITEBOARD_FILE = 'whiteboard.json'
export const WHITEBOARD_AUTHOR = 'ad-strategist'
/** Every field of whiteboard.json, in the order the strategist fills them (.claude/skills/ryan-studio/templates/whiteboard.schema.json). */
export const WHITEBOARD_FIELDS = Object.freeze(['author', 'audience', 'context', 'insight', 'contrast', 'why_now', 'why_us', 'ask', 'script', 'figures', 'takes_killed'] as const)
const TEXT_FIELDS = ['audience', 'context', 'insight', 'why_now', 'why_us', 'ask'] as const

/** A figure ID: a word like bend_median_credit, never a typed number. */
export const FIGURE_ID = /^[a-z][a-z0-9_]*$/

/**
 * Insider terms (Matt 2026-10-14: "It's only you bots that understand it"). A term passes only
 * when the same line carries one of its plain glosses (Federal Plain Language Guidelines: when a
 * technical term is unavoidable, define it; CDC Clear Communication Index item 7: explain an
 * unfamiliar term in the same sentence or right after). `pattern` and `glosses` are regex
 * sources, matched case-insensitively against one line. `example` is the everyday wording the
 * refusal suggests.
 */
export type InsiderTerm = { term: string; pattern: string; reason: string; glosses: readonly string[]; example: string }

const SELLER_PAID = [
  "\\bmoney (that )?(the |a )?sellers? (gave|give|gives|paid|pay|pays|put|puts|covered|covers)\\b",
  '\\bclosing costs\\b',
  '\\bcosts at closing\\b',
]
const HOUSE_ON_LOT = [
  '\\bhouses? on (its|their|a|an) own (lots?|land)\\b',
  '\\bnot (a |the )?(condos?|townho(use|me)s?|apartments?)\\b',
]
const TIME_TO_SELL = [
  '\\b(sat|sit|sits|sitting|stayed|stay|stays) (for sale|on the market|unsold)\\b',
  '\\b(before|until|to) (an offer|a sale|it sold|they sold|selling|sell|get an offer|getting an offer)\\b',
]
const ACCEPTED_OFFER = [
  '\\b(an |the )?(accepted|signed) offer\\b',
  '\\bagreed (to sell|on a price|on the sale)\\b',
  "\\bnot (closed|final) yet\\b|\\bhasn't closed\\b|\\bhaven't closed\\b",
]
const LOWER_RATE = ['\\blowers? (the |your |their |a )?(interest |mortgage )?rate\\b', '\\b(rate|interest) (goes|go|went|comes|come|came) down\\b']

export const INSIDER_TERMS: readonly InsiderTerm[] = Object.freeze([
  { term: 'seller credit', pattern: "\\b(sellers?'?s?|closing|buyers?'?s?) credits?\\b", reason: 'an agent word for money a seller puts toward the buyer\'s costs; a listener cannot picture it', glosses: SELLER_PAID, example: 'money the seller gave the buyer at closing' },
  { term: 'concession', pattern: '\\bconcessions?\\b', reason: 'an agent word for money or terms a seller gives up; most people hear nothing concrete', glosses: SELLER_PAID, example: 'money the seller put toward the buyer\'s costs at closing' },
  { term: 'paying to close', pattern: '\\b(pay|pays|paid|paying) to close\\b', reason: 'shorthand that starts in the middle of the idea (Matt 2026-10-14: "Sellers are paying to close" is retired)', glosses: ['\\bclosing costs\\b', '\\bcosts at closing\\b'], example: 'sellers are paying some of the buyer\'s costs at closing' },
  { term: 'median', pattern: '\\bmedian\\b', reason: 'a statistics word; most listeners do not know it means the middle one', glosses: ['\\bhalf\\b[^.?!]*\\b(more|less|above|below|higher|lower|over|under)\\b', '\\b(right )?in the middle\\b'], example: 'half sold for more and half for less' },
  { term: 'single-family', pattern: '\\bsingle[- ]family\\b', reason: 'an industry category; people say house', glosses: HOUSE_ON_LOT, example: 'houses on their own lot, not condos' },
  { term: 'SFR', pattern: '\\bsfrs?\\b', reason: 'an MLS code nobody outside the business knows', glosses: HOUSE_ON_LOT, example: 'houses on their own lot' },
  { term: 'detached', pattern: '\\bdetached (homes?|houses?|sales?|segment)\\b', reason: 'a data label for the kind of home; people say house', glosses: HOUSE_ON_LOT, example: 'houses on their own lot, not condos' },
  { term: 'days on market', pattern: '\\bdays on (the )?market\\b', reason: 'an MLS field; a listener cannot tell what it counts', glosses: TIME_TO_SELL, example: 'how long homes sat for sale before they sold' },
  { term: 'DOM', pattern: '\\bc?dom\\b', reason: 'an MLS abbreviation', glosses: TIME_TO_SELL, example: 'how long homes sat for sale before they sold' },
  { term: 'months of supply', pattern: "\\bmonths?'? (of )?(supply|inventory)\\b", reason: 'an analyst measure; nobody hears a length of time in it', glosses: ['\\bhow long\\b[^.?!]*\\b(sell|last|take)\\b', '\\bto sell (every|all|each)\\b'], example: 'how long it would take to sell every home for sale at today\'s pace' },
  { term: 'absorption', pattern: '\\babsorption\\b', reason: 'an analyst word for how fast homes sell', glosses: ['\\bhow (fast|quickly)\\b[^.?!]*\\b(sell|sold|selling)\\b'], example: 'how fast homes are selling' },
  { term: 'inventory', pattern: "(?<!\\bmonths?'? (?:of )?)\\binventory\\b", reason: 'a business word for stock; people say homes for sale', glosses: ['\\bfor sale\\b'], example: 'homes for sale' },
  { term: 'active listings', pattern: '\\bactive (listings?|inventory)\\b|\\bactives\\b', reason: 'an MLS status; people say homes for sale', glosses: ['\\bfor sale\\b'], example: 'homes for sale right now' },
  { term: 'list-to-sale', pattern: '\\b(list|sale|sold|sales)[- ]to[- ](list|sale|sold)\\b|\\bsp\\s*/\\s*lp\\b', reason: 'an analyst ratio; nobody hears what was compared', glosses: ['\\b(sold|sell|sells|selling|went) for (more|less) than\\b', '\\b(under|over|below|above) (the )?asking\\b', '\\bwhat (the )?sellers? asked\\b'], example: 'sold for less than the asking price' },
  { term: 'comps', pattern: '\\bcomps\\b|\\bcomparables?\\b', reason: 'agent shorthand for similar homes that sold', glosses: ['\\b(similar|nearby) (homes?|houses?)\\b[^.?!]*\\bsold\\b', '\\bhomes? like (yours|this|it|this one)\\b'], example: 'similar homes nearby that sold' },
  { term: 'YoY', pattern: '\\byoy\\b|\\by/y\\b|\\byear[- ]over[- ]year\\b', reason: 'analyst shorthand; say what it is compared with', glosses: ['\\b(than|from|since|compared (to|with)|versus|vs\\.?) (a year ago|last year|this time last year)\\b', '\\bsame (time|months?|season|quarter) last year\\b', '\\ba year (ago|earlier)\\b'], example: 'than this time last year' },
  { term: 'YTD', pattern: '\\bytd\\b|\\byear[- ]to[- ]date\\b', reason: 'accounting shorthand', glosses: ['\\bso far this year\\b', '\\bsince (january|jan)\\b'], example: 'so far this year' },
  { term: 'quarter code', pattern: '\\bq[1-4]\\b', reason: 'a business calendar code; people name months or seasons', glosses: ['\\b(january|february|march|april|june|july|august|september|october|november|december|spring|summer|fall|autumn|winter)\\b'], example: 'July through September' },
  { term: 'buy-down', pattern: '\\b(rate )?buy[- ]?downs?\\b', reason: 'lender shorthand for paying to lower a loan rate', glosses: LOWER_RATE, example: 'money that lowers your interest rate' },
  { term: 'points', pattern: '\\b(discount|mortgage) points?\\b|\\b(buy|buys|buying|bought|pay|pays|paying|paid) (down )?points\\b', reason: 'lender shorthand; nobody hears a fee in it', glosses: [...LOWER_RATE, '\\bfee\\b'], example: 'an upfront fee that lowers your rate' },
  { term: 'contingent', pattern: '\\bcontingen(t|cy|cies)\\b', reason: 'a contract word; say what the deal depends on', glosses: ['\\bonly if\\b', '\\bdepends on\\b', '\\bas long as\\b'], example: 'only if the buyer\'s own home sells first' },
  { term: 'pending', pattern: '\\bpending\\b', reason: 'an MLS status; a listener does not know the home is under contract but not sold', glosses: ACCEPTED_OFFER, example: 'has an accepted offer but has not closed' },
  { term: 'under contract', pattern: '\\bunder contract\\b', reason: 'a contract word; say what happened', glosses: ACCEPTED_OFFER, example: 'the seller has an accepted offer' },
  { term: 'closings', pattern: '\\bclosings\\b', reason: 'agent shorthand for finished sales', glosses: ['\\b(homes?|houses?) (that )?(sold|closed)\\b'], example: 'homes that sold' },
  { term: 'CMA', pattern: '\\bcmas?\\b|\\bcomparative market analys[ie]s\\b', reason: 'an agent product name', glosses: ['\\bwhat (your|the|a) (home|house) (is|could be|would be) worth\\b', '\\bhome value\\b'], example: 'a report on what your home is worth' },
  { term: 'REO', pattern: '\\breos?\\b', reason: 'a bank code', glosses: ['\\bbank[- ]owned\\b', '\\bthe bank (owns|took)\\b'], example: 'bank-owned homes' },
  { term: 'escrow', pattern: '\\bescrow\\b', reason: 'a closing word many buyers have never used', glosses: ['\\bholds? (the |your )?(money|deposit)\\b'], example: 'a neutral company holds the money until closing' },
  { term: 'earnest money', pattern: '\\bearnest money\\b', reason: 'a contract word', glosses: ['\\bdeposit\\b', '\\bgood[- ]faith\\b'], example: 'a deposit that shows the seller you are serious' },
  { term: 'basis points', pattern: '\\bbasis points?\\b|\\bbps\\b', reason: 'a finance unit nobody outside lending uses', glosses: ['\\bhundredths? of a (percent|point)\\b'], example: 'hundredths of a percent' },
  { term: 'PMI', pattern: '\\bpmi\\b', reason: 'a lender abbreviation', glosses: ['\\bmortgage insurance\\b'], example: 'mortgage insurance' },
  { term: 'LTV', pattern: '\\bltv\\b|\\bloan[- ]to[- ]value\\b', reason: 'a lender ratio', glosses: ['\\bhow much (you|they) (borrow|owe)\\b'], example: 'how much you borrow compared with the home\'s value' },
  { term: 'DTI', pattern: '\\bdti\\b|\\bdebt[- ]to[- ]income\\b', reason: 'a lender ratio', glosses: ['\\b(monthly )?(debts?|bills) compared (to|with) (your |their )?income\\b'], example: 'your monthly debts compared with your income' },
  { term: 'PPSF', pattern: '\\bppsf\\b|\\$\\s*/\\s*(sq\\.?\\s?ft|sf)\\b', reason: 'an analyst abbreviation', glosses: ['\\bper square foot\\b'], example: 'price per square foot' },
])

/**
 * What the ratchet reads, at qa:plain_english.<key> (threshold-path.ts buildThresholdData).
 * Lists are compared as sets: more insider terms, more ad types and more fields are tighter;
 * more glosses are LOOSER (each one is another way past a term), so every gloss is listed.
 */
export function plainEnglishThresholds(): Record<string, unknown> {
  return {
    require_whiteboard: PLAIN_ENGLISH.requireWhiteboard,
    takes_killed: PLAIN_ENGLISH.takesKilled,
    max_reason_chars: PLAIN_ENGLISH.maxReasonChars,
    whiteboard_fields: [...WHITEBOARD_FIELDS],
    insider_terms: INSIDER_TERMS.map((t) => t.term),
    glosses: INSIDER_TERMS.flatMap((t) => t.glosses.map((g) => `${t.term} => ${g}`)),
    ad_types: [...PLAIN_ENGLISH.adTypes],
    every_housing_ad: PLAIN_ENGLISH.everyHousingAd,
    max_grade: PLAIN_ENGLISH.maxGrade,
    context_min_shared_words: PLAIN_ENGLISH.contextMinSharedWords,
  }
}

// ---------------------------------------------------------------------------
// Words, lines and syllables

const norm = (s: string): string => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/**
 * A spoken script as lines: ElevenLabs audio tags ([warm], [long pause]) are not words, and an
 * ellipsis is a pause inside a line, not the end of one. A line ends at . ? or ! followed by a
 * space or the end (so 3.5 stays one figure).
 */
export function scriptLines(script: string): string[] {
  const text = norm(String(script ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\.{3}|…/g, ', '))
  return text
    .split(/[.?!]+(?=\s|$)/)
    .map((s) => s.replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s*,\s*,+/g, ',').trim())
    .filter((s) => /[a-z0-9]/i.test(s))
}

/** The words of a line: tokens with a letter or a digit, outer punctuation stripped; a hyphenated word is one word. */
export function wordsOf(line: string): string[] {
  return norm(line)
    .split(' ')
    .map((w) => w.replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/gi, ''))
    .filter((w) => /[a-z0-9]/i.test(w))
}

/**
 * Syllables in one word, by the usual vowel-group count: a final silent e and a silent -es or
 * -ed are dropped (not after c, g, s, x or z for -es, nor t or d for -ed), a final consonant +
 * "le" keeps its syllable, and a leading y is a consonant. A hyphenated word counts each part.
 * A figure written in digits ($10,000) counts as one word of one syllable; the voiceover spells
 * figures out (the ElevenLabs v3 rule), so a spoken figure counts in full there.
 */
export function syllables(word: string): number {
  const parts = word.toLowerCase().split('-').filter(Boolean)
  if (parts.length > 1) return parts.reduce((n, p) => n + syllables(p), 0)
  let w = (parts[0] ?? '').replace(/[^a-z]/g, '')
  if (!w) return /\d/.test(word) ? 1 : 0
  if (w.length <= 3) return 1
  if (!/[^aeiouy]le$/.test(w)) {
    if (/[^aeiouy]es$/.test(w) && !/[cgsxz]es$/.test(w)) w = w.slice(0, -2)
    else if (/[^aeiouy]ed$/.test(w) && !/[td]ed$/.test(w)) w = w.slice(0, -2)
    else if (/[^aeiouy]e$/.test(w)) w = w.slice(0, -1)
  }
  w = w.replace(/^y/, '')
  const groups = w.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 0)
}

export type Reading = { grade: number; words: number; sentences: number; syllables: number; hardest: string | null }

/**
 * Flesch-Kincaid grade level over sentences pooled together (Kincaid, Fishburne, Rogers and
 * Chissom 1975): 0.39 x words per sentence + 11.8 x syllables per word - 15.59. Null when there
 * are no words. `hardest` is the sentence with the highest grade of its own.
 */
export function readingGrade(sentences: readonly string[]): Reading | null {
  let words = 0
  let syl = 0
  let count = 0
  let hardest: { line: string; grade: number } | null = null
  for (const s of sentences) {
    const ws = wordsOf(s)
    if (!ws.length) continue
    const y = ws.reduce((n, w) => n + syllables(w), 0)
    words += ws.length
    syl += y
    count += 1
    const own = fk(ws.length, 1, y)
    if (!hardest || own > hardest.grade) hardest = { line: s, grade: own }
  }
  if (!words) return null
  return { grade: fk(words, count, syl), words, sentences: count, syllables: syl, hardest: hardest?.line ?? null }
}

const fk = (words: number, sentences: number, syl: number): number => 0.39 * (words / sentences) + 11.8 * (syl / words) - 15.59

const STOP = new Set(
  ("a an the and or but so if of in on at to for from by with as is are was were be been being it its it's this that these those there here here's there's " +
    "you your you're you've you'll we we're we've our us they they're their them i i'm me my he she his her what what's who how why when where which " +
    "do does did done have has had having will would can could should may might just now right very really all some any more most no not okay ok yes " +
    "about up down out over into than then too also only still even get got go going let's that's").split(' '),
)

/** A crude stem, so "buying" meets "buy" and "homes" meets "home". */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s?$/, '').replace(/[^a-z0-9]/g, '')
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return w
}

/** The content words of some text, stemmed: no stop words, no figures. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of wordsOf(text)) {
    for (const part of w.split('-')) {
      const lw = part.toLowerCase()
      if (!/[a-z]/.test(lw) || STOP.has(lw)) continue
      const s = stem(lw)
      if (s && !STOP.has(s)) out.add(s)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// The checks on one line

const compiled = new Map<string, RegExp>()
const re = (source: string): RegExp => {
  let r = compiled.get(source)
  if (!r) {
    r = new RegExp(source, 'i')
    compiled.set(source, r)
  }
  return r
}

/** The insider terms a line uses without its plain gloss, each once. */
export function insiderHits(line: string, terms: readonly InsiderTerm[] = INSIDER_TERMS): InsiderTerm[] {
  const text = norm(line)
  return terms.filter((t) => re(t.pattern).test(text) && !t.glosses.some((g) => re(g).test(text)))
}

const NUMBER_WORD = '(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|a hundred|one hundred|hundred)'
const FRACTION = new RegExp(`\\b${NUMBER_WORD}\\s+(?:in|out of|of every)\\s+(?:every\\s+)?${NUMBER_WORD}\\b`, 'i')
const PERCENT = /\d[\d,.]*\s*%|%|\bpercent(?:age)?s?\b|\bper cent\b|\bpct\b/i

/** A percentage, "percent", or an "N in 10" / "N out of N" fraction in a line, or null. */
export function percentHit(line: string): { kind: 'percentage' | 'fraction'; said: string } | null {
  const text = norm(line)
  const p = text.match(PERCENT)
  if (p) return { kind: 'percentage', said: p[0] }
  const f = text.match(FRACTION)
  return f ? { kind: 'fraction', said: f[0] } : null
}

// ---------------------------------------------------------------------------
// Which briefs are ads

/** Is this brief an ad: an ad video type, or (everyHousingAd) a brief that declares a special ad category or use "ads". */
export function isAd(brief: unknown): boolean {
  const b = (brief ?? {}) as { video_type?: unknown; special_ad_category?: unknown; use?: unknown }
  if (typeof b.video_type === 'string' && PLAIN_ENGLISH.adTypes.includes(b.video_type)) return true
  if (!PLAIN_ENGLISH.everyHousingAd) return false
  return (typeof b.special_ad_category === 'string' && b.special_ad_category.trim() !== '') || b.use === 'ads'
}

// ---------------------------------------------------------------------------
// The whiteboard

export type Whiteboard = {
  author: string
  audience: string
  context: string
  insight: string
  contrast: { text: string; figures: string[] } | null
  why_now: string
  why_us: string
  ask: string
  script: string[]
  figures: string[]
  takes_killed: string[]
}

/** A brief.numbers row, as much of it as the whiteboard is checked against. */
export type FigureRow = { key?: unknown; on_screen?: unknown; value?: unknown }

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/** Read whiteboard.json strictly: every field, no other key, the author, four killed takes. Problems start "whiteboard: ". */
export function parseWhiteboard(raw: unknown): { ok: true; value: Whiteboard } | { ok: false; problems: string[] } {
  const problems: string[] = []
  const fail = (m: string) => problems.push(`whiteboard: ${m}`)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, problems: ['whiteboard: whiteboard.json is not an object of the whiteboard fields'] }
  const wb = raw as Record<string, unknown>
  for (const key of Object.keys(wb)) if (!(WHITEBOARD_FIELDS as readonly string[]).includes(key)) fail(`has an unknown key "${key}" (the fields are ${WHITEBOARD_FIELDS.join(', ')})`)
  for (const key of WHITEBOARD_FIELDS) if (!(key in wb)) fail(`${key} is missing`)
  if ('author' in wb && wb.author !== WHITEBOARD_AUTHOR) fail(`author is ${JSON.stringify(wb.author)}, not "${WHITEBOARD_AUTHOR}": the strategist writes the whiteboard, never a builder (.claude/agents/ad-strategist.md)`)
  for (const key of TEXT_FIELDS) if (key in wb && !isText(wb[key])) fail(`${key} is empty: say it in plain words`)
  if ('contrast' in wb && wb.contrast !== null) {
    const c = wb.contrast as Record<string, unknown>
    if (!c || typeof c !== 'object' || Array.isArray(c)) fail('contrast is null, or { text, figures } with the figure IDs that back it')
    else {
      for (const key of Object.keys(c)) if (key !== 'text' && key !== 'figures') fail(`contrast has an unknown key "${key}" (it has text and figures)`)
      if (!isText(c.text)) fail('contrast.text is empty: write the contrast, or set contrast to null when no figure backs one')
      if (!Array.isArray(c.figures) || c.figures.length === 0 || !c.figures.every((f) => typeof f === 'string')) fail('contrast.figures names no figure IDs: a contrast runs only when figures back it, otherwise contrast is null')
    }
  }
  if ('script' in wb && (!Array.isArray(wb.script) || wb.script.length === 0 || !wb.script.every(isText))) fail('script is empty: it is the read-aloud lines, in order, one string each')
  if ('figures' in wb && (!Array.isArray(wb.figures) || !wb.figures.every((f) => typeof f === 'string'))) fail('figures is not a list of figure IDs')
  if ('takes_killed' in wb) {
    const t = wb.takes_killed
    const n = PLAIN_ENGLISH.takesKilled
    if (!Array.isArray(t) || !t.every((x) => typeof x === 'string')) fail(`takes_killed is not a list of ${n} one-line reasons`)
    else {
      if (t.length !== n) fail(`takes_killed has ${t.length} reason${t.length === 1 ? '' : 's'}; the strategist writes ${n + 1} takes, kills ${n}, and gives one line per kill`)
      t.forEach((reason, i) => {
        if (!reason.trim()) fail(`takes_killed reason ${i + 1} is empty`)
        else if (/[\r\n]/.test(reason)) fail(`takes_killed reason ${i + 1} runs onto a second line; one line per kill`)
        else if (reason.length > PLAIN_ENGLISH.maxReasonChars) fail(`takes_killed reason ${i + 1} runs ${reason.length} characters; keep it to ${PLAIN_ENGLISH.maxReasonChars}`)
      })
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, value: wb as unknown as Whiteboard }
}

/** A figure as typed, compared without its dollar sign, commas, spaces or percent sign. */
const bare = (s: string): string => s.replace(/[$,\s%]/g, '').toLowerCase()
/** A typed figure: digits with commas only between them, so "2021," at a clause end is "2021". */
const FIGURE_TOKEN = /\$?\d(?:[\d,]*\d)?(?:\.\d+)?%?/g
const PHONE = /\b541[.\-\s]?703[.\-\s]?3095\b/g
const YEAR = /^(19|20)\d{2}$/

/**
 * R-187: every figure the whiteboard names is a figure ID with a row in brief.numbers, and every
 * figure typed in its script or contrast is the on_screen value of a row it names. A phone number
 * and a bare year are not figures (a year in the voice or a caption is not a hero number), with or
 * without the punctuation after it. Problems start "whiteboard figure ".
 */
export function whiteboardFigureProblems(wb: Whiteboard, rows: readonly FigureRow[]): string[] {
  const out: string[] = []
  const byKey = new Map<string, FigureRow>()
  for (const r of rows) if (typeof r?.key === 'string') byKey.set(r.key, r)
  const named = [...new Set([...wb.figures, ...(wb.contrast?.figures ?? [])])]
  for (const id of named) {
    if (!FIGURE_ID.test(id)) out.push(`whiteboard figure "${id}" is not a figure ID (a word like bend_median_credit): the whiteboard holds IDs from brief.numbers, never typed numbers`)
    else if (!byKey.has(id)) out.push(`whiteboard figure "${id}" has no row in brief.numbers: every figure the whiteboard uses is a verified row (CLAUDE.md §0), never one it made up`)
  }
  for (const id of wb.contrast?.figures ?? []) if (!wb.figures.includes(id)) out.push(`whiteboard figure "${id}" backs the contrast but is not listed in figures`)
  const allowed = new Set<string>()
  for (const id of wb.figures) {
    const r = byKey.get(id)
    if (!r) continue
    if (typeof r.on_screen === 'string' && r.on_screen.trim()) allowed.add(bare(r.on_screen))
    if (typeof r.value === 'number' || typeof r.value === 'string') allowed.add(bare(String(r.value)))
  }
  const typed = (where: string, text: string) => {
    for (const raw of text.replace(PHONE, ' ').match(FIGURE_TOKEN) ?? []) {
      const m = raw.replace(/[^\d%]+$/, '')
      const b = bare(m)
      if (!b || YEAR.test(m)) continue
      if (!allowed.has(b)) out.push(`whiteboard figure "${m}" in ${where} is typed, not a figure the whiteboard names: a figure in the whiteboard is the on_screen value of a brief.numbers row listed in figures`)
    }
  }
  wb.script.forEach((line, i) => typed(`script line ${i + 1}`, line))
  if (wb.contrast) typed('the contrast', wb.contrast.text)
  return out
}

// ---------------------------------------------------------------------------
// The copy checks, over labeled lines

/** One unit of copy: a voiceover line, a beat's on-screen words, the hook, a caption sentence, a whiteboard script line. */
export type CopyLine = { where: string; text: string }

const quote = (s: string, n = 90): string => `"${s.length > n ? `${s.slice(0, n - 3)}...` : s}"`

/** R-188: an insider term without its gloss on the same line. Problems start 'insider term "'. */
export function insiderProblems(lines: readonly CopyLine[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    for (const t of insiderHits(l.text)) out.push(`insider term "${t.term}" in ${l.where}, ${quote(l.text)}: ${t.reason}. Say it in everyday words, or explain it in the same line (for example "${t.example}")`)
  }
  return out
}

/** R-189: a percentage or an "N in 10" fraction in an ad. Problems start "percentage in an ad" or "fraction in an ad". */
export function percentProblems(lines: readonly CopyLine[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    const hit = percentHit(l.text)
    if (hit) out.push(`${hit.kind} in an ad, ${l.where}: "${hit.said}" in ${quote(l.text)}. Say the dollar amount (Matt 2026-10-14: "Actual dollar amounts versus percentages will always land better")`)
  }
  return out
}

/** R-190: the voiceover and on-screen sentences, pooled, read at or under the grade limit. Problems start "reading grade ". */
export function readingProblems(sentences: readonly string[], what: string, max: number = PLAIN_ENGLISH.maxGrade): string[] {
  const r = readingGrade(sentences)
  if (!r || r.grade <= max) return []
  const per = (n: number) => n.toFixed(n < 10 ? 2 : 1)
  return [
    `reading grade ${r.grade.toFixed(1)} (Flesch-Kincaid) for ${what}; the limit is ${max}, so a listener of any age follows it on first hearing. ` +
      `Per sentence ${per(r.words / r.sentences)} words, per word ${per(r.syllables / r.words)} syllables. Hardest line: ${quote(r.hardest ?? '')}. Use shorter sentences and everyday words`,
  ]
}

/**
 * R-191: in an ad, the opening names who it is for or what is happening: it shares at least
 * contextMinSharedWords content words with the whiteboard's audience, or with its context.
 * Problems start "context first: ".
 */
export function contextFirstProblem(opening: string, where: string, wb: Pick<Whiteboard, 'audience' | 'context'>, min: number = PLAIN_ENGLISH.contextMinSharedWords): string | null {
  const open = contentWords(opening)
  const shared = (text: string) => [...contentWords(text)].filter((w) => open.has(w))
  const a = shared(wb.audience)
  const c = shared(wb.context)
  if (a.length >= min || c.length >= min) return null
  return (
    `context first: ${where} shares ${a.length} word${a.length === 1 ? '' : 's'} with the whiteboard's audience and ${c.length} with its context; it needs ${min}. ` +
    `Open by naming who this is for or what is happening, before any figure or shorthand. Opening: ${quote(opening)}. Audience: ${quote(wb.audience)}. Context: ${quote(wb.context)}`
  )
}

// ---------------------------------------------------------------------------
// The whole check, for the whiteboard and for a brief

export type WhiteboardRead = { path: string; missing: true } | { path: string; error: string } | { path: string; raw: unknown }

/**
 * Step 0 (R-186 to R-191 on the whiteboard itself): it is there and filled, its figures are
 * rows, and its script passes the plain-English rules. `ad` says whether ad-only rules apply.
 */
export function checkWhiteboard(read: WhiteboardRead, rows: readonly FigureRow[], ad: boolean): { whiteboard: Whiteboard | null; problems: string[] } {
  if ('missing' in read) {
    if (!PLAIN_ENGLISH.requireWhiteboard) return { whiteboard: null, problems: [] }
    return {
      whiteboard: null,
      problems: [`whiteboard: there is no ${WHITEBOARD_FILE} beside the brief (${read.path}); the ad-strategist writes it before anyone builds (.claude/agents/ad-strategist.md, CONTENT_PROCESS.md step 0)`],
    }
  }
  if ('error' in read) return { whiteboard: null, problems: [`whiteboard: ${read.path} is not JSON (${read.error})`] }
  const parsed = parseWhiteboard(read.raw)
  if (!parsed.ok) return { whiteboard: null, problems: parsed.problems }
  const wb = parsed.value
  const lines: CopyLine[] = wb.script.map((text, i) => ({ where: `whiteboard script line ${i + 1}`, text }))
  const problems = [...whiteboardFigureProblems(wb, rows), ...insiderProblems(lines)]
  if (ad) problems.push(...percentProblems(lines))
  problems.push(...readingProblems(wb.script.flatMap((l) => scriptLines(l)), 'the whiteboard script'))
  if (ad) {
    const p = contextFirstProblem(wb.script[0], 'whiteboard script line 1', wb)
    if (p) problems.push(p)
  }
  return { whiteboard: wb, problems }
}

/** What a brief ships, as the brief step assembles it: the voiceover, each beat's on-screen words, the hook and the post caption. */
export type BriefCopy = {
  voiceover: string | null
  /** Each beat's drawn strings in order, beat 1 first (the end card excluded), then the call to action card. */
  screen: ReadonlyArray<{ where: string; texts: readonly string[] }>
  hook: string | null
  caption: string | null
}

/**
 * The plain-English rules over every word the brief ships (R-188 to R-191). Readability pools
 * the voiceover lines and every on-screen string (each string a sentence); the hook and the post
 * caption are held to the terms and, in an ad, to dollars. Context first reads the first
 * voiceover line and the first beat's on-screen words.
 */
export function briefCopyProblems(copy: BriefCopy, wb: Whiteboard | null, ad: boolean): string[] {
  const vo = copy.voiceover ? scriptLines(copy.voiceover) : []
  const lines: CopyLine[] = [
    ...vo.map((text, i) => ({ where: `voiceover line ${i + 1}`, text })),
    ...copy.screen.filter((s) => s.texts.length).map((s) => ({ where: s.where, text: s.texts.join(' / ') })),
    ...(copy.hook?.trim() ? [{ where: 'the brief hook', text: copy.hook }] : []),
    ...(copy.caption?.trim() ? scriptLines(copy.caption).map((text, i) => ({ where: `the post caption, sentence ${i + 1}`, text })) : []),
  ]
  const problems = insiderProblems(lines)
  if (ad) {
    // Percentages are judged string by string on screen, so "45%" is named where it is drawn.
    const each: CopyLine[] = [
      ...lines.filter((l) => !copy.screen.some((s) => s.where === l.where)),
      ...copy.screen.flatMap((s) => s.texts.map((text) => ({ where: s.where, text }))),
    ]
    problems.push(...percentProblems(each))
  }
  problems.push(...readingProblems([...vo, ...copy.screen.flatMap((s) => s.texts)], 'the voiceover and on-screen words together'))
  if (ad && wb) {
    // Beat 1 only: a kinetic first beat with no words leaves the voiceover's first line to say it.
    const first = copy.screen[0]?.texts.length ? copy.screen[0] : null
    const opening = [vo[0] ?? '', ...(first?.texts ?? [])].filter(Boolean).join(' / ')
    const where = `the opening (voiceover line 1${first ? ` and ${first.where}` : ''})`
    const p = opening ? contextFirstProblem(opening, where, wb) : `context first: ${where} has no words; the first voiceover line or beat 1 on screen names who this is for or what is happening`
    if (p) problems.push(p)
  }
  return problems
}

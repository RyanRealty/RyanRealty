/**
 * lib/studio/qa/evaluate.ts - the pure judgments behind the checks.
 *
 * Everything here takes plain data (manifest pieces, measured numbers) and
 * returns what is wrong, so each rule is tested without ffmpeg. check.ts feeds
 * these with real measurements and turns their findings into check results.
 */
import { alignCaption, extractNumberTokens, firstUnitIn, splitFigure, spokenFigures, squash, tokenShowsSpoken, tokenizeWords } from './spoken'
import type {
  ManifestAudio,
  ManifestBeat,
  ManifestBox,
  ManifestCaption,
  ManifestEndcard,
  ManifestNumber,
  ManifestText,
  ManifestVoice,
} from './manifest'
import { peopleAndPlaceHits } from './copy-rules'
import { QA_THRESHOLDS } from './thresholds'
import { marketVerdict } from '@/lib/market/classify'

const T = QA_THRESHOLDS
const EPS = T.epsilon

export const round = (n: number, places = 3): number => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

// ---------------------------------------------------------------------------
// Check 3: length

/**
 * The film's length against its type: under min_s fails, over hard_max_s
 * fails, over max_s fails unless the brief gives a length_reason. Used on the
 * planned length before render and on the file's length after.
 */
export function evaluateLength(duration: number, rules: { min_s: number; max_s: number; hard_max_s: number }, lengthReason: string): string[] {
  const d = duration
  const problems: string[] = []
  if (d < rules.min_s) problems.push(`runs ${round(d)}s, under the ${rules.min_s}s minimum`)
  if (d > rules.hard_max_s) problems.push(`runs ${round(d)}s, over the ${rules.hard_max_s}s hard maximum`)
  else if (d > rules.max_s && lengthReason.trim() === '') problems.push(`runs ${round(d)}s, over ${rules.max_s}s, with no length_reason in the brief`)
  return problems
}

// ---------------------------------------------------------------------------
// Check 4: hook

export interface HookFindings {
  firstBeatRole: string | null
  firstBeatStart: number | null
  /** Earliest non-caption text start, or null when there is none at all. */
  hookTextStart: number | null
  problems: string[]
}

/** The manifest half of the hook check (the blank-frame half needs the file). */
export function evaluateHook(beats: readonly ManifestBeat[], texts: readonly ManifestText[], hookMaxS: number): HookFindings {
  const problems: string[] = []
  const first = beats[0]
  if (!first) problems.push('the manifest has no beats')
  else {
    if (first.role !== 'hook') problems.push(`the first beat is "${first.role}", it must be the hook`)
    if (first.start > hookMaxS + EPS) problems.push(`the hook beat starts at ${round(first.start)}s, after ${hookMaxS}s`)
  }
  const hookTexts = texts.filter((t) => t.kind === 'card' || t.kind === 'cta' || t.kind === 'label')
  const starts = hookTexts.map((t) => t.start)
  const hookTextStart = starts.length ? Math.min(...starts) : null
  if (hookTextStart === null) problems.push('no card, cta or label text (captions do not count as the hook)')
  else if (hookTextStart > hookMaxS + EPS) problems.push(`the first non-caption text appears at ${round(hookTextStart)}s, after ${hookMaxS}s`)
  return { firstBeatRole: first?.role ?? null, firstBeatStart: first ? round(first.start) : null, hookTextStart: hookTextStart === null ? null : round(hookTextStart), problems }
}

// ---------------------------------------------------------------------------
// Check 5: holds

export interface Shot {
  start: number
  end: number
  duration: number
}

export interface ShotFindings {
  shots: Shot[]
  /** Cuts inside the end card window; its word pops are not shots. */
  ignoredCuts: number[]
}

/**
 * Cut the film into shots at the detected scene cuts. Cuts at or after the end
 * card's start (less a small lead) are word pops, not shots. The shots run from
 * 0 to the end card's start, or to the end of the film when there is no end card.
 * The caller passes the start the FILM supports (shotsCutoff), never a
 * manifest's word alone: a start claimed early would hide real cuts.
 */
export function computeShots(cuts: readonly number[], duration: number, endcardStart: number | null): ShotFindings {
  const limit = endcardStart === null ? duration : Math.min(endcardStart, duration)
  const lead = 0.1
  const cutoff = endcardStart === null ? Infinity : endcardStart - lead
  const ignoredCuts = cuts.filter((t) => t >= cutoff)
  const inside = cuts.filter((t) => t > 0 && t < cutoff && t < limit)
  const points = [0, ...inside, limit]
  const shots: Shot[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    shots.push({ start: round(points[i]), end: round(points[i + 1]), duration: round(points[i + 1] - points[i]) })
  }
  return { shots, ignoredCuts: ignoredCuts.map((t) => round(t)) }
}

/** A frame is the end card's cream field when at least this share of it is cream (the card reads about 0.85 to 0.93). */
export const ENDCARD_CREAM_MIN = 0.6

/**
 * Where the pixels show the end card starting: the start of the run of
 * cream-field frames that holds the golden probe (Call now + 0.5 s). Null when
 * the probe frame is not the cream card. `fractions` are per frame, in order.
 */
export function endcardStartFromPixels(fractions: ReadonlyArray<{ t: number; fraction: number }>, probeT: number, min: number = ENDCARD_CREAM_MIN): number | null {
  if (fractions.length === 0) return null
  let at = 0
  for (let i = 1; i < fractions.length; i++) if (Math.abs(fractions[i].t - probeT) < Math.abs(fractions[at].t - probeT)) at = i
  if (fractions[at].fraction < min) return null
  while (at > 0 && fractions[at - 1].fraction >= min) at--
  return fractions[at].t
}

/**
 * The end card start check 5 may cut shots at: the manifest's start, but never
 * earlier than the pixels show the card (a start claimed early would hide real
 * cuts as word pops). With no card in the pixels, nothing is a word pop.
 */
export function shotsCutoff(claimed: number | null, measured: number | null): number | null {
  if (claimed === null || measured === null) return null
  return Math.max(claimed, measured)
}

export function shortHolds<T extends { duration: number }>(items: readonly T[], minHold: number): T[] {
  return items.filter((s) => !(s.duration >= minHold - EPS))
}

/** Every beat shorter than the type's min_hold_s, as problems (the planned beats before render, the manifest's after). */
export function beatHoldProblems(beats: readonly ManifestBeat[], minHold: number): string[] {
  return shortHolds(beats.map((b) => ({ id: b.id, duration: round(b.end - b.start) })), minHold).map((b) => `beat "${b.id}" holds ${b.duration}s (minimum ${minHold}s)`)
}

// ---------------------------------------------------------------------------
// Check 7: sound

export interface LoudnessJudgement {
  problems: string[]
}

export function judgeLoudness(integratedLufs: number | null, truePeakDb: number | null): LoudnessJudgement {
  const problems: string[] = []
  const a = T.audio
  if (integratedLufs === null) problems.push('integrated loudness is silence')
  else if (integratedLufs < a.lufsMin - EPS || integratedLufs > a.lufsMax + EPS) {
    problems.push(`integrated ${integratedLufs} LUFS is outside ${a.lufsMin} to ${a.lufsMax}`)
  }
  if (truePeakDb === null) problems.push('no true peak was measured')
  else if (truePeakDb > a.truePeakMaxDb + EPS) problems.push(`true peak ${truePeakDb} dBTP is above ${a.truePeakMaxDb}`)
  return { problems }
}

/**
 * Whether a file with no audio stream may pass: only a declared silent film
 * with no voice, of a type and brief that ask for no voiceover.
 */
export function silentFilmDeclared(voice: ManifestVoice | null, audio: ManifestAudio, voiceRequired: boolean): boolean {
  return !voiceRequired && voice === null && audio.silent === true
}

/**
 * Whether the film must carry a voiceover: its type requires one
 * (video_types.json requires_voiceover, default true) or its brief names one
 * (spec_rules.voiceover). Unknown rules count as required: nothing passes by default.
 */
export function voiceoverRequired(rules: { requires_voiceover?: boolean } | null, brief: Record<string, unknown> | null): boolean {
  const spec = brief?.spec_rules
  const briefVo = typeof spec === 'object' && spec !== null && (spec as Record<string, unknown>).voiceover !== undefined && (spec as Record<string, unknown>).voiceover !== null
  return briefVo || !rules || rules.requires_voiceover !== false
}

/** Check 7's voice half: a film whose type or brief asks for a voiceover carries one. */
export function missingVoiceProblem(voice: ManifestVoice | null, required: boolean, videoType: string): string | null {
  return required && !voice ? `the ${videoType} type or its brief asks for a voiceover and the manifest carries none` : null
}

/** Check 8's presence half: voice words and captions when a voiceover is required; captions whenever there is a voice. */
export function captionPresenceProblem(voice: ManifestVoice | null, captions: readonly ManifestCaption[], required: boolean, videoType: string): string | null {
  if (!voice) return required ? `the ${videoType} type or its brief asks for a voiceover with captions; the manifest carries no voice words` : null
  return captions.length === 0 ? 'the film has a voiceover and no captions' : null
}

/** Checks 12 and 13's presence half: a type that requires an end card or a loop has one. */
export function requiredPartProblem(part: 'end card' | 'loop', present: boolean, required: boolean, videoType: string): string | null {
  return !present && required ? `the manifest has no ${part} and ${videoType} requires one` : null
}

// ---------------------------------------------------------------------------
// Check 8: captions

export interface CaptionFindings {
  captions: number
  spokenWords: number
  tooLong: string[]
  tooShort: string[]
  offSync: string[]
  badIndices: string[]
  mismatched: string[]
  uncovered: string[]
}

export function evaluateCaptions(voice: ManifestVoice, captions: readonly ManifestCaption[]): CaptionFindings {
  const c = T.caption
  const f: CaptionFindings = {
    captions: captions.length, spokenWords: voice.words.length,
    tooLong: [], tooShort: [], offSync: [], badIndices: [], mismatched: [], uncovered: [],
  }
  const covered = new Set<number>()
  captions.forEach((cap, i) => {
    const label = `caption ${i} "${cap.text}"`
    const words = tokenizeWords(cap.text).length
    if (words > c.maxWords) f.tooLong.push(`${label} has ${words} words`)
    const dur = cap.end - cap.start
    if (!(dur >= c.minSeconds - EPS)) f.tooShort.push(`${label} shows for ${round(dur)}s`)
    const idx = cap.words
    if (idx.length === 0 || idx.some((n) => n >= voice.words.length)) {
      f.badIndices.push(`${label} points at spoken words that do not exist`)
      return
    }
    idx.forEach((n) => covered.add(n))
    const first = voice.words[idx[0]]
    const delta = Math.abs(cap.start - first.start)
    if (delta > c.syncSeconds + EPS) f.offSync.push(`${label} starts ${round(delta)}s from "${first.word}"`)
    const aligned = alignCaption(cap.text, idx.map((n) => voice.words[n].word))
    if (!aligned.ok) f.mismatched.push(`${label}: ${aligned.detail}`)
  })
  voice.words.forEach((w, n) => {
    if (!covered.has(n)) f.uncovered.push(`"${w.word}" (word ${n})`)
  })
  return f
}

export function captionProblems(f: CaptionFindings): string[] {
  return [...f.tooLong, ...f.tooShort, ...f.offSync, ...f.badIndices, ...f.mismatched, ...(f.uncovered.length ? [`spoken word(s) no caption shows: ${f.uncovered.join(', ')}`] : [])]
}

// ---------------------------------------------------------------------------
// Check 9: numbers

export interface NumberFindings {
  /** Every figure token on screen and in the voice, each with its own unit or prefix. */
  tokens: string[]
  /** Figures no row covers, each with where it is. */
  unmatched: string[]
  /** Numbers said in words, each with how it is shown. */
  spoken: string[]
  /** Spoken figures no caption shows as a sourced figure. */
  spokenUnsourced: string[]
  /** Figures written in words on screen (a caption or a card). */
  wordsOnScreen: string[]
  incompleteRows: string[]
}

const TRACE_FIELDS = ['source', 'window', 'geography', 'definition'] as const

/**
 * A row whose window starts "none" is not a measurement (a threshold, a scale
 * mark): it covers its figure only inside the drawn boxes it is bound to, never
 * in a caption or the voice, the same as a code-authored row (F3, 2026-10-14).
 */
export function fixedRow(row: Pick<ManifestNumber, 'window'>): boolean {
  return /^\s*none\b/i.test(row.window ?? '')
}

interface RowFigure {
  num: string
  /** The figure's unit: its own ("4 mo", "12%"), else the first unit word of the row's definition, else none. */
  unit: string
  /** True when the row's on-screen figure carries the unit itself. */
  explicit: boolean
}

/** A row's figures, each with its unit: "$475K" is one figure, "3.5" defined as months of supply is 3.5 months. */
function rowFigures(row: ManifestNumber): RowFigure[] {
  const defined = firstUnitIn(row.definition ?? '') ?? ''
  return extractNumberTokens(row.onScreen).map((tok) => {
    const f = splitFigure(tok)
    return f.unit ? { num: squash(f.num), unit: f.unit, explicit: true } : { num: squash(f.num), unit: defined, explicit: false }
  })
}

/**
 * Does a row's figure cover this token? Same number with the same prefix and
 * magnitude, and the same unit: a token with a unit needs a row in that unit
 * (its own, or its definition's); a bare token is covered by a bare row, or by
 * a row whose unit is only in its definition ("3.5" on the meter, defined as months).
 */
function covers(rf: RowFigure, token: string): boolean {
  const f = splitFigure(token)
  if (squash(f.num) !== rf.num) return false
  if (rf.explicit) return f.unit === rf.unit
  return f.unit === '' || f.unit === rf.unit
}

const sameBox = (a: ManifestBox, b: ManifestBox): boolean =>
  Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1

/**
 * Check 9: every figure has a numbers row that IS that figure. A token matches
 * a row only as a whole token with its prefix, magnitude and unit ("4" is not
 * "4 mo", "$475" is not "$475K", "3.5 days" is not 3.5 months of supply). A
 * measured brief row (no boxes, a real window) covers the figure anywhere: a
 * card, a caption, the voice. An authored row (a scale mark, an as-of date) and
 * a brief row whose window is "none" (a threshold) cover only the drawn boxes
 * they are bound to.
 *
 * A number said in words is a figure too (§0): every spoken figure must be
 * shown, in the caption that carries its words, as a figure a measured brief
 * row covers (the timeline's display rule does that). That includes ratio and
 * fraction words ("doubled" as "2x", "a quarter" as "25%") and "a dozen"; a
 * quantity with no single figure ("most", "dozens", "hundreds of") is refused. A figure written in
 * words on a caption or a card has no row and fails. The short allowlist of
 * non-statistical words ("one of", "this one") lives in spoken.ts.
 */
export function evaluateNumbers(
  texts: readonly ManifestText[],
  captions: readonly ManifestCaption[],
  rows: readonly ManifestNumber[],
  voice: ManifestVoice | null,
): NumberFindings {
  const measured = rows.filter((r) => (!r.boxes || r.boxes.length === 0) && !fixedRow(r)).map(rowFigures)
  const bound = rows.filter((r) => r.boxes && r.boxes.length > 0).map((r) => ({ figures: rowFigures(r), boxes: r.boxes! }))
  const bySource = (tok: string) => measured.some((figs) => figs.some((rf) => covers(rf, tok)))

  const seen = new Set<string>()
  const tokens: string[] = []
  const unmatched: string[] = []
  const note = (tok: string, covered: boolean, where: string) => {
    if (!seen.has(tok)) {
      seen.add(tok)
      tokens.push(tok)
    }
    if (!covered) unmatched.push(`"${tok}" in ${where}`)
  }
  texts.forEach((t, i) => {
    for (const tok of extractNumberTokens(t.text)) {
      const covered = bySource(tok) || (t.kind !== 'caption' && bound.some((a) => a.figures.some((rf) => covers(rf, tok)) && a.boxes.some((b) => sameBox(b, t.box))))
      note(tok, covered, `texts[${i}] "${t.text}"`)
    }
  })
  captions.forEach((c, i) => {
    for (const tok of extractNumberTokens(c.text)) note(tok, bySource(tok), `captions[${i}] "${c.text}"`)
  })
  const said = voice ? voice.words.map((w) => w.word) : []
  for (const tok of extractNumberTokens(said.join(' '))) note(tok, bySource(tok), 'the voice')

  // Numbers said in words: each shown, in its own caption, as a sourced figure.
  const spoken: string[] = []
  const spokenUnsourced: string[] = []
  for (const f of spokenFigures(said)) {
    if (f.vague) {
      spoken.push(`"${f.said}" shown as nothing`)
      spokenUnsourced.push(`spoken "${f.said}" (words ${f.first} to ${f.last}) is a quantity with no single figure; say the brief's figure instead`)
      continue
    }
    const span: number[] = []
    for (let n = f.first; n <= f.last; n++) span.push(n)
    const caption = captions.find((c) => span.every((n) => c.words.includes(n)))
    const shown = caption ? extractNumberTokens(caption.text).find((tok) => tokenShowsSpoken(tok, f)) : undefined
    spoken.push(`"${f.said}" shown as ${shown ? `"${shown}"` : 'nothing'}`)
    if (!caption) spokenUnsourced.push(`spoken "${f.said}" (words ${f.first} to ${f.last}) is on no caption`)
    else if (!shown) spokenUnsourced.push(`spoken "${f.said}" is not shown as a figure in its caption "${caption.text}" (a display rule shows it as the brief's figure)`)
    else if (!bySource(shown)) spokenUnsourced.push(`spoken "${f.said}" is shown as "${shown}", which no brief numbers row covers`)
  }

  // Figures written in words on screen have no row to trace to.
  const wordsOnScreen: string[] = []
  captions.forEach((c, i) => {
    for (const f of spokenFigures(c.text.split(/\s+/))) wordsOnScreen.push(`"${f.said}" in captions[${i}] "${c.text}"`)
  })
  texts.forEach((t, i) => {
    if (t.kind === 'caption' || t.kind === 'endcard') return
    for (const f of spokenFigures(t.text.split(/\s+/))) wordsOnScreen.push(`"${f.said}" in texts[${i}] "${t.text}"`)
  })

  const incompleteRows: string[] = []
  for (const r of rows) {
    const missing = TRACE_FIELDS.filter((k) => !r[k] || r[k]!.trim() === '')
    if (missing.length) incompleteRows.push(`"${r.onScreen}" is missing ${missing.join(', ')}`)
  }
  return { tokens, unmatched, spoken, spokenUnsourced, wordsOnScreen, incompleteRows }
}

export function numberProblems(f: NumberFindings): string[] {
  return [
    ...f.unmatched.map((u) => `figure ${u} has no numbers row that is that figure`),
    ...f.spokenUnsourced,
    ...f.wordsOnScreen.map((w) => `figure in words ${w}; show it as digits with its brief row`),
    ...f.incompleteRows,
  ]
}

// ---------------------------------------------------------------------------
// Check 10: copy

export interface CopyHit {
  where: string
  what: string
}

export function evaluateCopy(
  texts: readonly ManifestText[],
  captions: readonly ManifestCaption[],
  voice: ManifestVoice | null,
  banned: readonly string[],
  fairHousing: readonly string[] = [],
): CopyHit[] {
  const sources: Array<{ where: string; text: string }> = [
    ...texts.map((t, i) => ({ where: `texts[${i}]`, text: t.text })),
    ...captions.map((c, i) => ({ where: `captions[${i}]`, text: c.text })),
  ]
  if (voice) sources.push({ where: 'voice', text: voice.words.map((w) => w.word).join(' ') })
  const hits: CopyHit[] = []
  for (const s of sources) {
    if (/[\u2013\u2014]/.test(s.text)) hits.push({ where: s.where, what: 'em or en dash' })
    const low = s.text.toLowerCase().replace(/[\u2018\u2019]/g, "'")
    for (const phrase of banned) {
      const re = new RegExp(`(?<![A-Za-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![A-Za-z0-9])`, 'i')
      if (re.test(low)) hits.push({ where: s.where, what: `banned phrase "${phrase}"` })
    }
    for (const h of peopleAndPlaceHits(s.text, fairHousing)) hits.push({ where: s.where, what: h.what })
  }
  return hits
}

/**
 * Verdict words must agree with the months-of-supply figure on screen (§0:
 * "a seller's market verdict next to 4.3 months of supply is a fail"). The
 * first buyer ad put "Buyers have leverage" right after a meter reading 3.5,
 * the seller's band, because a rule card named that line for Bend. Leverage
 * may be true (price cuts, concessions), but a film that shows 3.5 months
 * cannot also say buyers have the edge: the viewer reads the two together.
 * Bands come from lib/market/classify.ts (<= 4 sellers, 4 to 6 balanced,
 * >= 6 buyers). In a balanced band neither side's line agrees.
 */
/** Words that name a side of the market, each folded to "buyers" or "sellers". */
const SIDE_OF: Record<string, 'buyers' | 'sellers'> = {
  buyer: 'buyers', buyers: 'buyers', "buyer's": 'buyers', "buyers'": 'buyers',
  seller: 'sellers', sellers: 'sellers', "seller's": 'sellers', "sellers'": 'sellers',
}
/**
 * Words that give a side the market (F5, 2026-10-14). A side word within
 * VERDICT_WINDOW tokens of one of these, before or after, is that side's
 * verdict: "Buyers now have real leverage", "The edge goes to buyers",
 * "Buyers... have the edge", "the market favors sellers".
 */
export const EDGE_WORDS: readonly string[] = [
  'leverage', 'edge', 'upper hand', 'in charge', 'in control', 'favor', 'favors', 'favored', 'favoring',
  'favour', 'favours', 'favoured', 'favouring', 'advantage', 'advantages', 'power', 'friendly',
]
export const VERDICT_WINDOW = 4
/** A side word right after one of these is the side that loses ("leverage over sellers", "from sellers to buyers"). */
const LOSER_MARKS = new Set(['over', 'than', 'against', 'from'])
/** Between a side and its edge word, one of these hands the edge to the other side ("buyers have no leverage"). */
const NEGATORS = new Set(['no', 'not', "don't", "doesn't", "didn't", "isn't", "aren't", "won't", 'never', 'without', 'lost', 'lose', 'losing', 'less', 'little', 'lack', 'lacks'])

/** Lowercase tokens with every mark but the apostrophe gone: "Buyers... have the edge." reads "buyers have the edge". */
function verdictTokens(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^'+/, ''))
    .filter(Boolean)
}

/** Every verdict a text gives: the side it favors and the words that say so. */
export function verdictsIn(text: string): Array<{ side: 'buyers' | 'sellers'; words: string }> {
  const tok = verdictTokens(text)
  const edges = EDGE_WORDS.map((e) => e.split(' '))
  const out: Array<{ side: 'buyers' | 'sellers'; words: string }> = []
  const other = (s: 'buyers' | 'sellers') => (s === 'buyers' ? 'sellers' : 'buyers')
  for (let i = 0; i < tok.length; i++) {
    // "buyer's market", "sellers market"
    const side = SIDE_OF[tok[i]]
    if (side && tok[i + 1] === 'market') out.push({ side, words: tok.slice(i, i + 2).join(' ') })
    const edge = edges.find((e) => e.every((w, k) => tok[i + k] === w))
    if (!edge) continue
    const from = i
    const to = i + edge.length - 1
    let best: { at: number; side: 'buyers' | 'sellers'; dist: number } | null = null
    let tie = false
    for (let j = Math.max(0, from - VERDICT_WINDOW); j <= Math.min(tok.length - 1, to + VERDICT_WINDOW); j++) {
      const s = SIDE_OF[tok[j]]
      if (!s || (j >= from && j <= to)) continue
      if (j > 0 && LOSER_MARKS.has(tok[j - 1])) continue
      const between = j < from ? tok.slice(j + 1, from) : tok.slice(to + 1, j)
      const negated = (j < from ? between : tok.slice(Math.max(0, from - 2), from)).some((w) => NEGATORS.has(w))
      const favored = negated ? other(s) : s
      const dist = j < from ? from - j : j - to
      if (!best || dist < best.dist) {
        best = { at: j, side: favored, dist }
        tie = false
      } else if (dist === best.dist && favored !== best.side) tie = true
    }
    if (best && !tie) out.push({ side: best.side, words: tok.slice(Math.min(best.at, from), Math.max(best.at, to) + 1).join(' ') })
  }
  return out
}

/**
 * Is this row the months-of-supply reading? By its stat id or name in the
 * source or definition ("months_of_supply", "months of supply"), or by a
 * definition of active listings over monthly or six-month sales.
 */
export function supplyRow(n: Pick<ManifestNumber, 'source' | 'definition'>): boolean {
  const text = `${n.definition ?? ''} ${n.source ?? ''}`
  if (/months?[\s_-]+of[\s_-]+supply/i.test(text)) return true
  return /\bactive(?:\s+[a-z-]+)?\s+(?:listings?|inventory|homes)\b[^.;]*?\b(?:divided\s+by|over|per|\/)\s*[^.;]*?\b(?:monthly|a\s+month|per\s+month|six[\s-]month|6[\s-]month|180[\s-]day|closed_180d)/i.test(text)
}

/** The leading number of a figure as shown ("3.5", "3.5 months", "3.5 mo"), as plan.ts reads it. */
export function leadingNumber(shown: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(shown)
  return m ? Number.parseFloat(m[1]) : null
}

export function evaluateVerdictWords(
  numbers: readonly ManifestNumber[],
  texts: readonly ManifestText[],
  captions: readonly ManifestCaption[],
  voice: ManifestVoice | null,
): CopyHit[] {
  // A reading, not a scale mark: the figure leads with a number ("3.5",
  // "3.5 months"), its window is a measurement window (scale marks and
  // thresholds record window "none: ..."), and it is a brief row (authored
  // rows carry boxes).
  const supply = numbers
    .filter((n) => supplyRow(n))
    .filter((n) => !n.boxes?.length && !fixedRow(n))
    .map((n) => ({ shown: n.onScreen.trim(), value: leadingNumber(n.onScreen) }))
    .filter((n): n is { shown: string; value: number } => n.value !== null)
  if (!supply.length) return []
  const sources: Array<{ where: string; text: string }> = [
    ...texts.map((t, i) => ({ where: `texts[${i}]`, text: t.text })),
    ...captions.map((c, i) => ({ where: `captions[${i}]`, text: c.text })),
  ]
  if (voice) sources.push({ where: 'voice', text: voice.words.map((w) => w.word).join(' ') })
  const hits: CopyHit[] = []
  for (const { shown, value } of supply) {
    const { kind } = marketVerdict(value)
    for (const s of sources) {
      for (const v of verdictsIn(s.text)) {
        if (v.side !== kind) hits.push({ where: s.where, what: `"${v.words}" beside ${shown} months of supply, which is the ${kind} band` })
      }
    }
  }
  return hits
}

// ---------------------------------------------------------------------------
// Check 11: safe area

export interface SafeAreaOffender {
  text: string
  right: number
  bottom: number
}

export function evaluateSafeArea(texts: readonly ManifestText[]): SafeAreaOffender[] {
  const { maxX, maxY } = T.safeArea
  const out: SafeAreaOffender[] = []
  for (const t of texts) {
    if (t.kind === 'endcard') continue
    const right = t.box.x + t.box.w
    const bottom = t.box.y + t.box.h
    if (right > maxX + EPS || bottom > maxY + EPS) out.push({ text: t.text, right: round(right), bottom: round(bottom) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Check 12: end card timing

export interface EndcardTiming {
  /** Quality hit to Service hit. */
  wordsSpan: number
  /** Call now hold, call to out. */
  callHold: number
  problems: string[]
}

/** One frame at 30 fps, plus float slack: the end card's steps land on whole frames. */
const FRAME_SLACK = 1 / 30 + 1e-6

export function evaluateEndcardTiming(ec: ManifestEndcard, beats: readonly ManifestBeat[], videoDuration: number): EndcardTiming {
  const e = T.endcard
  const problems: string[] = []
  const last = beats[beats.length - 1]
  if (!last || last.role !== 'endcard') problems.push(`the last beat is "${last?.role ?? 'missing'}", it must be the end card`)
  const ordered =
    ec.start <= ec.quality + EPS && ec.quality < ec.local - EPS && ec.local < ec.service - EPS && ec.service < ec.call - EPS && ec.call < ec.out - EPS
  if (!ordered) problems.push('end card steps are out of order (need start, Quality, Local, Service, Call now, out)')
  // The card's own start is its beat's start: one clock, not two claims.
  if (last && last.role === 'endcard' && Math.abs(last.start - ec.start) > FRAME_SLACK) {
    problems.push(`endcard.start ${round(ec.start)}s is not the end card beat's start ${round(last.start)}s`)
  }
  const wordsSpan = ec.service - ec.quality
  if (wordsSpan > e.wordPopBudgetSeconds + EPS) problems.push(`the three words take ${round(wordsSpan)}s from Quality to Service, over ${e.wordPopBudgetSeconds}s`)
  const callHold = ec.out - ec.call
  if (!(callHold >= e.callHoldMinSeconds - EPS)) problems.push(`Call now holds ${round(callHold)}s, under ${e.callHoldMinSeconds}s`)
  if (Math.abs(ec.out - videoDuration) > e.outToleranceSeconds + EPS) {
    problems.push(`the end card goes out at ${round(ec.out)}s but the film runs ${round(videoDuration)}s`)
  }
  return { wordsSpan: round(wordsSpan), callHold: round(callHold), problems }
}

// ---------------------------------------------------------------------------
// Check 14: review

export interface ReviewFile {
  sha256?: unknown
  reviewer?: unknown
  watched?: unknown
  listened?: unknown
  verdict?: unknown
}

/** The words of an id, lowercase: "Anthropic-Claude_2" is anthropic, claude, 2. */
const idWords = (id: string): string[] => id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

export function evaluateReview(review: ReviewFile, fileSha256: string, builtBy: string | undefined, hasAudio: boolean): string[] {
  const problems: string[] = []
  if (typeof review.sha256 !== 'string' || review.sha256.toLowerCase() !== fileSha256.toLowerCase()) {
    problems.push('the review is for a different file (sha256 does not match)')
  }
  const reviewer = typeof review.reviewer === 'string' ? review.reviewer.trim() : ''
  const builder = (builtBy ?? '').trim()
  if (builder === '') problems.push('the manifest names no builder (builtBy), so the review cannot be told apart from it')
  if (reviewer === '') problems.push('the review names no reviewer')
  else if (builder !== '') {
    // F11: the reviewer id may not share a word with the builder's ("anthropic-claude" is "claude").
    // Both are still self-reported; the real reviewer identity comes from the server certifier later.
    const shared = idWords(reviewer).filter((w) => idWords(builder).includes(w))
    if (shared.length) problems.push(`the reviewer "${reviewer}" shares "${shared.join('", "')}" with the builder "${builder}" (a reviewer id may not share a word with the builder's)`)
  }
  if (review.watched !== true) problems.push('the reviewer has not watched it (watched must be true)')
  if (hasAudio && review.listened !== true) problems.push('the reviewer has not listened to it (listened must be true)')
  if (review.verdict !== 'ship') problems.push(`the verdict is ${JSON.stringify(review.verdict ?? null)}, it must be "ship"`)
  return problems
}

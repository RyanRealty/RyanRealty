/**
 * lib/studio/qa/evaluate.ts - the pure judgments behind the checks.
 *
 * Everything here takes plain data (manifest pieces, measured numbers) and
 * returns what is wrong, so each rule is tested without ffmpeg. check.ts feeds
 * these with real measurements and turns their findings into check results.
 */
import { alignCaption, extractNumberTokens, squash, tokenizeWords } from './spoken'
import type {
  ManifestAudio,
  ManifestBeat,
  ManifestCaption,
  ManifestEndcard,
  ManifestNumber,
  ManifestText,
  ManifestVoice,
} from './manifest'
import { QA_THRESHOLDS } from './thresholds'
import { marketVerdict } from '@/lib/market/classify'

const T = QA_THRESHOLDS
const EPS = T.epsilon

export const round = (n: number, places = 3): number => {
  const f = 10 ** places
  return Math.round(n * f) / f
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

export function shortHolds<T extends { duration: number }>(items: readonly T[], minHold: number): T[] {
  return items.filter((s) => !(s.duration >= minHold - EPS))
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

/** Whether a file with no audio stream may pass: only a declared silent film with no voice. */
export function silentFilmDeclared(voice: ManifestVoice | null, audio: ManifestAudio): boolean {
  return voice === null && audio.silent === true
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
  tokens: string[]
  unmatched: string[]
  incompleteRows: string[]
}

const TRACE_FIELDS = ['source', 'window', 'geography', 'definition'] as const

export function evaluateNumbers(texts: readonly ManifestText[], captions: readonly ManifestCaption[], rows: readonly ManifestNumber[]): NumberFindings {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const s of [...texts.map((t) => t.text), ...captions.map((c) => c.text)]) {
    for (const tok of extractNumberTokens(s)) {
      if (!seen.has(tok)) {
        seen.add(tok)
        tokens.push(tok)
      }
    }
  }
  const unmatched = tokens.filter((tok) => !rows.some((r) => squash(r.onScreen).includes(squash(tok))))
  const incompleteRows: string[] = []
  for (const r of rows) {
    const missing = TRACE_FIELDS.filter((k) => !r[k] || r[k]!.trim() === '')
    if (missing.length) incompleteRows.push(`"${r.onScreen}" is missing ${missing.join(', ')}`)
  }
  return { tokens, unmatched, incompleteRows }
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
const BUYER_SIDE = ['buyers have leverage', "buyer's market", "buyers' market", 'buyers market', 'buyers have the edge', 'buyers have the upper hand']
const SELLER_SIDE = ["seller's market", "sellers' market", 'sellers market', 'sellers have leverage', 'sellers have the edge', 'sellers have the upper hand']

export function evaluateVerdictWords(
  numbers: readonly ManifestNumber[],
  texts: readonly ManifestText[],
  captions: readonly ManifestCaption[],
  voice: ManifestVoice | null,
): CopyHit[] {
  // A reading, not a scale mark: the figure is a bare number and its window is
  // a measurement window (scale marks such as "4 mo" record window "none: ...").
  const supply = numbers
    .filter((n) => /months?[\s_]of[\s_]supply/i.test(`${n.definition ?? ''} ${n.source ?? ''}`))
    .filter((n) => /^\d+(\.\d+)?$/.test(n.onScreen.trim()) && !/^\s*none\b/i.test(n.window ?? ''))
    .map((n) => ({ shown: n.onScreen.trim(), value: Number.parseFloat(n.onScreen) }))
  if (!supply.length) return []
  const sources: Array<{ where: string; text: string }> = [
    ...texts.map((t, i) => ({ where: `texts[${i}]`, text: t.text })),
    ...captions.map((c, i) => ({ where: `captions[${i}]`, text: c.text })),
  ]
  if (voice) sources.push({ where: 'voice', text: voice.words.map((w) => w.word).join(' ') })
  const hits: CopyHit[] = []
  for (const { shown, value } of supply) {
    const { kind } = marketVerdict(value)
    const wrong = kind === 'sellers' ? BUYER_SIDE : kind === 'buyers' ? SELLER_SIDE : [...BUYER_SIDE, ...SELLER_SIDE]
    for (const s of sources) {
      const low = s.text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')
      for (const phrase of wrong) {
        if (low.includes(phrase)) {
          hits.push({ where: s.where, what: `"${phrase}" beside ${shown} months of supply, which is the ${kind} band` })
        }
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

export function evaluateEndcardTiming(ec: ManifestEndcard, beats: readonly ManifestBeat[], videoDuration: number): EndcardTiming {
  const e = T.endcard
  const problems: string[] = []
  const last = beats[beats.length - 1]
  if (!last || last.role !== 'endcard') problems.push(`the last beat is "${last?.role ?? 'missing'}", it must be the end card`)
  const ordered =
    ec.start <= ec.quality + EPS && ec.quality < ec.local - EPS && ec.local < ec.service - EPS && ec.service < ec.call - EPS && ec.call < ec.out - EPS
  if (!ordered) problems.push('end card steps are out of order (need start, Quality, Local, Service, Call now, out)')
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

export function evaluateReview(review: ReviewFile, fileSha256: string, builtBy: string | undefined, hasAudio: boolean): string[] {
  const problems: string[] = []
  if (typeof review.sha256 !== 'string' || review.sha256.toLowerCase() !== fileSha256.toLowerCase()) {
    problems.push('the review is for a different file (sha256 does not match)')
  }
  const reviewer = typeof review.reviewer === 'string' ? review.reviewer.trim() : ''
  if (reviewer === '') problems.push('the review names no reviewer')
  else if (builtBy && reviewer.toLowerCase() === builtBy.trim().toLowerCase()) problems.push(`the reviewer "${reviewer}" built the film`)
  if (review.watched !== true) problems.push('the reviewer has not watched it (watched must be true)')
  if (hasAudio && review.listened !== true) problems.push('the reviewer has not listened to it (listened must be true)')
  if (review.verdict !== 'ship') problems.push(`the verdict is ${JSON.stringify(review.verdict ?? null)}, it must be "ship"`)
  return problems
}

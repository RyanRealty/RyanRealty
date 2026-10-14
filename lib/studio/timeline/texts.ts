/**
 * lib/studio/timeline/texts.ts: the timed texts of a film, one rule for both
 * the real manifest (what the page drew, read back) and the preflight's
 * planned manifest (what the plan says each cue draws).
 */
import type { DrawnText } from '../motion/render'
import { frameState, stillTimes, type MotionCue } from '../motion/cues'
import type { ManifestNumber, ManifestText, TextKind } from '../qa/manifest'
import { extractNumberTokens, squash as squashFigure } from '../qa/spoken'
import type { FilmPlan, PlannedNumber } from './plan'

const opacityTables = new WeakMap<FilmPlan, Array<Map<string, number>>>()

/** Every element's opacity on every frame, computed once per film from the same frameState the page applied. */
function opacityTable(film: FilmPlan): Array<Map<string, number>> {
  let table = opacityTables.get(film)
  if (!table) {
    table = []
    for (let i = 0; i < film.frames; i++) table.push(new Map(frameState(film.plan, i / film.fps).map((s) => [s.id, s.opacity])))
    opacityTables.set(film, table)
  }
  return table
}

/** Contiguous runs of frames on which an element is readable (opacity at least 0.5). */
export function visibleSpans(film: FilmPlan, elementId: string): Array<{ start: number; end: number }> {
  const table = opacityTable(film)
  const spans: Array<{ start: number; end: number }> = []
  let open: number | null = null
  for (let i = 0; i < film.frames; i++) {
    const on = (table[i].get(elementId) ?? 0) >= 0.5
    if (on && open === null) open = i
    if (!on && open !== null) {
      spans.push({ start: open / film.fps, end: i / film.fps })
      open = null
    }
  }
  if (open !== null) spans.push({ start: open / film.fps, end: film.frames / film.fps })
  return spans.map((s) => ({ start: round3(s.start), end: round3(s.end) }))
}

const round3 = (n: number) => Math.round(n * 1000) / 1000
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

export function kindFor(cue: MotionCue): TextKind {
  if (cue.kind === 'caption') return 'caption'
  if (cue.kind === 'cta') return 'cta'
  if (cue.kind === 'endcard') return 'endcard'
  return 'card'
}

/** The probe times: each card's settled still, each caption's middle, the end card's golden frame, every proof. */
function probeTimes(film: FilmPlan): Map<string, number> {
  const times = new Map<string, number>()
  for (const s of stillTimes(film.plan)) times.set(s.cueId, s.t)
  return times
}

/**
 * The manifest's texts from what the page drew: every visible text node of
 * each cue at its settled still, with its box; its time on screen from the
 * plan's own curves (the same frameState the page applied).
 */
export function textsFromProbes(
  film: FilmPlan,
  probed: Array<{ t: number; texts: DrawnText[] }>,
): { texts: ManifestText[]; cues: string[]; missing: string[] } {
  const stills = probeTimes(film)
  return textsFromDrawn(film, (cue) => {
    const t = stills.get(cue.id)
    const probe = t === undefined ? undefined : probed.find((p) => Math.abs(p.t - t) < 1e-9)
    return { t, drawn: probe ? probe.texts.filter((d) => d.cue === cue.id) : [] }
  })
}

/**
 * Timed texts from whatever says what each cue draws: the page's own read-back
 * (textsFromProbes, the real manifest) or the plan's own words (the preflight's
 * planned manifest, preflight.ts). One timing rule for both.
 */
export function textsFromDrawn(
  film: FilmPlan,
  drawnFor: (cue: MotionCue) => { t: number | undefined; drawn: DrawnText[] },
): { texts: ManifestText[]; cues: string[]; missing: string[] } {
  const drawnTexts: Array<{ text: ManifestText; cue: string }> = []
  const texts = { push: (text: ManifestText, cue: string) => drawnTexts.push({ text, cue }) }
  const missing: string[] = []
  for (const cue of film.plan.cues) {
    const { t, drawn } = drawnFor(cue)
    if (drawn.length === 0) {
      missing.push(`${cue.id} (${cue.kind}) drew no text at ${t}s`)
      continue
    }
    if (cue.kind === 'endcard') {
      const T = cue.times
      const when: Record<string, number> = {
        [cue.words[0]]: T.quality,
        [cue.words[1]]: T.local,
        [cue.words[2]]: T.service,
        [cue.cta]: T.call,
        [cue.phone]: T.call,
      }
      for (const d of drawn) {
        const start = when[squash(d.text)] ?? T.start
        texts.push({ text: squash(d.text), start: round3(start), end: round3(T.out), box: boxOf(d), kind: 'endcard' }, cue.id)
      }
      continue
    }
    const spans =
      cue.kind === 'caption' ? [{ start: cue.start, end: cue.end }] : visibleSpans(film, `${cue.id}-card`)
    for (const span of spans) {
      for (const d of drawn) {
        const text = squash(d.text)
        if (!text) continue
        texts.push({ text, start: round3(span.start), end: round3(span.end), box: boxOf(d), kind: kindFor(cue) }, cue.id)
      }
    }
  }
  const sorted = drawnTexts.map((x, i) => ({ ...x, i })).sort((a, b) => a.text.start - b.text.start || a.i - b.i)
  return { texts: sorted.map((x) => x.text), cues: sorted.map((x) => x.cue), missing }
}

/**
 * The manifest's numbers rows: brief rows as they are; each authored row (a
 * scale mark, an as-of date) bound to the drawn boxes of the cues that draw it,
 * so it covers only those (check 9). An authored row its cues never drew is
 * reported missing.
 */
export function boundNumbers(
  planned: readonly PlannedNumber[],
  texts: readonly ManifestText[],
  cues: readonly string[],
): { ok: boolean; rows: ManifestNumber[]; missing: string[] } {
  const rows: ManifestNumber[] = []
  const missing: string[] = []
  for (const { cues: from, ...row } of planned) {
    if (!from) {
      rows.push(row)
      continue
    }
    const want = new Set(extractNumberTokens(row.onScreen).map(squashFigure))
    const boxes = texts
      .filter((t, i) => from.includes(cues[i]) && t.kind !== 'caption' && extractNumberTokens(t.text).some((tok) => want.has(squashFigure(tok))))
      .map((t) => t.box)
    const unique = boxes.filter((b, i) => boxes.findIndex((o) => o.x === b.x && o.y === b.y && o.w === b.w && o.h === b.h) === i)
    if (unique.length === 0) missing.push(`"${row.onScreen}" (${from.join(', ')})`)
    else rows.push({ ...row, boxes: unique })
  }
  return { ok: missing.length === 0, rows, missing }
}

function boxOf(d: DrawnText): ManifestText['box'] {
  return { x: round3(d.x), y: round3(d.y), w: round3(d.w), h: round3(d.h) }
}


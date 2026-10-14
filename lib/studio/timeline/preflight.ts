/**
 * lib/studio/timeline/preflight.ts: the rules refuse before render.
 *
 * Matt, 2026-10-14: "I expect you to know the rules before you build a video."
 * Every video:check rule that can be decided from the brief, the timeline, the
 * voice words and the planned layout is decided HERE, before a frame exists,
 * and before the paid voice when the script alone decides it. video:check is
 * proof, not discovery: it runs the same rules again on the real manifest.
 *
 * One rules source. Each step builds a manifest-shaped draft and hands it to
 * the SAME evaluators video:check uses (lib/studio/qa/evaluate.ts,
 * techniques.ts, ledger.ts); nothing here restates a rule. Which check runs at
 * which step is the table in lib/studio/qa/phases.ts.
 *
 *  b text    the script, read with even word timing, captioned through the
 *            same display rules, and every string the film will draw: checks
 *            7, 8, 9, 10, 15 and 16. Runs before ElevenLabs is paid.
 *  c plan    the planned manifest (plan.ts output, the real voice words and
 *            captions): checks 3, 4, 5, 7, 8, 9, 10, 12, 13, 15 and 16.
 *  d layout  the layout probe's boxes (the page read back at each card's
 *            still, no frames encoded): checks 9 (authored rows bound to their
 *            drawn boxes) and 11.
 *
 * Every step reports every problem at once (PreflightError), like PlanError.
 */
import { MANIFEST_FACTORY, MANIFEST_VERSION, type Manifest, type ManifestBox, type ManifestNumber, type ManifestText } from '../qa/manifest'
import {
  beatHoldProblems,
  captionPresenceProblem,
  captionProblems,
  evaluateCaptions,
  evaluateCopy,
  evaluateEndcardTiming,
  evaluateHook,
  evaluateLength,
  evaluateNumbers,
  evaluateSafeArea,
  evaluateVerdictWords,
  fixedRow,
  missingVoiceProblem,
  numberProblems,
  requiredPartProblem,
  voiceoverRequired,
} from '../qa/evaluate'
import { buildLedgerEntry, repeatProblem, type LedgerEntry } from '../qa/ledger'
import { PREFLIGHT_STEPS, checkName, type PreflightStep } from '../qa/phases'
import { notReadyTechniques, techniqueProblems, unusableReason, type TechniqueRegistry } from '../qa/techniques'
import { bannedPhrases, type TypeRules, type VideoTypesFile } from '../qa/thresholds'
import { cueTexts } from '../motion/cues'
import type { DrawnText } from '../motion/render'
import { planCaptions } from '../voice/captions'
import type { CaptionCard, SpokenWord } from '../voice/types'
import { briefNumbersToManifest, type FilmPlan, type PlannedNumber } from './plan'
import { boundNumbers, textsFromDrawn } from './texts'
import type { StudioBrief, Timeline, TimelineCard } from './types'
import { findNumber } from './validate'

export type PreflightProblem = { check: number; problem: string }

export class PreflightError extends Error {
  readonly step: PreflightStep
  readonly problems: PreflightProblem[]
  constructor(step: PreflightStep, problems: PreflightProblem[]) {
    super(
      `the film would fail video:check, so nothing was rendered (preflight ${PREFLIGHT_STEPS[step]}):\n${problems
        .map((p) => `  - check ${p.check} ${checkName(p.check)}: ${p.problem}`)
        .join('\n')}`,
    )
    this.name = 'PreflightError'
    this.step = step
    this.problems = problems
  }
}

/** What every step reads: the type's rules, the copy lists, the registry and the ledger. */
export type PreflightContext = {
  types: VideoTypesFile
  rules: TypeRules
  registry: TechniqueRegistry
  ledger: readonly LedgerEntry[]
  slug: string
}

const tag = (check: number, problems: ReadonlyArray<string | null | undefined>): PreflightProblem[] =>
  problems.filter((p): p is string => Boolean(p)).map((problem) => ({ check, problem }))

/** Throw when a step found anything. */
export function refuse(step: PreflightStep, problems: PreflightProblem[]): void {
  if (problems.length) throw new PreflightError(step, problems)
}

// ---------------------------------------------------------------------------
// Shared: the draft manifest the evaluators read

const NO_BOX: ManifestBox = { x: 0, y: 0, w: 0, h: 0 }

function draft(parts: Partial<Manifest> & Pick<Manifest, 'videoType' | 'texts' | 'numbers' | 'voice' | 'captions'>): Manifest {
  return {
    factory: MANIFEST_FACTORY,
    manifestVersion: MANIFEST_VERSION,
    video: { file: 'final.mp4', sha256: '0'.repeat(64), width: 1080, height: 1920, fps: 30, duration: 0 },
    techniques: [],
    beats: [],
    audio: { lufs: null, truePeakDb: null, silent: parts.voice === null },
    endcard: null,
    loop: null,
    builtBy: 'preflight',
    briefSha256: '0'.repeat(64),
    slug: 'preflight',
    creative: { feel: 'planned', constraint: 'planned', lineage: 'planned', one_sentence: 'planned' },
    ...parts,
  }
}

/** Check 10 and the copy half of the rules: the same evaluators video:check runs. */
function copyProblems(m: Manifest, ctx: PreflightContext): PreflightProblem[] {
  const hits = [
    ...evaluateCopy(m.texts, m.captions, m.voice, bannedPhrases(ctx.types), ctx.types.fair_housing_flags),
    ...evaluateVerdictWords(m.numbers, m.texts, m.captions, m.voice),
  ]
  return tag(10, hits.map((h) => `${h.what} in ${h.where}`))
}

/** Checks 15 and 16 on the techniques the film runs (the brief's at step b, the plan's at step c). */
function techniqueAndRepeatProblems(briefTechniques: readonly string[], ran: readonly string[], videoType: string, ctx: PreflightContext): PreflightProblem[] {
  const out = tag(15, techniqueProblems(briefTechniques, ran, ctx.registry))
  const entry = buildLedgerEntry({ sha256: 'planned', slug: ctx.slug, videoType, techniques: ran, checkedAt: 'planned' }, ctx.registry)
  if (!entry.ok) out.push({ check: 16, problem: `cannot be compared: ${entry.reason}` })
  else out.push(...tag(16, [repeatProblem(entry.entry, ctx.ledger, ctx.registry)]))
  return out
}

function voiceBlock(words: SpokenWord[] | null): Manifest['voice'] {
  return words ? { engine: 'elevenlabs', model: 'planned', voiceId: 'planned', words } : null
}

// ---------------------------------------------------------------------------
// Step b: the script and the authored strings, before the paid voice

/** The words of a v3 script as spoken: audio tags such as [warm] are not words. */
export function scriptWords(script: string): string[] {
  return script
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
}

/**
 * The script with even timing (0.4 s a word, a pause after punctuation), so
 * the caption rules can run on its words before any voice exists. Timing here
 * only decides where cards break; step c runs the rules again on the real words.
 */
export function dryWords(script: string): SpokenWord[] {
  const out: SpokenWord[] = []
  let t = 0.3
  for (const word of scriptWords(script)) {
    out.push({ word, start: Math.round(t * 1000) / 1000, end: Math.round((t + 0.4) * 1000) / 1000 })
    t += /[.,?!;:]$/.test(word) ? 0.8 : 0.45
  }
  return out
}

/**
 * A stand-in box for the cards that draw brief row i at step b: a threshold row
 * (window "none") covers its figure only where it is drawn (check 9), so its
 * cards and the row share this box until the real boxes exist.
 */
const rowBox = (i: number): ManifestBox => ({ x: -2, y: -(i + 1), w: 0, h: 0 })

/** The brief's numbers rows at step b: threshold rows bound to their stand-in box. */
function stepBNumbers(brief: StudioBrief): ManifestNumber[] {
  return briefNumbersToManifest(brief).map((row, i) => (fixedRow(row) ? { ...row, boxes: [rowBox(i)] } : row))
}

/** Every string the film will draw, as card texts (times and boxes come at steps c and d). */
export function drawnStrings(brief: StudioBrief, timeline: Timeline): ManifestText[] {
  const out: ManifestText[] = []
  const add = (text: string | undefined, kind: ManifestText['kind'] = 'card', box: ManifestBox = NO_BOX) => {
    if (text && text.trim()) out.push({ text, start: 0, end: 1, box, kind })
  }
  const figure = (key: string | undefined) => {
    const i = key === undefined ? -1 : brief.numbers.findIndex((n) => n.key === key)
    if (i >= 0) add(brief.numbers[i].on_screen, 'card', fixedRow(brief.numbers[i]) ? rowBox(i) : NO_BOX)
  }
  const card = (c: TimelineCard) => {
    if (c.kind === 'number') {
      figure(c.number)
      add(c.eyebrow)
      add(c.unit)
      add(c.footer)
    } else {
      add(c.text)
      if (c.kind === 'text') add(c.eyebrow)
    }
  }
  for (const beat of timeline.beats) {
    if (beat.role === 'endcard') continue
    if (beat.scene?.kind === 'outline_draw_zoom') {
      add(beat.scene.eyebrow)
      add(beat.scene.line)
    } else if (beat.scene) {
      add(beat.scene.eyebrow)
      if (beat.scene.show_value !== false) figure(beat.scene.number)
    }
    beat.cards?.forEach(card)
    if (!beat.cards && !beat.scene) {
      // Legacy beats draw their figure (with the line as its label) or their line.
      if (beat.number !== undefined) add(findNumber(brief, beat.number)?.on_screen ?? beat.number)
      add(beat.text)
    }
  }
  add(timeline.cta?.text, 'cta')
  return out
}

/**
 * Step b: everything the script and the authored strings decide. Checks 7 and
 * 8 (a voice when one is required; captions built through the display rules
 * say the words), 9 (every figure on a card, a caption or said is a brief row),
 * 10 (copy and verdict words), 15 (brief techniques ready, the three
 * categories covered) and 16 (the film ledger).
 */
export function textPreflight(brief: StudioBrief, timeline: Timeline, ctx: PreflightContext): PreflightProblem[] {
  const problems: PreflightProblem[] = []
  const required = voiceoverRequired(ctx.rules, brief as unknown as Record<string, unknown>)
  const words = timeline.voice ? dryWords(timeline.voice.script) : null
  const voice = voiceBlock(words)
  let captions: CaptionCard[] = []
  if (timeline.voice && words) {
    try {
      const plan = planCaptions(words, { display: timeline.voice.display })
      captions = plan.cards
      problems.push(...tag(8, plan.violations))
    } catch (e) {
      problems.push({ check: 8, problem: (e as Error).message })
    }
  }
  const m = draft({ videoType: brief.video_type, texts: drawnStrings(brief, timeline), numbers: stepBNumbers(brief), voice, captions })
  problems.push(...tag(7, [missingVoiceProblem(voice, required, brief.video_type)]))
  problems.push(...tag(8, [captionPresenceProblem(voice, captions, required, brief.video_type)]))
  if (voice && captions.length) problems.push(...tag(8, captionProblems(evaluateCaptions(voice, captions))))
  problems.push(...tag(9, numberProblems(evaluateNumbers(m.texts, m.captions, m.numbers, m.voice))))
  problems.push(...copyProblems(m, ctx))
  const notReady = notReadyTechniques(brief.techniques, ctx.registry)
  problems.push(...tag(15, notReady.map((t) => `brief technique ${unusableReason(t, ctx.registry)}`)))
  problems.push(...techniqueAndRepeatProblems(brief.techniques, brief.techniques, brief.video_type, ctx))
  return problems
}

// ---------------------------------------------------------------------------
// Step c: the planned manifest

/** A stand-in box per cue, so an authored row covers only its own cues' texts (check 9) before the real boxes exist. */
const cueBox = (index: number): ManifestBox => ({ x: -1, y: -(index + 1), w: 0, h: 0 })

/**
 * The planned manifest: the plan's beats, end card, loop and techniques, every
 * text each cue draws with its time on screen (texts.ts, the same timing rule
 * as the real manifest), the real voice words and captions, the numbers rows.
 * Boxes are stand-ins until step d.
 */
export function plannedManifest(film: FilmPlan, brief: StudioBrief, voice: { words: SpokenWord[]; captions: CaptionCard[] } | null): Manifest {
  const index = new Map(film.plan.cues.map((c, i) => [c.id, i]))
  const { texts } = textsFromDrawn(film, (cue) => ({
    t: undefined,
    drawn: cueTexts(cue)
      .filter(Boolean)
      .map((text): DrawnText => ({ cue: cue.id, text, ...cueBox(index.get(cue.id)!), opacity: 1 })),
  }))
  const numbers: ManifestNumber[] = film.numbers.map(({ cues, ...row }: PlannedNumber) =>
    cues ? { ...row, boxes: cues.map((id) => cueBox(index.get(id) ?? -1)) } : row,
  )
  return draft({
    video: { file: 'final.mp4', sha256: '0'.repeat(64), width: 1080, height: 1920, fps: film.fps, duration: film.duration },
    videoType: brief.video_type,
    techniques: film.techniques.map((t) => t.name),
    beats: film.beats,
    texts,
    numbers,
    voice: voiceBlock(voice?.words ?? null),
    captions: voice?.captions ?? [],
    endcard: film.endcard
      ? { start: film.endcard.start, quality: film.endcard.quality, local: film.endcard.local, service: film.endcard.service, call: film.endcard.call, out: film.endcard.out }
      : null,
    loop: film.loop,
  })
}

/** Step c: every rule the planned manifest decides. */
export function planPreflight(m: Manifest, brief: StudioBrief, ctx: PreflightContext): PreflightProblem[] {
  const r = ctx.rules
  const required = voiceoverRequired(r, brief as unknown as Record<string, unknown>)
  const problems: PreflightProblem[] = [
    ...tag(3, evaluateLength(m.video.duration, r, typeof brief.length_reason === 'string' ? brief.length_reason : '')),
    ...tag(4, evaluateHook(m.beats, m.texts, r.hook_max_s).problems),
    ...tag(5, beatHoldProblems(m.beats, r.min_hold_s)),
    ...tag(7, [missingVoiceProblem(m.voice, required, m.videoType)]),
    ...tag(8, [captionPresenceProblem(m.voice, m.captions, required, m.videoType)]),
    ...(m.voice && m.captions.length ? tag(8, captionProblems(evaluateCaptions(m.voice, m.captions))) : []),
    ...tag(9, numberProblems(evaluateNumbers(m.texts, m.captions, m.numbers, m.voice))),
    ...copyProblems(m, ctx),
    ...tag(12, [requiredPartProblem('end card', m.endcard !== null, r.requires_end_card, m.videoType)]),
    ...(m.endcard ? tag(12, evaluateEndcardTiming(m.endcard, m.beats, m.video.duration).problems) : []),
    ...tag(13, [requiredPartProblem('loop', m.loop !== null, r.requires_loop, m.videoType)]),
    ...techniqueAndRepeatProblems(brief.techniques, m.techniques, m.videoType, ctx),
  ]
  return problems
}

// ---------------------------------------------------------------------------
// Step d: the layout probe's real boxes

/**
 * Step d: the drawn boxes from the layout probe. Check 11 (every box inside
 * the safe area) and check 9 again with each authored row bound to the boxes
 * its cues really drew (the meter's scale marks exist only on the page).
 */
export function layoutPreflight(
  m: Manifest,
  film: FilmPlan,
  probed: Array<{ t: number; texts: DrawnText[] }>,
  textsFromProbes: (film: FilmPlan, probed: Array<{ t: number; texts: DrawnText[] }>) => { texts: ManifestText[]; cues: string[]; missing: string[] },
): PreflightProblem[] {
  const { texts, cues, missing } = textsFromProbes(film, probed)
  const problems: PreflightProblem[] = tag(15, missing.map((x) => `the layout probe found nothing drawn for ${x}`))
  problems.push(...tag(11, evaluateSafeArea(texts).map((o) => `"${o.text}" reaches x ${o.right}, y ${o.bottom}`)))
  const bound = boundNumbers(film.numbers, texts, cues)
  problems.push(...tag(9, bound.missing.map((x) => `an authored figure was not drawn where the plan put it: ${x}`)))
  if (bound.ok) problems.push(...tag(9, numberProblems(evaluateNumbers(texts, m.captions, bound.rows, m.voice))))
  return problems
}

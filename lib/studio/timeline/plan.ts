/**
 * lib/studio/timeline/plan.ts: brief + timeline + voice in, a film plan out.
 *
 * Pure. Given the validated brief and timeline, the voice's words and captions
 * (already on the film clock) and the footage's measured sizes, this decides:
 *
 *  - the motion plan the EXISTING stage draws (cues.ts / page.ts / render.ts):
 *    every card, caption and the locked end card as pure functions of t, with
 *    the hold drift on every held card and, for the loop seam, the echo of
 *    frame 0 under the end card's iris;
 *  - the plate under it (lib/video/plate.ts): one segment per beat, cream
 *    paper where a beat has no footage, frame 0 held under the end card;
 *  - the manifest's beats and numbers;
 *  - which ryan-studio techniques the film will run, each with the proof the
 *    renderer must read back off the page before it may record the technique.
 *
 * Every rule that cannot hold throws a PlanError listing every problem, so a
 * bad timeline never renders quietly.
 */
import { MOS_BALANCED_MAX, MOS_SELLER_MAX, MOS_PLAIN_LABEL, marketVerdict } from '@/lib/market/classify'
import {
  ENTER_SECONDS,
  MIN_CARD_SECONDS,
  endcardCue,
  figureAsOf,
  figureScope,
  frameState,
  stillTimes,
  type MotionCue,
  type MotionPlan,
  type MotionSubject,
} from '../motion/cues'
import { ENDCARD, type EndcardTimes } from '../motion/endcard'
import { HOLD_DRIFT_PX, REVEAL_SECONDS } from '../motion/reveal'
import type { PlateSegment } from '@/lib/video/plate'
import type { ManifestBeat, ManifestNumber } from '../qa/manifest'
import type { CaptionCard, SpokenWord } from '../voice/types'
import {
  CARD_CUT_MARGIN_SECONDS,
  CARD_LEAD_SECONDS,
  CARD_TOPS,
  DOLLAR_FIRST_BY_SECONDS,
  HOOK_LEAD_SECONDS,
  HookError,
  dollarFirstWindow,
  questionTurnWindows,
  sendInviteWindow,
} from './hooks'
import { LOOP_SECONDS, echoFrom, filmFrames } from './seam'
import type { BriefNumber, StudioBrief, Timeline, TimelineBeat, TimelineCard, TimelineFootage } from './types'
import { findNumber } from './validate'

export const FILM_FPS = 30

/** Techniques this renderer runs. Anything else in a brief is refused before a frame is drawn. */
export const RENDERER_TECHNIQUES = [
  'eased_number_reveal',
  'dollar_first_hook',
  'question_secret_hook',
  'send_invite_hook',
  'loop_seam_edit',
  'tiktok_caption_burn',
  'meter_fill_verdict',
  'composed_score',
] as const
export type RendererTechnique = (typeof RENDERER_TECHNIQUES)[number]

export class PlanError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`the timeline cannot be planned:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'PlanError'
    this.problems = problems
  }
}

/** A clip on disk with its measured frame size and length. */
export type ResolvedFootage = { path: string; width: number; height: number; duration: number }

/** The voice as the planner needs it: words and captions already on the film clock. */
export type PlanVoice = { words: SpokenWord[]; captions: CaptionCard[] } | null

/** What must be on the page, read back from the page, for a technique to count as run. */
export type TechniqueProof = { t: number; cue: string; text: string }

export type PlannedTechnique = {
  name: RendererTechnique
  /** Texts that must be visible at their times. Empty when the proof is not a text (the score, the seam). */
  proofs: TechniqueProof[]
  detail: string
}

export type FilmPlan = {
  plan: MotionPlan
  subject: MotionSubject
  segments: PlateSegment[]
  beats: ManifestBeat[]
  endcard: EndcardTimes | null
  loop: { seconds: number } | null
  techniques: PlannedTechnique[]
  numbers: ManifestNumber[]
  frames: number
  duration: number
  fps: number
  notes: string[]
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** The whole frame on or after t, as a time rounded down to the millisecond (cues.ts onFrame). */
function frameTime(frame: number, fps: number): number {
  return Math.floor((frame / fps) * 1000) / 1000
}

/** The film frame a timeline time falls on (timeline times are snapped to whole frames). */
export function frameOf(t: number, fps: number = FILM_FPS): number {
  return Math.round(t * fps)
}

/** Where the locked end card starts: the end card beat, else right after the last beat or the CTA. */
export function endcardStartFrame(timeline: Timeline, fps: number = FILM_FPS): number {
  const beat = timeline.beats.find((b) => b.role === 'endcard')
  if (beat) return frameOf(beat.start, fps)
  const content = timeline.beats.filter((b) => b.role !== 'endcard')
  const lastEnd = Math.max(...content.map((b) => b.end), timeline.cta?.end ?? 0)
  return frameOf(lastEnd, fps)
}

/** The end card's start in seconds, the frame it lands on. */
export function endcardStartSeconds(timeline: Timeline, fps: number = FILM_FPS): number {
  return frameTime(endcardStartFrame(timeline, fps), fps)
}

/** A brief row's key: what the subject's figures are keyed by. */
function rowKey(row: BriefNumber): string {
  return row.key ?? row.on_screen
}

/** The brief's numbers as a motion subject: figures and their traces, for figureLeaks and the as-of lines. */
export function subjectFromBrief(brief: StudioBrief): MotionSubject {
  const figures: Record<string, string> = {}
  const citations: Array<Record<string, unknown>> = []
  for (const row of brief.numbers) {
    const key = rowKey(row)
    figures[key] = row.on_screen
    citations.push({ ...(row.citation ?? {}), figure: row.on_screen, figure_key: key })
  }
  // No label: a label's digits would be authorised silently by figureLeaks.
  return { label: '', figures, citations }
}

function definitionWithType(row: BriefNumber): string {
  const type = row.property_type?.trim()
  if (!type || row.definition.toLowerCase().includes(type.toLowerCase())) return row.definition
  return `${row.definition} (${type})`
}

/** Brief rows as manifest rows (check 9). */
export function briefNumbersToManifest(brief: StudioBrief): ManifestNumber[] {
  return brief.numbers.map((row) => ({
    onScreen: row.on_screen,
    source: row.source,
    window: row.window,
    geography: row.geography,
    definition: definitionWithType(row),
  }))
}

/**
 * Rows for the authored numbers a card draws beside its figure: the meter's
 * scale marks (methodology constants, never a market claim) and an as-of date
 * read from the figure's own trace. Each is written out so check 9 can see
 * where every digit on screen came from.
 */
function authoredRows(cue: MotionCue, row: BriefNumber | undefined): ManifestNumber[] {
  const out: ManifestNumber[] = []
  if (cue.kind === 'meter') {
    const [low, high] = cue.thresholds
    out.push({
      onScreen: `${low} mo`,
      source: 'lib/market/classify.ts MOS_SELLER_MAX (CLAUDE.md §0 months-of-supply thresholds)',
      window: 'none: a fixed scale mark on the meter, not a measurement',
      geography: 'the meter scale, the same for every place',
      definition: `scale mark at ${low} months of supply, the top of the seller's range`,
    })
    out.push({
      onScreen: `${high} mo`,
      source: 'lib/market/classify.ts MOS_BALANCED_MAX (CLAUDE.md §0 months-of-supply thresholds)',
      window: 'none: a fixed scale mark on the meter, not a measurement',
      geography: 'the meter scale, the same for every place',
      definition: `scale mark at ${high} months of supply, the top of the balanced range`,
    })
    out.push({
      onScreen: `${Math.round(cue.domainMax)} mo`,
      source: 'lib/studio/motion/cues.ts meter domain: max(10, ceil(months of supply + 1))',
      window: 'none: the end of the meter scale, not a measurement',
      geography: 'the meter scale',
      definition: 'the right-hand end of the meter scale',
    })
  }
  const asOf = cue.kind === 'meter' || cue.kind === 'number' ? cue.asOf : null
  if (asOf && row) {
    const c = row.citation ?? {}
    const stamp = String(c.refreshed_at ?? c.computed_at ?? '')
    out.push({
      onScreen: asOf,
      source: `${String(c.table ?? row.source)}, ${c.refreshed_at ? 'refreshed_at' : 'computed_at'} ${stamp}`,
      window: row.window,
      geography: row.geography,
      definition: `the date the figure "${row.on_screen}" was computed, read from its trace (a date, not a market figure)`,
    })
  }
  return out
}

type BuiltCard = { cue: MotionCue; proofs: Partial<Record<RendererTechnique, TechniqueProof[]>>; row?: BriefNumber }

const DASH = /[–—]/

/**
 * Plan the film. Throws PlanError with every problem when the timeline cannot
 * be drawn the way the brief and the rules ask.
 */
export function planFilm(input: {
  brief: StudioBrief
  timeline: Timeline
  voice: PlanVoice
  footage: Record<string, ResolvedFootage>
  /** True when a score will be composed and mixed in (the renderer decides; the planner records it). */
  scored?: boolean
  fps?: number
}): FilmPlan {
  const { brief, timeline, voice, footage } = input
  const fps = input.fps ?? FILM_FPS
  const problems: string[] = []
  const notes: string[] = []
  const subject = subjectFromBrief(brief)
  const wanted = new Set(brief.techniques)

  for (const name of brief.techniques) {
    if (!(RENDERER_TECHNIQUES as readonly string[]).includes(name)) {
      problems.push(`brief technique "${name}" is not one the timeline renderer runs (${RENDERER_TECHNIQUES.join(', ')}); video:check would fail it as never run`)
    }
  }

  const content = timeline.beats.filter((b) => b.role !== 'endcard')
  const endBeat = timeline.beats.find((b) => b.role === 'endcard') ?? null
  if (content.length === 0) problems.push('the timeline has no beats before the end card')

  // Beats run edge to edge on whole frames: a gap would flash the plate's cream.
  const sequence: Array<{ id: string; start: number; end: number }> = [
    ...content.map((b) => ({ id: b.id, start: b.start, end: b.end })),
    ...(timeline.cta ? [{ id: 'cta', start: timeline.cta.start, end: timeline.cta.end }] : []),
  ]
  for (let i = 1; i < sequence.length; i++) {
    if (frameOf(sequence[i].start, fps) !== frameOf(sequence[i - 1].end, fps)) {
      problems.push(`"${sequence[i].id}" starts at ${sequence[i].start}s but "${sequence[i - 1].id}" ends at ${sequence[i - 1].end}s; beats run edge to edge`)
    }
  }
  const endStartFrame = endcardStartFrame(timeline, fps)
  const lastEnd = sequence.length ? sequence[sequence.length - 1].end : 0
  if (frameOf(lastEnd, fps) !== endStartFrame) {
    problems.push(`the end card starts at ${r3(endStartFrame / fps)}s but the beat before it ends at ${lastEnd}s; they meet edge to edge`)
  }

  // The locked end card, with the loop seam's iris when the film loops.
  const loop = wanted.has('loop_seam_edit') || brief.spec_rules?.loopable === true
  const endStart = frameTime(endStartFrame, fps)
  let endcard: Extract<MotionCue, { kind: 'endcard' }> | null = null
  try {
    endcard = endcardCue(endStart, loop ? { loop: true } : {})
  } catch (e) {
    problems.push(`the locked end card refused its timing: ${(e as Error).message}`)
  }
  if (endBeat && endcard && Math.abs(endBeat.end - endcard.end) > 0.1 + 1e-9) {
    problems.push(`the locked end card runs ${ENDCARD.duration}s (END_CARD_SPEC); set the end card beat's end to ${r3(endcard.end)}s (it says ${endBeat.end}s)`)
  }
  const frames = endcard ? filmFrames(endcard.times.out, fps, loop) : frameOf(lastEnd, fps)
  const duration = frames / fps

  // Cards.
  const built: BuiltCard[] = []
  const words = voice?.words ?? []
  content.forEach((beat) => {
    try {
      built.push(...beatCards(beat, brief, subject, words, fps, problems))
    } catch (e) {
      if (e instanceof HookError) problems.push(`beat "${beat.id}": ${e.message}`)
      else throw e
    }
  })

  // The call to action, its own card before the end card.
  if (timeline.cta) {
    const cta = timeline.cta
    try {
      const style = cta.kind ?? 'send_invite'
      const window =
        style === 'send_invite'
          ? sendInviteWindow({ start: cta.start, end: cta.end, text: cta.text }, endcard ? endStart : null, words)
          : { start: r3(cta.start + CARD_LEAD_SECONDS), end: r3(cta.end - CARD_CUT_MARGIN_SECONDS) }
      if (window.end - window.start < MIN_CARD_SECONDS - 1e-9) throw new HookError(`the call to action holds ${r3(window.end - window.start)}s; it needs ${MIN_CARD_SECONDS}s`)
      const cue: MotionCue = {
        kind: 'cta',
        id: 'cta',
        start: window.start,
        end: window.end,
        style,
        line: cta.text,
        place: { top: CARD_TOPS[0] + 120, paper: !cta.footage },
      }
      const still = r3(window.start + 1.3)
      built.push({ cue, proofs: style === 'send_invite' ? { send_invite_hook: [{ t: still, cue: 'cta', text: cta.text }] } : {} })
    } catch (e) {
      if (e instanceof HookError) problems.push(`cta: ${e.message}`)
      else throw e
    }
  } else if (wanted.has('send_invite_hook')) {
    problems.push('the brief names send_invite_hook but the timeline has no cta (a share line before the end card)')
  }

  // Captions, from the voice's own words.
  const captionCues: MotionCue[] = (voice?.captions ?? []).map((c, i) => ({
    kind: 'caption',
    id: `cap${i}`,
    start: c.start,
    end: c.end,
    text: c.text,
    words: c.words,
  }))
  for (const c of captionCues) {
    if (endcard && c.end > endcard.start + 1e-6) problems.push(`caption "${(c as { text: string }).text}" runs into the end card`)
  }
  if (wanted.has('tiktok_caption_burn') && captionCues.length === 0) {
    problems.push('the brief names tiktok_caption_burn but the timeline has no voice to caption')
  }

  // Technique requirements the brief makes and the timeline must meet.
  const ran = new Set(built.flatMap((b) => Object.keys(b.proofs)))
  for (const name of ['dollar_first_hook', 'question_secret_hook', 'eased_number_reveal', 'meter_fill_verdict'] as const) {
    if (wanted.has(name) && !ran.has(name)) problems.push(`the brief names ${name} but no beat sets it up (${setupHint(name)})`)
  }
  if (wanted.has('loop_seam_edit') && !endcard) problems.push('the brief names loop_seam_edit but the film has no end card to open the seam')
  if (wanted.has('composed_score') && !input.scored) problems.push('the brief names composed_score but the timeline has no score mood (score: "calm" or "measured")')

  if (problems.length) throw new PlanError(problems)

  // The motion plan: cards in time order, then captions (above the picture), then the end card on top.
  const cards = built.map((b) => b.cue).sort((a, b) => a.start - b.start)
  const cues: MotionCue[] = [...cards, ...captionCues, ...(endcard ? [endcard] : [])]
  const plan: MotionPlan = {
    cues,
    duration,
    surface: 'footage',
    notes,
    holdDriftPx: HOLD_DRIFT_PX,
    ...(loop && endcard ? { loopEcho: { from: echoFrom(endcard.times.out) } } : {}),
    ...(captionCues.length ? { layout: 'captioned' as const } : {}),
  }

  // The plate.
  const segments: PlateSegment[] = []
  const footSegment = (id: string, start: number, end: number, f: TimelineFootage | undefined): PlateSegment => {
    const seconds = (frameOf(end, fps) - frameOf(start, fps)) / fps
    if (!f) return { kind: 'paper', seconds, label: id }
    const clip = footage[f.src]
    if (!clip) throw new PlanError([`footage "${f.src}" for "${id}" was not resolved`])
    return {
      kind: 'footage',
      path: clip.path,
      source: { width: clip.width, height: clip.height },
      sourceDuration: clip.duration,
      in: f.in ?? 0,
      seconds,
      move: f.move ?? 'hold',
      label: id,
    }
  }
  for (const beat of content) segments.push(footSegment(beat.id, beat.start, beat.end, beat.footage))
  if (timeline.cta) segments.push(footSegment('cta', timeline.cta.start, timeline.cta.end, timeline.cta.footage))
  if (endcard && frames > endStartFrame) {
    const seconds = (frames - endStartFrame) / fps
    segments.push(loop ? { kind: 'opening', seconds, label: 'endcard' } : { kind: 'paper', seconds, label: 'endcard' })
  }

  // The manifest's beats.
  const beats: ManifestBeat[] = content.map((b) => ({ id: b.id, role: b.role, start: r3(frameOf(b.start, fps) / fps), end: r3(frameOf(b.end, fps) / fps) }))
  if (timeline.cta) beats.push({ id: 'cta', role: 'cta', start: r3(frameOf(timeline.cta.start, fps) / fps), end: r3(frameOf(timeline.cta.end, fps) / fps) })
  if (endcard) beats.push({ id: endBeat?.id ?? 'endcard', role: 'endcard', start: endcard.times.start, end: endcard.times.out })

  // Techniques and the proof each must leave on the page.
  const techniques: PlannedTechnique[] = []
  const proofsFor = (name: RendererTechnique) => built.flatMap((b) => b.proofs[name] ?? [])
  for (const name of ['dollar_first_hook', 'question_secret_hook', 'eased_number_reveal', 'meter_fill_verdict', 'send_invite_hook'] as const) {
    const proofs = proofsFor(name)
    if (proofs.length) techniques.push({ name, proofs, detail: detailFor(name) })
  }
  if (captionCues.length) {
    const stills = new Map(stillTimes({ ...plan, cues: captionCues }).map((s) => [s.cueId, s.t]))
    techniques.push({
      name: 'tiktok_caption_burn',
      proofs: captionCues.map((c) => ({ t: stills.get(c.id)!, cue: c.id, text: (c as { text: string }).text })),
      detail: 'every caption card drawn on its words, CAPTION_STYLE (Geist Bold, cream on a navy outline)',
    })
  }
  if (loop && endcard) techniques.push({ name: 'loop_seam_edit', proofs: [], detail: `iris over the last ${LOOP_SECONDS}s opens onto frame 0 (plate and type)` })
  if (input.scored) techniques.push({ name: 'composed_score', proofs: [], detail: 'code-composed score, ducked under the voice, mastered to -14 LUFS' })

  // The manifest's numbers: the brief's rows, then the authored digits each card draws beside them.
  const numbers = briefNumbersToManifest(brief)
  for (const b of built) {
    for (const row of authoredRows(b.cue, b.row)) {
      if (!numbers.some((n) => n.onScreen === row.onScreen)) numbers.push(row)
    }
  }

  return {
    plan,
    subject,
    segments,
    beats,
    endcard: endcard?.times ?? null,
    loop: loop && endcard ? { seconds: LOOP_SECONDS } : null,
    techniques,
    numbers,
    frames,
    duration,
    fps,
    notes,
  }
}

function setupHint(name: string): string {
  switch (name) {
    case 'dollar_first_hook':
      return 'the hook beat\'s first card is a number card'
    case 'question_secret_hook':
      return 'the hook beat has a question card, then a turn card'
    case 'eased_number_reveal':
      return 'a number card on any beat'
    case 'meter_fill_verdict':
      return 'a beat with scene { kind: "meter_fill_verdict", number }'
    default:
      return ''
  }
}

function detailFor(name: RendererTechnique): string {
  switch (name) {
    case 'dollar_first_hook':
      return `a sourced figure fully on screen by ${DOLLAR_FIRST_BY_SECONDS}s`
    case 'question_secret_hook':
      return 'a question card, then the turn under it'
    case 'eased_number_reveal':
      return 'scale 0.92 to 1 and opacity over 12 frames on the brand ease, then the hold drift'
    case 'meter_fill_verdict':
      return 'the months-of-supply meter filling to its value, zone from marketVerdict'
    case 'send_invite_hook':
      return 'a spoken share line on its own card before the end card'
    default:
      return ''
  }
}

/**
 * The cards one beat draws. Hooks first: a number card leading the hook is the
 * dollar-first device; a question then a turn is the question device. A scene
 * is the beat's only card (one idea per beat). Legacy beats draw their `text`
 * and `number` when they carry no cards and no scene.
 */
function beatCards(
  beat: TimelineBeat,
  brief: StudioBrief,
  subject: MotionSubject,
  words: readonly SpokenWord[],
  fps: number,
  problems: string[],
): BuiltCard[] {
  const out: BuiltCard[] = []
  const start = frameOf(beat.start, fps) / fps
  const end = frameOf(beat.end, fps) / fps
  const paper = !beat.footage
  let cards: TimelineCard[] = beat.cards ?? []
  if (!beat.cards && !beat.scene) {
    // Legacy: today's timelines carry a beat's line and figure as plain fields.
    // A figure with its line is one card (the line as its label): one idea per beat.
    if (beat.number !== undefined) {
      if (findNumber(brief, beat.number)) cards = [{ kind: 'number', number: beat.number, ...(beat.text ? { unit: beat.text } : {}) }]
      else problems.push(`beat "${beat.id}": number "${beat.number}" has no brief.numbers row`)
    } else if (beat.text) {
      if (/\d/.test(beat.text)) problems.push(`beat "${beat.id}": text "${beat.text}" has a digit; a figure goes on a number card, never in display words`)
      else cards = [{ kind: 'text', text: beat.text }]
    }
  }
  if (beat.scene && cards.length) problems.push(`beat "${beat.id}": a beat with a scene carries no other card (one idea per beat)`)
  if (cards.length > 2) problems.push(`beat "${beat.id}" has ${cards.length} cards; at most two (one idea per beat, about 4 words of label)`)

  if (beat.scene) {
    const row = findNumber(brief, beat.scene.number)
    if (!row) {
      problems.push(`beat "${beat.id}": scene number "${beat.scene.number}" has no brief.numbers row`)
      return out
    }
    const key = rowKey(row)
    const mos = Number.parseFloat(row.on_screen)
    const verdict = marketVerdict(mos)
    if (!/months?\s+of\s+supply/i.test(`${row.definition} ${key}`) || verdict.kind === 'unknown') {
      problems.push(`beat "${beat.id}": meter_fill_verdict needs a months-of-supply figure; "${row.on_screen}" is defined as "${row.definition}"`)
      return out
    }
    const cardStart = r3(start + CARD_LEAD_SECONDS)
    const cardEnd = r3(end - CARD_CUT_MARGIN_SECONDS)
    if (cardEnd - cardStart < MIN_CARD_SECONDS - 1e-9) problems.push(`beat "${beat.id}": the meter holds ${r3(cardEnd - cardStart)}s; it needs ${MIN_CARD_SECONDS}s`)
    const scoped = figureScope(subject, key)
    const showValue = beat.scene.show_value !== false
    const place = scoped ? `${row.geography} · single-family homes` : row.geography
    const cue: MotionCue = {
      kind: 'meter',
      id: `${beat.id}-meter`,
      start: cardStart,
      end: cardEnd,
      // With no value row the eyebrow says what the meter measures.
      eyebrow: beat.scene.eyebrow ?? (showValue ? place : `${place} · months of supply`),
      value: row.on_screen,
      mos,
      // The zone the meter lights is marketVerdict's kind. Under it, the plain
      // name of the figure (classify.ts): a timeline card already says the
      // number, so the line under the meter says what it measures.
      verdict: MOS_PLAIN_LABEL,
      verdictKind: verdict.kind,
      thresholds: [MOS_SELLER_MAX, MOS_BALANCED_MAX],
      domainMax: Math.max(10, Math.ceil(mos + 1)),
      asOf: figureAsOf(subject, key),
      figureKeys: [key],
      showValue,
      place: { top: CARD_TOPS[0] + 60, paper },
    }
    const still = r3(cardStart + 1.3)
    // The proof is the figure when the meter prints it, else the line that names what it measures.
    const proof = showValue ? row.on_screen : MOS_PLAIN_LABEL
    out.push({ cue, row, proofs: { meter_fill_verdict: [{ t: still, cue: cue.id, text: proof }] } })
    return out
  }

  const isHook = beat.role === 'hook'
  const question = cards.find((c) => c.kind === 'question')
  const turn = cards.find((c) => c.kind === 'turn')
  if ((question || turn) && !isHook) problems.push(`beat "${beat.id}": question and turn cards are the hook's (question_secret_hook)`)
  if (isHook && (question || turn)) {
    if (!question || !turn || cards[0] !== question) {
      problems.push(`beat "${beat.id}": question_secret_hook is a question card, then a turn card`)
      return out
    }
    const w = questionTurnWindows({ start, end }, question.text, words)
    const q: MotionCue = { kind: 'text', id: `${beat.id}-question`, start: w.question.start, end: w.question.end, tone: 'question', eyebrow: null, line: question.text, place: { top: CARD_TOPS[0], paper } }
    const tn: MotionCue = { kind: 'text', id: `${beat.id}-turn`, start: w.turn.start, end: w.turn.end, tone: 'turn', eyebrow: null, line: turn.text, place: { top: CARD_TOPS[1], paper } }
    out.push({
      cue: q,
      proofs: {
        question_secret_hook: [
          { t: r3(w.question.start + ENTER_SECONDS + 0.3), cue: q.id, text: question.text },
          { t: r3(w.turn.start + 1.0), cue: tn.id, text: turn.text },
        ],
      },
    })
    out.push({ cue: tn, proofs: {} })
    return out
  }

  cards.forEach((card, i) => {
    const top = CARD_TOPS[Math.min(i, CARD_TOPS.length - 1)]
    const lead = isHook ? HOOK_LEAD_SECONDS : CARD_LEAD_SECONDS
    const cardStart = r3(start + lead + i * 0.6)
    const cardEnd = r3(end - CARD_CUT_MARGIN_SECONDS)
    if (cardEnd - cardStart < MIN_CARD_SECONDS - 1e-9) {
      problems.push(`beat "${beat.id}": card ${i + 1} holds ${r3(cardEnd - cardStart)}s; nothing readable holds under ${MIN_CARD_SECONDS}s`)
      return
    }
    if (card.kind === 'number') {
      const row = findNumber(brief, card.number)
      if (!row) {
        problems.push(`beat "${beat.id}": number "${card.number}" has no brief.numbers row`)
        return
      }
      const key = rowKey(row)
      const scoped = figureScope(subject, key)
      const leadsHook = isHook && i === 0
      const window = leadsHook ? dollarFirstWindow({ start, end }) : { start: cardStart, end: cardEnd }
      const cue: MotionCue = {
        kind: 'number',
        id: `${beat.id}-number${i ? i + 1 : ''}`,
        start: window.start,
        end: window.end,
        eyebrow: card.eyebrow ?? (scoped ? `${row.geography} · single-family homes` : row.geography),
        value: row.on_screen,
        unit: card.unit ?? null,
        scope: card.footer ?? null,
        asOf: figureAsOf(subject, key),
        figureKeys: [key],
        place: { top, paper },
      }
      const proofs: BuiltCard['proofs'] = {
        eased_number_reveal: [{ t: r3(window.start + REVEAL_SECONDS + 0.3), cue: cue.id, text: row.on_screen }],
      }
      if (leadsHook) proofs.dollar_first_hook = [{ t: DOLLAR_FIRST_BY_SECONDS, cue: cue.id, text: row.on_screen }]
      out.push({ cue, row, proofs })
      return
    }
    if (card.kind === 'text') {
      if (DASH.test(card.text)) problems.push(`beat "${beat.id}": card text has an em or en dash`)
      const cue: MotionCue = {
        kind: 'text',
        id: `${beat.id}-text${i ? i + 1 : ''}`,
        start: cardStart,
        end: cardEnd,
        tone: card.tone ?? (beat.role === 'payoff' ? 'payoff' : 'plain'),
        eyebrow: card.eyebrow ?? null,
        line: card.text,
        place: { top: beat.role === 'payoff' && i === 0 ? CARD_TOPS[0] + 120 : top, paper },
      }
      out.push({ cue, proofs: {} })
    }
  })
  return out
}

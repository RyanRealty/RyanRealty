/**
 * lib/content/process/context.ts - what a step is given and what it hands back.
 *
 * A step reads the brief and the timeline (as written, not as parsed), the
 * stamps of the steps before it, and the factory's own functions through
 * StepDeps. Every seam the tests use is a field here, so a test never reaches
 * for the network, the paid voice, a browser or the real repository.
 */
import type { CheckDeps } from '../../studio/qa/check'
import type { FilmPlan } from '../../studio/timeline/plan'
import type { RenderDeps } from '../../studio/timeline/render'
import type { FilmVoice } from '../../studio/timeline/voice'
import type { ResolvedFootage } from '../../studio/timeline/plan'
import type { ClaimStore } from './caps'
import type { StepId } from './rules'
import type { Stamp, StampProblem } from './stamp'

/** One board shot: a beat at its key moment, full size, with its footage under it. */
export type BoardShot = { beat: string; role: string; t: number; png: Buffer }
export type BoardCapture = { shots: BoardShot[]; sheet: Buffer }
export type BoardInput = { film: FilmPlan; html: string; width: number; height: number; ffmpeg: string; footage: Record<string, ResolvedFootage> }

export type RenderedFilm = { mp4Path: string; manifestPath: string; briefPath: string }

export type StepDeps = {
  /** The factory's own dependencies (render.ts). `voiceProvider` is the paid voice: only step voice is handed it. */
  render: RenderDeps
  /** Test seam: the board capture. Default: the real one (board.ts), through Chromium and ffmpeg. */
  board?: (input: BoardInput, deps: RenderDeps) => Promise<BoardCapture>
  /** Test seam: the master. Default: renderTimelineFilm. */
  master?: (ctx: RunContext) => Promise<RenderedFilm>
  /** Override the voice id (tests); otherwise the named voice's environment variable. */
  voiceId?: string
  /** Test seam: video:check's own deps (a fake Measure, a fake pixel probe, stand-in paths). */
  check?: CheckDeps
}

/** What one run keeps in memory between steps, so the same work is not done twice. */
export type RunState = {
  footage?: Record<string, ResolvedFootage>
  voice?: FilmVoice | null
}

export type RunContext = {
  /** The repository root: where the rules, the registry and the ledger live. */
  root: string
  /** <root>/out: stamps, boards and films land under out/studio/<slug>/. */
  outRoot: string
  briefPath: string
  timelinePath: string
  /** The two files as parsed JSON, before any reader touched them. */
  brief: unknown
  timeline: unknown
  slug: string
  /** Where relative footage paths resolve from: the timeline file's folder. */
  baseDir: string
  /** Footage downloads and voice syntheses are cached here across films. */
  cacheDir: string
  /** out/studio/<slug>: the film's folder. */
  filmDir: string
  ledgerPath?: string
  deps: StepDeps
  claims: ClaimStore
  builder: string
  machine: string
  gitHead: string | null
  rulesVersion: string
  now: () => Date
  /** Which attempt at the step now running this is (1 for the first); the runner sets it before each step. */
  attempt: number
  /** Unbuilt steps the person running chose to pass (--allow-unbuilt-step), by name. */
  allowUnbuilt: readonly StepId[]
  log: (line: string) => void
  state: RunState
}

export type StepResult = {
  problems: StampProblem[]
  outputs: Record<string, unknown>
  status?: Stamp['status']
  /** Set when an unbuilt step was passed with --allow-unbuilt-step. */
  allowUnbuilt?: boolean
}

export type StepStamps = Partial<Record<StepId, Stamp>>

export type StepDef = {
  id: StepId
  /** The parts of what this step reads besides the brief, the timeline and the stamps before it. */
  parts(ctx: RunContext): Promise<Record<string, string>>
  run(ctx: RunContext, stamps: StepStamps): Promise<StepResult>
}

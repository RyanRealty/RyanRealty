/**
 * lib/studio/motion/compose.ts — the Studio's motion stage, end to end.
 *
 * Matt 2026-10-07: code-rendered motion graphics join the Studio as a stage,
 * not a second video factory. Footage comes from Grok or from a pan across a
 * real photo (lib/studio/film.ts and produce.ts); this lays the type over it:
 * the address and price on a listing, the verified months-of-supply meter on a
 * market or place film, and the closing card. "Type and numbers composited in
 * post" (creative-brain PLAYBOOK) and "Type is composited afterward"
 * (docs/GROK_CRAFT_CANON.md), finally done.
 *
 * The same stage draws a paper film whole, with no footage at all: the trend
 * film's verified price line and the map film's outline (Matt 2026-10-07,
 * "incorporate these skills": the prompt-motion.com research). And it scores
 * every film it draws (lib/studio/score), from the plan's own cue times.
 *
 * Outcomes are reported, never thrown, and they are not all equal:
 *  - 'figure-leak' means a number on screen is not a verified figure. The
 *    caller KILLS the draft (CLAUDE.md §0: no trace, no ship).
 *  - Anything else ('no-ffmpeg', 'unsupported-frame', 'nothing-to-draw',
 *    'failed') means the type layer could not run. The caller keeps the plain
 *    footage and records why on the draft, the way film.ts records a film
 *    that degraded to one beat.
 */
import 'server-only'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveFfmpeg } from '@/lib/video/ffmpeg'
import { launchChromium } from '@/lib/browser/launch'
import { composeScore, type ScoreInput, type ScoreResult } from '../score'
import { loadMotionAssets, type MotionAssets } from './assets'
import {
  cueTexts,
  figureLeaks,
  isPaperFilm,
  planMotion,
  stillTimes,
  type MotionPlan,
  type MotionSpec,
  type MotionSubject,
} from './cues'
import { buildMotionPage } from './page'
import { probeVideo, renderMotion, writeTemp, type RenderMotionInput } from './render'
import { scoreFor } from './sound'

/** The canonical frame. Every Studio video format is 9:16. */
export const MOTION_WIDTH = 1080
export const MOTION_HEIGHT = 1920
export const MOTION_FPS = 30

export type ComposeMotionInput = {
  spec: MotionSpec
  subject: MotionSubject
  /** The finished footage: a single clip or a cut film. Null for a paper film. */
  video: Buffer | null
  /** Start time of each beat in a cut film, seconds. Omit for one clip. */
  beats?: number[]
  /** Seeds the score (key, voicing): the draft id, so a re-render is identical. */
  seed?: string
}

/** What the draft row records about the type layer. */
export type MotionRecord = {
  cues: Array<{ id: string; kind: string; start: number; end: number; text: string[]; figureKeys: string[] }>
  notes: string[]
  frames: number
  captured: number
  renderMs: number
  fonts: string[]
  /** The film's length, which a paper film decides for itself. */
  duration: number
  /** What the score was, measured; or why the film is silent. */
  score: Pick<ScoreResult['report'], 'key' | 'chords' | 'lufs' | 'truePeakDb' | 'warnings'> | { silent: string }
}

export type ComposeMotionResult =
  | {
      ok: true
      body: Buffer
      stills: Array<{ cueId: string; t: number; jpg: Buffer }>
      record: MotionRecord
    }
  | {
      ok: false
      reason: 'figure-leak' | 'no-ffmpeg' | 'unsupported-frame' | 'nothing-to-draw' | 'failed'
      error: string
      notes?: string[]
    }

export type ComposeMotionDeps = {
  resolveFfmpeg: () => Promise<string | null>
  loadAssets: (headshotPaths: string[]) => Promise<MotionAssets>
  render: (input: RenderMotionInput) => ReturnType<typeof renderMotion>
  probe: typeof probeVideo
  launchBrowser: RenderMotionInput['launchBrowser']
  composeScore: (input: ScoreInput) => ScoreResult
}

/**
 * Chromium the way the PDF routes get it. Flags from the capture research:
 * one colour profile, no font hinting, no LCD text, and no GPU compositing,
 * whose software path can leave stale raster behind a moving card.
 */
function launchBrowser(viewport: { width: number; height: number }) {
  return launchChromium({
    viewport,
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu-compositing'],
  })
}

const defaultDeps: ComposeMotionDeps = {
  resolveFfmpeg: () => resolveFfmpeg(),
  loadAssets: loadMotionAssets,
  render: renderMotion,
  probe: probeVideo,
  launchBrowser,
  composeScore,
}

function recordFor(plan: MotionPlan): MotionRecord['cues'] {
  return plan.cues.map((cue) => ({
    id: cue.id,
    kind: cue.kind,
    start: Math.round(cue.start * 100) / 100,
    end: Math.round(cue.end * 100) / 100,
    text: cueTexts(cue).filter(Boolean),
    figureKeys: 'figureKeys' in cue ? cue.figureKeys : [],
  }))
}

export async function composeMotion(
  input: ComposeMotionInput,
  deps: ComposeMotionDeps = defaultDeps,
): Promise<ComposeMotionResult> {
  const ffmpeg = await deps.resolveFfmpeg()
  if (!ffmpeg) return { ok: false, reason: 'no-ffmpeg', error: 'ffmpeg is not available in this runtime' }

  let temp: { dir: string; path: string } | null = null
  let scoreDir: string | null = null
  try {
    const paper = isPaperFilm(input.spec)
    let duration = 0
    if (!paper) {
      if (!input.video) return { ok: false, reason: 'failed', error: 'A type layer needs footage to lay over' }
      temp = await writeTemp(input.video, 'plate.mp4')
      const probe = await deps.probe(ffmpeg, temp.path)
      if (!probe) return { ok: false, reason: 'failed', error: 'Could not read the footage duration and size' }
      // The layout is authored for a portrait 9:16 frame. Anything else would
      // crop the footage to fit, so it is refused rather than mangled.
      if (Math.abs(probe.height / probe.width - MOTION_HEIGHT / MOTION_WIDTH) > 0.02) {
        return {
          ok: false,
          reason: 'unsupported-frame',
          error: `Footage is ${probe.width}x${probe.height}; the type layer is drawn for 9:16 only`,
        }
      }
      duration = probe.duration
    }

    const plan = planMotion({ spec: input.spec, subject: input.subject, duration, beats: input.beats })
    if (plan.cues.length === 0) {
      return { ok: false, reason: 'nothing-to-draw', error: plan.notes.join(' ') || 'No cue fits this footage', notes: plan.notes }
    }
    const planned = figureLeaks(plan, input.subject)
    if (planned.length) {
      return { ok: false, reason: 'figure-leak', error: `Unverified number on screen: ${planned.join(', ')}`, notes: plan.notes }
    }

    const headshots = plan.cues.flatMap((cue) =>
      cue.kind === 'closer' && cue.agent?.headshotPath ? [cue.agent.headshotPath] : [],
    )
    const assets = await deps.loadAssets(headshots)
    const html = buildMotionPage({ plan, width: MOTION_WIDTH, height: MOTION_HEIGHT, assets })

    // The score. A score that cannot be made is a silent film, said on the
    // row; it is never a reason to lose the picture.
    let score: MotionRecord['score'] = { silent: 'This format has no score.' }
    let audioPath: string | null = null
    const scoreInput = scoreFor(plan, input.spec, input.subject, input.seed ?? plan.cues.map((c) => c.id).join('|'))
    if (scoreInput) {
      try {
        const composed = deps.composeScore({ ...scoreInput, duration: Math.round(plan.duration * MOTION_FPS) / MOTION_FPS })
        scoreDir = await mkdtemp(join(tmpdir(), 'studio-score-'))
        audioPath = join(scoreDir, 'score.wav')
        await writeFile(audioPath, composed.wav)
        const { key, chords, lufs, truePeakDb, warnings } = composed.report
        score = { key, chords, lufs, truePeakDb, warnings }
      } catch (err) {
        audioPath = null
        score = { silent: `The score could not be made: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown error'}` }
      }
    }

    const rendered = await deps.render({
      plan,
      html,
      width: MOTION_WIDTH,
      height: MOTION_HEIGHT,
      fps: MOTION_FPS,
      basePath: temp?.path ?? null,
      audioPath,
      ffmpeg,
      stills: stillTimes(plan),
      launchBrowser: deps.launchBrowser,
    })

    // Check what the page actually drew, not only what the plan meant to draw.
    const drawn = figureLeaks(plan, input.subject, rendered.renderedText)
    if (drawn.length) {
      return { ok: false, reason: 'figure-leak', error: `Unverified number rendered: ${drawn.join(', ')}`, notes: plan.notes }
    }

    // A card without a still is a number nobody can check from the review
    // card. Say so on the row rather than shipping a quiet gap.
    const pulled = new Set(rendered.stills.map((s) => s.cueId))
    const missing = plan.cues.filter((cue) => !pulled.has(cue.id)).map((cue) => `No still for ${cue.id}: ffmpeg could not pull it.`)

    return {
      ok: true,
      body: rendered.body,
      stills: rendered.stills,
      record: {
        cues: recordFor(plan),
        notes: [...plan.notes, ...missing],
        frames: rendered.frames,
        captured: rendered.captured,
        renderMs: rendered.ms,
        fonts: rendered.fonts.map((f) => `${f.family} ${f.weight}`),
        duration: plan.duration,
        score,
      },
    }
  } catch (err) {
    return { ok: false, reason: 'failed', error: err instanceof Error ? err.message.slice(0, 600) : 'motion stage failed' }
  } finally {
    if (temp) await rm(temp.dir, { recursive: true, force: true }).catch(() => undefined)
    if (scoreDir) await rm(scoreDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

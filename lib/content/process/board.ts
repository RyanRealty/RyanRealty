/**
 * lib/content/process/board.ts - the board: one still per beat at the moment
 * that beat is fully in, at full size, with the footage under it, plus a
 * contact sheet of them all (docs/plans/CONTENT_PROCESS.md, step 4).
 *
 * Nothing is encoded to a film. The page the factory already draws with
 * (lib/studio/motion) is set to each moment and captured with a see-through
 * background, the footage frame under that moment is pulled from the clip
 * itself, and ffmpeg lays one over the other. A beat with no footage sits on
 * the brand cream paper, as it does in the film. Matt looks at this sheet
 * before anything is animated (rules.ts, planned: he sees every board for now).
 *
 * Phase 1 composes in plain RGB, so the stills are what a person sees, not an
 * encode. The palette and logo measure on these pixels is planned in rules.ts.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureMotionStills } from '../../studio/motion/render'
import { stillTimes } from '../../studio/motion/cues'
import { buildContactFilter, findFont, type ContactFrame } from '../../studio/qa/contact'
import { createMeasure, runBinary } from '../../studio/qa/measure'
import type { ManifestBeat } from '../../studio/qa/manifest'
import type { FilmPlan } from '../../studio/timeline/plan'
import type { RenderDeps } from '../../studio/timeline/render'
import type { BoardCapture, BoardInput, BoardShot } from './context'

export const BOARD_WIDTH = 1080
export const BOARD_HEIGHT = 1920
/** The brand cream of the paper beats (lib/video/plate.ts PLATE_CREAM). */
const CREAM = '0xfaf8f4'

const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * The moment each beat is fully in: the latest settled still of any non-caption
 * cue that starts inside the beat (stillTimes), kept inside the beat. A beat no
 * cue starts in takes its midpoint.
 */
export function boardTimes(film: FilmPlan): Array<{ beat: ManifestBeat; t: number }> {
  const stills = stillTimes(film.plan)
  const cues = new Map(film.plan.cues.map((c) => [c.id, c]))
  const frame = 1 / film.fps
  return film.beats.map((beat) => {
    const inside = stills.filter((s) => {
      const cue = cues.get(s.cueId)
      return cue !== undefined && cue.kind !== 'caption' && cue.start >= beat.start - 1e-6 && cue.start < beat.end - 1e-6
    })
    const settled = inside.length ? Math.max(...inside.map((s) => s.t)) : (beat.start + beat.end) / 2
    return { beat, t: r3(Math.min(Math.max(settled, beat.start + 0.05), beat.end - frame)) }
  })
}

export type PlateBase = { kind: 'footage'; path: string; at: number } | { kind: 'paper' }

/** What the plate shows at film time t: the clip and the time in it, or paper. The held opening frame is the first footage's first frame. */
export function plateAt(film: FilmPlan, t: number): PlateBase {
  let start = 0
  for (let i = 0; i < film.segments.length; i++) {
    const seg = film.segments[i]
    const last = i === film.segments.length - 1
    if (t < start + seg.seconds - 1e-9 || last) {
      if (seg.kind === 'footage') return { kind: 'footage', path: seg.path, at: r3(seg.in + Math.max(0, t - start)) }
      if (seg.kind === 'opening') {
        const first = film.segments.find((s) => s.kind === 'footage')
        return first && first.kind === 'footage' ? { kind: 'footage', path: first.path, at: first.in } : { kind: 'paper' }
      }
      return { kind: 'paper' }
    }
    start += seg.seconds
  }
  return { kind: 'paper' }
}

/** The overlay laid over the base, as one full-size PNG. Plain RGB: the still is what a person sees. */
export async function composeStill(ffmpeg: string, overlay: Buffer, base: Buffer | null): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'rr-board-'))
  try {
    const fg = join(dir, 'overlay.png')
    const out = join(dir, 'still.png')
    writeFileSync(fg, overlay)
    const baseInput = base ? (writeFileSync(join(dir, 'base.png'), base), ['-i', join(dir, 'base.png')]) : ['-f', 'lavfi', '-i', `color=c=${CREAM}:s=${BOARD_WIDTH}x${BOARD_HEIGHT},format=rgb24`]
    // The footage is scaled to cover and centre-cropped, as the plate does (lib/video/plate.ts coverCrop).
    const bg = base ? `[1:v]scale=${BOARD_WIDTH}:${BOARD_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${BOARD_WIDTH}:${BOARD_HEIGHT},setsar=1,format=rgba[bg]` : '[1:v]setsar=1,format=rgba[bg]'
    const r = await runBinary(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', fg, ...baseInput,
      '-filter_complex', `${bg};[0:v]setsar=1,format=rgba[fg];[bg][fg]overlay=0:0:format=auto,format=rgb24[v]`,
      '-map', '[v]', '-frames:v', '1', out,
    ])
    if (r.code !== 0) throw new Error(`ffmpeg could not lay the page over the footage: ${r.stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`)
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The board contact sheet: every still, labelled with its time and beat, four to a row. */
export async function boardSheet(ffmpeg: string, shots: ReadonlyArray<{ t: number; label: string; png: Buffer }>): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'rr-board-sheet-'))
  try {
    const files = shots.map((s, i) => {
      const f = join(dir, `s${String(i).padStart(3, '0')}.png`)
      writeFileSync(f, s.png)
      return f
    })
    const frames: ContactFrame[] = shots.map((s) => ({ t: s.t, tag: s.label }))
    const out = join(dir, 'sheet.png')
    const run = (font: string | null) =>
      runBinary(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', buildContactFilter(frames, font), '-map', '[o]', '-frames:v', '1', out])
    const font = findFont()
    let r = font ? await run(font) : null
    if (!r || r.code !== 0) r = await run(null)
    if (r.code !== 0) throw new Error(`ffmpeg could not tile the board sheet: ${r.stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`)
    return readFileSync(out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The three things the capture does through a browser or ffmpeg, as one seam. */
export type BoardIo = {
  overlays: typeof captureMotionStills
  compose: typeof composeStill
  sheet: typeof boardSheet
}

export const realBoardIo: BoardIo = { overlays: captureMotionStills, compose: composeStill, sheet: boardSheet }

/** Capture the board for a planned film. */
export async function captureBoard(input: BoardInput, deps: RenderDeps, io: BoardIo = realBoardIo): Promise<BoardCapture> {
  const moments = boardTimes(input.film)
  const times = [...new Set(moments.map((m) => m.t))].sort((a, b) => a - b)
  const overlays = await io.overlays({ plan: input.film.plan, html: input.html, width: input.width, height: input.height, times, launchBrowser: deps.launchBrowser })
  const measure = deps.measure ?? createMeasure()
  const shots: BoardShot[] = []
  for (const { beat, t } of moments) {
    const overlay = overlays.find((o) => Math.abs(o.t - t) < 1e-9)
    if (!overlay) throw new Error(`the page gave no capture for beat "${beat.id}" at ${t}s`)
    const base = plateAt(input.film, t)
    const frame = base.kind === 'footage' ? await measure.frameAt(base.path, base.at) : null
    shots.push({ beat: beat.id, role: beat.role, t, png: await io.compose(input.ffmpeg, overlay.png, frame) })
  }
  const sheet = await io.sheet(input.ffmpeg, shots.map((s) => ({ t: s.t, label: `${s.beat}`, png: s.png })))
  return { shots, sheet }
}

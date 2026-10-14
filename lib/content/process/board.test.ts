/**
 * The board: one still per beat at its key moment, footage under it, and a
 * contact sheet. The planning (which moment, which footage frame) is tested on
 * the planned film; the ffmpeg half runs against synthetic images in a temp
 * folder only, and is skipped where ffmpeg is not installed.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runBinary, studioBinaries } from '../../studio/qa/measure'
import type { FilmPlan } from '../../studio/timeline/plan'
import { BOARD_HEIGHT, BOARD_WIDTH, boardSheet, boardTimes, captureBoard, composeStill, plateAt, type BoardIo } from './board'
import type { RunContext } from './context'
import { runSteps } from './run'
import { planTheFilm } from './steps/board'
import { makeHarness } from './test-harness'

let film: FilmPlan
let dir = ''
let harnessDeps: ReturnType<typeof makeHarness>['deps']

beforeAll(async () => {
  const h = makeHarness()
  harnessDeps = h.deps
  const r = await runSteps({ briefPath: h.briefPath, timelinePath: h.timelinePath, root: h.dir, outRoot: h.outRoot, deps: h.deps, freshness: () => ({ ok: true, head: 'a', main: 'a' }), claims: h.claims, ledgerPath: h.ledgerPath, to: 'stills' })
  expect(r.ok).toBe(true)
  const ctx = {
    brief: JSON.parse(readFileSync(h.briefPath, 'utf8')), timeline: JSON.parse(readFileSync(h.timelinePath, 'utf8')), state: {}, deps: h.deps, outRoot: h.outRoot,
    cacheDir: join(h.outRoot, 'studio', '.cache'), baseDir: h.work, slug: 'bend-go-in-with-a-plan',
  } as unknown as RunContext
  film = (await planTheFilm(ctx, r.outcomes[2].stamp!.outputs.clips, false)).film
  dir = mkdtempSync(join(tmpdir(), 'rr-board-test-'))
})
afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('boardTimes: the moment each beat is fully in', () => {
  it('gives one moment per beat, each inside its own beat', () => {
    const moments = boardTimes(film)
    expect(moments.map((m) => m.beat.id)).toEqual(film.beats.map((b) => b.id))
    for (const { beat, t } of moments) {
      expect(t, beat.id).toBeGreaterThan(beat.start)
      expect(t, beat.id).toBeLessThan(beat.end)
    }
  })

  it('takes the end card at the frame the golden is taken: half a second after Call now', () => {
    const end = boardTimes(film).find((m) => m.beat.role === 'endcard')!
    expect(end.t).toBeCloseTo(film.endcard!.call + 0.5, 2)
  })
})

describe('plateAt: what is under the page at a moment', () => {
  it('names the clip and the time in it for a footage beat, and paper where a beat has none', () => {
    const hook = film.beats[0]
    const seg = film.segments[0]
    expect(seg.kind).toBe('footage')
    const at = plateAt(film, hook.start + 1)
    expect(at).toMatchObject({ kind: 'footage' })
    if (seg.kind === 'footage' && at.kind === 'footage') {
      expect(at.path).toBe(seg.path)
      expect(at.at).toBeCloseTo(seg.in + 1, 2)
    }
    const payoff = film.beats.find((b) => b.id === 'plan')!
    expect(plateAt(film, (payoff.start + payoff.end) / 2)).toEqual({ kind: 'paper' })
  })

  it('holds the first frame of the first clip under the end card (the loop seam)', () => {
    const first = film.segments.find((s) => s.kind === 'footage')!
    const end = film.beats.find((b) => b.role === 'endcard')!
    const at = plateAt(film, end.start + 0.5)
    expect(first.kind === 'footage' && at).toEqual({ kind: 'footage', path: first.kind === 'footage' ? first.path : '', at: first.kind === 'footage' ? first.in : 0 })
  })
})

describe('captureBoard with its browser and ffmpeg faked', () => {
  it('captures every moment once, pulls the footage frame under it at the source time, and tiles the sheet', async () => {
    const asked: number[][] = []
    const frames: Array<[string, number]> = []
    const composed: Array<Buffer | null> = []
    const io: BoardIo = {
      overlays: async (input) => {
        asked.push(input.times)
        return input.times.map((t) => ({ t, png: Buffer.from(`overlay@${t}`) }))
      },
      compose: async (_ffmpeg, overlay, base) => {
        composed.push(base)
        return Buffer.from(`still:${overlay.toString()}|${base ? base.toString() : 'paper'}`)
      },
      sheet: async (_ffmpeg, shots) => Buffer.from(`sheet:${shots.map((s) => s.label).join(',')}`),
    }
    const measure = { ...harnessDeps.render.measure!, frameAt: async (path: string, t: number) => (frames.push([path, t]), Buffer.from(`frame@${t}`)) }
    const out = await captureBoard({ film, html: '<html/>', width: BOARD_WIDTH, height: BOARD_HEIGHT, ffmpeg: 'ffmpeg', footage: {} }, { ...harnessDeps.render, measure }, io)
    expect(asked).toHaveLength(1)
    expect(out.shots.map((s) => s.beat)).toEqual(film.beats.map((b) => b.id))
    expect(out.sheet.toString()).toBe(`sheet:${film.beats.map((b) => b.id).join(',')}`)
    // Footage beats pull a frame from their clip; the paper beat (the outline) and nothing else gets none under it.
    expect(composed.filter((b) => b === null)).toHaveLength(1)
    expect(frames.length).toBe(film.beats.length - 1)
  })

  it('names the beat when the page gave no capture for it', async () => {
    const io: BoardIo = { overlays: async () => [], compose: async () => Buffer.from(''), sheet: async () => Buffer.from('') }
    await expect(captureBoard({ film, html: '', width: BOARD_WIDTH, height: BOARD_HEIGHT, ffmpeg: 'ffmpeg', footage: {} }, harnessDeps.render, io)).rejects.toThrow(/gave no capture for beat "hook"/)
  })
})

const ffmpeg = (() => {
  try {
    return studioBinaries().ffmpeg
  } catch {
    return null
  }
})()

/** A solid PNG made by ffmpeg itself, in the temp folder. */
async function solid(name: string, color: string, size: string, alpha = false): Promise<Buffer> {
  const file = join(dir, name)
  // The alpha has to be set inside the lavfi graph: a colour source made opaque cannot be given alpha afterwards.
  const r = await runBinary(ffmpeg!, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=${size}${alpha ? ',format=rgba' : ''}`, '-frames:v', '1', file])
  expect(r.code, r.stderr).toBe(0)
  return readFileSync(file)
}

async function dims(png: Buffer): Promise<{ w: number; h: number; pix: string }> {
  const file = join(dir, `probe-${Math.random().toString(36).slice(2)}.png`)
  writeFileSync(file, png)
  const ffprobe = join(ffmpeg!, '..', 'ffprobe')
  const r = await runBinary(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'csv=p=0', file])
  const [w, h, pix] = r.stdout.toString().trim().split(',')
  return { w: Number(w), h: Number(h), pix }
}

describe.skipIf(!ffmpeg)('composeStill and boardSheet with real ffmpeg, on synthetic images', () => {
  it('lays the page over a footage frame of another shape, covered and cropped to 1080 by 1920', async () => {
    const overlay = await solid('overlay.png', '0x102742@0.5', `${BOARD_WIDTH}x${BOARD_HEIGHT}`, true)
    const footage = await solid('footage.png', 'orange', '640x360')
    const out = await composeStill(ffmpeg!, overlay, footage)
    expect(await dims(out)).toMatchObject({ w: BOARD_WIDTH, h: BOARD_HEIGHT })
  })

  it('lays the page over the cream paper when a beat has no footage', async () => {
    const overlay = await solid('overlay2.png', '0x102742@0.0', `${BOARD_WIDTH}x${BOARD_HEIGHT}`, true)
    const out = await composeStill(ffmpeg!, overlay, null)
    expect(await dims(out)).toMatchObject({ w: BOARD_WIDTH, h: BOARD_HEIGHT })
    // A fully see-through page leaves the paper: read one pixel back as cream (#faf8f4).
    const file = join(dir, 'paper.png')
    writeFileSync(file, out)
    const px = await runBinary(ffmpeg!, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', 'crop=1:1:100:100,format=rgb24', '-f', 'rawvideo', 'pipe:1'])
    expect([...px.stdout]).toEqual([0xfa, 0xf8, 0xf4])
  })

  it('tiles the stills into one contact sheet', async () => {
    const a = await solid('a.png', 'red', `${BOARD_WIDTH}x${BOARD_HEIGHT}`)
    const sheet = await boardSheet(ffmpeg!, [{ t: 1, label: 'hook', png: a }, { t: 4, label: 'supply', png: a }, { t: 7, label: 'plan', png: a }])
    const d = await dims(sheet)
    expect(d.w).toBeGreaterThan(300)
    expect(d.h).toBeGreaterThan(400)
  })
})

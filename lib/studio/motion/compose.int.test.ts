/**
 * The motion stage against real Chromium and real ffmpeg.
 *
 * The plate is a solid colour, so every claim is a pixel: the card blends
 * navy over the footage at the scrim's opacity, the footage outside the card
 * comes through unchanged (no bt601 shift), nothing is drawn before the first
 * card, and the brand fonts actually loaded.
 *
 * Needs a local Chrome and ffmpeg. Skips loudly without them, like the PDF
 * page-contract test; `test:int` is where it must pass.
 */
import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeMotion } from './compose'
import { MOTION_ENCODE_ARGS, paperGraph } from './render'
import { planMotion, type MotionSubject } from './cues'
import { resolveFfmpeg } from '@/lib/video/ffmpeg'

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome')
const hasChrome = existsSync(CHROME)

// The plate colour, and the navy and scrim opacity the lead card uses.
const PLATE = [74, 122, 58] as const
const NAVY = [16, 39, 66] as const
const SCRIM = 0.78

function pixel(ffmpeg: string, video: string, t: number, x: number, y: number): number[] {
  const raw = execFileSync(ffmpeg, [
    '-loglevel', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1',
    '-vf', `scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24,crop=1:1:${x}:${y}`,
    '-f', 'rawvideo', '-',
  ])
  return [raw[0], raw[1], raw[2]]
}

/**
 * The mean of a size x size block around (x, y). A small mark under CRF 20 picks
 * up a few levels of codec noise in any one pixel; the mean is the colour.
 */
function blockMean(ffmpeg: string, video: string, t: number, x: number, y: number, size = 6): number[] {
  const half = Math.floor(size / 2)
  const raw = execFileSync(ffmpeg, [
    '-loglevel', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1',
    '-vf', `scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24,crop=${size}:${size}:${x - half}:${y - half}`,
    '-f', 'rawvideo', '-',
  ])
  const sum = [0, 0, 0]
  for (let i = 0; i < raw.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += raw[i + c]
  return sum.map((v) => v / (raw.length / 3))
}

describe.skipIf(!hasChrome)('composeMotion with real Chromium and ffmpeg', () => {
  it('lays a navy card over the footage without shifting the footage colour', async () => {
    const ffmpeg = await resolveFfmpeg()
    expect(ffmpeg, 'ffmpeg must resolve on a machine with Chrome').toBeTruthy()
    const dir = mkdtempSync(join(tmpdir(), 'motion-int-'))
    try {
      const platePath = join(dir, 'plate.mp4')
      const hex = PLATE.map((c) => c.toString(16).padStart(2, '0')).join('')
      execFileSync(ffmpeg!, [
        '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x${hex}:s=1080x1920:d=6:r=24`,
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
        '-c:v', 'libx264', '-crf', '12', '-colorspace', 'bt709', '-color_range', 'tv', platePath,
      ])

      const result = await composeMotion({
        spec: { lead: 'market', closer: 'brand' },
        subject: {
          label: 'Bend, Oregon',
          figures: { 'months of supply': '3.5' },
          citations: [{ figure: '3.5', computed_at: '2026-10-06T14:00:00.000Z' }],
        },
        video: readFileSync(platePath),
      })
      if (!result.ok) throw new Error(`${result.reason}: ${result.error}`)

      const out = join(dir, 'final.mp4')
      writeFileSync(out, result.body)
      expect(result.record.frames).toBeGreaterThanOrEqual(179)
      expect(result.record.captured).toBeLessThan(result.record.frames)
      expect(result.record.fonts).toHaveLength(6)
      expect(result.stills.map((s) => s.cueId)).toEqual(['lead1', 'closer'])

      // Inside the lead card's padding, mid-hold: scrim navy over the plate.
      // The plate as it decodes, which is the reference: synthesising it from
      // an RGB colour already moves it a few levels, and that is not ours.
      const plate = pixel(ffmpeg!, platePath, 2.0, 540, 200)
      const card = pixel(ffmpeg!, out, 2.0, 110, 1460)
      const expected = plate.map((p, i) => SCRIM * NAVY[i] + (1 - SCRIM) * p)
      card.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(6))

      // Outside every card: the footage as it was.
      const open = pixel(ffmpeg!, out, 2.0, 540, 200)
      open.forEach((v, i) => expect(Math.abs(v - plate[i])).toBeLessThanOrEqual(3))

      // Before the first card: nothing drawn at all.
      const before = pixel(ffmpeg!, out, 0.1, 110, 1460)
      before.forEach((v, i) => expect(Math.abs(v - plate[i])).toBeLessThanOrEqual(3))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 120_000)

  it('draws a paper film whole, on cream, with its score muxed at -14 LUFS', async () => {
    const ffmpeg = await resolveFfmpeg()
    expect(ffmpeg).toBeTruthy()
    const dir = mkdtempSync(join(tmpdir(), 'motion-paper-int-'))
    try {
      const values = [815000, 775000, 741250, 774900, 734900, 794500, 839750, 837000, 734950, 761574, 795000, 766750]
      const subject: MotionSubject = {
        label: 'Bend, Oregon',
        figures: { 'months of supply': '3.5', 'median sale price, Oct 2024': '$815,000', 'median sale price, Sep 2025': '$766,750' },
        citations: [
          { figure: '3.5', computed_at: '2026-10-06T14:00:00.000Z' },
          { figure: '$815,000', computed_at: '2026-10-01T00:00:00.000Z' },
          { figure: '$766,750', computed_at: '2026-10-01T00:00:00.000Z' },
        ],
        series: {
          title: 'Median sale price',
          scope: 'Detached single-family homes sold in Bend, by month',
          points: values.map((value, i) => ({ tick: i === 0 ? 'Oct 2024' : i === 11 ? 'Sep 2025' : `m${i}`, value })),
          firstKey: 'median sale price, Oct 2024',
          lastKey: 'median sale price, Sep 2025',
        },
      }
      const spec = { lead: 'trend' as const, closer: 'brand' as const, sound: 'measured' as const }
      const result = await composeMotion({ spec, subject, video: null, seed: 'int-paper' })
      if (!result.ok) throw new Error(`${result.reason}: ${result.error}`)
      const out = join(dir, 'final.mp4')
      writeFileSync(out, result.body)
      expect(result.record.score).toMatchObject({ lufs: expect.any(Number) })

      // Paper: cream where nothing is drawn, at the brand's code values.
      const paper = pixel(ffmpeg!, out, 4.5, 540, 1760)
      paper.forEach((v, i) => expect(Math.abs(v - [250, 248, 244][i])).toBeLessThanOrEqual(3))
      // The dot has landed on the latest month: brand navy, no colour shift.
      const plan = planMotion({ spec, subject, duration: 0 })
      const chart = plan.cues.find((c) => c.kind === 'chart')
      if (chart?.kind !== 'chart') throw new Error('no chart cue')
      // Mid-hold: the line has landed (drawStart + 2.4 s) and the chart has not begun to leave.
      // A 20px mark carries a few levels of codec ringing; the colour path
      // itself is held to 3 levels on a solid frame below.
      const dot = blockMean(ffmpeg!, out, 4.5, Math.round(chart.last.x), Math.round(chart.last.y))
      dot.forEach((v, i) => expect(Math.abs(v - NAVY[i])).toBeLessThanOrEqual(10))

      // The file carries the score: AAC, the film's length, -14 LUFS after
      // the encode and still under -1 dBTP.
      const banner = spawnSync(ffmpeg!, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr
      expect(banner).toMatch(/Audio: aac/)
      const meter = spawnSync(ffmpeg!, ['-hide_banner', '-nostats', '-i', out, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      }).stderr
      const summary = meter.slice(meter.lastIndexOf('Summary:'))
      const integrated = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1])
      const peak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1])
      expect(Math.abs(integrated - -14)).toBeLessThanOrEqual(1)
      expect(peak).toBeLessThanOrEqual(-1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 180_000)

  it('the paper colour path lands brand navy on its code values', async () => {
    const ffmpeg = await resolveFfmpeg()
    expect(ffmpeg).toBeTruthy()
    const dir = mkdtempSync(join(tmpdir(), 'motion-paper-colour-'))
    try {
      // A solid navy page as Chromium hands it over: an RGBA PNG.
      const png = join(dir, 'navy.png')
      execFileSync(ffmpeg!, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x102742:s=256x256', '-frames:v', '1', '-pix_fmt', 'rgba', png])
      const out = join(dir, 'navy.mp4')
      execFileSync(ffmpeg!, [
        '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-t', '1', '-i', png,
        '-filter_complex', paperGraph(), '-map', '[v]', '-an', ...MOTION_ENCODE_ARGS, out,
      ])
      // The reference is the PNG as it decodes: ffmpeg's colour source already
      // moves a level or two, and that is not the path under test.
      const source = execFileSync(ffmpeg!, ['-loglevel', 'error', '-i', png, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
      const reference = [source[0], source[1], source[2]]
      reference.forEach((v, i) => expect(Math.abs(v - NAVY[i])).toBeLessThanOrEqual(3))
      const centre = blockMean(ffmpeg!, out, 0.5, 128, 128, 16)
      centre.forEach((v, i) => expect(Math.abs(v - reference[i])).toBeLessThanOrEqual(3))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})

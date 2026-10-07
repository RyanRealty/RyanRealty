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
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composeMotion } from './compose'
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
})

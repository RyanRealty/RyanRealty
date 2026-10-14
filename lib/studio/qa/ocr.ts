/**
 * lib/studio/qa/ocr.ts - read the words a box of the film actually shows.
 *
 * video:check check 17 ("Pixels") must not take the manifest's word for what is
 * on screen: a hand-written manifest could claim captions or figures the film
 * never drew. So each claimed caption and each claimed figure is read back off
 * its own box at its own time with tesseract.
 *
 * Full-frame OCR over drone footage is noise (it read "3.5" as "3.0" and found
 * "7%" in a river), so the box is cleaned first, in plain TypeScript:
 *  - 'card': cream type on the navy panel. Keep the light, unsaturated pixels.
 *    A card on cream paper (more than half the box is light) is navy type:
 *    then the dark pixels are the ink.
 *  - 'caption': cream type with a navy outline over moving footage. Keep the
 *    light pixels that sit within reach of navy outline pixels, so bright sky
 *    or foam far from any outline drops out.
 * The cleaned box becomes black type on white (a PGM, which tesseract reads)
 * and is read as one block and as one line; both readings are returned.
 *
 * The pure parts (cleaning, matching) are exported for tests; the binaries
 * (ffmpeg for the crop, tesseract for the reading) are injected.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runBinary } from './measure'
import { extractNumberTokens } from './spoken'

export type OcrBox = { x: number; y: number; w: number; h: number }
export type OcrMode = 'card' | 'caption'

/** How much the crop is enlarged before reading: tesseract wants letters 30 px or taller. */
export const OCR_SCALE = 2
/** Air around a claimed box, film px, so a letter's edge is never cut. */
export const OCR_PAD = 14

/**
 * A light, unsaturated pixel: cream type (#faf8f4) after the codec. On a card
 * the floor is lower: the panel is dark navy, and the footer and scale marks
 * are cream at 62 to 72% (about 170 to 185 after blending).
 */
export function isLight(r: number, g: number, b: number, floor = 190): boolean {
  const lo = Math.min(r, g, b)
  const hi = Math.max(r, g, b)
  return lo >= floor && hi - lo <= 50
}

const LIGHT_FLOOR: Record<OcrMode, number> = { card: 140, caption: 190 }

/** A navy outline pixel (#102742 after the codec): dark and blue leaning. */
export function isNavy(r: number, g: number, b: number): boolean {
  return r <= 70 && g <= 90 && b <= 120 && b >= r
}

/**
 * Clean an RGB crop to black type on white. Pure: same pixels, same mask.
 * `reach` is how far (px, at the crop's scale) a caption pixel may be from an
 * outline pixel and still count as type.
 */
export function cleanForOcr(rgb: Uint8Array, width: number, height: number, mode: OcrMode, reach = 10 * OCR_SCALE): Uint8Array {
  const n = width * height
  const light = new Uint8Array(n)
  const navy = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3]
    const g = rgb[i * 3 + 1]
    const b = rgb[i * 3 + 2]
    light[i] = isLight(r, g, b, LIGHT_FLOOR[mode]) ? 1 : 0
    navy[i] = isNavy(r, g, b) ? 1 : 0
  }
  let near: Uint8Array | null = null
  if (mode === 'caption') {
    // Summed-area table of the navy mask: "is there navy within reach" in O(1) per pixel.
    const sat = new Uint32Array((width + 1) * (height + 1))
    for (let y = 0; y < height; y++) {
      let row = 0
      for (let x = 0; x < width; x++) {
        row += navy[y * width + x]
        sat[(y + 1) * (width + 1) + (x + 1)] = sat[y * (width + 1) + (x + 1)] + row
      }
    }
    near = new Uint8Array(n)
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - reach)
      const y1 = Math.min(height, y + reach + 1)
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - reach)
        const x1 = Math.min(width, x + reach + 1)
        const sum = sat[y1 * (width + 1) + x1] - sat[y0 * (width + 1) + x1] - sat[y1 * (width + 1) + x0] + sat[y0 * (width + 1) + x0]
        near[y * width + x] = sum > 0 ? 1 : 0
      }
    }
  }
  // A card drawn on cream paper is navy type on a light ground: then the ink is the dark pixels.
  let lightCount = 0
  for (let i = 0; i < n; i++) lightCount += light[i]
  const paper = mode === 'card' && lightCount > n / 2
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const ink = paper
      ? Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) < 140
      : light[i] === 1 && (near === null || near[i] === 1)
    out[i] = ink ? 0 : 255
  }
  return out
}

/** A binary PGM (P5) image: tesseract reads it through leptonica. */
export function toPgm(gray: Uint8Array, width: number, height: number): Buffer {
  const header = Buffer.from(`P5\n${width} ${height}\n255\n`, 'ascii')
  return Buffer.concat([header, Buffer.from(gray)])
}

/** Lowercase words of two or more letters or digits. */
export function ocrWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z0-9'%$.]+/)
    .map((w) => w.replace(/^[.']+|[.']+$/g, ''))
    .filter((w) => w.length >= 2)
}

const digits = (s: string) => s.replace(/[^0-9]/g, '')

/**
 * Does the reading show this figure? Compared on its digits, so a period the
 * reader dropped ("35" for "3.5") still counts, but a different number never does.
 */
export function readingShowsFigure(reading: string, figure: string): boolean {
  const want = digits(figure)
  if (!want) return false
  return extractNumberTokens(reading).some((t) => digits(t) === want) || digits(reading.replace(/\s+/g, '')).includes(want)
}

/**
 * Does the reading show this caption? Each word of three or more letters the
 * caption says counts; at least half must be read (at least one), and every
 * figure in it must be read. A caption of short words only ("So") needs one of
 * them read.
 */
export function readingShowsCaption(reading: string, caption: string): { ok: boolean; seen: number; of: number } {
  // Letters only, run together: tesseract often reads a word space as nothing ("SoBend").
  const letters = reading.toLowerCase().replace(/[^a-z]/g, '')
  const figures = extractNumberTokens(caption)
  const words = ocrWords(caption).filter((w) => !/\d/.test(w)).map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean)
  const long = words.filter((w) => w.length >= 3)
  const pool = long.length ? long : words
  const seen = pool.filter((w) => letters.includes(w)).length
  const figuresOk = figures.every((f) => readingShowsFigure(reading, f))
  const enough = pool.length === 0 ? true : seen >= Math.max(1, Math.ceil(pool.length / 2))
  return { ok: figuresOk && enough, seen, of: pool.length }
}

export type OcrDeps = {
  ffmpeg: string
  tesseract?: string
}

/** Read one box of the film at time t. Throws when ffmpeg or tesseract cannot run. */
export async function readBox(mp4: string, t: number, box: OcrBox, mode: OcrMode, deps: OcrDeps): Promise<string> {
  const x = Math.max(0, Math.floor(box.x - OCR_PAD))
  const y = Math.max(0, Math.floor(box.y - OCR_PAD))
  const w = Math.min(1080 - x, Math.ceil(box.w + 2 * OCR_PAD))
  const h = Math.min(1920 - y, Math.ceil(box.h + 2 * OCR_PAD))
  if (w < 4 || h < 4) return ''
  const W = w * OCR_SCALE
  const H = h * OCR_SCALE
  const seek = Math.floor(Math.max(0, t) * 1000) / 1000
  const r = await runBinary(deps.ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-ss', seek.toFixed(3), '-i', mp4, '-frames:v', '1',
    '-vf', `crop=${w}:${h}:${x}:${y},scale=${W}:${H}:flags=lanczos,scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24`,
    '-f', 'rawvideo', 'pipe:1',
  ])
  if (r.code !== 0 || r.stdout.length !== W * H * 3) throw new Error(`could not crop the frame at ${t}s for OCR: ${r.stderr.trim().split(/\r?\n/).slice(-1)[0] ?? ''}`)
  const clean = cleanForOcr(new Uint8Array(r.stdout), W, H, mode)
  const dir = mkdtempSync(join(tmpdir(), 'rr-ocr-'))
  try {
    const file = join(dir, 'box.pgm')
    writeFileSync(file, toPgm(clean, W, H))
    const out: string[] = []
    for (const psm of ['6', '7']) {
      const read = await runBinary(deps.tesseract ?? 'tesseract', [file, '-', '--psm', psm])
      if (read.code !== 0) throw new Error(`tesseract exited ${read.code}: ${read.stderr.trim().split(/\r?\n/).slice(-1)[0] ?? ''}`)
      out.push(read.stdout.toString('utf8'))
    }
    return out.join(' ').replace(/\s+/g, ' ').trim()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

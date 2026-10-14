/**
 * lib/studio/qa/contact.ts - the contact sheet a reviewer looks at (`<name>.contact.png`).
 *
 * A 4-column grid of frames at: t=0, every beat's start + 0.3 s and midpoint, the
 * type's hook_max_s, endcard.call + 0.5 s, and the last frame. Each frame is
 * labelled with its time by ffmpeg drawtext when a font file exists; when it
 * does not, the sheet is still written, unlabelled, and the result says so.
 *
 * ffmpeg's `tile` filter does the layout, so no image library is needed.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import type { Manifest } from './manifest'
import { measure as realMeasure, resolveBinary, runBinary, type Measure } from './measure'

export const CONTACT_COLUMNS = 4
const CELL_W = 270
const CELL_H = 480
/** Frames closer together than this are one frame. */
const MERGE_SECONDS = 0.05

export interface ContactFrame {
  t: number
  tag: string
}

/** The times the sheet samples, sorted, clamped to the film, and de-duplicated. */
export function contactFrames(manifest: Manifest, hookMaxS: number, duration: number, fps: number): ContactFrame[] {
  const last = Math.max(0, duration - 1 / fps)
  const raw: ContactFrame[] = [{ t: 0, tag: 'start' }]
  for (const b of manifest.beats) {
    raw.push({ t: b.start + 0.3, tag: `${b.id} +0.3` })
    raw.push({ t: (b.start + b.end) / 2, tag: `${b.id} mid` })
  }
  raw.push({ t: hookMaxS, tag: 'hook limit' })
  if (manifest.endcard) raw.push({ t: manifest.endcard.call + 0.5, tag: 'call +0.5' })
  raw.push({ t: last, tag: 'last' })
  const clamped = raw.map((f) => ({ t: Math.min(Math.max(0, f.t), last), tag: f.tag })).sort((a, b) => a.t - b.t)
  const out: ContactFrame[] = []
  for (const f of clamped) {
    const prev = out[out.length - 1]
    if (prev && f.t - prev.t < MERGE_SECONDS) {
      // The last frame is the one the loop check reads; keep its tag when it merges.
      if (f.tag === 'last') prev.tag = `${prev.tag} / last`
      continue
    }
    out.push({ ...f })
  }
  return out
}

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/opentype/inter/Inter-Regular.otf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/Library/Fonts/Arial.ttf',
]

/** A font file for drawtext: env QA_FONT_FILE, else the first common path that exists. */
export function findFont(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): string | null {
  const fromEnv = env.QA_FONT_FILE?.trim()
  if (fromEnv && exists(fromEnv)) return fromEnv
  return FONT_CANDIDATES.find((p) => exists(p)) ?? null
}

/** Label text safe inside a single-quoted drawtext value. */
export function labelText(f: ContactFrame): string {
  return `${f.t.toFixed(2)}s ${f.tag}`.replace(/[^A-Za-z0-9 .+/_-]/g, '')
}

/** The filter graph that scales, labels and tiles N single-frame inputs. */
export function buildContactFilter(frames: readonly ContactFrame[], font: string | null, columns = CONTACT_COLUMNS): string {
  const rows = Math.ceil(frames.length / columns)
  const chains = frames.map((f, i) => {
    const label = font
      ? `,drawtext=fontfile=${font}:text='${labelText(f)}':fontcolor=white:fontsize=20:box=1:boxcolor=0x102742@0.85:boxborderw=5:x=6:y=6`
      : ''
    return `[${i}:v]scale=${CELL_W}:${CELL_H}:flags=area,setsar=1${label},format=rgb24[v${i}]`
  })
  const inputs = frames.map((_, i) => `[v${i}]`).join('')
  return `${chains.join(';')};${inputs}concat=n=${frames.length}:v=1:a=0,tile=${columns}x${rows}:padding=6:margin=6:color=0xfaf8f4[o]`
}

export interface ContactOptions {
  mp4Path: string
  manifest: Manifest
  /** The type's hook_max_s, from video_types.json. */
  hookMaxS: number
  /** Defaults to `<name>.contact.png` beside the MP4. */
  outPath?: string
  measure?: Measure
}

export interface ContactResult {
  path: string
  frames: ContactFrame[]
  labelled: boolean
  /** Why labels were skipped, or null. */
  note: string | null
}

/** Write the contact sheet PNG. Throws when frames cannot be read or ffmpeg fails. */
export async function writeContactSheet(opts: ContactOptions): Promise<ContactResult> {
  const m = opts.measure ?? realMeasure
  const info = await m.probe(opts.mp4Path)
  const frames = contactFrames(opts.manifest, opts.hookMaxS, info.videoDuration, info.fps)
  const outPath = opts.outPath ?? join(dirname(opts.mp4Path), `${basename(opts.mp4Path).replace(/\.mp4$/i, '')}.contact.png`)
  const dir = mkdtempSync(join(tmpdir(), 'rr-contact-'))
  try {
    const files: string[] = []
    for (let i = 0; i < frames.length; i++) {
      const file = join(dir, `f${String(i).padStart(3, '0')}.png`)
      writeFileSync(file, await m.frameAt(opts.mp4Path, frames[i].t))
      files.push(file)
    }
    const ffmpeg = resolveBinary('ffmpeg')
    const run = (font: string | null) =>
      runBinary(ffmpeg, [
        '-hide_banner', '-loglevel', 'error', '-y',
        ...files.flatMap((f) => ['-i', f]),
        '-filter_complex', buildContactFilter(frames, font),
        '-map', '[o]', '-frames:v', '1', outPath,
      ])

    const font = findFont()
    let note: string | null = null
    let labelled = false
    if (font) {
      const r = await run(font)
      if (r.code === 0) labelled = true
      else note = `labels skipped: drawtext failed (${r.stderr.trim().split(/\r?\n/).slice(-1)[0] ?? 'unknown error'})`
    } else {
      note = 'labels skipped: no font file found (set QA_FONT_FILE to a .ttf or .otf)'
    }
    if (!labelled) {
      const r = await run(null)
      if (r.code !== 0) throw new Error(`ffmpeg could not tile the contact sheet: ${r.stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`)
    }
    return { path: outPath, frames, labelled, note }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

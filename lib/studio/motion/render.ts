/**
 * lib/studio/motion/render.ts — frames in, film out.
 *
 * One pass. Chromium draws the type layer one frame at a time on a
 * transparent page; each PNG goes straight down ffmpeg's stdin, where it is
 * laid over the footage and encoded. No frame files, no intermediate overlay.
 *
 * How it stays exact (measured 2026-10-07 against Chromium 141 + ffmpeg 6.1;
 * the same approach as HyperFrames' seek model and Remotion's setFrame):
 *  - Time is never the browser's. Node computes every element's state for
 *    frame t (cues.ts frameState) and the page only applies it. Byte-identical
 *    frames across launches and in any frame order.
 *  - Unchanged frames are not re-captured. Cards spend most of a film holding
 *    still, so most frames reuse the previous PNG.
 *  - Colour is converted on purpose. ffmpeg's default RGB to YUV matrix is
 *    bt601; left alone it turned brand navy (16,39,66) into (12,36,65) and
 *    shifted the footage under the overlay. The overlay is converted to bt709
 *    limited range explicitly and the file is tagged to match.
 *  - Fonts fail loudly. document.fonts.ready resolves even when a face failed,
 *    and fonts.check() says true for a family that was never declared, so the
 *    renderer loads every declared face and refuses to draw if one is not
 *    'loaded'.
 */
import 'server-only'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from 'puppeteer-core'
import { frameState, type MotionPlan } from './cues'

export type VideoProbe = { duration: number; width: number; height: number }

/** The composite encode never runs longer than this; a 24s film takes about 20s here. */
const FFMPEG_TIMEOUT_MS = 300_000

/** Run ffmpeg and keep the tail of stderr. Never throws. */
function runFfmpeg(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stderr?.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-6000)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stderr })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stderr: err.message })
    })
  })
}

/** Read duration and frame size from ffmpeg's own banner. */
export function parseProbe(stderr: string): VideoProbe | null {
  const d = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  const v = stderr.match(/Stream #\d+:\d+[^\n]*Video:[^\n]*?\s(\d{2,5})x(\d{2,5})[\s,]/)
  if (!d || !v) return null
  const duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])
  const width = Number(v[1])
  const height = Number(v[2])
  if (!(duration > 0) || !(width > 0) || !(height > 0)) return null
  return { duration, width, height }
}

export async function probeVideo(ffmpeg: string, path: string): Promise<VideoProbe | null> {
  // ffmpeg exits non-zero without an output file; the banner is all we want.
  const { stderr } = await runFfmpeg(ffmpeg, ['-hide_banner', '-i', path], 30_000)
  return parseProbe(stderr)
}

/**
 * The compositing graph. Footage is resampled to the film's frame rate and
 * cropped to fill the frame; the overlay is converted to bt709 limited range
 * before the blend, because overlay blends in YUV and would otherwise drag the
 * whole graph through the bt601 default.
 */
export function overlayGraph(width: number, height: number, fps: number): string {
  return [
    `[1:v]fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1,format=yuv420p[bg]`,
    `[0:v]setsar=1,format=rgba,scale=in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuva420p[fg]`,
    // eof_action=pass and no shortest: an overlay that ends early never cuts the film.
    `[bg][fg]overlay=0:0:format=auto:eof_action=pass,format=yuv420p[v]`,
  ].join(';')
}

/** Delivery encode: the concat ladder (lib/video/concat.ts) plus bt709 tags. */
export const MOTION_ENCODE_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '20',
  '-maxrate', '8M',
  '-bufsize', '16M',
  '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-color_range', 'tv',
  // Generated footage carries no audio and we never invent one.
  '-an',
  '-movflags', '+faststart',
]

export type RenderMotionInput = {
  plan: MotionPlan
  html: string
  width: number
  height: number
  fps: number
  /** The footage, already on disk. */
  basePath: string
  ffmpeg: string
  /** Frames at which to read back the rendered text and pull a still. */
  stills: Array<{ cueId: string; t: number }>
  launchBrowser: (viewport: { width: number; height: number }) => Promise<Browser>
}

export type RenderMotionResult = {
  body: Buffer
  stills: Array<{ cueId: string; t: number; jpg: Buffer }>
  /** Text actually visible in the page at each still, for the §0 re-check. */
  renderedText: string[]
  fonts: Array<{ family: string; weight: string; status: string }>
  frames: number
  captured: number
  ms: number
}

type FontFaceReport = { family: string; weight: string; status: string }

export async function renderMotion(input: RenderMotionInput): Promise<RenderMotionResult> {
  const started = Date.now()
  const { plan, width, height, fps } = input
  const frames = Math.max(1, Math.round(plan.duration * fps))
  const scale = width / 1080
  const dir = await mkdtemp(join(tmpdir(), 'studio-motion-'))
  const outPath = join(dir, 'final.mp4')
  const problems: string[] = []
  let browser: Browser | null = null
  try {
    browser = await input.launchBrowser({ width, height })
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    page.on('pageerror', (err) => problems.push(`pageerror: ${err instanceof Error ? err.message : String(err)}`))
    page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url().slice(0, 80)}`))
    await page.setContent(input.html, { waitUntil: 'load', timeout: 30_000 })

    const fonts = (await page.evaluate(async () => {
      const faces = Array.from(document.fonts)
      await Promise.all(faces.map((face) => face.load().catch(() => face)))
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)))
      return faces.map((face) => ({ family: face.family, weight: String(face.weight), status: face.status }))
    })) as FontFaceReport[]
    const unloaded = fonts.filter((f) => f.status !== 'loaded')
    if (fonts.length === 0 || unloaded.length > 0) {
      throw new Error(
        `Fonts did not load: ${unloaded.map((f) => `${f.family} ${f.weight} (${f.status})`).join(', ') || 'none declared'}`,
      )
    }
    if (problems.length) throw new Error(problems.join('; '))
    await page.evaluate(() => (window as unknown as { __rrPrepare: () => void }).__rrPrepare())

    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })

    const ff = spawn(
      input.ffmpeg,
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
        '-i', input.basePath,
        '-filter_complex', overlayGraph(width, height, fps),
        '-map', '[v]',
        ...MOTION_ENCODE_ARGS,
        outPath,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    )
    let ffErr = ''
    ff.stderr?.on('data', (chunk) => {
      ffErr = (ffErr + String(chunk)).slice(-4000)
    })
    // ffmpeg can exit at any point (a bad plate, a bad graph). Track it, so the
    // frame loop stops feeding a dead process and a back-pressure wait can
    // never outlive it; and bound the whole encode so a stuck ffmpeg cannot
    // hold the function to its timeout.
    let ffClosed = false
    let ffBroken = false
    const killTimer = setTimeout(() => ff.kill('SIGKILL'), FFMPEG_TIMEOUT_MS)
    const ffDone = new Promise<number>((resolve) => {
      ff.on('close', (code) => {
        ffClosed = true
        clearTimeout(killTimer)
        resolve(code ?? 1)
      })
      ff.on('error', () => {
        ffClosed = true
        clearTimeout(killTimer)
        resolve(1)
      })
    })
    ff.stdin?.on('error', () => {
      ffBroken = true
    })

    const stillFrames = new Map(input.stills.map((s) => [Math.round(s.t * fps), s]))
    const renderedText: string[] = []
    let previous = ''
    let png: Buffer | null = null
    let captured = 0
    for (let i = 0; i < frames; i++) {
      if (ffBroken || ffClosed) break
      const states = frameState(plan, i / fps, scale)
      const signature = JSON.stringify(states)
      if (signature !== previous || !png) {
        await page.evaluate((s) => (window as unknown as { __rrApply: (x: unknown) => void }).__rrApply(s), states)
        const shot = (await cdp.send('Page.captureScreenshot', {
          format: 'png',
          optimizeForSpeed: true,
          captureBeyondViewport: false,
        })) as { data: string }
        png = Buffer.from(shot.data, 'base64')
        previous = signature
        captured++
      }
      if (stillFrames.has(i)) {
        const visible = (await page.evaluate(() =>
          (window as unknown as { __rrVisibleText: () => string[] }).__rrVisibleText(),
        )) as string[]
        renderedText.push(...visible)
      }
      if (!ff.stdin?.write(png) && !ffClosed) {
        // Back-pressure: wait for ffmpeg to drain, to exit, or for its stdin to
        // break, then drop the listeners so a long film does not pile them up.
        await new Promise<void>((resolve) => {
          const done = () => {
            ff.stdin?.off('drain', done)
            ff.stdin?.off('error', done)
            ff.off('close', done)
            resolve()
          }
          ff.stdin?.once('drain', done)
          ff.stdin?.once('error', done)
          ff.once('close', done)
          // The exit may have landed between the write and this listener.
          if (ffClosed || ffBroken) done()
        })
      }
    }
    ff.stdin?.end()
    const code = await ffDone
    if (code !== 0 || ffBroken || !existsSync(outPath)) {
      throw new Error(`ffmpeg composite failed (${code}): ${ffErr.slice(-500)}`)
    }

    const body = await readFile(outPath)
    const stills: RenderMotionResult['stills'] = []
    for (const still of input.stills) {
      const jpgPath = join(dir, `still-${still.cueId}.jpg`)
      const pulled = await runFfmpeg(
        input.ffmpeg,
        ['-y', '-hide_banner', '-loglevel', 'error', '-ss', still.t.toFixed(3), '-i', outPath, '-frames:v', '1', '-q:v', '3', jpgPath],
        60_000,
      )
      if (pulled.code === 0) stills.push({ ...still, jpg: await readFile(jpgPath) })
    }

    return { body, stills, renderedText, fonts, frames, captured, ms: Date.now() - started }
  } finally {
    await browser?.close().catch(() => undefined)
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Write bytes to a fresh temp file; the caller removes the directory. */
export async function writeTemp(bytes: Buffer, name: string): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'studio-plate-'))
  const path = join(dir, name)
  await writeFile(path, bytes)
  return { dir, path }
}

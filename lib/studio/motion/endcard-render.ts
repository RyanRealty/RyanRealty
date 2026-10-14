/**
 * lib/studio/motion/endcard-render.ts: the locked end card, rendered alone.
 *
 * The golden still (endcard.golden.png) and the end card QA render both come
 * from here, through the Studio's own renderer (render.ts) with the real fonts
 * and the real logo: the card on its own cream page, 3.05 s at 30 fps, encoded
 * exactly as a film is. scripts/studio-endcard-golden.ts writes the golden;
 * endcard.int.test.ts re-renders and holds the file to it (SSIM).
 *
 * The golden frame is Call now + 0.5 s: every element in and settled. It is
 * the frame the output check compares a finished film's end card against
 * (docs/plans/STUDIO_ONE_FACTORY.md, check 12).
 */
import 'server-only'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer, { type Browser } from 'puppeteer-core'
import { localChromePath } from '@/lib/browser/launch'
import { loadMotionAssets } from './assets'
import { MOTION_CHROME_ARGS } from './compose'
import { planEndcardOnly, type MotionPlan } from './cues'
import type { EndcardOptions, EndcardTimes } from './endcard'
import { buildMotionPage } from './page'
import { renderMotion } from './render'

export const ENDCARD_GOLDEN_PATH = 'lib/studio/motion/endcard.golden.png'
/** The output check's floor is 0.92 on a finished film; a re-render of the card alone must hold 0.98. */
export const ENDCARD_GOLDEN_MIN_SSIM = 0.98

/**
 * A local Chromium for the golden and the QA render: the launcher's own
 * choice (PUPPETEER_EXECUTABLE_PATH, CHROME_PATH, the platform's Chrome),
 * then Playwright's bundled Chromium when that is all the machine has.
 */
export function motionChromePath(env: NodeJS.ProcessEnv = process.env): string {
  const preferred = localChromePath(env)
  if (existsSync(preferred)) return preferred
  const bundled = env.PLAYWRIGHT_BROWSERS_PATH ? join(env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : ''
  return bundled && existsSync(bundled) ? bundled : preferred
}

/** Chromium launched with the motion stage's own flags (compose.ts). */
export function launchMotionChrome(viewport: { width: number; height: number }): Promise<Browser> {
  return puppeteer.launch({
    executablePath: motionChromePath(),
    headless: true,
    defaultViewport: { ...viewport, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', ...MOTION_CHROME_ARGS],
  })
}

/** When the golden frame is: half a second after Call now. */
export function goldenTime(times: Pick<EndcardTimes, 'call'>): number {
  return times.call + 0.5
}

/** The frame index of a time at fps: the frame on screen at that moment. */
export function frameAt(t: number, fps: number): number {
  return Math.round(t * fps)
}

export type EndcardRender = {
  plan: MotionPlan
  times: EndcardTimes
  body: Buffer
  frames: number
  fonts: string[]
}

/** Render the card alone to an MP4, through the Studio's renderer. */
export async function renderEndcardAlone(input: {
  ffmpeg: string
  launchBrowser?: (viewport: { width: number; height: number }) => Promise<Browser>
  options?: Omit<EndcardOptions, 'start'>
  fps?: number
}): Promise<EndcardRender> {
  const plan = planEndcardOnly(input.options)
  const cue = plan.cues[0]
  if (cue.kind !== 'endcard') throw new Error('planEndcardOnly did not plan an end card')
  const assets = await loadMotionAssets()
  const html = buildMotionPage({ plan, width: 1080, height: 1920, assets })
  const rendered = await renderMotion({
    plan,
    html,
    width: 1080,
    height: 1920,
    fps: input.fps ?? 30,
    basePath: null,
    audioPath: null,
    ffmpeg: input.ffmpeg,
    stills: [],
    launchBrowser: input.launchBrowser ?? launchMotionChrome,
  })
  return {
    plan,
    times: cue.times,
    body: rendered.body,
    frames: rendered.frames,
    fonts: rendered.fonts.map((f) => `${f.family} ${f.weight} ${f.status}`),
  }
}

/**
 * One frame of an MP4 as an RGB PNG, decoded the way it was encoded (bt709,
 * limited range), so brand navy and cream come back on their code values.
 */
export function extractFramePng(ffmpeg: string, mp4Path: string, frame: number, pngPath: string): void {
  const r = spawnSync(
    ffmpeg,
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', mp4Path,
      '-vf', `select=eq(n\\,${frame}),scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24`,
      '-frames:v', '1', '-fps_mode', 'passthrough',
      pngPath,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    // ffmpeg before 5.1 has no -fps_mode; -vsync 0 is the same thing there.
    const legacy = spawnSync(
      ffmpeg,
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', mp4Path,
        '-vf', `select=eq(n\\,${frame}),scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24`,
        '-frames:v', '1', '-vsync', '0',
        pngPath,
      ],
      { encoding: 'utf8' },
    )
    if (legacy.status !== 0) throw new Error(`Could not pull frame ${frame}: ${(legacy.stderr || r.stderr).slice(-400)}`)
  }
}

/** SSIM (All) of two same-size images, from ffmpeg's ssim filter. */
export function ssim(ffmpeg: string, a: string, b: string): number {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], {
    encoding: 'utf8',
  })
  const m = r.stderr.match(/All:([\d.]+)/)
  if (!m) throw new Error(`ffmpeg ssim gave no score: ${r.stderr.slice(-400)}`)
  return Number(m[1])
}

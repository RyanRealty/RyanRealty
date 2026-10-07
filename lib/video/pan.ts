/**
 * lib/video/pan.ts — a real listing photograph, moved across, never reshaped.
 *
 * Matt 2026-10-07. The Studio used to hand landscape MLS photos to Grok for a
 * 9:16 clip, and Grok squeezed the whole 3:2 frame into the portrait one:
 * every house came out tall and thin. "That can't happen." A listing photo is
 * now never animated by a generator at all. It is scaled UNIFORMLY until it
 * fills the portrait frame, and a frame-sized window glides across it on an
 * eased curve, so the whole house passes through the frame at its true shape.
 * The only operations are one uniform scale and a crop. Nothing in this file
 * can stretch an image, and pan.test.ts holds that against the pixels.
 *
 * One camera axis, as the craft canon wants: a wide photo pans across, a tall
 * one pans down, and one already the frame's shape holds still.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { imageSize, type ImageSize } from './image-size'

export type PanDirection = 'forward' | 'back'

export type PanPlan = {
  axis: 'x' | 'y' | 'none'
  /** The ffmpeg filter that scales once, uniformly, and moves a crop window. */
  filter: string
  /** The photo's size after the uniform scale. */
  scaled: ImageSize
}

/** Within this, a photo is already the frame's shape and holds still. */
const SAME_SHAPE = 0.01

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2)
}

/**
 * Plan the move. ffmpeg does the scaling itself from the frame it actually
 * decodes (`force_original_aspect_ratio=increase`, a uniform cover scale), so
 * a header that disagrees with the pixels (an EXIF-rotated phone photo) can
 * at worst give the wrong direction of travel, never a stretched house. The
 * crop window then moves along whichever axis has room; on the other axis
 * there is none and the expression is zero. Eased with a half cosine, so it
 * starts and settles gently instead of jerking at the cut.
 */
export function planPan(input: {
  source: ImageSize
  width: number
  height: number
  seconds: number
  direction: PanDirection
}): PanPlan {
  const { source, width, height, seconds, direction } = input
  const sourceAspect = source.width / source.height
  const frameAspect = width / height
  const curve = direction === 'forward' ? `(0.5-0.5*cos(PI*t/${seconds}))` : `(0.5+0.5*cos(PI*t/${seconds}))`
  // bt709 limited range on the way out, matching the motion stage's encode.
  const tail = 'setsar=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'
  const filter =
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${width}:${height}:x='(iw-${width})*${curve}':y='(ih-${height})*${curve}',${tail}`

  // What the header predicts, for the record and the tests.
  const axis: PanPlan['axis'] =
    sourceAspect > frameAspect * (1 + SAME_SHAPE) ? 'x' : sourceAspect < frameAspect * (1 - SAME_SHAPE) ? 'y' : 'none'
  const scale = Math.max(width / source.width, height / source.height)
  return { axis, filter, scaled: { width: even(source.width * scale), height: even(source.height * scale) } }
}

/** How the window moved, in words for the draft row. */
export function panLabel(axis: PanPlan['axis'], direction: PanDirection): string {
  if (axis === 'x') return direction === 'forward' ? 'pan left to right' : 'pan right to left'
  if (axis === 'y') return direction === 'forward' ? 'pan top to bottom' : 'pan bottom to top'
  return 'hold'
}

/** The delivery encode for a pan beat; concat and the motion stage re-encode after. */
const PAN_ENCODE_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-color_range', 'tv',
  '-an',
  '-movflags', '+faststart',
]

function run(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const timer = setTimeout(() => {
      // Say so: a killed ffmpeg otherwise reports nothing useful.
      stderr += `\n[timed out after ${Math.round(timeoutMs / 1000)}s]`
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stderr?.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-4000)
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

/** A clip of `seconds` moving across `photo`. Throws with ffmpeg's reason. */
export async function panPhotoClip(input: {
  ffmpeg: string
  photo: Buffer
  width: number
  height: number
  seconds: number
  fps: number
  direction: PanDirection
}): Promise<{ body: Buffer; plan: PanPlan; source: ImageSize; label: string }> {
  const source = imageSize(input.photo)
  if (!source) throw new Error('Could not read the photo size; refusing to guess its shape')
  const plan = planPan({ source, width: input.width, height: input.height, seconds: input.seconds, direction: input.direction })
  const dir = await mkdtemp(join(tmpdir(), 'studio-pan-'))
  try {
    const photoPath = join(dir, 'photo')
    const outPath = join(dir, 'pan.mp4')
    await writeFile(photoPath, input.photo)
    const result = await run(
      input.ffmpeg,
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-loop', '1', '-framerate', String(input.fps), '-i', photoPath,
        '-t', String(input.seconds),
        '-vf', plan.filter,
        '-r', String(input.fps),
        ...PAN_ENCODE_ARGS,
        outPath,
      ],
      120_000,
    )
    if (result.code !== 0) throw new Error(`ffmpeg pan failed: ${result.stderr.slice(-400)}`)
    return { body: await readFile(outPath), plan, source, label: panLabel(plan.axis, input.direction) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

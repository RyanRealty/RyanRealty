/**
 * lib/video/plate.ts: the picture under a timeline film, one beat at a time.
 *
 * The Studio's timeline renderer (lib/studio/timeline) lays its type over a
 * single "plate": every beat's footage trimmed to the beat, a cream paper
 * stretch where a beat has none, and (for the loop seam) the film's own frame 0
 * held under the end card. This file plans and builds that plate.
 *
 * The rules it holds (Matt 2026-10-07, "shape is sacred"; lib/video/pan.ts):
 *  - A clip is scaled UNIFORMLY to cover 1080 x 1920 and cropped. Never
 *    stretched or squeezed: one scale factor for both axes, and the crop is
 *    recorded so the manifest can say what was cut.
 *  - Never upscaled silently. pan.ts covers the frame with one uniform scale
 *    and no more; this file does the same, records the scale on every segment,
 *    flags an upscale, and refuses anything past `maxUpscale` (default 2x) so a
 *    small clip is never blown up into mush.
 *  - 30 fps, audio stripped: the film's sound is the score and the voice.
 *  - Colour is left alone: footage stays in its own bt709 YUV (a resize does not
 *    change the matrix), and cream paper is generated in RGB and converted to
 *    bt709 limited range on purpose, so it lands on (250,248,244).
 *
 * Pure planning (coverCrop, plateGraph) is separate from the ffmpeg run, so the
 * crop math and the graph are unit tested without a binary.
 */
import { spawn } from 'node:child_process'

export const PLATE_WIDTH = 1080
export const PLATE_HEIGHT = 1920
export const PLATE_FPS = 30
/** The cream of the paper beats, the brand cream #faf8f4. */
export const PLATE_CREAM = '0xfaf8f4'
/** A clip may be scaled up by at most this much before the plate refuses it. */
export const DEFAULT_MAX_UPSCALE = 2

export type Size = { width: number; height: number }

export type CropPlan = {
  /** The one scale factor applied to both axes. */
  scale: number
  scaledWidth: number
  scaledHeight: number
  /** The crop window's top-left corner in the scaled clip, px (centred). */
  x: number
  y: number
  /** The axis the crop window has room to move along ('none' when the clip is the frame's shape). */
  axis: 'x' | 'y' | 'none'
  /** True when the clip had to be enlarged to cover the frame. */
  upscaled: boolean
}

export type PlateSegment =
  | {
      kind: 'footage'
      /** A local file. Download a URL before planning the plate. */
      path: string
      /** The clip's frame size, read from the file. */
      source: Size
      /** The clip's own duration, seconds (a trim past it is refused). */
      sourceDuration: number
      in: number
      seconds: number
      move: 'hold' | 'pan'
      label?: string
    }
  | { kind: 'paper'; seconds: number; label?: string }
  /** The plate's own first frame, held: what the loop seam's iris opens onto. */
  | { kind: 'opening'; seconds: number; label?: string }

export type PlateRecord = {
  kind: PlateSegment['kind']
  label: string | null
  path: string | null
  in: number | null
  seconds: number
  frames: number
  /** Where the segment starts in the plate, seconds. */
  start: number
  crop: CropPlan | null
  /** The move actually made: 'pan' only when the crop window had room. */
  move: 'hold' | 'pan' | null
}

export class PlateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlateError'
  }
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2)
}

/**
 * Scale-to-cover and centre-crop, with one scale factor. The scaled size is
 * rounded to even pixels and never below the frame, so the crop always fits.
 */
export function coverCrop(source: Size, frame: Size = { width: PLATE_WIDTH, height: PLATE_HEIGHT }): CropPlan {
  if (!(source.width > 0 && source.height > 0)) throw new PlateError(`a clip with no frame size (${source.width}x${source.height})`)
  const scale = Math.max(frame.width / source.width, frame.height / source.height)
  const scaledWidth = Math.max(frame.width, even(source.width * scale))
  const scaledHeight = Math.max(frame.height, even(source.height * scale))
  const roomX = scaledWidth - frame.width
  const roomY = scaledHeight - frame.height
  return {
    scale: Math.round(scale * 1e6) / 1e6,
    scaledWidth,
    scaledHeight,
    x: Math.floor(roomX / 4) * 2,
    y: Math.floor(roomY / 4) * 2,
    axis: roomX >= 2 ? 'x' : roomY >= 2 ? 'y' : 'none',
    upscaled: scale > 1 + 1e-9,
  }
}

/** Frames a segment of `seconds` takes at `fps`. */
export function segmentFrames(seconds: number, fps: number = PLATE_FPS): number {
  return Math.round(seconds * fps)
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3)

export type PlateGraph = {
  /** ffmpeg input arguments, in order. */
  inputs: string[]
  /** The filter_complex; its output pad is [v]. */
  graph: string
  records: PlateRecord[]
  frames: number
}

/** The ffmpeg inputs and graph for a plate. Throws PlateError on a segment that cannot be made honestly. */
export function plateGraph(
  segments: readonly PlateSegment[],
  opts: { width?: number; height?: number; fps?: number; maxUpscale?: number } = {},
): PlateGraph {
  const W = opts.width ?? PLATE_WIDTH
  const H = opts.height ?? PLATE_HEIGHT
  const fps = opts.fps ?? PLATE_FPS
  const maxUpscale = opts.maxUpscale ?? DEFAULT_MAX_UPSCALE
  if (segments.length === 0) throw new PlateError('a plate needs at least one segment')
  const inputs: string[] = []
  const chains: string[] = []
  const records: PlateRecord[] = []
  let inputIndex = 0
  let at = 0
  let total = 0

  const paperChain = (n: number, seconds: number, pad: string) =>
    `color=c=${PLATE_CREAM}:s=${W}x${H}:r=${fps}:d=${fmt(seconds + 1)},format=rgb24,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1,trim=end_frame=${n},setpts=PTS-STARTPTS[${pad}]`

  /** One footage input and its chain, cut to n frames. Returns the crop and the move made. */
  const footageChain = (seg: Extract<PlateSegment, { kind: 'footage' }>, n: number, pad: string, seconds: number) => {
    const crop = coverCrop(seg.source, { width: W, height: H })
    if (crop.scale > maxUpscale + 1e-9) {
      throw new PlateError(
        `${seg.label ?? seg.path} is ${seg.source.width}x${seg.source.height}; covering ${W}x${H} would enlarge it ${crop.scale.toFixed(2)}x, over the ${maxUpscale}x limit`,
      )
    }
    if (!(seg.in >= 0)) throw new PlateError(`${seg.label ?? seg.path}: in must be 0 or more`)
    if (seg.in + seconds > seg.sourceDuration - 1 / fps + 1e-6) {
      throw new PlateError(
        `${seg.label ?? seg.path}: trimming ${fmt(seconds)}s from ${fmt(seg.in)}s runs past the clip's ${fmt(seg.sourceDuration)}s`,
      )
    }
    const k = inputIndex++
    inputs.push('-ss', fmt(seg.in), '-t', fmt(seconds + 1), '-i', seg.path)
    const pans = seg.move === 'pan' && crop.axis !== 'none'
    // The pan curve is pan.ts's half cosine, over the segment's own clock.
    const curve = `(0.5-0.5*cos(PI*min(t\\,${fmt(seconds)})/${fmt(seconds)}))`
    const x = pans && crop.axis === 'x' ? `'(iw-${W})*${curve}'` : String(crop.x)
    const y = pans && crop.axis === 'y' ? `'(ih-${H})*${curve}'` : String(crop.y)
    chains.push(
      `[${k}:v]fps=${fps},scale=${crop.scaledWidth}:${crop.scaledHeight}:flags=lanczos,crop=${W}:${H}:${x}:${y},setsar=1,format=yuv420p,trim=end_frame=${n},setpts=PTS-STARTPTS[${pad}]`,
    )
    return { crop, move: (pans ? 'pan' : 'hold') as 'hold' | 'pan' }
  }

  segments.forEach((seg, i) => {
    if (!(seg.seconds > 0)) throw new PlateError(`segment ${i} (${seg.label ?? seg.kind}) has no length`)
    const n = segmentFrames(seg.seconds, fps)
    if (n < 1) throw new PlateError(`segment ${i} (${seg.label ?? seg.kind}) is under one frame`)
    const pad = `p${i}`
    const seconds = n / fps
    let crop: CropPlan | null = null
    let move: PlateRecord['move'] = null
    if (seg.kind === 'paper') {
      chains.push(paperChain(n, seconds, pad))
    } else if (seg.kind === 'footage') {
      const made = footageChain(seg, n, pad, seconds)
      crop = made.crop
      move = made.move
    } else {
      // The opening frame, held: the first segment made again and cut to its
      // first frame, so it is the plate's frame 0 decoded the same way.
      const first = segments[0]
      if (first.kind === 'opening') throw new PlateError('the plate cannot open on its own opening frame')
      const one = `o${i}`
      if (first.kind === 'paper') chains.push(paperChain(1, 1 / fps, one))
      else {
        const made = footageChain(first, 1, one, 1 / fps)
        crop = made.crop
        move = 'hold'
      }
      chains.push(`[${one}]loop=loop=${n - 1}:size=1:start=0,setpts=N/${fps}/TB,setsar=1[${pad}]`)
    }
    records.push({
      kind: seg.kind,
      label: seg.label ?? null,
      path: seg.kind === 'footage' ? seg.path : null,
      in: seg.kind === 'footage' ? seg.in : null,
      seconds: Math.round(seconds * 1e6) / 1e6,
      frames: n,
      start: Math.round(at * 1e6) / 1e6,
      crop,
      move,
    })
    at += seconds
    total += n
  })
  const pads = segments.map((_, i) => `[p${i}]`).join('')
  chains.push(`${pads}concat=n=${segments.length}:v=1:a=0,format=yuv420p[v]`)
  return { inputs, graph: chains.join(';'), records, frames: total }
}

/** The plate's encode: near-lossless, bt709 limited range tags, no audio. */
export const PLATE_ENCODE_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '12',
  '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709',
  '-color_primaries', 'bt709',
  '-color_trc', 'bt709',
  '-color_range', 'tv',
  '-an',
]

export type RunFfmpeg = (args: string[]) => Promise<{ code: number; stderr: string }>

export function spawnRunner(ffmpeg: string, timeoutMs = 600_000): RunFfmpeg {
  return (args) =>
    new Promise((resolve) => {
      const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr = ''
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
      child.stderr?.on('data', (d) => {
        stderr = (stderr + String(d)).slice(-6000)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ code: code ?? 1, stderr })
      })
      child.on('error', (e) => {
        clearTimeout(timer)
        resolve({ code: 1, stderr: e.message })
      })
    })
}

export type BuiltPlate = { path: string; frames: number; duration: number; records: PlateRecord[] }

/** Build the plate MP4 at `outPath`. Throws PlateError with ffmpeg's reason. */
export async function buildPlate(input: {
  ffmpeg: string
  segments: readonly PlateSegment[]
  outPath: string
  width?: number
  height?: number
  fps?: number
  maxUpscale?: number
  run?: RunFfmpeg
}): Promise<BuiltPlate> {
  const fps = input.fps ?? PLATE_FPS
  const g = plateGraph(input.segments, { width: input.width, height: input.height, fps, maxUpscale: input.maxUpscale })
  const run = input.run ?? spawnRunner(input.ffmpeg)
  const r = await run([
    '-y', '-hide_banner', '-loglevel', 'error',
    ...g.inputs,
    '-filter_complex', g.graph,
    '-map', '[v]',
    '-r', String(fps),
    ...PLATE_ENCODE_ARGS,
    '-frames:v', String(g.frames),
    input.outPath,
  ])
  if (r.code !== 0) throw new PlateError(`ffmpeg could not build the plate: ${r.stderr.trim().split(/\r?\n/).slice(-3).join(' | ')}`)
  return { path: input.outPath, frames: g.frames, duration: g.frames / fps, records: g.records }
}

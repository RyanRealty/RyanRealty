/**
 * lib/studio/qa/measure.ts - thin wrappers that run ffprobe and ffmpeg against a
 * finished MP4 and parse what they print.
 *
 * Parsing is kept in pure functions (parseProbe, parseEbur128, parseFreezedetect,
 * parseSceneCuts, parseSsim, lumaStatsFromGray) so unit tests can feed them
 * captured output. The wrappers hold no judgment: they return what was measured
 * and the checks in check.ts decide pass or fail.
 *
 * A measurement that cannot be taken throws. check.ts turns every throw into a
 * failed check, so "could not measure" never reads as a pass.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { QA_THRESHOLDS } from './thresholds'

// ---------------------------------------------------------------------------
// Binaries

/** Where a Studio binary is looked for when no environment variable names it, in order. */
export const BINARY_DIRS: readonly string[] = ['/usr/bin', '/opt/homebrew/bin', '/usr/local/bin']

function onPath(name: string, env: NodeJS.ProcessEnv, exists: (p: string) => boolean): string | null {
  for (const dir of (env.PATH ?? '').split(':')) {
    if (dir && exists(join(dir, name))) return join(dir, name)
  }
  return null
}

/**
 * The ONE resolver for the binaries that make and measure a film, so the film
 * is made and measured by the same build:
 *  - ffmpeg: FFMPEG_PATH when set (it must exist: a set path that is missing
 *    fails, it never falls back), else the first of BINARY_DIRS that has it,
 *    else PATH.
 *  - ffprobe: FFPROBE_PATH when set (it must exist), else the ffprobe beside
 *    the resolved ffmpeg. Never a different build found somewhere else.
 * Throws with what to set when either is missing.
 */
export function studioBinaries(
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): { ffmpeg: string; ffprobe: string } {
  const pick = (envKey: 'FFMPEG_PATH' | 'FFPROBE_PATH'): string | null => {
    const set = env[envKey]?.trim()
    if (set) {
      if (!exists(set)) throw new Error(`${envKey} is set to ${set}, which does not exist; fix it or unset it`)
      return set
    }
    return null
  }
  let ffmpeg = pick('FFMPEG_PATH')
  if (!ffmpeg) {
    ffmpeg = BINARY_DIRS.map((d) => join(d, 'ffmpeg')).find((p) => exists(p)) ?? onPath('ffmpeg', env, exists)
    if (!ffmpeg) throw new Error(`ffmpeg was not found in ${BINARY_DIRS.join(', ')} or on PATH; install it or set FFMPEG_PATH`)
  }
  let ffprobe = pick('FFPROBE_PATH')
  if (!ffprobe) {
    const beside = join(dirname(ffmpeg), 'ffprobe')
    if (!exists(beside)) throw new Error(`no ffprobe beside ${ffmpeg}; install the same build's ffprobe or set FFPROBE_PATH`)
    ffprobe = beside
  }
  return { ffmpeg, ffprobe }
}

/** One of the pair from studioBinaries. Kept for callers that need one name. */
export function resolveBinary(
  name: 'ffmpeg' | 'ffprobe',
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): string {
  return studioBinaries(env, exists)[name]
}

/**
 * tesseract for check 17: TESSERACT_PATH when set (it must exist), else the
 * first of BINARY_DIRS that has it, else PATH. Null when it is not installed.
 */
export function resolveTesseract(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): string | null {
  const set = env.TESSERACT_PATH?.trim()
  if (set) return exists(set) ? set : null
  return BINARY_DIRS.map((d) => join(d, 'tesseract')).find((p) => exists(p)) ?? onPath('tesseract', env, exists)
}

/** python3 for check 17's render gate: PYTHON3_PATH when set, else BINARY_DIRS, else PATH. Null when missing. */
export function resolvePython(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): string | null {
  const set = env.PYTHON3_PATH?.trim()
  if (set) return exists(set) ? set : null
  return BINARY_DIRS.map((d) => join(d, 'python3')).find((p) => exists(p)) ?? onPath('python3', env, exists)
}

export interface RunResult {
  code: number
  stdout: Buffer
  stderr: string
}

/** Run a binary without a shell. Rejects only when it cannot start. */
export function runBinary(
  bin: string,
  args: string[],
  opts: { input?: Buffer; maxBytes?: number; timeoutMs?: number; env?: NodeJS.ProcessEnv; group?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // group: the child leads its own process group, so a timeout also stops what it
    // spawned (the render gate's tesseract runs), never leaving them orphaned.
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], ...(opts.env ? { env: opts.env } : {}), ...(opts.group ? { detached: true } : {}) })
    const stop = () => {
      if (opts.group && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL')
          return
        } catch {
          /* the group is gone; fall through */
        }
      }
      child.kill('SIGKILL')
    }
    const timer = opts.timeoutMs ? setTimeout(stop, opts.timeoutMs) : null
    const out: Buffer[] = []
    const err: Buffer[] = []
    let outBytes = 0
    const max = opts.maxBytes ?? 256 * 1024 * 1024
    child.stdout.on('data', (d: Buffer) => {
      outBytes += d.length
      if (outBytes > max) child.kill()
      else out.push(d)
    })
    child.stderr.on('data', (d: Buffer) => err.push(d))
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer)
      reject(new Error(e.code === 'ENOENT' ? `${bin} was not found; set FFMPEG_PATH or FFPROBE_PATH` : `${bin} failed to start: ${e.message}`))
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString('utf8') })
    })
    child.stdin.on('error', () => {
      /* the process may exit before reading all input; the exit code tells */
    })
    if (opts.input) child.stdin.end(opts.input)
    else child.stdin.end()
  })
}

// ---------------------------------------------------------------------------
// Result types

export interface ProbeResult {
  width: number
  height: number
  /** Average frame rate of the video stream. */
  fps: number
  codec: string
  pixFmt: string
  /** Container duration in seconds (what a player shows). */
  duration: number
  /** Video stream duration, falling back to the container's. */
  videoDuration: number
  /** Frames in the video stream as the container records them (nb_frames); null when it does not say. */
  frames?: number | null
  hasAudio: boolean
}

export interface Loudness {
  /** Integrated loudness in LUFS; null when the file has no measurable audio (-inf). */
  integratedLufs: number | null
  /** True peak in dBTP (ebur128 reports dBFS of the oversampled signal); null when absent. */
  truePeakDb: number | null
}

export interface Interval {
  start: number
  end: number
  duration: number
}

export interface LumaStats {
  mean: number
  variance: number
}

export interface FreezeOptions {
  /** Minimum frozen stretch in seconds. */
  seconds: number
  /** freezedetect noise tolerance. */
  noise?: number
}

/** The measurement surface check.ts depends on. Tests inject a fake. */
export interface Measure {
  probe(path: string): Promise<ProbeResult>
  loudness(path: string): Promise<Loudness>
  freezes(path: string, opts: FreezeOptions): Promise<Interval[]>
  sceneCuts(path: string, threshold?: number): Promise<number[]>
  frameAt(path: string, t: number): Promise<Buffer>
  ssim(pngA: Buffer, pngB: Buffer): Promise<number>
  lumaStats(png: Buffer): Promise<LumaStats>
  /** Share of each frame from `from` to `to` that is the end card's cream field (check 12, check 5). */
  creamFractions(path: string, from: number, to: number): Promise<Array<{ t: number; fraction: number }>>
  sha256(path: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Pure parsers

/** "30/1" or "30000/1001" or "30" to a number; null when unusable. */
export function parseFps(rate: string | undefined): number | null {
  if (!rate) return null
  const m = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(rate.trim())
  if (!m) return null
  const num = Number(m[1])
  const den = m[2] === undefined ? 1 : Number(m[2])
  if (!(den > 0)) return null
  return num / den
}

interface RawStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  pix_fmt?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  duration?: string
  nb_frames?: string
}

/** Parse `ffprobe -print_format json -show_streams -show_format`. Throws when it holds no video. */
export function parseProbe(json: string): ProbeResult {
  let raw: { streams?: RawStream[]; format?: { duration?: string } }
  try {
    raw = JSON.parse(json)
  } catch (e) {
    throw new Error(`ffprobe output is not JSON: ${(e as Error).message}`)
  }
  const streams = raw.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video')
  if (!video) throw new Error('the file has no video stream')
  const fps = parseFps(video.avg_frame_rate) ?? parseFps(video.r_frame_rate)
  const duration = Number(raw.format?.duration)
  if (fps === null || fps <= 0) throw new Error('ffprobe reported no frame rate')
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('ffprobe reported no duration')
  if (!video.width || !video.height) throw new Error('ffprobe reported no frame size')
  const vd = Number(video.duration)
  const nb = Number(video.nb_frames)
  return {
    width: video.width,
    height: video.height,
    fps,
    codec: video.codec_name ?? '',
    pixFmt: video.pix_fmt ?? '',
    duration,
    videoDuration: Number.isFinite(vd) && vd > 0 ? vd : duration,
    frames: Number.isInteger(nb) && nb > 0 ? nb : null,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  }
}

function numOrNull(token: string): number | null {
  if (/inf/i.test(token)) return null
  const n = Number(token)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse the closing `Summary:` block of `ebur128=peak=true`. The per-100ms lines
 * above it also carry an `I:` value, so only text after the last `Summary:` is read.
 */
export function parseEbur128(stderr: string): Loudness {
  const at = stderr.lastIndexOf('Summary:')
  if (at < 0) throw new Error('ebur128 printed no summary (no audio to measure?)')
  const summary = stderr.slice(at)
  const integrated = /Integrated loudness:\s*\n\s*I:\s*(-?inf|-?\d+(?:\.\d+)?)\s*LUFS/i.exec(summary)
  if (!integrated) throw new Error('ebur128 summary has no integrated loudness')
  const peak = /True peak:\s*\n\s*Peak:\s*(-?inf|-?\d+(?:\.\d+)?)\s*dBFS/i.exec(summary)
  return {
    integratedLufs: numOrNull(integrated[1]),
    truePeakDb: peak ? numOrNull(peak[1]) : null,
  }
}

/**
 * Parse freezedetect log lines into intervals. A freeze that runs to the end of
 * the file prints a start and never an end, so an open interval is closed at
 * `mediaDuration`.
 */
export function parseFreezedetect(stderr: string, mediaDuration: number): Interval[] {
  const out: Interval[] = []
  let open: number | null = null
  for (const line of stderr.split(/\r?\n/)) {
    const m = /lavfi\.freezedetect\.freeze_(start|duration|end):\s*(-?\d+(?:\.\d+)?)/.exec(line)
    if (!m) continue
    const v = Number(m[2])
    if (m[1] === 'start') {
      if (open !== null) out.push({ start: open, end: mediaDuration, duration: mediaDuration - open })
      open = v
    } else if (m[1] === 'end' && open !== null) {
      out.push({ start: open, end: v, duration: v - open })
      open = null
    }
  }
  if (open !== null) out.push({ start: open, end: mediaDuration, duration: Math.max(0, mediaDuration - open) })
  return out
}

/** Parse showinfo frame lines (`... pts_time:5.03333 ...`) into sorted cut times, dropping t <= 0. */
export function parseSceneCuts(stderr: string): number[] {
  const cuts: number[] = []
  for (const line of stderr.split(/\r?\n/)) {
    if (!/showinfo/.test(line)) continue
    const m = /\bpts_time:\s*(-?\d+(?:\.\d+)?)/.exec(line)
    if (!m) continue
    const t = Number(m[1])
    if (t > 0) cuts.push(t)
  }
  return [...new Set(cuts)].sort((a, b) => a - b)
}

/** Parse the `All:` score from the ssim filter's final log line. */
export function parseSsim(stderr: string): number {
  const matches = [...stderr.matchAll(/SSIM[^\n]*?\bAll:\s*(-?\d+(?:\.\d+)?|nan|inf)/gi)]
  if (matches.length === 0) {
    if (/do not match|Input (?:link|pad)/i.test(stderr)) throw new Error('the two images differ in size, so SSIM cannot be taken')
    throw new Error('ffmpeg printed no SSIM score')
  }
  const v = Number(matches[matches.length - 1][1])
  if (!Number.isFinite(v)) throw new Error('SSIM came back as not a number')
  return v
}

/** Mean and variance of 8-bit gray pixels. */
export function lumaStatsFromGray(gray: Uint8Array): LumaStats {
  if (gray.length === 0) throw new Error('no pixels to measure')
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  const mean = sum / gray.length
  let sq = 0
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - mean
    sq += d * d
  }
  return { mean, variance: sq / gray.length }
}

/** A cream pixel (#faf8f4 after the codec): light and nearly unsaturated. */
export function isCream(r: number, g: number, b: number): boolean {
  const lo = Math.min(r, g, b)
  return lo >= 215 && Math.max(r, g, b) - lo <= 24
}

/** Share of cream pixels in each frame of packed rgb24 frames of w x h, timed from `from` at `fps`. */
export function creamFractionsFromRgb(raw: Uint8Array, w: number, h: number, from: number, fps: number): Array<{ t: number; fraction: number }> {
  const size = w * h * 3
  const out: Array<{ t: number; fraction: number }> = []
  for (let f = 0; (f + 1) * size <= raw.length; f++) {
    let cream = 0
    for (let i = f * size; i < (f + 1) * size; i += 3) if (isCream(raw[i], raw[i + 1], raw[i + 2])) cream++
    out.push({ t: Math.round((from + f / fps) * 1000) / 1000, fraction: Math.round((cream / (w * h)) * 1000) / 1000 })
  }
  return out
}

// ---------------------------------------------------------------------------
// Wrappers

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

const PREVIEW_W = 270
const PREVIEW_H = 480

export function createMeasure(env: NodeJS.ProcessEnv = process.env): Measure {
  const ffmpeg = () => studioBinaries(env).ffmpeg
  const ffprobe = () => studioBinaries(env).ffprobe

  /** Run a filter over the whole file and return the log. */
  async function filterLog(path: string, args: string[]): Promise<string> {
    const r = await runBinary(ffmpeg(), ['-hide_banner', '-nostats', '-i', path, ...args, '-f', 'null', '-'])
    if (r.code !== 0) throw new Error(`ffmpeg exited ${r.code}: ${lastLines(r.stderr)}`)
    return r.stderr
  }

  const m: Measure = {
    async probe(path) {
      const r = await runBinary(ffprobe(), ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path])
      if (r.code !== 0) throw new Error(`ffprobe exited ${r.code}: ${lastLines(r.stderr)}`)
      return parseProbe(r.stdout.toString('utf8'))
    },

    async loudness(path) {
      const log = await filterLog(path, ['-vn', '-af', 'ebur128=peak=true'])
      return parseEbur128(log)
    },

    async freezes(path, opts) {
      const noise = opts.noise ?? QA_THRESHOLDS.freezeNoise
      const info = await m.probe(path)
      const log = await filterLog(path, ['-an', '-vf', `freezedetect=n=${noise}:d=${opts.seconds}`])
      return parseFreezedetect(log, info.videoDuration)
    },

    async sceneCuts(path, threshold = QA_THRESHOLDS.sceneCutScore) {
      const log = await filterLog(path, ['-an', '-vf', `select='gt(scene,${threshold})',showinfo`])
      return parseSceneCuts(log)
    },

    async frameAt(path, t) {
      // ffmpeg returns the first frame at or after -ss, so round DOWN to the
      // millisecond: asking for 8.967 when the last frame sits at 8.96667 gets none.
      const seek = Math.floor(Math.max(0, t) * 1000) / 1000
      const r = await runBinary(ffmpeg(), [
        '-hide_banner', '-loglevel', 'error',
        '-ss', seek.toFixed(3), '-i', path,
        '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1',
      ])
      if (r.code !== 0 || r.stdout.length === 0) throw new Error(`no frame at ${t.toFixed(3)}s${r.stderr ? `: ${lastLines(r.stderr)}` : ''}`)
      return r.stdout
    },

    async ssim(pngA, pngB) {
      const dir = mkdtempSync(join(tmpdir(), 'rr-ssim-'))
      try {
        const a = join(dir, 'a.png')
        const b = join(dir, 'b.png')
        writeFileSync(a, pngA)
        writeFileSync(b, pngB)
        const r = await runBinary(ffmpeg(), ['-hide_banner', '-nostats', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'])
        if (r.code !== 0) {
          if (/do not match|differ/i.test(r.stderr)) throw new Error('the two images differ in size, so SSIM cannot be taken')
          throw new Error(`ffmpeg exited ${r.code}: ${lastLines(r.stderr)}`)
        }
        return parseSsim(r.stderr)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },

    async lumaStats(png) {
      const r = await runBinary(
        ffmpeg(),
        [
          '-hide_banner', '-loglevel', 'error',
          '-f', 'image2pipe', '-c:v', 'png', '-i', 'pipe:0',
          '-vf', `scale=${PREVIEW_W}:${PREVIEW_H}:flags=area,format=gray`,
          '-frames:v', '1', '-f', 'rawvideo', 'pipe:1',
        ],
        { input: png },
      )
      if (r.code !== 0) throw new Error(`ffmpeg exited ${r.code}: ${lastLines(r.stderr)}`)
      if (r.stdout.length !== PREVIEW_W * PREVIEW_H) throw new Error(`expected ${PREVIEW_W * PREVIEW_H} gray pixels, got ${r.stdout.length}`)
      return lumaStatsFromGray(r.stdout)
    },

    async creamFractions(path, from, to) {
      const info = await m.probe(path)
      const start = Math.floor(Math.max(0, from) * 1000) / 1000
      const r = await runBinary(ffmpeg(), [
        '-hide_banner', '-loglevel', 'error',
        '-ss', start.toFixed(3), '-to', Math.max(start, to).toFixed(3), '-i', path,
        '-vf', `scale=${CREAM_W}:${CREAM_H}:flags=area,format=rgb24`,
        '-f', 'rawvideo', 'pipe:1',
      ])
      if (r.code !== 0) throw new Error(`ffmpeg exited ${r.code}: ${lastLines(r.stderr)}`)
      return creamFractionsFromRgb(r.stdout, CREAM_W, CREAM_H, Math.round(start * info.fps) / info.fps, info.fps)
    },

    sha256: sha256File,
  }
  return m
}

const CREAM_W = 54
const CREAM_H = 96

function lastLines(text: string, n = 3): string {
  return text.trim().split(/\r?\n/).slice(-n).join(' | ')
}

export const measure: Measure = createMeasure()

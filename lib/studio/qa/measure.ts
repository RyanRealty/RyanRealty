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
import { join } from 'node:path'
import { QA_THRESHOLDS } from './thresholds'

// ---------------------------------------------------------------------------
// Binaries

/**
 * Env FFMPEG_PATH / FFPROBE_PATH, else /usr/bin/<name> when it exists, else the
 * bare name on PATH. `env` and `exists` are parameters so tests need no binary.
 */
export function resolveBinary(
  name: 'ffmpeg' | 'ffprobe',
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): string {
  const fromEnv = env[name === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH']?.trim()
  if (fromEnv) return fromEnv
  const usr = `/usr/bin/${name}`
  return exists(usr) ? usr : name
}

export interface RunResult {
  code: number
  stdout: Buffer
  stderr: string
}

/** Run a binary without a shell. Rejects only when it cannot start. */
export function runBinary(bin: string, args: string[], opts: { input?: Buffer; maxBytes?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
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
      reject(new Error(e.code === 'ENOENT' ? `${bin} was not found; set FFMPEG_PATH or FFPROBE_PATH` : `${bin} failed to start: ${e.message}`))
    })
    child.on('close', (code) => {
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
  return {
    width: video.width,
    height: video.height,
    fps,
    codec: video.codec_name ?? '',
    pixFmt: video.pix_fmt ?? '',
    duration,
    videoDuration: Number.isFinite(vd) && vd > 0 ? vd : duration,
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
  const ffmpeg = () => resolveBinary('ffmpeg', env)
  const ffprobe = () => resolveBinary('ffprobe', env)

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

    sha256: sha256File,
  }
  return m
}

function lastLines(text: string, n = 3): string {
  return text.trim().split(/\r?\n/).slice(-n).join(' | ')
}

export const measure: Measure = createMeasure()

/**
 * lib/studio/voice/decode.ts: the engine's bytes to the Studio's samples.
 *
 * Every buffer in lib/studio/score is 48 kHz stereo float. The voice arrives as
 * raw 16-bit PCM (`pcm_48000`, decoded here with no tool at all), a 48 kHz
 * 16-bit WAV (parsed here), or anything else (MP3 and the rest, decoded by
 * ffmpeg to 48 kHz stereo float). A mono voice is placed dead centre.
 */
import { spawn } from 'node:child_process'
import { SAMPLE_RATE } from '../score/types'
import type { StereoAudio } from './types'

/** Run ffmpeg with `input` on stdin; resolve its stdout. Injected in tests. */
export type RunFfmpeg = (args: string[], input: Buffer) => Promise<Buffer>

export function spawnFfmpeg(ffmpeg: string): RunFfmpeg {
  return (args, input) =>
    new Promise<Buffer>((resolve, reject) => {
      const child = spawn(ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      const out: Buffer[] = []
      const err: Buffer[] = []
      child.stdout.on('data', (d: Buffer) => out.push(d))
      child.stderr.on('data', (d: Buffer) => err.push(d))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(out))
        else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString('utf8').slice(-400)}`))
      })
      child.stdin.on('error', () => {
        // ffmpeg closing stdin early is reported by its exit code.
      })
      child.stdin.end(input)
    })
}

export type ParsedWav = { sampleRate: number; channels: number; left: Float32Array; right: Float32Array }

/**
 * A RIFF WAV with 16-bit PCM or 32-bit float samples, mono or stereo; null for
 * anything else (the caller falls back to ffmpeg). A data chunk whose declared
 * size runs past the file (a streamed header) is read to the end of the file.
 */
export function parseWav(bytes: Buffer): ParsedWav | null {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return null
  let format: { tag: number; channels: number; rate: number; bits: number } | null = null
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4)
    const declared = bytes.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ' && body + 16 <= bytes.length) {
      format = {
        tag: bytes.readUInt16LE(body),
        channels: bytes.readUInt16LE(body + 2),
        rate: bytes.readUInt32LE(body + 4),
        bits: bytes.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      if (!format) return null
      const size = Math.min(declared, bytes.length - body)
      const { tag, channels, rate, bits } = format
      if (channels < 1 || channels > 2) return null
      const bytesPerSample = bits / 8
      const isPcm16 = (tag === 1 || tag === 0xfffe) && bits === 16
      const isFloat32 = tag === 3 && bits === 32
      if (!isPcm16 && !isFloat32) return null
      const frames = Math.floor(size / (bytesPerSample * channels))
      const left = new Float32Array(frames)
      const right = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        const at = body + i * channels * bytesPerSample
        const l = isPcm16 ? bytes.readInt16LE(at) / 32768 : bytes.readFloatLE(at)
        const r = channels === 2 ? (isPcm16 ? bytes.readInt16LE(at + 2) / 32768 : bytes.readFloatLE(at + 4)) : l
        left[i] = l
        right[i] = r
      }
      return { sampleRate: rate, channels, left, right }
    }
    offset = body + declared + (declared % 2)
  }
  return null
}

/** Raw signed 16-bit little-endian mono PCM to a centred stereo pair. */
export function pcm16MonoToStereo(bytes: Buffer): StereoAudio {
  const frames = Math.floor(bytes.length / 2)
  const left = new Float32Array(frames)
  for (let i = 0; i < frames; i++) left[i] = bytes.readInt16LE(i * 2) / 32768
  return { left, right: new Float32Array(left) }
}

/** Interleaved little-endian float32 stereo (ffmpeg `-f f32le -ac 2`) to a pair of buffers. */
export function f32leStereoToAudio(bytes: Buffer): StereoAudio {
  const frames = Math.floor(bytes.length / 8)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    left[i] = bytes.readFloatLE(i * 8)
    right[i] = bytes.readFloatLE(i * 8 + 4)
  }
  return { left, right }
}

const PCM_FORMAT = /^pcm_(\d+)$/

export type DecodeDeps = {
  /** Required only for formats this file cannot read itself (MP3, Opus, a non-48 kHz PCM or WAV). */
  runFfmpeg?: RunFfmpeg
}

/**
 * The audio of a Synthesis as 48 kHz stereo float. `format` is the API's
 * output_format string (`pcm_48000`, `wav_48000`, `mp3_44100_128`, ...).
 */
export async function decodeVoiceAudio(bytes: Buffer, format: string, deps: DecodeDeps = {}): Promise<StereoAudio> {
  const pcm = PCM_FORMAT.exec(format)
  if (pcm && Number(pcm[1]) === SAMPLE_RATE) return pcm16MonoToStereo(bytes)
  if (format.startsWith('wav_')) {
    const wav = parseWav(bytes)
    if (wav && wav.sampleRate === SAMPLE_RATE) return { left: wav.left, right: wav.right }
  }
  if (!deps.runFfmpeg) {
    throw new Error(`decodeVoiceAudio: ${format} needs ffmpeg (pass runFfmpeg)`)
  }
  const input = pcm ? ['-f', 's16le', '-ar', pcm[1], '-ac', '1', '-i', 'pipe:0'] : ['-i', 'pipe:0']
  const out = await deps.runFfmpeg(
    ['-hide_banner', '-loglevel', 'error', ...input, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '2', '-ar', String(SAMPLE_RATE), 'pipe:1'],
    bytes,
  )
  return f32leStereoToAudio(out)
}

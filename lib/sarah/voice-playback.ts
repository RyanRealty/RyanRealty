/**
 * Jitter-buffered Eve playback. PCM16 deltas at 24 kHz are scheduled onto
 * AudioBufferSourceNodes with a 150 ms lead so chunks abut. No per-chunk
 * start() at currentTime (that is the choppy path).
 */
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'

export const SARAH_VOICE_LEAD_SEC = 0.15
export const SARAH_VOICE_SOURCE_RATE = GROK_REALTIME_SAMPLE_RATE

export type SarahVoicePlayback = {
  pushBase64Pcm16: (b64: string) => void
  bargeIn: () => void
  underruns: () => number
  stop: () => void
}

type PlayCtx = {
  sampleRate: number
  currentTime: number
  destination: AudioNode
  createBuffer: AudioContext['createBuffer']
  createBufferSource: AudioContext['createBufferSource']
}

export function decodeBase64Pcm16(b64: string): Float32Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const even = bytes.byteLength - (bytes.byteLength % 2)
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, even / 2)
  const float = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i += 1) float[i] = (pcm[i] ?? 0) / 0x8000
  return float
}

export function resampleToRate(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const ratio = toRate / fromRate
  const out = new Float32Array(Math.max(1, Math.round(input.length * ratio)))
  for (let i = 0; i < out.length; i += 1) {
    const src = i / ratio
    const j = Math.floor(src)
    const frac = src - j
    const a = input[j] ?? 0
    const b = input[j + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

export function createSarahVoicePlayback(
  ctx: PlayCtx,
  opts?: { leadSec?: number; onUnderrun?: (count: number) => void; destination?: AudioNode },
): SarahVoicePlayback {
  const lead = opts?.leadSec ?? SARAH_VOICE_LEAD_SEC
  const nodes: AudioBufferSourceNode[] = []
  let nextAt = 0
  let underrunCount = 0
  let stopped = false

  const flush = () => {
    for (const node of nodes) {
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    nodes.length = 0
    nextAt = 0
  }

  return {
    pushBase64Pcm16(b64) {
      if (stopped || !b64) return
      const pcm = resampleToRate(decodeBase64Pcm16(b64), SARAH_VOICE_SOURCE_RATE, ctx.sampleRate)
      if (pcm.length === 0) return
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate)
      buf.copyToChannel(Float32Array.from(pcm), 0)
      const node = ctx.createBufferSource()
      node.buffer = buf
      node.connect(opts?.destination ?? ctx.destination)
      const now = ctx.currentTime
      if (nextAt === 0) {
        nextAt = now + lead
      } else if (nextAt < now) {
        underrunCount += 1
        opts?.onUnderrun?.(underrunCount)
        console.warn('[sarahVoice] underrun', underrunCount)
        nextAt = now + lead
      }
      node.start(nextAt)
      nextAt += buf.duration
      nodes.push(node)
    },
    bargeIn() {
      flush()
    },
    underruns() {
      return underrunCount
    },
    stop() {
      stopped = true
      flush()
    },
  }
}

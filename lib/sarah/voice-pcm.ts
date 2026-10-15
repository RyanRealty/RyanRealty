/**
 * Mic capture → 24 kHz PCM16 for xAI input_audio_buffer.append.
 * iOS Safari keeps AudioContext at 48 kHz even when 24 kHz is requested.
 */
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'
import { resampleToRate } from './voice-playback'

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

export function pcm16ToBase64(buffer: Int16Array): string {
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function pcm16FromMicFloat(
  input: Float32Array,
  fromRate: number,
  toRate = GROK_REALTIME_SAMPLE_RATE,
): { audio: string; samples: number; fromRate: number; toRate: number } {
  const resampled = resampleToRate(input, fromRate, toRate)
  return {
    audio: pcm16ToBase64(floatToPcm16(resampled)),
    samples: resampled.length,
    fromRate,
    toRate,
  }
}

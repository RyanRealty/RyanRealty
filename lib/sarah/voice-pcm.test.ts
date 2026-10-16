import { describe, expect, it } from 'vitest'
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'
import { decodeBase64Pcm16 } from './voice-playback'
import { pcm16FromMicFloat } from './voice-pcm'

describe('Sarah mic PCM', () => {
  it('resamples iOS 48 kHz capture to 24 kHz pcm16 before append', () => {
    const input = new Float32Array(4800)
    for (let i = 0; i < input.length; i += 1) input[i] = i % 2 === 0 ? 0.5 : -0.5
    const pcm = pcm16FromMicFloat(input, 48_000, GROK_REALTIME_SAMPLE_RATE)
    expect(pcm.fromRate).toBe(48_000)
    expect(pcm.toRate).toBe(24_000)
    expect(pcm.samples).toBe(2400)
    expect(pcm.audio.length).toBeGreaterThan(20)
    expect(decodeBase64Pcm16(pcm.audio)).toHaveLength(2400)
    expect(pcm.audio.length).toBe(6400)
  })

  it('leaves 24 kHz capture at 24 kHz', () => {
    const input = new Float32Array(240)
    input.fill(0.25)
    const pcm = pcm16FromMicFloat(input, 24_000)
    expect(pcm.samples).toBe(240)
    expect(pcm.toRate).toBe(24_000)
  })
})

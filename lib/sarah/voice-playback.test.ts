import { describe, expect, it, vi } from 'vitest'
import { GROK_REALTIME_SAMPLE_RATE } from '@/lib/grok/realtime-browser'
import {
  SARAH_VOICE_LEAD_SEC,
  createSarahVoicePlayback,
  decodeBase64Pcm16,
  resampleToRate,
} from './voice-playback'
import { WEB_VOICE_TALK_EN } from './scripts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function pcm16Base64(samples: number[]): string {
  const pcm = new Int16Array(samples)
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0)
  return btoa(binary)
}

function fakeCtx(rate = GROK_REALTIME_SAMPLE_RATE) {
  const starts: { at: number; duration: number; node: { stopped: boolean } }[] = []
  const ctx = {
    sampleRate: rate,
    currentTime: 0,
    destination: {} as AudioNode,
    createBuffer(_ch: number, length: number, sampleRate: number) {
      const data = new Float32Array(length)
      return {
        length,
        duration: length / sampleRate,
        sampleRate,
        copyToChannel(src: Float32Array) {
          data.set(src)
        },
      } as unknown as AudioBuffer
    },
    createBufferSource() {
      const node = {
        buffer: null as AudioBuffer | null,
        stopped: false,
        connect() {},
        disconnect() {},
        start(when?: number) {
          starts.push({ at: when ?? 0, duration: this.buffer?.duration ?? 0, node })
        },
        stop() {
          node.stopped = true
        },
      }
      return node as unknown as AudioBufferSourceNode
    },
  }
  return { ctx, starts }
}

describe('Sarah voice playback buffer', () => {
  it('schedules chunks with a lead and no gap between them', () => {
    const { ctx, starts } = fakeCtx()
    const play = createSarahVoicePlayback(ctx)
    const chunk = pcm16Base64(new Array(2400).fill(1000))
    play.pushBase64Pcm16(chunk)
    play.pushBase64Pcm16(chunk)
    expect(starts).toHaveLength(2)
    expect(starts[0]?.at).toBeCloseTo(SARAH_VOICE_LEAD_SEC, 5)
    expect(starts[1]?.at).toBeCloseTo((starts[0]?.at ?? 0) + (starts[0]?.duration ?? 0), 5)
    expect(play.underruns()).toBe(0)
  })

  it('logs an underrun when the clock jumps past the next chunk', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctx, starts } = fakeCtx()
    const play = createSarahVoicePlayback(ctx, {
      onUnderrun: (count) => {
        expect(count).toBe(1)
      },
    })
    const chunk = pcm16Base64(new Array(2400).fill(1000))
    play.pushBase64Pcm16(chunk)
    ctx.currentTime = 2
    play.pushBase64Pcm16(chunk)
    expect(play.underruns()).toBe(1)
    expect(warn).toHaveBeenCalledWith('[sarahVoice] underrun', 1)
    expect(starts[1]?.at).toBeCloseTo(2 + SARAH_VOICE_LEAD_SEC, 5)
    warn.mockRestore()
  })

  it('stops playback instantly on barge-in', () => {
    const { ctx, starts } = fakeCtx()
    const play = createSarahVoicePlayback(ctx)
    play.pushBase64Pcm16(pcm16Base64(new Array(2400).fill(1000)))
    play.bargeIn()
    expect(starts[0]?.node.stopped).toBe(true)
    play.pushBase64Pcm16(pcm16Base64(new Array(2400).fill(1000)))
    expect(starts[1]?.at).toBeCloseTo(SARAH_VOICE_LEAD_SEC, 5)
  })

  it('keeps 24 kHz PCM at the context rate and only resamples when needed', () => {
    const raw = decodeBase64Pcm16(pcm16Base64([0, 16384, -16384]))
    expect(raw).toHaveLength(3)
    expect(resampleToRate(raw, 24_000, 24_000)).toBe(raw)
    const up = resampleToRate(raw, 24_000, 48_000)
    expect(up.length).toBe(6)
  })

  it('asks Eve for short conversational turns and server VAD barge-in', () => {
    expect(WEB_VOICE_TALK_EN).toMatch(/contractions/)
    expect(WEB_VOICE_TALK_EN).toMatch(/Don't read lists/)
    expect(WEB_VOICE_TALK_EN).not.toMatch(/\u2014/)
    const src = readFileSync(join(import.meta.dirname, 'web-voice.ts'), 'utf8')
    expect(src).toContain('WEB_VOICE_TALK_EN')
    expect(src).toContain("type: 'server_vad'")
    expect(src).toContain('interrupt_response: true')
    expect(src).toContain('createSarahVoicePlayback')
    expect(src).toContain('isSarahSpeechStarted')
    expect(src).toContain("type: 'response.cancel'")
    expect(src).not.toContain('node.start()')
  })
})

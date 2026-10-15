import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GROK_REALTIME_VOICE, grokRealtimeSessionVoice } from '@/lib/grok/realtime-browser'
import { SARAH_VOICE_ID } from './persona'
import {
  SARAH_MIC_PERMISSIONS_POLICY,
  WEB_VOICE_PERMISSION_EN,
  WEB_VOICE_START_FAIL_EN,
  armSarahMicOnTap,
  beginSarahVoiceFromMicTap,
  continueSarahVoiceAfterArm,
  isNotAllowedError,
  logSarahVoiceError,
  sarahVoiceErrorMessage,
  takeVoiceErrorSlot,
} from './web-voice-arm'

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  sampleRate = 48_000
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createMediaStreamDestination = vi.fn(() => ({ stream: { getTracks: () => [] } }))
}

function fakeAudioEl() {
  return {
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
    setAttribute: vi.fn(),
    remove: vi.fn(),
    srcObject: null as MediaStream | null,
    src: '',
    autoplay: false,
    preload: '',
  }
}

function installMediaMocks(getUserMedia: () => Promise<MediaStream>) {
  const gum = vi.fn(getUserMedia)
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: gum },
    sendBeacon: vi.fn(() => true),
  })
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('document', { createElement: vi.fn(() => fakeAudioEl()) })
  return gum
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Sarah iOS mic tap', () => {
  it('calls getUserMedia before the token fetch', async () => {
    const order: string[] = []
    const gum = installMediaMocks(() => {
      order.push('getUserMedia')
      return Promise.resolve({ getTracks: () => [] } as unknown as MediaStream)
    })

    const mintToken = vi.fn(async () => {
      order.push('mintToken')
      return { secret: 'tok' }
    })

    const started = beginSarahVoiceFromMicTap()
    expect(started.ok).toBe(true)
    if (!started.ok) throw new Error('expected armed mic')
    expect(gum).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['getUserMedia'])
    expect(mintToken).not.toHaveBeenCalled()

    const { token } = await continueSarahVoiceAfterArm(started.armed, mintToken)
    expect(token).toEqual({ secret: 'tok' })
    expect(order).toEqual(['getUserMedia', 'mintToken'])
    expect(order.indexOf('getUserMedia')).toBeLessThan(order.indexOf('mintToken'))
  })

  it('creates and resumes AudioContext in the same tap as getUserMedia', () => {
    installMediaMocks(() => Promise.resolve({ getTracks: () => [] } as unknown as MediaStream))
    const armed = armSarahMicOnTap()
    expect(armed.captureCtx.state).toBe('running')
    expect(armed.playCtx).toBe(armed.captureCtx)
    expect(armed.captureCtx.resume).toHaveBeenCalled()
    expect(armed.speaker.play).toHaveBeenCalled()
    expect(armed.playDest).toBeTruthy()
  })

  it('maps NotAllowedError to the permission line and other errors to start-fail', () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    const boom = Object.assign(new Error('boom'), { name: 'NotFoundError' })
    expect(isNotAllowedError(denied)).toBe(true)
    expect(isNotAllowedError(boom)).toBe(false)
    expect(sarahVoiceErrorMessage(denied)).toBe(WEB_VOICE_PERMISSION_EN)
    expect(sarahVoiceErrorMessage(boom)).toBe(WEB_VOICE_START_FAIL_EN)

    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logSarahVoiceError(denied)
    expect(err).not.toHaveBeenCalled()
    logSarahVoiceError(boom)
    expect(err).toHaveBeenCalledWith('[sarahVoice]', boom)
  })

  it('posts a voice error at most once per session', () => {
    const slot = { posted: false }
    expect(takeVoiceErrorSlot(slot)).toBe(true)
    expect(takeVoiceErrorSlot(slot)).toBe(false)
    expect(takeVoiceErrorSlot(slot)).toBe(false)
    expect(slot.posted).toBe(true)
  })

  it('keeps the session voice Eve, not Ara', () => {
    expect(SARAH_VOICE_ID).toBe('eve')
    expect(GROK_REALTIME_VOICE).toBe('eve')
    expect(grokRealtimeSessionVoice()).toEqual({
      voice: 'eve',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24_000 },
          transcription: { model: 'grok-transcribe' },
        },
        output: {
          voice: 'eve',
          format: { type: 'audio/pcm', rate: 24_000 },
        },
      },
    })
  })

  it('arms the mic in the tap handler before mintSarahVoiceToken', () => {
    const client = readFileSync(join(import.meta.dirname, '../../components/site/v3/V3SarahAssistant.client.tsx'), 'utf8')
    expect(client).not.toContain('armSarahMicOnTap()')
    expect(client).not.toContain('hydration-safe')
    const tapAt = client.indexOf('beginSarahVoiceFromMicTap()')
    const continueAt = client.indexOf('continueVoiceAfterArm(started.armed)')
    expect(tapAt).toBeGreaterThan(-1)
    expect(continueAt).toBeGreaterThan(tapAt)
    expect(client.indexOf('await mintSarahVoiceToken()')).toBe(-1)
    expect(client).toMatch(/onClick=\{\(\) => \{[\s\S]*beginSarahVoiceFromMicTap\(\)/)
  })

  it('sets Permissions-Policy microphone=(self) in next.config, middleware, and vercel.json', () => {
    const root = join(import.meta.dirname, '../..')
    const nextConfig = readFileSync(join(root, 'next.config.ts'), 'utf8')
    const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8')
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8')
    expect(SARAH_MIC_PERMISSIONS_POLICY).toBe('microphone=(self)')
    expect(nextConfig).toContain(`value: '${SARAH_MIC_PERMISSIONS_POLICY}'`)
    expect(middleware).toContain(`response.headers.set('Permissions-Policy', '${SARAH_MIC_PERMISSIONS_POLICY}')`)
    expect(vercel).toContain('"Permissions-Policy"')
    expect(vercel).toContain(SARAH_MIC_PERMISSIONS_POLICY)
  })
})

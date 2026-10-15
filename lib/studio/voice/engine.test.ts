/**
 * CI guard (unit project): the Studio's default voice is Grok TTS, voice Eve (Matt 2026-10-14).
 * Fails if the default engine or voice changes, or if anything other than an explicit
 * engine: 'elevenlabs' reaches ElevenLabs.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_GROK_VOICE, DEFAULT_VOICE_ENGINE, resolveVoiceEngine } from './index'
import { GROK_TTS_DEFAULT_VOICE } from '../../grok/tts'
import { defaultVoiceProvider, speakTimeline, voiceCacheKey, type VoiceRequest, type VoiceSynthesis } from '../timeline/voice'
import { parseTimeline } from '../timeline/validate'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('enforced default voice: Grok TTS Eve', () => {
  it('the default engine is grok and the default voice is eve', () => {
    expect(DEFAULT_VOICE_ENGINE).toBe('grok')
    expect(DEFAULT_GROK_VOICE).toBe('eve')
    expect(GROK_TTS_DEFAULT_VOICE).toBe('eve')
  })

  it('only an explicit elevenlabs opt-in leaves Grok', () => {
    expect(resolveVoiceEngine(undefined)).toBe('grok')
    expect(resolveVoiceEngine('grok')).toBe('grok')
    expect(resolveVoiceEngine('elevenlabs')).toBe('elevenlabs')
  })

  it('a timeline voice with no engine and no voice reads as grok / eve', () => {
    const t = JSON.parse(readFileSync(join(__dirname, '../timeline/fixtures/bend-mos.timeline.json'), 'utf8'))
    delete t.voice.voice
    delete t.voice.engine
    const r = parseTimeline(t)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.voice).toMatchObject({ engine: 'grok', voice: 'eve' })
  })

  it('an ElevenLabs voice without engine: elevenlabs is refused', () => {
    const t = JSON.parse(readFileSync(join(__dirname, '../timeline/fixtures/bend-mos.timeline.json'), 'utf8'))
    t.voice.voice = 'ellen'
    delete t.voice.engine
    expect(parseTimeline(t).ok).toBe(false)
  })

  it('speakTimeline sends an engine-less voice to Grok with voice eve', async () => {
    const seen: VoiceRequest[] = []
    const provider = async (req: VoiceRequest): Promise<VoiceSynthesis> => {
      seen.push(req)
      throw new Error('stop after the request')
    }
    await expect(
      speakTimeline({ script: 'Moving up?' }, { provider, cacheDir: null, ffmpeg: 'ffmpeg', captionsUntil: 20 }),
    ).rejects.toThrow(/stop after the request/)
    expect(seen[0]).toMatchObject({ engine: 'grok', voiceId: 'eve' })
  })

  it('the default provider is a function and grok cache keys never collide with ElevenLabs ones', () => {
    expect(typeof defaultVoiceProvider()).toBe('function')
    const base = { text: 'Hi', voiceId: 'eve', model: 'grok-tts' }
    expect(voiceCacheKey({ ...base, engine: 'grok' })).not.toBe(voiceCacheKey({ ...base, engine: 'elevenlabs' }))
  })
})

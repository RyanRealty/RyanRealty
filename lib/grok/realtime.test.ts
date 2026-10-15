import { describe, expect, it } from 'vitest'
import {
  GROK_REALTIME_VOICE,
  grokRealtimeSessionVoice,
  grokRealtimeSubprotocol,
  grokRealtimeWebSocketUrl,
  isGrokEveVoice,
} from './realtime-browser'
import { SARAH_VOICE_ID } from '@/lib/sarah/persona'

describe('Grok browser realtime helpers', () => {
  it('sets the Eve voice id xAI expects on the URL and session.update', () => {
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
    expect(grokRealtimeWebSocketUrl()).toBe(
      'wss://api.x.ai/v1/realtime?model=grok-voice-latest&voice=eve',
    )
    expect(grokRealtimeSubprotocol('tok_1')).toBe('xai-client-secret.tok_1')
    expect(isGrokEveVoice('eve')).toBe(true)
    expect(isGrokEveVoice('human_eve')).toBe(true)
    expect(isGrokEveVoice('xai_ara')).toBe(false)
  })
})

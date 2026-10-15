import { describe, expect, it } from 'vitest'
import { GROK_TTS_DEFAULT_VOICE, blankWrappingTags, grokTtsBody, synthesizeGrokSpeech } from './tts'

describe('lib/grok/tts', () => {
  it('defaults to Eve, English, lossless 48 kHz WAV, with timestamps', () => {
    expect(GROK_TTS_DEFAULT_VOICE).toBe('eve')
    expect(grokTtsBody({ text: 'Moving up?' })).toEqual({
      text: 'Moving up?',
      voice_id: 'eve',
      language: 'en',
      output_format: { codec: 'wav', sample_rate: 48000 },
      with_timestamps: true,
    })
  })

  it('refuses empty text and out-of-range speed', () => {
    expect(() => grokTtsBody({ text: '  ' })).toThrow(/empty/)
    expect(() => grokTtsBody({ text: 'Hi', speed: 2 })).toThrow(/speed/)
  })

  it('blanks wrapping tags but keeps the character count', () => {
    const chars = [...'<slow>Hi</slow>']
    const out = blankWrappingTags(chars)
    expect(out).toHaveLength(chars.length)
    expect(out.join('').trim()).toBe('Hi')
  })

  it('decodes the JSON envelope into audio and a character alignment', async () => {
    const fetchImpl = (async (path: string, init?: RequestInit) => {
      expect(path).toBe('/tts')
      expect(JSON.parse(String(init?.body)).voice_id).toBe('eve')
      return new Response(
        JSON.stringify({
          audio: Buffer.from('RIFF').toString('base64'),
          duration: 0.2,
          audio_timestamps: { graph_chars: ['H', 'i'], graph_times: [[0, 0.1], [0.1, 0.2]] },
        }),
      )
    }) as never
    const s = await synthesizeGrokSpeech({ text: 'Hi' }, { fetchImpl })
    expect(s).toMatchObject({ engine: 'grok', voiceId: 'eve', outputFormat: 'wav_48000', duration: 0.2 })
    expect(s.alignment).toEqual({ characters: ['H', 'i'], characterStartTimesSeconds: [0, 0.1], characterEndTimesSeconds: [0.1, 0.2] })
  })
})

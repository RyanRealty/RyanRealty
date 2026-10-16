import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GROK_REALTIME_VOICE, grokRealtimeSessionVoice } from '@/lib/grok/realtime-browser'
import { SARAH_VOICE_ID } from './persona'

describe('Sarah web mic session voice', () => {
  it('session.update sets voice to the Eve id xAI expects', () => {
    expect(SARAH_VOICE_ID).toBe('eve')
    expect(GROK_REALTIME_VOICE).toBe('eve')
    expect(grokRealtimeSessionVoice()).toEqual({
      voice: 'eve',
      audio: { output: { voice: 'eve' } },
    })
    const src = readFileSync(join(import.meta.dirname, 'web-voice.ts'), 'utf8')
    expect(src).toContain('...grokRealtimeSessionVoice()')
    expect(src).toContain("type: 'response.create'")
    expect(src).toContain('speakExact')
    expect(src).toContain('response.cancel')
  })
})

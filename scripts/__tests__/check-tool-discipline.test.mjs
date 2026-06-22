import { describe, it, expect } from 'vitest'
import { inlineViolations, isAllowed } from '../check-tool-discipline.mjs'

// G36 Layer-2 ratchet: bans NEW inline ElevenLabs / Replicate calls outside the
// shared helpers. (This test file lives under scripts/__tests__/, which the gate
// skips, so these example API strings never trip the live gate.)

describe('inlineViolations', () => {
  it('FLAGS an inline ElevenLabs API call in a non-allowed file', () => {
    const src = `await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + id)`
    expect(inlineViolations('video/foo/synth.mjs', src)).toContain('elevenlabs-inline')
  })

  it('ALLOWS the same call inside the shared voice library', () => {
    const src = `await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + id)`
    expect(inlineViolations('lib/voice/alignment.ts', src)).toHaveLength(0)
    expect(inlineViolations('scripts/_voice_lib.py', src)).toHaveLength(0)
  })

  it('FLAGS an inline Replicate predictions call in a non-allowed file', () => {
    const src = `fetch('https://api.replicate.com/v1/predictions', { method: 'POST' })`
    expect(inlineViolations('app/actions/foo.ts', src)).toContain('replicate-video-inline')
  })

  it('ALLOWS the Replicate call inside the shared video helper', () => {
    const src = `fetch('https://api.replicate.com/v1/predictions', { method: 'POST' })`
    expect(inlineViolations('lib/replicate-video.ts', src)).toHaveLength(0)
  })

  it('returns nothing for source with no inline AI-tool call', () => {
    expect(inlineViolations('lib/foo.ts', `import { synth } from '@/lib/voice'`)).toHaveLength(0)
  })
})

describe('isAllowed', () => {
  it('matches an exact path and a directory prefix', () => {
    expect(isAllowed('lib/voice/x.ts', ['lib/voice/'])).toBe(true)
    expect(isAllowed('scripts/_voice_lib.py', ['scripts/_voice_lib.py'])).toBe(true)
    expect(isAllowed('video/other.mjs', ['lib/voice/'])).toBe(false)
  })
})

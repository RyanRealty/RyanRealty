import { describe, expect, it } from 'vitest'
import {
  PLACE_NAME_REPLACE,
  XAI_VOICE_ID_DEFAULT,
  lockedXaiVoiceId,
  wordsFromCharTimestamps,
} from './grok-voice'

describe('xAI voice lock (G32)', () => {
  it('locks the default voice_id to eve', () => {
    expect(XAI_VOICE_ID_DEFAULT).toBe('eve')
  })

  it('uses XAI_VOICE_ID when set, else eve', () => {
    const prev = process.env.XAI_VOICE_ID
    delete process.env.XAI_VOICE_ID
    expect(lockedXaiVoiceId()).toBe('eve')
    process.env.XAI_VOICE_ID = 'nlbqfwie'
    expect(lockedXaiVoiceId()).toBe('nlbqfwie')
    if (prev === undefined) delete process.env.XAI_VOICE_ID
    else process.env.XAI_VOICE_ID = prev
  })

  it('carries IPA replace for every CLAUDE.md place name', () => {
    expect(PLACE_NAME_REPLACE.Deschutes).toBe('/dəˈʃuːts/')
    expect(PLACE_NAME_REPLACE.Tumalo).toBe('/ˈtʌməloʊ/')
    expect(PLACE_NAME_REPLACE.Tetherow).toMatch(/^\/.+\/$/)
    expect(PLACE_NAME_REPLACE.Awbrey).toMatch(/^\/.+\/$/)
    expect(PLACE_NAME_REPLACE.Terrebonne).toMatch(/^\/.+\/$/)
    expect(PLACE_NAME_REPLACE.Paulina).toMatch(/^\/.+\/$/)
    expect(PLACE_NAME_REPLACE.Madras).toMatch(/^\/.+\/$/)
  })
})

describe('wordsFromCharTimestamps', () => {
  it('groups characters into words for SingleWordCaption', () => {
    const chars = ['H', 'i', ' ', 'B', 'e', 'n', 'd']
    const times: Array<[number, number]> = [
      [0.0, 0.1],
      [0.1, 0.2],
      [0.2, 0.25],
      [0.25, 0.35],
      [0.35, 0.45],
      [0.45, 0.55],
      [0.55, 0.7],
    ]
    expect(wordsFromCharTimestamps(chars, times)).toEqual([
      { text: 'Hi', start: 0.0, end: 0.2 },
      { text: 'Bend', start: 0.25, end: 0.7 },
    ])
  })

  it('returns empty when timestamps are missing', () => {
    expect(wordsFromCharTimestamps(undefined, undefined)).toEqual([])
  })
})

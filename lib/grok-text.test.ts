import { describe, expect, it } from 'vitest'
import { GROK_TEXT_MODEL } from './grok-text'

describe('grok-text chokepoint (G32)', () => {
  it('uses grok-4.6 from docs.x.ai/developers/models', () => {
    expect(GROK_TEXT_MODEL).toBe('grok-4.6')
  })
})

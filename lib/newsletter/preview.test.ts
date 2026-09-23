import { describe, expect, it } from 'vitest'
import { normalizePreviewBroker } from './preview'

describe('normalizePreviewBroker', () => {
  it('treats a web slug and a short slug as the same broker', () => {
    expect(normalizePreviewBroker('paul-stevenson')).toBe('paul')
    expect(normalizePreviewBroker('paul')).toBe('paul')
    expect(normalizePreviewBroker('rebecca-peterson')).toBe('rebecca')
    expect(normalizePreviewBroker('matthew-ryan')).toBe('matt')
  })

  it('falls back to Matt when nobody is assigned', () => {
    expect(normalizePreviewBroker(null)).toBe('matt')
    expect(normalizePreviewBroker('')).toBe('matt')
    expect(normalizePreviewBroker('nobody')).toBe('matt')
  })
})

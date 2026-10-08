import { describe, it, expect } from 'vitest'
import { blogUpdatedLabel } from './updated-label'

describe('blogUpdatedLabel', () => {
  it('prints nothing when updated equals published (seed fallback)', () => {
    expect(blogUpdatedLabel('2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z')).toBeNull()
  })
  it('prints nothing within one day', () => {
    expect(blogUpdatedLabel('2026-09-01T12:00:00Z', '2026-09-02T11:00:00Z')).toBeNull()
  })
  it('prints Updated {date} when more than a day later', () => {
    expect(blogUpdatedLabel('2026-09-01T12:00:00Z', '2026-09-20T12:00:00Z')).toBe('Updated Sep 20, 2026')
  })
  it('handles null and invalid input', () => {
    expect(blogUpdatedLabel(null, '2026-09-20T12:00:00Z')).toBeNull()
    expect(blogUpdatedLabel('2026-09-01T12:00:00Z', null)).toBeNull()
    expect(blogUpdatedLabel('nope', 'nah')).toBeNull()
  })
})

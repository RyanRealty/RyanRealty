import { describe, expect, it } from 'vitest'
import { buildSfrFollowFigures } from './hub-sections'

describe('buildSfrFollowFigures — list median digits', () => {
  it('prints the exact leftover SFR median the hub FAQ publishes, not a thousand-round', () => {
    const figures = buildSfrFollowFigures({
      medianList: 729875,
      active: 1200,
      daysToPending: 14,
    })
    const list = figures.find((f) => String(f.label).includes('median list price'))
    expect(list?.value).toBe('$729,875')
    expect(String(list?.value)).not.toContain('$730,000')
  })
})

import { describe, expect, it } from 'vitest'
import { describeCompSearch, parseTierMonths, parseTierRadiusMiles } from '@/lib/pricing/search-story'

describe('parseTierRadiusMiles', () => {
  it('reads nearby and city rungs', () => {
    expect(parseTierRadiusMiles('nearby-1mi-3mo')).toBe(1)
    expect(parseTierRadiusMiles('city-5mi-9mo')).toBe(5)
    expect(parseTierRadiusMiles('subdivision-3mo')).toBeNull()
  })
})

describe('parseTierMonths', () => {
  it('reads the clock on a rung', () => {
    expect(parseTierMonths('subdivision-9mo')).toBe(9)
    expect(parseTierMonths('nearby-1mi-3mo')).toBe(3)
  })
})

describe('describeCompSearch', () => {
  it('stays inside the subdivision when every rung is a subdivision rung', () => {
    const story = describeCompSearch({
      subdivision: 'Quince',
      tiersUsed: ['subdivision-3mo', 'subdivision-6mo'],
    })
    expect(story.stayedInSubdivision).toBe(true)
    expect(story.radiusMiles).toBeNull()
    expect(story.headline).toBe('Sales inside Quince')
    expect(story.body).toMatch(/stayed inside the Quince subdivision/)
    expect(story.body).toMatch(/last 6 months/)
    expect(story.body).not.toMatch(/circle/)
  })

  it('does not claim we stayed inside when the ladder rungs were not stored', () => {
    const story = describeCompSearch({ subdivision: 'Quince', tiersUsed: [] })
    expect(story.stayedInSubdivision).toBe(false)
    expect(story.radiusMiles).toBeNull()
    expect(story.headline).toBe('Sales near Quince')
    expect(story.body).not.toMatch(/stayed inside/)
  })

  it('draws the radius when the ladder left the subdivision', () => {
    const story = describeCompSearch({
      subdivision: 'Quince',
      tiersUsed: ['subdivision-9mo', 'nearby-1mi-3mo'],
    })
    expect(story.stayedInSubdivision).toBe(false)
    expect(story.radiusMiles).toBe(1)
    expect(story.headline).toBe('Quince, then 1 mile')
    expect(story.body).toMatch(/not enough recent sales inside Quince/)
    expect(story.body).toMatch(/opened to 1 mile/)
    expect(story.body).not.toMatch(/The outline is the subdivision/)
    expect(story.legend).toMatch(/The outline is the subdivision/)
    expect(story.legend).toMatch(/The circle is the search/)
  })
})

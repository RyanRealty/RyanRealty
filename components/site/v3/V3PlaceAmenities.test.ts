/**
 * amenityGroups / amenityBoardLede — the grouping keeps the author's order, a
 * nameless row cannot render, a door with no destination is not a door (§0),
 * and the claim sentence counts what the reader can see.
 */
import { describe, expect, it } from 'vitest'
import { amenityBoardLede, amenityGroups } from './V3PlaceAmenities'

describe('amenityGroups', () => {
  it('groups by category in the order the config lists them', () => {
    const groups = amenityGroups('amenities', [
      { name: 'Coorie', category: 'Dining' },
      { name: 'Tetherow Spa', category: 'Wellness' },
      { name: 'The Row', category: 'Dining' },
      { name: 'Nordic + snowshoe trails', category: 'Winter' },
    ])
    expect(groups.map((g) => g.category)).toEqual(['Dining', 'Wellness', 'Winter'])
    expect(groups[0]!.rows.map((r) => r.name)).toEqual(['Coorie', 'The Row'])
    expect(groups.map((g) => g.id)).toEqual(['amenities-dining', 'amenities-wellness', 'amenities-winter'])
  })

  it('drops a nameless row and collapses a duplicate key to the first', () => {
    const groups = amenityGroups('a', [
      { name: '  ', category: 'Dining' },
      { name: 'Compass Park', category: 'Recreation', description: 'first' },
      { name: 'Compass Park', category: 'Recreation', description: 'second' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.rows).toHaveLength(1)
    expect(groups[0]!.rows[0]!.description).toBe('first')
  })

  it('files a row with no category under "On site"', () => {
    const groups = amenityGroups('a', [{ name: 'Pool' }])
    expect(groups[0]!.category).toBe('On site')
    expect(groups[0]!.id).toBe('a-on-site')
  })

  it('keeps a door only when it has both a destination and a label (§0)', () => {
    const groups = amenityGroups('a', [
      { name: 'Discovery Park', door: { href: '/blog/northwest-crossing-discovery-park', label: 'Read the guide' } },
      { name: 'Compass Park', door: { href: '', label: 'Read the guide' } },
      { name: 'Shevlin Park', door: { href: 'https://example.org', label: ' ' } },
    ])
    const rows = groups[0]!.rows
    expect(rows[0]!.door?.href).toBe('/blog/northwest-crossing-discovery-park')
    expect(rows[1]!.door).toBeNull()
    expect(rows[2]!.door).toBeNull()
  })

  it('renders nothing to group from an empty list', () => {
    expect(amenityGroups('a', [])).toEqual([])
  })
})

describe('amenityBoardLede', () => {
  it('counts the places and names the kinds in reading order', () => {
    const groups = amenityGroups('a', [
      { name: 'Coorie', category: 'Dining' },
      { name: 'The Row', category: 'Dining' },
      { name: 'Tetherow Café', category: 'Dining' },
      { name: 'Tetherow Spa', category: 'Wellness' },
      { name: 'Tetherow Sport', category: 'Fitness' },
      { name: 'Pickleball + tennis courts', category: 'Racquet' },
      { name: 'Nordic + snowshoe trails', category: 'Winter' },
      { name: 'Shevlin Park · 660 acres', category: 'Trails' },
    ])
    expect(amenityBoardLede(groups)).toBe(
      'Eight places on file — dining, wellness, fitness, racquet, winter, and trails — each with who can use it and where the fact was recorded.',
    )
  })

  it('reads as one place, two kinds', () => {
    const groups = amenityGroups('a', [{ name: 'Pool', category: 'Recreation' }])
    expect(amenityBoardLede(groups)).toBe(
      'One place on file — recreation — each with who can use it and where the fact was recorded.',
    )
  })

  it('is undefined for an empty board', () => {
    expect(amenityBoardLede([])).toBeUndefined()
  })
})

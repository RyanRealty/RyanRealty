/**
 * amenityGroups / amenityBoardLede — the grouping keeps the author's order, a
 * nameless row cannot render, a door with no destination is not a door (§0),
 * and the claim sentence counts what the reader can see.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { amenityBoardLede, amenityGroups, amenityKindMark } from './V3PlaceAmenities'
import { V3_ICON_NAMES } from './V3Icon'

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

/**
 * SITE-116 round 2. A tile we hold no photograph of is an honest, DESIGNED
 * state — the kind's drawn mark, the kind, the line — never an empty frame and
 * never a borrowed picture. These hold the two halves of that: every kind any
 * community config actually uses resolves to a real icon in the house set, and
 * a photograph is never put behind the scroll entrance.
 */
describe('amenityKindMark', () => {
  it('resolves every kind the 27 community configs use to an installed icon', () => {
    // The measured set, 2026-09-16: Recreation 54, Parks 24, Golf 22, Schools
    // 20, Dining 16, Landmark 10, Wellness 9, Other 8, Shopping 5, and one
    // each of Events, Education, Fitness, Racquet, Winter, Trails.
    const kinds = [
      'Recreation', 'Parks', 'Golf', 'Schools', 'Dining', 'Landmark', 'Wellness',
      'Other', 'Shopping', 'Events', 'Education', 'Fitness', 'Racquet', 'Winter', 'Trails',
    ]
    for (const kind of kinds) {
      expect(V3_ICON_NAMES, `${kind} has no mark`).toContain(amenityKindMark(kind))
    }
  })

  it('is case- and space-insensitive, and never returns nothing', () => {
    expect(amenityKindMark('  dining ')).toBe(amenityKindMark('Dining'))
    expect(V3_ICON_NAMES).toContain(amenityKindMark('a kind nobody has authored yet'))
    expect(V3_ICON_NAMES).toContain(amenityKindMark(null))
  })
})

describe('the board carries a tile by photograph or by type — never by a badge (SITE-116 round 3)', () => {
  const src = readFileSync(new URL('./V3PlaceAmenities.tsx', import.meta.url), 'utf8')

  it('mounts no scroll reveal and no kind mark on a tile: the icon grid was the banned tell', () => {
    // Round 2 put an Iconoir mark behind the beUI scroll reveal on every tile
    // without a photograph; the evaluator named the result "card grids with
    // icons". A tile we cannot picture is carried by its name at heading size,
    // its authored line and its fact list — nothing stands in for a picture.
    expect(src).not.toContain("from './V3Reveal.client'")
    expect(src).not.toContain('<V3Reveal')
    expect(src).not.toContain('v3-place-amenities__mark')
    expect(src).not.toContain('<V3Icon')
  })

  it('prints a photograph plainly, never behind an entrance, and the facts as a description list', () => {
    expect(src).toContain('className="v3-place-amenities__photo"')
    expect(src).toContain('loading="lazy"')
    expect(src).toContain('v3-place-amenities__facts')
    expect(src).toContain('v3-place-amenities__fact-label')
  })

  it('the class keeps its installed scroll-animation through the type slider, not the board', () => {
    const slider = readFileSync(new URL('../../place/PlaceTypeSlider.tsx', import.meta.url), 'utf8')
    expect(slider).toContain('V3Reveal')
    const reveal = readFileSync(new URL('./V3Reveal.client.tsx', import.meta.url), 'utf8')
    expect(reveal).toMatch(/from ['"]@\/components\/motion\/scroll-reveal['"]/)
  })
})

describe('amenityGroups carries the fact list', () => {
  it('keeps a fact only when both halves are present, and passes access through whole', () => {
    const groups = amenityGroups('a', [
      {
        name: 'Tetherow Café',
        category: 'Dining',
        access: 'Open to public · 7am to 2pm seasonally',
        facts: [
          { label: 'Who can use it', value: 'Open to public' },
          { label: 'Hours', value: '7am to 2pm seasonally' },
          { label: '', value: 'dropped' },
          { label: 'Details', value: ' ' },
        ],
      },
    ])
    const row = groups[0]!.rows[0]!
    expect(row.facts).toEqual([
      { label: 'Who can use it', value: 'Open to public' },
      { label: 'Hours', value: '7am to 2pm seasonally' },
    ])
    expect(row.access).toBe('Open to public · 7am to 2pm seasonally')
  })
})

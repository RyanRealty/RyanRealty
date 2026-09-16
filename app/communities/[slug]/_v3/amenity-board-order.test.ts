/**
 * SITE-116 — the amenity board is its own section directly after the fold,
 * before the plat index; the Place JSON-LD's amenityFeature comes from the
 * same rows; and the belonging block no longer repeats them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(join(process.cwd(), 'app/communities/[slug]/page.tsx'), 'utf8')

describe('community page — amenity board (SITE-116)', () => {
  it('mounts V3PlaceAmenities after the fold and before the plat index', () => {
    const fold = PAGE.indexOf('<CommunityPlaceValue')
    const board = PAGE.indexOf('<V3PlaceAmenities')
    const plats = PAGE.indexOf('<V3PlaceIndex\n          id="subdivisions"')
    expect(fold).toBeGreaterThan(0)
    expect(board).toBeGreaterThan(fold)
    expect(plats).toBeGreaterThan(board)
  })

  it('renders the board only when the config carries amenities, and never invents one', () => {
    expect(PAGE).toContain('{amenityBoardOwnsRows ? (')
    expect(PAGE).toContain('id="amenities"')
  })

  it('builds the Place amenityFeature from the same rows the board prints', () => {
    expect(PAGE).toContain('amenities: amenityBoardOwnsRows ? amenityBoardRows : undefined')
  })

  it('hands the amenity rows to the board, not the belonging block, when the board renders', () => {
    expect(PAGE).toContain('amenitiesOwnSection: amenityBoardOwnsRows')
  })

  it('gives a tile a door only to a published guide or the recorded URL', () => {
    expect(PAGE).toContain("? { href: `/blog/${post.slug}`, label: 'Read our guide' }")
    expect(PAGE).toContain("? { href: external, label: 'Their own page', external: true }")
  })
})

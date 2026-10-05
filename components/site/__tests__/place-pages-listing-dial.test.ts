/**
 * Every place page shows its listings on the dial (Matt 2026-09-23, re-asked
 * 2026-09-24: "a primary card with a vertical slider on the side; the slider
 * toggles through the thumbnails and that changes the card, and vice versa").
 *
 * The dial reached plat and neighborhood pages first while city and community
 * pages kept the carousel, and Matt found the carousel again on
 * /communities/northwest-crossing and /communities/broken-top. This holds the
 * class: no place page route draws a listing carousel of its own, and each one
 * mounts the dial host.
 *
 * HELD CLASSES (Matt 2026-09-25, "fix first, then ship"): a class that
 * scores below its taste mark with the dial ships the carousel it had until it
 * reaches the mark, by one explicit prop on the map (PlaceSubdivisionMap
 * layout="rails"), never a carousel in the route. The community pages were
 * held from 2026-09-30 and took the dial on 2026-10-01, once they opened on a
 * supply read; no place class is held today.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(path), 'utf8')

const PLACE_ROUTES = {
  city: 'app/cities/[slug]/page.tsx',
  neighborhood: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  community: 'app/communities/[slug]/page.tsx',
  subdivision: 'app/subdivisions/[slug]/page.tsx',
} as const

const HOMES_BLOCK = 'components/site/v3/PlaceSubdivisionMap.client.tsx'

/** The classes held on the carousel until they reach their taste mark (none on 2026-10-01). */
const HELD = new Set<string>()

describe('place pages show listings on the dial, never a carousel', () => {
  it.each(Object.entries(PLACE_ROUTES))('%s page draws no listing carousel of its own', (_grain, path) => {
    const src = read(path)
    expect(src).not.toMatch(/\bV3Carousel\b/)
    expect(src).not.toMatch(/components\/ui\/carousel/)
  })

  it.each(['city', 'neighborhood', 'community'] as const)(
    '%s page puts its homes under the map on PlaceSubdivisionHomes (the dial host)',
    (grain) => {
      const src = read(PLACE_ROUTES[grain])
      expect(src).toMatch(/<PlaceSubdivisionHomes id="homes"( countScope="[^"]+")? \/>/)
    },
  )

  it.each(Object.keys(PLACE_ROUTES).filter((grain) => !HELD.has(grain)))(
    '%s page takes the dial (no held layout)',
    (grain) => {
      expect(read(PLACE_ROUTES[grain as keyof typeof PLACE_ROUTES])).not.toMatch(/layout="rails"/)
    },
  )

  it('the community page takes the dial: its map carries no held layout', () => {
    const src = read(PLACE_ROUTES.community)
    expect(src).toMatch(/<PlaceSubdivisionMap\b/)
    expect(src).not.toMatch(/<PlaceSubdivisionMap[^>]*?layout=/)
    expect(src).toMatch(/<PlaceSubdivisionHomes[\s\S]*?id="homes"/)
  })

  it('the plat inventory is the dial', () => {
    expect(read(PLACE_ROUTES.subdivision)).toMatch(/<V3PlaceInventory[\s\S]*?layout="dial"/)
  })

  it('the homes block under a place map defaults to the dial; the carousel is only the held layout', () => {
    const src = read(HOMES_BLOCK)
    expect(src).toMatch(/import \{ V3ListingDial \} from '\.\/V3ListingDial\.client'/)
    expect(src).toMatch(/layout = 'dial'/)
    expect(src).toMatch(/if \(layout === 'rails'\)/)
  })
})

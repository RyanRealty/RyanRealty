/**
 * Every place page shows its listings on the dial (Matt 2026-09-23, re-asked
 * 2026-09-24: "a primary card with a vertical slider on the side; the slider
 * toggles through the thumbnails and that changes the card, and vice versa").
 *
 * The dial reached plat and neighborhood pages first while city and community
 * pages kept the carousel, and Matt found the carousel again on
 * /communities/northwest-crossing and /communities/broken-top. This holds the
 * whole class: no place page route and no place-page homes block draws a
 * listing carousel, and each one mounts the dial host.
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

describe('place pages show listings on the dial, never a carousel', () => {
  it.each(Object.entries(PLACE_ROUTES))('%s page draws no listing carousel', (_grain, path) => {
    const src = read(path)
    expect(src).not.toMatch(/\bV3Carousel\b/)
    expect(src).not.toMatch(/components\/ui\/carousel/)
    expect(src).not.toMatch(/layout="rails"/)
  })

  it.each(['city', 'neighborhood', 'community'] as const)(
    '%s page puts its homes under the map on PlaceSubdivisionHomes (the dial host)',
    (grain) => {
      const src = read(PLACE_ROUTES[grain])
      expect(src).toMatch(/<PlaceSubdivisionHomes id="homes" \/>/)
    },
  )

  it('the plat inventory is the dial', () => {
    expect(read(PLACE_ROUTES.subdivision)).toMatch(/<V3PlaceInventory[\s\S]*?layout="dial"/)
  })

  it('the homes block under a place map has the dial as its only layout', () => {
    const src = read(HOMES_BLOCK)
    expect(src).toMatch(/import \{ V3ListingDial \} from '\.\/V3ListingDial\.client'/)
    expect(src).not.toMatch(/\bV3Carousel\b/)
    expect(src).not.toMatch(/layout\?:/)
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ATLAS = readFileSync(resolve('components/site/v3/V3Atlas.client.tsx'), 'utf8')
const CSS = readFileSync(resolve('components/site/v3/V3Atlas.css'), 'utf8')
const DAL = readFileSync(resolve('lib/data/places/getPlaceAmenityLayers.ts'), 'utf8')
const LAYERS = readFileSync(resolve('lib/atlas/place-amenity-layers.ts'), 'utf8')
const CITY = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
const NBH = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
const COMM = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
const SUB = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
const PARK = readFileSync(resolve('app/parks/[slug]/page.tsx'), 'utf8')
const TRAIL = readFileSync(resolve('app/central-oregon/trails/[slug]/page.tsx'), 'utf8')

describe('SITE-128 Atlas amenity layers', () => {
  it('contract: place-homes-atlas-wired — city / neighborhood / community / subdivision pass amenities=', () => {
    expect(CITY).toMatch(/getPlaceAmenityLayers/)
    expect(NBH).toMatch(/getPlaceAmenityLayers/)
    expect(COMM).toMatch(/getPlaceAmenityLayers/)
    expect(SUB).toMatch(/getPlaceAmenityLayers/)
    // UXLIVE-3: a page may hand the layers through deferredAtlasProps, which
    // ships the same recorded geometry at the precision the frame can draw.
    const wired = (src: string) =>
      /amenities=\{amenityLayers\}/.test(src) ||
      (/deferredAtlasProps\(\{[\s\S]*?amenities:\s*amenityLayers[\s\S]*?\}\)/.test(src) &&
        /amenities=\{atlasProps\.amenities\}/.test(src))
    expect(wired(CITY)).toBe(true)
    expect(wired(NBH)).toBe(true)
    expect(wired(COMM)).toBe(true)
    expect(wired(SUB)).toBe(true)
    expect(ATLAS).toMatch(/data-atlas-amenity-layer/)
    expect(ATLAS).toMatch(/data-atlas-amenity="park"/)
    expect(ATLAS).toMatch(/data-atlas-amenity="trail"/)
  })

  it('contract: community-subdivision-grain — local Atlas fetches pass citySlug + parent communitySlug', () => {
    const commAt = COMM.indexOf('getPlaceAmenityLayers({')
    const subAt = SUB.indexOf('getPlaceAmenityLayers({')
    const commFetch = COMM.slice(commAt, commAt + 420)
    const subFetch = SUB.slice(subAt, subAt + 420)
    expect(commFetch).toMatch(/grain:\s*'community'/)
    expect(commFetch).toMatch(/citySlug/)
    expect(commFetch).toMatch(/communitySlug:\s*slug/)
    expect(subFetch).toMatch(/grain:\s*'subdivision'/)
    expect(subFetch).toMatch(/communitySlug:\s*resortSlug/)
    expect(LAYERS).toMatch(/amenityGeomTouchesPlace/)
  })

  it('contract: on-brand-non-blue — amenity paint is navy on cream, never Google blue', () => {
    expect(CSS).toMatch(/\.v3-atlas__amenity-park/)
    expect(CSS).toMatch(/\.v3-atlas__amenity-trail/)
    expect(CSS).toMatch(/var\(--v3-navy\)/)
    const amenityBlock = CSS.slice(CSS.indexOf('.v3-atlas__amenity-park'))
    expect(amenityBlock).toMatch(/--v3-navy/)
    expect(amenityBlock).not.toMatch(/#4285|#1a73e8|rgb\(\s*66\s*,\s*133\s*,\s*244/i)
    expect(amenityBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('contract: destination-google-maps-untouched — park / trail detail stay on PlaceFieldMap', () => {
    expect(PARK).toMatch(/PlaceFieldMap/)
    expect(TRAIL).toMatch(/PlaceFieldMap/)
    expect(PARK).not.toMatch(/getPlaceAmenityLayers/)
    expect(TRAIL).not.toMatch(/getPlaceAmenityLayers/)
    expect(PARK).not.toMatch(/<V3Atlas/)
    expect(TRAIL).not.toMatch(/<V3Atlas/)
  })

  it('DAL only forwards existing park / trail RPCs', () => {
    expect(DAL).toMatch(/getParkBoundaryGeoJSON/)
    expect(DAL).toMatch(/getTrailLineGeoJSON/)
    expect(DAL).not.toMatch(/overpass|openstreetmap|\bosm\b/i)
    expect(LAYERS).toMatch(/public\.boundaries/)
    expect(LAYERS).toMatch(/public\.trail_lines/)
    expect(LAYERS).toMatch(/Missing official geometry is omitted/)
  })
})

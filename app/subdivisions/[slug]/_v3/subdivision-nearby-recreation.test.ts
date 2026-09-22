import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recreationNearPoint } from '@/lib/site/place-recreation'

const PAGE = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
const NEARBY = readFileSync(
  resolve('app/subdivisions/[slug]/_v3/subdivision-nearby-recreation.tsx'),
  'utf8',
)
const EDGES = readFileSync(resolve('app/subdivisions/[slug]/_v3/subdivision-edges.ts'), 'utf8')

describe('SITE-141 plat Parks and Trails wiring', () => {
  it('mounts recreationNearPoint ledgers on the plat page, not a Quiet dump', () => {
    expect(PAGE).toMatch(/import \{ SubdivisionNearbyRecreation \} from '\.\/_v3\/subdivision-nearby-recreation'/)
    expect(PAGE).toMatch(/<SubdivisionNearbyRecreation[\s\S]*?lat=\{platCentroid\?\.lat\}/)
    expect(PAGE).toMatch(/lng=\{platCentroid\?\.lng\}/)
    expect(PAGE).toMatch(/const platCentroid = mapCentroid\(mapTiles\)/)
    expect(NEARBY).toMatch(/recreationNearPoint\(lat, lng\)/)
    expect(NEARBY).toMatch(/id="parks"/)
    expect(NEARBY).toMatch(/heading=\{v3Text\('Parks'\)\}/)
    expect(NEARBY).toMatch(/id="trails"/)
    expect(NEARBY).toMatch(/heading=\{v3Text\('Trails'\)\}/)
    expect(NEARBY).toMatch(/firstNearbyPark \?/)
    expect(NEARBY).toMatch(/firstNearbyTrail \?/)
    expect(EDGES).not.toMatch(/Parks, trails, and golf nearby/)
    expect(EDGES).toMatch(/item\.kind === 'golf' \|\| item\.kind === 'event'/)
  })

  it('names Farewell Bend and Phil’s from the Deschutes River Woods centroid and invents nothing', () => {
    // Listing-pin centroid consistent with the live DRW Quiet distances
    // (Tetherow 1.9 mi). The recorded neighborhood centroid sits ~4.0 mi from
    // Farewell Bend, which the 4-mile park window can drop. Do not invent a park.
    const nearby = recreationNearPoint(43.9867, -121.3508)
    expect(nearby.parks.length).toBeGreaterThan(0)
    expect(nearby.trails.length).toBeGreaterThan(0)
    expect(nearby.parks.some((row) => row.href === '/parks/farewell-bend-park')).toBe(true)
    expect(nearby.trails.some((row) => row.href === '/central-oregon/trails/phils-trail')).toBe(
      true,
    )
    for (const row of nearby.parks) {
      expect(row.href).toMatch(/^\/parks\/[a-z0-9-]+$/)
      expect(String(row.what).length).toBeGreaterThan(0)
    }
    for (const row of nearby.trails) {
      expect(row.href).toMatch(/^\/central-oregon\/trails\/[a-z0-9-]+$/)
      expect(String(row.what).length).toBeGreaterThan(0)
    }
  })

  it('omits both types when the plat has no centroid', () => {
    const empty = recreationNearPoint(null, null)
    expect(empty.parks).toEqual([])
    expect(empty.trails).toEqual([])
  })
})

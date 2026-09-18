/**
 * SITE-128 craft #3 + SITE-130 + Matt LOCK 2026-09-18.
 * Hierarchy: community ≠ neighborhood. Sitewide crumb: one V3Breadcrumb.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
const community = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
const neighborhood = readFileSync(
  resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'),
  'utf8',
)
const subdivision = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
const stage = readFileSync(resolve('app/communities/[slug]/_v3/CommunityStage.tsx'), 'utf8')
const crumb = readFileSync(resolve('components/site/v3/V3Breadcrumb.tsx'), 'utf8')

describe('SITE-128 hierarchy — community ≠ neighborhood', () => {
  it('kills the city Subdivisions-in dump above neighborhood bars', () => {
    expect(city).not.toMatch(/getIndexableSubdivisions/)
    expect(city).not.toMatch(/CITY_PLAT_INDEX_CAP/)
    expect(city).not.toMatch(/heading=\{[^}]*Subdivisions in/)
    expect(city).not.toMatch(/Communities and subdivisions/)
    expect(city.indexOf('id="neighborhoods"')).toBeLessThan(city.indexOf('id="child-places"'))
    expect(city).toMatch(/nameOnly/)
    expect(city).toMatch(/nameOnlyChildEntries/)
  })

  it('does not twin Neighborhoods-in on the community page', () => {
    expect(community).not.toMatch(/heading=\{[^}]*Neighborhoods in/)
    expect(community).not.toMatch(/heading=\{[^}]*Subdivisions in/)
    expect(community).toMatch(/id="child-places"/)
    expect(community).toMatch(/nameOnly/)
  })

  it('keeps neighborhood children as name-only cards, not a Subdivisions ledger', () => {
    expect(neighborhood).toMatch(/id="child-places"/)
    expect(neighborhood).toMatch(/nameOnly/)
    expect(neighborhood).not.toMatch(/heading=\{[^}]*Subdivisions/)
    expect(neighborhood).not.toMatch(/id="subdivisions"/)
  })

  it('uses nearby GIS/resort peers for subdivision keep-exploring, not a city sales dump', () => {
    expect(subdivision).toMatch(/nearbySubdivisionPeers/)
    expect(subdivision).toMatch(/getSubdivisionRing/)
    expect(subdivision).toMatch(/id="nearby-subdivisions"/)
    expect(subdivision).toMatch(/nameOnly/)
    expect(subdivision).not.toMatch(/entries=\{sisterEntries\}/)
  })

  it('adds same-community other-subdivs as name-only cards, not an index dump', () => {
    expect(subdivision).toMatch(/otherCommunitySubdivs/)
    expect(subdivision).toMatch(/id="other-subdivs"/)
    expect(subdivision).not.toMatch(/getIndexableSubdivisions[\s\S]{0,200}otherCommunitySubdivs/)
  })
})

describe('Matt LOCK — sitewide crumb is one component', () => {
  it('every place template overlays V3Breadcrumb on the still', () => {
    for (const page of [city, community, neighborhood, subdivision]) {
      expect(page).toMatch(/<V3Breadcrumb/)
      expect(page).toMatch(/overlay=\{Boolean\(stagePosterSrc\)\}/)
      expect(page).toMatch(/tone=\{stagePosterSrc \? 'on-media' : 'surface'\}/)
    }
    expect(stage).toMatch(/overlay=\{Boolean\(props\.posterSrc\)\}/)
  })

  it('V3Breadcrumb is the only crumb primitive — collapse + overlay live there', () => {
    expect(crumb).toMatch(/from '@\/components\/ui\/breadcrumb'/)
    expect(crumb).toMatch(/V3BreadcrumbCollapse/)
    expect(crumb).toMatch(/overlayCompact/)
    expect(crumb).toMatch(/rungs\.length\s*>=\s*3/)
    expect(crumb).toMatch(/nameOnlyCrumbs/)
  })
})

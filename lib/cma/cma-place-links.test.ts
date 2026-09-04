import { describe, expect, it } from 'vitest'
import {
  cmaSubdivisionHref,
  primaryCmaPlaceLink,
  resolveCmaPlaceLinks,
} from '@/lib/cma/cma-place-links'

describe('cma place links fallback', () => {
  it('maps Deschutes River Recreation Homesites to Three Rivers community, then city', () => {
    const links = resolveCmaPlaceLinks({
      city: 'Bend',
      subdivisionName: 'Deschutes River Recreation Homesites',
      inMappedNeighborhood: false,
    })
    expect(links[0]?.label).toBe('Deschutes River Recreation Homesites')
    expect(links[0]?.href).toContain('/communities/three-rivers')
    expect(links.some((l) => l.href.includes('/cities/bend'))).toBe(true)
  })

  it('prefers mapped neighborhood when present', () => {
    const links = resolveCmaPlaceLinks({
      city: 'Bend',
      neighborhoodName: 'Awbrey Butte',
      neighborhoodSlug: 'awbrey-butte',
      subdivisionName: 'Rim View',
      inMappedNeighborhood: true,
    })
    expect(links[0]?.label).toBe('Awbrey Butte')
    expect(links[0]?.href).toContain('/cities/bend/awbrey-butte')
  })

  it('cmaSubdivisionHref uses registry alias', () => {
    expect(cmaSubdivisionHref('Deschutes River Recreation Homesites')).toContain(
      '/communities/three-rivers',
    )
  })

  it('primary link is first in chain', () => {
    const primary = primaryCmaPlaceLink({
      city: 'Covina',
      subdivisionName: 'Deschutes River Recreation Homesites',
    })
    // Covina is out of service area — still get subdivision→community link.
    expect(primary?.href).toContain('/communities/three-rivers')
  })
})

describe('MLS sentinels', () => {
  it('does not link N/A subdivision names', () => {
    expect(resolveCmaPlaceLinks({ city: 'Bend', subdivisionName: 'N/A' }).map((l) => l.label)).toEqual(['Bend'])
    expect(cmaSubdivisionHref('N/A')).toBeNull()
  })
})

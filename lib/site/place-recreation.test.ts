import { describe, expect, it } from 'vitest'
import { getParkBySlug } from '@/data/co-parks'
import { getTrailBySlug } from '@/data/co-trails'
import { findTrailsNear, lifestyleNearByKind } from '@/lib/explore/lifestyle-near'
import {
  parkDepthLine,
  parkIndexDetail,
  parkParkingLabel,
  parksInCity,
  recreationForCity,
  recreationNearPoint,
  trailDepthLine,
  trailDifficultyLabel,
  trailDistanceLabel,
  trailIndexDetail,
  trailsInCity,
} from './place-recreation'

describe('trail depth', () => {
  it('prints Phil’s difficulty from the land manager and omits invented miles', () => {
    const phils = getTrailBySlug('phils-trail')
    expect(phils).toBeTruthy()
    expect(trailDistanceLabel(phils!)).toBeNull()
    expect(trailDifficultyLabel(phils!)).toBe('Varying')
    expect(phils!.fee).toBe('Free')
    expect(trailDepthLine(phils!)).toMatch(/Varying/)
    expect(trailDepthLine(phils!)).not.toMatch(/\d+(\.\d+)?\s+miles?/)
    expect(trailIndexDetail(phils!)).toBe('Bend · Varying')
  })

  it('keeps Shevlin’s sourced loop distance and still omits a missing rating', () => {
    const shevlin = getTrailBySlug('shevlin-park')
    expect(trailDistanceLabel(shevlin!)).toBe('6 miles loop')
    expect(trailDifficultyLabel(shevlin!)).toBeNull()
    expect(trailDepthLine(shevlin!)).toMatch(/^6 miles loop · /)
    expect(trailDepthLine(shevlin!)).not.toMatch(/Easy|Moderate|Hard|Varying/)
  })
})

describe('park depth', () => {
  it('prints Farewell Bend parking and practical facts from the official page', () => {
    const park = getParkBySlug('farewell-bend-park')
    expect(park).toBeTruthy()
    expect(parkParkingLabel(park!)).toBe(
      'Limited street parking; no dedicated lot. Carpooling is encouraged.',
    )
    expect(park!.hours).toBe('5 am to 10 pm')
    expect(park!.address).toMatch(/Reed Market/)
    const depth = parkDepthLine(park!)
    expect(depth).toMatch(/Limited street parking/)
    expect(depth).toMatch(/22 acres/)
    expect(parkIndexDetail(park!)).toMatch(/Limited street parking/)
  })

  it('omits parking when the registry has no sourced lot or amenity line', () => {
    const park = getParkBySlug('drake-park')
    if (!park) return
    if (park.parking || park.amenities.some((item) => /parking/i.test(item))) return
    expect(parkParkingLabel(park)).toBeNull()
  })

  it('surfaces an existing parking amenity on Pilot Butte without inventing a lot', () => {
    const park = getParkBySlug('pilot-butte')
    expect(parkParkingLabel(park!)).toMatch(/east parking lot/)
  })
})

describe('place recreation wiring', () => {
  it('fills Bend city parks and trails, including Juniper Park and Phil’s', () => {
    expect(parksInCity('Bend').some((park) => park.slug === 'juniper-park')).toBe(true)
    expect(parksInCity('Bend').some((park) => park.slug === 'farewell-bend-park')).toBe(true)
    expect(trailsInCity('Bend').some((trail) => trail.slug === 'phils-trail')).toBe(true)
    const { parks, trails } = recreationForCity('Bend')
    expect(parks.length).toBeGreaterThan(0)
    expect(trails.length).toBeGreaterThan(0)
    expect(parks.some((row) => row.href === '/parks/juniper-park')).toBe(true)
    expect(trails.some((row) => row.href === '/central-oregon/trails/phils-trail')).toBe(true)
    const phils = trails.find((row) => row.href === '/central-oregon/trails/phils-trail')
    expect(String(phils?.detail)).toMatch(/Varying/)
  })

  it('puts Farewell Bend and Phil’s next to Old Bend and Tetherow', () => {
    const oldBend = recreationNearPoint(44.057, -121.305)
    expect(oldBend.parks.some((row) => row.href === '/parks/juniper-park')).toBe(true)
    expect(oldBend.parks.some((row) => row.href === '/parks/farewell-bend-park')).toBe(true)

    const tetherow = recreationNearPoint(44.0306, -121.3599)
    expect(tetherow.trails.some((row) => row.href === '/central-oregon/trails/phils-trail')).toBe(
      true,
    )
    expect(tetherow.parks.some((row) => row.href === '/parks/farewell-bend-park')).toBe(true)
  })

  it('enriches listing-near items with sourced depth and omits empty fields', () => {
    const nearPhils = findTrailsNear(44.044608, -121.384984, 2, 4)
    const phils = nearPhils.find((item) => item.href === '/central-oregon/trails/phils-trail')
    expect(phils?.meta).toMatch(/Varying/)
    expect(phils?.meta).not.toMatch(/\d+(\.\d+)?\s+mi/)
    expect(phils?.overview).toMatch(/Phil's Trail/)

    const listing = lifestyleNearByKind(44.03759, -121.32475)
    const farewell = listing.parks.find((item) => item.href === '/parks/farewell-bend-park')
    expect(farewell?.meta).toMatch(/Limited street parking/)
    expect(farewell?.overview).toMatch(/Farewell Bend Park/)
  })
})

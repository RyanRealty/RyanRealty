import { describe, expect, it } from 'vitest'
import { cityGroundItems, citySchoolItems } from './city-place-face'

describe('cityGroundItems', () => {
  it('names Redmond airport, Juniper, and Smith Rock as nearby from registries', () => {
    const items = cityGroundItems('Redmond', { nearestAirport: 'Redmond (RDM)' })
    const byTerm = Object.fromEntries(items.map((item) => [item.term, item.body]))
    expect(byTerm.Airport).toBe('Redmond (RDM)')
    expect(String(byTerm.Golf)).toMatch(/Juniper/)
    expect(byTerm.Nearby).toBe('Smith Rock State Park')
  })

  it('does not invent a park for a city with none in the registry', () => {
    const items = cityGroundItems('Madras', { nearestAirport: 'Redmond (RDM)' })
    expect(items.some((item) => item.term === 'Nearby')).toBe(false)
  })
})

describe('citySchoolItems', () => {
  it('lists Redmond high schools from the registry', () => {
    const items = citySchoolItems('Redmond')
    const high = items.find((item) => item.term === 'High')
    expect(String(high?.body)).toMatch(/Ridgeview High/)
    expect(String(high?.body)).toMatch(/Redmond High/)
  })
})

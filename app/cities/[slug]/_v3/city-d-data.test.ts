import { describe, expect, it } from 'vitest'
import {
  CITY_TEMPLATE_SLUGS,
  cityDistrictsNote,
  cityHeroLead,
  cityPitchHeading,
  footerCityLinks,
  marketKpis,
  nearbyPlacesForCity,
  schoolsForCity,
} from './city-d-data'

describe('city-d data shaping', () => {
  it('treats Redmond as the airport town from live airport facts, not a slogan table', () => {
    expect(cityPitchHeading({ cityName: 'Redmond', nearestAirport: 'Redmond (RDM)' })).toBe(
      'The airport town',
    )
    expect(cityPitchHeading({ cityName: 'Bend', nearestAirport: 'Redmond (RDM)' })).toBe('Bend')
    expect(cityPitchHeading({ cityName: 'Sisters', nearestAirport: null })).toBe('Sisters')
  })

  it('does not invent a district set for cities that have none', () => {
    expect(cityDistrictsNote(false, 'Redmond')).toMatch(/no official district set/)
    expect(cityDistrictsNote(true, 'Bend')).toBeNull()
  })

  it('prints Spark inventory in the hero lead and never a zero from a missing count', () => {
    expect(
      cityHeroLead({
        cityName: 'Redmond',
        activeCount: 404,
        medianListPrice: 532450,
        medianDaysToPending: 20,
      }),
    ).toMatch(/404 homes for sale in Redmond/)
    expect(
      cityHeroLead({
        cityName: 'Tumalo',
        activeCount: null,
        medianListPrice: null,
        medianDaysToPending: null,
      }),
    ).toMatch(/Single-family homes in Tumalo/)
    expect(
      cityHeroLead({
        cityName: 'Tumalo',
        activeCount: null,
        medianListPrice: null,
        medianDaysToPending: null,
      }),
    ).not.toMatch(/0 homes/)
  })

  it('keeps official city-template slugs and never a Crooked River Ranch city URL', () => {
    expect(CITY_TEMPLATE_SLUGS.has('redmond')).toBe(true)
    expect(CITY_TEMPLATE_SLUGS.has('tumalo')).toBe(true)
    expect(CITY_TEMPLATE_SLUGS.has('black-butte-ranch')).toBe(true)
    expect(CITY_TEMPLATE_SLUGS.has('crooked-river-ranch')).toBe(false)
    const links = footerCityLinks([
      { geoKey: 'redmond', geoLabel: 'Redmond' },
      { geoKey: 'crooked-river-ranch', geoLabel: 'Crooked River Ranch' },
    ])
    expect(links.map((l) => l.href)).toEqual(['/cities/redmond'])
  })

  it('only emits nearby cards that have a live photo', () => {
    const places = nearbyPlacesForCity({
      citySlug: 'redmond',
      cityName: 'Redmond',
      resorts: [{ slug: 'eagle-crest', label: 'Eagle Crest', city_slug: 'redmond', city: 'Redmond' }],
      communities: [],
      resortCounts: new Map([['eagle-crest', 12]]),
    })
    expect(places.length).toBeGreaterThan(0)
    expect(places[0]!.name).toBe('Eagle Crest')
    expect(places[0]!.href).toMatch(/\/communities\/eagle-crest/)
    expect(places[0]!.img.length).toBeGreaterThan(0)
  })

  it('lists Redmond schools from the registry, not invented names', () => {
    const { schools, district } = schoolsForCity('Redmond')
    expect(district).toMatch(/Redmond/)
    expect(schools.some((s) => s.name === 'Ridgeview High')).toBe(true)
    expect(schools.some((s) => s.name === 'Summit High')).toBe(false)
  })

  it('does not invent HOA dollars on the market KPI row', () => {
    const kpis = marketKpis({
      medianListPrice: 532450,
      activeCount: 404,
      medianDaysToPending: 20,
      hasOfficialNeighborhoods: false,
    })
    expect(kpis.map((k) => k.label).join(' ')).not.toMatch(/HOA/i)
    expect(kpis.find((k) => k.label === 'Grain')?.value).toBe('City')
  })
})

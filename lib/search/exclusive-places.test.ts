import { describe, expect, it } from 'vitest'
import {
  applyCommunityToggle,
  isImpliedParentCity,
  pathPlaceFilters,
  placesChipLabel,
  selectedPlaces,
  toExclusivePlaceQuery,
} from './exclusive-places'

describe('exclusive places — Caldera Springs is not Sunriver', () => {
  it('selecting only Caldera Springs → places.length === 1, no Sunriver id', () => {
    const next = applyCommunityToggle({ city: undefined, subdivision: undefined }, 'Caldera Springs')
    expect(next.subdivision).toBe('Caldera Springs')
    expect(next.city).toBeUndefined()

    const places = selectedPlaces(next)
    expect(places).toHaveLength(1)
    expect(places[0]?.id).toBe('caldera-springs')
    expect(places[0]?.kind).toBe('community')
    expect(places.map((p) => p.id)).not.toContain('Sunriver')
    expect(places.map((p) => p.label)).not.toContain('Sunriver')
    expect(placesChipLabel(next)).toBe('Places: Caldera Springs')

    const query = toExclusivePlaceQuery(next)
    expect(query.city).toBeUndefined()
    expect(query.cities).toBeUndefined()
    expect(query.subdivision ?? query.subdivisions?.[0]).toMatch(/caldera springs/i)
    const cityPins = [query.city, ...(query.cities ?? [])].filter(Boolean)
    expect(cityPins.map((c) => c!.toLowerCase())).not.toContain('sunriver')
    expect(cityPins.map((c) => c!.toLowerCase())).not.toContain('bend')
  })

  it('deep link / door from Caldera community page does not append Sunriver', () => {
    expect(isImpliedParentCity('Sunriver', 'Caldera Springs')).toBe(true)
    expect(isImpliedParentCity('sunriver', 'caldera-springs')).toBe(true)
    expect(isImpliedParentCity('Bend', 'Caldera Springs')).toBe(false)

    const path = pathPlaceFilters('Sunriver', 'Caldera Springs')
    expect(path.subdivision).toBe('Caldera Springs')
    expect(path.city).toBeUndefined()
    expect(selectedPlaces(path)).toHaveLength(1)
    expect(placesChipLabel(path)).toBe('Places: Caldera Springs')

    const query = toExclusivePlaceQuery(path)
    expect(query.city).toBeUndefined()
    expect(query.cities).toBeUndefined()
  })

  it('parent city alone still works', () => {
    const path = pathPlaceFilters('Sunriver', undefined)
    expect(path).toEqual({ city: 'Sunriver', subdivision: undefined })
    expect(selectedPlaces(path)).toHaveLength(1)
    expect(placesChipLabel(path)).toBe('Places: Sunriver')

    const query = toExclusivePlaceQuery({ city: 'Sunriver' })
    expect(query.city).toBe('Sunriver')
    expect(query.subdivision).toBeUndefined()
    expect(query.subdivisions).toBeUndefined()
  })

  it('multi-select still works when the user picks both', () => {
    const afterCommunity = applyCommunityToggle({ city: 'Sunriver', subdivision: undefined }, 'Caldera Springs')
    expect(afterCommunity).toEqual({ city: 'Sunriver', subdivision: 'Caldera Springs' })

    const places = selectedPlaces(afterCommunity)
    expect(places).toHaveLength(2)
    expect(places.map((p) => p.kind).sort()).toEqual(['city', 'community'])
    expect(placesChipLabel(afterCommunity)).toBe('Places: 2')

    const query = toExclusivePlaceQuery(afterCommunity)
    expect(query.city).toBe('Sunriver')
    expect(query.subdivision ?? query.subdivisions?.[0]).toMatch(/caldera springs/i)
  })

  it('toggling Caldera off leaves an explicit city pin', () => {
    const on = applyCommunityToggle({ city: 'Sunriver', subdivision: undefined }, 'Caldera Springs')
    const off = applyCommunityToggle(on, 'Caldera Springs')
    expect(off).toEqual({ city: 'Sunriver', subdivision: undefined })
  })

  it('community-only query expands aliases and does not invent Bend from mls_cities', () => {
    const query = toExclusivePlaceQuery({ subdivision: 'Caldera Springs' })
    expect(query.city).toBeUndefined()
    expect(query.cities).toBeUndefined()
    const names = [query.subdivision, ...(query.subdivisions ?? [])].filter(Boolean)
    expect(names.some((n) => /caldera springs/i.test(n!))).toBe(true)
    expect(names.join(' ').toLowerCase()).not.toMatch(/\bbend\b/)
  })
})

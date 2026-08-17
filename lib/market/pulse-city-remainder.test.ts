import { describe, expect, it } from 'vitest'
import {
  formatPulseCityRemainderPublic,
  namePulseCityRemainder,
  pulseCityHrefSlug,
} from './pulse-city-remainder'

const HUB = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
] as const

const CITIES = [
  { label: 'Bend', active: 486, slug: 'bend' },
  { label: 'Redmond', active: 190, slug: 'redmond' },
  { label: 'Sisters', active: 36, slug: 'sisters' },
  { label: 'Sunriver', active: 50, slug: 'sunriver' },
  { label: 'La Pine', active: 175, slug: 'la-pine' },
  { label: 'Tumalo', active: 0, slug: 'tumalo' },
  { label: 'Prineville', active: 82, slug: 'prineville' },
  { label: 'Terrebonne', active: 6, slug: 'terrebonne' },
  { label: 'Madras', active: 50, slug: 'madras' },
  { label: 'Powell Butte', active: 63, slug: 'powell-butte' },
  { label: 'Black Butte Ranch', active: 31, slug: 'black-butte-ranch' },
  { label: 'Culver', active: 11, slug: 'culver' },
  { label: 'Metolius', active: 7, slug: 'metolius' },
  { label: 'Camp Sherman', active: 4, slug: 'camp-sherman' },
  { label: 'Warm Springs', active: 0, slug: 'warm-springs' },
]

describe('namePulseCityRemainder', () => {
  it('names omitted pulse cities with inventory and the TIGER remainder', () => {
    const named = namePulseCityRemainder({
      regionActive: 1840,
      displayedLabels: HUB,
      allCities: CITIES,
    })
    expect(named.displayedSum).toBe(1025)
    expect(named.allCitySum).toBe(1191)
    expect(named.remainder).toBe(649)
    expect(named.omitted.map((c) => c.label)).toEqual([
      'Black Butte Ranch',
      'Camp Sherman',
      'Culver',
      'Madras',
      'Metolius',
      'Powell Butte',
    ])
    expect(named.facts[0]).toContain('Madras 50')
    expect(named.facts[0]).toContain('Powell Butte 63')
    expect(named.facts[0]).not.toMatch(/Tumalo/)
    expect(named.facts.join(' ')).toContain('649 more')
    expect(named.facts.join(' ')).toContain('incorporated-place boundary')
  })

  it('does not invent a remainder when city rows did not return', () => {
    const named = namePulseCityRemainder({
      regionActive: 1840,
      displayedLabels: HUB,
      allCities: [],
    })
    expect(named.remainder).toBeNull()
    expect(named.facts).toEqual([])
    expect(named.omitted).toEqual([])
  })

  it('does not treat a missing region total as a zero remainder', () => {
    const named = namePulseCityRemainder({
      regionActive: null,
      displayedLabels: HUB,
      allCities: CITIES,
    })
    expect(named.remainder).toBeNull()
    expect(named.omitted).toHaveLength(6)
    expect(named.facts.join(' ')).not.toMatch(/more in the region pulse/)
  })

  it('is quiet when the table already covers every city with inventory', () => {
    const named = namePulseCityRemainder({
      regionActive: 1025,
      displayedLabels: HUB,
      allCities: CITIES.filter((c) => HUB.includes(c.label as (typeof HUB)[number])),
    })
    expect(named.omitted).toEqual([])
    expect(named.remainder).toBe(0)
    expect(named.facts).toEqual([])
  })
})

describe('formatPulseCityRemainderPublic', () => {
  it('names omitted cities with an active unit and the TIGER remainder', () => {
    const named = namePulseCityRemainder({
      regionActive: 1840,
      displayedLabels: HUB,
      allCities: CITIES,
    })
    const lines = formatPulseCityRemainderPublic(named)
    expect(lines[0]).toContain('Also in the regional count:')
    expect(lines[0]).toContain('Madras 50 active')
    expect(lines[0]).toContain('Powell Butte 63 active')
    expect(lines[0]).not.toMatch(/Tumalo/)
    expect(lines.join(' ')).toContain('649 more homes')
    expect(lines.join(' ')).toContain('city boundary')
  })

  it('is quiet when the doors already cover every city with inventory', () => {
    const named = namePulseCityRemainder({
      regionActive: 1025,
      displayedLabels: HUB,
      allCities: CITIES.filter((c) => HUB.includes(c.label as (typeof HUB)[number])),
    })
    expect(formatPulseCityRemainderPublic(named)).toEqual([])
  })
})

describe('pulseCityHrefSlug', () => {
  it('turns a pulse geo_slug into a URL segment', () => {
    expect(pulseCityHrefSlug('black butte ranch')).toBe('black-butte-ranch')
    expect(pulseCityHrefSlug('La Pine')).toBe('la-pine')
  })
})

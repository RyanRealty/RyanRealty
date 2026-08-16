import { describe, expect, it } from 'vitest'
import { placeHeroLead } from './place-hero-lead'

describe('placeHeroLead', () => {
  it('labels a known neighborhood count as the neighborhood, not the city', () => {
    const lead = placeHeroLead({
      placeName: 'Awbrey Butte',
      parentName: 'Bend',
      activeCount: 63,
    })
    expect(lead).toBe('in Awbrey Butte. List prices and days on market, pulled live.')
    expect(lead).not.toMatch(/in Bend\b/)
  })

  it('keeps city context only when the count is unknown', () => {
    expect(
      placeHeroLead({
        placeName: 'Awbrey Butte',
        parentName: 'Bend',
        activeCount: null,
      }),
    ).toBe('Single-family homes in Awbrey Butte, Bend. List prices and days on market, pulled live.')
  })

  it('labels a city page as the city', () => {
    expect(
      placeHeroLead({
        placeName: 'Bend',
        activeCount: 486,
      }),
    ).toBe('in Bend. List prices and days on market, pulled live.')
  })

  it('labels a known community count as the community, not the city', () => {
    const lead = placeHeroLead({
      placeName: 'Tetherow',
      parentName: 'Bend',
      activeCount: 18,
      knownSuffix: 'Live inventory from the regional MLS.',
    })
    expect(lead).toBe('in Tetherow. Live inventory from the regional MLS.')
    expect(lead).not.toMatch(/in Bend\b/)
  })

  it('labels a known ZIP count as the ZIP, not the city area nickname', () => {
    expect(
      placeHeroLead({
        placeName: '97703',
        parentName: 'Bend',
        activeCount: 40,
        knownSuffix: 'Live inventory from the regional MLS.',
      }),
    ).toBe('in 97703. Live inventory from the regional MLS.')
  })

  it('refuses an empty place name', () => {
    expect(() => placeHeroLead({ placeName: '  ', activeCount: 1 })).toThrow(/placeName/)
  })
})

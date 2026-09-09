import { describe, expect, it } from 'vitest'
import { platPageTitle } from './plat-title'

describe('platPageTitle', () => {
  it('names the city once when the plat name does not carry it', () => {
    expect(platPageTitle('Courtyard Garages at Broken Top', 'Bend')).toBe('Homes for Sale in Courtyard Garages at Broken Top | Bend, Oregon')
  })
  it('drops the city segment when the plat name already ends in the city', () => {
    expect(platPageTitle('Rock Ridge Cabin Sites of Black Butte Ranch', 'Black Butte Ranch')).toBe(
      'Homes for Sale in Rock Ridge Cabin Sites of Black Butte Ranch, Oregon',
    )
  })
  it('says nothing about the city when none is known', () => {
    expect(platPageTitle('Unplaced Plat', null)).toBe('Homes for Sale in Unplaced Plat')
  })
})

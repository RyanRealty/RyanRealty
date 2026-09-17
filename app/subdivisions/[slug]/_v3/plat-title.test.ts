import { describe, expect, it } from 'vitest'
import { platPageTitle } from './plat-title'

describe('platPageTitle', () => {
  it('names the city once when the plat name does not carry it', () => {
    expect(platPageTitle('Courtyard Garages at Broken Top', 'Bend')).toBe(
      'Courtyard Garages at Broken Top homes for sale · Bend, Oregon',
    )
  })
  it('drops the city segment when the plat name already ends in the city', () => {
    expect(platPageTitle('Rock Ridge Cabin Sites of Black Butte Ranch', 'Black Butte Ranch')).toBe(
      'Rock Ridge Cabin Sites of Black Butte Ranch homes for sale',
    )
  })
  it('says nothing about the city when none is known', () => {
    expect(platPageTitle('Unplaced Plat', null)).toBe('Unplaced Plat homes for sale')
  })
})

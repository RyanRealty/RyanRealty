import { describe, expect, it } from 'vitest'
import {
  EVERY_HOME_LECTURE_REFUSE,
  isEveryHomeLecture,
  placeHomesForSaleHeading,
} from './place-homes-heading'

describe('placeHomesForSaleHeading', () => {
  it('names the place, not a lecture', () => {
    expect(placeHomesForSaleHeading('Parkside Place Phase 1')).toBe(
      'Parkside Place Phase 1 homes for sale',
    )
    expect(placeHomesForSaleHeading('Tetherow')).toBe('Tetherow homes for sale')
  })

  it('refuses the lecture phrase', () => {
    expect(isEveryHomeLecture('Every home for sale in Parkside Place Phase 1')).toBe(true)
    expect(isEveryHomeLecture('Parkside Place Phase 1 homes for sale')).toBe(false)
    expect(EVERY_HOME_LECTURE_REFUSE.test('every home for sale in Tetherow')).toBe(true)
  })
})

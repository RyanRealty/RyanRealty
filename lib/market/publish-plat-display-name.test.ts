import { describe, expect, it } from 'vitest'
import {
  looksLikeMlsAbbreviation,
  publishPlatDisplayName,
} from './publish-plat-display-name'

describe('publishPlatDisplayName', () => {
  it('withholds MLS abbreviations from the Three Rivers / Sunriver / BBR set', () => {
    expect(publishPlatDisplayName('Oww')).toBeNull()
    expect(publishPlatDisplayName('OWW2')).toBeNull()
    expect(publishPlatDisplayName('DrrhTrs')).toBeNull()
    expect(publishPlatDisplayName('Drrh Trs')).toBeNull()
    expect(publishPlatDisplayName('Bbr')).toBeNull()
    expect(publishPlatDisplayName('StoneTH')).toBeNull()
    expect(publishPlatDisplayName('Crr 1')).toBeNull()
  })

  it('keeps human plat names', () => {
    expect(publishPlatDisplayName('River Meadows')).toBe('River Meadows')
    expect(publishPlatDisplayName('Deschutes River Recreation Homesites')).toBe(
      'Deschutes River Recreation Homesites',
    )
    expect(publishPlatDisplayName('Sun Dance')).toBe('Sun Dance')
    expect(publishPlatDisplayName('Ridge At Eagle Crest')).toBe('Ridge At Eagle Crest')
    expect(publishPlatDisplayName('PointsWest')).toBe('PointsWest')
    expect(publishPlatDisplayName('Mtn High')).toBe('Mtn High')
    expect(publishPlatDisplayName('Triple')).toBe('Triple')
  })

  it('still drops MLS sentinels', () => {
    expect(publishPlatDisplayName('N/A')).toBeNull()
    expect(publishPlatDisplayName('***masked')).toBeNull()
  })

  it('treats compacted no-vowel tokens as abbreviations', () => {
    expect(looksLikeMlsAbbreviation('Drrh Trs')).toBe(true)
    expect(looksLikeMlsAbbreviation('OWW2')).toBe(true)
    expect(looksLikeMlsAbbreviation('River Meadows')).toBe(false)
  })

  it('withholds camelCase MLS codes and truncated Village tokens', () => {
    expect(publishPlatDisplayName('WildflS')).toBeNull()
    expect(publishPlatDisplayName('SkylinC')).toBeNull()
    expect(publishPlatDisplayName('Fairway Vill Condo')).toBeNull()
    expect(looksLikeMlsAbbreviation('WildflS')).toBe(true)
    expect(looksLikeMlsAbbreviation('SkylinC')).toBe(true)
  })
})

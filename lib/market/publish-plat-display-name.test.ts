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
    // Kept, not withheld — which is what this case is for. The CASING changed on
    // 2026-09-08: the MLS capitalises every word and the page published "Ridge
    // At Eagle Crest" into the H1, breadcrumb, five Q&A questions and the
    // FAQPage JSON-LD. Lowering an interior connector is English title case, not
    // a rename, so no word is added, dropped or reordered.
    expect(publishPlatDisplayName('Ridge At Eagle Crest')).toBe('Ridge at Eagle Crest')
    expect(publishPlatDisplayName('PointsWest')).toBe('PointsWest')
    expect(publishPlatDisplayName('Mtn High')).toBe('Mtn High')
    expect(publishPlatDisplayName('Triple')).toBe('Triple Knot')
    expect(publishPlatDisplayName('triple')).toBe('Triple Knot')
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

describe('English title case, not per-word capitalisation', () => {
  it('lowers an interior connector so a plat reads as a name', () => {
    expect(publishPlatDisplayName('Ridge At Eagle Crest')).toBe('Ridge at Eagle Crest')
    expect(publishPlatDisplayName('Inn Of The 7th Mountain')).toBe('Inn of the 7th Mountain')
  })

  it('keeps the first and last words capitalised', () => {
    expect(publishPlatDisplayName('The Ridge')).toBe('The Ridge')
    expect(publishPlatDisplayName('At The River')).toBe('At the River')
  })

  it('leaves a name with no connector exactly as recorded', () => {
    expect(publishPlatDisplayName('Black Butte Ranch')).toBe('Black Butte Ranch')
    expect(publishPlatDisplayName('Awbrey Glen')).toBe('Awbrey Glen')
  })

  it('does not rescue a withheld abbreviation by casing it', () => {
    expect(publishPlatDisplayName('Oww')).toBeNull()
    expect(publishPlatDisplayName('DrrhTrs')).toBeNull()
  })

  it('still prefers a recorded visitor name over any casing rule', () => {
    expect(publishPlatDisplayName('Triple')).toBe('Triple Knot')
    expect(publishPlatDisplayName('Farm The')).toBe('The Farm')
  })
})

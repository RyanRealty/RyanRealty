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

  it('withholds Caldera MLS filing dumps and keeps visitor phase names', () => {
    expect(publishPlatDisplayName('Olu')).toBeNull()
    expect(publishPlatDisplayName('Sfr')).toBeNull()
    expect(publishPlatDisplayName('Olu Phase A')).toBeNull()
    expect(publishPlatDisplayName('Phase C1 Sfr')).toBeNull()
    expect(publishPlatDisplayName('Caldera Springs, Phase C-2')).toBeNull()
    expect(publishPlatDisplayName('Caldera Springs Olu, Phase C-2')).toBeNull()
    expect(publishPlatDisplayName('Phase D')).toBeNull()
    expect(publishPlatDisplayName('Tetherow Phase 1')).toBe('Tetherow Phase 1')
    expect(publishPlatDisplayName('Caldera Springs Phase Three')).toBe('Caldera Springs Phase Three')
    expect(publishPlatDisplayName('Parkside Place Phase 2')).toBe('Parkside Place Phase 2')
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

  it('withholds Caldera MLS phase-chip dumps without inventing expansions', () => {
    expect(publishPlatDisplayName('Olu')).toBeNull()
    expect(publishPlatDisplayName('Sfr')).toBeNull()
    expect(publishPlatDisplayName('Phase C1 Sfr')).toBeNull()
    expect(publishPlatDisplayName('Olu Phase A')).toBeNull()
    expect(publishPlatDisplayName('Caldera Springs, Phase C-2')).toBeNull()
    expect(publishPlatDisplayName('Caldera Springs Olu, Phase C-2')).toBeNull()
    expect(publishPlatDisplayName('Phase D')).toBeNull()
    expect(looksLikeMlsAbbreviation('Phase C-2')).toBe(true)
    expect(looksLikeMlsAbbreviation('Parkside Place Phase 1')).toBe(false)
    expect(looksLikeMlsAbbreviation('Homesites Phase Twenty-two')).toBe(false)
    expect(looksLikeMlsAbbreviation('Stevens Ranch Phase RS-1')).toBe(false)
    expect(publishPlatDisplayName('Parkside Place Phase 1')).toBe('Parkside Place Phase 1')
    expect(publishPlatDisplayName('Stevens Ranch Phase RS-1')).toBe('Stevens Ranch Phase RS-1')
  })

  it('still prefers a recorded visitor name over any casing rule', () => {
    expect(publishPlatDisplayName('Triple')).toBe('Triple Knot')
    expect(publishPlatDisplayName('Farm The')).toBe('The Farm')
  })
})

describe('MLS width truncations (visibility audit 2026-09-22, VOICE-3)', () => {
  it('withholds names cut mid-word by the MLS field width', () => {
    expect(publishPlatDisplayName('Deschutes River Trac')).toBeNull()
    expect(publishPlatDisplayName('Deschutes River Tr')).toBeNull()
    expect(publishPlatDisplayName('Aspen Creek Mob Pk')).toBeNull()
    expect(publishPlatDisplayName('Green Pastures Mob')).toBeNull()
    expect(publishPlatDisplayName('Pioneer Business Prk')).toBeNull()
  })

  it('withholds a name that stops on a bare ordinal', () => {
    expect(publishPlatDisplayName('Inn Of The 7th')).toBeNull()
    expect(publishPlatDisplayName('Steve W Yancey 2nd')).toBeNull()
    expect(publishPlatDisplayName('Inn Of The 7th Mountain')).toBe('Inn of the 7th Mountain')
  })

  it('withholds a run of vowel-less codes but keeps one readable abbreviation', () => {
    expect(publishPlatDisplayName('Desc Rvr Hmst Rimrk')).toBeNull()
    expect(publishPlatDisplayName('Mtn Village East')).toBe('Mtn Village East')
    expect(publishPlatDisplayName('Reed Mkt East')).toBe('Reed Mkt East')
    expect(publishPlatDisplayName('Terrebonne Est')).toBe('Terrebonne Est')
  })

  it('keeps brand names with interior capitals', () => {
    expect(publishPlatDisplayName('NorthWest Crossing')).toBe('NorthWest Crossing')
    expect(publishPlatDisplayName('SaddleStone')).toBe('SaddleStone')
    expect(publishPlatDisplayName('Deschutes RiverWoods')).toBe('Deschutes RiverWoods')
  })

  it("recases a city's own name without renaming the plat", () => {
    expect(publishPlatDisplayName('PrineVille - Fifth')).toBe('Prineville - Fifth')
  })
})

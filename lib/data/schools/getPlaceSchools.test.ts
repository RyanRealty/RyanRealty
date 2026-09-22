import { describe, expect, it } from 'vitest'
import { placeSchoolsFromRows } from './getPlaceSchools'

describe('placeSchoolsFromRows', () => {
  it('lists Tetherow attendance schools elementary, then middle by share, then high', () => {
    const schools = placeSchoolsFromRows([
      { geo_slug: 'summit-high', geo_label: 'Summit High', share: 1 },
      { geo_slug: 'pacific-crest-middle', geo_label: 'Pacific Crest Middle', share: 0.135 },
      { geo_slug: 'cascade-middle', geo_label: 'Cascade Middle', share: 0.865 },
      { geo_slug: 'william-e-miller-elem', geo_label: 'William E Miller Elem', share: 1 },
      { geo_slug: 'not-a-school', geo_label: 'Not A School', share: 0.4 },
      { geo_slug: 'high-lakes-elem', geo_label: 'High Lakes Elem', share: 0.049 },
    ])
    expect(schools.map((s) => s.slug)).toEqual([
      'william-e-miller-elem',
      'cascade-middle',
      'pacific-crest-middle',
      'summit-high',
    ])
    expect(schools.map((s) => s.name)).toEqual([
      'William E Miller Elem',
      'Cascade Middle',
      'Pacific Crest Middle',
      'Summit High',
    ])
  })

  it('keeps a school that covers exactly 5% and resolves a label when the slug misses', () => {
    const schools = placeSchoolsFromRows([
      { geo_slug: 'w-e-miller', geo_label: 'William E Miller Elem', share: '0.0500' },
    ])
    expect(schools).toEqual([
      {
        slug: 'william-e-miller-elem',
        name: 'William E Miller Elem',
        level: 'elementary',
        share: 0.05,
      },
    ])
  })

  it('returns nothing for an empty read', () => {
    expect(placeSchoolsFromRows([])).toEqual([])
  })
})

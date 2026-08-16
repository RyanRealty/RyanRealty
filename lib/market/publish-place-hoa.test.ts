import { describe, expect, it } from 'vitest'
import {
  formatPlaceHoaAnnual,
  placeHoaGlanceLabel,
  publishPlaceHoa,
} from './publish-place-hoa'

describe('publishPlaceHoa', () => {
  it('prefers master when a sub-neighborhood estimate is higher (Tetherow founding)', () => {
    expect(
      publishPlaceHoa({
        masterAnnual: 1464,
        estimateAnnual: null,
        subEstimates: [2244, 2004, 2124, 1464, 4220],
      }),
    ).toEqual({ annual: 1464, kind: 'master' })
  })

  it('uses the floor of estimates when no master is on file', () => {
    expect(
      publishPlaceHoa({
        masterAnnual: null,
        estimateAnnual: 2244,
        subEstimates: [2244, 2004, 3536],
      }),
    ).toEqual({ annual: 2004, kind: 'estimate' })
  })

  it('returns null when every source is missing or non-positive', () => {
    expect(publishPlaceHoa({})).toBeNull()
    expect(publishPlaceHoa({ masterAnnual: 0, estimateAnnual: -5, subEstimates: [null] })).toBeNull()
  })

  it('labels glance Master HOA vs HOA estimate from the same annual', () => {
    expect(placeHoaGlanceLabel('master')).toBe('Master HOA')
    expect(placeHoaGlanceLabel('estimate')).toBe('HOA estimate')
    expect(formatPlaceHoaAnnual(1464)).toBe('$1,464/yr')
  })
})

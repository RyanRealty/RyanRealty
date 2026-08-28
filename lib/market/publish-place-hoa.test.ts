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

  // D103 (2026-08-27): the measured tier — a live median from member listings
  // outranks both a master assessment and a registry estimate, because a
  // measurement is not a guess.
  it('prefers a measured median over master and every estimate', () => {
    expect(
      publishPlaceHoa({
        measuredAnnual: 2052,
        measuredBasis: 'median of the 6 current listings that report dues',
        masterAnnual: 1464,
        estimateAnnual: 1464,
        subEstimates: [2244, 2004],
      }),
    ).toEqual({
      annual: 2052,
      kind: 'measured',
      basis: 'median of the 6 current listings that report dues',
    })
  })

  it('falls through to master, then estimate, when no measurement clears the floor', () => {
    expect(
      publishPlaceHoa({ measuredAnnual: null, measuredBasis: null, masterAnnual: 1464 }),
    ).toEqual({ annual: 1464, kind: 'master' })
    expect(
      publishPlaceHoa({ measuredAnnual: 0, masterAnnual: null, estimateAnnual: 1464 }),
    ).toEqual({ annual: 1464, kind: 'estimate' })
  })

  it('labels glance HOA (measured) for the measured kind', () => {
    expect(placeHoaGlanceLabel('measured')).toBe('HOA (measured)')
  })
})

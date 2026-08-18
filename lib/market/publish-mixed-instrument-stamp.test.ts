import { describe, expect, it } from 'vitest'
import { publishInstrumentStamp } from './publish-mixed-instrument-stamp'

describe('publishInstrumentStamp', () => {
  it('publishes a stamp when every figure shares one clock', () => {
    expect(publishInstrumentStamp(['2026-08-18T12:00:00.000Z', '2026-08-18T12:00:00.000Z'])).toBe(
      '2026-08-18T12:00:00.000Z',
    )
    expect(publishInstrumentStamp(['2026-08-10T00:00:00.000Z', null])).toBe(
      '2026-08-10T00:00:00.000Z',
    )
  })

  it('withholds a stamp when two clocks share one instrument', () => {
    expect(
      publishInstrumentStamp(['2026-08-10T00:00:00.000Z', '2026-08-18T12:00:00.000Z']),
    ).toBeNull()
  })

  it('withholds when no clock is present', () => {
    expect(publishInstrumentStamp([null, undefined, ''])).toBeNull()
    expect(publishInstrumentStamp([])).toBeNull()
  })
})

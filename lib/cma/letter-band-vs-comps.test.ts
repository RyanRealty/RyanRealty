import { describe, expect, it } from 'vitest'
import { bandVersusClosedCompsCheck } from '@/lib/cma/letter-consistency'

describe('band overlaps closed comps', () => {
  it('Marys Grace shape: a band under every closed comp fails', () => {
    const check = bandVersusClosedCompsCheck(
      { valueLow: 531_000, valueHigh: 577_000 },
      [
        { adjustedPrice: 610_000, closePrice: 610_000 },
        { adjustedPrice: 640_000, closePrice: 640_000 },
        { adjustedPrice: 665_000, closePrice: 665_000 },
      ],
    )
    expect(check.id).toBe('band-overlaps-closed-comps')
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/entirely below/)
  })

  it('passes when the band overlaps the comps, and when a band sits over all of them it fails', () => {
    expect(
      bandVersusClosedCompsCheck(
        { valueLow: 620_000, valueHigh: 640_000 },
        [{ adjustedPrice: 610_000 }, { adjustedPrice: 665_000 }],
      ).pass,
    ).toBe(true)
    const above = bandVersusClosedCompsCheck(
      { valueLow: 700_000, valueHigh: 740_000 },
      [{ closePrice: 610_000 }, { closePrice: 665_000 }],
    )
    expect(above.pass).toBe(false)
    expect(above.detail).toMatch(/entirely above/)
  })

  it('passes when there are no comps to grade', () => {
    expect(bandVersusClosedCompsCheck({ valueLow: 531_000, valueHigh: 577_000 }, []).pass).toBe(true)
  })
})

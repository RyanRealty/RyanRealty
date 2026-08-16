import { describe, expect, it } from 'vitest'
import { publishFinancingSplit } from './publish-down-payment'

describe('publishFinancingSplit', () => {
  it('keeps the Rockway founding case at exact 20% dollars', () => {
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: 20 })).toEqual({
      price: 649000,
      downPayment: 129800,
      loanAmount: 519200,
      downPaymentPct: 20,
    })
  })

  it('makes down payment and loan sum to the listed price', () => {
    const published = publishFinancingSplit({ price: 649000, downPaymentPct: 20 })
    expect(published).not.toBeNull()
    expect(published!.downPayment + published!.loanAmount).toBe(649000)
  })

  it('does not thousand-round a 20% down that is not a thousand', () => {
    const published = publishFinancingSplit({ price: 649000, downPaymentPct: 20 })
    expect(published?.downPayment).toBe(129800)
    expect(published?.downPayment).not.toBe(130000)
    expect(published?.loanAmount).not.toBe(519000)
  })

  it('withholds a missing or non-positive price', () => {
    expect(publishFinancingSplit({ price: 0, downPaymentPct: 20 })).toBeNull()
    expect(publishFinancingSplit({ price: null, downPaymentPct: 20 })).toBeNull()
    expect(publishFinancingSplit({ price: Number.NaN, downPaymentPct: 20 })).toBeNull()
  })

  it('withholds a percent outside 0-100', () => {
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: -1 })).toBeNull()
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: 101 })).toBeNull()
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: null })).toBeNull()
  })

  it('treats 0% down as a full-price loan', () => {
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: 0 })).toEqual({
      price: 649000,
      downPayment: 0,
      loanAmount: 649000,
      downPaymentPct: 0,
    })
  })

  it('treats 100% down as a zero loan', () => {
    expect(publishFinancingSplit({ price: 649000, downPaymentPct: 100 })).toEqual({
      price: 649000,
      downPayment: 649000,
      loanAmount: 0,
      downPaymentPct: 100,
    })
  })
})

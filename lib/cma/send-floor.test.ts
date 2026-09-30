import { describe, expect, it } from 'vitest'
import { EXPIRED_SEND_FLOOR_RATIO, expiredSendFloor } from './send-floor'

describe('expiredSendFloor (Matt 2026-09-30: under 80% of the last list never sends)', () => {
  it('holds the four CMAs that went out on 2026-09-30', () => {
    // recommended vs last list, as sent
    const sent: Array<[string, number, number]> = [
      ['3759 45th', 618_000, 849_000],
      ['3573 47th', 791_000, 1_098_000],
      ['714 Wrangler', 755_000, 999_900],
      ['2955 Bentwood', 652_000, 825_000],
    ]
    for (const [, price, last] of sent) {
      const r = expiredSendFloor({ isExpired: true, price, lastListPrice: last })
      expect(r.held).toBe(true)
    }
  })

  it('names the price, the share and the last list in the reason', () => {
    const r = expiredSendFloor({ isExpired: true, price: 618_000, lastListPrice: 849_000 })
    expect(r.held).toBe(true)
    expect(r.reason).toContain('$618,000')
    expect(r.reason).toContain('72.7%')
    expect(r.reason).toContain('$849,000')
  })

  it('lets a CMA at or above the line through', () => {
    expect(expiredSendFloor({ isExpired: true, price: 800_000, lastListPrice: 1_000_000 }).held).toBe(false)
    expect(expiredSendFloor({ isExpired: true, price: 940_000, lastListPrice: 1_000_000 }).held).toBe(false)
    expect(EXPIRED_SEND_FLOOR_RATIO).toBe(0.8)
  })

  it('holds one dollar under the line', () => {
    expect(expiredSendFloor({ isExpired: true, price: 799_999, lastListPrice: 1_000_000 }).held).toBe(true)
  })

  it('fails closed when the price or the last list is missing', () => {
    expect(expiredSendFloor({ isExpired: true, price: null, lastListPrice: 900_000 }).held).toBe(true)
    expect(expiredSendFloor({ isExpired: true, price: 700_000, lastListPrice: null }).held).toBe(true)
    expect(expiredSendFloor({ isExpired: true, price: 700_000, lastListPrice: 0 }).held).toBe(true)
  })

  it('never holds a CMA that is not for an expired listing', () => {
    expect(expiredSendFloor({ isExpired: false, price: 100_000, lastListPrice: 1_000_000 }).held).toBe(false)
    expect(expiredSendFloor({ isExpired: false, price: null, lastListPrice: null }).held).toBe(false)
  })
})

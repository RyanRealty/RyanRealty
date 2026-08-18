import { describe, expect, it } from 'vitest'
import {
  publishSellValuationConfirm,
  sellQualifyNameRequired,
  SELL_VALUATION_CONFIRM_SLA,
} from './publish-sell-valuation'

describe('publishSellValuationConfirm', () => {
  it('names the 24-hour SLA and never a business-day hedge', () => {
    expect(SELL_VALUATION_CONFIRM_SLA).toBe('within 24 hours')
    const body = publishSellValuationConfirm(false)
    expect(body).toContain('within 24 hours')
    expect(body).not.toMatch(/business day/i)
    expect(sellQualifyNameRequired()).toBe(false)
  })

  it('keeps the short-timeline follow-up on a hot lead', () => {
    expect(publishSellValuationConfirm(true)).toContain('timeline is short')
  })
})

import { describe, expect, it } from 'vitest'
import { cmaBlockedBecauseOnMarket } from '@/lib/cma/on-market'

describe('cmaBlockedBecauseOnMarket', () => {
  it('refuses a home that is listed', () => {
    expect(cmaBlockedBecauseOnMarket('Active')).toMatch(/Active on the market/)
    expect(cmaBlockedBecauseOnMarket('Pending')).toMatch(/Pending/)
    expect(cmaBlockedBecauseOnMarket('Coming Soon')).toMatch(/Coming Soon/)
    expect(cmaBlockedBecauseOnMarket('Active Under Contract')).toMatch(/Active Under Contract/)
  })

  it('builds a home that came off without selling', () => {
    expect(cmaBlockedBecauseOnMarket('Expired')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Canceled')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Withdrawn')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Closed')).toBeNull()
    expect(cmaBlockedBecauseOnMarket(null)).toBeNull()
    expect(cmaBlockedBecauseOnMarket('  ')).toBeNull()
  })
})

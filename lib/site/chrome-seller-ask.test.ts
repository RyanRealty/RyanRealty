import { describe, expect, it } from 'vitest'
import { chromeShowsSellerAsk } from './chrome-seller-ask'

describe('chromeShowsSellerAsk', () => {
  it('shows the filled ask on Sell and its leaves', () => {
    for (const path of ['/sell', '/sell/valuation', '/sell/valuation?from=/cities/bend']) {
      expect(chromeShowsSellerAsk(path), path).toBe(true)
    }
  })

  it('hides the filled ask on the money-path buyer and trust pages', () => {
    for (const path of [
      '/',
      '/homes-for-sale',
      '/cities/bend',
      '/communities/tetherow',
      '/housing-market',
      '/about',
      '/homes-for-sale/bend/tetherow/61281-mcroberts-220218727',
    ]) {
      expect(chromeShowsSellerAsk(path), path).toBe(false)
    }
  })

  it('hides when the path is unknown', () => {
    expect(chromeShowsSellerAsk(null)).toBe(false)
    expect(chromeShowsSellerAsk(undefined)).toBe(false)
    expect(chromeShowsSellerAsk('')).toBe(false)
  })
})

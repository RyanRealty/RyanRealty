import { describe, it, expect } from 'vitest'
import { valuationHref } from '@/lib/site/valuation-href'

describe('valuationHref', () => {
  it('carries the originating path and keeps the anchor last', () => {
    const h = valuationHref('/housing-market/central-oregon')
    expect(h).toContain('from=%2Fhousing-market%2Fcentral-oregon')
    expect(h.indexOf('#')).toBeGreaterThan(h.indexOf('from='))
  })
  it('drops anything that is not a simple site-relative path', () => {
    for (const bad of ['https://evil.test', '//evil.test', '', null, undefined]) {
      expect(valuationHref(bad as string)).not.toContain('from=')
    }
  })
})

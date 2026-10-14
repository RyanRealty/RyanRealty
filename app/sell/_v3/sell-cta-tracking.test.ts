import { describe, expect, it } from 'vitest'
import { checkSellCtaTracking, unhookedControls } from '../../../scripts/check-sell-cta-tracking.mjs'

/**
 * Matt's hard rule (2026-09-28): a /sell CTA without its tracking hook fails
 * the build. The gate script is the single source; this runs it in vitest and
 * proves it actually catches an unhooked control.
 */
describe('/sell CTA tracking hooks', () => {
  it('every /sell control carries data-sell-cta and the tracker is mounted', () => {
    expect(checkSellCtaTracking()).toEqual([])
  })

  it('catches a link without the hook', () => {
    const bad = unhookedControls('<p><a href="/book">Book</a> <a href="#x" data-sell-cta="ok">ok</a></p>')
    expect(bad).toHaveLength(1)
    expect(bad[0].tag).toContain('/book')
  })
})

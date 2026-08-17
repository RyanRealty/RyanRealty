import { describe, expect, it } from 'vitest'
import { coverValueBlockHtml, expectedSale, immersiveAnswerHtml } from '@/lib/cma/cover-value'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '850 Quince',
  city: 'Redmond',
  subdivision: 'Quince',
} as CmaSubject

const pricing = {
  method1Low: 460000,
  method1Mid: 470000,
  method1High: 480000,
  method2: 468000,
  method3: 477000,
  conservative: 470000,
  recommended: 505000,
  highEnd: 515000,
  valueLow: 470000,
  valueHigh: 515000,
  predictedClose: 495000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  notes: [],
} as unknown as CmaPricing

const args = {
  subject,
  comps: [{ address: '1 Comp', closePrice: 490000, adjustedPrice: 492000, weight: 1 }] as CmaAdjustedComp[],
  market: null,
  pricing,
  tiersUsed: ['subdivision-9mo', 'nearby-1mi-3mo'],
}

describe('expectedSale', () => {
  it('uses the engine close when it is present', () => {
    expect(expectedSale(pricing)).toBe(495000)
    expect(expectedSale({ ...pricing, predictedClose: null })).toBe(505000)
  })
})

describe('cover and immersive value blocks', () => {
  it('leads with expected sale, the list range, and the search story', () => {
    const html = coverValueBlockHtml(args)
    expect(html).toContain('Expected sale')
    expect(html).toContain('$495,000')
    expect(html).toContain('List this home $470,000 to $515,000')
    expect(html).toContain('Recommended list $505,000')
    expect(html).toContain('opened to 1 mile')
    expect(html).not.toMatch(/[—;]/)
    expect(html).not.toMatch(/confidence|not the ZIP/i)
  })

  it('keeps recommended list as the lead on old drafts without a close', () => {
    const html = coverValueBlockHtml({
      ...args,
      pricing: { ...pricing, predictedClose: null },
      tiersUsed: [],
    })
    expect(html).toContain('Recommended list price')
    expect(html).toContain('$505,000')
    expect(html).not.toMatch(/stayed inside/)
  })

  it('names the comp-supported range when the list sits outside it', () => {
    const html = immersiveAnswerHtml({
      ...args,
      pricing: {
        ...pricing,
        recommended: 609000,
        conservative: 584000,
        highEnd: 619999,
        valueLow: 620000,
        valueHigh: 635000,
        predictedClose: null,
      },
    })
    expect(html).toContain('The comp-supported range is $620,000 to $635,000')
    expect(html).toMatch(/capped below this range/)
  })
})

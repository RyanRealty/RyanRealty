import { describe, expect, it } from 'vitest'
import { coverValueBlockHtml, expectedSale, immersiveAnswerHtml, immersiveHeroNumberHtml } from '@/lib/cma/cover-value'
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
  it('leads with recommended list and list range, without expected sale', () => {
    const html = coverValueBlockHtml(args)
    expect(html).toContain('Our Recommended List Price for your home')
    expect(html).toContain('$505,000')
    expect(html).toContain('List $470,000 to $515,000')
    expect(html).not.toContain('Recommended list $')
    expect(html).not.toContain('Expected close')
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
    expect(html).toContain('Our Recommended List Price for your home')
    expect(html).toContain('$505,000')
    expect(html).not.toContain('Expected close')
    expect(html).not.toMatch(/stayed inside/)
  })

  it('puts the recommended list on the immersive hero payoff', () => {
    const html = immersiveHeroNumberHtml(args)
    expect(html).toContain('hero-payoff')
    expect(html).toContain('Our Recommended List Price for your home')
    expect(html).toContain('$505,000')
    expect(html).not.toContain('Expected close')
    expect(html).not.toMatch(/[—;]/)
    // Headline is the long form once; fold label is not the short "Recommended list".
    expect(html).not.toMatch(/>Recommended list</)
  })

  it('names what the sales support when the list sits outside it', () => {
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
    expect(html).toContain('The sales support $620,000 to $635,000')
    expect(html).toMatch(/capped below this range/)
  })
})


describe('coverWorthSentence — the number capped below the range', () => {
  it("Concorde: says the sales support the range and the cap, never 'worth' beside a lower number", async () => {
    const { coverWorthSentence } = await import('./cover-value')
    const p = {
      recommended: 1_473_000,
      conservative: 1_413_000,
      highEnd: 1_473_000,
      valueLow: 1_550_000,
      valueHigh: 3_255_000,
      clamp: { kind: 'failed-ask', appliedTo: 'recommended', before: 2_235_000, after: 1_473_000, basis: { ratio: 0.982, source: 'x' }, applications: [], sentence: 's' },
    } as unknown as import('@/lib/cma/types').CmaPricing
    const t = coverWorthSentence(p, { omitAsk: true })
    expect(t).toBe('The sales support $1,550,000 to $3,255,000. The list price is capped below that by the price that already failed to sell.')
    expect(t).not.toMatch(/worth/)
    const plain = coverWorthSentence({ ...p, clamp: null, recommended: 1_700_000 } as unknown as import('@/lib/cma/types').CmaPricing, { omitAsk: true })
    expect(plain).toBe('Your home is worth $1,550,000 to $3,255,000 today.')
  })
})

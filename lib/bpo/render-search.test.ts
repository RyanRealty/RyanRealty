import { describe, expect, it } from 'vitest'
import { renderBpoHtml, type RenderBpoArgs } from '@/lib/bpo/render'

function args(): RenderBpoArgs {
  return {
    subject: {
      streetAddress: '850 Quince',
      city: 'Redmond',
      state: 'OR',
      subdivision: 'Quince',
    },
    comps: [],
    market: null,
    history: {
      cycles: [],
      attemptsCount: 0,
      failedAttemptsCount: 0,
      currentCycle: null,
      currentIsActive: false,
      currentDaysOnMarket: null,
      currentListPrice: null,
      currentOriginalListPrice: null,
      currentCutFromOriginalPct: null,
      peakAskingPrice: null,
      totalDeclineFromPeakPct: null,
      lastSalePrice: null,
      lastSaleDate: null,
      signals: [],
      listingPressureAdjustmentPct: 0,
      trace: [],
    },
    opinion: {
      opinionValue: 495000,
      valueLow: 470000,
      valueHigh: 515000,
      confidence: 'High',
      confidenceReason: 'Tight set.',
      vsCurrentListPct: null,
      compAnchor: 495000,
      priceOverride: null,
      reasoning: ['Expected sale from the pricing engine.'],
    },
    offer: {
      mode: 'seller',
      posture: 'balanced',
      leverageScore: 50,
      headline: 'Price at the expected sale.',
      openingOffer: null,
      targetOffer: null,
      ceiling: null,
      recommendedList: 505000,
      expectedOfferLow: 470000,
      expectedOfferHigh: 515000,
      leverage: [],
      terms: ['Standard financing contingency.'],
    },
    broker: {
      id: 'id-matt',
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Broker',
      licenseNumber: null,
      email: null,
      phone: null,
      photoUrl: null,
    },
    rationale: 'The expected sale is the pricing-engine close.',
    purpose: 'Pre-listing',
    generatedAtIso: '2026-08-17T00:00:00.000Z',
    tiersUsed: ['subdivision-9mo', 'nearby-1mi-3mo'],
    mapDataUri: 'data:image/png;base64,aaa',
  } as unknown as RenderBpoArgs
}

describe('BPO comp search story', () => {
  it('draws the subdivision story and the map when the ladder left the plat', () => {
    const { html } = renderBpoHtml(args())
    expect(html).toContain('Quince, then 1 mile')
    expect(html).toContain('The outline is the subdivision')
    expect(html).toContain('The circle is the search')
    expect(html).toContain('data:image/png;base64,aaa')
    expect(html).toContain('There were not enough recent sales inside Quince, so we opened to 1 mile from the last 9 months.')
  })
})

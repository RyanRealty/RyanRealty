import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import {
  buildSellerProceeds,
  computeSellerProceeds,
  renderSellerProceedsPrintHtml,
  renderSellerProceedsSceneHtml,
  titleEscrowEstimate,
} from '@/lib/cma/seller-proceeds'
import type { CmaPricing } from '@/lib/cma/types'

const pricing = {
  recommended: 438000,
  conservative: 438000,
  highEnd: 465000,
  sellerNet: { expectedConcessions: 5000, predictedSellerNet: 433000, knownCount: 3, givenCount: 2, medianWhenGiven: 7500, rate: 0.67 },
  notes: [],
} as unknown as CmaPricing

describe('computeSellerProceeds', () => {
  it('subtracts fees, concessions, title, recording, and payoff', () => {
    const out = computeSellerProceeds({
      salePrice: 438000,
      listingFeePct: 3,
      buyerBrokerPct: 2.5,
      concessions: 5000,
      titleEscrow: 2190,
      recording: 350,
      mortgagePayoff: 310000,
    })
    expect(out.listingFee).toBe(13140)
    expect(out.buyerBroker).toBe(10950)
    expect(out.totalCosts).toBe(13140 + 10950 + 5000 + 2190 + 350 + 310000)
    expect(out.estimatedNet).toBe(438000 - out.totalCosts)
  })
})

describe('buildSellerProceeds', () => {
  it('starts payoff at the amortized estimate when one exists', () => {
    const sheet = buildSellerProceeds({
      pricing,
      parcel: {
        taxAccount: '1',
        currentOwner: 'CLEAVENGER',
        ownedSince: '2021-07-29',
        acquiredAt: 445000,
        sales: [],
        permits: [],
        source: 'DIAL',
        agentNotes: [],
      },
      mortgage: {
        purchasePrice: 445000,
        purchaseDate: '2021-07-29',
        assumedOriginal: 356000,
        ltvPct: 80,
        ratePct: 2.87,
        rateDate: '2021-07-08',
        rateSource: 'Freddie Mac PMMS',
        monthsPaid: 61,
        remainingEstimate: 312000,
        source: 'Last recorded purchase.',
      },
    })
    expect(sheet.inputs.mortgagePayoff).toBe(312000)
    expect(sheet.equityBeforeLoan).toBe(438000 - 445000)
    expect(titleEscrowEstimate(438000)).toBe(2190)
  })

  it('does not call a price drop a gain', () => {
    const sheet = buildSellerProceeds({
      pricing: { ...pricing, recommended: 400000 } as CmaPricing,
      parcel: {
        taxAccount: '1',
        currentOwner: 'X',
        ownedSince: '2021-07-29',
        acquiredAt: 445000,
        sales: [],
        permits: [],
        source: 'DIAL',
        agentNotes: [],
      },
    })
    const html = renderSellerProceedsPrintHtml(sheet)
    expect(html).toContain('under what you paid')
    expect(html).not.toContain('the gain before loan payoff is -$')
  })

  it('starts payoff at zero when remaining principal is unknown', () => {
    const sheet = buildSellerProceeds({ pricing })
    expect(sheet.inputs.mortgagePayoff).toBe(0)
    expect(sheet.assumptions.some((a) => /starts at zero/.test(a))).toBe(true)
  })
})

describe('seller proceeds HTML', () => {
  it('print is static and the web scene is adjustable', () => {
    const sheet = buildSellerProceeds({ pricing })
    const print = renderSellerProceedsPrintHtml(sheet)
    const web = renderSellerProceedsSceneHtml(sheet)
    expect(print).toContain('What you would net')
    expect(print).toContain('On the web version of this report you can change every line')
    expect(web).toContain('id="net"')
    expect(web).toContain('id="proceeds-seed"')
    expect(web).toContain('type="number"')
    expect(web).toContain('id="net-mtg"')
    expect(print).not.toMatch(/how we would market|Confidence:/)
    expect(web).not.toMatch(/how we would market|Confidence:/)
    for (const line of sheet.assumptions) {
      const voice = checkBrandVoice(line)
      expect(voice.ok, `${line} -> ${JSON.stringify(voice.violations)}`).toBe(true)
    }
  })
})

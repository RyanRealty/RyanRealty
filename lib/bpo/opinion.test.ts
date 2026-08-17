import { describe, expect, it } from 'vitest'
import { deriveOpinion } from '@/lib/bpo/opinion'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { BpoListingHistory } from '@/lib/bpo/types'

const subject = {
  streetAddress: '850 Quince',
  city: 'Redmond',
  sqft: 1602,
} as CmaSubject

const pricing = {
  conservative: 470000,
  recommended: 505000,
  highEnd: 515000,
  predictedClose: 495000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  convergenceSpreadPct: 2,
  method3: 477000,
} as CmaPricing

const history = {
  listingPressureAdjustmentPct: 0,
  failedAttemptsCount: 0,
  currentIsActive: false,
  currentListPrice: null,
  currentDaysOnMarket: null,
  signals: [],
} as unknown as BpoListingHistory

describe('deriveOpinion', () => {
  it('anchors on the engine expected sale, not the recommended list', () => {
    const op = deriveOpinion(subject, pricing, null, history)
    expect(op.compAnchor).toBe(495000)
    expect(op.opinionValue).toBe(495000)
    expect(op.reasoning[0]).toMatch(/expected sale of \$495,000/)
  })

  it('falls back to the recommended list when no close was stamped', () => {
    const op = deriveOpinion(subject, { ...pricing, predictedClose: null }, null, history)
    expect(op.compAnchor).toBe(505000)
    expect(op.opinionValue).toBe(505000)
  })
})

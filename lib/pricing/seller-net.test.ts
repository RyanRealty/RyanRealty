import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import {
  attachSellerNet,
  concessionNote,
  predictedSellerNet,
  resolveConcessions,
  sellerNetFromPrice,
  summarizeConcessions,
} from '@/lib/pricing/seller-net'

describe('resolveConcessions', () => {
  it('uses the typed dollar amount when present, including zero', () => {
    expect(resolveConcessions({ amount: 10_000, yn: 'Yes' })).toBe(10_000)
    expect(resolveConcessions({ amount: 0, yn: 'No' })).toBe(0)
  })

  it('treats Concessions YN No as zero when the amount is blank', () => {
    expect(resolveConcessions({ amount: null, yn: 'No' })).toBe(0)
  })

  it('does not invent dollars when YN is Yes and the amount is blank', () => {
    expect(resolveConcessions({ amount: null, yn: 'Yes' })).toBeNull()
  })

  it('infers zero on 2024+ closes with a blank amount (measured: those rows are YN No)', () => {
    expect(resolveConcessions({ amount: null, yn: null, closeDate: '2025-06-01' })).toBe(0)
    expect(resolveConcessions({ amount: null, yn: null, closeDate: '2023-06-01' })).toBeNull()
  })
})

describe('sellerNetFromPrice', () => {
  it('is close price minus seller concessions', () => {
    expect(sellerNetFromPrice(500_000, 15_000)).toBe(485_000)
    expect(sellerNetFromPrice(500_000, 0)).toBe(500_000)
  })

  it('is unknown when concessions were not resolved', () => {
    expect(sellerNetFromPrice(500_000, null)).toBeNull()
  })
})

describe('summarizeConcessions', () => {
  it('includes inferred zeros so a Yes-only median does not overstate the typical credit', () => {
    const summary = summarizeConcessions([
      { concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2025-05-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-04-01' },
      { concessionsAmount: null, concessionsYn: null, closeDate: '2025-03-01' },
      { concessionsAmount: 8_000, concessionsYn: 'Yes', closeDate: '2025-02-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-01-01' },
    ])
    expect(summary.knownCount).toBe(5)
    expect(summary.givenCount).toBe(2)
    expect(summary.medianWhenGiven).toBe(9_000)
    expect(summary.medianIncludingZero).toBe(0)
    expect(summary.rate).toBe(0.4)
  })
})

describe('predictedSellerNet', () => {
  it('subtracts the expected concession from the predicted close', () => {
    expect(predictedSellerNet(700_000, 10_000)).toBe(690_000)
    expect(predictedSellerNet(700_000, null)).toBeNull()
  })
})

describe('concessionNote', () => {
  it('names close price and seller net as different numbers', () => {
    const note = concessionNote(
      {
        knownCount: 5,
        givenCount: 2,
        medianWhenGiven: 10_000,
        medianIncludingZero: 0,
        rate: 0.4,
      },
      700_000,
    )
    expect(note).toMatch(/contract price/i)
    expect(note).toMatch(/2 of 5/)
    expect(note).toMatch(/\$10,000/)
    expect(note).toMatch(/\$700,000/)
    expect(note).not.toMatch(/[—;]/)
    expect(checkBrandVoice(note).ok).toBe(true)
  })
})

describe('attachSellerNet', () => {
  it('writes seller net onto the pricing object from the comparable set', () => {
    const pricing = { recommended: 700_000, notes: [] as string[] }
    attachSellerNet(
      pricing,
      [
        { concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2025-05-01' },
        { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-04-01' },
      ],
      700_000,
    )
    expect(pricing.sellerNet?.expectedConcessions).toBe(5_000)
    expect(pricing.sellerNet?.predictedSellerNet).toBe(695_000)
    expect(pricing.notes[0]).toMatch(/contract price/)
  })
})

import { describe, expect, it } from 'vitest'
import { likeHomeCredits, subdivisionFamily } from '@/lib/cma/like-home-credits'

const AS_OF = '2026-09-22'

function row(partial: {
  address: string
  subdivision: string
  yearBuilt: number
  sqft: number
  closeDate: string
  concessionsAmount: number | null
  concessionsYn?: string | null
}) {
  return {
    concessionsYn: partial.concessionsAmount != null && partial.concessionsAmount > 0 ? 'Yes' : 'No',
    ...partial,
  }
}

describe('likeHomeCredits', () => {
  it('reads the phase family off the subdivision name', () => {
    expect(subdivisionFamily('Countryside Phase 2')).toBe('Countryside')
    expect(subdivisionFamily('Northwest Crossing')).toBe('Northwest Crossing')
  })

  it('keeps lived-in Countryside houses this size and does not average them with the new ones', () => {
    const credit = likeHomeCredits({
      subdivision: 'Countryside Phase 2',
      yearBuilt: 2022,
      sqft: 2468,
      asOf: AS_OF,
      rows: [
        row({ address: '61166 Berkshire', subdivision: 'Countryside Phase 4', yearBuilt: 2026, sqft: 2607, closeDate: '2026-06-11', concessionsAmount: 14557 }),
        row({ address: '61178 Berkshire', subdivision: 'Countryside Phase 4', yearBuilt: 2025, sqft: 2492, closeDate: '2025-12-30', concessionsAmount: 18000 }),
        row({ address: '20619 Boer', subdivision: 'Countryside Phase 4', yearBuilt: 2025, sqft: 2431, closeDate: '2025-12-18', concessionsAmount: 15000 }),
        row({ address: '20524 Dorset', subdivision: 'Countryside Phase 3', yearBuilt: 2024, sqft: 2168, closeDate: '2025-02-11', concessionsAmount: 13000 }),
        row({ address: '20457 Aberdeen', subdivision: 'Countryside Phase 1', yearBuilt: 2022, sqft: 2269, closeDate: '2025-12-22', concessionsAmount: 7500 }),
        row({ address: '20542 Aberdeen', subdivision: 'Countryside Phase 2', yearBuilt: 2022, sqft: 2633, closeDate: '2025-07-24', concessionsAmount: null, concessionsYn: 'No' }),
        row({ address: '20485 Aberdeen', subdivision: 'Countryside Phase 1', yearBuilt: 2022, sqft: 2269, closeDate: '2025-04-11', concessionsAmount: null, concessionsYn: 'No' }),
        row({ address: '20446 Murphy', subdivision: 'Countryside Phase 1', yearBuilt: 2023, sqft: 2249, closeDate: '2025-04-04', concessionsAmount: null, concessionsYn: 'No' }),
        row({ address: 'Far Away', subdivision: 'Northwest Crossing', yearBuilt: 2022, sqft: 2400, closeDate: '2025-08-01', concessionsAmount: 20000 }),
      ],
    })
    expect(credit?.sales.map((s) => s.address)).toEqual([
      '20446 Murphy',
      '20485 Aberdeen',
      '20542 Aberdeen',
      '20457 Aberdeen',
    ])
    expect(credit?.sentence).toBe(
      'Four Countryside houses about this size, built in 2022 or 2023, have sold in the last 18 months. Three gave the buyer nothing. 20457 Aberdeen gave $7,500, so nothing is taken off here for a credit.',
    )
    expect(credit?.sentence).not.toContain('14,557')
    expect(credit?.source).toContain('2,098 to 2,838 sqft')
    expect(credit?.source).toContain('Oregon Data Share MLS')
  })

  it('says nothing when the subject has no year or size to match', () => {
    expect(
      likeHomeCredits({
        subdivision: 'Countryside Phase 2',
        yearBuilt: null,
        sqft: 2468,
        asOf: AS_OF,
        rows: [],
      }),
    ).toBeNull()
  })
})

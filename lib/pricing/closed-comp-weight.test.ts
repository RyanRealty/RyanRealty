import { describe, expect, it } from 'vitest'
import { resolveLocationMatch } from '@/lib/pricing/closed-comp-weight'

describe('resolveLocationMatch and the quarter-mile pocket', () => {
  it('weighs a pocket sale as the neighborhood step for a home in a recorded plat', () => {
    // A recorded plat walks its pocket after the touching rows (rule 15:
    // same subdivision 3, adjacent 2, neighborhood 1), so a pocket sale cannot
    // outweigh the next-row sale the ladder took before it.
    expect(
      resolveLocationMatch({ selectionTier: 'pocket-6mo', subjectRecordedPlat: true, subjectSubdivision: 'Kenwood', saleSubdivision: 'Juniper' }),
    ).toBe('neighborhood-or-community')
  })
  it('keeps a pocket sale as the touching step for a home with no recorded plat', () => {
    expect(resolveLocationMatch({ selectionTier: 'pocket-6mo', subjectRecordedPlat: false })).toBe('adjacent-subdivision')
    expect(resolveLocationMatch({ selectionTier: 'pocket-6mo' })).toBe('adjacent-subdivision')
  })
})

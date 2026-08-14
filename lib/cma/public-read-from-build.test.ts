import { describe, expect, it } from 'vitest'
import { publicReadFromBuild, sameSubdivisionTight } from '@/lib/cma/public-read-from-build'

const subject = {
  sqft: 2000,
  lastListPrice: 725_000,
  yearBuilt: 1998,
  newConstructionYn: false as boolean | null,
  subdivision: 'Kenwood',
}

describe('sameSubdivisionTight', () => {
  it('accepts tight same-subdivision rungs and rejects a wide GLA rung', () => {
    expect(sameSubdivisionTight(['subdivision-3mo', 'subdivision-6mo'])).toBe(true)
    expect(sameSubdivisionTight(['subdivision-3mo-wide'])).toBe(false)
    expect(sameSubdivisionTight(['subdivision-3mo', 'nearby-1mi-3mo'])).toBe(false)
    expect(sameSubdivisionTight([])).toBe(false)
  })
})

describe('publicReadFromBuild', () => {
  it('prints listed over/under from comps-implied close, not the ask haircut', () => {
    const out = publicReadFromBuild({
      factsReady: true,
      comps: [{ ppsfTimeAdjusted: 350 }, { ppsfTimeAdjusted: 350 }, { ppsfTimeAdjusted: 350 }],
      subject,
      tiersUsed: ['subdivision-3mo'],
      asOfYear: 2026,
    })
    expect(out.kind).toBe('listed-over-under')
    if (out.kind !== 'listed-over-under') return
    expect(out.listPrice).toBe(725_000)
    expect(out.compsClose).toBe(700_000)
    expect(out.n).toBe(3)
  })

  it('refuses new construction on the public read even when the CMA set is tight', () => {
    const out = publicReadFromBuild({
      factsReady: true,
      comps: [{ ppsfTimeAdjusted: 400 }, { ppsfTimeAdjusted: 410 }, { ppsfTimeAdjusted: 420 }],
      subject: { ...subject, yearBuilt: 2025, newConstructionYn: true, lastListPrice: 999_900, subdivision: 'Grand Meadow' },
      tiersUsed: ['subdivision-3mo'],
      asOfYear: 2026,
    })
    expect(out).toEqual({ kind: 'refuse', reason: 'new-construction' })
  })
})

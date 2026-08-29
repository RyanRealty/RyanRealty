import { describe, expect, it } from 'vitest'
import { publishPlaceFace } from './publish-place-face'
import type { LeftoverHudKpis } from './publish-leftover-hud'

const cityHud: LeftoverHudKpis = {
  active: 728,
  pending: 303,
  closed30: 198,
  new30: null,
  medianList: 760000,
  saleToList: 97.2,
  daysToPending: 20,
  monthsSupply: 4.2,
  sold12mo: 2076,
}

const communityHud: LeftoverHudKpis = {
  active: 16,
  pending: 4,
  closed30: 2,
  new30: null,
  medianList: 2372500,
  saleToList: 95,
  daysToPending: 51,
  monthsSupply: 4.6,
  sold12mo: 22,
}

describe('publishPlaceFace', () => {
  it('city face can include MOS, verdict, and DTP', () => {
    const face = publishPlaceFace({ grain: 'city', hud: cityHud })
    expect(face.stats.map((s) => s.id)).toEqual([
      'active',
      'medianList',
      'verdict',
      'monthsOfSupply',
      'daysToPending',
    ])
    expect(face.monthsOfSupply).toBe(4.2)
    expect(face.verdict?.kind).toBe('balanced')
    expect(face.stats.find((s) => s.id === 'active')?.value).toBe('728')
  })

  it('neighborhood face is count + median list only, even if leftover has MOS', () => {
    const face = publishPlaceFace({ grain: 'neighborhood', hud: communityHud })
    expect(face.stats.map((s) => s.id)).toEqual(['active', 'medianList'])
    expect(face.monthsOfSupply).toBeNull()
    expect(face.verdict).toBeNull()
  })

  it('community face uses leftover count, not an alias override unless passed', () => {
    const leftover = publishPlaceFace({ grain: 'community', hud: communityHud })
    expect(leftover.stats.find((s) => s.id === 'active')?.value).toBe('16')
    const alias = publishPlaceFace({ grain: 'community', hud: communityHud, active: 25 })
    expect(alias.stats.find((s) => s.id === 'active')?.value).toBe('25')
  })

  it('subdivision face withholds MOS even when leftover publishes it', () => {
    const face = publishPlaceFace({
      grain: 'subdivision',
      hud: cityHud,
      active: 15,
      medianList: null,
    })
    expect(face.stats.map((s) => s.id)).toEqual(['active'])
    expect(face.stats[0]?.value).toBe('15')
    expect(face.monthsOfSupply).toBeNull()
  })

  it('subdivision face with hud null is inventory count + median only', () => {
    const face = publishPlaceFace({
      grain: 'subdivision',
      hud: null,
      active: 12,
      medianList: 909_950,
    })
    expect(face.stats.map((s) => s.id)).toEqual(['active', 'medianList'])
    expect(face.stats.find((s) => s.id === 'active')?.value).toBe('12')
    expect(face.monthsOfSupply).toBeNull()
    expect(face.verdict).toBeNull()
    expect(face.stats.some((s) => s.id === 'daysToPending')).toBe(false)
  })

  it('omits a missing cell rather than printing zero', () => {
    const face = publishPlaceFace({
      grain: 'city',
      hud: { ...cityHud, active: null, monthsSupply: null, daysToPending: null },
    })
    expect(face.stats.some((s) => s.id === 'active')).toBe(false)
    expect(face.stats.some((s) => s.id === 'monthsOfSupply')).toBe(false)
    expect(face.verdict).toBeNull()
  })
})

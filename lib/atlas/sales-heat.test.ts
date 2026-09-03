import { describe, expect, it } from 'vitest'
import {
  ATLAS_HEAT_WINDOW_DAYS,
  ATLAS_PULSE_WINDOW_DAYS,
  atlasHeatWindowLabel,
  isAtlasHeatClosing,
  isAtlasPulseSold,
  salesHeatField,
} from './sales-heat'

const FRAME = { width: 1000, height: 600 }

function peakStep(points: { x: number; y: number }[]): number {
  const field = salesHeatField(points, FRAME)
  return field.cells.reduce((m, c) => Math.max(m, c.step), 0)
}

describe('salesHeatField', () => {
  it('empty closes paint nothing', () => {
    expect(salesHeatField([], FRAME)).toEqual({ cells: [], n: 0, max: 0 })
  })

  it('a cluster of closes is hotter than a lone close', () => {
    const lone = [
      { x: 120, y: 140 },
    ]
    const cluster = [
      { x: 700, y: 300 },
      { x: 702, y: 300 },
      { x: 700, y: 303 },
      { x: 698, y: 298 },
    ]
    const field = salesHeatField([...lone, ...cluster], FRAME)
    expect(field.n).toBe(5)
    expect(field.cells.length).toBeGreaterThan(0)

    const stepAt = (x: number, y: number) => {
      const hit = field.cells.find((c) => x >= c.x && x < c.x + c.size && y >= c.y && y < c.y + c.size)
      return hit?.step ?? 0
    }
    expect(stepAt(700, 300)).toBeGreaterThan(stepAt(120, 140))
    expect(peakStep(cluster)).toBeGreaterThan(peakStep(lone))
  })

  it('a lone close still paints, and a void stays empty', () => {
    const field = salesHeatField([{ x: 200, y: 200 }], FRAME)
    expect(field.n).toBe(1)
    expect(field.cells.length).toBeGreaterThan(0)
    const far = field.cells.find((c) => c.x > 800 && c.y > 450)
    expect(far).toBeUndefined()
  })
})

describe('heat is closings, not inventory', () => {
  it('pending and active never count as heat', () => {
    expect(isAtlasHeatClosing('sold')).toBe(true)
    expect(isAtlasHeatClosing('closed')).toBe(true)
    expect(isAtlasHeatClosing('active')).toBe(false)
    expect(isAtlasHeatClosing('pending')).toBe(false)
  })

  it('pulses stay on the 30-day window, not the heat window', () => {
    expect(ATLAS_HEAT_WINDOW_DAYS).toBe(90)
    expect(ATLAS_PULSE_WINDOW_DAYS).toBe(30)
    expect(isAtlasPulseSold({ s: 'sold', soldAgo: 0 })).toBe(true)
    expect(isAtlasPulseSold({ s: 'sold', soldAgo: 30 })).toBe(true)
    expect(isAtlasPulseSold({ s: 'sold', soldAgo: 31 })).toBe(false)
    expect(isAtlasPulseSold({ s: 'sold', soldAgo: 90 })).toBe(false)
    expect(isAtlasPulseSold({ s: 'pending', soldAgo: 1 })).toBe(false)
    expect(isAtlasPulseSold({ s: 'active' })).toBe(false)
  })

  it('the legend names the heat window, never a 30-day label for 90 days', () => {
    expect(atlasHeatWindowLabel(90)).toBe('sold in the last 90 days')
    expect(atlasHeatWindowLabel(30)).toBe('sold in the last 30 days')
    expect(atlasHeatWindowLabel(365)).toBe('sold in the last 12 months')
    expect(atlasHeatWindowLabel()).toBe('sold in the last 90 days')
  })
})

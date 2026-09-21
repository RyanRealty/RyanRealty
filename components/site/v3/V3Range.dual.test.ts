import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clampDualValue, pickDualThumb } from '@/components/motion/range-slider'

const RANGE = readFileSync(resolve('components/motion/range-slider.tsx'), 'utf8')
const HOUSE = readFileSync(resolve('components/site/v3/V3Range.tsx'), 'utf8')

describe('SITE-164 dual catalog range', () => {
  it('keeps the catalog single-thumb object and adds one dual track', () => {
    expect(RANGE).toContain('beui.dev/components/motion/range-slider')
    expect(RANGE).toContain('SPRING_BOUNCY')
    expect(RANGE).toContain('scaleY: dragging ? 1.35 : 1')
    expect(RANGE).toContain('h-6 w-1 rounded-full')
    expect(RANGE).toContain('export function DualRangeSlider')
    expect(HOUSE).toMatch(/from '@\/components\/motion\/range-slider'/)
    expect(HOUSE.match(/<DualRangeSlider/g)?.length).toBe(1)
    expect(HOUSE).not.toMatch(/<RangeSlider\b/)
  })

  it('picks the nearer thumb, and the left thumb on a stacked pair', () => {
    expect(pickDualThumb(10, 40, 80)).toBe('lo')
    expect(pickDualThumb(90, 40, 80)).toBe('hi')
    expect(pickDualThumb(55, 40, 80)).toBe('lo')
    expect(pickDualThumb(65, 40, 80)).toBe('hi')
    expect(pickDualThumb(39, 40, 40)).toBe('lo')
    expect(pickDualThumb(41, 40, 40)).toBe('hi')
  })

  it('does not let thumbs pass each other', () => {
    expect(clampDualValue('lo', 70, 20, 60)).toEqual([60, 60])
    expect(clampDualValue('hi', 10, 20, 60)).toEqual([20, 20])
    expect(clampDualValue('lo', 30, 20, 60)).toEqual([30, 60])
    expect(clampDualValue('hi', 50, 20, 60)).toEqual([20, 50])
  })
})

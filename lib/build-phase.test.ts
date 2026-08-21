import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTimeRails,
  hotRailTimeoutMs,
  isProductionBuildPhase,
  skippableRail,
  skippableRailResult,
} from './build-phase'

const savedPhase = process.env.NEXT_PHASE

afterEach(() => {
  if (savedPhase === undefined) delete process.env.NEXT_PHASE
  else process.env.NEXT_PHASE = savedPhase
})

describe('isProductionBuildPhase', () => {
  it('is true only during next build static generation', () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(isProductionBuildPhase()).toBe(true)
  })

  it('is false at runtime when NEXT_PHASE is unset', () => {
    delete process.env.NEXT_PHASE
    expect(isProductionBuildPhase()).toBe(false)
  })

  it('is false for any other NEXT_PHASE value', () => {
    process.env.NEXT_PHASE = 'phase-production-server'
    expect(isProductionBuildPhase()).toBe(false)
  })
})

describe('buildTimeRails', () => {
  it('skips below-the-fold rails during production build even when enabled', () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(buildTimeRails(true)).toBe(false)
  })

  it('fetches rails at runtime when enabled', () => {
    delete process.env.NEXT_PHASE
    expect(buildTimeRails(true)).toBe(true)
  })

  it('stays off when the caller disabled the rail', () => {
    delete process.env.NEXT_PHASE
    expect(buildTimeRails(false)).toBe(false)
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(buildTimeRails(false)).toBe(false)
  })
})

describe('skippableRail', () => {
  it('does not start the fetch during production build and returns the fallback', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const start = vi.fn(async () => ['real'])
    await expect(skippableRail(start, [] as string[], 50, 'test:rail')).resolves.toEqual([])
    expect(start).not.toHaveBeenCalled()
  })

  it('starts the fetch at runtime and returns the real value', async () => {
    delete process.env.NEXT_PHASE
    const start = vi.fn(async () => ['real'])
    await expect(skippableRail(start, [] as string[], 50, 'test:rail')).resolves.toEqual(['real'])
    expect(start).toHaveBeenCalledOnce()
  })

  it('still times out to fallback at runtime so a hung rail cannot block ISR', async () => {
    delete process.env.NEXT_PHASE
    const start = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          setTimeout(() => resolve(['late']), 80)
        }),
    )
    await expect(skippableRail(start, [] as string[], 20, 'test:rail-timeout')).resolves.toEqual([])
    expect(start).toHaveBeenCalledOnce()
  })
})

describe('skippableRailResult', () => {
  it('skips during production build with ok: false so the fallback reads as degraded, not empty', async () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    const start = vi.fn(async () => ({ pins: ['real'] }))
    await expect(
      skippableRailResult(start, { pins: [] as string[] }, 50, 'test:railResult'),
    ).resolves.toEqual({ value: { pins: [] }, ok: false })
    expect(start).not.toHaveBeenCalled()
  })

  it('fetches at runtime and reports ok: true for a real value', async () => {
    delete process.env.NEXT_PHASE
    const start = vi.fn(async () => ({ pins: ['real'] }))
    await expect(
      skippableRailResult(start, { pins: [] as string[] }, 50, 'test:railResult'),
    ).resolves.toEqual({ value: { pins: ['real'] }, ok: true })
  })

  it('reports ok: false on a runtime timeout', async () => {
    delete process.env.NEXT_PHASE
    const start = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          setTimeout(() => resolve(['late']), 80)
        }),
    )
    await expect(
      skippableRailResult(start, [] as string[], 20, 'test:railResult-timeout'),
    ).resolves.toEqual({ value: [], ok: false })
  })
})

describe('hotRailTimeoutMs', () => {
  it('triples the leash during production build', () => {
    process.env.NEXT_PHASE = 'phase-production-build'
    expect(hotRailTimeoutMs(3500)).toBe(10500)
  })

  it('passes the runtime value through outside the build', () => {
    delete process.env.NEXT_PHASE
    expect(hotRailTimeoutMs(3500)).toBe(3500)
  })
})

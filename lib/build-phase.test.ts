import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTimeRails, isProductionBuildPhase, skippableRail } from './build-phase'

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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const refuse = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/site/degraded-isr', () => ({ refuseDegradedIsr: refuse }))

import { noteDegradedHead, placeNameFromSlug, PLACE_HEAD_READ_MS } from '@/lib/site/place-head-fallback'

beforeEach(() => refuse.mockClear())

describe('placeNameFromSlug', () => {
  it('title-cases a place slug with the plat connector rules', () => {
    expect(placeNameFromSlug('la-pine')).toBe('La Pine')
    expect(placeNameFromSlug('bend')).toBe('Bend')
    expect(placeNameFromSlug('ridge-at-eagle-crest')).toBe('Ridge at Eagle Crest')
    expect(placeNameFromSlug('')).toBe('')
  })
})

describe('noteDegradedHead', () => {
  it('shortens the ISR copy through the shared mechanism, labelled by page and read', async () => {
    await noteDegradedHead('city', 'city:meta-snapshot')
    expect(refuse).toHaveBeenCalledWith('city:head', ['city:meta-snapshot'])
  })
})

describe('budget', () => {
  it('bounds a head read well inside a 60 s function', () => {
    expect(PLACE_HEAD_READ_MS).toBeLessThanOrEqual(15_000)
  })
})

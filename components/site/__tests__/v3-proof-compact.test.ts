import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('components/site/v3/V3Proof.client.tsx', 'utf8')
const CSS = readFileSync('components/site/v3/V3Proof.css', 'utf8')

describe('V3Proof compact band', () => {
  it('always prints live rating stars, not only when a review is under 5', () => {
    expect(SRC).not.toMatch(/quotes\.some\(\(q\) => q\.rating < 5\)/)
    expect(SRC).toMatch(/className=\{cn\('v3-proof__star'/)
    expect(CSS).toMatch(/\.v3-proof__star\.is-on/)
  })

  it('lets a compact band pick one review to read', () => {
    expect(SRC).toMatch(/v3-proof__reader/)
    expect(SRC).toMatch(/v3-proof__pick/)
  })

  it('keeps the featured pull quote out of the picks list (H11)', () => {
    expect(SRC).toContain('.filter((q) => q.id !== compactReading?.id)')
  })

  it('compact band can mount a score face from figures', () => {
    expect(SRC).toContain('v3-proof__face')
    expect(SRC).toContain('function ScoreFace')
    expect(SRC).not.toContain('function GoogleMark')
    expect(SRC).toContain("from '@/components/ui/avatar'")
    expect(CSS).toContain('.v3-proof__face')
    expect(CSS).toContain('.v3-proof__card')
  })

  it('compact picks and reading sit in card chrome', () => {
    expect(SRC).toContain('v3-proof__reading v3-proof__card')
    expect(SRC).toMatch(/v3-proof__pick.*v3-proof__card/)
  })
})

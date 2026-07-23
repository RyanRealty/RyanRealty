import { describe, it, expect } from 'vitest'
import { factsPreserved, reviewProse } from './reviewer'

describe('factsPreserved (pure §0 guard)', () => {
  it('returns true when every fact survives the rewrite', () => {
    const original = 'The median home closed at $725,000 after 38 days on market, up 2.1% from 2022.'
    const rewrite = 'The median home sold for $725,000 in 38 days, up 2.1% since 2022.'
    expect(factsPreserved(original, rewrite)).toBe(true)
  })

  it('returns false when a currency figure was changed', () => {
    const original = 'The median home closed at $725,000 after 38 days on market, up 2.1% from 2022.'
    const rewrite = 'The median home sold for $730,000 in 38 days, up 2.1% since 2022.'
    expect(factsPreserved(original, rewrite)).toBe(false)
  })

  it('returns false when a bare number was dropped', () => {
    const original = 'The median home closed at $725,000 after 38 days on market, up 2.1% from 2022.'
    const rewrite = 'The median home sold for $725,000 in a few weeks, up 2.1% since 2022.'
    expect(factsPreserved(original, rewrite)).toBe(false)
  })

  it('returns false when a percent was dropped', () => {
    const original = 'The median home closed at $725,000 after 38 days on market, up 2.1% from 2022.'
    const rewrite = 'The median home sold for $725,000 in 38 days, a solid gain since 2022.'
    expect(factsPreserved(original, rewrite)).toBe(false)
  })

  it('returns false when a year was dropped', () => {
    const original = 'The median home closed at $725,000 after 38 days on market, up 2.1% from 2022.'
    const rewrite = 'The median home sold for $725,000 in 38 days, up 2.1% from last year.'
    expect(factsPreserved(original, rewrite)).toBe(false)
  })

  it('catches magnitude inflation (a number is not just a substring of a bigger one)', () => {
    // $1,200 must NOT "survive" inside $1,200,000; 38 must NOT survive inside 380.
    expect(factsPreserved('Priced at $1,200.', 'Priced at $1,200,000.')).toBe(false)
    expect(factsPreserved('Sold in 38 days.', 'Sold in 380 days.')).toBe(false)
  })

  it('catches a dropped percent UNIT (2.1% is not preserved by 2.1)', () => {
    expect(factsPreserved('Up 2.1% YoY.', 'Up 2.1 points YoY.')).toBe(false)
  })

  it('treats an empty original as trivially preserved', () => {
    expect(factsPreserved('', 'Any rewrite at all.')).toBe(true)
  })
})

describe('reviewProse (advisory, never throws)', () => {
  it('returns the degraded no-op shape when ANTHROPIC_API_KEY is unset', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const result = await reviewProse('The home closed at $725,000 after 38 days on market.')
      expect(result).toEqual({ ran: false, violations: [], rewrite: null, factsPreserved: true })
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
    }
  })

  it('returns the degraded shape for empty/whitespace text even with a key set', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-key'
    try {
      expect(await reviewProse('')).toEqual({ ran: false, violations: [], rewrite: null, factsPreserved: true })
      expect(await reviewProse('   ')).toEqual({ ran: false, violations: [], rewrite: null, factsPreserved: true })
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
      else delete process.env.ANTHROPIC_API_KEY
    }
  })

  it('never throws when the key is absent, regardless of input', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      // If reviewProse threw, this await would reject and fail the test.
      const result = await reviewProse('Some long-form prose about the market.')
      expect(result.ran).toBe(false)
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
    }
  })
})

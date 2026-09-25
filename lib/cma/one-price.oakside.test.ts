import { describe, expect, it } from 'vitest'
import { letterRecommendDollarsCheck } from '@/lib/cma/letter-consistency'
import { failedAskBelowRangeNote } from '@/lib/cma/expired-audit'

describe('one price per letter — Oakside', () => {
  it('refuses a second list recommendation that is not the rec', () => {
    const rec = 448_000
    const band = { recommended: rec, valueLow: 448_000, valueHigh: 505_000 }
    const bad = `
      <p>We recommend listing at $448,000.</p>
      <p>The sales alone would support listing at $522,000. Because $501,000 already failed to sell, we do not recommend going above $520,000.</p>
      <p>Net at list $501,000.</p>
    `
    expect(letterRecommendDollarsCheck(bad, band).pass).toBe(false)
    const good = `
      <p>We recommend listing at $448,000.</p>
      <p>The sales support a value of $505,000. Because $501,000 already failed to sell, we recommend listing at $448,000.</p>
    `
    expect(letterRecommendDollarsCheck(good, band).pass).toBe(true)
  })

  it('net-sheet cites must come from the letter comps, not an unmatched Petrosa sale', () => {
    const letterComps = ['3808 Oakside', '3812 Oakside']
    const netCite = 'A 2022 Petrosa sale credited the buyer $8,000.'
    const allowed = letterComps.some((addr) => netCite.toLowerCase().includes(addr.toLowerCase()))
    expect(allowed).toBe(false)
    expect(failedAskBelowRangeNote(501_000)).not.toMatch(/[—–]/)
  })
})

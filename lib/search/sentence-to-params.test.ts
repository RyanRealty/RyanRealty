import { describe, expect, it } from 'vitest'
import { sentenceToParams } from './sentence-to-params'

function asRecord(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries())
}

describe('sentenceToParams', () => {
  it('empty string writes no params', () => {
    expect(asRecord(sentenceToParams(''))).toEqual({})
    expect(asRecord(sentenceToParams('   '))).toEqual({})
  })

  it('maps 3 bed under 800 in Tetherow to beds, maxPrice, and Tetherow place', () => {
    const r = asRecord(sentenceToParams('3 bed under 800 in Tetherow'))
    expect(r.beds).toBe('3')
    expect(r.maxPrice).toBe('800000')
    expect(r.subdivision ?? r.keywords ?? '').toMatch(/tetherow/i)
  })

  it('maps 2 bath Bend to baths and city', () => {
    const r = asRecord(sentenceToParams('2 bath Bend'))
    expect(r.baths).toBe('2')
    expect(r.city).toBe('Bend')
  })

  it('maps new this week to the registry days-on-market ceiling', () => {
    const r = asRecord(sentenceToParams('new this week'))
    expect(r.daysOnMarket).toBe('7')
  })

  it('keeps unknown leftover words as keywords and never drops the sentence', () => {
    const leftover = asRecord(sentenceToParams('walkable downtown'))
    expect(leftover.keywords).toMatch(/walkable/i)
    expect(leftover.keywords).toMatch(/downtown/i)

    const mixed = asRecord(sentenceToParams('3 bed under 800 in Tetherow remodeled'))
    expect(mixed.beds).toBe('3')
    expect(mixed.maxPrice).toBe('800000')
    expect(mixed.keywords).toMatch(/remodeled/i)
  })
})

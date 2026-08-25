import { describe, expect, it } from 'vitest'
import {
  extractRecords,
  mapScrubRecord,
  normalizeLast10,
  tagsForResult,
} from './dnc-scrub'

// The exact envelope the live API returned when probed 2026-08-25. Pinned here
// so a vendor shape change fails a test instead of silently yielding zero
// results — which a caller would be tempted to read as "nobody is on the list".
const LIVE_ENVELOPE = {
  status: { code: 200, text: 'OK' },
  results: {
    phoneNumbers: [
      { number: '5412136706', dnc: false, meta: { error: false, matched: true, dateRetrieved: '2026-08-25T23:27:24.414Z' } },
    ],
    meta: { results: { requestCount: 1, matchCount: 1, noMatchCount: 0, errorCount: 0 } },
  },
}

describe('normalizeLast10', () => {
  it('takes the last ten digits of a formatted number', () => {
    expect(normalizeLast10('(541) 213-6706')).toBe('5412136706')
    expect(normalizeLast10('+1 541 213 6706')).toBe('5412136706')
  })
  it('refuses anything that is not a usable US number', () => {
    expect(normalizeLast10('12345')).toBeNull()
    expect(normalizeLast10('')).toBeNull()
    expect(normalizeLast10(null)).toBeNull()
    // A US area code never starts with 0 or 1.
    expect(normalizeLast10('1112223333')).toBeNull()
  })
})

describe('extractRecords', () => {
  it('reads results.phoneNumbers off the live envelope', () => {
    expect(extractRecords(LIVE_ENVELOPE)).toHaveLength(1)
  })
  it('returns nothing rather than guessing when the shape changes', () => {
    expect(extractRecords({ results: {} })).toEqual([])
    expect(extractRecords({})).toEqual([])
  })
})

describe('mapScrubRecord — an answer, or nothing', () => {
  it('maps a clean answer', () => {
    const r = mapScrubRecord(extractRecords(LIVE_ENVELOPE)[0]!)
    expect(r).toMatchObject({ phoneLast10: '5412136706', onDnc: false, isLitigator: false })
  })

  it('maps a number on the registry', () => {
    const r = mapScrubRecord({ number: '5415550100', dnc: true, meta: { error: false, matched: true } })
    expect(r?.onDnc).toBe(true)
    expect(tagsForResult(r!)).toEqual(['compliance:dnc-registry', 'contact:do-not-call'])
  })

  it('DROPS an unmatched number instead of recording it clean', () => {
    // The load-bearing case. No answer is not the same as "not on the list";
    // recording it as clean would manufacture permission to text.
    expect(mapScrubRecord({ number: '5415550100', dnc: false, meta: { error: false, matched: false } })).toBeNull()
  })

  it('DROPS an errored number instead of recording it clean', () => {
    expect(mapScrubRecord({ number: '5415550100', dnc: false, meta: { error: true, matched: true } })).toBeNull()
  })

  it('earns no tags when the number is clean', () => {
    const r = mapScrubRecord(extractRecords(LIVE_ENVELOPE)[0]!)
    expect(tagsForResult(r!)).toEqual([])
  })
})

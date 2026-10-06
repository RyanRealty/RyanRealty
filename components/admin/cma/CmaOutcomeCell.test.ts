import { describe, it, expect } from 'vitest'
import { clickedLine, cmaOutcomeLeftAt, cmaOutcomeProgress, deliveredKind, pageLabel } from './CmaOutcomeCell'
import type { CmaOutcome } from '@/lib/data/cma/outcomes'

/**
 * The broker reads addresses, not URLs. `pageLabel` is the whole difference
 * between "they opened 1299 Ogden" and a path they have to decode.
 */
describe('pageLabel', () => {
  it('reads a canonical listing path back as its address, MLS tail dropped', () => {
    expect(pageLabel('/homes-for-sale/bend/newport-gardens/1299-ogden-220225388')).toBe('1299 ogden')
  })

  it('names a place page by its place', () => {
    expect(pageLabel('/subdivisions/newport-gardens')).toBe('newport gardens')
    expect(pageLabel('/housing-market/bend')).toBe('bend')
  })

  it('calls the root Home rather than an empty string', () => {
    expect(pageLabel('/')).toBe('Home')
    expect(pageLabel('')).toBe('Home')
  })

  it('keeps a by-key listing segment intact when it is only an id', () => {
    expect(pageLabel('/homes-for-sale/listing/20260714190234066850000000')).toBe(
      '20260714190234066850000000',
    )
  })
})

describe('deliveredKind', () => {
  it('marks a Gmail inferred delivery separately from a Resend receipt', () => {
    expect(deliveredKind(true)).toBe('inferred')
    expect(deliveredKind(false)).toBe('receipt')
  })
})

describe('cmaOutcomeLeftAt', () => {
  const blank = { sentAt: null, emailEventSentAt: null } as CmaOutcome

  it('uses the letter stamp, then the email log, and stays empty when neither exists', () => {
    expect(cmaOutcomeLeftAt(null)).toBeNull()
    expect(cmaOutcomeLeftAt(blank)).toBeNull()
    expect(cmaOutcomeLeftAt({ ...blank, emailEventSentAt: '2026-09-01T10:00:00Z' })).toBe('2026-09-01T10:00:00Z')
    expect(
      cmaOutcomeLeftAt({ ...blank, sentAt: '2026-09-02T10:00:00Z', emailEventSentAt: '2026-09-01T10:00:00Z' }),
    ).toBe('2026-09-02T10:00:00Z')
  })
})

describe('cmaOutcomeProgress', () => {
  it('stops the row at the first stage that has not happened', () => {
    const base = { sentAt: null, emailEventSentAt: null } as CmaOutcome
    const row = cmaOutcomeProgress({
      ...base,
      sentAt: '2026-09-01T10:00:00Z',
      deliveredAt: '2026-09-01T10:00:05Z',
      deliveredInferred: true,
      opens: 0,
      clicks: 0,
      visits: 0,
      firstOpenAt: null,
      firstClickAt: null,
      firstVisitAt: null,
      repliedAt: null,
      visitedPages: { count: 0, recent: [] },
      clickedLinks: [],
    })
    expect(row.done).toEqual(['sent', 'delivered (inferred)'])
    expect(row.next).toBe('not opened')
  })
})

describe('clickedLine', () => {
  it('joins classified labels the way a broker reads the row', () => {
    expect(
      clickedLine([
        { kind: 'letter', label: 'report', url: 'https://ryan-realty.com/cma/cma-x' },
        { kind: 'area', label: 'Diamond Bar Ranch', url: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch' },
        { kind: 'area', label: 'Redmond', url: 'https://ryan-realty.com/cities/redmond' },
        { kind: 'reviews', label: 'reviews', url: 'https://ryan-realty.com/reviews' },
      ]),
    ).toBe('clicked: report, Diamond Bar Ranch, Redmond, reviews')
  })

  it('returns null when nothing was clicked', () => {
    expect(clickedLine([])).toBeNull()
    expect(clickedLine(undefined)).toBeNull()
  })
})

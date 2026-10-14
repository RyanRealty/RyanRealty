import { describe, expect, it } from 'vitest'
import {
  ga4ErrorMessage,
  isKnownBucket,
  knownShare,
  sectionFromSettled,
  sectionRows,
  sortAgeBuckets,
  sortAgeSection,
  toSection,
  type Ga4ReportLike,
} from './ga4-demographic-sections'

type Age = { ageBracket: string; users: number }
const known = (r: Age) => isKnownBucket(r.ageBracket)

describe('toSection', () => {
  it('no rows with thresholding is withheld, never an empty or zero report', () => {
    // The live answer for the age report on 2026-10-14: rows 0, subjectToThresholding true.
    expect(toSection<Age>([], true, known)).toEqual({ state: 'withheld' })
  })

  it('only the unknown bucket with thresholding is withheld too', () => {
    expect(toSection<Age>([{ ageBracket: 'unknown', users: 412 }], true, known)).toEqual({ state: 'withheld' })
  })

  it('no rows without thresholding is empty', () => {
    expect(toSection<Age>([], false, known)).toEqual({ state: 'empty' })
    expect(toSection<Age>([], undefined, known)).toEqual({ state: 'empty' })
    expect(toSection<Age>([], null, known)).toEqual({ state: 'empty' })
  })

  it('rows with thresholding are ok but partial', () => {
    const rows = [{ ageBracket: '55-64', users: 40 }]
    expect(toSection(rows, true, known)).toEqual({ state: 'ok', rows, partial: true })
  })

  it('rows without thresholding are ok and complete', () => {
    const rows = [{ ageBracket: '25-34', users: 12 }]
    expect(toSection(rows, false, known)).toEqual({ state: 'ok', rows, partial: false })
  })
})

describe('sectionFromSettled', () => {
  const mapAge = ([ageBracket = 'unknown']: string[], [users = 0]: number[]): Age => ({ ageBracket, users })

  it('a rejected report is that report\'s error, with Google\'s readable text', () => {
    const err = Object.assign(new Error('3 INVALID_ARGUMENT: Please remove userAgeBracket'), {
      details: 'Please remove userAgeBracket to make the request compatible.',
    })
    expect(sectionFromSettled({ status: 'rejected', reason: err }, mapAge, known)).toEqual({
      state: 'error',
      error: 'Please remove userAgeBracket to make the request compatible.',
    })
  })

  it('maps dimension strings and metric numbers, and reads the thresholding flag', () => {
    const res: Ga4ReportLike = {
      rows: [
        { dimensionValues: [{ value: '65+' }], metricValues: [{ value: '31' }] },
        { dimensionValues: [{ value: 'unknown' }], metricValues: [{ value: '900' }] },
      ],
      metadata: { subjectToThresholding: true },
    }
    expect(sectionFromSettled({ status: 'fulfilled', value: [res] }, mapAge, known)).toEqual({
      state: 'ok',
      rows: [
        { ageBracket: '65+', users: 31 },
        { ageBracket: 'unknown', users: 900 },
      ],
      partial: true,
    })
  })

  it('a thresholded response with no rows is withheld', () => {
    const res: Ga4ReportLike = { rows: [], metadata: { subjectToThresholding: true } }
    expect(sectionFromSettled({ status: 'fulfilled', value: [res] }, mapAge, known)).toEqual({ state: 'withheld' })
  })

  it('a response with no rows field and no metadata is empty', () => {
    expect(sectionFromSettled({ status: 'fulfilled', value: [{}] }, mapAge, known)).toEqual({ state: 'empty' })
  })

  it('a non-numeric metric reads as 0, not NaN', () => {
    const res: Ga4ReportLike = { rows: [{ dimensionValues: [{ value: '18-24' }], metricValues: [{ value: 'n/a' }] }] }
    expect(sectionRows(sectionFromSettled({ status: 'fulfilled', value: [res] }, mapAge, known))).toEqual([
      { ageBracket: '18-24', users: 0 },
    ])
  })
})

describe('sectionRows', () => {
  it('renders rows only for an ok section', () => {
    expect(sectionRows({ state: 'ok', rows: [1, 2], partial: false })).toEqual([1, 2])
    expect(sectionRows({ state: 'withheld' })).toEqual([])
    expect(sectionRows({ state: 'empty' })).toEqual([])
    expect(sectionRows({ state: 'error', error: 'x' })).toEqual([])
  })
})

describe('knownShare', () => {
  const rows: Age[] = [
    { ageBracket: '25-34', users: 30 },
    { ageBracket: '55-64', users: 20 },
    { ageBracket: '65+', users: 10 },
    { ageBracket: 'unknown', users: 940 },
  ]
  const senior = (b: string) => b === '55-64' || b === '65+'

  it('is a share of known brackets; unknown is left out of the base', () => {
    expect(knownShare(rows, (r) => r.ageBracket, senior)).toEqual({ share: 0.5, matched: 30, base: 60 })
  })

  it('is null, not 0, when no known bracket came back', () => {
    expect(knownShare([{ ageBracket: 'unknown', users: 940 }], (r) => r.ageBracket, senior).share).toBeNull()
    expect(knownShare([] as Age[], (r) => r.ageBracket, senior).share).toBeNull()
  })
})

describe('isKnownBucket', () => {
  it('treats GA4 placeholders as unknown', () => {
    for (const v of ['unknown', 'Unknown', '(not set)', '(other)', '', '  ']) expect(isKnownBucket(v)).toBe(false)
    for (const v of ['18-24', '65+', 'female', 'male']) expect(isKnownBucket(v)).toBe(true)
  })
})

describe('sortAgeBuckets / sortAgeSection', () => {
  it('orders brackets canonically with unknown last and strangers after it', () => {
    const rows = ['unknown', '65+', 'weird', '18-24', '45-54'].map((ageBracket) => ({ ageBracket }))
    expect(sortAgeBuckets(rows).map((r) => r.ageBracket)).toEqual(['18-24', '45-54', '65+', 'unknown', 'weird'])
  })

  it('leaves a withheld section untouched', () => {
    expect(sortAgeSection<{ ageBracket: string }>({ state: 'withheld' })).toEqual({ state: 'withheld' })
  })
})

describe('ga4ErrorMessage', () => {
  it('prefers gRPC details, then the message, then the value', () => {
    expect(ga4ErrorMessage({ details: 'incompatible', message: '3 INVALID_ARGUMENT: incompatible' })).toBe('incompatible')
    expect(ga4ErrorMessage(new Error('quota'))).toBe('quota')
    expect(ga4ErrorMessage('boom')).toBe('boom')
  })
})

import { describe, it, expect } from 'vitest'
import { sanitizeSelfReportAreas } from './reportSubscriptionSelf'

const VALID = new Set(['bend', 'redmond', 'sisters', 'sunriver'])

describe('sanitizeSelfReportAreas', () => {
  it('keeps only slugs present in the valid set', () => {
    expect(sanitizeSelfReportAreas(['bend', 'nowhere', 'redmond'], VALID)).toEqual(['bend', 'redmond'])
  })

  it('de-dupes while preserving first-seen order', () => {
    expect(sanitizeSelfReportAreas(['redmond', 'bend', 'redmond', 'bend'], VALID)).toEqual(['redmond', 'bend'])
  })

  it('trims whitespace before matching', () => {
    expect(sanitizeSelfReportAreas([' bend ', 'sisters'], VALID)).toEqual(['bend', 'sisters'])
  })

  it('drops non-string and empty entries', () => {
    expect(sanitizeSelfReportAreas(['bend', 42, null, undefined, '', '   '], VALID)).toEqual(['bend'])
  })

  it('returns empty for non-array input', () => {
    expect(sanitizeSelfReportAreas('bend', VALID)).toEqual([])
    expect(sanitizeSelfReportAreas(null, VALID)).toEqual([])
    expect(sanitizeSelfReportAreas({ 0: 'bend' }, VALID)).toEqual([])
  })

  it('returns empty when nothing is valid', () => {
    expect(sanitizeSelfReportAreas(['nowhere', 'els ewhere'], VALID)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { FIRST_EDITION_LABEL, FIRST_EDITION_MONTH, isInvalidEditionPath } from './edition-path-guard'

const NOW = new Date('2026-09-30T05:40:00Z')
const path = (seg: string) => `/housing-market/reports/monthly/${seg}`

describe('isInvalidEditionPath', () => {
  it('lets every month from the first edition to last month through to the page', () => {
    expect(isInvalidEditionPath(path(FIRST_EDITION_MONTH), NOW)).toBe(false)
    expect(isInvalidEditionPath(path('2019-06'), NOW)).toBe(false)
    expect(isInvalidEditionPath(path('2026-08'), NOW)).toBe(false)
    expect(isInvalidEditionPath(`${path('2026-08')}/`, NOW)).toBe(false)
  })

  it('calls a real 404 on a month no edition can have', () => {
    // Before the archive starts, the current month (it has not closed), the future.
    expect(isInvalidEditionPath(path('2005-12'), NOW)).toBe(true)
    expect(isInvalidEditionPath(path('1999-01'), NOW)).toBe(true)
    expect(isInvalidEditionPath(path('2026-09'), NOW)).toBe(true)
    expect(isInvalidEditionPath(path('2099-01'), NOW)).toBe(true)
  })

  it('calls a real 404 on anything that is not the page month shape', () => {
    for (const seg of ['not-a-month', '2026-8', '2026-13', '2026-00', '202608', '2026-08-01', 'August-2026', '%20']) {
      expect(isInvalidEditionPath(path(seg), NOW), seg).toBe(true)
    }
  })

  it('reads the segment the way the page does, decoded', () => {
    // An encoded form of a published edition's URL still reaches the edition.
    expect(isInvalidEditionPath(path('2026%2D08'), NOW)).toBe(false)
    expect(isInvalidEditionPath(path('%32026-08'), NOW)).toBe(false)
    // A malformed escape is no month.
    expect(isInvalidEditionPath(path('2026-0%'), NOW)).toBe(true)
    // Dots are no month either (middleware.ts lists this route in its matcher
    // so a dotted segment reaches the guard at all).
    expect(isInvalidEditionPath(path('2099-01.html'), NOW)).toBe(true)
    expect(isInvalidEditionPath(path('not.a.month'), NOW)).toBe(true)
  })

  it('names the first edition from the one constant', () => {
    expect(FIRST_EDITION_LABEL).toBe('January 2006')
  })

  it('leaves every other path to its own route', () => {
    expect(isInvalidEditionPath('/housing-market/reports/monthly', NOW)).toBe(false)
    expect(isInvalidEditionPath('/housing-market/reports/monthly/2026-08/pdf', NOW)).toBe(false)
    expect(isInvalidEditionPath('/housing-market/reports/some-weekly-report', NOW)).toBe(false)
    expect(isInvalidEditionPath('/housing-market/bend', NOW)).toBe(false)
  })

  it('moves with the calendar: a month becomes valid once it has closed', () => {
    expect(isInvalidEditionPath(path('2026-09'), new Date('2026-10-01T00:00:00Z'))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { marketVerdict } from './market/classify'
import { formatMonthsOfSupply } from './format/months-of-supply'
import {
  stickyAskShown,
  stickyAskSourceLine,
  stickyAskTail,
  stickyAskVerdict,
} from './sticky-ask'

const REFRESHED = '2026-09-07T14:32:00.000Z'

describe('stickyAskVerdict · the figure', () => {
  // The source line named market_pulse_live on /sell, which never reads that
  // table (2026-09-08, live). The caller states its own source now, and a
  // figure with no named source does not publish at all.
  it('prints the source the caller named, not a hardcoded table', () => {
    const built = stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, 'market_metric, Bend detached (Market Truth)')
    expect(built?.source).toBe('market_metric, Bend detached (Market Truth)')
    expect(stickyAskSourceLine(built)).toContain('Source: market_metric, Bend detached (Market Truth)')
    expect(stickyAskSourceLine(built)).not.toContain('market_pulse_live')
  })

  it('refuses to build a verdict with no named source (§0)', () => {
    expect(stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, '')).toBeNull()
    expect(stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, '   ')).toBeNull()
  })

  it('classifies and formats through the canonical modules, never itself (G68)', () => {
    const built = stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, 'market_pulse_live')
    expect(built).not.toBeNull()
    expect(built?.kind).toBe(marketVerdict(3.9).kind)
    expect(built?.label).toBe(marketVerdict(3.9).label)
    expect(built?.monthsOfSupply).toBe(formatMonthsOfSupply(3.9))
    expect(built?.monthsOfSupply).toBe('3.9')
  })

  it('keeps the boundary-safe digits: 4.05 prints 4.1 beside a balanced verdict', () => {
    const built = stickyAskVerdict({ monthsOfSupply: 4.05, refreshedAt: REFRESHED }, 'market_pulse_live')
    // Naive rounding prints "4.0", which the page's own threshold sentence
    // ("4 or less is a seller's market") then contradicts.
    expect(built?.monthsOfSupply).toBe('4.1')
    expect(built?.label).toBe('balanced market')
  })

  it('4.0 exactly is a seller market, matching marketVerdict at the boundary', () => {
    const built = stickyAskVerdict({ monthsOfSupply: 4, refreshedAt: REFRESHED }, 'market_pulse_live')
    expect(built?.label).toBe("seller's market")
    expect(built?.kind).toBe('sellers')
  })

  it('6 or more is a buyer market', () => {
    expect(stickyAskVerdict({ monthsOfSupply: 6.2, refreshedAt: REFRESHED }, 'market_pulse_live')?.kind).toBe('buyers')
  })

  it('formats the read date in the brand timezone, short', () => {
    expect(stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, 'market_pulse_live')?.readAt).toBe('Sep 7')
  })

  it('a UTC-midnight stamp does not slip to the previous Pacific day', () => {
    expect(stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: '2026-09-07' }, 'market_pulse_live')?.readAt).toBe('Sep 7')
  })
})

describe('stickyAskVerdict · null is a real answer (§0)', () => {
  it.each([
    ['no row at all', null],
    ['no months of supply', { monthsOfSupply: null, refreshedAt: REFRESHED }],
    ['an undefined figure', { monthsOfSupply: undefined, refreshedAt: REFRESHED }],
    ['a non-finite figure', { monthsOfSupply: Number.POSITIVE_INFINITY, refreshedAt: REFRESHED }],
    ['a NaN figure', { monthsOfSupply: Number.NaN, refreshedAt: REFRESHED }],
    ['no read stamp', { monthsOfSupply: 3.9, refreshedAt: null }],
    ['an unparseable read stamp', { monthsOfSupply: 3.9, refreshedAt: 'whenever' }],
  ])('returns null for %s rather than inventing a verdict', (_case, input) => {
    expect(stickyAskVerdict(input as never, 'market_pulse_live')).toBeNull()
  })
})

describe('stickyAskTail', () => {
  const verdict = stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, 'market_pulse_live')

  it('reads as one plain line', () => {
    expect(stickyAskTail('Bend', verdict)).toBe("Bend · seller's market · 3.9 months · as of Sep 7")
  })

  it('is null with no verdict, so the control prints the ask alone', () => {
    expect(stickyAskTail('Bend', null)).toBeNull()
  })

  it('is null with no place name rather than printing a leading separator', () => {
    expect(stickyAskTail('   ', verdict)).toBeNull()
  })
})

describe('stickyAskSourceLine', () => {
  it('names the table and the read date (§0 trace)', () => {
    const line = stickyAskSourceLine(stickyAskVerdict({ monthsOfSupply: 3.9, refreshedAt: REFRESHED }, 'market_pulse_live'))
    expect(line).toContain('market_pulse_live')
    expect(line).toContain('3.9')
    expect(line).toContain('Sep 7')
  })

  it('is null with no verdict — there is no figure to trace', () => {
    expect(stickyAskSourceLine(null)).toBeNull()
  })
})

describe('stickyAskShown · never a third ask in one viewport', () => {
  it('is hidden before the sentinel has been passed', () => {
    expect(stickyAskShown({ passedSentinel: false, targetVisible: false, dismissed: false })).toBe(false)
  })

  it('shows once the sentinel is gone and the ask is off screen', () => {
    expect(stickyAskShown({ passedSentinel: true, targetVisible: false, dismissed: false })).toBe(true)
  })

  it('RETIRES while the ask it points at is in view', () => {
    expect(stickyAskShown({ passedSentinel: true, targetVisible: true, dismissed: false })).toBe(false)
  })

  it('stays gone once the visitor closes it, wherever they scroll', () => {
    expect(stickyAskShown({ passedSentinel: true, targetVisible: false, dismissed: true })).toBe(false)
    expect(stickyAskShown({ passedSentinel: true, targetVisible: true, dismissed: true })).toBe(false)
  })
})

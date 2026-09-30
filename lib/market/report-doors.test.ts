import { describe, expect, it } from 'vitest'
import {
  MARKET_REPORT_DOORS,
  marketHubChooser,
  marketNavChildren,
  marketReportDoorLinks,
} from './report-doors'
import * as doors from './report-doors'

describe('market report doors', () => {
  it('lists one door per market family URL in hierarchy order', () => {
    expect(MARKET_REPORT_DOORS.map((d) => d.id)).toEqual([
      'hub',
      'monthly',
      'region',
      'mos',
      'method',
      'history',
      'published',
      'blog',
      'faq',
    ])
    expect(MARKET_REPORT_DOORS.map((d) => d.href)).toEqual([
      '/housing-market',
      '/housing-market/reports/monthly',
      '/housing-market/central-oregon',
      '/months-of-supply',
      '/how-we-get-our-numbers',
      '/housing-market/history',
      '/housing-market/reports',
      '/blog',
      '/faq',
    ])
  })

  it('omits the current page from sibling doors', () => {
    const fromHub = marketReportDoorLinks('hub')
    expect(fromHub.map((d) => d.href)).not.toContain('/housing-market')
    expect(fromHub[0]?.href).toBe('/housing-market/reports/monthly')
    const fromMonthly = marketReportDoorLinks('monthly')
    expect(fromMonthly.map((d) => d.href)).not.toContain('/housing-market/reports/monthly')
    expect(fromMonthly[0]?.href).toBe('/housing-market')
  })

  it('carries no "You are on the …" prose row any more (VOICE-6, 2026-09-22)', () => {
    expect('marketReportHereBody' in doors).toBe(false)
  })

  it('nav children stay the same set as Quiet doors', () => {
    const nav = marketNavChildren()
    expect(nav.map((d) => d.href)).toEqual(MARKET_REPORT_DOORS.map((d) => d.href))
    expect(nav.find((d) => d.href === '/housing-market/reports')?.label).toBe('Sales and weekly reports')
    expect(nav.find((d) => d.href === '/housing-market')?.label).toBe('Live market')
    // Matt 2026-09-30: the monthly report gets its own door in the Market menu.
    expect(nav[1]).toEqual({ href: '/housing-market/reports/monthly', label: 'Monthly market report' })
  })
})


describe('market hub chooser', () => {
  it('lists Live · By city · Every closed sale · Weekly snapshots · MOS', () => {
    expect(marketHubChooser().map((d) => d.label)).toEqual([
      'Live market',
      'By city',
      'Every closed sale',
      'Weekly snapshots',
      'Months of supply',
    ])
  })
})

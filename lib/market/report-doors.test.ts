import { describe, expect, it } from 'vitest'
import {
  MARKET_REPORT_DOORS,
  marketHubChooser,
  marketNavChildren,
  marketReportDoorLinks,
  marketReportHereBody,
} from './report-doors'

describe('market report doors', () => {
  it('lists one door per market family URL in hierarchy order', () => {
    expect(MARKET_REPORT_DOORS.map((d) => d.id)).toEqual([
      'hub',
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
    expect(fromHub[0]?.href).toBe('/housing-market/central-oregon')
    expect(marketReportHereBody('hub')).toMatch(/live Central Oregon market/)
  })

  it('nav children stay the same set as Quiet doors', () => {
    const nav = marketNavChildren()
    expect(nav.map((d) => d.href)).toEqual(MARKET_REPORT_DOORS.map((d) => d.href))
    expect(nav.find((d) => d.href === '/housing-market/reports')?.label).toBe('Sales and weekly reports')
    expect(nav.find((d) => d.href === '/housing-market')?.label).toBe('Live market')
  })
})


describe('market hub chooser', () => {
  it('lists Live · By city · Explore · Sales/weekly · MOS', () => {
    expect(marketHubChooser().map((d) => d.label)).toEqual([
      'Live market',
      'By city',
      'Explore',
      'Sales / weekly',
      'Months of supply',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import {
  extractDataPeriod,
  extractTitlePeriod,
  publishBlogReportPeriod,
} from './publish-blog-report-period'

describe('extractTitlePeriod', () => {
  it('reads the month the title names', () => {
    expect(extractTitlePeriod('Bend Oregon Market Report: June 2026')).toEqual({
      month: 'June',
      year: '2026',
    })
  })
})

describe('extractDataPeriod', () => {
  it('reads The X numbers as the data month and keeps the issue year', () => {
    expect(
      extractDataPeriod('<h2>The May numbers</h2><p>up 3.6% from $770,000 in May 2025</p>', {
        month: 'June',
        year: '2026',
      }),
    ).toEqual({
      month: 'May',
      year: '2026',
    })
  })
})

describe('publishBlogReportPeriod', () => {
  it('rewrites a June issue that prints May closings', () => {
    const published = publishBlogReportPeriod({
      title: 'Bend Oregon Market Report: June 2026',
      html: '<h2>The May numbers</h2><p>Median sale price: $797,000, up 3.6% from $770,000 in May 2025</p>',
      seoTitle: 'Bend Oregon Market Report: June 2026 | Ryan Realty',
    })
    expect(published).toMatchObject({
      displayTitle: 'Bend Oregon Market Report: May 2026',
      metaTitle: 'Bend Oregon Market Report: May 2026 | Ryan Realty',
      periodNote: 'May 2026 closings. Published June 2026.',
      rewrote: true,
    })
  })

  it('rewrites the July issue that prints June closings', () => {
    const published = publishBlogReportPeriod({
      title: 'Bend Oregon Market Report: July 2026',
      html: '<h2>The June numbers</h2>',
    })
    expect(published.displayTitle).toBe('Bend Oregon Market Report: June 2026')
    expect(published.periodNote).toBe('June 2026 closings. Published July 2026.')
  })

  it('uses the prior year when a January issue prints December closings', () => {
    const published = publishBlogReportPeriod({
      title: 'Bend Oregon Market Report: January 2026',
      html: '<h2>The December numbers</h2>',
    })
    expect(published.displayTitle).toBe('Bend Oregon Market Report: December 2025')
    expect(published.periodNote).toBe('December 2025 closings. Published January 2026.')
  })

  it('leaves a matching title and a lifestyle post alone', () => {
    expect(
      publishBlogReportPeriod({
        title: 'Bend Oregon Market Report: May 2026',
        html: '<h2>The May numbers</h2>',
      }).rewrote,
    ).toBe(false)
    expect(
      publishBlogReportPeriod({
        title: 'Dining and Craft Beer in Bend',
        html: '<p>A pint on Wall Street.</p>',
      }),
    ).toMatchObject({
      displayTitle: 'Dining and Craft Beer in Bend',
      periodNote: null,
      rewrote: false,
    })
  })
})

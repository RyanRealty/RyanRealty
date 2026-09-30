import { describe, expect, it, vi } from 'vitest'

/**
 * The Subscriptions hub's render-only preview (review 2026-09-30): its "View
 * this report online" link named a copy that was never stored, so it always
 * failed. A render-only preview now carries no such link; its manage and
 * unsubscribe links stay, signed as a preview.
 */

vi.mock('@/lib/data/crm/getMarketReportData', () => ({
  getMarketReportData: async () => [
    {
      slug: 'bend',
      areaLabel: 'Bend',
      geoType: 'city',
      medianPrice: 721000,
      activeListings: 480,
      soldLast12mo: 1657,
      monthsOfSupply: 3.5,
      monthsOfSupplySource: 'live',
      marketVerdict: 'sellers',
      domMedian: 25,
      yoyPct: -1.22,
      marketHealthLabel: null,
      refreshedAt: '2026-09-30T06:00:00Z',
      source: 'market_metric',
      twelveMonthSource: 'market-truth',
      href: '/cities/bend',
      trend: null,
      provenance: null,
    },
  ],
}))

import { renderMarketReportPreview } from './market-report-preview'
import { verifyReportLinkToken } from '@/lib/email/report-link-token'

describe('renderMarketReportPreview', () => {
  it('carries no web-view link (nothing is stored for it to open), and preview-signed manage and unsubscribe links', async () => {
    const res = await renderMarketReportPreview({
      areaSlugs: ['bend'],
      contactName: 'Cheryl',
      brokerSlug: 'matt',
      personId: 64138,
      subscriptionId: 9016,
      now: new Date('2026-09-30T08:00:00Z'),
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.preview.html).not.toContain('View this report online')
    expect(res.preview.html).not.toContain('/email-preferences/report?')
    expect(res.preview.text).not.toContain('View this report online')
    const manage = /href="(https:\/\/ryan-realty\.com\/email-preferences\?t=[^"&]+)"/.exec(res.preview.html)?.[1]
    expect(manage).toBeTruthy()
    const token = decodeURIComponent(new URL(manage!).searchParams.get('t') ?? '')
    expect(verifyReportLinkToken(token)).toMatchObject({ personId: 64138, purpose: 'manage', preview: true })
  })
})

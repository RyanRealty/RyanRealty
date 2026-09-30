import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * The chart route (review 2026-09-30): a signed chart is drawn from the
 * values in its URL and NEVER from a read of market data at open time, so the
 * email, its web view and its archive show the same image, the one whose
 * values the Spark check verified. An unsigned or tampered series is a 404.
 */

const h = vi.hoisted(() => ({ trend: vi.fn(), element: null as ReactElement | null }))

vi.mock('next/og', () => ({
  ImageResponse: class {
    status = 200
    headers = new Headers({ 'content-type': 'image/png' })
    constructor(el: ReactElement) {
      h.element = el
    }
  },
}))
vi.mock('@/lib/data/market/getMarketTrend', () => ({ getMarketTrend: (...a: unknown[]) => h.trend(...a) }))

import { GET } from './route'
import { marketChartUrl, signMarketChart } from '@/lib/email/market-chart-token'

const POINTS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 8 + i, 1))
  return { month: d.toISOString().slice(0, 7), value: 700000 + i * 1000 }
})
POINTS[11] = { month: '2026-08', value: 699900 }

beforeEach(() => {
  h.trend.mockReset()
  h.trend.mockRejectedValue(new Error('the chart must never read market data'))
  h.element = null
})

describe('GET /api/email/market-chart, signed', () => {
  it('draws exactly the signed values and reads no market data', async () => {
    const res = (await GET(new Request(marketChartUrl({ metric: 'median_price', label: 'Bend', points: POINTS })))) as Response
    expect(res.status).toBe(200)
    expect(h.trend).not.toHaveBeenCalled()
    const html = renderToStaticMarkup(h.element as ReactElement)
    expect(html).toContain('Bend median sale price')
    // The latest month, printed the way the email prints it ($699,900 to the nearest thousand).
    expect(html).toContain('$700,000')
    expect(html).toContain('Aug 2026')
    expect(html).toContain('Last 12 months')
    // The URL fixes the image, so it is cached for good.
    expect(res.headers.get('Cache-Control')).toContain('immutable')
  })

  it('a tampered series or a missing signature is a 404, and still reads nothing', async () => {
    const { d, s } = signMarketChart({ metric: 'median_price', label: 'Bend', points: POINTS })
    const forged = Buffer.from(Buffer.from(d, 'base64url').toString('utf8').replace('699900', '999900')).toString('base64url')
    for (const url of [
      `https://ryan-realty.com/api/email/market-chart?d=${forged}&s=${s}`,
      `https://ryan-realty.com/api/email/market-chart?d=${d}`,
    ]) {
      const res = (await GET(new Request(url))) as Response
      expect(res.status).toBe(404)
    }
    expect(h.trend).not.toHaveBeenCalled()
    expect(h.element).toBeNull()
  })
})

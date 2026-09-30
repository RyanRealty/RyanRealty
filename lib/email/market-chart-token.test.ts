import { afterEach, describe, expect, it } from 'vitest'

/**
 * The market-report chart draws the checked values and nothing else (review
 * 2026-09-30). The email used to point its chart at a route that re-read the
 * cache when the image was OPENED (a different read, key and cache life from
 * the email's own), so the email could print "$445,000" beside a chart
 * reading "$446,000" that no check ever saw. Now the email signs the exact
 * months and values its Spark check verified into the image URL, and the
 * route draws only a series whose signature holds.
 */

import { marketChartUrl, signMarketChart, verifyMarketChart, type MarketChartData } from './market-chart-token'
import { MissingSigningSecretError } from './signing-secret'

const DATA: MarketChartData = {
  metric: 'median_price',
  label: 'Bend',
  points: [
    { month: '2026-06', value: 725152 },
    { month: '2026-07', value: 780000 },
    { month: '2026-08', value: 699900 },
  ],
}

const saved = { env: process.env.NODE_ENV, secret: process.env.EMAIL_TRACKING_SECRET, cma: process.env.CMA_PREVIEW_SECRET, srk: process.env.SUPABASE_SERVICE_ROLE_KEY }
afterEach(() => {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = saved.env
  for (const [k, v] of [['EMAIL_TRACKING_SECRET', saved.secret], ['CMA_PREVIEW_SECRET', saved.cma], ['SUPABASE_SERVICE_ROLE_KEY', saved.srk]] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('market chart token', () => {
  it('round-trips the exact values, and the URL carries nothing a route could re-read data by', () => {
    const url = new URL(marketChartUrl(DATA))
    expect(url.origin + url.pathname).toBe('https://ryan-realty.com/api/email/market-chart')
    expect([...url.searchParams.keys()].sort()).toEqual(['d', 's'])
    expect(verifyMarketChart(url.searchParams.get('d'), url.searchParams.get('s'))).toEqual(DATA)
  })

  it('refuses a changed value, a missing signature and a forged one', () => {
    const { d, s } = signMarketChart(DATA)
    const tampered = Buffer.from(Buffer.from(d, 'base64url').toString('utf8').replace('699900', '699000')).toString('base64url')
    expect(verifyMarketChart(tampered, s)).toBeNull()
    expect(verifyMarketChart(d, null)).toBeNull()
    expect(verifyMarketChart(d, `${s.slice(0, -4)}AAAA`)).toBeNull()
    expect(verifyMarketChart('not-a-payload', s)).toBeNull()
  })

  it('refuses to sign a series that cannot be drawn honestly', () => {
    expect(() => signMarketChart({ ...DATA, points: DATA.points.slice(0, 2) })).toThrow()
    expect(() => signMarketChart({ ...DATA, points: [DATA.points[1]!, DATA.points[0]!, DATA.points[2]!] })).toThrow()
    expect(() => signMarketChart({ ...DATA, points: [...DATA.points.slice(0, 2), { month: '2026-08', value: Number.NaN }] })).toThrow()
    expect(() => signMarketChart({ ...DATA, points: [...DATA.points.slice(0, 2), { month: '2026-13', value: 1 }] })).toThrow()
  })

  it('fails closed in production without a real secret (a public secret would let anyone mint a chart)', () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    delete process.env.EMAIL_TRACKING_SECRET
    delete process.env.CMA_PREVIEW_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => marketChartUrl(DATA)).toThrow(MissingSigningSecretError)
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('overlaid live pulse readers', () => {
  it('getLiveMarketPulse source contains getMarketPulse, not the raw pulse row', () => {
    const src = readFileSync(resolve('app/actions/market-stats.ts'), 'utf8')
    const start = src.indexOf('export async function getLiveMarketPulse')
    const end = src.indexOf('function pulseToMarketStats')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fn = src.slice(start, end)
    expect(fn).toMatch(/getMarketPulse\(\{/)
    expect(fn).not.toMatch(/getMarketPulseRowForGeo/)
  })

  it('search and housing-market OG cards read leftover HUD, not pulse', () => {
    const search = readFileSync(resolve('app/search/og/[...slug]/route.tsx'), 'utf8')
    const housing = readFileSync(resolve('app/housing-market/og/[...slug]/route.tsx'), 'utf8')
    expect(search).toMatch(/leftoverHudKpis/)
    expect(housing).toMatch(/leftoverHudKpis/)
    expect(search).toMatch(/getDetachedOverlays/)
    expect(housing).toMatch(/getDetachedOverlays/)
    expect(search).not.toMatch(/getLiveMarketPulse/)
    expect(housing).not.toMatch(/getLiveMarketPulse/)
    expect(search).not.toMatch(/getMarketPulseRowForGeo/)
    expect(housing).not.toMatch(/getMarketPulseRowForGeo/)
    expect(search).not.toMatch(/runtime = 'edge'/)
    expect(housing).not.toMatch(/runtime = 'edge'/)
  })

  it('getBendMarketContext reads getCityDetachedMarket and marketVerdict', () => {
    const src = readFileSync(resolve('app/actions/dashboard.ts'), 'utf8')
    const start = src.indexOf('async function getBendMarketContext')
    const end = src.indexOf('export async function getDashboardMarketingData')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fn = src.slice(start, end)
    expect(fn).toMatch(/getCityDetachedMarket\('bend'\)/)
    expect(fn).toMatch(/marketVerdict/)
    expect(fn).not.toMatch(/getMarketPulseRowForGeo/)
  })
})

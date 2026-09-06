import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/page.tsx'), 'utf8')

/**
 * Redfin-shaped home lock 2026-09-06: market essay is off home.
 * /housing-market owns the leftover pile and the verdict.
 */
describe('homepage keeps the market essay off home (Redfin lock)', () => {
  it('does not mount a market Instrument or leftover HUD on /', () => {
    expect(SRC).not.toMatch(/leftoverHudKpis/)
    expect(SRC).not.toMatch(/leftoverMarketFigures/)
    expect(SRC).not.toMatch(/<V3Instrument/)
    expect(SRC).not.toMatch(/id="market"/)
    expect(SRC).not.toMatch(/getMarketStatsCacheRowForGeo/)
    expect(SRC).not.toMatch(/<KbMarketHud/)
  })

  it('does not print a town KPI ledger or map block on /', () => {
    expect(SRC).not.toMatch(/id="towns"/)
    expect(SRC).not.toMatch(/<HomeExploreMap/)
    expect(SRC).not.toMatch(/<V3Atlas/)
    expect(SRC).not.toMatch(/townRemainder/)
    expect(SRC).not.toMatch(/namePulseCityRemainder/)
  })

  it('does not print a leftover median chart on the homepage', () => {
    expect(SRC).not.toContain('placeMedianChartCaption')
    expect(SRC).not.toContain('placeMedianChart')
    expect(SRC).not.toContain('Market Truth leftover')
  })

  it('Sell door is Sell a home to valuation, never see what your home is worth', () => {
    expect(SRC).toMatch(/label: v3Text\('Sell a home'\)/)
    expect(SRC).toMatch(/Buy a home/)
    expect(SRC).toMatch(/Work with us/)
    expect(SRC).toMatch(/href: '\/join'/)
    expect(SRC).toMatch(/valuationHref\('\/'\)/)
    expect(SRC).not.toMatch(/See what your home is worth/)
    expect(SRC).not.toMatch(/kicker: v3Text\('Invest'\)/)
  })
})

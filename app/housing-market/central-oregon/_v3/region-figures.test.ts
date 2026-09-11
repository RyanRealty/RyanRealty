import { describe, expect, it } from 'vitest'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { MOS_METHODOLOGY_CLAUSE } from '@/lib/market/classify'
import { REGION_CITIES_SOURCE, REGION_FOLD_LABEL } from './region-constants'
import { marketReportHereBody } from '@/lib/market/report-doors'
import {
  REGION_JARGON_RE,
  buildRegionInstruments,
  buildRegionMosChart,
  composeRegionLiveTrace,
  monthlyPaceFromMos,
} from './region-figures'

const HUD: LeftoverHudKpis = {
  active: 655,
  pending: 293,
  closed30: 180,
  new30: 210,
  medianList: 939900,
  saleToList: 97.4,
  daysToPending: 24,
  monthsSupply: 3.8,
  sold12mo: 1740,
}

describe('SITE-88 visitor-facing region traces', () => {
  it('does not print leftover membership, sample-gated, or MarketPulse', () => {
    const { live, pace } = buildRegionInstruments(HUD, '3.8')
    const extra = composeRegionLiveTrace(live.trace, true)
    for (const text of [live.trace, pace.trace, extra, REGION_CITIES_SOURCE, REGION_FOLD_LABEL]) {
      expect(text, text).not.toMatch(REGION_JARGON_RE)
    }
  })

  it('uses a one-line visitor citation when the MOS drawing publishes', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    expect(live.trace).toBe(
      'Active single-family houses across Central Oregon from Oregon Data Share MLS.',
    )
    expect(live.trace).not.toContain(MOS_METHODOLOGY_CLAUSE)
  })

  it('keeps MOS methodology on the Instrument when the drawing cannot publish', () => {
    const { live } = buildRegionInstruments({ ...HUD, monthsSupply: null }, null)
    expect(live.trace).toContain('Oregon Data Share')
  })

  it('describes extra figures in buyer language, not pipeline vocabulary', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    const extra = composeRegionLiveTrace(live.trace, true)
    expect(extra).toContain('enough listings exist to publish them')
    expect(extra).toContain('buyers and sellers ask about')
    expect(composeRegionLiveTrace(live.trace, false)).toBe(live.trace)
  })

  it('the region here-copy does not say city pulse', () => {
    expect(marketReportHereBody('region')).not.toMatch(REGION_JARGON_RE)
  })

  it('the fold label names what is behind it and never a count', () => {
    expect(REGION_FOLD_LABEL).not.toMatch(/\d/)
    expect(REGION_FOLD_LABEL.length).toBeGreaterThan(20)
    expect(REGION_FOLD_LABEL.toLowerCase()).not.toContain('all ')
    expect(REGION_FOLD_LABEL.toLowerCase()).not.toContain('figures')
  })
})

describe('SITE-88 months of supply is two bars, not a 4.9 tile', () => {
  it('rearranges active / MOS into a counted integer monthly pace', () => {
    expect(monthlyPaceFromMos(655, 3.8)).toBe(172)
    expect(monthlyPaceFromMos(1550, 4.81)).toBe(322)
    expect(monthlyPaceFromMos(null, 3.8)).toBeNull()
    expect(monthlyPaceFromMos(655, 0)).toBeNull()
  })

  it('draws homes for sale vs a month of sales', () => {
    const chart = buildRegionMosChart(HUD, '3.8')
    expect(chart?.kind).toBe('range')
    expect(chart?.id).toBe('central-oregon-mos')
    expect(chart?.rows).toHaveLength(2)
    expect(String(chart?.rows?.[0]?.tick).toLowerCase()).toContain('homes for sale')
    expect(String(chart?.rows?.[1]?.tick).toLowerCase()).toContain('month of sales')
    expect(String(chart?.claim)).toContain('3.8')
    expect(String(chart?.claim)).not.toMatch(/\d+\.\d+\s+sales/)
  })

  it('omits the MOS tile and does not reprint the two bars as jumbo figures', () => {
    const { live } = buildRegionInstruments(HUD, '3.8')
    const labels = live.figures.map((figure) => String(figure.label).toLowerCase())
    expect(labels).not.toContain('homes for sale vs a month of sales')
    expect(labels).not.toContain('a month of sales')
    expect(labels.some((label) => label.includes('homes for sale'))).toBe(false)
    expect(labels.some((label) => label.includes('median list'))).toBe(true)
    expect(labels.some((label) => label.includes('under contract'))).toBe(true)
    for (const figure of live.figures) {
      expect(figure.sentence, String(figure.label)).toBeTruthy()
      expect(String(figure.sentence)).not.toMatch(/\d/)
      expect(figure.count, String(figure.label)).toEqual(expect.any(Number))
    }
  })

  it('keeps the inventory door when the MOS drawing cannot publish', () => {
    const { live } = buildRegionInstruments({ ...HUD, monthsSupply: null }, null)
    const labels = live.figures.map((figure) => String(figure.label).toLowerCase())
    expect(labels.some((label) => label.includes('homes for sale'))).toBe(true)
    expect(labels).not.toContain('a month of sales')
  })

  it('misses omit — never a zero bar', () => {
    expect(buildRegionMosChart({ ...HUD, active: null }, '3.8')).toBeUndefined()
    expect(buildRegionMosChart(HUD, null)).toBeUndefined()
  })
})

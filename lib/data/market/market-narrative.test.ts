/**
 * Unit test for the deterministic market narrative generator (W8.7).
 *
 * Proves the two properties the row rests on: every number in the prose traces
 * to the input stats (§0), and the prose passes the real checkBrandVoice. Also
 * pins the Mohtashami verdict logic (months-of-supply thresholds).
 */
import { describe, expect, it } from 'vitest'
import { buildMarketNarrative, type NarrativeStats } from './market-narrative'
import { checkBrandVoice } from '@/lib/voice/check'

const base: NarrativeStats = {
  geoLabel: 'Bend',
  periodLabel: 'this period',
  medianSalePrice: 742500,
  soldCount: 262,
  medianDom: 38,
  avgSaleToListRatio: 0.984,
  medianPpsf: 415,
  endOfPeriodInventory: 486,
  yoyMedianPriceDeltaPct: 2.1,
  yoyDomChange: 5,
  yoyInventoryChangePct: -3.4,
  monthsOfSupply: 4.3,
}

function allSections(n: ReturnType<typeof buildMarketNarrative>): string[] {
  return [n.overview, n.priceAnalysis, n.speedAnalysis, n.inventoryAnalysis, n.buyerOutlook, n.sellerOutlook, ...n.faq.flatMap((f) => [f.q, f.a])]
}
const coreOf = (t: string) =>
  t.replace(/[↑↓]/g, '').replace(/\b(days?|months?)\b/gi, '').replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')

describe('market narrative generator (W8.7)', () => {
  it('emits no number that does not trace to the stats (§0)', () => {
    const n = buildMarketNarrative(base)
    const allowed = new Set(n.figureTrace.map((f) => coreOf(f.value)))
    for (const section of allSections(n)) {
      const nums = (section.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\$?\d+(?:\.\d+)?%?/g) ?? []).map(coreOf)
      for (const num of nums) {
        if (num === '4' || num === '6') continue // MoS threshold words in the FAQ explainer
        expect(allowed.has(num), `"${num}" does not trace to a stat`).toBe(true)
      }
    }
  })

  it('every section passes checkBrandVoice', () => {
    const n = buildMarketNarrative(base)
    for (const section of allSections(n)) {
      const r = checkBrandVoice(section)
      expect(r.ok, `voice fail: ${JSON.stringify(r)} in: ${section}`).toBe(true)
    }
  })

  it('pins the Mohtashami months-of-supply verdict', () => {
    expect(buildMarketNarrative({ ...base, monthsOfSupply: 3.0 }).overview).toContain("seller's market")
    expect(buildMarketNarrative({ ...base, monthsOfSupply: 5.0 }).overview).toContain('balanced')
    expect(buildMarketNarrative({ ...base, monthsOfSupply: 8.0 }).overview).toContain("buyer's market")
  })

  it('makes NO market-direction claim when months-of-supply is null (§0)', () => {
    const n = buildMarketNarrative({ ...base, monthsOfSupply: null })
    const claim = [n.overview, n.buyerOutlook, n.sellerOutlook, ...n.faq.map((f) => f.a)].join(' ').toLowerCase()
    expect(/\bis a (?:seller's|buyer's) market\b|\bthis is a (?:seller's|buyer's) market\b/.test(claim)).toBe(false)
  })
})

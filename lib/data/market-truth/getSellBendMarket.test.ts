import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applyDetachedOverlay,
  cityDetachedSlug,
  overlayDetachedLayers,
  overlayDetachedMarket,
  withholdDetachedHeadlines,
  type DetachedInventory,
  type SellBendMarket,
} from '@/lib/data/market-truth/getSellBendMarket'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { marketVerdict } from '@/lib/market/classify'

const BEND_MT: SellBendMarket = {
  activeCount: 775,
  monthsOfSupply: 4.45402298850575,
  mosLabel: '4.5',
  verdictKind: 'balanced',
  verdictLabel: 'balanced market',
  medianListPrice: 915000,
  computedAt: '2026-08-23T00:00:00.000Z',
  completeThrough: '2026-08-22',
}

describe('getSellBendMarket', () => {
  it('assembles detached cells from market_metric, never pulse', () => {
    const src = readFileSync(resolve('lib/data/market-truth/getSellBendMarket.ts'), 'utf8')
    expect(src).toMatch(/segment', 'detached'/)
    expect(src).toMatch(/getCityDetachedMarket\('bend'\)/)
    expect(src).not.toMatch(/getMarketPulse/)
    expect(src).not.toMatch(/market_pulse_live/)
  })

  it('city and region pulse readers overlay Market Truth', () => {
    const pulse = readFileSync(resolve('lib/data/market/getMarketPulse.ts'), 'utf8')
    const region = readFileSync(resolve('lib/data/market/getRegionPulse.ts'), 'utf8')
    const snaps = readFileSync(resolve('lib/data/market/getMarketPulseSnapshot.ts'), 'utf8')
    expect(pulse).toMatch(/getDetachedOverlays/)
    expect(region).toMatch(/getDetachedOverlays/)
    expect(snaps).toMatch(/getDetachedOverlays/)
    expect(snaps).not.toMatch(/getDetachedMarkets/)
    expect(pulse).toMatch(/overlayDetachedLayers/)
    expect(region).toMatch(/overlayDetachedLayers/)
    expect(snaps).toMatch(/overlayDetachedLayers/)
    expect(pulse).toMatch(/market-pulse-v10-mt-community/)
    expect(pulse).toMatch(/geoType === 'community' \? 'neighborhood'/)
    expect(region).toMatch(/region-pulse-central-oregon-v6-mt-inventory/)
    expect(snaps).toMatch(/market-pulse-city-snapshots-v7-mt-inventory/)
    expect(snaps).toMatch(/market-pulse-all-city-snapshots-v7-mt-inventory/)
  })

  it('a detached miss withholds pulse 488 / 3.54 / seller instead of publishing it as Market Truth', () => {
    const helper = readFileSync(resolve('lib/data/market-truth/getSellBendMarket.ts'), 'utf8')
    const pulse = readFileSync(resolve('lib/data/market/getMarketPulse.ts'), 'utf8')
    const region = readFileSync(resolve('lib/data/market/getRegionPulse.ts'), 'utf8')
    const snaps = readFileSync(resolve('lib/data/market/getMarketPulseSnapshot.ts'), 'utf8')
    const browse = readFileSync(resolve('lib/data/market/getMarketStatsCacheRows.ts'), 'utf8')
    expect(helper).toMatch(/function assembleInventory/)
    expect(helper).toMatch(/function withholdDetachedHeadlines/)
    expect(helper).toMatch(/function overlayDetachedMarket/)
    expect(helper).toMatch(/function overlayDetachedLayers/)
    expect(helper).toMatch(/function getDetachedOverlays/)
    expect(pulse).toMatch(/withholdDetachedHeadlines/)
    expect(region).toMatch(/withholdDetachedHeadlines/)
    expect(snaps).toMatch(/withholdDetachedHeadlines/)
    expect(browse).toMatch(/withholdDetachedHeadlines/)
    expect(pulse).not.toMatch(/keep pulse rather than fail the page/)
    expect(region).not.toMatch(/\/\* keep pulse \*\//)
  })

  it('overlayDetachedMarket writes detached on hit and withholds headlines on miss', () => {
    const pulse = {
      activeCount: 488,
      monthsOfSupply: 3.54,
      marketHealthLabel: "seller's market",
      medianListPrice: 699000,
      medianDaysToPending: 15,
      newThisWeek: 12,
      closedLast30Days: 40,
    }
    const hit = overlayDetachedMarket(pulse, BEND_MT)
    expect(hit.activeCount).toBe(775)
    expect(hit.monthsOfSupply).toBe(4.45402298850575)
    expect(hit.marketHealthLabel).toBe('balanced market')
    expect(hit.medianListPrice).toBe(915000)
    expect(hit.medianDaysToPending).toBe(15)
    expect(hit.newThisWeek).toBe(12)
    expect(hit.closedLast30Days).toBe(40)

    const miss = overlayDetachedMarket(pulse, null)
    expect(miss).toEqual(withholdDetachedHeadlines(pulse))
    expect(miss.activeCount).toBeNull()
    expect(miss.monthsOfSupply).toBeNull()
    expect(miss.marketHealthLabel).toBeNull()
    expect(miss.medianListPrice).toBeNull()
    expect(miss.medianDaysToPending).toBe(15)
    expect(miss.newThisWeek).toBe(12)
    expect(miss.closedLast30Days).toBe(40)

    const overlaid = applyDetachedOverlay(pulse, BEND_MT)
    expect(overlaid.activeCount).toBe(775)
    expect(overlaid.medianDaysToPending).toBe(15)
  })

  it('overlayDetachedLayers publishes inventory when MOS is below min_n', () => {
    const pulse = {
      activeCount: 488,
      monthsOfSupply: 3.54,
      marketHealthLabel: "seller's market",
      medianListPrice: 699000,
      medianDaysToPending: 15,
      newThisWeek: 12,
      closedLast30Days: 40,
    }
    const inventory: DetachedInventory = {
      activeCount: 51,
      medianListPrice: 625000,
      computedAt: '2026-08-23T00:00:00.000Z',
    }
    const layered = overlayDetachedLayers(pulse, null, inventory)
    expect(layered.activeCount).toBe(51)
    expect(layered.monthsOfSupply).toBeNull()
    expect(layered.marketHealthLabel).toBeNull()
    expect(layered.medianListPrice).toBe(625000)
    expect(layered.medianDaysToPending).toBe(15)
    expect(layered.newThisWeek).toBe(12)
    expect(layered.closedLast30Days).toBe(40)
  })

  it('hyphenates cache city slugs the way market_metric keys them', () => {
    expect(cityDetachedSlug('la pine')).toBe('la-pine')
    expect(cityDetachedSlug('Bend')).toBe('bend')
  })

  it('CMA city grain reads the same city detached helper as /sell', () => {
    const cma = readFileSync(resolve('lib/cma/market.ts'), 'utf8')
    expect(cma).toMatch(/getCityDetachedMarket/)
    expect(cma).toMatch(/getPublicDetachedPace/)
    expect(cma).toMatch(/mt-v1 detached MLS-city/)
  })

  it('city page HUD reads getCityDetachedMarket and map tiles are detached', () => {
    const page = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    expect(page).toMatch(/getCityDetachedMarket/)
    expect(page).toMatch(/propertySubType: 'Single Family Residence'/)
    expect(page).toMatch(/displayedActiveCount=\{marketActive\}/)
  })

  it('/sell and the JSON feed both read Market Truth detached', () => {
    const page = readFileSync(resolve('app/sell/page.tsx'), 'utf8')
    const feed = readFileSync(resolve('lib/data/market/getMarketPulseJsonFeed.ts'), 'utf8')
    expect(page).toMatch(/getSellBendMarket/)
    expect(page).not.toMatch(/getMarketPulse/)
    expect(feed).toMatch(/getDetachedOverlays/)
  })

  it('city geo snapshots overlay Market Truth so index/menu cannot print pulse 488', () => {
    const snap = readFileSync(resolve('lib/data/geo/getGeoSnapshot.ts'), 'utf8')
    const browse = readFileSync(resolve('lib/data/market/getMarketStatsCacheRows.ts'), 'utf8')
    expect(snap).toMatch(/overlayCitySnapshotsDetached/)
    expect(snap).toMatch(/getDetachedInventories/)
    expect(browse).toMatch(/getDetachedOverlays/)
    // Miss must not 404 (snapshot object still returned) and must not keep
    // pulse/MV active as published inventory. Inventory overlay does not wait
    // on MOS (Terrebonne 51 active is publishable while MOS is below min_n).
    expect(snap).toMatch(/mt \? withDetachedInventory\(snap, mt\) : withholdCityPublishedInventory\(snap\)/)
    expect(snap).toMatch(/function withholdCityPublishedInventory/)
    expect(snap).toMatch(/activeSfrCount: null/)
    expect(snap).not.toMatch(/withholdDetachedHeadlines/)
    expect(snap).toMatch(/geo-snapshot-v7-mt-inventory/)
    expect(snap).toMatch(/geo-snapshot-all-cities-v7-mt-inventory/)
    expect(browse).toMatch(/overlayDetachedLayers/)
  })

  it('newsletter and CRM city reports read the same detached helper as /sell', () => {
    const report = readFileSync(resolve('lib/data/crm/getMarketReportData.ts'), 'utf8')
    const draft = readFileSync(resolve('lib/newsletter/produce-draft.ts'), 'utf8')
    expect(report).toMatch(/getDetachedMarkets/)
    expect(draft).toMatch(/getMarketReportData/)
    expect(report).toMatch(/geoType === 'neighborhood'/)
    expect(report).not.toMatch(/Pulse overlay is the fallback/)
  })

  it('housing-market city and hub pages read overlaid pulse (getDetachedOverlays)', () => {
    const geo = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    const pulse = readFileSync(resolve('lib/data/market/getMarketPulse.ts'), 'utf8')
    expect(geo).toMatch(/getMarketPulse/)
    expect(hub).toMatch(/getMarketPulse/)
    expect(pulse).toMatch(/getDetachedOverlays/)
  })

  it('RECON Bend detached 4.454 months is 4.5 display and a balanced verdict', () => {
    const mos = 4.45402298850575
    expect(formatMonthsOfSupply(mos)).toBe('4.5')
    expect(marketVerdict(mos)).toEqual({ kind: 'balanced', label: 'balanced market' })
    expect(marketVerdict(3.54)).toEqual({ kind: 'sellers', label: "seller's market" })
  })
})

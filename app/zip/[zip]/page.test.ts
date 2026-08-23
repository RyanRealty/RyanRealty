import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8')

describe('ZIP page Market Truth overlay', () => {
  it('imports getMetric and reads zip detached cells', () => {
    expect(PAGE).toContain('getMetric')
    expect(PAGE).toContain("from '@/lib/data/market-truth/getMetric'")
    expect(PAGE).toMatch(/geoType:\s*'zip'/)
    expect(PAGE).toMatch(/segment:\s*'detached'/)
    expect(PAGE).toContain('active_count')
    expect(PAGE).toContain('median_list_active')
    expect(PAGE).toContain('months_of_supply')
  })

  it('does not call getDetachedMarket (city/region only)', () => {
    expect(PAGE).not.toMatch(/getDetachedMarket/)
    expect(PAGE).not.toMatch(/getCityDetachedMarket/)
  })

  it('uses a cell only when publishable with a value', () => {
    expect(PAGE).toContain('metric != null && metric.isPublishable && metric.value != null')
  })

  it('miss path does not assign activeCount = 0 from overlay', () => {
    expect(PAGE).toMatch(
      /const activeCount: number \| null = mtHit \? mtActiveRounded : tileActiveCount/,
    )
    const overlayStart = PAGE.indexOf('Headline HIT')
    const overlayEnd = PAGE.indexOf('const sellMedian')
    const overlay = PAGE.slice(overlayStart, overlayEnd)
    expect(overlay).not.toMatch(/activeCount\s*=\s*0/)
    expect(overlay).not.toMatch(/\?\?\s*0/)
    expect(overlay).toMatch(/tileActiveCount/)
    expect(overlay).toContain('!(mtActiveRounded === 0 && tiles.length > 0)')
  })

  it('does not print 12-month new_listings as New · 30 days', () => {
    expect(PAGE).toMatch(/new30: tileNew30/)
    expect(PAGE).not.toMatch(/mtNewVal/)
    expect(PAGE).not.toMatch(/publishedNew30/)
    expect(PAGE).toMatch(/New listings last 30 days/)
    expect(PAGE).toMatch(/getPublicDetachedPace/)
    expect(PAGE).toMatch(/getPublicPlaceSegments/)
    expect(PAGE).toMatch(/PublicPaceStats/)
    expect(PAGE).toMatch(/PublicProductTypes/)
    expect(PAGE).toMatch(/geoType: 'zip'/)
  })
})

import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { MarketStats } from '@/lib/data'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}))

import {
  SUBDIVISION_YEARLY_HISTORY_NOTE,
  SubdivisionSalesHistory,
  subdivisionCacheStatCells,
} from '../SubdivisionSalesHistory'

const SRC = resolve('app/subdivisions/[slug]/SubdivisionSalesHistory.tsx')

const HISTORY = [
  { year: 2024, closedCount: 3, medianClosePrice: 317_000 },
  { year: 2023, closedCount: 2, medianClosePrice: 287_500 },
  { year: 1997, closedCount: 1, medianClosePrice: 142_000 },
]

function stats(over: Partial<MarketStats> = {}): MarketStats {
  return {
    geoType: 'subdivision',
    geoSlug: 'kitty-hawk',
    periodType: 'ytd',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-08-23T00:00:00.000Z',
    medianSalePrice: 317_000,
    medianListPrice: null,
    medianDaysOnMarket: 26,
    monthsOfSupply: 5.1,
    mosVerdict: 'balanced',
    saleToListRatio: 0.98,
    soldCount: 9,
    activeCount: 2,
    yoyChangePct: 4.2,
    refreshedAt: '2026-08-23T00:00:00.000Z',
    methodologyVersion: 'v3',
    ...over,
  }
}

function renderHistory(over: { stats?: MarketStats | null } = {}) {
  return renderToStaticMarkup(
    createElement(SubdivisionSalesHistory, {
      displayName: 'Kitty Hawk',
      history: HISTORY,
      stats: over.stats === undefined ? stats() : over.stats,
      cityName: 'Sunriver',
    }),
  )
}

describe('subdivision yearly history grain', () => {
  it('labels the table as MLS plat-name closed counts, not recorded plat', () => {
    const html = renderHistory({ stats: null })
    expect(html).toContain('MLS plat name')
    expect(html).toContain(SUBDIVISION_YEARLY_HISTORY_NOTE)
    expect(html).toMatch(/single-family name join/i)
    expect(html).not.toMatch(/recorded[\s-]plat/i)
    expect(html).toContain('>2024<')
    expect(html).toContain('Closed sales')
    expect(html).not.toContain('Median close')
    expect(html).not.toContain('$')
    expect(html).not.toMatch(/months of supply/i)
    expect(html).not.toContain('—')
  })

  it('omits cache soldCount so it cannot be read as membership closed_count', () => {
    expect(subdivisionCacheStatCells(stats({ soldCount: 0, medianDaysOnMarket: null }))).toEqual([])
    expect(subdivisionCacheStatCells(stats({ soldCount: 9, medianDaysOnMarket: null }))).toEqual([])
    const cells = subdivisionCacheStatCells(stats())
    expect(cells.map((c) => c.label)).toEqual(['Median days on market'])
    expect(cells.map((c) => c.value).join(' ')).not.toContain('$')
    expect(cells.some((c) => /homes sold/i.test(c.label))).toBe(false)

    const html = renderHistory()
    expect(html).not.toContain('Homes sold')
    expect(html).toContain('Median days on market')
    expect(html).toContain('Year to date')
    expect(html).not.toContain('$')
  })

  it('still gates closed-sale prices through publishSubdivisionClosedPrice', () => {
    const src = readFileSync(SRC, 'utf8')
    expect(src).toMatch(/publishSubdivisionClosedPrice/)
    expect(src).not.toMatch(/Median close price/)
    expect(src).not.toMatch(/stats\.soldCount/)
  })
})

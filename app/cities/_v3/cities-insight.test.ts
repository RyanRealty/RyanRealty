import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import {
  buildCitiesInsightBoard,
  citiesInsightPageCount,
  citiesInsightDatasetVariables,
} from './cities-insight'

function month(key: string, median: number | null, closings: number | null): PublicMonthlyPoint {
  return {
    periodStart: `${key}-01`,
    periodEnd: `${key}-28`,
    medianClose: median,
    closedCount: closings,
  }
}

function twentyFourMonths(): PublicMonthlyPoint[] {
  const out: PublicMonthlyPoint[] = []
  for (let i = 0; i < 24; i += 1) {
    const year = i < 12 ? 2024 : 2025
    const m = (i % 12) + 1
    const key = `${year}-${String(m).padStart(2, '0')}`
    out.push(month(key, 500_000 + i * 1_000, 80 + i))
  }
  return out
}

describe('buildCitiesInsightBoard', () => {
  it('omits pages when the series is too short or a city count is missing', () => {
    const empty = buildCitiesInsightBoard({ monthly: [], cities: [] })
    expect(empty.compare).toBeNull()
    expect(empty.pace).toBeNull()
    expect(empty.mix).toBeNull()
    expect(citiesInsightPageCount(empty)).toBe(0)

    const short = buildCitiesInsightBoard({
      monthly: [month('2025-01', 400_000, 10)],
      cities: [{ slug: 'bend', name: 'Bend', activeCount: 12 }],
    })
    expect(short.compare).toBeNull()
    expect(short.mix).toBeNull()
  })

  it('builds compare, pace, and a city mix from published leftover rows', () => {
    const board = buildCitiesInsightBoard({
      monthly: twentyFourMonths(),
      cities: [
        { slug: 'bend', name: 'Bend', activeCount: 800 },
        { slug: 'redmond', name: 'Redmond', activeCount: 200 },
        { slug: 'sisters', name: 'Sisters', activeCount: null },
      ],
    })
    expect(board.compare?.values).toHaveLength(12)
    expect(board.compare?.priorValues).toHaveLength(12)
    expect(board.pace?.closings).toHaveLength(12)
    expect(board.mix?.segments.map((s) => s.label)).toEqual(['Bend', 'Redmond'])
    expect(board.mix?.total).toBe(1000)
    expect(citiesInsightPageCount(board)).toBe(3)
    const vars = citiesInsightDatasetVariables(board)
    expect(vars.some((v) => v.unitText === 'USD')).toBe(true)
    expect(vars.some((v) => v.name.includes('Active single-family'))).toBe(true)
  })

  it('does not treat a withheld median as zero on the compare line', () => {
    const monthly = twentyFourMonths()
    monthly[23] = month('2025-12', null, 90)
    const board = buildCitiesInsightBoard({ monthly, cities: [] })
    expect(board.compare).toBeNull()
  })
})

describe('SITE-92 cities catalog install', () => {
  it('imports InsightCards, beUI number, and the installed combobox from the route set', () => {
    const insight = readFileSync(resolve('app/cities/_v3/CitiesInsight.client.tsx'), 'utf8')
    const compare = readFileSync(resolve('components/site/v3/V3MosCompare.client.tsx'), 'utf8')
    const page = readFileSync(resolve('app/cities/page.tsx'), 'utf8')
    expect(insight).toMatch(/from '@\/components\/motion\/insight-cards'/)
    expect(insight).toMatch(/from '@\/components\/motion\/number'/)
    expect(insight).toMatch(/from '@\/components\/motion\/combobox'/)
    expect(compare).toMatch(/from '@\/components\/motion\/combobox'/)
    expect(compare).toMatch(/ComboboxTrigger/)
    expect(compare).toMatch(/ComboboxInput/)
    expect(compare).toMatch(/ComboboxList/)
    expect(compare).toMatch(/textValue=\{`\$\{regionLabel\} only`\}/)
    expect(compare).toMatch(/REGION_ONLY/)
    expect(page).toMatch(/<CitiesInsight/)
    expect(page).toMatch(/<V3Atlas/)
    expect(page).toMatch(/<CitiesAlertsStrip/)
    expect(page).toMatch(/<CitiesDirectory/)
    expect(page).toMatch(/id="city-directory"/)
    expect(page.indexOf('id="city-directory"')).toBeLessThan(page.indexOf('id="atlas"'))
    expect(page).toMatch(/detached single-family homes for sale/)
    expect(page).toMatch(/homes of every type/)
    const directory = readFileSync(resolve('app/cities/_v3/CitiesDirectory.tsx'), 'utf8')
    expect(directory).toMatch(/from '@\/components\/motion\/infinite-masonry'/)
    expect(directory).toMatch(/href=\{city\.href\}/)
    expect(compare.indexOf('data-taste="city-combo"')).toBeLessThan(compare.indexOf('v3-mos-compare__field'))
  })
})

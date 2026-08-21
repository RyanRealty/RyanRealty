import { describe, expect, it } from 'vitest'
import { buildCommDChartRoom, buildCommDRankRows, yearlyLast } from './comm-d-chart-room'

const years = (start: number, values: number[]) =>
  values.map((value, i) => ({
    periodStart: `${start + i}-12-01`,
    medianSalePrice: value,
  }))

describe('comm-d chart room', () => {
  it('uses the community series for Time when it is dense', () => {
    const cards = buildCommDChartRoom({
      name: 'Tetherow',
      cityName: 'Bend',
      slug: 'tetherow',
      communityHistory: years(2018, [900_000, 1_000_000, 1_100_000, 1_200_000]),
      cityHistory: years(2018, [500_000, 550_000, 600_000, 650_000]),
      communitySeriesSparse: false,
      rankRows: [],
    })
    const time = cards.find((c) => c.id === 'time')
    expect(time?.title).toBe('Tetherow median rose')
    expect(time?.series[0]?.name).toBe('Tetherow')
    expect(time?.source).toMatch(/neighborhood tetherow/)
    expect(time?.source).not.toMatch(/village/i)
  })

  it('labels a city fallback on Time and does not pass a city figure as Tetherow', () => {
    const cards = buildCommDChartRoom({
      name: 'Tetherow',
      cityName: 'Bend',
      slug: 'tetherow',
      communityHistory: years(2024, [1_200_000]),
      cityHistory: years(2018, [500_000, 550_000, 600_000, 650_000]),
      communitySeriesSparse: true,
      rankRows: [],
    })
    const time = cards.find((c) => c.id === 'time')
    expect(time?.series[0]?.name).toBe('Bend')
    expect(time?.title).toBe('Bend over time')
    expect(time?.line).toMatch(/Bend/)
    expect(time?.line).toMatch(/too thin/i)
  })

  it('Relates community against city on overlapping years only', () => {
    const cards = buildCommDChartRoom({
      name: 'Tetherow',
      cityName: 'Bend',
      slug: 'tetherow',
      communityHistory: years(2018, [900_000, 1_000_000, 1_100_000, 1_200_000]),
      cityHistory: years(2018, [500_000, 550_000, 600_000, 650_000]),
      communitySeriesSparse: false,
      rankRows: [],
    })
    const relate = cards.find((c) => c.id === 'relate')
    expect(relate?.title).toBe('Asks more than Bend')
    expect(relate?.series.map((s) => s.name)).toEqual(['Tetherow', 'Bend'])
  })

  it('ranks only live featured community slugs, never kit villages', () => {
    const rows = buildCommDRankRows({
      cityName: 'Bend',
      selfSlug: 'tetherow',
      rows: [
        { slug: 'tetherow', city: 'Bend', subdivision: 'Tetherow', medianPrice: 1_599_900 },
        { slug: 'broken-top', city: 'Bend', subdivision: 'Broken Top', medianPrice: 900_000 },
        { slug: 'awbrey-glen', city: 'Bend', subdivision: 'Awbrey Glen', medianPrice: 1_100_000 },
        { slug: 'highlands-ridge', city: 'Bend', subdivision: 'Highlands Ridge', medianPrice: 2_000_000 },
        { slug: 'sunriver', city: 'Sunriver', subdivision: 'Sunriver', medianPrice: 899_900 },
      ],
    })
    expect(rows.map((r) => r.slug).sort()).toEqual(['awbrey-glen', 'broken-top'])
    expect(rows.every((r) => r.href.startsWith('/communities/'))).toBe(true)
    expect(JSON.stringify(rows)).not.toMatch(/Highlands Ridge|The Glen|Tartan Druim|Outrider/)
  })

  it('yearlyLast keeps the last month in each year', () => {
    expect(
      yearlyLast([
        { periodStart: '2024-01-01', medianSalePrice: 100 },
        { periodStart: '2024-12-01', medianSalePrice: 200 },
        { periodStart: '2025-06-01', medianSalePrice: 300 },
      ]),
    ).toEqual([
      { year: 2024, value: 200 },
      { year: 2025, value: 300 },
    ])
  })
})

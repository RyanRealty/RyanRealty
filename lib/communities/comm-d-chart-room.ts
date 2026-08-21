/**
 * Chart Room Time / Relate / Rank for the featured community restyle.
 * Shape only. Callers format labels. No invented village rows.
 */

import { formatPriceCompact } from '@/lib/format/money'
import { featuredSlugOf, isFeaturedCommunitySlug } from './featured-slugs'

export type CommDPricePoint = {
  periodStart: string
  medianSalePrice: number | null
}

export type CommDRankRow = {
  name: string
  slug: string
  href: string
  median: number
}

export type CommDChartPoint = {
  value: number
  tick: string
  label: string
  at?: number
}

export type CommDChartSeries = {
  name: string
  points: CommDChartPoint[]
}

export type CommDChartCard = {
  id: 'time' | 'relate' | 'rank'
  kicker: string
  title: string
  line: string
  source: string
  kind: 'line' | 'bars'
  layout?: 'horizontal'
  series: CommDChartSeries[]
  emptyReason?: string
}

const MIN_POINTS = 3

export function yearlyLast(points: readonly CommDPricePoint[]): Array<{ year: number; value: number }> {
  const byYear = new Map<number, { at: string; value: number }>()
  for (const point of points) {
    if (point.medianSalePrice == null || !Number.isFinite(point.medianSalePrice) || point.medianSalePrice <= 0) {
      continue
    }
    const year = new Date(point.periodStart).getUTCFullYear()
    if (!Number.isFinite(year)) continue
    const prev = byYear.get(year)
    if (!prev || point.periodStart > prev.at) {
      byYear.set(year, { at: point.periodStart, value: point.medianSalePrice })
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, row]) => ({ year, value: row.value }))
}

function linePoints(rows: Array<{ year: number; value: number }>): CommDChartPoint[] {
  return rows.map((row) => ({
    value: row.value,
    tick: String(row.year).slice(2),
    label: formatPriceCompact(row.value),
    at: row.year,
  }))
}

function trendTitle(name: string, rows: Array<{ year: number; value: number }>, cityGrain: boolean): string {
  if (cityGrain) return `${name} over time`
  const first = rows[0]?.value
  const last = rows[rows.length - 1]?.value
  if (first == null || last == null) return `${name} over time`
  if (last > first) return `${name} median rose`
  if (last < first) return `${name} median fell`
  return `${name} median held`
}

export function buildCommDChartRoom(input: {
  name: string
  cityName: string
  slug: string
  communityHistory: readonly CommDPricePoint[]
  cityHistory: readonly CommDPricePoint[]
  communitySeriesSparse: boolean
  rankRows: readonly CommDRankRow[]
}): CommDChartCard[] {
  const cards: CommDChartCard[] = []
  const ownYears = yearlyLast(input.communityHistory)
  const cityYears = yearlyLast(input.cityHistory)
  const useCityTime = input.communitySeriesSparse || ownYears.length < MIN_POINTS
  const timeRows = useCityTime ? cityYears : ownYears
  const timeName = useCityTime ? input.cityName : input.name

  if (timeRows.length >= MIN_POINTS) {
    cards.push({
      id: 'time',
      kicker: 'Time',
      title: trendTitle(timeName, timeRows, useCityTime),
      line: useCityTime
        ? `Year-end median sale in ${input.cityName}. ${input.name} is too thin to chart alone.`
        : `Year-end median sale, single-family, ${input.name}.`,
      source: useCityTime
        ? `getPriceHistory city ${input.cityName}. ${input.name} neighborhood series is too thin. Median sale, single-family.`
        : `getPriceHistory neighborhood ${input.slug}. Median sale, single-family. ${timeRows.length} years.`,
      kind: 'line',
      series: [{ name: timeName, points: linePoints(timeRows) }],
    })
  } else {
    cards.push({
      id: 'time',
      kicker: 'Time',
      title: `${input.name} over time`,
      line: 'Too few closed sales here to draw a trend.',
      source: `getPriceHistory neighborhood ${input.slug} and city ${input.cityName}. Median sale.`,
      kind: 'line',
      series: [],
      emptyReason: 'Too few closed sales to chart.',
    })
  }

  const ownByYear = new Map(ownYears.map((row) => [row.year, row.value]))
  const cityByYear = new Map(cityYears.map((row) => [row.year, row.value]))
  const overlapYears = [...ownByYear.keys()].filter((year) => cityByYear.has(year)).sort((a, b) => a - b)
  if (overlapYears.length >= MIN_POINTS && !input.communitySeriesSparse) {
    const lastOwn = ownByYear.get(overlapYears[overlapYears.length - 1]!) ?? 0
    const lastCity = cityByYear.get(overlapYears[overlapYears.length - 1]!) ?? 0
    const relateTitle =
      lastOwn > lastCity ? `Asks more than ${input.cityName}` : lastOwn < lastCity ? `Asks less than ${input.cityName}` : `Asks with ${input.cityName}`
    cards.push({
      id: 'relate',
      kicker: 'Relate',
      title: relateTitle,
      line: `${input.name} against ${input.cityName}, same years, median sale.`,
      source: `getPriceHistory neighborhood ${input.slug} vs city ${input.cityName}. Median sale, overlapping years only.`,
      kind: 'line',
      series: [
        {
          name: input.name,
          points: overlapYears.map((year) => ({
            value: ownByYear.get(year)!,
            tick: String(year).slice(2),
            label: formatPriceCompact(ownByYear.get(year)!),
            at: year,
          })),
        },
        {
          name: input.cityName,
          points: overlapYears.map((year) => ({
            value: cityByYear.get(year)!,
            tick: String(year).slice(2),
            label: formatPriceCompact(cityByYear.get(year)!),
            at: year,
          })),
        },
      ],
    })
  } else {
    cards.push({
      id: 'relate',
      kicker: 'Relate',
      title: `${input.name} and ${input.cityName}`,
      line: `Not enough overlapping ${input.name} sales to draw against ${input.cityName}.`,
      source: `getPriceHistory neighborhood ${input.slug} vs city ${input.cityName}.`,
      kind: 'line',
      series: [],
      emptyReason: `Too few overlapping years to compare ${input.name} with ${input.cityName}.`,
    })
  }

  const rank = input.rankRows
    .filter((row) => isFeaturedCommunitySlug(featuredSlugOf(row.slug)) && row.median > 0)
    .slice()
    .sort((a, b) => b.median - a.median)
    .slice(0, 12)
  if (rank.length >= 2) {
    cards.push({
      id: 'rank',
      kicker: 'Rank',
      title: `${input.name} among named communities`,
      line: `Live median list, featured communities in ${input.cityName}.`,
      source: `getCommunitiesForIndex overlay, featured slugs only, ${input.cityName}. Median list of active single-family.`,
      kind: 'bars',
      layout: 'horizontal',
      series: [
        {
          name: 'Median list',
          points: rank.map((row) => ({
            value: row.median,
            tick: row.name,
            label: formatPriceCompact(row.median),
          })),
        },
      ],
    })
  } else {
    cards.push({
      id: 'rank',
      kicker: 'Rank',
      title: `${input.cityName} communities`,
      line: 'Too few named communities here to rank.',
      source: 'Featured community slugs with a live median list. No village rows.',
      kind: 'bars',
      layout: 'horizontal',
      series: [],
      emptyReason: 'Too few named communities here to rank.',
    })
  }

  return cards
}

export function buildCommDRankRows(input: {
  cityName: string
  selfSlug: string
  rows: ReadonlyArray<{ slug: string; city: string; subdivision: string; medianPrice: number | null }>
}): CommDRankRow[] {
  const city = input.cityName.trim().toLowerCase()
  const self = featuredSlugOf(input.selfSlug)
  return input.rows.flatMap((row) => {
    if (row.city.trim().toLowerCase() !== city) return []
    if (row.medianPrice == null || row.medianPrice <= 0) return []
    const slug = featuredSlugOf(row.slug)
    if (slug === self) return []
    if (!isFeaturedCommunitySlug(slug)) return []
    return [
      {
        name: row.subdivision.trim() || slug,
        slug,
        href: `/communities/${slug}`,
        median: row.medianPrice,
      },
    ]
  })
}

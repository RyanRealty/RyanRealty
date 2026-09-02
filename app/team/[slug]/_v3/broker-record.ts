/**
 * A broker's record, from their closed sales on the MLS and nothing else:
 * the figures, the closings by year for a chart, and every closing with a
 * coordinate as a dot for the living map. Pure, so it is tested; every
 * number the page prints comes off the rows passed in (CLAUDE.md section 0).
 */
import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'
import type { AtlasDot, AtlasType } from '@/components/site/v3'
import type { V3ChartProps, V3ChartPoint } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import { countTicks, yearTicks, yoyClaim } from '@/lib/charts/ticks'
import { ATLAS_TYPES } from '@/lib/atlas/build-place-atlas'
import { classifyType } from '@/app/_v3/home-field-items'
import { formatDate } from '@/lib/format/date'

export type BrokerRecordFigure = { value: string; label: string }

export type BrokerRecord = {
  /** Closings with a close date and price, newest first. */
  closings: BrokerSaleTile[]
  figures: BrokerRecordFigure[]
  /** The closings that carry a coordinate, as map dots (s: 'closed'). */
  dots: AtlasDot[]
  /** The property types present among the dots, in the atlas order. */
  types: AtlasType[]
  /** Closed sales by calendar year, or undefined under two years. */
  chart: V3ChartProps | undefined
  firstYear: number | null
  lastYear: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2)
}

function moneyShort(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    const str = m >= 10 ? m.toFixed(1) : m.toFixed(2)
    return `$${str.replace(/\.?0+$/, '')}M`
  }
  return `$${Math.round(value / 1000)}K`
}

function daysBetween(nowMs: number, iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((nowMs - t) / 86_400_000))
}

export function buildBrokerRecord(sales: readonly BrokerSaleTile[], nowMs = Date.now()): BrokerRecord {
  const closings = sales
    .filter((t) => t.ClosePrice != null && Number(t.ClosePrice) > 0 && !!t.CloseDate)
    .sort((a, b) => (a.CloseDate! < b.CloseDate! ? 1 : -1))

  const years = closings.map((t) => Number(t.CloseDate!.slice(0, 4))).filter((y) => Number.isFinite(y))
  const firstYear = years.length ? Math.min(...years) : null
  const lastYear = years.length ? Math.max(...years) : null
  const prices = closings.map((t) => Number(t.ClosePrice))
  const med = median(prices)
  const listed = closings.filter((t) => t.saleSide === 'listed').length
  const represented = closings.length - listed
  const thisYear = new Date(nowMs).getFullYear()
  const thisYearCount = years.filter((y) => y === thisYear).length

  const figures: BrokerRecordFigure[] = []
  if (closings.length > 0) {
    figures.push({ value: closings.length.toLocaleString('en-US'), label: closings.length === 1 ? 'closed sale' : 'closed sales' })
    if (firstYear != null && lastYear != null) {
      figures.push({ value: firstYear === lastYear ? String(firstYear) : `${firstYear} to ${lastYear}`, label: 'on the MLS' })
    }
    if (med != null) figures.push({ value: moneyShort(med), label: 'median close' })
    if (listed > 0 && represented > 0) {
      figures.push({ value: `${listed} · ${represented}`, label: 'listed · represented the buyer' })
    }
    if (thisYearCount > 0) figures.push({ value: String(thisYearCount), label: `so far in ${thisYear}` })
  }

  const dots: AtlasDot[] = closings.flatMap((t): AtlasDot[] => {
    const lat = t.Latitude, lng = t.Longitude
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    const { typeKey } = classifyType({ propertyType: t.PropertyType ?? null, propertySubType: t.property_sub_type ?? null })
    const key = (t.ListingKey ?? t.ListNumber ?? `${lat},${lng}`).trim()
    return [
      {
        k: key,
        lat: Number(lat.toFixed(4)),
        lng: Number(lng.toFixed(4)),
        p: Math.round(Number(t.ClosePrice)),
        t: typeKey,
        s: 'closed',
        age: daysBetween(nowMs, t.CloseDate),
        soldAgo: daysBetween(nowMs, t.CloseDate),
      },
    ]
  })
  const present = new Set(dots.map((d) => d.t))
  const types = ATLAS_TYPES.filter((t) => present.has(t.key))

  // Closed sales by calendar year. The current year is partial: its bar reads
  // "to date" and the claim states it alone (no year-over-year against a full
  // year, section 0).
  const byYear = new Map<number, number>()
  for (const y of years) byYear.set(y, (byYear.get(y) ?? 0) + 1)
  const points: V3ChartPoint[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, n]) => ({
      value: n,
      tick: v3Text(year === thisYear ? `${year} to date` : String(year)),
      label: v3Text(n.toLocaleString('en-US')),
      at: year,
    }))
  let chart: V3ChartProps | undefined
  if (points.length >= 2) {
    const series = [{ name: v3Text('Closed sales'), points }]
    const last = points[points.length - 1]!
    const claim =
      last.at === thisYear
        ? yoyClaim({ metric: 'Closed sales', unit: 'count', series: [{ name: series[0]!.name, points: [last] }], latestLabel: `${thisYear} so far` })
        : yoyClaim({ metric: 'Closed sales', unit: 'count', series })
    const yTicks = countTicks(series)
    const xTicks = yearTicks(series)
    chart = {
      caption: v3Text('Closed sales by year'),
      ...(claim ? { claim: v3Text(claim) } : {}),
      kind: 'bars',
      series,
      ...(yTicks.length ? { yTicks } : {}),
      ...(xTicks.length ? { xTicks } : {}),
    }
  }

  return { closings, figures, dots, types, chart, firstYear, lastYear }
}

/** The source line under the map and the chart, from the record's own dates. */
export function brokerRecordSource(firstName: string, record: BrokerRecord): string {
  const span =
    record.firstYear != null && record.lastYear != null
      ? record.firstYear === record.lastYear
        ? `in ${record.firstYear}`
        : `${record.firstYear} to ${record.lastYear}`
      : ''
  const mapped = record.dots.length
  const total = record.closings.length
  const coverage = mapped === total ? 'Every closing has a coordinate' : `${mapped} of ${total} closings carry a coordinate`
  return `${firstName}'s closed sales on the regional MLS through Oregon Data Share, listed or with the buyer represented, ${span}. ${coverage}.`.replace(/\s+\./g, '.')
}

export function brokerRecordStamp(record: BrokerRecord): string {
  const newest = record.closings[0]?.CloseDate
  return newest ? formatDate(newest, { month: 'short', day: undefined, year: 'numeric' }) : ''
}

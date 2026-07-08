/**
 * /api/email/market-chart — email-safe market trend chart PNG (Wave 8).
 *
 * Email clients cannot run JS or load external CSS, so the market-report email
 * embeds its charts as <img> tags pointing here. Rendered with next/og
 * (satori) — navy #102742 on cream #faf8f4, no logo, tabular figures.
 *
 * GET params:
 *   geo    — geo type: city | neighborhood | region | community | subdivision | zip
 *   slug   — geo slug, e.g. bend, tetherow
 *   metric — median_price | inventory | dom
 *   months — window of completed months (6–24, default 12)
 *
 * Unauthenticated by design (Gmail/Outlook image proxies fetch it) — it only
 * exposes aggregate public market stats already published on the site's market
 * pages. Every figure comes from `market_stats_cache` monthly rows via the
 * getMarketTrend DAL (§0: cache only, completed months only, nothing invented).
 * When the geo has fewer than 3 usable points, this 404s and the email simply
 * omits the image rather than rendering a fabricated chart.
 *
 * Cache: s-maxage 6h (matches market_stats_cache freshness) + a day of SWR.
 */

import { formatDate } from '@/lib/format/date'
import { ImageResponse } from 'next/og'
import { getMarketTrend, type MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import type { GeoType } from '@/lib/data/types/shared'

export const revalidate = 21600

const NAVY = '#102742'
const CREAM = '#faf8f4'
const NAVY_SOFT = 'rgba(16,39,66,0.55)'
const NAVY_HAIRLINE = 'rgba(16,39,66,0.12)'
const NAVY_FILL = 'rgba(16,39,66,0.07)'

const WIDTH = 1080
const HEIGHT = 540

const GEO_TYPES = new Set(['region', 'city', 'community', 'neighborhood', 'zip', 'subdivision'])

export type ChartMetric = 'median_price' | 'inventory' | 'dom'

const METRICS: Record<
  ChartMetric,
  {
    label: string
    kind: 'line' | 'bar'
    pick: (p: MarketTrendPoint) => number | null
    format: (v: number) => string
  }
> = {
  median_price: {
    label: 'Median sale price',
    kind: 'line',
    pick: (p) => p.medianSalePrice,
    format: (v) => '$' + (Math.round(v / 1000) * 1000).toLocaleString('en-US'),
  },
  inventory: {
    label: 'Homes for sale',
    kind: 'bar',
    pick: (p) => p.endOfPeriodInventory,
    format: (v) => Math.round(v).toLocaleString('en-US'),
  },
  dom: {
    label: 'Median days on market',
    kind: 'bar',
    pick: (p) => p.medianDom,
    format: (v) => `${Math.round(v)} days`,
  },
}

function labelForSlug(slug: string): string {
  const match = buildMarketReportAreas().find((a) => a.slug === slug)
  if (match) return match.label
  return slug
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function shortMonth(iso: string): string {
  const label = formatDate(iso, { month: 'short', year: 'numeric', day: undefined, timeZone: 'UTC' })
  return label === '—' ? '' : label
}

type ChartPoint = { periodStart: string; value: number }

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const geoParam = (url.searchParams.get('geo') ?? 'city').trim()
  const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase()
  const metricParam = (url.searchParams.get('metric') ?? 'median_price').trim() as ChartMetric
  const monthsParam = Number.parseInt(url.searchParams.get('months') ?? '12', 10)

  if (!GEO_TYPES.has(geoParam)) return new Response('Unknown geo type', { status: 400 })
  if (!slug || !/^[a-z0-9-]{1,120}$/.test(slug)) return new Response('Bad slug', { status: 400 })
  const metric = METRICS[metricParam]
  if (!metric) return new Response('Unknown metric', { status: 400 })
  const months = Number.isFinite(monthsParam) ? Math.min(24, Math.max(6, monthsParam)) : 12

  const trend = await getMarketTrend(geoParam as GeoType, slug, months)
  const points: ChartPoint[] = trend
    .map((p) => {
      const v = metric.pick(p)
      return v != null && Number.isFinite(v) ? { periodStart: p.periodStart, value: v } : null
    })
    .filter((p): p is ChartPoint => p !== null)

  if (points.length < 3) return new Response('Not enough data', { status: 404 })

  const geoLabel = labelForSlug(slug)
  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  // Pad the scale so a flat series still reads as a line, and bars keep headroom.
  const span = rawMax - rawMin || Math.max(rawMax * 0.1, 1)
  const yMin = metric.kind === 'bar' ? 0 : Math.max(0, rawMin - span * 0.15)
  const yMax = rawMax + span * 0.15
  const latest = points[points.length - 1]

  // Chart geometry (px inside the 1080×540 canvas).
  const PAD_X = 56
  const chartTop = 168
  const chartBottom = 452
  const chartLeft = PAD_X
  const chartRight = WIDTH - PAD_X
  const chartW = chartRight - chartLeft
  const chartH = chartBottom - chartTop

  const yFor = (v: number): number => chartBottom - ((v - yMin) / (yMax - yMin)) * chartH
  const xFor = (i: number): number =>
    points.length === 1 ? chartLeft + chartW / 2 : chartLeft + (i / (points.length - 1)) * chartW

  // Line path + soft area fill under it.
  const linePts = points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
  const linePath = 'M ' + linePts.join(' L ')
  const areaPath = `${linePath} L ${chartRight},${chartBottom} L ${chartLeft},${chartBottom} Z`

  // Grid rows: max / mid / min value labels with hairlines.
  const gridValues = [yMax - span * 0.15, (yMax - span * 0.15 + yMin) / 2, yMin === 0 ? 0 : rawMin]
  const grid = gridValues.map((v) => ({ y: yFor(v), label: metric.format(v) }))

  // X labels: first, middle, last month.
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => ({
    i,
    label: shortMonth(points[i].periodStart),
  }))

  const barW = Math.max(10, Math.floor((chartW / points.length) * 0.55))

  const image = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: CREAM,
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: `44px ${PAD_X}px 0`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: NAVY }}>
              {`${geoLabel} ${metric.label.toLowerCase()}`}
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: NAVY_SOFT, marginTop: 8 }}>
              {`Last ${points.length} months · Central Oregon MLS · single family homes`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: NAVY }}>
              {metric.format(latest.value)}
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: NAVY_SOFT, marginTop: 6 }}>
              {shortMonth(latest.periodStart)}
            </div>
          </div>
        </div>

        {/* Grid hairlines + y labels */}
        {grid.map((g, idx) => (
          <div
            key={`grid-${idx}`}
            style={{
              display: 'flex',
              position: 'absolute',
              left: chartLeft,
              top: g.y - 1,
              width: chartW,
              height: 1,
              background: NAVY_HAIRLINE,
            }}
          />
        ))}
        {grid.map((g, idx) => (
          <div
            key={`ylab-${idx}`}
            style={{
              display: 'flex',
              position: 'absolute',
              left: chartLeft,
              top: g.y - 26,
              fontSize: 17,
              color: NAVY_SOFT,
            }}
          >
            {g.label}
          </div>
        ))}

        {/* Series */}
        {metric.kind === 'line' ? (
          <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <path d={areaPath} fill={NAVY_FILL} stroke="none" />
            <path d={linePath} fill="none" stroke={NAVY} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
            <circle
              cx={xFor(points.length - 1)}
              cy={yFor(latest.value)}
              r={9}
              fill={NAVY}
              stroke={CREAM}
              strokeWidth={4}
            />
          </svg>
        ) : (
          points.map((p, i) => {
            const h = Math.max(3, chartBottom - yFor(p.value))
            return (
              <div
                key={`bar-${i}`}
                style={{
                  display: 'flex',
                  position: 'absolute',
                  left: xFor(i) - barW / 2,
                  top: chartBottom - h,
                  width: barW,
                  height: h,
                  background: i === points.length - 1 ? NAVY : 'rgba(16,39,66,0.35)',
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            )
          })
        )}

        {/* X labels */}
        {xLabels.map((x, idx) => (
          <div
            key={`xlab-${idx}`}
            style={{
              display: 'flex',
              position: 'absolute',
              left: Math.min(Math.max(xFor(x.i) - 60, chartLeft - 10), chartRight - 110),
              top: chartBottom + 18,
              width: 130,
              justifyContent: idx === 0 ? 'flex-start' : idx === xLabels.length - 1 ? 'flex-end' : 'center',
              fontSize: 18,
              color: NAVY_SOFT,
            }}
          >
            {x.label}
          </div>
        ))}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  )

  // s-maxage 6h to match the cache table's freshness, then a day of SWR.
  image.headers.set('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
  return image
}

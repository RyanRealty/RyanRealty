'use client'

// @no-parity — internal admin surface, no public mockup contract
// 11F: v2 language only; report math and labels unchanged (§0 published figures).

import { useState, useCallback } from 'react'
import {
  getReportMetrics,
  getReportPriceBands,
  getReportMetricsTimeSeries,
  getReportSubdivisionsForCity,
  type ReportMetrics,
  type ReportPriceBandsResult,
  type ReportMetricsTimeSeriesPoint,
} from '@/app/actions/reports'
import type { ReportFilters } from '@/app/actions/reports'
import { getMarketReportDataForLocation } from '@/app/actions/market-reports'
import type { ReportListing } from '@/app/actions/market-reports'
import { trackEvent } from '@/lib/tracking'
import {
  REPORT_PROPERTY_TYPE_SEGMENTS,
  REPORT_PROPERTY_TYPE_FILTER_OPTIONS,
  getPropertyTypeLabel,
  type ReportPropertyTypeSegmentKey,
} from '@/lib/property-type'
import {
  Button,
  ReportGrid,
  SearchField,
  SectionHead,
  SelectField,
  TextField,
  ToolbarCheck,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { ReportTimeSeriesChart } from './ReportTimeSeriesChart'

type Props = { cities: string[] }

type ReportSegmentResult = {
  key: ReportPropertyTypeSegmentKey
  label: string
  metrics: ReportMetrics
  priceBands: ReportPriceBandsResult
  timeSeries: ReportMetricsTimeSeriesPoint[] | null
}

type ReportResult = {
  metrics: ReportMetrics | null
  priceBands: ReportPriceBandsResult | null
  timeSeries: ReportMetricsTimeSeriesPoint[] | null
  breakdown: ReportSegmentResult[] | null
  pending: ReportListing[]
  closed: ReportListing[]
  periodLabel: string
  locationLabel: string
}

const SECTION_STYLE = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-lg)',
  padding: 'var(--a-s6)',
} as const

const HINT_STYLE = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' } as const
const NOTE_STYLE = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '4px 0 0' } as const
const SUBHEAD_STYLE = { fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' } as const

const METRIC_COLUMNS: ReportColumn[] = [
  { key: 'metric', label: 'Metric' },
  { key: 'value', label: 'Value', numeric: true },
]

const SERIES_COLUMNS: ReportColumn[] = [
  { key: 'month', label: 'Month' },
  { key: 'sold', label: 'Sold', numeric: true },
  { key: 'median', label: 'Median price', numeric: true },
]

/** A word that labels DATA — a chip, never a state word (.av2-state uppercases). */
function DataChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="av2-chip" style={{ cursor: 'default' }}>
      {children}
    </span>
  )
}

/** The seven summary figures, in the order the page has always printed them. */
function metricRows(m: ReportMetrics): ReportGridRow[] {
  return [
    { key: 'sold', cells: ['# Sales (period)', m.sold_count] },
    {
      key: 'median',
      cells: ['Median price', `$${Number(m.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`],
    },
    { key: 'dom', cells: ['Median DOM', `${m.median_dom} days`] },
    {
      key: 'ppsf',
      cells: ['Median $/sqft', `$${Number(m.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}`],
    },
    { key: 'active', cells: ['Current listings', m.current_listings] },
    { key: 'sales12', cells: ['Sales (prior 12 mo)', m.sales_12mo] },
    { key: 'inventory', cells: ['Inventory (months)', m.inventory_months ?? '—'] },
  ]
}

function seriesRows(points: ReportMetricsTimeSeriesPoint[]): ReportGridRow[] {
  return points.map((row) => ({
    key: row.period_start,
    cells: [
      row.month_label,
      row.sold_count,
      row.median_price != null
        ? `$${Number(row.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : '—',
    ],
  }))
}

function filtersForSegment(segmentKey: ReportPropertyTypeSegmentKey | ''): ReportFilters {
  if (segmentKey === '') {
    return {}
  }
  const seg = REPORT_PROPERTY_TYPE_SEGMENTS.find((s) => s.key === segmentKey)
  return seg
    ? {
        includeCondoTown: seg.filters.includeCondoTown,
        includeManufactured: seg.filters.includeManufactured,
        includeAcreage: seg.filters.includeAcreage,
      }
    : {}
}

export default function CustomReportBuilder({ cities }: Props) {
  const [city, setCity] = useState('')
  const [subdivision, setSubdivision] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<ReportPropertyTypeSegmentKey | ''>('')
  const [breakDownByPropertyType, setBreakDownByPropertyType] = useState(false)
  const [includeMetrics, setIncludeMetrics] = useState(true)
  const [includePriceBands, setIncludePriceBands] = useState(true)
  const [includeTimeSeries, setIncludeTimeSeries] = useState(true)
  const [timeSeriesMonths, setTimeSeriesMonths] = useState(12)
  const [includePendingClosed, setIncludePendingClosed] = useState(true)
  const [subdivisions, setSubdivisions] = useState<string[]>([])
  const [loadingSubdivisions, setLoadingSubdivisions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)

  const onCityChange = useCallback(async (value: string) => {
    setCity(value)
    setSubdivision('')
    setResult(null)
    if (!value.trim()) {
      setSubdivisions([])
      return
    }
    setLoadingSubdivisions(true)
    try {
      const { subdivisions: subs } = await getReportSubdivisionsForCity(value.trim())
      setSubdivisions(subs)
    } finally {
      setLoadingSubdivisions(false)
    }
  }, [])

  async function handleGenerate() {
    const c = city.trim()
    if (!c) {
      setError('Select a city.')
      return
    }
    if (!dateFrom || !dateTo) {
      setError('Select both start and end date.')
      return
    }
    const from = new Date(dateFrom)
    const to = new Date(dateTo)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      setError('Invalid date range.')
      return
    }
    if (from > to) {
      setError('Start date must be on or before end date.')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    trackEvent('click_cta', { context: 'admin_custom_report_generate', city: c, date_from: dateFrom, date_to: dateTo })
    try {
      const startStr = dateFrom
      const endStr = dateTo
      const sub = subdivision.trim() || null
      const locationLabel = sub ? `${sub}, ${c}` : c
      const periodLabel = `${dateFrom} – ${dateTo}`
      const months = Math.min(60, Math.max(1, timeSeriesMonths))

      if (breakDownByPropertyType) {
        const segmentResults = await Promise.all(
          REPORT_PROPERTY_TYPE_SEGMENTS.map(async (seg) => {
            const f = filtersForSegment(seg.key)
            const [metricsRes, priceBandsRes, timeSeriesRes] = await Promise.all([
              includeMetrics ? getReportMetrics(c, startStr, endStr, null, sub, f) : Promise.resolve({ data: null, error: null }),
              includePriceBands ? getReportPriceBands(c, startStr, endStr, false, sub, f) : Promise.resolve({ data: null, error: null }),
              includeTimeSeries ? getReportMetricsTimeSeries(c, months, sub, f) : Promise.resolve({ data: null, error: null }),
            ])
            if (metricsRes.error && includeMetrics) return null
            if (priceBandsRes.error && includePriceBands) return null
            if (timeSeriesRes.error && includeTimeSeries) return null
            return {
              key: seg.key,
              label: seg.label,
              metrics: metricsRes.data!,
              priceBands: priceBandsRes.data!,
              timeSeries: includeTimeSeries ? (timeSeriesRes.data ?? null) : null,
            }
          })
        )
        const breakdown = segmentResults.filter((r): r is NonNullable<typeof r> => r != null)
        if (breakdown.length === 0) {
          setError('Failed to load one or more property type segments')
          return
        }
        const pendingClosedRes = includePendingClosed ? await getMarketReportDataForLocation(c, from, to, sub) : { pending: [], closed: [] }
        setResult({
          metrics: null,
          priceBands: null,
          timeSeries: null,
          breakdown,
          pending: pendingClosedRes.pending ?? [],
          closed: pendingClosedRes.closed ?? [],
          periodLabel,
          locationLabel,
        })
      } else {
        const f = filtersForSegment(propertyTypeFilter)
        const [metricsRes, priceBandsRes, timeSeriesRes, pendingClosedRes] = await Promise.all([
          getReportMetrics(c, startStr, endStr, null, sub, f),
          getReportPriceBands(c, startStr, endStr, false, sub, f),
          getReportMetricsTimeSeries(c, months, sub, f),
          getMarketReportDataForLocation(c, from, to, sub),
        ])
        if (metricsRes.error) {
          setError(metricsRes.error)
          return
        }
        if (priceBandsRes.error) {
          setError(priceBandsRes.error)
          return
        }
        if (timeSeriesRes.error) {
          setError(timeSeriesRes.error)
          return
        }
        setResult({
          metrics: includeMetrics ? (metricsRes.data ?? null) : null,
          priceBands: includePriceBands ? (priceBandsRes.data ?? null) : null,
          timeSeries: includeTimeSeries ? (timeSeriesRes.data ?? null) : null,
          breakdown: null,
          pending: includePendingClosed ? (pendingClosedRes.pending ?? []) : [],
          closed: includePendingClosed ? (pendingClosedRes.closed ?? []) : [],
          periodLabel,
          locationLabel,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section style={SECTION_STYLE}>
        <SectionHead>Location</SectionHead>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            label="City (required)"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            aria-required
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectField>
          <SelectField
            label="Subdivision (optional)"
            hint={loadingSubdivisions ? 'Loading…' : undefined}
            value={subdivision}
            onChange={(e) => setSubdivision(e.target.value)}
            disabled={loadingSubdivisions || !city}
            // .av2-input carries no :disabled rule and sets an explicit colour,
            // so the shadcn `disabled:opacity-60` dimming would have been lost.
            // Inline because SelectField spreads rest AFTER its own className —
            // a className here would replace av2-input outright. Opacity has no
            // :hover partner, so this cannot kill a stylesheet state.
            style={{ opacity: loadingSubdivisions || !city ? 0.6 : undefined }}
          >
            <option value="">All</option>
            {subdivisions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </SelectField>
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <SectionHead>Date range</SectionHead>
        <p style={HINT_STYLE}>Exact start and end date for the report period. No presets.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField
            label="From (required)"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-required
          />
          <TextField
            label="To (required)"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-required
          />
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <SectionHead>Property type</SectionHead>
        <p style={HINT_STYLE}>Filter by one type or break out metrics by property type.</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <SelectField
            label="Type"
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter((e.target.value || '') as ReportPropertyTypeSegmentKey | '')}
          >
            {REPORT_PROPERTY_TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </SelectField>
          {propertyTypeFilter === '' && (
            <ToolbarCheck
              checked={breakDownByPropertyType}
              onChange={(e) => setBreakDownByPropertyType(e.target.checked)}
              label="Break out by property type"
            />
          )}
        </div>
      </section>

      <section style={SECTION_STYLE}>
        <SectionHead>Data to include</SectionHead>
        <div className="mt-4 space-y-4">
          <ToolbarCheck
            checked={includeMetrics}
            onChange={(e) => setIncludeMetrics(e.target.checked)}
            label="Summary metrics"
          />
          <p className="ml-7" style={NOTE_STYLE}>Sold count, median price, median DOM, median $/sqft, current listings, 12mo sales, inventory (months).</p>
          <ToolbarCheck
            checked={includePriceBands}
            onChange={(e) => setIncludePriceBands(e.target.checked)}
            label="Price bands"
          />
          <p className="ml-7" style={NOTE_STYLE}>Sales and current listings by price range.</p>
          <ToolbarCheck
            checked={includeTimeSeries}
            onChange={(e) => setIncludeTimeSeries(e.target.checked)}
            label="Time series"
          />
          <div className="ml-7 flex items-center gap-2">
            <SearchField
              aria-label="months"
              type="number"
              min={1}
              max={60}
              value={timeSeriesMonths}
              onChange={(e) => setTimeSeriesMonths(Number(e.target.value) || 12)}
              className="w-20"
            />
            <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>months</span>
          </div>
          <p className="ml-7" style={NOTE_STYLE}>Monthly sold count and median price trend.</p>
          <ToolbarCheck
            checked={includePendingClosed}
            onChange={(e) => setIncludePendingClosed(e.target.checked)}
            label="Pending & closed list"
          />
          <p className="ml-7" style={NOTE_STYLE}>Listing history events (went pending / closed) in the date range.</p>
        </div>
      </section>

      <div>
        <Button type="button" onClick={handleGenerate} disabled={loading} touch>
          {loading ? 'Generating…' : 'Generate report'}
        </Button>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid var(--a-danger)',
            borderRadius: 'var(--a-r-lg)',
            background: 'var(--a-danger-wash)',
            color: 'var(--a-danger)',
            fontSize: 'var(--a-text-sm)',
            padding: '12px 16px',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <section style={SECTION_STYLE}>
          {/* A raw h3, NOT SectionHead: .av2-lane-head uppercases, and
              locationLabel is a place NAME — data never goes through a
              case-transforming class. Size and weight carry the hierarchy
              instead (ADMIN_UI §1.1). */}
          <h3 style={{ fontSize: 'var(--a-text-xl)', fontWeight: 600, color: 'var(--a-text)' }}>
            Report: {result.locationLabel}
          </h3>
          <p style={HINT_STYLE}>{result.periodLabel}</p>

          {result.breakdown != null && result.breakdown.length > 0 ? (
            <div className="mt-6 space-y-8">
              {result.breakdown.map((seg) => (
                <div
                  key={seg.key}
                  style={{
                    border: '1px solid var(--a-border)',
                    borderRadius: 'var(--a-r-lg)',
                    background: 'var(--a-inset)',
                    padding: 'var(--a-s4)',
                  }}
                >
                  <h3 className="mb-3 flex items-center gap-2">
                    <DataChip>{seg.label}</DataChip>
                  </h3>
                  {includeMetrics && (
                    <ReportGrid
                      label={`${seg.label} summary metrics`}
                      columns={METRIC_COLUMNS}
                      template="minmax(160px, 1.4fr) minmax(120px, 1fr)"
                      minWidth={300}
                      rows={metricRows(seg.metrics)}
                      empty={<>No summary metric came back for this segment.</>}
                    />
                  )}
                  {includePriceBands && (seg.priceBands.sales_by_band?.length > 0 || seg.priceBands.current_listings_by_band?.length > 0) && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="uppercase tracking-wider" style={{ fontSize: 'var(--a-text-xs)', fontWeight: 600, color: 'var(--a-text-2)' }}>Sales by price band</h4>
                        <ul className="mt-2 space-y-1">
                          {(seg.priceBands.sales_by_band ?? []).slice(0, 6).map((b) => (
                            <li key={b.band} className="flex justify-between gap-2" style={{ fontSize: 'var(--a-text-sm)' }}>
                              <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                              <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>{b.cnt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="uppercase tracking-wider" style={{ fontSize: 'var(--a-text-xs)', fontWeight: 600, color: 'var(--a-text-2)' }}>Listings by price band</h4>
                        <ul className="mt-2 space-y-1">
                          {(seg.priceBands.current_listings_by_band ?? []).slice(0, 6).map((b) => (
                            <li key={b.band} className="flex justify-between gap-2" style={{ fontSize: 'var(--a-text-sm)' }}>
                              <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                              <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>{b.cnt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {includeTimeSeries && seg.timeSeries != null && seg.timeSeries.length > 0 && (
                    <div className="mt-4">
                      <ReportTimeSeriesChart points={seg.timeSeries} caption={`${seg.label} sold count`} id={`ts-${seg.key}`} />
                      <ReportGrid
                        label={`${seg.label} monthly time series`}
                        columns={SERIES_COLUMNS}
                        template="minmax(120px, 1.2fr) minmax(80px, 0.6fr) minmax(120px, 1fr)"
                        minWidth={300}
                        rows={seriesRows(seg.timeSeries.slice(0, 12))}
                        empty={<>No month came back for this segment.</>}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : result.metrics !== null && (
            <div className="mt-6">
              <h3 style={SUBHEAD_STYLE}>Summary metrics</h3>
              <div className="mt-2">
                <ReportGrid
                  label="Summary metrics"
                  columns={METRIC_COLUMNS}
                  template="minmax(180px, 1.4fr) minmax(140px, 1fr)"
                  minWidth={340}
                  rows={metricRows(result.metrics)}
                  empty={<>No summary metric came back for this period.</>}
                />
              </div>
            </div>
          )}

          {result.priceBands != null && (result.priceBands.sales_by_band?.length > 0 || result.priceBands.current_listings_by_band?.length > 0) && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 style={SUBHEAD_STYLE}>Sales by price band</h3>
                <ul className="mt-2 space-y-1">
                  {(result.priceBands.sales_by_band ?? []).map((b) => (
                    <li key={b.band} className="flex justify-between gap-4" style={{ fontSize: 'var(--a-text-sm)' }}>
                      <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>{b.cnt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={SUBHEAD_STYLE}>Current listings by price band</h3>
                <ul className="mt-2 space-y-1">
                  {(result.priceBands.current_listings_by_band ?? []).map((b) => (
                    <li key={b.band} className="flex justify-between gap-4" style={{ fontSize: 'var(--a-text-sm)' }}>
                      <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>{b.cnt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.timeSeries != null && result.timeSeries.length > 0 && (
            <div className="mt-8">
              <h3 style={SUBHEAD_STYLE}>Time series (monthly)</h3>
              <div className="mt-2">
                <ReportTimeSeriesChart points={result.timeSeries} caption="Sold count by month" id="ts-main" />
                <ReportGrid
                  label="Time series (monthly)"
                  columns={SERIES_COLUMNS}
                  template="minmax(140px, 1.2fr) minmax(90px, 0.6fr) minmax(140px, 1fr)"
                  minWidth={340}
                  rows={seriesRows(result.timeSeries)}
                  empty={<>No month came back for this period.</>}
                />
              </div>
            </div>
          )}

          {(result.pending.length > 0 || result.closed.length > 0) && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {result.pending.length > 0 && (
                <div>
                  <h3 style={SUBHEAD_STYLE}>Went pending ({result.pending.length})</h3>
                  <ul className="mt-2 space-y-1.5" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                    {result.pending.slice(0, 25).map((item) => (
                      <li key={item.listing_key} className="flex flex-wrap items-center gap-2">
                        <DataChip>{getPropertyTypeLabel(item.property_type)}</DataChip>
                        {item.price != null ? `$${Number(item.price).toLocaleString()}` : ''} {(item.description ?? '').slice(0, 50)}
                      </li>
                    ))}
                    {result.pending.length > 25 && <li>… and {result.pending.length - 25} more</li>}
                  </ul>
                </div>
              )}
              {result.closed.length > 0 && (
                <div>
                  <h3 style={SUBHEAD_STYLE}>Closed ({result.closed.length})</h3>
                  <ul className="mt-2 space-y-1.5" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                    {result.closed.slice(0, 25).map((item) => (
                      <li key={item.listing_key} className="flex flex-wrap items-center gap-2">
                        <DataChip>{getPropertyTypeLabel(item.property_type)}</DataChip>
                        {item.price != null ? `$${Number(item.price).toLocaleString()}` : ''} {(item.description ?? '').slice(0, 50)}
                      </li>
                    ))}
                    {result.closed.length > 25 && <li>… and {result.closed.length - 25} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

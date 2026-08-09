'use client'

/**
 * CityReportSection — month/quarter city report builder on the analytics hub.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — every figure this
 * screen prints is market data a broker may publish from (§0), so nothing about
 * how one is produced, filtered or formatted moved.
 *
 * Carried over verbatim: filtersForSegment and the three segment flags, the
 * "Pick a city" validation, the breakdown fan-out and its null-drop, every
 * getReportMetrics / getReportPriceBands call and argument, the slice(0, 6)
 * price-band windows, the toLocaleString options on every number, and every
 * metric / band label (including "Median sale price" / "Median sale $/sqft").
 *
 * Substitutions, and why each one (match CustomReportBuilder + DateRangePicker):
 *   raw <select> + Label  -> SelectField (pattern 6 label-above, own ids)
 *   Input + Label         -> TextField
 *   checkbox + Label      -> ToolbarCheck
 *   Button                -> v2 Button (this section's ONE primary)
 *   Badge                 -> .av2-chip / DataChip — segment labels are DATA;
 *                            .av2-state uppercases and is wrong for them
 *   Table                 -> ReportGrid, the admin's one tabular reader
 *   raw <h2>              -> SectionHead
 *   public-brand semantic palette classes -> var(--a-*) tokens only
 */
import { useState } from 'react'
import {
  getReportMetrics,
  getReportPriceBands,
  type ReportMetrics,
  type ReportPriceBandsResult,
  type ReportFilters,
} from '@/app/actions/reports'
import {
  REPORT_PROPERTY_TYPE_SEGMENTS,
  REPORT_PROPERTY_TYPE_FILTER_OPTIONS,
  type ReportPropertyTypeSegmentKey,
} from '@/lib/property-type'
import {
  Button,
  ReportGrid,
  SectionHead,
  SelectField,
  TextField,
  ToolbarCheck,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const HINT_STYLE = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' } as const
const SUBHEAD_STYLE = { fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' } as const
const BAND_HEAD_STYLE = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  color: 'var(--a-text-2)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
}

const METRIC_COLUMNS: ReportColumn[] = [
  { key: 'metric', label: 'Metric' },
  { key: 'value', label: 'Value', numeric: true },
]

/** A word that labels DATA — a chip, never a state word (.av2-state uppercases). */
function DataChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="av2-chip" style={{ cursor: 'default' }}>
      {children}
    </span>
  )
}

/** The seven summary figures, in the order (and wording) this section has always printed. */
function metricRows(m: ReportMetrics): ReportGridRow[] {
  return [
    { key: 'sold', cells: ['# Sales (period)', m.sold_count] },
    {
      key: 'median',
      cells: [
        'Median sale price',
        `$${Number(m.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      ],
    },
    { key: 'dom', cells: ['Median DOM', `${m.median_dom} days`] },
    {
      key: 'ppsf',
      cells: [
        'Median sale $/sqft',
        `$${Number(m.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      ],
    },
    { key: 'active', cells: ['Current listings', m.current_listings] },
    { key: 'sales12', cells: ['Sales (prior 12 mo)', m.sales_12mo] },
    { key: 'inventory', cells: ['Inventory (months)', m.inventory_months ?? '—'] },
  ]
}

function toYMD(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function monthBounds(year: number, month1Based: number): { start: string; end: string } {
  const start = new Date(year, month1Based - 1, 1)
  const end = new Date(year, month1Based, 0)
  return { start: toYMD(start), end: toYMD(end) }
}

function quarterBounds(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const start = new Date(year, startMonth - 1, 1)
  const end = new Date(year, startMonth + 2, 0)
  return { start: toYMD(start), end: toYMD(end) }
}

function PriceBandList({
  title,
  bands,
  cap,
}: {
  title: string
  bands: Array<{ band: string; cnt: number }>
  cap?: number
}) {
  const shown = cap != null ? bands.slice(0, cap) : bands
  return (
    <div>
      <h4 style={BAND_HEAD_STYLE}>{title}</h4>
      <ul className="mt-2 space-y-1">
        {shown.map((b) => (
          <li
            key={b.band}
            className="flex justify-between gap-2"
            style={{ fontSize: 'var(--a-text-sm)' }}
          >
            <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
            <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>
              {b.cnt}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CityReportSection({ cities }: { cities: string[] }) {
  const now = new Date()
  const [city, setCity] = useState('')
  const [subdivision, setSubdivision] = useState('')
  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [includeCondoTown, setIncludeCondoTown] = useState(false)
  const [includeManufactured, setIncludeManufactured] = useState(false)
  const [includeAcreage, setIncludeAcreage] = useState(false)
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<ReportPropertyTypeSegmentKey | ''>('')
  const [breakDownByPropertyType, setBreakDownByPropertyType] = useState(false)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null)
  const [priceBands, setPriceBands] = useState<ReportPriceBandsResult | null>(null)
  const [breakdown, setBreakdown] = useState<Array<{
    key: ReportPropertyTypeSegmentKey
    label: string
    metrics: ReportMetrics
    priceBands: ReportPriceBandsResult
  }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')

  const basePriceFilters = ((): { minPrice: number | null; maxPrice: number | null } => {
    const min = minPrice.trim() ? parseInt(minPrice.replace(/,/g, ''), 10) : null
    const max = maxPrice.trim() ? parseInt(maxPrice.replace(/,/g, ''), 10) : null
    return {
      minPrice: Number.isFinite(min) ? min! : null,
      maxPrice: Number.isFinite(max) ? max! : null,
    }
  })()

  const filtersForSegment = (segmentKey: ReportPropertyTypeSegmentKey | ''): ReportFilters => {
    if (segmentKey === '') {
      return {
        includeCondoTown: includeCondoTown || undefined,
        includeManufactured: includeManufactured || undefined,
        includeAcreage: includeAcreage || undefined,
        minPrice: basePriceFilters.minPrice,
        maxPrice: basePriceFilters.maxPrice,
      }
    }
    const seg = REPORT_PROPERTY_TYPE_SEGMENTS.find((s) => s.key === segmentKey)
    if (!seg) return { ...basePriceFilters }
    return {
      includeCondoTown: seg.filters.includeCondoTown,
      includeManufactured: seg.filters.includeManufactured,
      includeAcreage: seg.filters.includeAcreage,
      minPrice: basePriceFilters.minPrice,
      maxPrice: basePriceFilters.maxPrice,
    }
  }

  async function handleGenerate() {
    const c = city.trim()
    if (!c) {
      setError('Pick a city')
      return
    }
    setError(null)
    setMetrics(null)
    setPriceBands(null)
    setBreakdown(null)
    setLoading(true)
    try {
      const { start, end } =
        periodType === 'month'
          ? monthBounds(year, month)
          : quarterBounds(year, quarter)
      const label =
        periodType === 'month'
          ? `${MONTHS[month - 1]} ${year}`
          : `Q${quarter} ${year}`
      setPeriodLabel(label)
      const sub = subdivision?.trim() || null

      if (breakDownByPropertyType) {
        const results = await Promise.all(
          REPORT_PROPERTY_TYPE_SEGMENTS.map(async (seg) => {
            const f = filtersForSegment(seg.key)
            const [metricsRes, bandsRes] = await Promise.all([
              getReportMetrics(c, start, end, undefined, sub, f),
              getReportPriceBands(c, start, end, false, sub, f),
            ])
            if (metricsRes.error || bandsRes.error) {
              return null
            }
            return {
              key: seg.key,
              label: seg.label,
              metrics: metricsRes.data!,
              priceBands: bandsRes.data!,
            }
          })
        )
        const valid = results.filter((r): r is NonNullable<typeof r> => r != null)
        if (valid.length === 0) {
          setError('Failed to load one or more segments')
          return
        }
        setBreakdown(valid)
      } else {
        const f = filtersForSegment(propertyTypeFilter)
        const [metricsRes, bandsRes] = await Promise.all([
          getReportMetrics(c, start, end, undefined, sub, f),
          getReportPriceBands(c, start, end, false, sub, f),
        ])
        if (metricsRes.error) {
          setError(metricsRes.error)
          return
        }
        if (bandsRes.error) {
          setError(bandsRes.error)
          return
        }
        setMetrics(metricsRes.data ?? null)
        setPriceBands(bandsRes.data ?? null)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      style={{
        marginTop: 'var(--a-s8)',
        borderTop: '1px solid var(--a-border)',
        paddingTop: 'var(--a-s6)',
      }}
    >
      <SectionHead>Report by city & period</SectionHead>
      <p style={HINT_STYLE}>
        Full customization: any city, optional subdivision, any period, property type (SFR + condos/manufactured/acreage), and price range. All sales data available in the database.
      </p>

      <div className="av2-inline-form" style={{ marginTop: 'var(--a-s4)' }}>
        <SelectField
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">Select city</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </SelectField>

        <TextField
          label="Subdivision (optional)"
          type="text"
          value={subdivision}
          onChange={(e) => setSubdivision(e.target.value)}
          placeholder="Community name"
        />

        <SelectField
          label="Period"
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as 'month' | 'quarter')}
        >
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
        </SelectField>

        {periodType === 'month' ? (
          <>
            <SelectField
              label="Month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </SelectField>
            <TextField
              label="Year"
              type="number"
              min={2000}
              max={2030}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </>
        ) : (
          <>
            <SelectField
              label="Quarter"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>Q{q}</option>
              ))}
            </SelectField>
            <TextField
              label="Year"
              type="number"
              min={2000}
              max={2030}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </>
        )}

        <SelectField
          label="Property type"
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

        {propertyTypeFilter === '' && !breakDownByPropertyType && (
          <div
            className="flex flex-wrap items-center gap-4"
            style={{
              borderTop: '1px solid var(--a-border)',
              paddingTop: 'var(--a-s4)',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text-2)' }}>
              Include
            </span>
            <ToolbarCheck
              checked={includeCondoTown}
              onChange={(e) => setIncludeCondoTown(e.target.checked)}
              label="Condos & townhomes"
            />
            <ToolbarCheck
              checked={includeManufactured}
              onChange={(e) => setIncludeManufactured(e.target.checked)}
              label="Manufactured"
            />
            <ToolbarCheck
              checked={includeAcreage}
              onChange={(e) => setIncludeAcreage(e.target.checked)}
              label="Acreage/land"
            />
          </div>
        )}

        <TextField
          label="Min price ($)"
          type="text"
          inputMode="numeric"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          placeholder="Optional"
        />
        <TextField
          label="Max price ($)"
          type="text"
          inputMode="numeric"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder="Optional"
        />

        <Button type="button" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Loading…' : 'Generate report'}
        </Button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 'var(--a-s4)',
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

      {(metrics !== null || priceBands !== null || (breakdown != null && breakdown.length > 0)) && (
        <div className="mt-6 space-y-6">
          {periodLabel && (
            <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text-2)' }}>
              {city} — {periodLabel}
            </p>
          )}
          {breakdown != null && breakdown.length > 0 ? (
            <div className="space-y-8">
              {breakdown.map((seg) => (
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
                  <div className="grid gap-6 sm:grid-cols-2">
                    <ReportGrid
                      label={`${seg.label} summary metrics`}
                      columns={METRIC_COLUMNS}
                      template="minmax(160px, 1.4fr) minmax(120px, 1fr)"
                      minWidth={280}
                      rows={metricRows(seg.metrics)}
                      empty={<>No summary metric came back for this segment.</>}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PriceBandList
                        title="Sales by price band"
                        bands={seg.priceBands.sales_by_band ?? []}
                        cap={6}
                      />
                      <PriceBandList
                        title="Listings by price band"
                        bands={seg.priceBands.current_listings_by_band ?? []}
                        cap={6}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {metrics !== null && (
                <ReportGrid
                  label="Summary metrics"
                  columns={METRIC_COLUMNS}
                  template="minmax(180px, 1.4fr) minmax(140px, 1fr)"
                  minWidth={320}
                  rows={metricRows(metrics)}
                  empty={<>No summary metric came back for this period.</>}
                />
              )}
              {priceBands && (priceBands.sales_by_band?.length > 0 || priceBands.current_listings_by_band?.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 style={SUBHEAD_STYLE}>Sales by price band</h3>
                    <ul className="mt-2 space-y-1">
                      {(priceBands.sales_by_band ?? []).map((b) => (
                        <li
                          key={b.band}
                          className="flex justify-between gap-4"
                          style={{ fontSize: 'var(--a-text-sm)' }}
                        >
                          <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>
                            {b.cnt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={SUBHEAD_STYLE}>Current listings by price band</h3>
                    <ul className="mt-2 space-y-1">
                      {(priceBands.current_listings_by_band ?? []).map((b) => (
                        <li
                          key={b.band}
                          className="flex justify-between gap-4"
                          style={{ fontSize: 'var(--a-text-sm)' }}
                        >
                          <span style={{ color: 'var(--a-text-2)' }}>{b.band}</span>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--a-text)' }}>
                            {b.cnt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

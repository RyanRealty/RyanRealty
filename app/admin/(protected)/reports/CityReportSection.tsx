'use client'

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
import { Badge } from '@/components/ui/badge'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
    <section className="mt-12 border-t border-border pt-10">
      <h2 className="text-xl font-semibold text-foreground">Report by city & period</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Full customization: any city, optional subdivision, any period, property type (SFR + condos/manufactured/acreage), and price range. All sales data available in the database.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">City</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Subdivision (optional)</span>
          <Input
            type="text"
            value={subdivision}
            onChange={(e) => setSubdivision(e.target.value)}
            placeholder="Community name"
            className="w-40 rounded border border-border bg-card px-3 py-2 text-foreground"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Period</span>
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as 'month' | 'quarter')}
            className="rounded border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>
        </Label>
        {periodType === 'month' ? (
          <>
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded border border-border bg-card px-3 py-2 text-foreground"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Year</span>
              <Input
                type="number"
                min={2000}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded border border-border bg-card px-3 py-2 text-foreground"
              />
            </Label>
          </>
        ) : (
          <>
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Quarter</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="rounded border border-border bg-card px-3 py-2 text-foreground"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </Label>
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Year</span>
              <Input
                type="number"
                min={2000}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded border border-border bg-card px-3 py-2 text-foreground"
              />
            </Label>
          </>
        )}
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Property type</span>
          <select
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter((e.target.value || '') as ReportPropertyTypeSegmentKey | '')}
            className="rounded border border-border bg-card px-3 py-2 text-foreground min-w-[180px]"
          >
            {REPORT_PROPERTY_TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </Label>
        {propertyTypeFilter === '' && (
          <Label className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={breakDownByPropertyType}
              onChange={(e) => setBreakDownByPropertyType(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">Break out by property type</span>
          </Label>
        )}
        {propertyTypeFilter === '' && !breakDownByPropertyType && (
          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 w-full">
            <span className="text-sm font-medium text-muted-foreground">Include</span>
            <Label className="flex items-center gap-2">
              <Input type="checkbox" checked={includeCondoTown} onChange={(e) => setIncludeCondoTown(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-muted-foreground">Condos & townhomes</span>
            </Label>
            <Label className="flex items-center gap-2">
              <Input type="checkbox" checked={includeManufactured} onChange={(e) => setIncludeManufactured(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-muted-foreground">Manufactured</span>
            </Label>
            <Label className="flex items-center gap-2">
              <Input type="checkbox" checked={includeAcreage} onChange={(e) => setIncludeAcreage(e.target.checked)} className="rounded border-border" />
              <span className="text-sm text-muted-foreground">Acreage/land</span>
            </Label>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <Label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Min price ($)</span>
            <Input type="text" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Optional" className="w-28 rounded border border-border bg-card px-3 py-2 text-foreground" />
          </Label>
          <Label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Max price ($)</span>
            <Input type="text" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Optional" className="w-28 rounded border border-border bg-card px-3 py-2 text-foreground" />
          </Label>
        </div>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Generate report'}
        </Button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}
      {(metrics !== null || priceBands !== null || (breakdown != null && breakdown.length > 0)) && (
        <div className="mt-6 space-y-6">
          {periodLabel && (
            <p className="text-sm font-medium text-muted-foreground">
              {city} — {periodLabel}
            </p>
          )}
          {breakdown != null && breakdown.length > 0 ? (
            <div className="space-y-8">
              {breakdown.map((seg) => (
                <div key={seg.key} className="rounded-lg border border-border bg-muted/50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                    <Badge variant="outline">{seg.label}</Badge>
                  </h3>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[280px] border border-border text-sm">
                        <TableBody>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium"># Sales (period)</TableCell><TableCell className="border border-border px-3 py-2">{seg.metrics.sold_count}</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median price</TableCell><TableCell className="border border-border px-3 py-2">${Number(seg.metrics.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median DOM</TableCell><TableCell className="border border-border px-3 py-2">{seg.metrics.median_dom} days</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median $/sqft</TableCell><TableCell className="border border-border px-3 py-2">${Number(seg.metrics.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Current listings</TableCell><TableCell className="border border-border px-3 py-2">{seg.metrics.current_listings}</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Sales (prior 12 mo)</TableCell><TableCell className="border border-border px-3 py-2">{seg.metrics.sales_12mo}</TableCell></TableRow>
                          <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Inventory (months)</TableCell><TableCell className="border border-border px-3 py-2">{seg.metrics.inventory_months ?? '—'}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sales by price band</h4>
                        <ul className="mt-2 space-y-1 text-sm">
                          {(seg.priceBands.sales_by_band ?? []).slice(0, 6).map((b) => (
                            <li key={b.band} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{b.band}</span>
                              <span className="font-medium">{b.cnt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Listings by price band</h4>
                        <ul className="mt-2 space-y-1 text-sm">
                          {(seg.priceBands.current_listings_by_band ?? []).slice(0, 6).map((b) => (
                            <li key={b.band} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{b.band}</span>
                              <span className="font-medium">{b.cnt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {metrics !== null && (
                <div className="overflow-x-auto">
                  <Table className="min-w-[320px] border border-border text-sm">
                    <TableBody>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium"># Sales (period)</TableCell><TableCell className="border border-border px-3 py-2">{metrics.sold_count}</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median price</TableCell><TableCell className="border border-border px-3 py-2">${Number(metrics.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median DOM</TableCell><TableCell className="border border-border px-3 py-2">{metrics.median_dom} days</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Median $/sqft</TableCell><TableCell className="border border-border px-3 py-2">${Number(metrics.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Current listings</TableCell><TableCell className="border border-border px-3 py-2">{metrics.current_listings}</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Sales (prior 12 mo)</TableCell><TableCell className="border border-border px-3 py-2">{metrics.sales_12mo}</TableCell></TableRow>
                      <TableRow><TableCell className="border border-border bg-muted px-3 py-2 font-medium">Inventory (months)</TableCell><TableCell className="border border-border px-3 py-2">{metrics.inventory_months ?? '—'}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
              {priceBands && (priceBands.sales_by_band?.length > 0 || priceBands.current_listings_by_band?.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Sales by price band</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {(priceBands.sales_by_band ?? []).map((b) => (
                        <li key={b.band} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{b.band}</span>
                          <span className="font-medium">{b.cnt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Current listings by price band</h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {(priceBands.current_listings_by_band ?? []).map((b) => (
                        <li key={b.band} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{b.band}</span>
                          <span className="font-medium">{b.cnt}</span>
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

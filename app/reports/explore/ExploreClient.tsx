'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import {
  searchReportLocations,
  getReportMetrics,
  getReportMetricsTimeSeries,
  getReportPriceBands,
  type ReportMetrics,
  type ReportPriceBandsResult,
  type ReportMetricsTimeSeriesPoint,
  type ReportLocation,
  type ReportFilters,
} from '../../actions/reports'
import ShareButton from '../../../components/ShareButton'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function toYMD(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

const PRESETS: { id: string; label: string; getRange: () => { start: string; end: string } }[] = (() => {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const q = Math.floor(now.getMonth() / 3) + 1
  const thisQuarterStart = new Date(now.getFullYear(), (q - 1) * 3, 1)
  const thisQuarterEnd = new Date(now.getFullYear(), q * 3, 0)
  const lastQuarterStart = new Date(now.getFullYear(), (q - 2) * 3, 1)
  const lastQuarterEnd = new Date(now.getFullYear(), (q - 1) * 3, 0)
  const ytdStart = new Date(now.getFullYear(), 0, 1)
  return [
    { id: '7d', label: 'Last 7 days', getRange: () => ({ start: toYMD(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), end: toYMD(now) }) },
    { id: '30d', label: 'Last 30 days', getRange: () => ({ start: toYMD(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), end: toYMD(now) }) },
    { id: '90d', label: 'Last 90 days', getRange: () => ({ start: toYMD(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)), end: toYMD(now) }) },
    { id: 'this_month', label: 'This month', getRange: () => ({ start: toYMD(thisMonthStart), end: toYMD(thisMonthEnd) }) },
    { id: 'last_month', label: 'Last month', getRange: () => ({ start: toYMD(lastMonthStart), end: toYMD(lastMonthEnd) }) },
    { id: 'this_quarter', label: 'This quarter', getRange: () => ({ start: toYMD(thisQuarterStart), end: toYMD(thisQuarterEnd) }) },
    { id: 'last_quarter', label: 'Last quarter', getRange: () => ({ start: toYMD(lastQuarterStart), end: toYMD(lastQuarterEnd) }) },
    { id: 'ytd', label: 'Year to date', getRange: () => ({ start: toYMD(ytdStart), end: toYMD(now) }) },
    { id: '1y', label: 'Last 12 months', getRange: () => ({ start: toYMD(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)), end: toYMD(now) }) },
    { id: '2y', label: 'Last 2 years', getRange: () => ({ start: toYMD(new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() + 1)), end: toYMD(now) }) },
    { id: '5y', label: 'Last 5 years', getRange: () => ({ start: toYMD(new Date(now.getFullYear() - 5, now.getMonth(), now.getDate() + 1)), end: toYMD(now) }) },
    { id: '10y', label: 'Last 10 years', getRange: () => ({ start: toYMD(new Date(now.getFullYear() - 10, now.getMonth(), now.getDate() + 1)), end: toYMD(now) }) },
  ]
})()

const NUM_MONTHS_TREND = 12

function locationLabel(loc: { city: string; subdivision?: string } | null): string {
  if (!loc?.city) return ''
  return loc.subdivision ? `${loc.subdivision}, ${loc.city}` : loc.city
}

export default function ExploreClient({
  initialCity = '',
  initialSubdivision = '',
  initialStart = '',
  initialEnd = '',
  initialIncludeCondoTown = false,
  initialIncludeManufactured = false,
  initialIncludeAcreage = false,
  initialMinPrice,
  initialMaxPrice,
}: {
  initialCity?: string
  initialSubdivision?: string
  initialStart?: string
  initialEnd?: string
  initialIncludeCondoTown?: boolean
  initialIncludeManufactured?: boolean
  initialIncludeAcreage?: boolean
  initialMinPrice?: number | null
  initialMaxPrice?: number | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [location, setLocation] = useState<{ city: string; subdivision?: string } | null>(
    initialCity ? { city: initialCity, subdivision: initialSubdivision || undefined } : null
  )
  const [locationQuery, setLocationQuery] = useState(locationLabel(location) || '')
  const [suggestions, setSuggestions] = useState<ReportLocation[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [presetId, setPresetId] = useState('this_month')
  const [start, setStart] = useState(initialStart || '')
  const [end, setEnd] = useState(initialEnd || '')
  const [customMode, setCustomMode] = useState(false)
  const [includeCondoTown, setIncludeCondoTown] = useState(initialIncludeCondoTown)
  const [includeManufactured, setIncludeManufactured] = useState(initialIncludeManufactured)
  const [includeAcreage, setIncludeAcreage] = useState(initialIncludeAcreage)
  const [minPrice, setMinPrice] = useState<string>(initialMinPrice != null ? String(initialMinPrice) : '')
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice != null ? String(initialMaxPrice) : '')
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [priceBands, setPriceBands] = useState<ReportPriceBandsResult | null>(null)
  const [timeSeries, setTimeSeries] = useState<ReportMetricsTimeSeriesPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const city = location?.city ?? ''
  const subdivision = location?.subdivision ?? null
  const filters: ReportFilters = useMemo(() => {
    const min = minPrice.trim() ? parseInt(minPrice.replace(/,/g, ''), 10) : null
    const max = maxPrice.trim() ? parseInt(maxPrice.replace(/,/g, ''), 10) : null
    return {
      includeCondoTown: includeCondoTown || undefined,
      includeManufactured: includeManufactured || undefined,
      includeAcreage: includeAcreage || undefined,
      minPrice: Number.isFinite(min) ? min! : null,
      maxPrice: Number.isFinite(max) ? max! : null,
    }
  }, [includeCondoTown, includeManufactured, includeAcreage, minPrice, maxPrice])

  // Sync state from URL on load / when URL changes
  useEffect(() => {
    const c = searchParams.get('city') ?? initialCity
    const sub = searchParams.get('subdivision') ?? initialSubdivision
    const s = searchParams.get('start') ?? initialStart
    const e = searchParams.get('end') ?? initialEnd
    const condo = searchParams.get('condo') === '1'
    const mfd = searchParams.get('mfd') === '1'
    const acre = searchParams.get('acre') === '1'
    const minP = searchParams.get('minPrice')
    const maxP = searchParams.get('maxPrice')
    if (c) {
      setLocation({ city: c, subdivision: sub || undefined })
      setLocationQuery(sub ? `${sub}, ${c}` : c)
    }
    if (s) setStart(s)
    if (e) setEnd(e)
    setIncludeCondoTown(condo)
    setIncludeManufactured(mfd)
    setIncludeAcreage(acre)
    if (minP != null) setMinPrice(minP)
    if (maxP != null) setMaxPrice(maxP)
    if (!s || !e) {
      const preset = PRESETS.find((p) => p.id === presetId)
      if (preset) {
        const { start: ps, end: pe } = preset.getRange()
        if (!s) setStart(ps)
        if (!e) setEnd(pe)
      }
    }
  }, [initialCity, initialSubdivision, initialStart, initialEnd, searchParams, presetId])

  // Type-ahead: debounced search
  useEffect(() => {
    const q = locationQuery.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)
    suggestionDebounceRef.current = setTimeout(() => {
      setSuggestionsLoading(true)
      searchReportLocations(q).then(({ locations }) => {
        setSuggestions(locations ?? [])
        setSuggestionsOpen(true)
        setSuggestionsLoading(false)
      })
    }, 250)
    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current)
    }
  }, [locationQuery])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const updateUrl = useCallback(
    (updates: {
      city?: string
      subdivision?: string
      start?: string
      end?: string
      condo?: boolean
      mfd?: boolean
      acre?: boolean
      minPrice?: string
      maxPrice?: string
    }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (updates.city !== undefined) (updates.city ? params.set('city', updates.city) : params.delete('city'))
      if (updates.subdivision !== undefined) (updates.subdivision ? params.set('subdivision', updates.subdivision) : params.delete('subdivision'))
      if (updates.start !== undefined) (updates.start ? params.set('start', updates.start) : params.delete('start'))
      if (updates.end !== undefined) (updates.end ? params.set('end', updates.end) : params.delete('end'))
      if (updates.condo !== undefined) (updates.condo ? params.set('condo', '1') : params.delete('condo'))
      if (updates.mfd !== undefined) (updates.mfd ? params.set('mfd', '1') : params.delete('mfd'))
      if (updates.acre !== undefined) (updates.acre ? params.set('acre', '1') : params.delete('acre'))
      if (updates.minPrice !== undefined) (updates.minPrice ? params.set('minPrice', updates.minPrice) : params.delete('minPrice'))
      if (updates.maxPrice !== undefined) (updates.maxPrice ? params.set('maxPrice', updates.maxPrice) : params.delete('maxPrice'))
      const q = params.toString()
      router.replace(q ? `/reports/explore?${q}` : '/reports/explore', { scroll: false })
    },
    [router, searchParams]
  )

  const applyPreset = useCallback(
    (id: string) => {
      setPresetId(id)
      setCustomMode(false)
      const preset = PRESETS.find((p) => p.id === id)
      if (preset) {
        const { start: s, end: e } = preset.getRange()
        setStart(s)
        setEnd(e)
        if (city) updateUrl({ start: s, end: e })
      }
    },
    [city, updateUrl]
  )

  const selectLocation = useCallback(
    (loc: ReportLocation) => {
      const newLoc = { city: loc.city, subdivision: loc.subdivision }
      setLocation(newLoc)
      setLocationQuery(loc.label)
      setSuggestionsOpen(false)
      updateUrl({ city: loc.city, subdivision: loc.subdivision || undefined })
    },
    [updateUrl]
  )

  const loadData = useCallback(async () => {
    const c = city.trim()
    if (!c) {
      setError('Type and select a city, community, or address')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const [metricsRes, bandsRes, seriesRes] = await Promise.all([
        getReportMetrics(c, start, end, undefined, subdivision, filters),
        getReportPriceBands(c, start, end, false, subdivision, filters),
        getReportMetricsTimeSeries(c, NUM_MONTHS_TREND, subdivision, filters),
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
      setTimeSeries(seriesRes.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [city, subdivision, start, end, filters])

  const handleApply = useCallback(() => {
    setHasApplied(true)
    if (city) {
      updateUrl({
        city,
        subdivision: subdivision ?? undefined,
        start,
        end,
        condo: includeCondoTown,
        mfd: includeManufactured,
        acre: includeAcreage,
        minPrice: minPrice.trim() || undefined,
        maxPrice: maxPrice.trim() || undefined,
      })
    }
    loadData()
  }, [city, subdivision, start, end, includeCondoTown, includeManufactured, includeAcreage, minPrice, maxPrice, updateUrl, loadData])

  // When URL has city/start/end, auto-load once so shared links work
  useEffect(() => {
    if (!city || !start || !end) return
    loadData()
    setHasApplied(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount when URL is set

  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.origin + '/reports/explore' + (searchParams.toString() ? `?${searchParams.toString()}` : '')
      : ''
  const shareTitle = location ? `${locationLabel(location)} Market Snapshot` : 'Market Explorer'
  const shareText = city && start && end ? `${locationLabel(location)} market: ${start} – ${end}` : shareTitle

  // Chart data: price bands (combine sales + current into one structure for grouped bar)
  const priceBandChartData = useMemo(() => {
    if (!priceBands?.sales_by_band?.length && !priceBands?.current_listings_by_band?.length) return []
    const bands = new Set<string>()
    ;(priceBands.sales_by_band ?? []).forEach((b) => bands.add(b.band))
    ;(priceBands.current_listings_by_band ?? []).forEach((b) => bands.add(b.band))
    return Array.from(bands)
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      .map((band) => ({
        band,
        sales: priceBands.sales_by_band?.find((b) => b.band === band)?.cnt ?? 0,
        'Current listings': priceBands.current_listings_by_band?.find((b) => b.band === band)?.cnt ?? 0,
      }))
  }, [priceBands])

  // Trend: reverse so oldest first for line chart
  const trendChartData = useMemo(
    () => [...(timeSeries ?? [])].reverse().map((p) => ({ ...p, median_price: p.median_price ?? 0 })),
    [timeSeries]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div ref={containerRef} className="relative flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Location</span>
            <Input
              type="text"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
              placeholder="City, community, neighborhood, or address…"
              className="min-w-[280px] rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-sm"
              aria-label="Search location"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen}
              aria-controls="location-suggestions"
              id="location-input"
            />
            {suggestionsOpen && (suggestions.length > 0 || suggestionsLoading) && (
              <ul
                id="location-suggestions"
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-[280px] overflow-auto rounded-lg border border-border bg-card py-1 shadow-md"
              >
                {suggestionsLoading && suggestions.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
                ) : (
                  suggestions.map((loc) => (
                    <li key={`${loc.type}-${loc.city}-${loc.subdivision ?? ''}-${loc.label}`}>
                      <Button
                        type="button"
                        role="option"
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                        onClick={() => selectLocation(loc)}
                      >
                        {loc.type === 'city' && <span className="text-muted-foreground" aria-hidden>City · </span>}
                        {loc.type === 'subdivision' && <span className="text-muted-foreground" aria-hidden>Community · </span>}
                        {loc.type === 'address' && <span className="text-muted-foreground" aria-hidden>Address · </span>}
                        {loc.label}
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {!customMode ? (
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Period</span>
              <Select value={presetId} onValueChange={applyPreset}>
                <SelectTrigger className="rounded-lg" aria-label="Date range preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Start</span>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-sm"
                  aria-label="Start date"
                />
              </Label>
              <Label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">End</span>
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-sm"
                  aria-label="End date"
                />
              </Label>
            </div>
          )}
          <Label className="flex items-center gap-2 py-2">
            <Input
              type="checkbox"
              checked={customMode}
              onChange={(e) => {
                setCustomMode(e.target.checked)
                if (!e.target.checked) applyPreset(presetId)
              }}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">Custom range</span>
          </Label>
          <div className="flex flex-col gap-2 border-l border-border pl-4">
            <span className="text-sm font-medium text-muted-foreground">Property type</span>
            <div className="flex flex-wrap gap-4">
              <Label className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={includeCondoTown}
                  onChange={(e) => setIncludeCondoTown(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Include condos & townhomes</span>
              </Label>
              <Label className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={includeManufactured}
                  onChange={(e) => setIncludeManufactured(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Include manufactured</span>
              </Label>
              <Label className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  checked={includeAcreage}
                  onChange={(e) => setIncludeAcreage(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-muted-foreground">Include acreage/land</span>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">Default: single-family residential only. Check to add other types.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Min price ($)</span>
              <Input
                type="text"
                inputMode="numeric"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Optional"
                className="w-28 rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-sm"
                aria-label="Minimum price filter"
              />
            </Label>
            <Label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">Max price ($)</span>
              <Input
                type="text"
                inputMode="numeric"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Optional"
                className="w-28 rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-sm"
                aria-label="Maximum price filter"
              />
            </Label>
          </div>
          <Button
            type="button"
            onClick={handleApply}
            disabled={loading || !city.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Apply'}
          </Button>
        </div>
        {shareUrl && (
          <ShareButton
            url={shareUrl}
            title={shareTitle}
            text={shareText}
            aria-label="Share this view"
            variant="default"
            trackContext="explore_report"
          />
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {metrics !== null && (
        <>
          <section aria-labelledby="metrics-heading">
            <h2 id="metrics-heading" className="sr-only">
              Key metrics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Sales (period)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.sold_count}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Median price</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  ${Number(metrics.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Median DOM</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.median_dom} days</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Median $/sqft</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  ${Number(metrics.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Current listings</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.current_listings}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Sales (12 mo)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.sales_12mo}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Inventory (months)</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.inventory_months ?? '—'}</p>
              </div>
            </div>
          </section>

          {trendChartData.length > 0 && (
            <section aria-labelledby="trend-heading" className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 id="trend-heading" className="mb-4 text-lg font-semibold text-foreground">
                Monthly trend (last {NUM_MONTHS_TREND} months)
              </h2>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendChartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    accessibilityLayer
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis
                      dataKey="month_label"
                      tick={{ fontSize: 12 }}
                      stroke="#71717a"
                      aria-label="Month"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12 }}
                      stroke="#71717a"
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                      aria-label="Number of sales"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      stroke="#71717a"
                      tickFormatter={(v) => (v >= 1000 ? `$${v / 1000}k` : `$${v}`)}
                      aria-label="Median price (dollars)"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'median_price' ? [`$${Number(value).toLocaleString()}`, 'Median price'] : [value, 'Sales']
                      }
                      labelFormatter={(label) => label}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sold_count"
                      name="Sales"
                      stroke="#18181b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="median_price"
                      name="Median price"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {priceBandChartData.length > 0 && (
            <section aria-labelledby="bands-heading" className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 id="bands-heading" className="mb-4 text-lg font-semibold text-foreground">
                Price bands: sales vs current listings
              </h2>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={priceBandChartData}
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    accessibilityLayer
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis
                      dataKey="band"
                      tick={{ fontSize: 11 }}
                      stroke="#71717a"
                      angle={-45}
                      textAnchor="end"
                      height={72}
                      interval={0}
                      aria-label="Price band"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#71717a" aria-label="Count" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sales" name="Sales (period)" fill="#18181b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Current listings" name="Current listings" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}

      {!loading && !error && city && metrics === null && hasApplied === false && (
        <p className="text-muted-foreground">Type a location above, pick a result, then click Apply to load data.</p>
      )}
    </div>
  )
}

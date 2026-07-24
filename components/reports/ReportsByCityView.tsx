'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { marketVerdict } from '@/lib/market/classify'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
// Pure module on purpose: importing the DAL here would drag next/headers (via
// the supabase server client) into the client bundle and 500 the page.
import { RANGE_PERIODS, RANGE_PERIOD_LABELS, type CityRangeReport, type RangePeriod } from '@/lib/market/range-periods'

const RANGE_OPTIONS = RANGE_PERIODS.map((value) => ({ value, label: RANGE_PERIOD_LABELS[value] }))

/** §0: a null/zero figure renders as the em-dash placeholder, never a fabricated 0. */
function formatPrice(n: number | null): string {
  if (n == null || n === 0) return UNAVAILABLE
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * The single "unavailable" placeholder. CLAUDE.md bans the em-dash as prose
 * punctuation but sanctions it as the data placeholder for a figure the cache
 * does not carry — kept in ONE place so no renderer invents a 0 instead.
 */
const UNAVAILABLE = '—'

const fmtInt = (n: number | null): string =>
  n == null ? UNAVAILABLE : Math.round(n).toLocaleString('en-US')

const fmtDays = (n: number | null): string =>
  n == null || n <= 0 ? UNAVAILABLE : String(Math.round(n))

const fmtPpsf = (n: number | null): string =>
  n == null || n <= 0 ? UNAVAILABLE : `$${Math.round(n).toLocaleString('en-US')}`

type Props = {
  data: CityRangeReport
  selectedCities: string[]
  allCities: string[]
}

export default function ReportsByCityView({
  data,
  selectedCities,
  allCities,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildUrl = useCallback(
    (updates: { cities?: string[]; range?: RangePeriod }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (updates.cities !== undefined) {
        if (updates.cities.length === 0) params.delete('cities')
        else params.set('cities', updates.cities.join(','))
      }
      if (updates.range !== undefined) {
        params.set('range', updates.range)
      }
      const q = params.toString()
      return q ? `/housing-market/reports?${q}` : '/housing-market/reports'
    },
    [searchParams]
  )

  const removeCity = (city: string) => {
    const next = selectedCities.filter((c) => c !== city)
    router.push(buildUrl({ cities: next }))
  }

  const addCity = (city: string) => {
    if (selectedCities.includes(city)) return
    const next = [...selectedCities, city].sort((a, b) => a.localeCompare(b))
    router.push(buildUrl({ cities: next }))
  }

  const setRange = (value: string) => {
    if ((RANGE_PERIODS as readonly string[]).includes(value)) {
      router.push(buildUrl({ range: value as RangePeriod }))
    }
  }

  const availableToAdd = allCities.filter((c) => !selectedCities.includes(c))
  const { rows, period, periodLabel, periodStart, periodEnd } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Time range</span>
        <Select
          value={period}
          onValueChange={setRange}
        >
          <SelectTrigger className="w-[180px]" size="default">
            <SelectValue placeholder={periodLabel} />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Cities</span>
        {selectedCities.map((city) => (
          <Badge
            key={city}
            variant="secondary"
            className="gap-1 pr-1.5 py-1"
          >
            {city}
            <button
              type="button"
              onClick={() => removeCity(city)}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${city}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
            </button>
          </Badge>
        ))}
        {availableToAdd.length > 0 && (
          <Select value="" onValueChange={(v) => v && addCity(v)}>
            <SelectTrigger className="w-[160px]" size="sm">
              <SelectValue placeholder="+ Add city" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="border-b border-border/60 bg-muted/30">
          <CardTitle className="text-base font-semibold">
            Housing market metrics
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {periodLabel}
            {periodStart && periodEnd ? ` · ${periodStart} to ${periodEnd}` : ''}. Single-family. Sold,
            median price, days on market, and price per square foot cover the selected window. Active
            listings and months of supply are live.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No data for the selected cities and period. Try adding more cities or a different time range.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">City</TableHead>
                  <TableHead className="text-right font-semibold">Sold</TableHead>
                  <TableHead className="text-right font-semibold">Median price</TableHead>
                  <TableHead className="text-right font-semibold">Median DOM</TableHead>
                  <TableHead className="text-right font-semibold">$/sq ft</TableHead>
                  <TableHead className="text-right font-semibold">Active listings</TableHead>
                  <TableHead className="text-right font-semibold">Sales (12 mo)</TableHead>
                  <TableHead className="text-right font-semibold">Months of supply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.city} className="border-border/60">
                    <TableCell className="font-medium">{r.city}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.soldCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(r.medianSalePrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDays(r.medianDom)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPpsf(r.medianPricePerSqft)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.activeCount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.sales12mo)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.monthsOfSupply != null ? (
                        <>
                          {r.monthsOfSupply.toFixed(1)}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {marketVerdict(r.monthsOfSupply).label}
                          </span>
                        </>
                      ) : (
                        UNAVAILABLE
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

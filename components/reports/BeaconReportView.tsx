'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type { BeaconReportData } from '@/app/actions/beacon-report'

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
] as const

function formatPrice(n: number): string {
  if (n === 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

type Props = {
  data: BeaconReportData
  selectedCities: string[]
  allCities: string[]
  rangeDays: number
}

export default function BeaconReportView({
  data,
  selectedCities,
  allCities,
  rangeDays,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buildUrl = useCallback(
    (updates: { cities?: string[]; range?: number }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (updates.cities !== undefined) {
        if (updates.cities.length === 0) params.delete('cities')
        else params.set('cities', updates.cities.join(','))
      }
      if (updates.range !== undefined) {
        params.set('range', String(updates.range))
      }
      const q = params.toString()
      return q ? `/reports?${q}` : '/reports'
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
    const days = parseInt(value, 10)
    if (Number.isFinite(days) && days > 0) router.push(buildUrl({ range: days }))
  }

  const availableToAdd = allCities.filter((c) => !selectedCities.includes(c))
  const { metricsByCity, periodStart, periodEnd } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Time range</span>
        <Select
          value={String(rangeDays)}
          onValueChange={setRange}
        >
          <SelectTrigger className="w-[180px]" size="default">
            <SelectValue placeholder="Last 7 days" />
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
            Beacon metrics
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {periodStart} – {periodEnd}. Real-time data from MLS.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {metricsByCity.length === 0 ? (
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
                  <TableHead className="text-right font-semibold">Inventory (mo)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricsByCity.map(({ city, metrics }) => (
                  <TableRow key={city} className="border-border/60">
                    <TableCell className="font-medium">{city}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.sold_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPrice(metrics.median_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.median_dom != null && metrics.median_dom > 0 ? Math.round(metrics.median_dom) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.median_ppsf != null && metrics.median_ppsf > 0 ? `$${Math.round(metrics.median_ppsf)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.current_listings}</TableCell>
                    <TableCell className="text-right tabular-nums">{metrics.sales_12mo}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {metrics.inventory_months != null ? String(metrics.inventory_months) : '—'}
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

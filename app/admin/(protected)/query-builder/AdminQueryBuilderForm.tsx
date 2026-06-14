'use client'

import { useState } from 'react'
import { runQueryBuilderSearch } from '@/app/actions/query-builder'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const MAX_ROWS = 500
const PREVIEW_ROWS = 6

function toCsv(listings: ListingTileRow[]): string {
  const headers = ['ListingKey', 'ListNumber', 'ListPrice', 'StreetNumber', 'StreetName', 'City', 'State', 'PostalCode', 'SubdivisionName', 'BedroomsTotal', 'BathroomsTotal', 'PropertyType', 'StandardStatus']
  const rows = listings.map((r) =>
    headers.map((h) => {
      const v = (r as Record<string, unknown>)[h]
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

function downloadCsv(listings: ListingTileRow[], filename: string) {
  const csv = toCsv(listings)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function rowAddress(row: ListingTileRow): string {
  return [row.StreetNumber, row.StreetName].filter(Boolean).join(' ') || '—'
}

function rowKey(row: ListingTileRow): string {
  return (row.ListingKey ?? row.ListNumber ?? '').toString()
}

function rowHref(row: ListingTileRow): string {
  return listingDetailPath(
    rowKey(row),
    { streetNumber: row.StreetNumber ?? null, streetName: row.StreetName ?? null, city: row.City ?? null, state: row.State ?? null, postalCode: row.PostalCode ?? null },
    { city: row.City ?? null, subdivision: row.SubdivisionName ?? null }
  )
}

function formatPrice(p: ListingTileRow['ListPrice']): string {
  return p != null ? `$${Number(p).toLocaleString()}` : '—'
}

export default function AdminQueryBuilderForm() {
  const [city, setCity] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [beds, setBeds] = useState('')
  const [baths, setBaths] = useState('')
  const [hasPool, setHasPool] = useState(false)
  const [hasView, setHasView] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ listings: ListingTileRow[]; totalCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await runQueryBuilderSearch({
        city: city.trim() || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        minBeds: beds ? Number(beds) : undefined,
        minBaths: baths ? Number(baths) : undefined,
        hasPool: hasPool || undefined,
        hasView: hasView || undefined,
        limit: MAX_ROWS,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const preview = result?.listings.slice(0, PREVIEW_ROWS) ?? []
  const remaining = result ? Math.max(0, result.listings.length - PREVIEW_ROWS) : 0

  return (
    <div className="space-y-5">
      {/* Filter card */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="qb-city">City</Label>
                <Input
                  id="qb-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bend"
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qb-min-price">Min price</Label>
                <Input
                  id="qb-min-price"
                  type="number"
                  inputMode="numeric"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Optional"
                  className="h-11 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qb-max-price">Max price</Label>
                <Input
                  id="qb-max-price"
                  type="number"
                  inputMode="numeric"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Optional"
                  className="h-11 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qb-beds">Min beds</Label>
                <Input
                  id="qb-beds"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="Any"
                  className="h-11 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qb-baths">Min baths</Label>
                <Input
                  id="qb-baths"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  placeholder="Any"
                  className="h-11 tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Label htmlFor="qb-pool" className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <Checkbox
                  id="qb-pool"
                  checked={hasPool}
                  onCheckedChange={(v) => setHasPool(v === true)}
                />
                <span className="text-sm text-foreground">Pool</span>
              </Label>
              <Label htmlFor="qb-view" className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <Checkbox
                  id="qb-view"
                  checked={hasView}
                  onCheckedChange={(v) => setHasView(v === true)}
                />
                <span className="text-sm text-foreground">View</span>
              </Label>
            </div>

            <Button type="submit" disabled={loading} className="h-11 w-full sm:w-auto">
              {loading ? 'Running query…' : 'Run query'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-destructive">Query failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: PREVIEW_ROWS }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty result state */}
      {!loading && result && result.listings.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <p className="text-base font-medium text-foreground">No listings matched</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing fits these filters. Widen the price range, lower the bed or bath minimums, or clear the amenity toggles, then run the query again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!loading && result && result.listings.length > 0 && (
        <div className="space-y-4">
          {/* Glanceable summary + export */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{result.listings.length}</span>
              {' '}of{' '}
              <span className="tabular-nums">{result.totalCount}</span>
              {' '}matching listings
              {result.totalCount > MAX_ROWS ? <span className="text-xs"> (capped at {MAX_ROWS})</span> : null}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => downloadCsv(result.listings, `query-builder-${Date.now()}.csv`)}
            >
              Download CSV
            </Button>
          </div>

          {/* Mobile: stacked result cards */}
          <ul className="space-y-3 md:hidden">
            {preview.map((row) => (
              <li key={rowKey(row)}>
                <Card size="sm">
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{rowAddress(row)}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {formatPrice(row.ListPrice)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{row.City ?? '—'}</span>
                      <span className="tabular-nums">{row.BedroomsTotal ?? '—'} bd</span>
                      <span className="tabular-nums">{row.BathroomsTotal ?? '—'} ba</span>
                    </div>
                    <a
                      href={rowHref(row)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      View listing →
                    </a>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-foreground">Address</TableHead>
                  <TableHead className="text-foreground">City</TableHead>
                  <TableHead className="text-foreground">Price</TableHead>
                  <TableHead className="text-foreground">Beds</TableHead>
                  <TableHead className="text-foreground">Baths</TableHead>
                  <TableHead className="text-foreground">Listing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row) => (
                  <TableRow key={rowKey(row)}>
                    <TableCell className="font-medium text-foreground">{rowAddress(row)}</TableCell>
                    <TableCell className="text-muted-foreground">{row.City ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-foreground">{formatPrice(row.ListPrice)}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.BedroomsTotal ?? '—'}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{row.BathroomsTotal ?? '—'}</TableCell>
                    <TableCell>
                      <a
                        href={rowHref(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        View →
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing the first {PREVIEW_ROWS} of {result.listings.length}. Download the CSV for the full set.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { runQueryBuilderSearch } from '@/app/actions/query-builder'
import type { ListingTileRow } from '@/app/actions/listings'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MAX_ROWS = 500

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

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">City</span>
          <Input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bend"
            className="rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Min price</span>
          <Input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Optional"
            className="w-28 rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Max price</span>
          <Input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Optional"
            className="w-28 rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Min beds</span>
          <Input
            type="number"
            min={0}
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="w-20 rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">Min baths</span>
          <Input
            type="number"
            min={0}
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            className="w-20 rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Label className="flex items-center gap-2">
          <Input type="checkbox" checked={hasPool} onChange={(e) => setHasPool(e.target.checked)} className="rounded" />
          <span className="text-sm text-muted-foreground">Pool</span>
        </Label>
        <Label className="flex items-center gap-2">
          <Input type="checkbox" checked={hasView} onChange={(e) => setHasView(e.target.checked)} className="rounded" />
          <span className="text-sm text-muted-foreground">View</span>
        </Label>
        <Button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Run query'}
        </Button>
      </form>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            Showing {result.listings.length} of {result.totalCount} (max {MAX_ROWS}).{' '}
            <Button
              type="button"
              onClick={() => downloadCsv(result.listings, `query-builder-${Date.now()}.csv`)}
              className="font-medium text-foreground underline hover:no-underline"
            >
              Download CSV
            </Button>
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-full text-left text-sm">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted">
                  <TableHead className="px-4 py-2 font-medium text-foreground">Address</TableHead>
                  <TableHead className="px-4 py-2 font-medium text-foreground">City</TableHead>
                  <TableHead className="px-4 py-2 font-medium text-foreground">Price</TableHead>
                  <TableHead className="px-4 py-2 font-medium text-foreground">Beds</TableHead>
                  <TableHead className="px-4 py-2 font-medium text-foreground">Baths</TableHead>
                  <TableHead className="px-4 py-2 font-medium text-foreground">Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.listings.slice(0, 50).map((row) => {
                  const key = (row.ListingKey ?? row.ListNumber ?? '').toString()
                  const addr = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
                  return (
                    <TableRow key={key} className="border-b border-border">
                      <TableCell className="px-4 py-2">{addr || '—'}</TableCell>
                      <TableCell className="px-4 py-2">{row.City ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">{row.ListPrice != null ? `$${Number(row.ListPrice).toLocaleString()}` : '—'}</TableCell>
                      <TableCell className="px-4 py-2">{row.BedroomsTotal ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">{row.BathroomsTotal ?? '—'}</TableCell>
                      <TableCell className="px-4 py-2">
                        <a href={`/listing/${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline hover:no-underline">
                          {key}
                        </a>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {result.listings.length > 50 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">Showing first 50 rows. Use Download CSV for full set.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

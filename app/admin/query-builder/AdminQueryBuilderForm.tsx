'use client'

import { useState } from 'react'
import { runQueryBuilderSearch } from '@/app/actions/query-builder'
import type { ListingTileRow } from '@/app/actions/listings'

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
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">City</span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bend"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Min price</span>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Optional"
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Max price</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Optional"
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Min beds</span>
          <input
            type="number"
            min={0}
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="w-20 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Min baths</span>
          <input
            type="number"
            min={0}
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            className="w-20 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hasPool} onChange={(e) => setHasPool(e.target.checked)} className="rounded" />
          <span className="text-sm text-zinc-700">Pool</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hasView} onChange={(e) => setHasView(e.target.checked)} className="rounded" />
          <span className="text-sm text-zinc-700">View</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Running…' : 'Run query'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-6">
          <p className="text-sm text-zinc-600">
            Showing {result.listings.length} of {result.totalCount} (max {MAX_ROWS}).{' '}
            <button
              type="button"
              onClick={() => downloadCsv(result.listings, `query-builder-${Date.now()}.csv`)}
              className="font-medium text-zinc-900 underline hover:no-underline"
            >
              Download CSV
            </button>
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-2 font-medium text-zinc-900">Address</th>
                  <th className="px-4 py-2 font-medium text-zinc-900">City</th>
                  <th className="px-4 py-2 font-medium text-zinc-900">Price</th>
                  <th className="px-4 py-2 font-medium text-zinc-900">Beds</th>
                  <th className="px-4 py-2 font-medium text-zinc-900">Baths</th>
                  <th className="px-4 py-2 font-medium text-zinc-900">Key</th>
                </tr>
              </thead>
              <tbody>
                {result.listings.slice(0, 50).map((row) => {
                  const key = (row.ListingKey ?? row.ListNumber ?? '').toString()
                  const addr = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
                  return (
                    <tr key={key} className="border-b border-zinc-100">
                      <td className="px-4 py-2">{addr || '—'}</td>
                      <td className="px-4 py-2">{row.City ?? '—'}</td>
                      <td className="px-4 py-2">{row.ListPrice != null ? `$${Number(row.ListPrice).toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-2">{row.BedroomsTotal ?? '—'}</td>
                      <td className="px-4 py-2">{row.BathroomsTotal ?? '—'}</td>
                      <td className="px-4 py-2">
                        <a href={`/listing/${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer" className="text-zinc-700 underline hover:no-underline">
                          {key}
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {result.listings.length > 50 && (
              <p className="px-4 py-2 text-xs text-zinc-500">Showing first 50 rows. Use Download CSV for full set.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

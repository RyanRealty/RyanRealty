'use client'

/**
 * ListingsCsvExport — the advanced query + CSV export panel inside the
 * listings browser (was the standalone /admin/query-builder page until the
 * admin consolidation 2026-07-07; that route now redirects here). Filter
 * active listings by city, price, beds, baths, and amenities, preview the
 * matches, and download up to 500 rows as CSV.
 *
 * 11F admin-v2: migrated to the LOCKED admin language
 * (design_system/admin/ADMIN_UI.md). The shadcn Card/Collapsible/Table/Input/
 * Label/Checkbox/Button/Skeleton are gone, and so is every shadcn semantic
 * color class — those resolve to the PUBLIC brand palette the admin's amnesia
 * blacklists, so swapping only the imports would have left the panel wearing
 * the marketing site's colors. Color and type now come from var(--a-*).
 *
 * The disclosure is React state plus a v2 <Button> rather than Radix
 * Collapsible. That is also a fix: Collapsible's `asChild` put the trigger
 * props on a <div>, which no keyboard could reach. The header still toggles on
 * click, still carries the same title and the same description sentence, and
 * now carries aria-expanded/aria-controls on a real button.
 *
 * `id="qb-city"` is a GATE HANDLE, not decoration:
 * scripts/_phase2-consolidation-verify.mjs fills `#qb-city` to prove this panel
 * still queries after the consolidation. It stays on the input.
 *
 * The desktop table is <ReportGrid>, the admin's one tabular reader, with an
 * av2-cardlist phone fallback carrying the same fields — the card list owns its
 * breakpoint in the CLASS, never `md:hidden` plus an inline display.
 *
 * Behavior is untouched: same server action, same arguments, same 500-row cap,
 * same CSV columns and filename, same strings.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { runQueryBuilderSearch } from '@/app/actions/query-builder'
import type { ListingTileRow } from '@/app/actions/listings'
import { listingDetailPath } from '@/lib/slug'
import { Button, ReportGrid, TextField, ToolbarCheck, type ReportColumn } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

const MAX_ROWS = 500
const PREVIEW_ROWS = 6

const COLUMNS: ReportColumn[] = [
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'beds', label: 'Beds', numeric: true },
  { key: 'baths', label: 'Baths', numeric: true },
  { key: 'listing', label: 'Listing' },
]

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

function downloadCsv(listings: ListingTileRow[]) {
  const csv = toCsv(listings)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // No clock read (#418): the browser auto-suffixes repeat downloads.
  a.download = 'listings-export.csv'
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

/** Tabular numerals as a STYLE, never a className: TextField spreads its rest
 *  props onto the input AFTER `className="av2-input"`, so a className prop
 *  replaces the token class instead of joining it. */
const NUM_INPUT = { fontVariantNumeric: 'tabular-nums' } as const

export default function ListingsCsvExport() {
  const [open, setOpen] = useState(false)
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
    <div className="av2-pane" style={{ gap: 0 }}>
      <Button
        variant="quiet"
        aria-expanded={open}
        aria-controls="qb-panel"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          height: 'auto',
          padding: 12,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
            Advanced query and CSV export
          </span>
          <span
            style={{
              fontSize: 'var(--a-text-sm)',
              fontWeight: 400,
              color: 'var(--a-text-2)',
              whiteSpace: 'normal',
            }}
          >
            Filter active listings by city, price, beds, baths, and amenities. Results cap at {MAX_ROWS} rows. Export the full set to CSV.
          </span>
        </span>
        <ChevronDown
          className="h-5 w-5 shrink-0"
          aria-hidden
          style={{
            color: 'var(--a-text-2)',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform var(--a-t-med)',
          }}
        />
      </Button>

      {open ? (
        <div id="qb-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 0 0' }}>
          {/* Filters */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="av2-editgrid">
              {/* id + aria-label together on purpose. TextField spreads rest
                  onto the input AFTER its own id, so a passed id replaces the
                  generated one and FieldShell's htmlFor no longer resolves —
                  the aria-label keeps the accessible name that association
                  used to supply. The id itself is not optional: see the gate
                  handle note in the file header. */}
              <TextField
                label="City"
                id="qb-city"
                aria-label="City"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bend"
              />
              <TextField
                label="Min price"
                type="number"
                inputMode="numeric"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Optional"
                style={NUM_INPUT}
              />
              <TextField
                label="Max price"
                type="number"
                inputMode="numeric"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Optional"
                style={NUM_INPUT}
              />
              <TextField
                label="Min beds"
                type="number"
                inputMode="numeric"
                min={0}
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                placeholder="Any"
                style={NUM_INPUT}
              />
              <TextField
                label="Min baths"
                type="number"
                inputMode="numeric"
                min={0}
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                placeholder="Any"
                style={NUM_INPUT}
              />
            </div>

            <div className="av2-wordrow" style={{ gap: '12px 24px' }}>
              <ToolbarCheck
                label="Pool"
                labelStyle={{ minHeight: 44 }}
                checked={hasPool}
                onChange={(e) => setHasPool(e.target.checked)}
              />
              <ToolbarCheck
                label="View"
                labelStyle={{ minHeight: 44 }}
                checked={hasView}
                onChange={(e) => setHasView(e.target.checked)}
              />
            </div>

            <div>
              <Button type="submit" touch disabled={loading} className="w-full sm:w-auto">
                {loading ? 'Running query…' : 'Run query'}
              </Button>
            </div>
          </form>

          {/* Error state */}
          {error && (
            <div className="av2-pane" style={{ gap: 4, borderColor: 'var(--a-danger)' }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>
                Query failed
              </p>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="av2-pane">
              <div className="av2-rskel" aria-hidden="true">
                <div className="av2-rskel__row" style={{ width: '40%' }} />
                {Array.from({ length: PREVIEW_ROWS }).map((_, i) => (
                  <div key={i} className="av2-rskel__row" />
                ))}
              </div>
            </div>
          )}

          {/* Empty result state */}
          {!loading && result && result.listings.length === 0 && (
            <div
              className="av2-pane"
              style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: '56px 24px' }}
            >
              <p style={{ margin: 0, fontSize: 'var(--a-text-lg)', fontWeight: 500, color: 'var(--a-text)' }}>
                No listings matched
              </p>
              <p
                style={{
                  margin: 0,
                  maxWidth: 384,
                  fontSize: 'var(--a-text-sm)',
                  color: 'var(--a-text-2)',
                }}
              >
                Nothing fits these filters. Widen the price range, lower the bed or bath minimums, or clear the amenity toggles, then run the query again.
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && result && result.listings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Glanceable summary + export */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  <span className="a-num" style={{ fontWeight: 600, color: 'var(--a-text)' }}>
                    {result.listings.length}
                  </span>
                  {' '}of{' '}
                  <span className="a-num">{result.totalCount}</span>
                  {' '}matching listings
                  {result.totalCount > MAX_ROWS ? (
                    <span style={{ fontSize: 'var(--a-text-xs)' }}> (capped at {MAX_ROWS})</span>
                  ) : null}
                </p>
                <Button
                  variant="quiet"
                  touch
                  className="w-full sm:w-auto"
                  onClick={() => downloadCsv(result.listings)}
                >
                  Download CSV
                </Button>
              </div>

              {/* Phone card list — the layout lives in av2-cardlist, never md:hidden
                  plus an inline display (an inline style outranks the class and
                  leaves BOTH layouts on screen at desktop). */}
              <div className="av2-cardlist">
                {preview.map((row) => (
                  <div key={rowKey(row)} className="av2-pane" style={{ gap: 6, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
                        {rowAddress(row)}
                      </span>
                      <span
                        className="a-num"
                        style={{ flexShrink: 0, fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}
                      >
                        {formatPrice(row.ListPrice)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 'var(--a-text-xs)',
                        color: 'var(--a-text-2)',
                      }}
                    >
                      <span>{row.City ?? '—'}</span>
                      <span className="a-num">{row.BedroomsTotal ?? '—'} bd</span>
                      <span className="a-num">{row.BathroomsTotal ?? '—'} ba</span>
                    </div>
                    <a
                      href={rowHref(row)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="av2-textlink"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 44,
                        fontSize: 'var(--a-text-sm)',
                        textDecoration: 'none',
                      }}
                    >
                      View listing →
                    </a>
                  </div>
                ))}
              </div>

              {/* Desktop grid — hidden below md; the phone card list above takes over */}
              <div className="hidden md:block">
                <ReportGrid
                  label="Query results"
                  columns={COLUMNS}
                  template="minmax(180px, 2fr) minmax(110px, 1fr) minmax(110px, 0.9fr) 72px 72px 96px"
                  minWidth={760}
                  rows={preview.map((row) => ({
                    key: rowKey(row),
                    cells: [
                      <span key="address" style={{ fontWeight: 500, color: 'var(--a-text)' }}>
                        {rowAddress(row)}
                      </span>,
                      <span key="city" style={{ color: 'var(--a-text-2)' }}>
                        {row.City ?? '—'}
                      </span>,
                      <span key="price" style={{ color: 'var(--a-text)' }}>
                        {formatPrice(row.ListPrice)}
                      </span>,
                      <span key="beds" style={{ color: 'var(--a-text-2)' }}>
                        {row.BedroomsTotal ?? '—'}
                      </span>,
                      <span key="baths" style={{ color: 'var(--a-text-2)' }}>
                        {row.BathroomsTotal ?? '—'}
                      </span>,
                      <a
                        key="listing"
                        href={rowHref(row)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="av2-textlink"
                        style={{ textDecoration: 'none' }}
                      >
                        View →
                      </a>,
                    ],
                  }))}
                  empty="No listings matched this query."
                />
              </div>

              {remaining > 0 && (
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Showing the first {PREVIEW_ROWS} of {result.listings.length}. Download the CSV for the full set.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

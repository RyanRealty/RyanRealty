import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAdminListingsPage, searchAdminRemarksPage } from '@/app/actions/admin-listings'
import { HugeiconsIcon } from '@hugeicons/react'
import { Home01Icon, SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ListingsCsvExport from './ListingsCsvExport'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export const metadata: Metadata = {
  title: 'Listings',
  description: 'Manage listings in the admin.',
}

export const dynamic = 'force-dynamic'

type SearchParams = { page?: string; search?: string; status?: string; remarks?: string }

const STATUS_FILTERS = ['Active', 'Pending', 'Closed'] as const

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function daysOnMarket(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  const d = new Date(onMarketDate)
  if (Number.isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

function statusBadgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'outline' {
  if (status === 'Active') return 'default'
  if (status === 'Pending') return 'secondary'
  return 'outline'
}

// Build a query string for the status facet links, preserving the active search
// term and resetting paging to page 0 on every filter change.
function statusHref(status: string | null, search: string | undefined): string {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  const qs = params.toString()
  return qs ? `/admin/listings?${qs}` : '/admin/listings'
}

function pageHref(page: number, search: string | undefined, status: string | undefined): string {
  const params = new URLSearchParams()
  if (page > 0) params.set('page', String(page))
  if (search) params.set('search', search)
  if (status && status !== 'all') params.set('status', status)
  const qs = params.toString()
  return qs ? `/admin/listings?${qs}` : '/admin/listings'
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { page, search, status, remarks } = await searchParams
  const pageNum = Math.max(0, parseInt(String(page), 10) || 0)
  const pageSize = 50
  const activeStatus = status && status !== 'all' ? status : undefined
  // remarks=1: keyword search across public AND private remarks (on-market
  // rows, admin-only service-role read path). Status facets do not apply —
  // the remarks index covers on-market inventory.
  const remarksMode = remarks === '1' && Boolean(search?.trim())
  const { rows, total } = remarksMode
    ? await searchAdminRemarksPage(search!.trim(), pageNum, pageSize)
    : await getAdminListingsPage(pageNum, pageSize, search?.trim() || undefined, activeStatus)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : pageNum * pageSize + 1
  const rangeEnd = pageNum * pageSize + rows.length
  const hasFilters = Boolean(search?.trim() || activeStatus)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Listings</h1>
          <p className="text-sm text-muted-foreground">
            Browse the full statewide feed by address, MLS number, or listing key. Tap any listing for the full record.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/sync">Sync status</Link>
        </Button>
      </header>

      {/* Glanceable summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {hasFilters ? 'Matching' : 'Total'} listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{activeStatus ?? 'all statuses'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatInt(rows.length)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {total === 0 ? 'no rows' : `${formatInt(rangeStart)}–${formatInt(rangeEnd)} of ${formatInt(total)}`}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Page</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{pageNum + 1}</p>
            <p className="mt-1 text-xs text-muted-foreground">of {formatInt(totalPages)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + status facets */}
      <Card>
        <CardHeader>
          <CardTitle>Find a listing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex flex-wrap items-end gap-2">
            {activeStatus ? <input type="hidden" name="status" value={activeStatus} readOnly /> : null}
            <div className="w-full sm:flex-1">
              <Label htmlFor="search" className="text-xs font-medium text-muted-foreground">
                Address, MLS number, or listing key
              </Label>
              <Input
                id="search"
                type="search"
                name="search"
                defaultValue={search}
                placeholder="123 Main St, 220189422…"
                className="h-11"
              />
            </div>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-foreground">
              <Input type="checkbox" name="remarks" value="1" defaultChecked={remarksMode} className="size-4" />
              Search remarks (public + private)
            </label>
            <Button type="submit" className="h-11">
              Search
            </Button>
            {hasFilters ? (
              <Button asChild variant="outline" className="h-11">
                <Link href="/admin/listings">Clear all</Link>
              </Button>
            ) : null}
          </form>

          {remarksMode ? (
            <p className="text-xs text-muted-foreground">
              Matching listing remarks, including private agent remarks. Private remarks stay on this admin surface and never render publicly. On-market listings only.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-medium text-muted-foreground">Status</span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={statusHref(null, search)}
                aria-current={!activeStatus ? 'true' : undefined}
                className={
                  !activeStatus
                    ? 'inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground'
                    : 'inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground transition-colors hover:bg-muted'
                }
              >
                All
              </Link>
              {STATUS_FILTERS.map((s) => {
                const active = activeStatus === s
                return (
                  <Link
                    key={s}
                    href={statusHref(s, search)}
                    aria-current={active ? 'true' : undefined}
                    className={
                      active
                        ? 'inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground'
                        : 'inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground transition-colors hover:bg-muted'
                    }
                  >
                    {s}
                  </Link>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Listings ({formatInt(total)})</CardTitle>
          <p className="text-xs text-muted-foreground">Newest first. Tap any listing for the full record.</p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <HugeiconsIcon icon={hasFilters ? SearchRemoveIcon : Home01Icon} size={24} strokeWidth={1.5} />
              </span>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  {hasFilters ? 'No listings match these filters' : 'No listings in the feed'}
                </p>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                  {hasFilters
                    ? 'Try a different address or status, or clear the filters to widen the results.'
                    : 'No listings are available right now. Check the feed status to confirm sync is running.'}
                </p>
              </div>
              {hasFilters ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/admin/listings">Clear all filters</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/admin/sync">View sync status</Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Listing cards — phones (one thumb-tap per listing) */}
              <div className="space-y-2 md:hidden">
                {rows.map((row) => {
                  const key = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
                  const address =
                    [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim() || row.City || key
                  const dom = daysOnMarket(row.OnMarketDate)
                  return (
                    <Link
                      key={key}
                      href={`/admin/listings/${encodeURIComponent(key)}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                        {row.PhotoURL ? (
                          <Image
                            src={row.PhotoURL}
                            alt={`${address} listing photo`}
                            width={80}
                            height={56}
                            className="h-14 w-20 object-cover"
                          />
                        ) : (
                          <span className="flex h-14 w-20 items-center justify-center text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{address}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatPrice(row.ListPrice)}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(row.StandardStatus)} className="capitalize">
                            {row.StandardStatus ?? '—'}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.BedroomsTotal ?? '—'} bd · {row.BathroomsTotal ?? '—'} ba
                          </span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{row.SubdivisionName ?? row.City ?? '—'}</span>
                          <span className="shrink-0 tabular-nums">{dom != null ? `${dom} days` : '—'}</span>
                        </span>
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* Listing table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="text-right tabular-nums">Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right tabular-nums">Beds/Baths</TableHead>
                      <TableHead>Community</TableHead>
                      <TableHead className="text-right tabular-nums">DOM</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const key = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
                      const address =
                        [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim() || row.City || key
                      const dom = daysOnMarket(row.OnMarketDate)
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Link
                              href={`/admin/listings/${encodeURIComponent(key)}`}
                              className="block h-12 w-16 overflow-hidden rounded bg-muted"
                            >
                              {row.PhotoURL ? (
                                <Image
                                  src={row.PhotoURL}
                                  alt={`${address} listing photo`}
                                  width={64}
                                  height={48}
                                  className="h-12 w-16 object-cover"
                                />
                              ) : (
                                <span className="flex h-12 w-16 items-center justify-center text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/listings/${encodeURIComponent(key)}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {address}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatPrice(row.ListPrice)}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(row.StandardStatus)} className="capitalize">
                              {row.StandardStatus ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.BedroomsTotal ?? '—'} / {row.BathroomsTotal ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs">{row.SubdivisionName ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{dom != null ? dom : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {row.ModificationTimestamp
                              ? new Date(row.ModificationTimestamp).toLocaleDateString()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 ? (
                <Pagination className="mt-4 justify-between">
                  <PaginationContent className="w-full justify-between">
                    <PaginationItem>
                      {pageNum > 0 ? (
                        <PaginationPrevious href={pageHref(pageNum - 1, search, activeStatus)} />
                      ) : (
                        <span aria-hidden className="inline-block h-9 w-20" />
                      )}
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-sm text-muted-foreground tabular-nums">
                        Page {pageNum + 1} of {formatInt(totalPages)}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      {pageNum < totalPages - 1 ? (
                        <PaginationNext href={pageHref(pageNum + 1, search, activeStatus)} />
                      ) : (
                        <span aria-hidden className="inline-block h-9 w-20" />
                      )}
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Advanced query + CSV export (merged from /admin/query-builder, 2026-07-07) */}
      <ListingsCsvExport />
    </div>
  )
}

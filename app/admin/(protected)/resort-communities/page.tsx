import { Suspense } from 'react'
import Link from 'next/link'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import ResortCommunityToggle from './ResortCommunityToggle'
import SeedResortButton from './SeedResortButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

// Build a query string that preserves the current filters, optionally
// overriding one key. Used for the resort/all filter chips + pagination.
function buildQuery(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const next = { ...current, ...overrides }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function ResortCommunitiesContent({
  params,
}: {
  params: Record<string, string | undefined>
}) {
  const rows = await listSubdivisionsWithFlags()

  const total = rows.length
  const flagged = rows.filter((r) => r.is_resort).length
  const cities = new Set(rows.map((r) => r.city)).size

  // Filters (presentation-only — slicing what we render, not the data fetch).
  const q = (params.q ?? '').trim().toLowerCase()
  const view = params.view === 'resort' ? 'resort' : 'all'
  let filtered = rows
  if (view === 'resort') filtered = filtered.filter((r) => r.is_resort)
  if (q) {
    filtered = filtered.filter(
      (r) =>
        r.city.toLowerCase().includes(q) ||
        r.subdivision.toLowerCase().includes(q),
    )
  }

  // Pagination — never dump the full list into the DOM.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRaw = Number.parseInt(params.page ?? '1', 10)
  const page = Number.isFinite(pageRaw) ? Math.min(Math.max(1, pageRaw), pageCount) : 1
  const start = (page - 1) * PAGE_SIZE
  const pageRows = filtered.slice(start, start + PAGE_SIZE)

  const hasFilters = Boolean(q) || view === 'resort'

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Glanceable summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Subdivisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
              {formatInt(total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">total known</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Flagged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-success sm:text-3xl">
              {formatInt(flagged)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">resort &amp; master plan</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
              {formatInt(cities)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">covered</p>
          </CardContent>
        </Card>
      </div>

      {/* Seed action */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Copy the built-in Oregon resort &amp; master plan list into the database so you can edit it here.
          </p>
          <SeedResortButton />
        </CardContent>
      </Card>

      {/* Search + filter */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            {view === 'resort' && <input type="hidden" name="view" value="resort" />}
            <div className="min-w-0 flex-1">
              <Label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Search city or subdivision
              </Label>
              <Input
                id="q"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Sunriver, Tetherow…"
                className="mt-1 h-11"
              />
            </div>
            <Button type="submit" className="h-11">
              Search
            </Button>
            {hasFilters && (
              <Button asChild variant="outline" className="h-11">
                <Link href="/admin/resort-communities">Clear</Link>
              </Button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Show</span>
            <Button
              asChild
              size="sm"
              variant={view === 'all' ? 'default' : 'outline'}
            >
              <Link href={`/admin/resort-communities${buildQuery(params, { view: undefined, page: undefined })}`}>
                All
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={view === 'resort' ? 'default' : 'outline'}
            >
              <Link href={`/admin/resort-communities${buildQuery(params, { view: 'resort', page: undefined })}`}>
                Resort &amp; master plan
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {view === 'resort' ? 'Resort & master plan' : 'Subdivisions'} ({formatInt(filtered.length)})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Toggle a community on to show the full amenities &amp; lifestyle section and resort schema on its page. Changes save automatically. Built-in Oregon resort communities stay on until you turn them off.
          </p>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No subdivisions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync listings first so city and subdivision pairs appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No matches</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No subdivisions match your search or filter.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/admin/resort-communities">Clear filters</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Phones — one card per subdivision, full-width toggle row */}
              <div className="space-y-2 md:hidden">
                {pageRows.map((r) => (
                  <div
                    key={r.entity_key}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.subdivision}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {r.city}
                        </p>
                      </div>
                      {r.is_resort && (
                        <Badge variant="success" className="shrink-0">
                          Resort
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      <ResortCommunityToggle
                        entityKey={r.entity_key}
                        initialResort={r.is_resort}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop — table */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subdivision</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Resort &amp; master plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r.entity_key}>
                        <TableCell className="font-medium text-foreground">
                          {r.subdivision}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {r.city}
                        </TableCell>
                        <TableCell>
                          <ResortCommunityToggle
                            entityKey={r.entity_key}
                            initialResort={r.is_resort}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  Showing {formatInt(start + 1)}&ndash;{formatInt(start + pageRows.length)} of{' '}
                  {formatInt(filtered.length)}
                </p>
                {pageCount > 1 && (
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/resort-communities${buildQuery(params, { page: String(page - 1) })}`}>
                          Previous
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        Previous
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Page {page} of {pageCount}
                    </span>
                    {page < pageCount ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/resort-communities${buildQuery(params, { page: String(page + 1) })}`}>
                          Next
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        Next
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminResortCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const params = normalizeParams(sp)

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="space-y-2">
        <div className="text-xs text-muted-foreground">
          <Link href="/admin" className="hover:underline">
            ← Admin
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Resort &amp; master plan communities</h1>
        <p className="text-sm text-muted-foreground">
          Flag subdivisions as resort or master plan communities. Flagged communities show the full amenities &amp; lifestyle section and resort schema on their page. Unflagged subdivisions use the standard community page.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ResortCommunitiesContent params={params} />
      </Suspense>
    </div>
  )
}

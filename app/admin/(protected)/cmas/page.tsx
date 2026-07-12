/**
 * /admin/cmas — index of every Comparative Market Analysis the shop has built.
 *
 * Filters via URL search params (each is a single tap in the facets card):
 *   ?status=draft|finalized|delivered|archived
 *   ?q=<address / client / subdivision substring>
 *   ?page=<n>
 *
 * The data pipeline (listCmasForAdmin) is untouched. Status filtering, search,
 * and pagination are pure presentational slicing in the page so the screen
 * never renders an unbounded wall of rows (admin design standard, Law 1).
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Files01Icon, SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export const dynamic = 'force-dynamic'

// How many CMAs we show per page. Presentational cap so the screen never
// renders an unbounded wall of rows (admin design standard, Law 1).
const PAGE_SIZE = 20

// Upper bound on the recent window we pull from the DAL. Wide enough to cover
// every CMA the shop has realistically produced, bounded so the page never
// fetches the whole table into the DOM.
const WINDOW = 500

const STATUS_OPTIONS = ['draft', 'finalized', 'delivered', 'archived'] as const

interface CmaRow {
  id: string
  slug: string
  subject_address: string
  subject_subdivision: string | null
  client_name: string | null
  client_email: string | null
  broker_slug: string | null
  value_low: number | null
  value_high: number | null
  recommended_list: number | null
  comps_count: number | null
  status: 'draft' | 'finalized' | 'delivered' | 'archived'
  created_at: string
  finalized_at: string | null
  built_at: string | null
  build_error: string | null
  html_path: string
  build_summary: { needs_review?: boolean; review_reason?: string | null } | null
}

/** A CMA whose comp set was too heterogeneous for the builder to trust — the
 *  broker must confirm comp selection before it goes to a client (§0). */
function needsReview(cma: CmaRow): boolean {
  return cma.build_summary?.needs_review === true
}

/** A CMA has an openable document when the builder stored HTML in the DB
 *  (html_path 'db:…') or a legacy finalized file ships under public/cmas/. */
function hasDocument(cma: CmaRow): boolean {
  return cma.html_path?.startsWith('db:') || cma.html_path?.startsWith('public/cmas/') || false
}

type SearchParams = Record<string, string | string[] | undefined>

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPrice(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusVariant(status: CmaRow['status']) {
  switch (status) {
    case 'finalized':
      return 'default' as const
    case 'delivered':
      return 'secondary' as const
    case 'archived':
      return 'outline' as const
    case 'draft':
    default:
      return 'outline' as const
  }
}

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

// Toggle a single facet on/off; changing a facet resets pagination to page 1.
function toggleParam(current: Record<string, string | undefined>, key: string, value: string): string {
  const next = { ...current }
  if (next[key] === value) delete next[key]
  else next[key] = value
  delete next.page
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// Pagination link — keeps every active filter, swaps the page number.
function pageHref(current: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (v && k !== 'page') params.set(k, v)
  }
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/admin/cmas${qs ? `?${qs}` : ''}`
}

// A compact window of page numbers around the current page (max 5), so the
// pagination control stays inside 390px without wrapping.
function pageWindow(current: number, total: number): number[] {
  const span = 5
  let start = Math.max(1, current - Math.floor(span / 2))
  const end = Math.min(total, start + span - 1)
  start = Math.max(1, end - span + 1)
  const out: number[] = []
  for (let p = start; p <= end; p++) out.push(p)
  return out
}

async function CmasContent({ params }: { params: Record<string, string | undefined> }) {
  const { listCmasForAdmin } = await import('@/lib/data')
  const { rows: rawRows, total } = await listCmasForAdmin({ limit: WINDOW, offset: 0 })
  const allRows = rawRows as unknown as CmaRow[]

  // Summary counts (across the full window, before status/search filtering).
  const counts = {
    total,
    draft: allRows.filter((r) => r.status === 'draft').length,
    finalized: allRows.filter((r) => r.status === 'finalized').length,
    delivered: allRows.filter((r) => r.status === 'delivered').length,
  }

  // Status facet + free-text search (presentational, DAL untouched).
  const q = (params.q ?? '').trim().toLowerCase()
  let rows = allRows
  if (params.status) rows = rows.filter((r) => r.status === params.status)
  if (q) {
    rows = rows.filter((r) =>
      [r.subject_address, r.subject_subdivision, r.client_name, r.client_email, r.broker_slug]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q)),
    )
  }

  const matchCount = rows.length
  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, parseInt(params.page ?? '1', 10) || 1), totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE)
  const filtersActive = Boolean(params.q || params.status)

  return (
    <div className="space-y-6">
      {/* Glanceable summary */}
      <KpiStrip items={[
        { label: 'Total CMAs', value: formatInt(counts.total) },
        { label: 'Drafts', value: formatInt(counts.draft) },
        { label: 'Finalized', value: formatInt(counts.finalized) },
        { label: 'Delivered', value: formatInt(counts.delivered) },
      ]} />

      {/* Search + status facets */}
      <ConsoleSection title="Filters">
        <div className="space-y-4">
          <form className="flex flex-wrap items-end gap-2" method="get">
            {Object.entries(params)
              .filter(([k]) => k !== 'q' && k !== 'page')
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => (
                <Input key={k} type="hidden" name={k} value={v!} readOnly />
              ))}
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Address, client, or subdivision
              </Label>
              <Input id="q" name="q" defaultValue={params.q ?? ''} placeholder="20889 SE Caldera Dr" />
            </div>
            <Button type="submit" className="min-h-11">Search</Button>
            {filtersActive ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/admin/cmas">Clear all</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const active = params.status === opt
                return (
                  <Button
                    key={opt}
                    asChild
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className="h-8 rounded-full px-3 text-xs capitalize"
                  >
                    <Link href={`/admin/cmas${toggleParam(params, 'status', opt)}`} aria-pressed={active}>
                      {opt}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </ConsoleSection>

      {/* CMA list */}
      <ConsoleSection title="CMAs" count={`(${formatInt(matchCount)})`}>
        <p className="mb-4 text-xs text-muted-foreground">
          {matchCount === 0
            ? 'Newest first. Tap Review to open a CMA.'
            : `Showing ${formatInt(pageStart + 1)}–${formatInt(pageStart + pageRows.length)}. Newest first. Tap Review to open a CMA.`}
        </p>
          {matchCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <HugeiconsIcon icon={filtersActive ? SearchRemoveIcon : Files01Icon} size={24} strokeWidth={1.5} />
              </span>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">
                  {filtersActive ? 'No CMAs match these filters' : 'No CMAs yet'}
                </p>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                  {filtersActive
                    ? 'Try a broader search or clear a filter to widen the results.'
                    : 'CMAs appear here once the brain producer builds one. Ask for a CMA on any property to get started.'}
                </p>
              </div>
              {filtersActive ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/admin/cmas">Clear all filters</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* CMA cards — phones (one thumb-tap per CMA) */}
              <div className="space-y-2 md:hidden">
                {pageRows.map((cma) => (
                  <div key={cma.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{cma.subject_address}</div>
                        {cma.subject_subdivision ? (
                          <div className="truncate text-xs text-muted-foreground">{cma.subject_subdivision}</div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={statusVariant(cma.status)} className="capitalize">
                          {cma.status}
                        </Badge>
                        {needsReview(cma) ? (
                          <Badge variant="destructive" title={cma.build_summary?.review_reason ?? undefined}>
                            Needs review
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Rec. list</span>
                      <span className="font-semibold tabular-nums text-foreground">{formatPrice(cma.recommended_list)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                      <span>Range</span>
                      <span className="tabular-nums">
                        {formatPrice(cma.value_low)} – {formatPrice(cma.value_high)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {cma.client_name ?? '—'}
                        {cma.broker_slug ? ` · ${cma.broker_slug}` : ''}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatDate(cma.created_at)}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" className="h-11 flex-1">
                        <Link href={`/admin/cmas/${cma.slug}`}>Review</Link>
                      </Button>
                      {hasDocument(cma) ? (
                        <Button asChild size="sm" variant="outline" className="h-11 flex-1">
                          <Link href={`/api/cma/${cma.slug}/pdf`} target="_blank" rel="noopener noreferrer">
                            PDF
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    {cma.build_error ? (
                      <div className="mt-2 text-xs text-destructive">Build failed. Open Review for detail.</div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* CMA table — desktop */}
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Broker</TableHead>
                      <TableHead className="text-right">Rec. List</TableHead>
                      <TableHead className="text-right">Range</TableHead>
                      <TableHead className="text-right">Comps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Finalized</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((cma) => (
                      <TableRow key={cma.id}>
                        <TableCell>
                          <div className="font-medium">{cma.subject_address}</div>
                          {cma.subject_subdivision ? (
                            <div className="text-xs text-muted-foreground">{cma.subject_subdivision}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{cma.client_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{cma.broker_slug ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPrice(cma.recommended_list)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatPrice(cma.value_low)} – {formatPrice(cma.value_high)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{cma.comps_count ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(cma.status)} className="capitalize">
                            {cma.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(cma.created_at)}</TableCell>
                        <TableCell className="text-sm">{formatDate(cma.finalized_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm">
                              <Link href={`/admin/cmas/${cma.slug}`}>Review</Link>
                            </Button>
                            {hasDocument(cma) ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/api/cma/${cma.slug}/pdf`} target="_blank" rel="noopener noreferrer">
                                  PDF
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 ? (
                <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href={pageHref(params, Math.max(1, currentPage - 1))}
                          aria-disabled={currentPage <= 1}
                          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : undefined}
                        />
                      </PaginationItem>
                      {pageWindow(currentPage, totalPages).map((p) => (
                        <PaginationItem key={p} className="hidden sm:list-item">
                          <PaginationLink href={pageHref(params, p)} isActive={p === currentPage}>
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href={pageHref(params, Math.min(totalPages, currentPage + 1))}
                          aria-disabled={currentPage >= totalPages}
                          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
      </ConsoleSection>
    </div>
  )
}


export default async function AdminCmasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!adminRole) redirect('/admin/access-denied')
  if (adminRole.role === 'report_viewer') redirect('/admin/access-denied')

  const sp = await searchParams
  const params = normalizeParams(sp)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Comparative Market Analyses</h1>
          <p className="text-sm text-muted-foreground">
            Every CMA the shop has built. Queued requests build automatically every 30 minutes and land
            here as drafts. Review a draft, approve it, then send it to the lead.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/admin/cmas/new">Build CMA</Link>
        </Button>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CmasContent params={params} />
      </Suspense>
    </div>
  )
}

'use client'

import Link from 'next/link'

type Props = {
  pathname: string
  searchParams: Record<string, string | undefined>
  page: number
  perPage: number
  totalCount: number
}

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string>) {
  const p = { ...params, ...overrides }
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export default function ListingsPagination({
  pathname,
  searchParams,
  page,
  perPage,
  totalCount,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
  const start = totalCount === 0 ? 0 : (page - 1) * perPage + 1
  const end = Math.min(page * perPage, totalCount)

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3"
      aria-label="Listings pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start.toLocaleString()}–{end.toLocaleString()}</span> of{' '}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> homes
      </p>
      <div className="flex items-center gap-2">
        <span className="sr-only">Previous page</span>
        <Link
          href={page <= 1 ? pathname : `${pathname}${buildQuery(searchParams, { page: String(page - 1) })}`}
          className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium ${
            page <= 1
              ? 'pointer-events-none border-border bg-card text-muted-foreground'
              : 'border-border bg-card text-foreground hover:bg-card'
          }`}
          aria-disabled={page <= 1}
        >
          Previous
        </Link>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <span className="sr-only">Next page</span>
        <Link
          href={page >= totalPages ? pathname : `${pathname}${buildQuery(searchParams, { page: String(page + 1) })}`}
          className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium ${
            page >= totalPages
              ? 'pointer-events-none border-border bg-card text-muted-foreground'
              : 'border-border bg-card text-foreground hover:bg-card'
          }`}
          aria-disabled={page >= totalPages}
        >
          Next
        </Link>
      </div>
    </nav>
  )
}

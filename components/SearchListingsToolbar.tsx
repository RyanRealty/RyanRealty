'use client'

import Link from 'next/link'

const COLUMN_OPTIONS = [1, 2, 3, 4, 5] as const

type Props = {
  pathname: string
  totalCount: number
  page: number
  pageSize: number
  viewParam: '1' | '2' | '3' | '4' | '5'
  searchParams: Record<string, string | undefined>
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

export default function SearchListingsToolbar({
  pathname,
  totalCount,
  page,
  pageSize,
  viewParam,
  searchParams,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-zinc-500">Columns</span>
        <div className="flex rounded-lg border border-zinc-200 p-0.5">
          {COLUMN_OPTIONS.map((col) => (
            <Link
              key={col}
              href={pathname + buildQuery(searchParams, { view: String(col), page: '1' })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${viewParam === String(col) ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
              title={`${col} column${col === 1 ? '' : 's'} × 3 rows`}
            >
              {col}
            </Link>
          ))}
        </div>
        <span className="text-xs text-zinc-400">× 3 rows</span>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-sm text-zinc-600">
          {totalCount === 0 ? 'No listings' : `${start}–${end} of ${totalCount.toLocaleString()}`}
        </p>
        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <Link
              href={page <= 1 ? pathname : pathname + buildQuery(searchParams, { page: String(page - 1) })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page <= 1 ? 'pointer-events-none text-zinc-400' : 'text-zinc-700 hover:bg-zinc-100'}`}
              aria-disabled={page <= 1}
            >
              Previous
            </Link>
            <span className="px-2 text-sm text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <Link
              href={page >= totalPages ? pathname : pathname + buildQuery(searchParams, { page: String(page + 1) })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page >= totalPages ? 'pointer-events-none text-zinc-400' : 'text-zinc-700 hover:bg-zinc-100'}`}
              aria-disabled={page >= totalPages}
            >
              Next
            </Link>
          </nav>
        )}
      </div>
    </div>
  )
}

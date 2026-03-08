'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const COLUMN_OPTIONS = [1, 2, 3, 4] as const
const PER_PAGE_OPTIONS = [6, 12, 24, 48] as const

type Props = {
  pathname: string
  totalCount: number
  page: number
  pageSize: number
  viewParam: '1' | '2' | '3' | '4' | '5'
  perPageParam: string
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
  perPageParam,
  searchParams,
}: Props) {
  const router = useRouter()
  const path = pathname
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)
  const [jumpPage, setJumpPage] = useState(String(page))
  useEffect(() => {
    setJumpPage(String(page))
  }, [page])

  function handleJump(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(jumpPage, 10)
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      router.push(path + buildQuery(searchParams, { page: String(n) }))
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-500">Per page</span>
          <div className="flex rounded-lg border border-zinc-200 p-0.5">
            {PER_PAGE_OPTIONS.map((n) => (
              <Link
                key={n}
                href={path + buildQuery(searchParams, { perPage: String(n), page: '1' })}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${perPageParam === String(n) ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                title={`${n} per page`}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-500">Columns</span>
          <div className="flex rounded-lg border border-zinc-200 p-0.5">
            {COLUMN_OPTIONS.map((col) => (
              <Link
                key={col}
                href={path + buildQuery(searchParams, { view: String(col), page: '1' })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${viewParam === String(col) ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                title={`${col} column${col === 1 ? '' : 's'}`}
              >
                {col}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-zinc-600">
          {totalCount === 0 ? 'No listings' : `${start}–${end} of ${totalCount.toLocaleString()}`}
        </p>
        {totalPages > 1 && (
          <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
            <Link
              href={page <= 1 ? path : path + buildQuery(searchParams, { page: String(page - 1) })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page <= 1 ? 'pointer-events-none text-zinc-400' : 'text-zinc-700 hover:bg-zinc-100'}`}
              aria-disabled={page <= 1}
            >
              Previous
            </Link>
            <span className="px-2 text-sm text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <Link
              href={page >= totalPages ? path : path + buildQuery(searchParams, { page: String(page + 1) })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page >= totalPages ? 'pointer-events-none text-zinc-400' : 'text-zinc-700 hover:bg-zinc-100'}`}
              aria-disabled={page >= totalPages}
            >
              Next
            </Link>
            {totalPages > 2 && (
              <form onSubmit={handleJump} className="ml-2 flex items-center gap-1">
                <label htmlFor="jump-page" className="sr-only">
                  Jump to page
                </label>
                <input
                  id="jump-page"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  className="w-14 rounded-lg border border-zinc-200 px-2 py-1.5 text-center text-sm"
                  aria-label="Page number"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Go
                </button>
              </form>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}

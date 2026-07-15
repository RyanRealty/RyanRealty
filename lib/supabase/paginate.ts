import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase PostgREST caps results at 1,000 rows per request by default.
 * This helper paginates through ALL matching rows using range-based fetching.
 *
 * Use this whenever you need more than 1,000 rows from a query.
 * For counts, use `{ count: 'exact', head: true }` instead — no pagination needed.
 */
const PAGE_SIZE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  supabase: SupabaseClient,
  table: string,
  selectCols: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery?: (q: any) => any,
): Promise<T[]> {
  const allRows: T[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const base = supabase.from(table).select(selectCols).range(offset, offset + PAGE_SIZE - 1)
    const q = buildQuery ? buildQuery(base) : base
    const { data } = await q
    const rows = (data ?? []) as T[]
    allRows.push(...rows)
    hasMore = rows.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  return allRows
}

export type PagedRowsResult<T> = { rows: T[]; error: { message: string } | null }

/**
 * Builder-callback variant of the paged read (gate G48 `ci:row-cap`): the
 * caller rebuilds its query per page (supabase-js builders are one-shot) and
 * applies `.range(from, to)` from the arguments. Pages in 1,000-row chunks
 * until a short read, or until `maxRows` rows are collected — so a query that
 * previously carried `.limit(N)` with N > 1000 keeps its cap semantics
 * (`rows.length === maxRows` means "hit the cap") without silently truncating
 * at PostgREST's 1,000-row response ceiling.
 *
 * IMPORTANT: the builder must include a STABLE `.order()` (unique column, or a
 * sort column plus a unique tiebreaker) — range paging without a total order
 * can skip or duplicate rows across pages.
 *
 * Stops at the first page error and returns it; `rows` holds whatever pages
 * completed, so callers keep their existing error handling (throw, fallback,
 * or log-and-continue).
 */
export async function fetchPagedRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  maxRows: number = Number.POSITIVE_INFINITY,
): Promise<PagedRowsResult<T>> {
  const rows: T[] = []
  for (let from = 0; rows.length < maxRows; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, maxRows) - 1
    const { data, error } = await build(from, to)
    if (error) return { rows, error }
    const batch = ((data ?? []) as T[])
    rows.push(...batch)
    if (batch.length < to - from + 1) break
  }
  return { rows, error: null }
}

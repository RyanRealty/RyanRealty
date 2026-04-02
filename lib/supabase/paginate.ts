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

import { SEARCH_LIST_PAGE_SIZE } from '@/lib/search/search-page-size'

export function searchRelHrefs(
  canonical: URL,
  page: number,
  total: number,
): { prev?: string; next?: string } {
  const last = Math.max(1, Math.ceil(total / SEARCH_LIST_PAGE_SIZE))
  const withPage = (n: number) => {
    const url = new URL(canonical.toString())
    if (n <= 1) url.searchParams.delete('page')
    else url.searchParams.set('page', String(n))
    return url.toString()
  }
  return {
    prev: page > 1 ? withPage(page - 1) : undefined,
    next: page < last ? withPage(page + 1) : undefined,
  }
}

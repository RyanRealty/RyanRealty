'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { SEARCH_LIST_PAGE_SIZE } from '@/lib/search/search-page-size'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

function hrefForPage(pathname: string, current: URLSearchParams, page: number): string {
  const next = new URLSearchParams(current.toString())
  if (page <= 1) next.delete('page')
  else next.set('page', String(page))
  const query = next.toString()
  return query ? `${pathname}?${query}` : pathname
}

function pageWindow(current: number, last: number): number[] {
  const start = Math.max(1, current - 2)
  const end = Math.min(last, current + 2)
  const pages: number[] = []
  for (let page = start; page <= end; page += 1) pages.push(page)
  return pages
}

/**
 * Crawlable page links on the list view. Infinite scroll still loads more
 * in-session; these hrefs are what Google and a no-JS reader get.
 */
export { searchRelHrefs } from '@/lib/search/search-rel'

export function SearchPagination({
  page,
  total,
}: {
  page: number
  total: number
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const last = Math.max(1, Math.ceil(total / SEARCH_LIST_PAGE_SIZE))
  if (last <= 1) return null
  const href = (n: number) => hrefForPage(pathname, params, n)

  return (
    <Pagination className="srch-pagination py-6">
      <PaginationContent>
        {page > 1 ? (
          <PaginationItem>
            <PaginationPrevious href={href(page - 1)} />
          </PaginationItem>
        ) : null}
        {pageWindow(page, last).map((n) => (
          <PaginationItem key={n}>
            <PaginationLink href={href(n)} isActive={n === page}>
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        {page < last ? (
          <PaginationItem>
            <PaginationNext href={href(page + 1)} />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  )
}

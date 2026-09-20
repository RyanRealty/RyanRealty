import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

export function SearchPager({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number
  pageCount: number
  hrefForPage: (page: number) => string
}) {
  if (pageCount <= 1) return null
  const prev = Math.max(1, page - 1)
  const next = Math.min(pageCount, page + 1)
  const window = [page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount)

  return (
    <Pagination className="srch-pager py-4" data-taste="search-pager">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href={hrefForPage(prev)} aria-disabled={page <= 1} />
        </PaginationItem>
        {window.map((n) => (
          <PaginationItem key={n}>
            <PaginationLink href={hrefForPage(n)} isActive={n === page}>
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href={hrefForPage(next)} aria-disabled={page >= pageCount} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

/** Split-rail "next page of this map" — same catalog control, no new overlay. */
export function SearchPagerMore({
  href,
  label,
  onClick,
}: {
  href?: string
  label: string
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <Pagination className="srch-pager px-4 pb-6" data-taste="search-pager">
        <PaginationContent>
          <PaginationItem>
            <Button type="button" variant="outline" className="srch-chip w-full" onClick={onClick}>
              {label}
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }
  if (href) {
    return (
      <Pagination className="srch-pager px-4 pb-6" data-taste="search-pager">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href={href} size="default" className="srch-chip w-full">
              {label}
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }
  return (
    <Pagination className="srch-pager px-4 pb-6" data-taste="search-pager">
      <PaginationContent>
        <PaginationItem>
          <Link href="#results" className="sr-only">
            {label}
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

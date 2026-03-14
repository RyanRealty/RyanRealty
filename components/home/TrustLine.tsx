'use client'

import Link from 'next/link'

type Props = {
  /** Total count of listings available */
  listingCount: number
  /** City name for the trust line text */
  cityName: string
}

/**
 * Trust line: One line of proof below the hero showing listing count with a "Browse all" link.
 * Per HOME_PAGE_BEST_PRACTICES.md: "One line of proof below the hero (e.g. 'X homes for sale in [City] and surrounding areas') with a clear 'Browse all' or 'View listings' link."
 */
export default function TrustLine({ listingCount, cityName }: Props) {
  return (
    <section
      className="w-full bg-card px-4 py-4 sm:px-6 border-b border-border"
      aria-labelledby="trust-line-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p id="trust-line-heading" className="text-sm font-medium text-muted-foreground">
            <span className="font-semibold text-primary">
              {listingCount.toLocaleString()}
            </span>
            {' homes for sale in '}
            <span className="font-semibold text-primary">{cityName}</span>
            {' and surrounding areas'}
          </p>
          <Link
            href="/homes-for-sale"
            className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground transition-colors"
          >
            Browse all →
          </Link>
        </div>
      </div>
    </section>
  )
}

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BackToResults } from './BackToResults.client'
import './listing-detail.css'

type ListingDetailShellProps = {
  hero?: ReactNode
  main: ReactNode
  sidebar?: ReactNode
  /**
   * Anything `position: fixed`, mounted OUTSIDE the grid. The aside is
   * `display: none` below 64rem and a fixed element does not escape a hidden
   * ancestor, so the mobile broker bar rendered inside it measured 0px high at
   * every width. A fixed control does not belong in a breakpoint-hidden
   * subtree; this slot is where it goes.
   */
  floating?: ReactNode
  className?: string
}

/**
 * Listing-detail layout only. Structured data lives on the page (canonical
 * listingDetailPath, listingShareSummary, gated photos). This shell used to
 * emit a second listing payload with the internal /listing/<key> URL and
 * publicRemarks as description. That duplicate is deleted here.
 */
export function ListingDetailShell({
  hero,
  main,
  sidebar,
  floating,
  className,
}: ListingDetailShellProps) {
  return (
    <div className={className}>
      {hero ? (
        <section aria-label="Listing hero" className="listing-hero-bleed">
          {hero}
        </section>
      ) : null}
      <div className="listing-detail-shell">
        <div className={cn('listing-detail-grid', sidebar && 'has-sidebar')}>
          <div className="listing-detail-main">
            <BackToResults />
            {main}
          </div>
          {sidebar ? (
            <aside className="listing-detail-aside" aria-label="Listing actions">
              {sidebar}
            </aside>
          ) : null}
        </div>
      </div>
      {floating}
    </div>
  )
}

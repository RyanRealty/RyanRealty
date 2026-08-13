import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BackToResults } from './BackToResults.client'
import './listing-detail.css'

type ListingDetailShellProps = {
  hero?: ReactNode
  main: ReactNode
  sidebar?: ReactNode
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
    </div>
  )
}

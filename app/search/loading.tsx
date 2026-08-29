import { Skeleton } from '@/components/ui/skeleton'

/**
 * Split-shell loading state for the default search app-frame (view=split).
 * Matches MapSearchView: one filter row, token-width list pane, ledger rows.
 */
export default function Loading() {
  return (
    <div
      className="search-app-frame w-full bg-background"
      aria-busy="true"
      aria-label="Loading search results"
    >
      <div className="search-filter-dock w-full shrink-0 border-b border-border bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Skeleton className="h-11 min-w-[200px] flex-1 rounded-none" />
          <Skeleton className="hidden h-11 w-28 rounded-none sm:block" />
          <Skeleton className="h-11 w-36 rounded-none" />
        </div>
      </div>

      <div className="map-search-shell flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="map-search-list flex min-h-0 w-full flex-col lg:shrink-0 lg:border-r lg:border-border">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3">
              <Skeleton className="h-4 w-36 rounded-none" />
              <Skeleton className="h-4 w-20 rounded-none" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-background p-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-stretch gap-3 border-b border-border px-3 py-3"
                >
                  <Skeleton className="h-[7.5rem] w-40 shrink-0 rounded-none" />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                    <Skeleton className="h-6 w-28 rounded-none" />
                    <Skeleton className="h-4 w-48 rounded-none" />
                    <Skeleton className="h-3 w-40 rounded-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="hidden min-h-0 min-w-0 flex-1 bg-muted lg:block"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}

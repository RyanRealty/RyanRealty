import { Skeleton } from '@/components/ui/skeleton'

/**
 * Split-shell loading state for the default search app-frame (view=split).
 * Matches MapSearchView chrome: sticky filter placeholders, left list cards,
 * right map grey panel — not a generic 6-card marketing grid.
 */
export default function Loading() {
  return (
    <div
      className="search-app-frame w-full bg-muted"
      aria-busy="true"
      aria-label="Loading search results"
    >
      {/* Sticky filter chrome — mirrors SearchFilters docked under KbNav */}
      <div className="sticky top-16 z-20 w-full shrink-0 border-b border-border bg-card shadow-sm">
        {/* Row 1: omnibox + sort/view/save placeholders */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Skeleton className="h-10 min-w-[200px] flex-1 rounded-lg" />
          <Skeleton className="hidden h-9 w-44 rounded-md sm:block" />
          <Skeleton className="hidden h-9 w-28 rounded-md lg:block" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        {/* Row 2: filter chip placeholders */}
        <div className="flex gap-2 overflow-hidden border-t border-border px-4 py-2.5 sm:px-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      {/* Split body: list (left) + map (right) */}
      <div className="map-search-shell flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* List column — same width band as MapSearchView list panel */}
          <div className="flex min-h-0 w-full flex-col lg:w-[420px] lg:min-w-[360px] lg:max-w-[480px] lg:shrink-0 lg:border-r lg:border-border">
            {/* Count / sort row placeholder */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden bg-muted p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10"
                >
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="space-y-2 px-4 pb-4 pt-3.5">
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map grey panel — desktop; list-first on mobile like the live shell */}
          <div
            className="hidden min-h-0 min-w-0 flex-1 bg-muted-foreground/15 lg:block"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
